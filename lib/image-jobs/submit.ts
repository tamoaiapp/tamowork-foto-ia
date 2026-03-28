import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { criarPrompt, buildFotoWorkflow, pickComfyBase, uploadImageToComfy, submitWorkflow } from "@/lib/comfyui/client";
import { submitRunpodJob, RUNPOD_FOTO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { ensureFotoPodRunning } from "@/lib/runpod/pods";
import { checkImageJob } from "@/lib/image-jobs/check";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");
const USE_SERVERLESS = process.env.RUNPOD_SERVERLESS_ENABLED === "true";
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

  let externalJobId: string;
  let provider: string;

  if (USE_SERVERLESS) {
    const workflow = buildFotoWorkflow(jobId, "product.jpg", promptResult.positive, promptResult.negative);
    const runpodJobId = await submitRunpodJob(RUNPOD_FOTO_ENDPOINT, workflow, job.input_image_url);
    externalJobId = `runpod:${runpodJobId}`;
    provider = "runpod-serverless";
  } else {
    const { base: comfyBase, index: comfyIndex } = pickComfyBase();
    const podReady = await ensureFotoPodRunning(comfyBase);

    if (!podReady) {
      // Pod iniciando — reagendar submit em 3 minutos
      await qstash.publishJSON({
        url: `${process.env.APP_URL}/api/internal/image-jobs/submit`,
        delay: 180,
        body: { jobId },
        headers: { "x-internal-secret": INTERNAL_SECRET },
      });
      return; // job permanece em status "queued", será retentado
    }

    const imageName = await uploadImageToComfy(job.input_image_url, comfyBase, jobId);
    const promptId = await submitWorkflow(jobId, imageName, promptResult.positive, promptResult.negative, comfyBase);
    externalJobId = `${comfyIndex}:${promptId}`;
    provider = "comfyui-direct";
  }

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
