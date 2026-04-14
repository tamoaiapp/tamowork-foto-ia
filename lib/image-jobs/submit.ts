import { createServerClient } from "@/lib/supabase/server";
import { criarPrompt, COMFY_BASES, uploadImageToComfy, submitWorkflow, submitCatalogWorkflow } from "@/lib/comfyui/client";
import { ensureFotoPodRunning } from "@/lib/runpod/pods";
import { getProductVisionDescription, mergeProductTexts } from "@/lib/vision/serverProductVision";

// ── Qualificadores de qualidade profissional ───────────────────────────────────
// Injetados no positive prompt depois do buildPromptResult para elevar o padrão
// sem interferir na lógica de slot/persona do promptuso.
const PROFESSIONAL_QUALITY_SUFFIX = [
  // Iluminação genérica — respeita a cena (outdoor, estúdio, lifestyle, etc.)
  "Professional photography lighting perfectly matched to the scene environment, well-balanced exposure, no harsh shadows on subject, soft and flattering light.",
  // Sombra realista — sempre presente, adapta-se à direção da luz da cena
  "Subtle natural drop shadow beneath the product consistent with scene lighting direction, soft ground contact shadow, realistic shadow opacity.",
  // Estilo K4 — cinematic Kodak Portra 400 film look (pós-processamento, não conflita com cena)
  "Cinematic Kodak Portra 400 color grade: warm tones, rich mid-tone contrast, slight filmic desaturation in highlights, deep natural blacks.",
  // Qualidade técnica
  "8K ultra-sharp commercial photography, tack-sharp focus on product, professional lens rendering.",
].join(" ");

const PROFESSIONAL_NEGATIVE_SUFFIX = [
  "flat lighting, harsh direct flash, overexposed highlights, underexposed shadows, no shadow at all, floating product with no ground shadow,",
  "amateur snapshot, phone camera, grainy, noisy, low resolution, blurry, out of focus, pixelated,",
  "oversaturated colors, neon colors, unnatural color cast, cold white balance,",
].join(" ");

/**
 * Prompt imperativo para o Qwen Image Edit (modo catálogo).
 * O Qwen responde melhor a instruções diretas do que prompts descritivos.
 */
function buildCatalogPrompt(produto: string, cenario: string): string {
  const parts: string[] = [];

  // Instrução principal: vestir a roupa do produto na pessoa do modelo
  parts.push(
    `Dress the person from the second reference image with the clothing shown in the first product image.`,
    `Keep the person's face, skin tone, hair, and body exactly as in the reference photo — do not change them.`,
    `The clothing must look exactly like in the product photo: same colors, same patterns, same style.`,
  );

  // Fundo/cenário
  if (cenario.trim()) {
    parts.push(`Place the person in this setting: ${cenario}.`);
  } else {
    parts.push(`Replace the entire background with a clean, elegant studio environment or a simple lifestyle setting.`);
  }

  // Limpeza do fundo — instrução mais direta para Qwen
  parts.push(
    `Remove ALL elements from the background that are not part of the final scene: remove every mannequin, remove every clothing rack, remove every store shelf, remove every display stand, remove every price tag, and remove every other person or figure.`,
    `The final image must show exactly ONE person wearing the product, with a clean background.`,
    `Do not include any part of the original store, showroom, or display environment in the output.`,
  );

  // Qualidade
  parts.push(`Professional commercial photo, sharp focus, realistic lighting.`);

  if (produto.trim()) {
    parts.push(`Product being shown: ${produto}.`);
  }

  return parts.join(" ");
}

function buildCatalogNegative(): string {
  return [
    "mannequin, mannequins, dummy, bust form, clothing rack, store shelf, display stand, store background, showroom, retail environment",
    "multiple people, crowd, other figures in background, second person, third person",
    "changed face, different face, altered skin tone, different hair",
    "blurry, low quality, watermark, text overlay, logo",
    "black border, white padding, screenshot frame, UI element",
  ].join(", ");
}

