import { createServerClient } from "@/lib/supabase/server";

export type Plan = "free" | "pro";

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("user_plans")
    .select("plan, period_end, trial_expires_at")
    .eq("user_id", userId)
    .single();

  if (!data) return "free";

  // Trial ativo (30 dias grátis)
  if (data.trial_expires_at && new Date(data.trial_expires_at) > new Date()) {
    return "pro";
  }

  // Checar se o plano pro expirou
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
  await supabase.from("user_plans").upsert({
    user_id: userId,
    plan: "pro",
    period_end: opts.periodEnd.toISOString(),
    stripe_customer_id: opts.stripeCustomerId ?? null,
    stripe_subscription_id: opts.stripeSubscriptionId ?? null,
    mp_subscription_id: opts.mpSubscriptionId ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function setUserTrial(userId: string, days = 30) {
  const supabase = createServerClient();
  const trialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await supabase.from("user_plans").upsert({
    user_id: userId,
    plan: "free",
    trial_expires_at: trialEnd.toISOString(),
    updated_at: new Date().toISOString(),
  });
}
