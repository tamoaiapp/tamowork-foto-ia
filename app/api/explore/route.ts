import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();

  // Autenticação opcional — não autenticado ainda pode ver o feed
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // created_at do último item para paginação
  const limit = 20;

  let query = supabase
    .from("image_jobs")
    .select("id, output_image_url, prompt, created_at, mode")
    .eq("status", "done")
    .eq("is_public", true)
    .not("output_image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    items: data ?? [],
    nextCursor: data && data.length === limit ? data[data.length - 1].created_at : null,
    userId,
  });
}

// Toggles is_public para o job do usuário autenticado
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { jobId, isPublic } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("image_jobs")
    .update({ is_public: isPublic })
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
