import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";
const APP_URL = process.env.APP_URL ?? "";

// Chamado pelo Vercel Cron a cada 10 minutos
// Recupera jobs presos em queued/submitted por mais de 8 minutos
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const internalHeader = req.headers.get("x-internal-secret") ?? "";
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isInternal = internalHeader === INTERNAL_SECRET;

  if (!isCron && !isInternal) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const cutoff = new Date(Date.now() - 8 * 60 * 1000).toISOString();

  const [{ data: stuckQueued }, { data: stuckProcessing }] = await Promise.all([
    supabase.from("image_jobs").select("id").eq("status", "queued").lt("updated_at", cutoff).limit(10),
    supabase.from("image_jobs").select("id").in("status", ["submitted", "processing"]).lt("updated_at", cutoff).limit(10),
  ]);

  const results: { id: string; action: string; ok: boolean }[] = [];

  // Enfileira via QStash (não faz fetch direto — evita timeout)
  for (const job of stuckQueued ?? []) {
    try {
      await qstash.publishJSON({
        url: `${APP_URL}/api/internal/image-jobs/submit`,
        body: { jobId: job.id },
        headers: { "x-internal-secret": INTERNAL_SECRET },
        delay: 2,
      });
      results.push({ id: job.id, action: "resubmit", ok: true });
    } catch {
      results.push({ id: job.id, action: "resubmit", ok: false });
    }
  }

  for (const job of stuckProcessing ?? []) {
    try {
      await qstash.publishJSON({
        url: `${APP_URL}/api/internal/image-jobs/check`,
        body: { jobId: job.id },
        headers: { "x-internal-secret": INTERNAL_SECRET },
        delay: 2,
      });
      results.push({ id: job.id, action: "recheck", ok: true });
    } catch {
      results.push({ id: job.id, action: "recheck", ok: false });
    }
  }

  return NextResponse.json({
    recovered: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
