import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/narrated-video/[jobId] — status de um job
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: job, error: dbErr } = await supabase
    .from("narrated_video_jobs")
    .select("id,status,output_video_url,input_image_url,roteiro,roteiro_melhorado,error_message,created_at,updated_at")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (dbErr || !job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  return NextResponse.json(job);
}

// DELETE /api/narrated-video/[jobId] — cancela ou remove job
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: job } = await supabase
    .from("narrated_video_jobs")
    .select("status")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (job.status === "done") {
    // Job finalizado — apaga o registro
    await supabase.from("narrated_video_jobs").delete().eq("id", jobId).eq("user_id", user.id);
  } else {
    // Job em andamento — cancela
    await supabase
      .from("narrated_video_jobs")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
