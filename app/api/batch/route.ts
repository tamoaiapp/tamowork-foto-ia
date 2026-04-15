import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/plans";

const MAX_ITEMS = 10; // máx por lote

// GET /api/batch — lista lotes do usuário
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from("batch_jobs")
    .select("id,status,items,current_index,scheduled_at,started_at,created_at,updated_at,error_message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/batch — criar novo lote
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const plan = await getUserPlan(user.id);
  if (plan !== "pro") return NextResponse.json({ error: "pro_required" }, { status: 403 });

  let body: { items?: unknown[]; scheduled_at?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { items, scheduled_at } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items obrigatório e não pode ser vazio" }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Máximo ${MAX_ITEMS} itens por lote` }, { status: 400 });
  }

  // Validar cada item
  const VALID_MODES = ["simulacao", "fundo_branco", "catalogo", "personalizado", "video", "video_narrado", "video_longo"];
  for (const item of items as { input_image_url?: string; mode?: string }[]) {
    if (!item.input_image_url) return NextResponse.json({ error: "Cada item precisa de input_image_url" }, { status: 400 });
    if (!item.mode || !VALID_MODES.includes(item.mode)) {
      return NextResponse.json({ error: `Modo inválido: ${item.mode}` }, { status: 400 });
    }
  }

  // Horário padrão: 3h da manhã do próximo dia
  let scheduledAt: string;
  if (scheduled_at) {
    scheduledAt = new Date(scheduled_at).toISOString();
  } else {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    tmr.setHours(3, 0, 0, 0);
    scheduledAt = tmr.toISOString();
  }

  // Verificar se já tem lote ativo
  const { data: active } = await supabase
    .from("batch_jobs")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["scheduled", "running"])
    .limit(1);

  if (active && active.length > 0) {
    return NextResponse.json({ error: "already_scheduled", batchId: active[0].id }, { status: 409 });
  }

  const { data: batch, error: insertErr } = await supabase
    .from("batch_jobs")
    .insert({
      user_id: user.id,
      items,
      current_index: 0,
      scheduled_at: scheduledAt,
      status: "scheduled",
    })
    .select("id,status,scheduled_at")
    .single();

  if (insertErr || !batch) return NextResponse.json({ error: insertErr?.message ?? "Erro" }, { status: 500 });

  return NextResponse.json({ batchId: batch.id, status: batch.status, scheduled_at: batch.scheduled_at }, { status: 201 });
}

// DELETE /api/batch — cancelar lote agendado
export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Só pode cancelar lotes que ainda estão scheduled
  const { data: batch } = await supabase
    .from("batch_jobs")
    .select("id,status,user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!batch) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  if (batch.status !== "scheduled") {
    return NextResponse.json({ error: "Só é possível cancelar lotes ainda não iniciados" }, { status: 409 });
  }

  await supabase.from("batch_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
