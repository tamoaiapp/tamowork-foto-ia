import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { submitImageJob } from "@/lib/image-jobs/submit";
import { checkImageJob } from "@/lib/image-jobs/check";
import { submitVideoJob } from "@/lib/video-jobs/submit";
import { checkVideoJob } from "@/lib/video-jobs/check";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

// Vercel Cron: roda a cada 1 minuto
// Processa jobs queued (submete) e submitted/processing (verifica resultado)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const internalHeader = req.headers.get("x-internal-secret") ?? "";
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isInternal = internalHeader === INTERNAL_SECRET;

  if (!isCron && !isInternal) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  // queued: pega qualquer job (sem cutoff) — processa imediatamente
  // submitted/processing: só verifica após 45s para dar tempo ao ComfyUI
  const checkCutoff = new Date(Date.now() - 45 * 1000).toISOString();

  const videoCutoff = new Date(Date.now() - 45 * 1000).toISOString();

  const [
    { data: queuedJobs },
    { data: processingJobs },
    { data: queuedVideoJobs },
    { data: processingVideoJobs },
  ] = await Promise.all([
    supabase.from("image_jobs").select("id").eq("status", "queued").limit(5),
    supabase.from("image_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", checkCutoff).limit(10),
    supabase.from("video_jobs").select("id").eq("status", "queued").limit(3),
    supabase.from("video_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", videoCutoff).limit(5),
  ]);

  const results: { id: string; action: string; ok: boolean; error?: string }[] = [];

  // Submete image jobs queued
  for (const job of queuedJobs ?? []) {
    try {
      await submitImageJob(job.id);
      results.push({ id: job.id, action: "img-submit", ok: true });
    } catch (e) {
      results.push({ id: job.id, action: "img-submit", ok: false, error: String((e as Error)?.message ?? e) });
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

  // Submete video jobs queued
  for (const job of queuedVideoJobs ?? []) {
    try {
      await submitVideoJob(job.id);
      results.push({ id: job.id, action: "vid-submit", ok: true });
    } catch (e) {
      results.push({ id: job.id, action: "vid-submit", ok: false, error: String((e as Error)?.message ?? e) });
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
