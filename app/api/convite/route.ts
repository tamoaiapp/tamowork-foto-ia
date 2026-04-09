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

  // 1. Tenta criar conta (se já existe, faz login para pegar o userId)
  let userId: string | null = null;

  const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // confirma direto, sem email
  });

  if (signUpError) {
    if (signUpError.message?.includes("already been registered") || signUpError.code === "email_exists") {
      // Usuário já existe — busca o ID
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

  // 2. Verifica se é pagante do app antigo (Stripe legado)
  const isPagante = await checkLegacyStripeSubscription(email);

  if (isPagante) {
    // PRO por 1 ano (assinatura ativa no app antigo)
    await setUserPro(userId, { periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) });
  } else {
    // 30 dias grátis
    await setUserTrial(userId, 30);
  }

  return NextResponse.json({
    ok: true,
    plan: isPagante ? "pro" : "trial",
    message: isPagante
      ? "Bem-vindo! Sua conta PRO está ativa."
      : "Bem-vindo! Você tem 30 dias grátis.",
  });
}
