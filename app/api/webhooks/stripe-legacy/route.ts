/**
 * Webhook para contas Stripe legadas (app antigo)
 * Captura cancelamentos e atualiza o plano do usuário
 *
 * Configurar em cada conta Stripe legada:
 *   URL: https://tamowork.com/api/webhooks/stripe-legacy
 *   Eventos: customer.subscription.deleted, customer.subscription.updated
 *
 * Variáveis de ambiente necessárias:
 *   STRIPE_LEGACY_WEBHOOK_SECRET   (conta 1)
 *   STRIPE_LEGACY_WEBHOOK_SECRET_2 (conta 2)
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";

const DUMMY_KEY = "sk_live_placeholder";

function tryConstructEvent(rawBody: string, sig: string): Stripe.Event | null {
  const secrets = [
    process.env.STRIPE_LEGACY_WEBHOOK_SECRET,
    process.env.STRIPE_LEGACY_WEBHOOK_SECRET_2,
  ].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      const stripe = new Stripe(DUMMY_KEY);
      return stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  const event = tryConstructEvent(rawBody, sig);
  if (!event) {
    console.error("[Stripe Legacy webhook] Assinatura inválida");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Assinatura cancelada imediatamente
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;

    // Busca usuário pelo stripe_subscription_id
    const { data: plan } = await supabase
      .from("user_plans")
      .select("user_id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();

    if (plan?.user_id) {
      await supabase.from("user_plans").upsert({
        user_id: plan.user_id,
        plan: "free",
        period_end: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`[Stripe Legacy] user ${plan.user_id} → free (assinatura ${sub.id} cancelada)`);
    }
  }

  // Assinatura atualizada (ex: cancel_at_period_end = true)
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;

    const { data: plan } = await supabase
      .from("user_plans")
      .select("user_id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();

    if (!plan?.user_id) return NextResponse.json({ received: true });

    if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "past_due") {
      // Assinatura inativa — antecipa o fim
      await supabase.from("user_plans").upsert({
        user_id: plan.user_id,
        plan: "free",
        period_end: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`[Stripe Legacy] user ${plan.user_id} → free (status: ${sub.status})`);
    } else if (sub.status === "active") {
      // Renovou — atualiza period_end
      const newEnd = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000);
      await supabase.from("user_plans").upsert({
        user_id: plan.user_id,
        plan: "pro",
        period_end: newEnd.toISOString(),
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      });
      console.log(`[Stripe Legacy] user ${plan.user_id} renovado até ${newEnd.toISOString()}`);
    }
  }

  return NextResponse.json({ received: true });
}
