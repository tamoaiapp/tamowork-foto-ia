import { createServerClient } from "@/lib/supabase/server";
import { criarPrompt, COMFY_BASES, uploadImageToComfy, submitWorkflow, submitCatalogWorkflow, buildFotoWorkflow, buildCatalogWorkflow } from "@/lib/comfyui/client";
import { submitRunpodJob, RUNPOD_FOTO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { ensureFotoPodRunning } from "@/lib/runpod/pods";
import { type PhotoFormat, DEFAULT_FORMAT } from "@/lib/formats";
import { getProductVisionDescription, mergeProductTexts, parseVisionStructured } from "@/lib/vision/serverProductVision";
import { classifyVision, enrichScene } from "@/lib/promptuso/visionRouter";
import { buildPromptByType } from "@/lib/promptuso/templates";
import { detectDisplayCategory, buildDisplayPrompt } from "@/lib/promptuso/displayPrompt";
import { classifyUsageMode, resolveUsageAgent, parseProductContext } from "@/lib/promptuso/multiagent";

// Serverless de foto: default agora (endpoint comfyui-serverless, RTX 5090/A40).
// O pod fixo virou fallback — pra reverter, setar RUNPOD_FOTO_SERVERLESS_ENABLED=false
// no Vercel (reverte na hora, sem redeploy de código).
const USE_SERVERLESS = (process.env.RUNPOD_FOTO_SERVERLESS_ENABLED ?? "true") !== "false";

// ── Qualificadores de qualidade profissional ───────────────────────────────────
// Injetados no positive prompt depois do buildPromptResult para elevar o padrão
// sem interferir na lógica de slot/persona do promptuso.
const PROFESSIONAL_QUALITY_SUFFIX = [
  // Iluminação genérica — respeita a cena (outdoor, estúdio, lifestyle, etc.)
  "Professional photography lighting perfectly matched to the scene environment, well-balanced exposure, no harsh shadows on subject, soft and flattering light.",
  // Sombra gerada pela iluminação da cena — não adicionar sombra artificial separada
  "Natural cast shadow from scene lighting only, no separate artificial contact shadow.",
  // Estilo K4 — cinematic Kodak Portra 400 film look (pós-processamento, não conflita com cena)
  "Cinematic Kodak Portra 400 color grade: warm tones, rich mid-tone contrast, slight filmic desaturation in highlights, deep natural blacks.",
  // Qualidade técnica
  "8K ultra-sharp commercial photography, tack-sharp focus on product, professional lens rendering.",
].join(" ");

const PROFESSIONAL_NEGATIVE_SUFFIX = [
  "flat lighting, harsh direct flash, overexposed highlights, underexposed shadows, artificial drop shadow, circular shadow, oval contact shadow, fake vignette shadow, double shadow,",
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

  // Detecta modo especial: prompt começa com "[modo] ..."
  // Ex: "[produto_exposto] vestido" ou "[produto_exposto]" (produto em branco — visão resolve)
  let jobMode = "default";
  if (rawPrompt.startsWith("[")) {
    const modeEnd = rawPrompt.indexOf("]");
    if (modeEnd > 0) {
      jobMode = rawPrompt.slice(1, modeEnd).trim();
      rawPrompt = rawPrompt.slice(modeEnd + 1).trim();
    }
  }

  const [produto_frase, cenarioPart] = rawPrompt.split(" | cenário: ");
  const [cenarioRaw, correcaoPart] = (cenarioPart ?? "").split(" | correcao: ");
  const cenario = cenarioRaw ?? "";
  const userFeedback = correcaoPart?.trim() ?? undefined;

  const comfyIndex = 0;
  const comfyBase = COMFY_BASES[0];
  if (!USE_SERVERLESS && !comfyBase) throw new Error("Nenhum pod de foto configurado (COMFY_BASES vazio)");

  // Pipeline unificado: ensureFotoPod + classifyVision (visao nova) em
  // paralelo. NAO chama mais getProductVisionDescription antigo no modo
  // default — visao nova ja retorna descricao estruturada.
  // Apenas catalogo/produto_exposto usam visao antiga (legado).
  const isCatalog = !!modelImageUrl;
  const useNewPipeline = !isCatalog && jobMode !== "produto_exposto";
  const produto_frase_trim = produto_frase.trim();

  const [podReady, visionDesc, visionNew] = await Promise.all([
    // Serverless nao usa pod fixo — pula o ensureFotoPodRunning
    USE_SERVERLESS ? Promise.resolve(true) : ensureFotoPodRunning(comfyBase),
    // Caminhos legados: catalogo + produto_exposto ainda usam vision antiga
    useNewPipeline ? Promise.resolve(null) : getProductVisionDescription(job.input_image_url, produto_frase_trim),
    // Caminho novo: classifyVision retorna classificacao + scene_en em UMA chamada
    useNewPipeline ? classifyVision(job.input_image_url, produto_frase_trim, cenarioRaw ?? undefined) : Promise.resolve(null),
  ]);

  if (!USE_SERVERLESS && !podReady) {
    await supabase.from("image_jobs").update({ status: "queued", updated_at: new Date().toISOString() }).eq("id", jobId);
    return;
  }

  const produtoBase = produto_frase_trim;
  const enrichedProduto = mergeProductTexts(produtoBase, visionDesc);
  if (visionDesc) console.log(`[submit] job ${jobId} — vision desc legado: "${visionDesc}"`);
  if (visionNew) console.log(`[submit] job ${jobId} — visionNew type=${visionNew.product_type} count=${visionNew.items_count}`);

  const fmt = (job.format as PhotoFormat) ?? DEFAULT_FORMAT;

  // Nomes das imagens: serverless usa nomes computados (a imagem vai no payload do RunPod);
  // pod fixo sobe a imagem pro ComfyUI e usa o nome retornado.
  let productImageName: string;
  let modelImageName = "";
  if (USE_SERVERLESS) {
    const shortId = jobId.replace(/-/g, "").slice(0, 12);
    productImageName = `product_${shortId}.jpg`;
    if (isCatalog) modelImageName = `model_${shortId}.jpg`;
  } else {
    productImageName = await uploadImageToComfy(job.input_image_url, comfyBase, `prod_${jobId}`);
    if (isCatalog) modelImageName = await uploadImageToComfy(modelImageUrl!, comfyBase, `model_${jobId}`);
  }

  // Cada branch monta pos/neg final. A submissao (pod x serverless) e unificada no fim.
  let submitPos = "";
  let submitNeg = "";

  if (isCatalog) {
    // Modo catálogo: Qwen Image Edit — prompt imperativo
    submitPos = buildCatalogPrompt(enrichedProduto, cenario.trim());
    submitNeg = buildCatalogNegative();
  } else if (jobMode === "produto_exposto") {
    // Modo expositor: prompt gerado do zero com regras literais por categoria
    const category = detectDisplayCategory(enrichedProduto);
    const { positive, negative } = buildDisplayPrompt(enrichedProduto, category);
    submitPos = `${positive} Cinematic Kodak Portra 400 color grade, 8K ultra-sharp commercial photography.`.trim();
    submitNeg = `${negative} ${PROFESSIONAL_NEGATIVE_SUFFIX}`.trim();
    console.log(`[submit] job ${jobId} — produto_exposto categoria="${category}" produto="${enrichedProduto}"`);
  } else {
    // Pipeline NOVO (fase 1): visionNew ja trouxe classificacao + scene_en em
    // UMA chamada Ollama (evita swap de modelo na VRAM).
    const vision = visionNew;
    const sceneEnriched = vision?.scene_en?.trim() || cenario.trim();

    if (vision) {
      // OVERRIDE: se usuario escreveu "kit"/"conjunto"/"set"/"trio"/"combo"
      // OU se vision detectou COUNT >= 2, forca product_display
      // (vision LLM pequeno tende a classificar tudo como bag/clothing).
      const userTextLower = `${produtoBase} ${cenario}`.toLowerCase();
      const looksLikeKit =
        /\b(kit|conjunto|set|trio|combo|duo|par(?: de)?|2 itens|3 itens|4 itens|jogo de|colecao|coleção)\b/.test(userTextLower) ||
        (vision.items_count ?? 1) >= 2;
      if (looksLikeKit && vision.product_type !== "product_display") {
        console.log(`[submit] job ${jobId} — OVERRIDE classify ${vision.product_type} -> product_display (kit detectado)`);
        vision.product_type = "product_display";
        if ((vision.items_count ?? 1) < 2) vision.items_count = 2;
      }

      // Caminho novo: template por tipo
      const built = buildPromptByType({
        vision,
        user_product_text: produtoBase,
        scene_text_en: sceneEnriched || cenario.trim(),
        user_feedback: userFeedback,
      });
      const qualitySuffix = "Professional commercial photography, 8K detail, natural studio lighting, sharp focus on the product.";
      submitPos = `${built.positive} ${qualitySuffix}`.trim();
      submitNeg = `${PROFESSIONAL_NEGATIVE_SUFFIX} ${built.negative}`.trim();
      console.log(`[submit] job ${jobId} — visionRouter type=${vision.product_type} count=${vision.items_count} user=${vision.target_user}`);
    } else {
      // Fallback: visao LLM falhou -> usa pipeline antigo do multiagent
      const promptResult = await criarPrompt(enrichedProduto, cenario.trim(), visionDesc ?? undefined, userFeedback);
      const wearableMode = classifyUsageMode({ product_name: enrichedProduto, vision_description: visionDesc ?? undefined });
      const parsedCtx = parseProductContext({ product_name: enrichedProduto, vision_description: visionDesc ?? undefined, scene_request: cenario.trim() });
      const usageAgent = wearableMode === "wearable_use" ? resolveUsageAgent(wearableMode, parsedCtx) : null;
      const isCloseUpProduct =
        usageAgent === "jewelry_ear_agent" || usageAgent === "jewelry_neck_agent" ||
        usageAgent === "jewelry_hand_agent" || usageAgent === "eyewear_agent" ||
        usageAgent === "hat_agent" || usageAgent === "footwear_agent";

      const visionParsed = parseVisionStructured(visionDesc ?? null);
      const typeGuard = visionParsed.itemType
        ? `The product is a ${visionParsed.itemType}. Keep it AS A ${visionParsed.itemType} — do not convert it into a t-shirt, print, sticker, accessory, bracelet, or any other type of item.`
        : "";
      const kitGuard = (visionParsed.itemsCount && visionParsed.itemsCount > 1)
        ? `The reference image contains a set of ${visionParsed.itemsCount} items — ALL ${visionParsed.itemsCount} items must appear in the final scene, each preserved as its original product type.`
        : "";

      const qualitySuffix = "Professional commercial photography, 8K detail, natural studio lighting, sharp focus on the product.";
      submitPos = [typeGuard, kitGuard, promptResult.positive, qualitySuffix].filter(Boolean).join(" ").trim();
      const bareFootGuard = (wearableMode === "wearable_use" && !isCloseUpProduct) ? "barefoot, bare feet, no shoes," : "";
      const conversionNeg = "product converted to t-shirt, original product replaced, print copied onto different item, derived item, missing items from set, only one of multiple products visible,";
      submitNeg = `${PROFESSIONAL_NEGATIVE_SUFFIX} ${conversionNeg} ${bareFootGuard} ${promptResult.negative}`.trim();
      console.log(`[submit] job ${jobId} — FALLBACK multiagent (visionRouter retornou null)`);
    }
  }

  // Submissao unificada: serverless (RunPod comfyui-serverless) ou pod fixo (ComfyUI direto)
  let externalJobId: string;
  let provider: string;
  if (USE_SERVERLESS) {
    let runpodJobId: string;
    if (isCatalog) {
      const wf = buildCatalogWorkflow(jobId, productImageName, modelImageName, submitPos, submitNeg);
      runpodJobId = await submitRunpodJob(RUNPOD_FOTO_ENDPOINT, wf, job.input_image_url, productImageName, [{ url: modelImageUrl!, name: modelImageName }]);
    } else {
      const wf = buildFotoWorkflow(jobId, productImageName, submitPos, submitNeg, fmt);
      runpodJobId = await submitRunpodJob(RUNPOD_FOTO_ENDPOINT, wf, job.input_image_url, productImageName);
    }
    externalJobId = `runpod:${runpodJobId}`;
    provider = "runpod-serverless";
  } else {
    let promptId: string;
    if (isCatalog) {
      promptId = await submitCatalogWorkflow(jobId, productImageName, modelImageName, submitPos, submitNeg, comfyBase);
    } else {
      promptId = await submitWorkflow(jobId, productImageName, submitPos, submitNeg, comfyBase, fmt);
    }
    externalJobId = `${comfyIndex}:${promptId}`;
    provider = "comfyui-direct";
  }

  await supabase
    .from("image_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);
}
