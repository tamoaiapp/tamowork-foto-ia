import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { pickVideoComfyBase, uploadImageToVideoComfy, submitVideoWorkflow, buildVideoWorkflow } from "@/lib/comfyui/video-client";
import { submitRunpodJob, RUNPOD_VIDEO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { ensureVideoPodRunning } from "@/lib/runpod/pods";
import { checkVideoJob } from "@/lib/video-jobs/check";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");
const USE_SERVERLESS = process.env.RUNPOD_SERVERLESS_ENABLED === "true";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

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
    const workflow = buildVideoWorkflow(jobId, "product.jpg", job.prompt ?? "");
    const runpodJobId = await submitRunpodJob(RUNPOD_VIDEO_ENDPOINT, workflow, job.input_image_url);
    externalJobId = `runpod:${runpodJobId}`;
    provider = "runpod-serverless";
  } else {
    const { base: comfyBase, index: comfyIndex } = pickVideoComfyBase();
    const podReady = await ensureVideoPodRunning(comfyBase);

    if (!podReady) {
      await qstash.publishJSON({
        url: `${process.env.APP_URL}/api/internal/video-jobs/submit`,
        delay: 180,
        body: { jobId },
        headers: { "x-internal-secret": INTERNAL_SECRET },
      });
      return;
    }

    const imageName = await uploadImageToVideoComfy(job.input_image_url, comfyBase, jobId);
    const promptId = await submitVideoWorkflow(jobId, imageName, job.prompt ?? "", comfyBase);
    externalJobId = `${comfyIndex}:${promptId}`;
    provider = "comfyui-direct";
  }

  await supabase
    .from("video_jobs")
    .update({ status: "submitted", external_job_id: externalJobId, provider })
    .eq("id", jobId);

  if (isLocalhost) {
    setTimeout(() => checkVideoJob(jobId).catch(console.error), 20_000);
  } else {
    await qstash.publishJSON({
      url: `${process.env.APP_URL}/api/internal/video-jobs/check`,
      delay: 20,
      body: { jobId },
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
  }
}
