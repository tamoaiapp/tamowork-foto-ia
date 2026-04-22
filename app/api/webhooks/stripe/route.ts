import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  addDays,
  calculateCommissionAmount,
  DEFAULT_AFFILIATE_COMMISSION_RATE,
  DEFAULT_AFFILIATE_HOLD_DAYS,
  isAffiliateSchemaMissingError,
} from "@/lib/affiliates/server";
import { setUserPro } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { metaEvents, queueMetaEvent } from "@/lib/meta/capi";

type SubscriptionLike = Stripe.Subscription & {
  current_period_end?: number;
  metadata: Record<string, string>;
};

type InvoiceLike = Stripe.Invoice & {
  amount_paid?: number;
  currency?: string | null;
  customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  status_transitions?: {
    paid_at?: number | null;
  };
  subscription?: string | Stripe.Subscription | null;
};

async function getReferral(admin: ReturnType<typeof createSupabaseAdminClient>, params: {
  referralId?: string | null;
  userId?: string | null;
  subscriptionId?: string | null;
}) {
  if (params.referralId) {
    const { data, error } = await admin
      .from("affiliate_referrals")
      .select("*")
      .eq("id", params.referralId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (params.userId) {
    const { data, error } = await admin
      .from("affiliate_referrals")
      .select("*")
      .eq("referred_user_id", params.userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (params.subscriptionId) {
    const { data, error } = await admin
      .from("affiliate_referrals")
      .select("*")
      .eq("stripe_subscription_id", params.subscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function syncReferralCheckout(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  referralId?: string | null;
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  latestInvoiceId?: string | null;
}) {
  const referral = await getReferral(params.admin, {
    referralId: params.referralId,
    userId: params.userId,
    subscriptionId: params.subscriptionId,
  });

  if (!referral) return null;

  const { data, error } = await params.admin
    .from("affiliate_referrals")
    .update({
      stripe_customer_id: params.customerId ?? referral.stripe_customer_id ?? null,
      stripe_subscription_id: params.subscriptionId ?? referral.stripe_subscription_id ?? null,
      latest_invoice_id: params.latestInvoiceId ?? referral.latest_invoice_id ?? null,
      checkout_started_at: referral.checkout_started_at ?? new Date().toISOString(),
      status: referral.converted_at ? referral.status : "checkout_started",
      updated_at: new Date().toISOString(),
    })
    .eq("id", referral.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function createRecurringCommission(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  referralId?: string | null;
  userId?: string | null;
  subscriptionId: string;
  invoice: InvoiceLike;
  customerId?: string | null;
  nextBillingAt?: string | null;
}) {
  const referral = await getReferral(params.admin, {
    referralId: params.referralId,
    userId: params.userId,
    subscriptionId: params.subscriptionId,
  });
  if (!referral) return;

  const grossAmountCents = Math.max(0, params.invoice.amount_paid ?? 0);
  const currency = (params.invoice.currency ?? "brl").toLowerCase();
  const paidAtSeconds = params.invoice.status_transitions?.paid_at ?? params.invoice.created;
  const paidAt = new Date(paidAtSeconds * 1000);
  const availableAt = addDays(paidAt, DEFAULT_AFFILIATE_HOLD_DAYS);

  let inserted = false;
  let commissionAmountCents = 0;

  if (grossAmountCents > 0) {
    const { data: existingCommission, error: existingCommissionError } = await params.admin
      .from("affiliate_commissions")
      .select("id, commission_amount_cents")
      .eq("stripe_invoice_id", params.invoice.id)
      .maybeSingle();

    if (existingCommissionError) throw existingCommissionError;

    if (existingCommission) {
      commissionAmountCents = Number(existingCommission.commission_amount_cents ?? 0);
    } else {
      const { data: affiliate, error: affiliateError } = await params.admin
        .from("affiliates")
        .select("commission_rate")
        .eq("id", referral.affiliate_id)
        .single();

      if (affiliateError) throw affiliateError;

      const commissionRate = Number(affiliate?.commission_rate ?? DEFAULT_AFFILIATE_COMMISSION_RATE);
      commissionAmountCents = calculateCommissionAmount(grossAmountCents, commissionRate);

      const { error: insertCommissionError } = await params.admin
        .from("affiliate_commissions")
        .insert({
          affiliate_id: referral.affiliate_id,
          referral_id: referral.id,
          referred_user_id: referral.referred_user_id,
          stripe_invoice_id: params.invoice.id,
          stripe_subscription_id: params.subscriptionId,
          gross_amount_cents: grossAmountCents,
          commission_amount_cents: commissionAmountCents,
          currency,
          status: "pending",
          earned_at: paidAt.toISOString(),
          available_at: availableAt.toISOString(),
        });

      if (insertCommissionError) throw insertCommissionError;
      inserted = true;
    }
  }

  const totalsUpdate = inserted
    ? {
        total_paid_cents: Number(referral.total_paid_cents ?? 0) + grossAmountCents,
        total_commission_cents: Number(referral.total_commission_cents ?? 0) + commissionAmountCents,
      }
    : {};

  const convertedAt = referral.converted_at ?? paidAt.toISOString();

  const { error: updateReferralError } = await params.admin
    .from("affiliate_referrals")
    .update({
      ...totalsUpdate,
      stripe_customer_id: params.customerId ?? referral.stripe_customer_id ?? null,
      stripe_subscription_id: params.subscriptionId,
      latest_invoice_id: params.invoice.id,
      last_paid_at: paidAt.toISOString(),
      next_billing_at: params.nextBillingAt,
      converted_at: convertedAt,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  if (updateReferralError) throw updateReferralError;
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe nÃ£o configurado" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[Stripe webhook] Invalid signature:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return NextResponse.json({ ok: true });

    const userId = session.metadata?.userId;
    const referralId = session.metadata?.referralId;
    if (!userId) return NextResponse.json({ ok: true });

    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    const subData = sub as SubscriptionLike;
    const rawEnd = subData.current_period_end;
    const periodEnd = rawEnd && rawEnd > 0
      ? new Date(rawEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await setUserPro(userId, {
        periodEnd,
        stripeCustomerId: String(sub.customer ?? session.customer ?? ""),
        stripeSubscriptionId: sub.id,
      });

      try {
        await syncReferralCheckout({
          admin,
          referralId,
          userId,
          customerId: typeof session.customer === "string" ? session.customer : String(sub.customer ?? ""),
          subscriptionId: sub.id,
          latestInvoiceId: typeof sub.latest_invoice === "string" ? sub.latest_invoice : null,
        });
      } catch (affiliateErr) {
        if (isAffiliateSchemaMissingError(affiliateErr)) {
          console.warn("[Stripe] afiliados ainda nao ativados no banco; checkout segue sem referral");
        } else {
          throw affiliateErr;
        }
      }

      const amountPaid = session.amount_total ? session.amount_total / 100 : 79;
      const currency = (session.currency ?? "brl").toUpperCase();
      const email = session.customer_details?.email ?? undefined;
      queueMetaEvent(metaEvents.subscribe({ userId, email }, amountPaid, currency));
      console.log(`[Stripe] User ${userId} → PRO até ${periodEnd.toISOString()}`);
    } catch (err) {
      console.error(`[Stripe] CRÃTICO: setUserPro falhou para ${userId}:`, err);
      return NextResponse.json({ error: "Falha ao ativar plano" }, { status: 500 });
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as InvoiceLike;
    const subId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

    if (!subId) return NextResponse.json({ ok: true });

    const sub = await stripe.subscriptions.retrieve(subId);
    const subData = sub as SubscriptionLike;
    const userId = subData.metadata?.userId;
    if (!userId) return NextResponse.json({ ok: true });

    const rawEnd2 = subData.current_period_end;
    const periodEnd = rawEnd2 && rawEnd2 > 0
      ? new Date(rawEnd2 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const referralId = subData.metadata?.referralId ?? null;
    const customerId =
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id ?? String(subData.customer ?? "");

    try {
      await setUserPro(userId, {
        periodEnd,
        stripeCustomerId: String(subData.customer ?? customerId ?? ""),
        stripeSubscriptionId: subData.id,
      });

      try {
        await createRecurringCommission({
          admin,
          referralId,
          userId,
          subscriptionId: subData.id,
          invoice,
          customerId,
          nextBillingAt: periodEnd.toISOString(),
        });
      } catch (affiliateErr) {
        if (isAffiliateSchemaMissingError(affiliateErr)) {
          console.warn("[Stripe] afiliados ainda nao ativados no banco; renovacao segue sem comissao");
        } else {
          throw affiliateErr;
        }
      }

      console.log(`[Stripe] Renovado user ${userId} atÃ© ${periodEnd.toISOString()}`);
    } catch (err) {
      console.error(`[Stripe] CRÃTICO: renovaÃ§Ã£o setUserPro falhou para ${userId}:`, err);
      return NextResponse.json({ error: "Falha ao renovar plano" }, { status: 500 });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as SubscriptionLike;
    const userId = sub.metadata?.userId;

    if (userId) {
      const { error } = await admin.from("user_plans").upsert({
        user_id: userId,
        plan: "free",
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return NextResponse.json({ error: "Falha ao cancelar plano" }, { status: 500 });
      }
    }

    try {
      const referral = await getReferral(admin, {
        referralId: sub.metadata?.referralId ?? null,
        userId: userId ?? null,
        subscriptionId: sub.id,
      });

      if (referral) {
        const { error: referralError } = await admin
          .from("affiliate_referrals")
          .update({
            status: "canceled",
            stripe_subscription_id: sub.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", referral.id);

        if (referralError) {
          throw referralError;
        }
      }
    } catch (affiliateErr) {
      if (!isAffiliateSchemaMissingError(affiliateErr)) {
        return NextResponse.json({ error: "Falha ao atualizar afiliado cancelado" }, { status: 500 });
      }
      console.warn("[Stripe] afiliados ainda nao ativados no banco; cancelamento segue sem referral");
    }

    if (userId) {
      console.log(`[Stripe] User ${userId} â†’ free (cancelado)`);
    }
  }

  return NextResponse.json({ received: true });
}
