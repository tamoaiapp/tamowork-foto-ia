import { createServerClient } from "@/lib/supabase/server";
import { submitImageJob } from "@/lib/image-jobs/submit";
import { getUserPlan } from "@/lib/plans";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");

const FREE_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 horas

export class RateLimitError extends Error {
  nextAvailableAt: Date;
  constructor(nextAvailableAt: Date) {
    super("rate_limited");
    this.nextAvailableAt = nextAvailableAt;
  }
}

export async function createImageJob(
  userId: string,
  prompt: string,
  inputImageUrl: string
) {
  const supabase = createServerClient();

  // Verificar plano do usuário
  const plan = await getUserPlan(userId);

  if (plan === "free") {
    // Buscar último job criado nas últimas 3h (excluindo cancelados)
    const since = new Date(Date.now() - FREE_COOLDOWN_MS).toISOString();
    const { data: recentJob } = await supabase
      .from("image_jobs")
      .select("created_at")
      .eq("user_id", userId)
      .neq("status", "canceled")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentJob) {
      const nextAvailableAt = new Date(
        new Date(recentJob.created_at).getTime() + FREE_COOLDOWN_MS
      );
      throw new RateLimitError(nextAvailableAt);
    }
  }

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

  // Em localhost dispara imediatamente; em prod o cron de 1 min pega o job
  if (isLocalhost) {
    submitImageJob(job.id).catch((err) =>
      console.error("[submit-local] erro:", err)
    );
  }

  return job;
}
