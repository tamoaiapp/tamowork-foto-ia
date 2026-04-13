import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Variante determinística pelo user_id — consistente entre sessões
function assignVariant(userId: string): "A" | "B" | "C" {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const bucket = hash % 3;
  return bucket === 0 ? "A" : bucket === 1 ? "B" : "C";
}

// POST /api/ab/assign — atribui variante e salva no banco
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Se já tem variante atribuída, retorna a mesma
  const { data: existing } = await supabase
    .from("user_plans")
    .select("ab_variant")
    .eq("user_id", user.id)
    .single();

  if (existing?.ab_variant) {
    return NextResponse.json({ variant: existing.ab_variant });
  }

  const variant = assignVariant(user.id);

  await supabase.from("user_plans").upsert(
    { user_id: user.id, ab_variant: variant, ab_assigned_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return NextResponse.json({ variant });
}
