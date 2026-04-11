import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getToken(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "");
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser(getToken(req));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { active } = body;

  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active deve ser boolean" }, { status: 400 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("user_plans")
    .upsert({ user_id: user.id, bot_active: active }, { onConflict: "user_id" });

  if (updateErr) {
    console.error("[bot/activate] Erro ao atualizar:", updateErr.message);
    return NextResponse.json({ error: "Erro ao atualizar configuração" }, { status: 500 });
  }

  return NextResponse.json({ success: true, bot_active: active });
}
