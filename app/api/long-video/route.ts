import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/plans";

// GET /api/long-video — lista jobs do usuário
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from("long_video_jobs")
    .select("id,status,output_video_url,produto,clip_urls,error_message,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/long-video — cria novo job
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const plan = await getUserPlan(user.id);
  if (plan !== "pro") return NextResponse.json({ error: "pro_required" }, { status: 403 });

  let body: { input_image_url?: string; produto?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { input_image_url, produto } = body;
  if (!input_image_url) return NextResponse.json({ error: "input_image_url obrigatório" }, { status: 400 });
  if (!produto?.trim()) return NextResponse.json({ error: "produto obrigatório" }, { status: 400 });

  // Validar URL
  try {
    const u = new URL(input_image_url);
    if (!u.hostname.includes(".")) throw new Error("URL inválida");
  } catch {
    return NextResponse.json({ error: "URL de imagem inválida" }, { status: 400 });
  }

  // Checar se já tem job ativo
  const { data: active } = await supabase
    .from("long_video_jobs")
    .select("id,status")
    .eq("user_id", user.id)
    .in("status", ["queued", "generating_photos", "generating_videos", "concatenating"])
    .limit(1);

  if (active && active.length > 0) {
    return NextResponse.json({ error: "already_processing", jobId: active[0].id }, { status: 409 });
  }

  const { data: job, error: insertErr } = await supabase
    .from("long_video_jobs")
    .insert({
      user_id: user.id,
      input_image_url,
      produto: produto.trim(),
      status: "queued",
    })
    .select("id, status")
    .single();

  if (insertErr || !job) return NextResponse.json({ error: insertErr?.message ?? "Erro" }, { status: 500 });

  console.log(`[long-video] criado job ${job.id} user=${user.id}`);
  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
}
