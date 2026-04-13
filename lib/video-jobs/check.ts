import { createServerClient } from "@/lib/supabase/server";
import { VIDEO_COMFY_BASES, getVideoHistory } from "@/lib/comfyui/video-client";
import { checkRunpodJob, RUNPOD_VIDEO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { finalizeVideoJob } from "@/lib/video-jobs/finalize";

const MAX_ATTEMPTS = 150; // 150 ciclos de cron = ~2,5 horas (cobre fila longa nos picos)

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
    // Sem external_job_id significa que o submit não concluiu — recoloca em queued para re-submeter
    await supabase.from("video_jobs").update({ status: "queued", attempts: 0 }).eq("id", jobId);
    return;
  }

  const newAttempts = (job.attempts ?? 0) + 1;

  await supabase
    .from("video_jobs")
    .update({
      status: job.status === "submitted" ? "processing" : job.status,
      attempts: newAttempts,
      updated_at: new Date().toISOString(),
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
      if (newAttempts <= 2) {
        // Primeiras 2 falhas: recoloca na fila para re-submeter
        await supabase.from("video_jobs").update({ status: "queued", external_job_id: null }).eq("id", jobId);
      } else {
        await supabase.from("video_jobs").update({ status: "failed", error_message: "Falha no RunPod Serverless" }).eq("id", jobId);
      }
    }
    // se pending: cron verifica novamente no próximo minuto
    return;
  }

  // Legado: ComfyUI direto
  const colonIdx = external_job_id.indexOf(":");
  const comfyIndex = parseInt(external_job_id.slice(0, colonIdx), 10);
  const promptId = external_job_id.slice(colonIdx + 1);
  const comfyBase = VIDEO_COMFY_BASES[comfyIndex] ?? VIDEO_COMFY_BASES[0];

  let result;
  try {
    result = await getVideoHistory(promptId, comfyBase);
  } catch {
    result = { status: "pending" as const, outputUrl: null };
  }

  if (result.status === "done" && result.outputUrl) {
    await finalizeVideoJob(jobId, result.outputUrl);
  } else if (result.status === "failed") {
    if (newAttempts <= 2) {
      // Primeiras 2 falhas: recoloca na fila para re-submeter
      await supabase.from("video_jobs").update({ status: "queued", external_job_id: null }).eq("id", jobId);
    } else {
      await supabase.from("video_jobs").update({ status: "failed", error_message: "Falha no ComfyUI" }).eq("id", jobId);
    }
  }
  // Se pendente, o cron verifica novamente no próximo ciclo
}
