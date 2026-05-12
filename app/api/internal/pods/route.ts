// Cron job: para pods de foto/vídeo quando ociosos há mais de 20 minutos
// Vercel Cron chama este endpoint a cada 30 minutos

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { FOTO_POD_IDS, VIDEO_POD_ID, getPodStatus, stopPod } from "@/lib/runpod/pods";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";
const IDLE_MINUTES = parseInt(process.env.POD_IDLE_MINUTES ?? "20");

export async function GET(req: NextRequest) {
  // Vercel Cron envia Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const isInternal = !!INTERNAL_SECRET && req.headers.get("x-internal-secret") === INTERNAL_SECRET;

  if (!isVercelCron && !isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const idleCutoff = new Date(Date.now() - IDLE_MINUTES * 60 * 1000).toISOString();

  // Checar se houve job de foto nos últimos N minutos
  const { count: fotoCount } = await supabase
    .from("image_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", idleCutoff);

  const { count: videoCount } = await supabase
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", idleCutoff);

  const stopped: string[] = [];
  const errors: string[] = [];

  // Pods em ALWAYS_ON_POD_IDS (CSV no env) nunca são desligados
  const alwaysOn = (process.env.ALWAYS_ON_POD_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!fotoCount) {
    for (const podId of FOTO_POD_IDS) {
      if (alwaysOn.includes(podId)) continue;
      try {
        const status = await getPodStatus(podId);
        if (status === "RUNNING") {
          await stopPod(podId);
          stopped.push(`foto:${podId}`);
        }
      } catch (e) {
        errors.push(`foto:${podId}: ${e}`);
      }
    }
  }

  // Pod de vídeo nunca é desligado automaticamente

  return NextResponse.json({
    ok: true,
    idleMinutes: IDLE_MINUTES,
    fotoJobsRecent: fotoCount ?? 0,
    videoJobsRecent: videoCount ?? 0,
    stopped,
    errors,
  });
}
