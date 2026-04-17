import { createServerClient } from "@/lib/supabase/server";
import { COMFY_BASES, getComfyHistory, freeComfyMemory } from "@/lib/comfyui/client";
import { checkRunpodJob, RUNPOD_FOTO_ENDPOINT } from "@/lib/comfyui/runpod-client";
import { finalizeImageJob } from "@/lib/image-jobs/finalize";

const MAX_ATTEMPTS = 40; // 40 × ~60s ≈ 40 minutos (cron a cada 1 min)

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
    // Sem external_job_id significa que o submit não concluiu — recoloca em queued para re-submeter
    await supabase
      .from("image_jobs")
      .update({ status: "queued", attempts: 0 })
      .eq("id", jobId);
    return;
  }

  const newAttempts = (job.attempts ?? 0) + 1;

  await supabase
    .from("image_jobs")
    .update({
      status: job.status === "submitted" ? "processing" : job.status,
      attempts: newAttempts,
      updated_at: new Date().toISOString(),
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
        // cron vai resubmeter automaticamente no próximo ciclo
      } else {
        await supabase
          .from("image_jobs")
          .update({ status: "failed", error_message: "Falha no RunPod Serverless" })
          .eq("id", jobId);
      }
    }
    // se pending: cron verifica novamente no próximo minuto
    return;
  }

  // ComfyUI direto (formato "{comfyIndex}:{promptId}")
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
    // OOM: libera VRAM antes de re-enfileirar para o retry ter GPU limpa
    if (result.isOOM) {
      console.log(`[check] job ${jobId} — OOM detectado, liberando VRAM via /free`);
      await freeComfyMemory(comfyBase);
    }
    if (newAttempts <= 2) {
      await supabase
        .from("image_jobs")
        .update({ status: "queued", external_job_id: null })
        .eq("id", jobId);
      // cron vai resubmeter automaticamente no próximo ciclo
    } else {
      await supabase
        .from("image_jobs")
        .update({ status: "failed", error_message: "Falha após tentativas no ComfyUI" })
        .eq("id", jobId);
    }
  }
  // se pending: cron verifica novamente no próximo minuto
}
