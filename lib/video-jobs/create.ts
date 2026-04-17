import { createServerClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/plans";
import { submitVideoJob } from "@/lib/video-jobs/submit";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");
const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const FREE_VIDEO_DAILY_LIMIT = 2;

export class ProRequiredError extends Error {
  constructor() { super("pro_required"); }
}

export class VideoRateLimitError extends Error {
  nextAvailableAt: Date;
  constructor(nextAvailableAt: Date) {
    super("rate_limited_video");
    this.nextAvailableAt = nextAvailableAt;
  }
}

export async function createVideoJob(
  userId: string,
  prompt: string,
  inputImageUrl: string,
  format = "story",
) {
  const plan = await getUserPlan(userId);
  const supabase = createServerClient();

  // Evita jobs simultâneos de vídeo para o mesmo usuário
  const { data: activeJob } = await supabase
    .from("video_jobs")
    .select("id, created_at")
    .eq("user_id", userId)
    .in("status", ["queued", "submitting", "submitted", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (activeJob) {
    const createdAt = activeJob.created_at ? new Date(activeJob.created_at).getTime() : Date.now();
    throw new VideoRateLimitError(new Date(Math.max(Date.now() + 60_000, createdAt + 15 * 60_000)));
  }

  if (plan !== "pro") {
    const since = new Date(Date.now() - FREE_COOLDOWN_MS).toISOString();
    const { data: recentDone } = await supabase
      .from("video_jobs")
      .select("created_at")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(FREE_VIDEO_DAILY_LIMIT);

    if (recentDone && recentDone.length >= FREE_VIDEO_DAILY_LIMIT) {
      const oldest = recentDone[recentDone.length - 1];
      throw new VideoRateLimitError(new Date(new Date(oldest.created_at).getTime() + FREE_COOLDOWN_MS));
    }
  }

  const { data: job, error } = await supabase
    .from("video_jobs")
    .insert({
      user_id: userId,
      prompt,
      input_image_url: inputImageUrl,
      format,
      status: "queued",
    })
    .select()
    .single();

  if (error) throw error;

  // Em localhost dispara imediatamente; em prod o cron de 1 min pega o job
  if (isLocalhost) {
    submitVideoJob(job.id).catch((err) =>
      console.error("[video-submit-local] erro:", err)
    );
  }

  return job;
}
