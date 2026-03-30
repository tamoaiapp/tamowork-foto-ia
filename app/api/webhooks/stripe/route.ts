import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { setUserPro } from "@/lib/plans";
import { createServerClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[Stripe webhook] Invalid signature:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Assinatura ativa — dar acesso PRO
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return NextResponse.json({ ok: true });

    const userId = session.metadata?.userId;
    if (!userId) return NextResponse.json({ ok: true });

    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    const periodEnd = new Date(sub.current_period_end * 1000);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // adiciona 1 mês de margem

    await setUserPro(userId, {
      periodEnd,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
    });

    console.log(`[Stripe] User ${userId} → PRO até ${periodEnd.toISOString()}`);
  }

  // Renovação da assinatura
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = invoice.subscription as string;
    if (!subId) return NextResponse.json({ ok: true });

    const sub = await stripe.subscriptions.retrieve(subId);
    const userId = sub.metadata?.userId;
    if (!userId) return NextResponse.json({ ok: true });

    const periodEnd = new Date(sub.current_period_end * 1000);
    await setUserPro(userId, {
      periodEnd,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
    });

    console.log(`[Stripe] Renovado user ${userId} até ${periodEnd.toISOString()}`);
  }

  // Assinatura cancelada — volta para free
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.userId;
    if (!userId) return NextResponse.json({ ok: true });

    await supabase.from("user_plans").upsert({
      user_id: userId,
      plan: "free",
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    });

    console.log(`[Stripe] User ${userId} → free (cancelado)`);
  }

  return NextResponse.json({ received: true });
}
