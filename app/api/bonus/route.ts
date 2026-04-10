import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { setUserTrial } from "@/lib/plans";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, password, mode } = await req.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha mínima de 6 caracteres" }, { status: 400 });
  }

  let userId: string | null = null;
  let isNewUser = false;

  if (mode === "login") {
    // Modo: já tenho conta — autentica e verifica
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
    }
    userId = data.user.id;
  } else {
    // Modo: criar conta
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError) {
      if (signUpError.message?.includes("already been registered") || signUpError.code === "email_exists") {
        return NextResponse.json({ error: "Este email já tem conta. Use a opção 'Já tenho conta'." }, { status: 409 });
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    userId = signUpData.user?.id ?? null;
    isNewUser = true;
  }

  if (!userId) {
    return NextResponse.json({ error: "Erro ao identificar usuário" }, { status: 500 });
  }

  // Verifica se bônus já foi resgatado
  const { data: planData } = await supabaseAdmin
    .from("user_plans")
    .select("bonus_claimed, plan, period_end")
    .eq("user_id", userId)
    .single();

  if (planData?.bonus_claimed === true) {
    return NextResponse.json(
      { error: "already_claimed", message: "Você já resgatou seu bônus de 30 dias." },
      { status: 409 }
    );
  }

  // Dá 30 dias de trial e marca bônus como resgatado
  await setUserTrial(userId, 30);

  await supabaseAdmin
    .from("user_plans")
    .update({ bonus_claimed: true })
    .eq("user_id", userId);

  return NextResponse.json({
    ok: true,
    isNewUser,
    message: "Bônus ativado! Você tem 30 dias de acesso PRO gratuito.",
  });
}
