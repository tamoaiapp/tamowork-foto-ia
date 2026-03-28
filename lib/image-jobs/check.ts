import { createServerClient } from "@/lib/supabase/server";
import { COMFY_BASES, getComfyHistory } from "@/lib/comfyui/client";
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

  // Parsear "{comfyIndex}:{promptId}"
  const colonIdx = external_job_id.indexOf(":");
  const comfyIndex = parseInt(external_job_id.slice(0, colonIdx), 10);
  const promptId = external_job_id.slice(colonIdx + 1);
  const comfyBase = COMFY_BASES[comfyIndex] ?? COMFY_BASES[0];

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

  // Consultar o ComfyUI diretamente — sem clouda/cloudb/Firestore
  const result = await getComfyHistory(promptId, comfyBase);

  if (result.status === "done" && result.outputUrl) {
    await finalizeImageJob(jobId, result.outputUrl);
  } else if (result.status === "failed") {
    await supabase
      .from("image_jobs")
      .update({ status: "failed", error_message: "Falha no ComfyUI" })
      .eq("id", jobId);
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
