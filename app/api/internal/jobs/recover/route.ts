import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { submitImageJob } from "@/lib/image-jobs/submit";
import { checkImageJob } from "@/lib/image-jobs/check";
import { submitVideoJob } from "@/lib/video-jobs/submit";
import { checkVideoJob } from "@/lib/video-jobs/check";
import { COMFY_BASES } from "@/lib/comfyui/client";
import { ensureFotoPodRunning, ensureVideoPodRunning } from "@/lib/runpod/pods";
import { VIDEO_COMFY_BASES } from "@/lib/comfyui/video-client";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

// Jobs queued há mais de 90 minutos sem submeter → falha (pod não subiu)
// 90 min dá tempo para 30+ jobs processarem em fila (2-3 min/job)
const QUEUED_TIMEOUT_MS = 90 * 60 * 1000;
// Jobs em submitted/processing há mais de 5 min → reinicia automaticamente
// Reduzido de 10 para 5 min para desbloquear fila mais rápido após OOM
const RESTART_AFTER_MS = 5 * 60 * 1000;
// Após 15 min total → desiste e falha (era 30 min)
const TOTAL_FAIL_MS = 15 * 60 * 1000;

// Vercel Cron: roda a cada 1 minuto
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const internalHeader = req.headers.get("x-internal-secret") ?? "";
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isInternal = internalHeader === INTERNAL_SECRET;

  if (!isCron && !isInternal) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const checkCutoff = new Date(Date.now() - 45 * 1000).toISOString();
  const staleQueuedCutoff = new Date(Date.now() - QUEUED_TIMEOUT_MS).toISOString();
  const restartCutoff = new Date(Date.now() - RESTART_AFTER_MS).toISOString();
  const totalFailCutoff = new Date(Date.now() - TOTAL_FAIL_MS).toISOString();

  const [
    { data: queuedJobs },
    { data: processingJobs },
    { data: staleImageJobs },
    { data: queuedVideoJobs },
    { data: processingVideoJobs },
    { data: staleVideoJobs },
    // Jobs travados em submitted/processing há 10-30 min → reiniciar
    { data: restartImageJobs },
    { data: restartVideoJobs },
    // Jobs travados há mais de 30 min → desistir
    { data: failImageJobs },
    { data: failVideoJobs },
  ] = await Promise.all([
    supabase.from("image_jobs").select("id").eq("status", "queued").gte("updated_at", staleQueuedCutoff).limit(1),
    supabase.from("image_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", checkCutoff).gte("updated_at", restartCutoff).limit(10),
    supabase.from("image_jobs").select("id").eq("status", "queued").lt("updated_at", staleQueuedCutoff).limit(20),
    supabase.from("video_jobs").select("id").eq("status", "queued").gte("updated_at", staleQueuedCutoff).limit(3),
    supabase.from("video_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", checkCutoff).gte("updated_at", restartCutoff).limit(5),
    supabase.from("video_jobs").select("id").eq("status", "queued").lt("updated_at", staleQueuedCutoff).limit(20),
    // submitted/processing entre 10-30 min → recolocar na fila
    supabase.from("image_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", restartCutoff).gte("updated_at", totalFailCutoff).limit(10),
    supabase.from("video_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", restartCutoff).gte("updated_at", totalFailCutoff).limit(5),
    // submitted/processing há mais de 30 min → falhar definitivamente
    supabase.from("image_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", totalFailCutoff).limit(10),
    supabase.from("video_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", totalFailCutoff).limit(5),
  ]);

  const results: { id: string; action: string; ok: boolean; error?: string }[] = [];

  // REGRA 0: Jobs stuck há mais de 30 min → falha definitiva
  if ((failImageJobs ?? []).length > 0) {
    const ids = (failImageJobs ?? []).map(j => j.id);
    await supabase.from("image_jobs")
      .update({ status: "failed", error_message: "Tempo limite atingido. Tente novamente." })
      .in("id", ids);
    results.push(...ids.map(id => ({ id, action: "img-timeout-fail", ok: true })));
  }

  if ((failVideoJobs ?? []).length > 0) {
    const ids = (failVideoJobs ?? []).map(j => j.id);
    await supabase.from("video_jobs")
      .update({ status: "failed", error_message: "Tempo limite atingido. Tente novamente." })
      .in("id", ids);
    results.push(...ids.map(id => ({ id, action: "vid-timeout-fail", ok: true })));
  }

  // REGRA 1a: Jobs stuck entre 10-30 min → reiniciar automaticamente (requeue)
  if ((restartImageJobs ?? []).length > 0) {
    const ids = (restartImageJobs ?? []).map(j => j.id);
    await supabase.from("image_jobs")
      .update({ status: "queued", external_job_id: null, attempts: 0 })
      .in("id", ids);
    results.push(...ids.map(id => ({ id, action: "img-restart", ok: true })));
  }

  if ((restartVideoJobs ?? []).length > 0) {
    const ids = (restartVideoJobs ?? []).map(j => j.id);
    await supabase.from("video_jobs")
      .update({ status: "queued", external_job_id: null, attempts: 0 })
      .in("id", ids);
    results.push(...ids.map(id => ({ id, action: "vid-restart", ok: true })));
  }

  // REGRA 1b: Jobs queued há mais de 12min → falhar imediatamente
  // O pod estava offline por muito tempo, usuário precisa ser liberado para tentar de novo
  if ((staleImageJobs ?? []).length > 0) {
    const ids = (staleImageJobs ?? []).map(j => j.id);
    await supabase.from("image_jobs")
      .update({ status: "failed", error_message: "Serviço temporariamente indisponível. Tente novamente." })
      .in("id", ids);
    results.push(...ids.map(id => ({ id, action: "img-stale-fail", ok: true })));
  }

  if ((staleVideoJobs ?? []).length > 0) {
    const ids = (staleVideoJobs ?? []).map(j => j.id);
    await supabase.from("video_jobs")
      .update({ status: "failed", error_message: "Serviço temporariamente indisponível. Tente novamente." })
      .in("id", ids);
    results.push(...ids.map(id => ({ id, action: "vid-stale-fail", ok: true })));
  }

  // REGRA 2: Verificar se o pod de foto está online antes de submeter
  const fotoBase = COMFY_BASES[0];
  let fotoPodOnline = false;
  if (fotoBase && (queuedJobs ?? []).length > 0) {
    fotoPodOnline = await ensureFotoPodRunning(fotoBase);
    if (!fotoPodOnline) {
      // Pod estava desligado, enviou sinal de resume — não tenta submeter agora
      results.push({ id: "pod-foto", action: "pod-resuming", ok: false, error: "Pod offline, iniciando..." });
    }
  }

  // REGRA 3: Verificar pod de vídeo
  const videoBase = VIDEO_COMFY_BASES?.[0];
  let videoPodOnline = false;
  if (videoBase && (queuedVideoJobs ?? []).length > 0) {
    videoPodOnline = await ensureVideoPodRunning(videoBase);
  }

  // Submete image jobs queued (só se pod online E sem job em andamento)
  if (fotoPodOnline) {
    const { count: activeCount } = await supabase
      .from("image_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "processing"]);

    if ((activeCount ?? 0) === 0) {
      const job = (queuedJobs ?? [])[0];
      if (job) {
        try {
          await submitImageJob(job.id);
          results.push({ id: job.id, action: "img-submit", ok: true });
        } catch (e) {
          const errMsg = String((e as Error)?.message ?? e);
          results.push({ id: job.id, action: "img-submit", ok: false, error: errMsg });
          // Marcar como failed para não bloquear a fila indefinidamente
          await supabase.from("image_jobs")
            .update({ status: "failed", error_message: errMsg })
            .eq("id", job.id);
        }
      }
    } else {
      results.push({ id: "queue", action: "img-skip", ok: true, error: `${activeCount} job(s) em andamento` });
    }
  }

  // Verifica image jobs em andamento
  for (const job of processingJobs ?? []) {
    try {
      await checkImageJob(job.id);
      results.push({ id: job.id, action: "img-check", ok: true });
    } catch (e) {
      results.push({ id: job.id, action: "img-check", ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  // Submete video jobs queued (1 por vez, só se pod online E sem vídeo em andamento)
  if (videoPodOnline || !videoBase) {
    const { count: activeVideoCount } = await supabase
      .from("video_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "processing"]);

    if ((activeVideoCount ?? 0) === 0) {
      const job = (queuedVideoJobs ?? [])[0];
      if (job) {
        try {
          await submitVideoJob(job.id);
          results.push({ id: job.id, action: "vid-submit", ok: true });
        } catch (e) {
          const errMsg = String((e as Error)?.message ?? e);
          results.push({ id: job.id, action: "vid-submit", ok: false, error: errMsg });
          await supabase.from("video_jobs")
            .update({ status: "failed", error_message: errMsg })
            .eq("id", job.id);
        }
      }
    }
  }

  // Verifica video jobs em andamento
  for (const job of processingVideoJobs ?? []) {
    try {
      await checkVideoJob(job.id);
      results.push({ id: job.id, action: "vid-check", ok: true });
    } catch (e) {
      results.push({ id: job.id, action: "vid-check", ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
