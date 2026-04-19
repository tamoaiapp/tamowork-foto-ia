import { createServerClient } from "@/lib/supabase/server";
import { submitImageJob } from "@/lib/image-jobs/submit";
import { getUserPlan } from "@/lib/plans";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");

const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas
const FREE_DAILY_LIMIT = 3; // fotos grátis por período de 24h

export class RateLimitError extends Error {
  nextAvailableAt: Date;
  constructor(nextAvailableAt: Date) {
    super("rate_limited");
    this.nextAvailableAt = nextAvailableAt;
  }
}

const MAX_BONUS_RETRIES_PER_DAY = 3;

export async function createImageJob(
  userId: string,
  prompt: string,
  inputImageUrl: string,
  format = "story",
  bonusRetry = false,
  source = "app",
) {
  const supabase = createServerClient();

  // Verificar plano do usuário
  const plan = await getUserPlan(userId);

  // Bloqueia para TODOS os planos se já há job ativo — previne jobs simultâneos
  const { data: activeJob } = await supabase
    .from("image_jobs")
    .select("id, created_at")
    .eq("user_id", userId)
    .in("status", ["queued", "submitted", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (activeJob) {
    const jobCreatedAt = activeJob.created_at ? new Date(activeJob.created_at).getTime() : Date.now();
    const nextAvailableAt = new Date(Math.max(Date.now() + 60_000, jobCreatedAt + 15 * 60_000));
    throw new RateLimitError(nextAvailableAt);
  }

  if (plan === "free") {
    const since = new Date(Date.now() - FREE_COOLDOWN_MS).toISOString();

    if (bonusRetry) {
      // Bonus retry: verifica quantos bonus já usados hoje (máximo MAX_BONUS_RETRIES_PER_DAY)
      const { count } = await supabase
        .from("image_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_bonus_retry", true)
        .gte("created_at", since);

      if ((count ?? 0) >= MAX_BONUS_RETRIES_PER_DAY) {
        throw new RateLimitError(new Date(Date.now() + FREE_COOLDOWN_MS));
      }
      // Bonus aprovado — pula o rate limit normal
    } else {
      // Só desconta se a foto ficou pronta (status "done") — falhas não consomem o crédito
      // Jobs de onboarding (source = onboarding_A/B/C) não contam no limite diário
      const { data: recentJobs } = await supabase
        .from("image_jobs")
        .select("created_at")
        .eq("user_id", userId)
        .eq("status", "done")
        .not("source", "like", "onboarding%")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(FREE_DAILY_LIMIT);

      if (recentJobs && recentJobs.length >= FREE_DAILY_LIMIT) {
        const oldest = recentJobs[recentJobs.length - 1];
        const nextAvailableAt = new Date(
          new Date(oldest.created_at).getTime() + FREE_COOLDOWN_MS
        );
        throw new RateLimitError(nextAvailableAt);
      }
    }
  }

  const { data: job, error } = await supabase
    .from("image_jobs")
    .insert({
      user_id: userId,
      prompt,
      input_image_url: inputImageUrl,
      format,
      status: "queued",
      source,
      ...(bonusRetry ? { is_bonus_retry: true } : {}),
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
