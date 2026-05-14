// Cron: varre Stripe (NOVA + LEGADA) e sincroniza user_plans com a realidade.
// Garante que clientes que pagaram entrem no PRO mesmo se o webhook do Stripe
// falhar no momento da entrega (timeout, deploy do Vercel, retry esgotado).
//
// Schedule: a cada 10min via vercel.json.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { setUserPro } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

export const maxDuration = 60;

type ActiveSub = {
  id: string;
  customerId: string;
  current_period_end: number;
  metadataUserId?: string;
  source: "main" | "legacy";
};

async function listActiveSubs(key: string, source: "main" | "legacy"): Promise<ActiveSub[]> {
  const stripe = new Stripe(key);
  const all: ActiveSub[] = [];
  for (const status of ["active", "trialing", "past_due"] as const) {
    let starting_after: string | undefined;
    do {
      const r = await stripe.subscriptions.list({ status, limit: 100, starting_after, expand: ["data.items"] });
      for (const s of r.data) {
        const item = s.items.data[0] as unknown as { current_period_end?: number };
        const pe = (s as unknown as { current_period_end?: number }).current_period_end ?? item?.current_period_end ?? 0;
        all.push({
          id: s.id,
          customerId: typeof s.customer === "string" ? s.customer : s.customer.id,
          current_period_end: pe,
          metadataUserId: s.metadata?.userId,
          source,
        });
      }
      starting_after = r.has_more ? r.data[r.data.length - 1].id : undefined;
    } while (starting_after);
  }
  return all;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const internal = req.headers.get("x-internal-secret") ?? "";
  const isCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const isInternal = !!INTERNAL_SECRET && internal === INTERNAL_SECRET;
  if (!isCron && !isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // 1. Map email -> user_id (Supabase Auth)
  const emailToUserId = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < 1000) break;
    page++;
    if (page > 20) break;
  }

  // 2. Map user_id -> plano atual
  const { data: plans } = await admin
    .from("user_plans")
    .select("user_id, plan, period_end");
  const planMap = new Map<string, { plan: string; period_end: string | null }>();
  for (const p of plans ?? []) planMap.set(p.user_id, { plan: p.plan, period_end: p.period_end });

  // 3. Coleta subs ativas em ambas as contas Stripe (Promise.allSettled tolera falha em uma)
  const keys: Array<{ key?: string; source: "main" | "legacy" }> = [
    { key: process.env.STRIPE_SECRET_KEY, source: "main" },
    { key: process.env.STRIPE_LEGACY_SECRET_KEY, source: "legacy" },
  ];
  const subsPerSource = await Promise.allSettled(
    keys.filter((k) => !!k.key).map(({ key, source }) => listActiveSubs(key!, source))
  );
  const allSubs: ActiveSub[] = [];
  for (const r of subsPerSource) {
    if (r.status === "fulfilled") allSubs.push(...r.value);
  }

  // 4. Pra cada sub, resolve user_id (metadata > email do customer)
  const stripeByMain = new Stripe(process.env.STRIPE_SECRET_KEY ?? "dummy");
  const stripeByLegacy = process.env.STRIPE_LEGACY_SECRET_KEY ? new Stripe(process.env.STRIPE_LEGACY_SECRET_KEY) : null;
  type ToFix = { userId: string; pe: Date; subId: string; custId: string; source: "main" | "legacy"; cur?: { plan: string; period_end: string | null } };
  const fixes = new Map<string, ToFix>(); // dedup por userId, mantem maior period_end

  for (const sub of allSubs) {
    let userId = sub.metadataUserId;
    if (!userId) {
      // Busca email via customer
      try {
        const stripeC = sub.source === "main" ? stripeByMain : stripeByLegacy;
        if (!stripeC) continue;
        const customer = await stripeC.customers.retrieve(sub.customerId);
        const email = (customer as { email?: string }).email?.toLowerCase();
        if (email) userId = emailToUserId.get(email);
      } catch { /* ignora */ }
    }
    if (!userId) continue;

    const pe = sub.current_period_end > 0
      ? new Date(sub.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const cur = planMap.get(userId);
    const needFix = !cur || cur.plan !== "pro" || (cur.period_end && new Date(cur.period_end) < pe);
    if (!needFix) continue;

    const existing = fixes.get(userId);
    if (!existing || pe > existing.pe) {
      fixes.set(userId, { userId, pe, subId: sub.id, custId: sub.customerId, source: sub.source, cur });
    }
  }

  // 5. Aplica fixes
  const applied: Array<{ userId: string; from: string; to: string; pe: string; source: string }> = [];
  const errors: string[] = [];
  for (const f of fixes.values()) {
    try {
      await setUserPro(f.userId, {
        periodEnd: f.pe,
        stripeCustomerId: f.custId,
        stripeSubscriptionId: f.subId,
      });
      applied.push({
        userId: f.userId,
        from: f.cur ? `${f.cur.plan}|${f.cur.period_end ?? "-"}` : "missing",
        to: `pro|${f.pe.toISOString()}`,
        pe: f.pe.toISOString().slice(0, 10),
        source: f.source,
      });
    } catch (e) {
      errors.push(`${f.userId}: ${(e as Error)?.message ?? e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    subs_total: allSubs.length,
    fixes_needed: fixes.size,
    applied: applied.length,
    errors_count: errors.length,
    applied_detail: applied.slice(0, 50),
    errors: errors.slice(0, 10),
  });
}
