import { createServerClient } from "@/lib/supabase/server";
import { pickVideoComfyBase, uploadImageToVideoComfy, submitVideoWorkflow, buildVideoWorkflow } from "@/lib/comfyui/video-client";
import { submitRunpodJob, RUNPOD_VIDEO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { ensureVideoPodRunning } from "@/lib/runpod/pods";

const USE_SERVERLESS = process.env.RUNPOD_SERVERLESS_ENABLED === "true";

export async function submitVideoJob(jobId: string) {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select()
    .eq("id", jobId)
    .eq("status", "queued")
    .single();

  if (error || !job) throw new Error("Video job não encontrado ou não está na fila");

  let externalJobId: string;
  let provider: string;

  if (USE_SERVERLESS) {
    const imgName = `product_${jobId.replace(/-/g, "").slice(0, 12)}.jpg`;
    const workflow = buildVideoWorkflow(jobId, imgName, job.prompt ?? "", 6, 16, job.prompt_neg ?? undefined);
    const runpodJobId = await submitRunpodJob(RUNPOD_VIDEO_ENDPOINT, workflow, job.input_image_url, imgName);
    externalJobId = `runpod:${runpodJobId}`;
    provider = "runpod-serverless";
  } else {
    const { base: comfyBase, index: comfyIndex } = pickVideoComfyBase();
    const podReady = await ensureVideoPodRunning(comfyBase);

    if (!podReady) {
      // Pod não está pronto — volta para queued, o cron tenta novamente em 1 min
      await supabase.from("video_jobs").update({ status: "queued" }).eq("id", jobId);
      return;
    }

    const imageName = await uploadImageToVideoComfy(job.input_image_url, comfyBase, jobId);
    const promptId = await submitVideoWorkflow(jobId, imageName, job.prompt ?? "", comfyBase, 6, 16, job.prompt_neg ?? undefined);
    externalJobId = `${comfyIndex}:${promptId}`;
    provider = "comfyui-direct";
  }

  await supabase
    .from("video_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);
  // O cron de 1 minuto vai verificar o resultado automaticamente
}
