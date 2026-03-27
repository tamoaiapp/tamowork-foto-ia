import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { submitImageJob } from "@/lib/image-jobs/submit";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");

export async function createImageJob(
  userId: string,
  prompt: string,
  inputImageUrl: string
) {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("image_jobs")
    .insert({
      user_id: userId,
      prompt,
      input_image_url: inputImageUrl,
      status: "queued",
    })
    .select()
    .single();

  if (error) throw error;

  if (isLocalhost) {
    // Em localhost: chama diretamente (QStash não consegue chamar localhost)
    submitImageJob(job.id).catch((err) =>
      console.error("[submit-local] erro:", err)
    );
  } else {
    // Em produção: usa QStash para retry automático
    qstash.publishJSON({
      url: `${process.env.APP_URL}/api/internal/image-jobs/submit`,
      body: { jobId: job.id },
    }).catch((err) => console.error("[qstash] falha ao publicar job:", err));
  }

  return job;
}
