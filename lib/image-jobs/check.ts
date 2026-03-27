import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { tickWorker, getJobResult } from "@/lib/comfyui/client";
import { finalizeImageJob } from "@/lib/image-jobs/finalize";

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

  const external_job_id = job.external_job_id;

  if (!external_job_id) {
    await supabase
      .from("image_jobs")
      .update({ status: "failed", error_message: "external_job_id ausente" })
      .eq("id", jobId);
    return;
  }

  const newAttempts = (job.attempts ?? 0) + 1;

  // Marcar como processing na primeira verificação
  await supabase
    .from("image_jobs")
    .update({
      status: job.status === "submitted" ? "processing" : job.status,
      attempts: newAttempts,
    })
    .eq("id", jobId);

  // Timeout por número de tentativas
  if (newAttempts >= MAX_ATTEMPTS) {
    await supabase
      .from("image_jobs")
      .update({ status: "failed", error_message: "Timeout: máximo de tentativas atingido" })
      .eq("id", jobId);
    return;
  }

  // 2 chamada — cloudb /tick: dispara execução
  await tickWorker().catch(() => {});

  // 3 chamada — clouda /job/{id}: consulta outputUrl
  const res = await getJobResult(external_job_id);

  if (!res.ok) {
    await scheduleNextCheck(jobId);
    return;
  }

  const data = await res.json();

  if (data.outputUrl) {
    // Imagem pronta — finalizar
    await finalizeImageJob(jobId, data.outputUrl);
  } else if (data.status === "failed" || data.error) {
    await supabase
      .from("image_jobs")
      .update({ status: "failed", error_message: data.error ?? "Falha no provedor" })
      .eq("id", jobId);
  } else {
    // Ainda processando — volta para 2 chamada em 45s
    await scheduleNextCheck(jobId);
  }
}

async function scheduleNextCheck(jobId: string) {
  await qstash.publishJSON({
    url: `${process.env.APP_URL}/api/internal/image-jobs/check`,
    delay: 45,
    body: { jobId },
  });
}
