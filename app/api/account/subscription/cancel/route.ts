import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe não configurado" }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: planData } = await supabase
    .from("user_plans")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (!planData?.stripe_subscription_id) {
    return NextResponse.json({ error: "Nenhuma assinatura Stripe encontrada" }, { status: 400 });
  }

  // Cancela ao final do período atual (não imediatamente)
  await stripe.subscriptions.update(planData.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({ ok: true });
}
