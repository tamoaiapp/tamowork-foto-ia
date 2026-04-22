import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildAffiliateLink,
  ensureAffiliateForUser,
  getAffiliateSetupMessage,
  isAffiliateSchemaMissingError,
} from "@/lib/affiliates/server";

function inferStripeStatus(account: Stripe.Account) {
  if (account.charges_enabled && account.payouts_enabled) return "active";
  if (account.requirements?.currently_due?.length) return "pending";
  return "restricted";
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const admin = createSupabaseAdminClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const affiliate = await ensureAffiliateForUser(user.id, user.email ?? null);

    let currentAffiliate = affiliate;
    if (process.env.STRIPE_SECRET_KEY && affiliate.stripe_account_id) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const account = await stripe.accounts.retrieve(affiliate.stripe_account_id);
      const accountStatus = inferStripeStatus(account);
      await admin.from("affiliates").upsert({
        id: affiliate.id,
        user_id: affiliate.user_id,
        code: affiliate.code,
        display_name: affiliate.display_name,
        commission_rate: affiliate.commission_rate ?? 0.3,
        stripe_account_id: account.id,
        stripe_account_status: accountStatus,
        stripe_onboarding_complete: account.details_submitted ?? false,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        updated_at: new Date().toISOString(),
      });
      currentAffiliate = {
        ...affiliate,
        stripe_account_status: accountStatus,
        stripe_onboarding_complete: account.details_submitted ?? false,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      };
    }

    const [
      clicksRes,
      referralsRes,
      commissionsRes,
    ] = await Promise.all([
      admin
        .from("affiliate_clicks")
        .select("visitor_id, created_at", { count: "exact" })
        .eq("affiliate_id", currentAffiliate.id)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("affiliate_referrals")
        .select("id, referred_email, status, signed_up_at, converted_at, last_paid_at, next_billing_at, total_paid_cents, total_commission_cents, stripe_subscription_id, latest_invoice_id, created_at")
        .eq("affiliate_id", currentAffiliate.id)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("affiliate_commissions")
        .select("id, stripe_invoice_id, gross_amount_cents, commission_amount_cents, currency, status, earned_at, available_at, transferred_at, paid_at, payout_estimated_at, created_at")
        .eq("affiliate_id", currentAffiliate.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (clicksRes.error) throw clicksRes.error;
    if (referralsRes.error) throw referralsRes.error;
    if (commissionsRes.error) throw commissionsRes.error;

    const clicks = clicksRes.data ?? [];
    const referrals = referralsRes.data ?? [];
    const commissions = commissionsRes.data ?? [];
    const uniqueVisitors = new Set(clicks.map((item) => item.visitor_id)).size;
    const signups = referrals.filter((item) => !!item.signed_up_at).length;
    const paidUsers = referrals.filter((item) => !!item.converted_at).length;
    const activeSubscribers = referrals.filter((item) => item.status === "active").length;

    const totals = commissions.reduce(
      (acc, item) => {
        acc.total += item.commission_amount_cents ?? 0;
        if (item.status === "pending") acc.pending += item.commission_amount_cents ?? 0;
        if (item.status === "transferred") acc.transferred += item.commission_amount_cents ?? 0;
        if (item.status === "paid") acc.paid += item.commission_amount_cents ?? 0;
        return acc;
      },
      { total: 0, pending: 0, transferred: 0, paid: 0 }
    );

    return NextResponse.json({
      affiliate: {
        id: currentAffiliate.id,
        code: currentAffiliate.code,
        display_name: currentAffiliate.display_name,
        commission_rate: Number(currentAffiliate.commission_rate ?? 0.3),
        link: buildAffiliateLink(currentAffiliate.code),
        stripe_account_id: currentAffiliate.stripe_account_id ?? null,
        stripe_account_status: currentAffiliate.stripe_account_status ?? "not_connected",
        stripe_onboarding_complete: currentAffiliate.stripe_onboarding_complete ?? false,
        stripe_charges_enabled: currentAffiliate.stripe_charges_enabled ?? false,
        stripe_payouts_enabled: currentAffiliate.stripe_payouts_enabled ?? false,
      },
      metrics: {
        clicks: clicksRes.count ?? clicks.length,
        unique_visitors: uniqueVisitors,
        signups,
        paid_users: paidUsers,
        active_subscribers: activeSubscribers,
        total_commission_cents: totals.total,
        pending_commission_cents: totals.pending,
        transferred_commission_cents: totals.transferred,
        paid_commission_cents: totals.paid,
      },
      referrals,
      commissions,
    });
  } catch (err) {
    if (isAffiliateSchemaMissingError(err)) {
      return NextResponse.json({ error: getAffiliateSetupMessage() }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao carregar afiliados" },
      { status: 500 }
    );
  }
}
