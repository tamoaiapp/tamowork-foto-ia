import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let body: { fbclid?: string; utm_source?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }

  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const update: Record<string, string> = {};
  if (body.fbclid) update.fbclid = body.fbclid;
  if (body.utm_source) update.utm_source = body.utm_source;
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

  // Só salva se ainda não tem (não sobrescreve atribuição original)
  const { data: existing } = await supabase
    .from("user_plans")
    .select("fbclid")
    .eq("user_id", user.id)
    .single();

  if (existing?.fbclid) return NextResponse.json({ ok: true, skipped: true });

  await supabase.from("user_plans").upsert({
    user_id: user.id,
    ...update,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
