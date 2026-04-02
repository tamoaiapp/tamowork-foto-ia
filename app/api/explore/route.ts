import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Likes falsos consistentes por ID (base para fotos sem curtidas reais)
function fakeLikes(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % 97) + 3; // 3–99
}

// Foto com menos de 2h → máximo 10 likes aparentes
function visibleLikes(id: string, realLikes: number, createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const isNew = ageMs < 2 * 60 * 60 * 1000;
  const base = isNew ? Math.min(realLikes || fakeLikes(id), 10) : (realLikes || fakeLikes(id));
  return base;
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();

  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = 20;
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cutoff2h  = new Date(Date.now() - 2  * 60 * 60 * 1000).toISOString();

  // Busca fotos, vídeos, likes em paralelo
  let imgQuery = supabase
    .from("image_jobs")
    .select("id, output_image_url, prompt, created_at")
    .eq("status", "done")
    .not("output_image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (cursor) imgQuery = imgQuery.lt("created_at", cursor);

  const [
    { data: imgs },
    { data: vids },
    { data: likeCounts },
    { data: userLiked },
  ] = await Promise.all([
    imgQuery,
    supabase
      .from("video_jobs")
      .select("id, output_video_url, prompt, created_at")
      .eq("status", "done")
      .not("output_video_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("job_likes").select("job_id"),
    userId ? supabase.from("job_likes").select("job_id").eq("user_id", userId) : Promise.resolve({ data: [] }),
  ]);

  // Monta mapa de curtidas reais
  const likeMap: Record<string, number> = {};
  (likeCounts ?? []).forEach(r => { likeMap[r.job_id] = (likeMap[r.job_id] ?? 0) + 1; });
  const userLikedSet = new Set((userLiked ?? []).map(r => r.job_id));

  // Normaliza fotos e vídeos
  type FeedItem = { id: string; media_url: string; prompt?: string; created_at: string; type: "photo" | "video"; likes: number; liked: boolean };

  const toItem = (j: { id: string; output_image_url?: string; output_video_url?: string; prompt?: string; created_at: string }, type: "photo" | "video"): FeedItem => ({
    id: j.id,
    media_url: (type === "photo" ? j.output_image_url : j.output_video_url) ?? "",
    prompt: j.prompt,
    created_at: j.created_at,
    type,
    likes: visibleLikes(j.id, likeMap[j.id] ?? 0, j.created_at),
    liked: userLikedSet.has(j.id),
  });

  const all = (imgs ?? []).map(j => toItem(j, "photo"));
  const videos = (vids ?? []).map(j => toItem(j, "video"));

  // Separa por categoria
  const new2h   = all.filter(j => j.created_at >= cutoff2h);                   // novas (<2h)
  const new24h  = all.filter(j => j.created_at >= cutoff24h && j.created_at < cutoff2h); // 2h–24h
  const older   = all.filter(j => j.created_at < cutoff24h);                   // antigas

  // Top 2 mais curtidas nas últimas 24h
  const top24h = [...new2h, ...new24h]
    .sort((a, b) => (likeMap[b.id] ?? 0) - (likeMap[a.id] ?? 0))
    .slice(0, 2);

  // 3 mais novas (< 2h) excluindo as top2
  const top2Ids = new Set(top24h.map(j => j.id));
  const newest3 = new2h.filter(j => !top2Ids.has(j.id)).slice(0, 3);

  // Restantes embaralhados
  const usedIds = new Set([...top2Ids, ...newest3.map(j => j.id)]);
  const remaining = [...new24h, ...older].filter(j => !usedIds.has(j.id));
  // Embaralha remaining
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  // Monta feed: top2 → 3 novas → intercala (random, nova, curtida, random...)
  const feed: FeedItem[] = [...top24h, ...newest3];
  let ri = 0;
  let ni = 3; // próxima nova (depois das 3 já adicionadas)
  const allNew = new2h.filter(j => !usedIds.has(j.id));

  while (feed.length < limit && (ri < remaining.length || ni < allNew.length)) {
    // padrão: random, nova, nova, curtida, random
    if (ri < remaining.length) feed.push(remaining[ri++]);
    if (ni < allNew.length) feed.push(allNew[ni++]);
    if (ni < allNew.length) feed.push(allNew[ni++]);
    // intercala vídeo a cada 4
    if (videos.length && feed.length % 4 === 0) {
      const v = videos[Math.floor(Math.random() * videos.length)];
      if (!feed.find(f => f.id === v.id)) feed.push(v);
    }
    if (ri < remaining.length) feed.push(remaining[ri++]);
  }

  // Garante vídeos no feed
  videos.forEach(v => {
    if (!feed.find(f => f.id === v.id) && feed.length < limit + 5) feed.push(v);
  });

  return NextResponse.json({
    items: feed.slice(0, limit),
    nextCursor: imgs && imgs.length >= 20 ? imgs[imgs.length - 1].created_at : null,
  });
}
