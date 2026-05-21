// Cron job (Vercel a cada 5 minutos):
// - Em horario comercial (peak): WATCHDOG — religa pods de foto que estejam EXITED.
// - Fora do horario: desliga pods ociosos > IDLE_MINUTES.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { FOTO_POD_IDS, VIDEO_POD_ID, getPodStatus, stopPod, resumePod, isComfyHealthy, getPodUptimeMs, RESTART_GRACE_MS } from "@/lib/runpod/pods";
import { COMFY_BASES } from "@/lib/comfyui/client";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";
const IDLE_MINUTES = parseInt(process.env.POD_IDLE_MINUTES ?? "20");
// Foto migrou pro serverless (default). Quando ativo, o watchdog NAO religa o pod
// fixo — pelo contrario, garante que ele fique DESLIGADO (economia de GPU).
const FOTO_SERVERLESS = (process.env.RUNPOD_FOTO_SERVERLESS_ENABLED ?? "true") !== "false";

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
  // Foto em serverless: watchdog NAO religa pod fixo. Garante que fique desligado.
  if (FOTO_SERVERLESS && !force) {
    const stopped: string[] = [];
    const errs: string[] = [];
    for (const podId of FOTO_POD_IDS) {
      try {
        const status = await getPodStatus(podId);
        if (status === "RUNNING") {
          await stopPod(podId);
          stopped.push(podId);
        }
      } catch (e) {
        errs.push(`${podId}: ${(e as Error)?.message ?? e}`);
      }
    }
    return NextResponse.json({ ok: true, mode: "foto_serverless_keep_off", stopped, errors: errs });
  }

  // WATCHDOG em horario comercial:
  //   1. Religa pods EXITED (queda, crash, stop programatico).
  //   2. Detecta pods RUNNING com ComfyUI morto (Qwen OOM, deadlock interno) —
  //      se passou do grace period (15min) faz stop+resume forcado.
  if (inPeak && !force) {
    const resumed: string[] = [];
    const restarted: string[] = [];
    const watchdogErrors: string[] = [];
    // Mapeia podId -> comfyBase usando regex no host de cada COMFY_BASES.
    // Permite checar healthcheck do pod RUNNING.
    const podToBase = new Map<string, string>();
    for (const base of COMFY_BASES) {
      const m = base.match(/https?:\/\/([a-z0-9]+)-\d+\.proxy\.runpod\.net/);
      if (m) podToBase.set(m[1], base);
    }
    for (const podId of FOTO_POD_IDS) {
      try {
        const status = await getPodStatus(podId);
        if (status === "EXITED") {
          await resumePod(podId);
          resumed.push(podId);
          continue;
        }
        if (status === "RUNNING") {
          const comfyBase = podToBase.get(podId);
          if (!comfyBase) continue; // sem URL pra checar — skip
          const healthy = await isComfyHealthy(comfyBase);
          if (healthy) continue;
          // ComfyUI morto. Se passou do grace period, forca restart.
          // (Grace period evita matar pod ainda carregando Qwen.)
          const uptimeMs = await getPodUptimeMs(podId);
          if (uptimeMs < RESTART_GRACE_MS) continue;
          await stopPod(podId).catch(() => {});
          await new Promise(r => setTimeout(r, 2000));
          await resumePod(podId).catch(() => {});
          restarted.push(podId);
        }
      } catch (e) {
        watchdogErrors.push(`${podId}: ${(e as Error)?.message ?? e}`);
      }
    }
    return NextResponse.json({
      ok: true, mode: "peak_watchdog", hourUTC, peakStart, peakEnd,
      resumed, restarted, errors: watchdogErrors,
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
