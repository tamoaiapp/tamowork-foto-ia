import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GET /api/push/opened?id=<push_log_id>
// Chamado pelo service worker quando usuário clica na notificação
// Sem autenticação — apenas marca opened_at no push_log
export async function GET(req: NextRequest) {
  const supabaseAdmin = createSupabaseAdminClient();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  await supabaseAdmin
    .from("push_logs")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", id)
    .is("opened_at", null); // só marca uma vez

  return NextResponse.json({ ok: true });
}
