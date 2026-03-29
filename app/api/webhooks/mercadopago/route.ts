import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { setUserPro } from "@/lib/plans";
import { createServerClient } from "@/lib/supabase/server";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET!;

function validateSignature(req: NextRequest, rawBody: string, dataId: string): boolean {
  if (!MP_WEBHOOK_SECRET) return true; // skip in dev if not set
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

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

  // Subscription status changed (authorized, cancelled, paused)
  if (event.type === "preapproval") {
    const sub = await mpGet(`/preapproval/${event.data.id}`);
    const userId: string = sub.external_reference;
    if (!userId) return NextResponse.json({ ok: true });

    if (sub.status === "authorized") {
      // Calculate period end: 12 months from now
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 12);

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
