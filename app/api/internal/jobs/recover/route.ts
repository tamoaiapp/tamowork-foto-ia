import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { submitImageJob } from "@/lib/image-jobs/submit";
import { checkImageJob } from "@/lib/image-jobs/check";

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
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString(); // jobs com >1 min sem atualização

  const [{ data: queuedJobs }, { data: processingJobs }] = await Promise.all([
    supabase.from("image_jobs").select("id").eq("status", "queued").lt("updated_at", cutoff).limit(5),
    supabase.from("image_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", cutoff).limit(10),
  ]);

  const results: { id: string; action: string; ok: boolean; error?: string }[] = [];

  // Submete jobs queued
  for (const job of queuedJobs ?? []) {
    try {
      await submitImageJob(job.id);
      results.push({ id: job.id, action: "submit", ok: true });
    } catch (e) {
      results.push({ id: job.id, action: "submit", ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  // Verifica jobs em andamento
  for (const job of processingJobs ?? []) {
    try {
      await checkImageJob(job.id);
      results.push({ id: job.id, action: "check", ok: true });
    } catch (e) {
      results.push({ id: job.id, action: "check", ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
