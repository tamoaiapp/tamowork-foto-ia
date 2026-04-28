import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getAffiliateReferralForUser,
  markAffiliateCheckoutStarted,
} from "@/lib/affiliates/server";
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
  const source = typeof body.source === "string" ? body.source : "app";

  // BR → mensal (STRIPE_PRICE_ID_MONTHLY) | Não-BR → anual $100 USD (STRIPE_PRICE_ID_USD)
  const priceId = isMonthly
    ? (process.env.STRIPE_PRICE_ID_MONTHLY ?? "price_1TMnqQDn6tNmbP0NqnSZeVmE")
    : (process.env.STRIPE_PRICE_ID_USD ?? "price_1TMndeDn6tNmbP0NJ45SlEOp");

  try {
    const referral = await getAffiliateReferralForUser(user.id);
    const metadata: Record<string, string> = { userId: user.id, source };

    if (referral?.id && referral?.affiliate_id && referral?.referral_code) {
      metadata.affiliateId = referral.affiliate_id;
      metadata.referralId = referral.id;
      metadata.affiliateCode = referral.referral_code;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      success_url: `${process.env.APP_URL ?? "https://tamowork.com"}/obrigado?source=stripe`,
      cancel_url: `${process.env.APP_URL ?? "https://tamowork.com"}/planos`,
    });

    if (referral) {
      await markAffiliateCheckoutStarted(user.id);
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as Record<string,unknown>)?.code ?? "";
    const type = (err as Record<string,unknown>)?.type ?? "";
    console.error(`[stripe-ERR] type=${type} code=${code} msg=${msg} priceId=${priceId}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
