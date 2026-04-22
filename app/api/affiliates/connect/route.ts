import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAffiliateForUser } from "@/lib/affiliates/server";

function inferStripeStatus(account: Stripe.Account) {
  if (account.charges_enabled && account.payouts_enabled) return "active";
  if (account.requirements?.currently_due?.length) return "pending";
  return "restricted";
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe não configurado" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createServerClient();
  const admin = createSupabaseAdminClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const affiliate = await ensureAffiliateForUser(user.id, user.email ?? null);
    let account: Stripe.Account;

    if (affiliate.stripe_account_id) {
      account = await stripe.accounts.retrieve(affiliate.stripe_account_id);
    } else {
      account = await stripe.accounts.create({
        type: "express",
        country: process.env.STRIPE_CONNECT_COUNTRY ?? "BR",
        email: user.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          userId: user.id,
          affiliateId: affiliate.id,
        },
      });
    }

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

    const baseUrl = process.env.APP_URL ?? "https://tamowork.com";
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/afiliados?refresh_connect=1`,
      return_url: `${baseUrl}/afiliados?connected=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: link.url,
      accountId: account.id,
      status: accountStatus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao conectar Stripe" },
      { status: 500 }
    );
  }
}
