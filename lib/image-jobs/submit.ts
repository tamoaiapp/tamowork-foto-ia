import { createServerClient } from "@/lib/supabase/server";
import { criarPrompt, COMFY_BASES, uploadImageToComfy, submitWorkflow, submitCatalogWorkflow } from "@/lib/comfyui/client";

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

  const promptResult = await criarPrompt(produto_frase.trim(), cenario.trim());

  const comfyIndex = 0;
  const comfyBase = COMFY_BASES[0];

  const productImageName = await uploadImageToComfy(job.input_image_url, comfyBase, `prod_${jobId}`);

  let promptId: string;
  if (modelImageUrl) {
    const modelImageName = await uploadImageToComfy(modelImageUrl, comfyBase, `model_${jobId}`);
    promptId = await submitCatalogWorkflow(jobId, productImageName, modelImageName, promptResult.positive, promptResult.negative, comfyBase);
  } else {
    promptId = await submitWorkflow(jobId, productImageName, promptResult.positive, promptResult.negative, comfyBase);
  }

  const externalJobId = `${comfyIndex}:${promptId}`;
  const provider = "comfyui-direct";

  await supabase
    .from("image_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);
}
