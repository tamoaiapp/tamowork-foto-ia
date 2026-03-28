import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { getUserPlan } from "@/lib/plans";
import { submitVideoJob } from "@/lib/video-jobs/submit";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

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

  if (isLocalhost) {
    submitVideoJob(job.id).catch((err) =>
      console.error("[video-submit-local] erro:", err)
    );
  } else {
    qstash.publishJSON({
      url: `${process.env.APP_URL}/api/internal/video-jobs/submit`,
      body: { jobId: job.id },
      headers: { "x-internal-secret": INTERNAL_SECRET },
    }).catch((err) => console.error("[qstash-video] falha:", err));
  }

  return job;
}
