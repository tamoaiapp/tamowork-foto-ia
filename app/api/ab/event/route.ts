import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Eventos válidos do A/B test
const VALID_EVENTS = [
  "photo1_done",       // 1ª foto concluída — variante foi exibida
  "photo2_started",    // clicou para criar 2ª foto
  "photo2_done",       // 2ª foto concluída
  "conversion_screen", // viu a tela de conversão (B)
  "video_hook",        // viu o hook de vídeo (C)
  "cta_clicked",       // clicou em qualquer CTA de assinatura
  "converted",         // assinou o PRO
];

// POST /api/ab/event
// Body: { event: string, variant: string }
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { event, variant } = await req.json();
  if (!VALID_EVENTS.includes(event)) {
    return NextResponse.json({ error: "evento inválido" }, { status: 400 });
  }

  await supabase.from("ab_events").insert({
    user_id: user.id,
    variant: variant ?? "?",
    event,
  });

  return NextResponse.json({ ok: true });
}
