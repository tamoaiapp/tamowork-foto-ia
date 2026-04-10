import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { event, variant } = await req.json();
    if (!event || !variant) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createServerClient();
    await supabase.from("upsell_events").insert({ event, variant });

    return NextResponse.json({ ok: true });
  } catch {
    // Silencioso — não quebra o fluxo do usuário por causa de tracking
    return NextResponse.json({ ok: true });
  }
}
