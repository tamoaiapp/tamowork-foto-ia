import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/long-video/[id] — status de um job
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: job, error: dbErr } = await supabase
    .from("long_video_jobs")
    .select("id,status,output_video_url,produto,clip_urls,image_job_ids,video_job_ids,error_message,created_at,updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (dbErr || !job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  return NextResponse.json(job);
}

// DELETE /api/long-video/[id] — cancela ou remove job
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: job } = await supabase
    .from("long_video_jobs")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (job.status === "done") {
    await supabase.from("long_video_jobs").delete().eq("id", id).eq("user_id", user.id);
  } else {
    await supabase
      .from("long_video_jobs")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
