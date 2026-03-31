import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;
const MP_PLAN_ID = process.env.MP_PLAN_ID!;         // anual
const MP_MONTHLY_PLAN_ID = process.env.MP_MONTHLY_PLAN_ID!; // mensal
const MP_TEST_PLAN_ID = process.env.MP_TEST_PLAN_ID ?? ""; // R$1 teste

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const isMonthly = body.plan === "monthly";

  // Modo teste: usa plano de R$1 quando MP_TEST_PLAN_ID estiver definido
  const isTest = !!MP_TEST_PLAN_ID;
  const planId = isTest ? MP_TEST_PLAN_ID : isMonthly ? MP_MONTHLY_PLAN_ID : MP_PLAN_ID;
  const reason = isTest ? "TamoWork Teste R$1" : isMonthly ? "TamoWork Pro Mensal" : "TamoWork Anual";

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `tamowork-sub-${user.id}-${isMonthly ? "monthly" : "annual"}-${Date.now()}`,
    },
    body: JSON.stringify({
      preapproval_plan_id: planId,
      reason,
      external_reference: user.id,
      payer_email: user.email,
      back_url: `${process.env.APP_URL}/obrigado?source=mp`,
      notification_url: `${process.env.APP_URL}/api/webhooks/mercadopago`,
      status: "pending",
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.init_point) {
    console.error("MP checkout error:", data);
    return NextResponse.json({ error: "Erro ao criar assinatura" }, { status: 500 });
  }

  return NextResponse.json({ init_point: data.init_point });
}
