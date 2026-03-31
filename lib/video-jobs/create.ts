import { createServerClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/plans";
import { submitVideoJob } from "@/lib/video-jobs/submit";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");

export class ProRequiredError extends Error {
  constructor() { super("pro_required"); }
}

export async function createVideoJob(
  userId: string,
  prompt: string,
  inputImageUrl: string
) {
  const plan = await getUserPlan(userId);
  if (plan !== "pro") throw new ProRequiredError();

  const supabase = createServerClient();
  const { data: job, error } = await supabase
    .from("video_jobs")
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
    submitVideoJob(job.id).catch((err) =>
      console.error("[video-submit-local] erro:", err)
    );
  }

  return job;
}
