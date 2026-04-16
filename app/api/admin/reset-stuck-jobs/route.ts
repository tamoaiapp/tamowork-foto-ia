import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/admin/reset-stuck-jobs
// Reseta jobs travados (queued/submitted/processing por mais de 15 min) → pending (failed)
// Protegido pela SUPABASE_SERVICE_ROLE_KEY no header Authorization

const STUCK_THRESHOLD_MIN = 15;

export async function POST(req: NextRequest) {
  const key = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!key || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60 * 1000).toISOString();

  const { data: stuck, error: fetchError } = await supabase
    .from("image_jobs")
    .select("id, status, created_at, user_id")
    .in("status", ["queued", "submitted", "processing"])
    .lt("created_at", cutoff);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!stuck || stuck.length === 0) {
    return NextResponse.json({ reset: 0, message: "Nenhum job travado." });
  }

  const ids = stuck.map((j) => j.id);

  const { error: updateError } = await supabase
    .from("image_jobs")
    .update({ status: "failed", error_message: "Resetado automaticamente (travado > 15min)" })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`[reset-stuck-jobs] ${ids.length} job(s) resetados:`, ids);

  return NextResponse.json({
    reset: ids.length,
    jobs: stuck.map((j) => ({
      id: j.id,
      status: j.status,
      age_min: Math.round((Date.now() - new Date(j.created_at).getTime()) / 60000),
    })),
  });
}
