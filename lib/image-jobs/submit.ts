import { createServerClient } from "@/lib/supabase/server";
import { criarPrompt, COMFY_BASES, uploadImageToComfy, submitWorkflow, submitCatalogWorkflow } from "@/lib/comfyui/client";
import { ensureFotoPodRunning } from "@/lib/runpod/pods";

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

  const { data: job, error } = await supabase
    .from("image_jobs")
    .select()
    .eq("id", jobId)
    .eq("status", "queued")
    .single();

  if (error || !job) throw new Error("Job não encontrado ou não está na fila");

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

  // Verifica se o pod está online antes de submeter
  // Se não estiver, dispara o resume e retorna limpo — job fica em queued para próxima tentativa
  const podReady = await ensureFotoPodRunning(comfyBase);
  if (!podReady) return;

  const productImageName = await uploadImageToComfy(job.input_image_url, comfyBase, `prod_${jobId}`);

  let promptId: string;
  if (modelImageUrl) {
    // Modo catálogo: usa Qwen Image Edit — precisa de instruções diretas e imperativas
    const modelImageName = await uploadImageToComfy(modelImageUrl, comfyBase, `model_${jobId}`);
    const catalogPos = buildCatalogPrompt(produto_frase.trim(), cenario.trim());
    const catalogNeg = buildCatalogNegative();
    promptId = await submitCatalogWorkflow(jobId, productImageName, modelImageName, catalogPos, catalogNeg, comfyBase);
  } else {
    const promptResult = await criarPrompt(produto_frase.trim(), cenario.trim());
    promptId = await submitWorkflow(jobId, productImageName, promptResult.positive, promptResult.negative, comfyBase);
  }

  const externalJobId = `${comfyIndex}:${promptId}`;
  const provider = "comfyui-direct";

  await supabase
    .from("image_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);
}
