import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/likes?jobIds=id1,id2,... → retorna contagens + se o usuário curtiu
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }

  const jobIds = (req.nextUrl.searchParams.get("jobIds") ?? "").split(",").filter(Boolean);
  if (!jobIds.length) return NextResponse.json({ counts: {}, userLikes: [] });

  const [{ data: counts }, { data: userLikes }] = await Promise.all([
    supabase.from("job_likes").select("job_id").in("job_id", jobIds),
    userId
      ? supabase.from("job_likes").select("job_id").eq("user_id", userId).in("job_id", jobIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Agrupa contagens por job_id
  const countMap: Record<string, number> = {};
  (counts ?? []).forEach(r => { countMap[r.job_id] = (countMap[r.job_id] ?? 0) + 1; });

  return NextResponse.json({
    counts: countMap,
    userLikes: (userLikes ?? []).map(r => r.job_id),
  });
}

// POST /api/likes  { jobId }  → toggle like
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId obrigatório" }, { status: 400 });

  // Verifica se já curtiu
  const { data: existing } = await supabase
    .from("job_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("job_id", jobId)
    .single();

  if (existing) {
    await supabase.from("job_likes").delete().eq("user_id", user.id).eq("job_id", jobId);
    return NextResponse.json({ liked: false });
  } else {
    await supabase.from("job_likes").insert({ user_id: user.id, job_id: jobId });
    return NextResponse.json({ liked: true });
  }
}
