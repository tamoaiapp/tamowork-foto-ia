import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkLegacyStripeSubscription } from "@/lib/stripe-legacy";
import { setUserPro, setUserTrial } from "@/lib/plans";

// Admin client — pode criar usuários
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha mínima de 6 caracteres" }, { status: 400 });
  }

  // 1. Tenta criar conta (se já existe, busca o userId)
  let userId: string | null = null;

  const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    if (signUpError.message?.includes("already been registered") || signUpError.code === "email_exists") {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = listData?.users?.find(u => u.email === email);
      if (existing) userId = existing.id;
      else return NextResponse.json({ error: "Erro ao verificar conta" }, { status: 500 });
    } else {
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }
  } else {
    userId = signUpData.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }

  // 2. Verifica assinatura ativa no Stripe legado
  const legacy = await checkLegacyStripeSubscription(email);

  if (legacy) {
    // Pagante do app antigo: usa o period_end real do Stripe + salva o subscription_id
    // Assim: aparece como "Mensal — ativo" com dias corretos, e cancela quando Stripe cancelar
    await setUserPro(userId, {
      periodEnd: legacy.periodEnd,
      stripeSubscriptionId: legacy.subscriptionId,
      stripeCustomerId: legacy.customerId,
    });
    return NextResponse.json({
      ok: true,
      plan: "pro",
      message: "Bem-vindo! Sua conta PRO está ativa.",
    });
  }

  // 3. Usuário novo — 30 dias bônus
  await setUserTrial(userId, 30);
  return NextResponse.json({
    ok: true,
    plan: "trial",
    message: "Bem-vindo! Você tem 30 dias de acesso PRO.",
  });
}
