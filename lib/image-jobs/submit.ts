import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { criarPrompt, pickComfyBase, uploadImageToComfy, submitWorkflow } from "@/lib/comfyui/client";
import { checkImageJob } from "@/lib/image-jobs/check";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");

export async function submitImageJob(jobId: string) {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("image_jobs")
    .select()
    .eq("id", jobId)
    .eq("status", "queued")
    .single();

  if (error || !job) throw new Error("Job não encontrado ou não está na fila");

  // Extrair produto e cenario do campo prompt
  const [produto_frase, cenarioPart] = (job.prompt ?? "").split(" | cenário: ");
  const cenario = cenarioPart ?? "";

  // 1. Criar prompt via promptuso (mantido no GCP)
  const promptResult = await criarPrompt(produto_frase.trim(), cenario.trim());

  // 2. Escolher instância do ComfyUI
  const { base: comfyBase, index: comfyIndex } = pickComfyBase();

  // 3. Upload da imagem para o ComfyUI
  const imageName = await uploadImageToComfy(job.input_image_url, comfyBase);

  // 4. Submeter o workflow — recebe o prompt_id do ComfyUI
  const promptId = await submitWorkflow(
    jobId,
    imageName,
    promptResult.positive,
    promptResult.negative,
    comfyBase
  );

  // Salvar external_job_id como "{comfyIndex}:{promptId}" para saber qual instância usar no check
  await supabase
    .from("image_jobs")
    .update({
      status: "submitted",
      external_job_id: `${comfyIndex}:${promptId}`,
      provider: "comfyui-direct",
    })
    .eq("id", jobId);

  const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

  if (isLocalhost) {
    setTimeout(() => checkImageJob(jobId).catch(console.error), 45_000);
  } else {
    await qstash.publishJSON({
      url: `${process.env.APP_URL}/api/internal/image-jobs/check`,
      delay: 45,
      body: { jobId },
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
  }
}
