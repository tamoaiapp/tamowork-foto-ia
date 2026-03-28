import { createServerClient } from "@/lib/supabase/server";
import { COMFY_BASES, getComfyHistory } from "@/lib/comfyui/client";
import { checkRunpodJob, RUNPOD_FOTO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { finalizeImageJob } from "@/lib/image-jobs/finalize";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

const MAX_ATTEMPTS = 40; // 40 × 45s ≈ 30 minutos

export async function checkImageJob(jobId: string) {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("image_jobs")
    .select()
    .eq("id", jobId)
    .single();

  if (error || !job) throw new Error("Job não encontrado");
  if (job.status === "done" || job.status === "failed" || job.status === "canceled") return;

  const external_job_id = job.external_job_id as string | null;

  if (!external_job_id) {
    await supabase
      .from("image_jobs")
      .update({ status: "failed", error_message: "external_job_id ausente" })
      .eq("id", jobId);
    return;
  }

  const newAttempts = (job.attempts ?? 0) + 1;

  await supabase
    .from("image_jobs")
    .update({
      status: job.status === "submitted" ? "processing" : job.status,
      attempts: newAttempts,
    })
    .eq("id", jobId);

  if (newAttempts >= MAX_ATTEMPTS) {
    await supabase
      .from("image_jobs")
      .update({ status: "failed", error_message: "Timeout: máximo de tentativas atingido" })
      .eq("id", jobId);
    return;
  }

  // RunPod Serverless (novo formato)
  if (external_job_id.startsWith("runpod:")) {
    const runpodJobId = external_job_id.slice(7);
    let result;
    try {
      result = await checkRunpodJob(RUNPOD_FOTO_ENDPOINT, runpodJobId);
    } catch {
      result = { status: "pending" as const, outputs: [] };
    }

    if (result.status === "done" && result.outputs.length > 0) {
      const imageBuffer = Buffer.from(result.outputs[0], "base64");
      await finalizeImageJob(jobId, imageBuffer);
    } else if (result.status === "failed") {
      if (newAttempts <= 2) {
        await supabase
          .from("image_jobs")
          .update({ status: "queued", external_job_id: null })
          .eq("id", jobId);
        await scheduleRetrySubmit(jobId);
      } else {
        await supabase
          .from("image_jobs")
          .update({ status: "failed", error_message: "Falha no RunPod Serverless" })
          .eq("id", jobId);
      }
    } else {
      await scheduleNextCheck(jobId);
    }
    return;
  }

  // Legado: ComfyUI direto (formato "{comfyIndex}:{promptId}")
  const colonIdx = external_job_id.indexOf(":");
  let comfyIndex = 0;
  let promptId = external_job_id;
  if (colonIdx > 0) {
    comfyIndex = parseInt(external_job_id.slice(0, colonIdx), 10);
    if (isNaN(comfyIndex)) comfyIndex = 0;
    promptId = external_job_id.slice(colonIdx + 1);
  }
  const comfyBase = COMFY_BASES[comfyIndex] ?? COMFY_BASES[0];

  let result;
  try {
    result = await getComfyHistory(promptId, comfyBase);
  } catch {
    result = { status: "failed" as const, outputUrl: null };
  }

  if (result.status === "done" && result.outputUrl) {
    await finalizeImageJob(jobId, result.outputUrl);
  } else if (result.status === "failed") {
    if (newAttempts <= 2) {
      await supabase
        .from("image_jobs")
        .update({ status: "queued", external_job_id: null })
        .eq("id", jobId);
      await scheduleRetrySubmit(jobId);
    } else {
      await supabase
        .from("image_jobs")
        .update({ status: "failed", error_message: "Falha após tentativas no ComfyUI" })
        .eq("id", jobId);
    }
  } else {
    await scheduleNextCheck(jobId);
  }
}

async function scheduleNextCheck(jobId: string) {
  const { qstash } = await import("@/lib/qstash/client");
  await qstash.publishJSON({
    url: `${process.env.APP_URL}/api/internal/image-jobs/check`,
    delay: 45,
    body: { jobId },
    headers: { "x-internal-secret": INTERNAL_SECRET },
  });
}

async function scheduleRetrySubmit(jobId: string) {
  const { qstash } = await import("@/lib/qstash/client");
  await qstash.publishJSON({
    url: `${process.env.APP_URL}/api/internal/image-jobs/submit`,
    delay: 5,
    body: { jobId },
    headers: { "x-internal-secret": INTERNAL_SECRET },
  });
}
