import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const MP_TOKEN       = (process.env.MP_ACCESS_TOKEN ?? "").trim();
const APP_URL        = (process.env.APP_URL ?? "https://www.tamowork.com").trim();
const MP_MONTHLY_PLAN_ID = (process.env.MP_MONTHLY_PLAN_ID ?? "").trim();
const MP_ANNUAL_PLAN_ID  = (process.env.MP_PLAN_ID ?? "").trim();
const IS_TEST        = !!process.env.MP_TEST_PLAN_ID;

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const isMonthly = body.plan === "monthly";

  // ── Plano MENSAL → assinatura recorrente (preapproval) ──────────────────
  if (isMonthly) {
    if (IS_TEST) {
      // Em teste: usa preference de R$1 (MP não permite preapproval com valor teste facilmente)
      const payload = {
        items: [{ id: "monthly", title: "TamoWork Pro — Teste R$1", quantity: 1, unit_price: 1, currency_id: "BRL" }],
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
        headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) return NextResponse.json({ error: JSON.stringify(data) }, { status: 500 });
      return NextResponse.json({ init_point: data.init_point });
    }

    // Produção: cria instância de assinatura recorrente vinculada ao plano mensal
    const payload = {
      preapproval_plan_id: MP_MONTHLY_PLAN_ID,
      payer_email: user.email ?? "",
      external_reference: user.id,
      back_url: `${APP_URL}/obrigado?source=mp`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 79,
        currency_id: "BRL",
      },
    };

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.init_point) {
      console.error("[checkout/mp/monthly] error:", JSON.stringify(data));
      return NextResponse.json({ error: JSON.stringify(data) }, { status: 500 });
    }

    return NextResponse.json({ init_point: data.init_point });
  }

  // ── Plano ANUAL → pagamento único via preference (R$348) ────────────────
  const price = IS_TEST ? 1 : 348;
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
    headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.init_point) {
    console.error("[checkout/mp] error:", JSON.stringify(data));
    return NextResponse.json({ error: JSON.stringify(data) }, { status: 500 });
  }

  return NextResponse.json({ init_point: data.init_point });
}
