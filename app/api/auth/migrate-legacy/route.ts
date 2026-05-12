import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { setUserPro } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActiveSub = { id: string; current_period_end?: number; customerId: string; source: "main" | "legacy" };

async function findActiveSubByEmail(stripeKey: string, email: string, source: "main" | "legacy"): Promise<ActiveSub | null> {
  const stripe = new Stripe(stripeKey);
  const customers = await stripe.customers.list({ email, limit: 5 });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 5 });
    const active = subs.data.find((s) => ["active", "trialing", "past_due"].includes(s.status));
    if (active) {
      return {
        id: active.id,
        current_period_end: (active as unknown as { current_period_end?: number }).current_period_end,
        customerId: customer.id,
        source,
      };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha obrigatórios" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha precisa ter pelo menos 6 caracteres" }, { status: 400 });
  }

  const emailLower = email.toLowerCase().trim();
  const admin = createSupabaseAdminClient();

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.error("[migrate-legacy] listUsers erro:", listErr.message);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === emailLower);
  if (existing) {
    return NextResponse.json({ error: "Conta já existe — use sua senha cadastrada ou recupere via 'Esqueci minha senha'" }, { status: 409 });
  }

  const keys: Array<{ key?: string; source: "main" | "legacy" }> = [
    { key: process.env.STRIPE_SECRET_KEY, source: "main" },
    { key: process.env.STRIPE_LEGACY_SECRET_KEY, source: "legacy" },
  ];
  let sub: ActiveSub | null = null;
  for (const { key, source } of keys) {
    if (!key) continue;
    try {
      sub = await findActiveSubByEmail(key, emailLower, source);
      if (sub) break;
    } catch (err) {
      console.error(`[migrate-legacy] Stripe ${source} erro:`, err instanceof Error ? err.message : err);
    }
  }
  if (!sub) {
    return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada para este e-mail" }, { status: 404 });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailLower,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    console.error("[migrate-legacy] createUser erro:", createErr?.message);
    return NextResponse.json({ error: createErr?.message ?? "Falha ao criar usuário" }, { status: 500 });
  }

  const periodEnd = sub.current_period_end && sub.current_period_end > 0
    ? new Date(sub.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  try {
    await setUserPro(created.user.id, {
      periodEnd,
      stripeCustomerId: sub.customerId,
      stripeSubscriptionId: sub.id,
    });
  } catch (err) {
    console.error(`[migrate-legacy] setUserPro falhou para ${created.user.id}:`, err);
    return NextResponse.json({ error: "Conta criada mas falha ao ativar PRO. Contate o suporte." }, { status: 500 });
  }

  console.log(`[migrate-legacy] ${emailLower} migrado de Stripe(${sub.source}) — sub=${sub.id} até ${periodEnd.toISOString()}`);
  return NextResponse.json({ ok: true, source: sub.source });
}
