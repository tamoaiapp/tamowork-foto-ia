import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAffiliateSetupMessage, isAffiliateSchemaMissingError } from "@/lib/affiliates/server";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

export async function GET(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe nÃ£o configurado" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const internalHeader = req.headers.get("x-internal-secret") ?? "";
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isInternal = !!INTERNAL_SECRET && internalHeader === INTERNAL_SECRET;

  if (!isCron && !isInternal) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { data: commissions, error: commissionsError } = await admin
    .from("affiliate_commissions")
    .select("id, affiliate_id, referral_id, stripe_invoice_id, commission_amount_cents, currency")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .is("stripe_transfer_id", null)
    .order("available_at", { ascending: true })
    .limit(100);

  if (commissionsError) {
    if (isAffiliateSchemaMissingError(commissionsError)) {
      return NextResponse.json({ ok: false, skipped: true, reason: getAffiliateSetupMessage() });
    }
    return NextResponse.json({ error: commissionsError.message }, { status: 500 });
  }

  const affiliateIds = Array.from(new Set((commissions ?? []).map((item) => item.affiliate_id)));
  const { data: affiliates, error: affiliatesError } = affiliateIds.length
    ? await admin
        .from("affiliates")
        .select("id, stripe_account_id, stripe_account_status, stripe_payouts_enabled, stripe_onboarding_complete")
        .in("id", affiliateIds)
    : { data: [], error: null };

  if (affiliatesError) {
    if (isAffiliateSchemaMissingError(affiliatesError)) {
      return NextResponse.json({ ok: false, skipped: true, reason: getAffiliateSetupMessage() });
    }
    return NextResponse.json({ error: affiliatesError.message }, { status: 500 });
  }

  const affiliateMap = new Map((affiliates ?? []).map((affiliate) => [affiliate.id, affiliate]));
  const results: Array<{ id: string; ok: boolean; transferId?: string; error?: string }> = [];

  for (const commission of commissions ?? []) {
    const affiliate = affiliateMap.get(commission.affiliate_id);

    if (
      !affiliate?.stripe_account_id ||
      !affiliate.stripe_onboarding_complete ||
      !affiliate.stripe_payouts_enabled ||
      affiliate.stripe_account_status !== "active"
    ) {
      results.push({
        id: commission.id,
        ok: false,
        error: "Conta Stripe do afiliado ainda nÃ£o estÃ¡ pronta para recebimento",
      });
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.max(0, Number(commission.commission_amount_cents ?? 0)),
        currency: (commission.currency ?? "brl").toLowerCase(),
        destination: affiliate.stripe_account_id,
        metadata: {
          commissionId: commission.id,
          affiliateId: commission.affiliate_id,
          referralId: commission.referral_id ?? "",
          stripeInvoiceId: commission.stripe_invoice_id,
        },
      });

      const { error: updateError } = await admin
        .from("affiliate_commissions")
        .update({
          status: "transferred",
          stripe_transfer_id: transfer.id,
          transferred_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", commission.id);

      if (updateError) {
        throw updateError;
      }

      results.push({
        id: commission.id,
        ok: true,
        transferId: transfer.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao transferir comissÃ£o";
      await admin
        .from("affiliate_commissions")
        .update({
          notes: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commission.id);

      results.push({
        id: commission.id,
        ok: false,
        error: message,
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    transferred: results.filter((item) => item.ok).length,
    results,
  });
}
