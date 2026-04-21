import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/plans";

const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const FREE_NARRATED_DAILY_LIMIT = 1;

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

  // Limite de vídeos narrados para plano free: 2 por 24h
  const plan = await getUserPlan(user.id);
  if (plan !== "pro") {
    const since = new Date(Date.now() - FREE_COOLDOWN_MS).toISOString();
    const { data: recentDone } = await supabase
      .from("narrated_video_jobs")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(FREE_NARRATED_DAILY_LIMIT);

    if (recentDone && recentDone.length >= FREE_NARRATED_DAILY_LIMIT) {
      const oldest = recentDone[recentDone.length - 1];
      const nextAvailableAt = new Date(new Date(oldest.created_at).getTime() + FREE_COOLDOWN_MS);
      return NextResponse.json(
        { error: "rate_limited", nextAvailableAt: nextAvailableAt.toISOString() },
        { status: 429 }
      );
    }
  }

  let body: { input_image_url?: string; roteiro?: string; voice?: string; voice_sample_url?: string; scene_source?: string; scene_urls?: string[]; format?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { input_image_url, roteiro, voice, voice_sample_url, scene_source, scene_urls } = body;
  const validSceneSource = scene_source === "existing" ? "existing" : "generate";

  if (validSceneSource === "generate" && !input_image_url) {
    return NextResponse.json({ error: "input_image_url obrigatório" }, { status: 400 });
  }
  if (validSceneSource === "existing" && (!scene_urls || scene_urls.length < 2)) {
    return NextResponse.json({ error: "Selecione pelo menos 2 fotos para as cenas" }, { status: 400 });
  }
  if (!roteiro?.trim()) return NextResponse.json({ error: "roteiro obrigatório" }, { status: 400 });

  const validVoice = voice === "masculino" ? "masculino" : "feminino";

  const validFormat = ["story","square","portrait","horizontal"].includes(body.format ?? "") ? body.format : "story";

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    input_image_url: input_image_url ?? null,
    roteiro: roteiro.trim(),
    voice: validVoice,
    scene_source: validSceneSource,
    scene_urls: validSceneSource === "existing" ? scene_urls : null,
    format: validFormat,
    status: "queued",
  };
  if (voice_sample_url) insertPayload.voice_sample_url = voice_sample_url;

  let { data: job, error: insertErr } = await supabase
    .from("narrated_video_jobs")
    .insert(insertPayload)
    .select("id, status")
    .single();

  // Fallback: coluna voice_sample_url ainda não existe — tenta sem ela
  if (insertErr?.code === "42703" && voice_sample_url) {
    const fallback = await supabase
      .from("narrated_video_jobs")
      .insert({ ...insertPayload, voice_sample_url: undefined })
      .select("id, status")
      .single();
    job = fallback.data;
    insertErr = fallback.error;
    console.warn("[narrated] voice_sample_url ignorado: coluna não existe ainda");
  }

  if (insertErr || !job) {
    return NextResponse.json({ error: insertErr?.message ?? "Erro ao criar job" }, { status: 500 });
  }

  console.log(`[narrated] criado job ${job.id} user=${user.id}`);
  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
}
