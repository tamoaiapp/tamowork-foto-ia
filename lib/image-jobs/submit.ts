import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { criarPrompt, pickComfyBase, uploadImageToComfy, submitWorkflow } from "@/lib/comfyui/client";
import { checkImageJob } from "@/lib/image-jobs/check";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

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

  const { base: comfyBase, index: comfyIndex } = pickComfyBase();
  const imageName = await uploadImageToComfy(job.input_image_url, comfyBase, jobId);
  const promptId = await submitWorkflow(jobId, imageName, promptResult.positive, promptResult.negative, comfyBase);
  const externalJobId = `${comfyIndex}:${promptId}`;
  const provider = "comfyui-direct";

  await supabase
    .from("image_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);

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
