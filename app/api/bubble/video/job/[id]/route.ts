import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkVideoJob } from "@/lib/video-jobs/check";
import { submitVideoJob } from "@/lib/video-jobs/submit";

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY ?? "";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  return key === BUBBLE_API_KEY && BUBBLE_API_KEY !== "";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select("id, status, output_video_url, error_message, created_at, updated_at, attempts")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json({ ok: false, error: "job não encontrado" }, { status: 404 });
  }

  // Aciona submit/check inline — cron roda no deploy antigo, não no prod
  if (job.status === "queued") {
    try {
      await submitVideoJob(id);
      const { data: updated } = await supabase
        .from("video_jobs")
        .select("id, status, output_video_url, error_message, created_at, updated_at, attempts")
        .eq("id", id)
        .single();
      if (updated) {
        return NextResponse.json({
          ok: true,
          job_id: updated.id,
          status: updated.status,
          outputUrl: updated.output_video_url ?? null,
          error: updated.error_message ?? null,
          attempts: updated.attempts ?? 0,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        });
      }
    } catch {
      // Pod pode estar iniciando — retorna estado atual
    }
  } else if (["submitted", "processing"].includes(job.status)) {
    try {
      await checkVideoJob(id);
      const { data: updated } = await supabase
        .from("video_jobs")
        .select("id, status, output_video_url, error_message, created_at, updated_at, attempts")
        .eq("id", id)
        .single();
      if (updated) {
        return NextResponse.json({
          ok: true,
          job_id: updated.id,
          status: updated.status,
          outputUrl: updated.output_video_url ?? null,
          error: updated.error_message ?? null,
          attempts: updated.attempts ?? 0,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        });
      }
    } catch {
      // Ignora erros no check — retorna estado atual
    }
  }

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    status: job.status,               // queued | submitted | processing | done | failed
    outputUrl: job.output_video_url ?? null,
    error: job.error_message ?? null,
    attempts: job.attempts ?? 0,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}
