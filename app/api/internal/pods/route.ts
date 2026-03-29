// Cron job: para pods de foto/vídeo quando ociosos há mais de 20 minutos
// Vercel Cron chama este endpoint a cada 30 minutos

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { FOTO_POD_IDS, VIDEO_POD_ID, getPodStatus, stopPod } from "@/lib/runpod/pods";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";
const IDLE_MINUTES = parseInt(process.env.POD_IDLE_MINUTES ?? "20");

export async function GET(req: NextRequest) {
  // Vercel Cron envia Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const isInternal = req.headers.get("x-internal-secret") === INTERNAL_SECRET;

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

  // Parar pods de foto se ociosos — pod1 nunca é desligado
  const pod1 = process.env.POD1_ID ?? "bplqvtp059e2dc";
  if (!fotoCount) {
    for (const podId of FOTO_POD_IDS) {
      if (podId === pod1) continue; // pod1 sempre fica ligado
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

  // Parar pod de vídeo se ocioso
  if (!videoCount) {
    try {
      const status = await getPodStatus(VIDEO_POD_ID);
      if (status === "RUNNING") {
        await stopPod(VIDEO_POD_ID);
        stopped.push(`video:${VIDEO_POD_ID}`);
      }
    } catch (e) {
      errors.push(`video:${VIDEO_POD_ID}: ${e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    idleMinutes: IDLE_MINUTES,
    fotoJobsRecent: fotoCount ?? 0,
    videoJobsRecent: videoCount ?? 0,
    stopped,
    errors,
  });
}
