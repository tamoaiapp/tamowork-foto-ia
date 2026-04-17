import { createServerClient } from "@/lib/supabase/server";

export type Plan = "free" | "pro";

// Emails com bônus PRO pendente (aplicado automaticamente no primeiro acesso)
// Adicionar novos emails aqui quando necessário
const PENDING_BONUSES: Record<string, number> = {
  "momentogourmet46@gmail.com": 30,
  "jorgeschwingel@gmail.com": 30,
  "karlllinhafer@gmail.com": 30,
  "gustavoagama31@gmail.com": 30,
  "marleideduques@gmail.com": 30,
  "andrevm783@gmail.com": 30,
  "joaonetto_18@hotmail.com": 30,
  "gabrielarios16@icloud.com": 30,
  "luciana.m.passos@hotmail.com": 30,
  "karla_mauro15@icloud.com": 30,
  "leticiareis@hotmail.com": 30,
  "valleriasoares1@hotmail.com": 30,
  "celsoafonso@uol.com.br": 30,
  "consultorminas@hotmail.com": 30,
};

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("user_plans")
    .select("plan, period_end")
    .eq("user_id", userId)
    .single();

  if (!data) return "free";

  // Checar se o plano pro expirou (inclui trials com period_end de 30 dias)
  if (data.plan === "pro" && data.period_end) {
    if (new Date(data.period_end) < new Date()) return "free";
  }

  return (data.plan as Plan) ?? "free";
}

export async function setUserPro(
  userId: string,
  opts: {
    periodEnd: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    mpSubscriptionId?: string;
  }
) {
  const supabase = createServerClient();
  const { error } = await supabase.from("user_plans").upsert({
    user_id: userId,
    plan: "pro",
    period_end: opts.periodEnd.toISOString(),
    stripe_customer_id: opts.stripeCustomerId ?? null,
    stripe_subscription_id: opts.stripeSubscriptionId ?? null,
    mp_subscription_id: opts.mpSubscriptionId ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error(`[setUserPro] Falha ao salvar plano PRO do usuário ${userId}:`, error.message);
    throw new Error(`setUserPro failed: ${error.message}`);
  }
}

export async function setUserTrial(userId: string, days = 30) {
  // Trial = plano PRO com period_end de X dias — sem coluna extra
  const trialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await setUserPro(userId, { periodEnd: trialEnd });
}

/**
 * Verifica se o email tem bônus pendente e aplica automaticamente.
 * Chamado no primeiro request autenticado do usuário — fire-and-forget.
 */
export async function checkAndApplyPendingBonus(userId: string, userEmail: string): Promise<void> {
  const email = userEmail.toLowerCase().trim();
  const days = PENDING_BONUSES[email];
  if (!days) return;

  // Não sobrescreve quem já tem PRO ativo
  const current = await getUserPlan(userId);
  if (current === "pro") return;

  await setUserTrial(userId, days);
  console.log(`[bonus] ${days}d PRO aplicado automaticamente para ${email}`);
}
