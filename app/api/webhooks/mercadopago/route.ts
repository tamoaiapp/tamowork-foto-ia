import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { setUserPro } from "@/lib/plans";
import { createServerClient } from "@/lib/supabase/server";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET!;
const MP_MONTHLY_PLAN_ID = process.env.MP_MONTHLY_PLAN_ID ?? "";

function validateSignature(req: NextRequest, rawBody: string, dataId: string): boolean {
  if (!MP_WEBHOOK_SECRET) return true;
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  // Se não tiver header de assinatura (Preference webhooks não mandam), aceita
  if (!ts || !v1) return true;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computed = createHmac("sha256", MP_WEBHOOK_SECRET).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(v1));
  } catch {
    return false;
  }
}

async function mpGet(path: string) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let event: { type: string; data: { id: string }; action?: string };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!validateSignature(req, rawBody, event.data?.id ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = createServerClient();

  // Pagamento único via Preference (checkout)
  if (event.type === "payment") {
    const payment = await mpGet(`/v1/payments/${event.data.id}`);
    console.log(`[MP] payment ${event.data.id} status=${payment.status} ref=${payment.external_reference}`);

    if (payment.status === "approved") {
      const userId: string = payment.external_reference ?? "";
      if (userId) {
        const periodEnd = new Date();
        // Detecta plano pelo item id ou valor do pagamento
        const itemId = payment.additional_info?.items?.[0]?.id ?? "";
        const amount = payment.transaction_amount ?? 0;
        const isMonthly = itemId === "weekly" || itemId === "monthly" || (amount >= 40 && amount < 100);
        const isAnnual = itemId === "annual" || amount >= 200;
        if (isMonthly) periodEnd.setMonth(periodEnd.getMonth() + 1);
        else if (isAnnual) periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        else periodEnd.setMonth(periodEnd.getMonth() + 1); // fallback seguro: 1 mês

        await setUserPro(userId, { periodEnd, mpSubscriptionId: String(event.data.id) });
        console.log(`[MP] payment approved: user ${userId} → PRO até ${periodEnd.toISOString()}`);
      }
    }
    return NextResponse.json({ received: true });
  }

  // Subscription status changed (authorized, cancelled, paused)
  if (event.type === "preapproval") {
    const sub = await mpGet(`/preapproval/${event.data.id}`);
    const userId: string = sub.external_reference;
    if (!userId) return NextResponse.json({ ok: true });

    if (sub.status === "authorized") {
      const isMonthly = sub.preapproval_plan_id === MP_MONTHLY_PLAN_ID;
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + (isMonthly ? 1 : 12));

      await setUserPro(userId, {
        periodEnd,
        mpSubscriptionId: sub.id,
      });

      console.log(`[MP] User ${userId} → PRO anual até ${periodEnd.toISOString()}`);
    }

    if (sub.status === "cancelled" || sub.status === "paused") {
      await supabase.from("user_plans").upsert({
        user_id: userId,
        plan: "free",
        mp_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      });
      console.log(`[MP] User ${userId} → free (${sub.status})`);
    }
  }

  // Payment processed for a subscription cycle
  if (event.type === "subscription_authorized_payment") {
    const payment = await mpGet(`/authorized_payments/${event.data.id}`);
    if (payment.status === "processed") {
      // Extend subscription by 12 months from now
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 12);

      const { data: plan } = await supabase
        .from("user_plans")
        .select("user_id")
        .eq("mp_subscription_id", payment.preapproval_id)
        .single();

      if (plan?.user_id) {
        await setUserPro(plan.user_id, {
          periodEnd,
          mpSubscriptionId: payment.preapproval_id,
        });
        console.log(`[MP] Renewed user ${plan.user_id} até ${periodEnd.toISOString()}`);
      }
    }
  }

  return NextResponse.json({ received: true });
}
