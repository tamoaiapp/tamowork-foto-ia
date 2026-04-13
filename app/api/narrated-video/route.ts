import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/plans";

// GET /api/narrated-video — lista jobs do usuário
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from("narrated_video_jobs")
    .select("id,status,output_video_url,input_image_url,roteiro,created_at,updated_at,error_message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/narrated-video — cria novo job
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Requer plano Pro
  const plan = await getUserPlan(user.id);
  if (plan !== "pro") {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  let body: { input_image_url?: string; roteiro?: string; voice?: string; scene_source?: string; scene_urls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { input_image_url, roteiro, voice, scene_source, scene_urls } = body;
  const validSceneSource = scene_source === "existing" ? "existing" : "generate";

  if (validSceneSource === "generate" && !input_image_url) {
    return NextResponse.json({ error: "input_image_url obrigatório" }, { status: 400 });
  }
  if (validSceneSource === "existing" && (!scene_urls || scene_urls.length < 2)) {
    return NextResponse.json({ error: "Selecione pelo menos 2 fotos para as cenas" }, { status: 400 });
  }
  if (!roteiro?.trim()) return NextResponse.json({ error: "roteiro obrigatório" }, { status: 400 });

  const validVoice = voice === "masculino" ? "masculino" : "feminino";

  const { data: job, error: insertErr } = await supabase
    .from("narrated_video_jobs")
    .insert({
      user_id: user.id,
      input_image_url: input_image_url ?? null,
      roteiro: roteiro.trim(),
      voice: validVoice,
      scene_source: validSceneSource,
      scene_urls: validSceneSource === "existing" ? scene_urls : null,
      status: "queued",
    })
    .select("id, status")
    .single();

  if (insertErr || !job) {
    return NextResponse.json({ error: insertErr?.message ?? "Erro ao criar job" }, { status: 500 });
  }

  console.log(`[narrated] criado job ${job.id} user=${user.id}`);
  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
}
