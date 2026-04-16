import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe não configurado" }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const isMonthly = body.plan === "monthly";

  // BR → mensal R$79 (BRL) | Não-BR → anual $100 (USD)
  const priceId = isMonthly
    ? (process.env.STRIPE_PRICE_ID_MONTHLY ?? "price_1T02ysDn6tNmbP0N8w0c7g3o")
    : (process.env.STRIPE_PRICE_ID_USD ?? "price_1TMndeDn6tNmbP0NJ45SlEOp");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      success_url: `${process.env.APP_URL ?? "https://tamowork.com"}/obrigado?source=stripe`,
      cancel_url: `${process.env.APP_URL ?? "https://tamowork.com"}/planos`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe] checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
