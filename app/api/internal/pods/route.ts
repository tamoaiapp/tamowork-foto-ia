// Cron job (Vercel a cada 5 minutos):
// - Em horario comercial (peak): WATCHDOG — religa pods de foto que estejam EXITED.
// - Fora do horario: desliga pods ociosos > IDLE_MINUTES.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { FOTO_POD_IDS, VIDEO_POD_ID, getPodStatus, stopPod, resumePod } from "@/lib/runpod/pods";

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

  // Protecao de horario de pico: nao desliga pod de foto em horario comercial.
  // Padrao: 11h-02h UTC (= 8h-23h BRT). Override via POD_PEAK_START_UTC / POD_PEAK_END_UTC.
  // Use ?force=1 pra ignorar (uso manual via x-internal-secret).
  const force = req.nextUrl.searchParams.get("force") === "1";
  const peakStart = parseInt(process.env.POD_PEAK_START_UTC ?? "11", 10);
  const peakEnd = parseInt(process.env.POD_PEAK_END_UTC ?? "2", 10);
  const hourUTC = new Date().getUTCHours();
  const inPeak = peakStart < peakEnd
    ? (hourUTC >= peakStart && hourUTC < peakEnd)
    : (hourUTC >= peakStart || hourUTC < peakEnd);
  // WATCHDOG em horario comercial: religa pods EXITED.
  // (Pod pode cair por crash, manutencao RunPod, ou stop programatico do proprio
  // codigo ao detectar ComfyUI travado. Em peak, sempre voltamos a religar.)
  if (inPeak && !force) {
    const resumed: string[] = [];
    const watchdogErrors: string[] = [];
    for (const podId of FOTO_POD_IDS) {
      try {
        const status = await getPodStatus(podId);
        if (status === "EXITED") {
          await resumePod(podId);
          resumed.push(podId);
        }
      } catch (e) {
        watchdogErrors.push(`${podId}: ${(e as Error)?.message ?? e}`);
      }
    }
    return NextResponse.json({
      ok: true, mode: "peak_watchdog", hourUTC, peakStart, peakEnd,
      resumed, errors: watchdogErrors,
    });
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
