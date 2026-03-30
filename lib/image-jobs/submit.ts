import { createServerClient } from "@/lib/supabase/server";
import { criarPrompt, COMFY_BASES, uploadImageToComfy, submitWorkflow } from "@/lib/comfyui/client";

export async function submitImageJob(jobId: string) {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("image_jobs")
    .select()
    .eq("id", jobId)
    .eq("status", "queued")
    .single();

  if (error || !job) throw new Error("Job não encontrado ou não está na fila");

  const [produto_frase, cenarioPart] = (job.prompt ?? "").split(" | cenário: ");
  const cenario = cenarioPart ?? "";

  const promptResult = await criarPrompt(produto_frase.trim(), cenario.trim());

  // Sempre usa pod3 (index 0) — sempre ligado
  const comfyIndex = 0;
  const comfyBase = COMFY_BASES[0];
  const imageName = await uploadImageToComfy(job.input_image_url, comfyBase, jobId);
  const promptId = await submitWorkflow(jobId, imageName, promptResult.positive, promptResult.negative, comfyBase);
  const externalJobId = `${comfyIndex}:${promptId}`;
  const provider = "comfyui-direct";

  await supabase
    .from("image_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);

  // O cron de 1 minuto vai verificar o resultado automaticamente
}
