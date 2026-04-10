import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const MP_TOKEN   = (process.env.MP_ACCESS_TOKEN ?? "").trim();
const APP_URL    = (process.env.APP_URL ?? "https://www.tamowork.com").trim();
const IS_TEST    = !!process.env.MP_TEST_PLAN_ID;

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const isMonthly = body.plan === "monthly";

  // ── Plano MENSAL → preference (pagamento único mensal via checkout) ──────
  if (isMonthly) {
    const price = IS_TEST ? 1 : 49;
    const payload = {
      items: [{
        id: "monthly",
        title: IS_TEST ? "TamoWork Pro — Teste R$1" : "TamoWork Pro — Mensal",
        quantity: 1,
        unit_price: price,
        currency_id: "BRL",
      }],
      payer: { email: user.email ?? "" },
      back_urls: {
        success: `${APP_URL}/obrigado?source=mp`,
        failure: `${APP_URL}/onboarding?erro=pagamento`,
        pending: `${APP_URL}/obrigado?source=mp`,
      },
      notification_url: `${APP_URL}/api/webhooks/mercadopago`,
      external_reference: user.id,
      statement_descriptor: "TAMOWORK",
      auto_return: "approved",
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.init_point) {
      console.error("[checkout/mp/monthly] error:", JSON.stringify(data));
      return NextResponse.json({ error: JSON.stringify(data) }, { status: 500 });
    }

    return NextResponse.json({ init_point: data.init_point });
  }

  // ── Plano ANUAL → pagamento único (preference) ──────────────────────────
  const price = IS_TEST ? 1 : 228;
  const payload = {
    items: [{
      id: IS_TEST ? "test" : "annual",
      title: IS_TEST ? "TamoWork Pro — Teste R$1" : "TamoWork Pro — Anual",
      quantity: 1,
      unit_price: price,
      currency_id: "BRL",
    }],
    payer: { email: user.email ?? "" },
    back_urls: {
      success: `${APP_URL}/obrigado?source=mp`,
      failure: `${APP_URL}/onboarding?erro=pagamento`,
      pending: `${APP_URL}/obrigado?source=mp`,
    },
    notification_url: `${APP_URL}/api/webhooks/mercadopago`,
    external_reference: user.id,
    statement_descriptor: "TAMOWORK",
    auto_return: "approved",
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data.init_point) {
    console.error("[checkout/mp] error:", JSON.stringify(data));
    return NextResponse.json({ error: JSON.stringify(data) }, { status: 500 });
  }

  return NextResponse.json({ init_point: data.init_point });
}
