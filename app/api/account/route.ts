import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [planRes, jobsRes, videoJobsRes, narratedJobsRes, longJobsRes] = await Promise.all([
    supabase
      .from("user_plans")
      .select("plan, period_end, stripe_subscription_id, mp_subscription_id, created_at")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("image_jobs")
      .select("id, status, output_image_url, input_image_url, created_at, prompt")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("video_jobs")
      .select("id, status, output_video_url, input_image_url, created_at, prompt")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("narrated_video_jobs")
      .select("id, status, output_video_url, input_image_url, created_at, roteiro")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("long_video_jobs")
      .select("id, status, output_video_url, input_image_url, created_at, produto")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Combina fotos e vídeos, marcando o tipo, ordena por data desc
  type AnyJob = Record<string, unknown> & { created_at: string };
  const photos = (jobsRes.data ?? []).map((j: AnyJob) => ({ ...j, type: "photo" as const }));
  const videos = (videoJobsRes.data ?? []).map((j: AnyJob) => ({ ...j, type: "video" as const }));
  const narrated = (narratedJobsRes.data ?? []).map((j: AnyJob) => ({ ...j, type: "video" as const, prompt: j.roteiro }));
  const longVideos = (longJobsRes.data ?? []).map((j: AnyJob) => ({ ...j, type: "video" as const, prompt: j.produto }));
  const allJobs = [...photos, ...videos, ...narrated, ...longVideos].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({
    plan: planRes.data ?? null,
    jobs: allJobs,
  });
}

// PATCH /api/account — ativa PRO via pré-ativação Stripe legacy
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { plan, period_end, source } = await req.json();
  if (plan !== "pro") return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

  const { error: upsertError } = await supabase.from("user_plans").upsert({
    user_id: user.id,
    plan: "pro",
    period_end,
    stripe_subscription_id: source ?? "stripe_legacy",
    created_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
