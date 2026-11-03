import { after, NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cancelRunpodJob, RUNPOD_FOTO_ENDPOINT } from "@/lib/comfyui/runpod-client";

export const maxDuration = 30;

// POST /api/image-jobs/:id/cancel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const { data: job } = await supabase
    .from("image_jobs")
    .select("status, external_job_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });

  if (job.status === "done" || job.status === "failed") {
    return NextResponse.json({ error: "Job já finalizado" }, { status: 400 });
  }

  const { error } = await supabase
    .from("image_jobs")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (job.external_job_id?.startsWith("runpod:")) {
    after(async () => {
      await cancelRunpodJob(RUNPOD_FOTO_ENDPOINT, job.external_job_id.slice(7));
    });
  }

  return NextResponse.json({ ok: true });
}
