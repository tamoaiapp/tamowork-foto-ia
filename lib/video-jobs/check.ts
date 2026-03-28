import { createServerClient } from "@/lib/supabase/server";
import { VIDEO_COMFY_BASES, getVideoHistory } from "@/lib/comfyui/video-client";
import { checkRunpodJob, RUNPOD_VIDEO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { finalizeVideoJob } from "@/lib/video-jobs/finalize";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";
const MAX_ATTEMPTS = 60; // 60 × 30s = 30 minutos

export async function checkVideoJob(jobId: string) {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select()
    .eq("id", jobId)
    .single();

  if (error || !job) throw new Error("Video job não encontrado");
  if (["done", "failed", "canceled"].includes(job.status)) return;

  const external_job_id = job.external_job_id as string | null;
  if (!external_job_id) {
    await supabase.from("video_jobs").update({ status: "failed", error_message: "external_job_id ausente" }).eq("id", jobId);
    return;
  }

  const newAttempts = (job.attempts ?? 0) + 1;

  await supabase
    .from("video_jobs")
    .update({
      status: job.status === "submitted" ? "processing" : job.status,
      attempts: newAttempts,
    })
    .eq("id", jobId);

  if (newAttempts >= MAX_ATTEMPTS) {
    await supabase.from("video_jobs").update({ status: "failed", error_message: "Timeout: máximo de tentativas" }).eq("id", jobId);
    return;
  }

  // RunPod Serverless (novo formato)
  if (external_job_id.startsWith("runpod:")) {
    const runpodJobId = external_job_id.slice(7);
    let result;
    try {
      result = await checkRunpodJob(RUNPOD_VIDEO_ENDPOINT, runpodJobId);
    } catch {
      result = { status: "pending" as const, outputs: [] };
    }

    if (result.status === "done" && result.outputs.length > 0) {
      const videoBuffer = Buffer.from(result.outputs[0], "base64");
      await finalizeVideoJob(jobId, videoBuffer);
    } else if (result.status === "failed") {
      await supabase.from("video_jobs").update({ status: "failed", error_message: "Falha no RunPod Serverless" }).eq("id", jobId);
    } else {
      await scheduleNextCheck(jobId);
    }
    return;
  }

  // Legado: ComfyUI direto
  const colonIdx = external_job_id.indexOf(":");
  const comfyIndex = parseInt(external_job_id.slice(0, colonIdx), 10);
  const promptId = external_job_id.slice(colonIdx + 1);
  const comfyBase = VIDEO_COMFY_BASES[comfyIndex] ?? VIDEO_COMFY_BASES[0];

  const result = await getVideoHistory(promptId, comfyBase);

  if (result.status === "done" && result.outputUrl) {
    await finalizeVideoJob(jobId, result.outputUrl);
  } else if (result.status === "failed") {
    await supabase.from("video_jobs").update({ status: "failed", error_message: "Falha no ComfyUI" }).eq("id", jobId);
  } else {
    await scheduleNextCheck(jobId);
  }
}

async function scheduleNextCheck(jobId: string) {
  const { qstash } = await import("@/lib/qstash/client");
  await qstash.publishJSON({
    url: `${process.env.APP_URL}/api/internal/video-jobs/check`,
    delay: 30,
    body: { jobId },
    headers: { "x-internal-secret": INTERNAL_SECRET },
  });
}
