import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkVideoJob } from "@/lib/video-jobs/check";
import { submitVideoJob } from "@/lib/video-jobs/submit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { data, error: dbErr } = await supabase
    .from("video_jobs")
    .select()
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (dbErr || !data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Aciona submit/check inline — cron roda no deploy antigo, não no prod
  // Timeout de 8s para não estourar limite de função serverless
  const INLINE_TIMEOUT = 8_000;
  if (data.status === "queued") {
    try {
      await Promise.race([
        submitVideoJob(id),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), INLINE_TIMEOUT)),
      ]);
      const { data: updated } = await supabase
        .from("video_jobs")
        .select()
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (updated) return NextResponse.json(updated);
    } catch {
      // Pod pode estar iniciando ou timeout — retorna estado atual
    }
  } else if (["submitted", "processing"].includes(data.status)) {
    try {
      await Promise.race([
        checkVideoJob(id),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), INLINE_TIMEOUT)),
      ]);
      const { data: updated } = await supabase
        .from("video_jobs")
        .select()
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (updated) return NextResponse.json(updated);
    } catch {
      // Ignora erros no check ou timeout — retorna o estado atual
    }
  }

  return NextResponse.json(data);
}