const MODEL_IMG_PREFIX = "model_img:";

export async function submitImageJob(jobId: string) {
  const supabase = createServerClient();

  // Lock atômico: transiciona queued → submitting para evitar submissões duplicadas paralelas
  const { data: locked, error: lockErr } = await supabase
    .from("image_jobs")
    .update({ status: "submitting", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued")
    .select()
    .single();

  if (lockErr || !locked) return; // Outro processo já pegou — sai silenciosamente
  const job = locked;

  // Detecta catálogo: prompt começa com "model_img:URL | ..."
  let rawPrompt = job.prompt ?? "";
  let modelImageUrl: string | null = null;

  if (rawPrompt.startsWith(MODEL_IMG_PREFIX)) {
    const pipeIdx = rawPrompt.indexOf(" | ");
    modelImageUrl = rawPrompt.slice(MODEL_IMG_PREFIX.length, pipeIdx);
    rawPrompt = rawPrompt.slice(pipeIdx + 3);
  }

  const [produto_frase, cenarioPart] = rawPrompt.split(" | cenário: ");
  const cenario = cenarioPart ?? "";

  const comfyIndex = 0;
  const comfyBase = COMFY_BASES[0];
  if (!comfyBase) throw new Error("Nenhum pod de foto configurado (COMFY_BASES vazio)");

  // ── Visão de produto (A40 Ollama) ─────────────────────────────────────────
  // Roda em paralelo com a verificação do pod para não adicionar latência.
  // Se o Ollama estiver offline, visionDesc é null e usamos o texto do usuário.
  const isCatalog = !!modelImageUrl;
  const [podReady, visionDesc] = await Promise.all([
    ensureFotoPodRunning(comfyBase),
    // Catálogo tem prompt imperativo próprio — não enriquece com visão
    isCatalog ? Promise.resolve(null) : getProductVisionDescription(job.input_image_url, produto_frase.trim()),
  ]);

  if (!podReady) {
    await supabase.from("image_jobs").update({ status: "queued", updated_at: new Date().toISOString() }).eq("id", jobId);
    return;
  }

  // Mescla texto do usuário com resultado da visão
  const enrichedProduto = isCatalog ? produto_frase.trim() : mergeProductTexts(produto_frase.trim(), visionDesc);
  if (visionDesc) {
    console.log(`[submit] job ${jobId} — visão enriqueceu prompt: "${produto_frase.trim()}" → "${enrichedProduto}"`);
  }

  const productImageName = await uploadImageToComfy(job.input_image_url, comfyBase, `prod_${jobId}`);

  let promptId: string;
  if (isCatalog) {
    // Modo catálogo: usa Qwen Image Edit — mantém prompt imperativo sem alterações
    const modelImageName = await uploadImageToComfy(modelImageUrl!, comfyBase, `model_${jobId}`);
    const catalogPos = buildCatalogPrompt(enrichedProduto, cenario.trim());
    const catalogNeg = buildCatalogNegative();
    promptId = await submitCatalogWorkflow(jobId, productImageName, modelImageName, catalogPos, catalogNeg, comfyBase);
  } else {
    const promptResult = await criarPrompt(enrichedProduto, cenario.trim());

    // Injeta qualidade profissional (sombra + iluminação + K4 cinematic)
    const positiveEnhanced = `${promptResult.positive} ${PROFESSIONAL_QUALITY_SUFFIX}`.trim();
    const negativeEnhanced = `${PROFESSIONAL_NEGATIVE_SUFFIX} ${promptResult.negative}`.trim();

    promptId = await submitWorkflow(jobId, productImageName, positiveEnhanced, negativeEnhanced, comfyBase);
  }

  const externalJobId = `${comfyIndex}:${promptId}`;
  const provider = "comfyui-direct";

  await supabase
    .from("image_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);
}
