import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createServerClient } from "@/lib/supabase/server";

const mp = new MercadoPagoConfig({ accessToken: (process.env.MP_ACCESS_TOKEN ?? "").trim() });
const APP_URL = process.env.APP_URL ?? "https://www.tamowork.com";
const IS_TEST = !!process.env.MP_TEST_PLAN_ID; // remove esta var para voltar ao valor real

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const isWeekly = body.plan === "monthly"; // "monthly" = semanal no frontend

  // Preços reais; substitui por R$1 no modo teste
  const price = IS_TEST ? 1 : isWeekly ? 47 : 348;
  const title = IS_TEST
    ? "TamoWork Pro — Teste R$1"
    : isWeekly
    ? "TamoWork Pro — Semanal"
    : "TamoWork Pro — Anual";

  try {
    const pref = await new Preference(mp).create({
      body: {
        items: [{
          id: IS_TEST ? "test" : isWeekly ? "weekly" : "annual",
          title,
          quantity: 1,
          unit_price: price,
          currency_id: "BRL",
        }],
        metadata: { user_id: user.id, plan: IS_TEST ? "test" : isWeekly ? "weekly" : "annual" },
        payer: { email: user.email ?? undefined },
        back_urls: {
          success: `${APP_URL}/obrigado?source=mp`,
          failure: `${APP_URL}/onboarding?erro=pagamento`,
          pending: `${APP_URL}/obrigado?source=mp`,
        },
        notification_url: `${APP_URL}/api/webhooks/mercadopago`,
        statement_descriptor: "TAMOWORK",
      },
    });

    return NextResponse.json({ init_point: pref.init_point });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    const cause = (err as { cause?: unknown })?.cause;
    console.error("[checkout/mp]", msg, cause);
    return NextResponse.json({ error: msg, cause }, { status: 500 });
  }
}
