import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkVideoJob } from "@/lib/video-jobs/check";

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

  // Se o job está em andamento, aciona o check diretamente (fallback caso o cron falhe)
  if (["submitted", "processing"].includes(data.status)) {
    try {
      await checkVideoJob(id);
      // Re-lê o status atualizado
      const { data: updated } = await supabase
        .from("video_jobs")
        .select()
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (updated) return NextResponse.json(updated);
    } catch {
      // Ignora erros no check — retorna o estado atual
    }
  }

  return NextResponse.json(data);
}
