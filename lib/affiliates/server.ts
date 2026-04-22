import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_AFFILIATE_COMMISSION_RATE = 0.3;
export const DEFAULT_AFFILIATE_HOLD_DAYS = Number(process.env.AFFILIATE_HOLD_DAYS ?? 7);
const AFFILIATE_SETUP_MESSAGE =
  "Programa de afiliados ainda nao foi ativado no banco. Rode o bootstrap SQL de exec_sql no Supabase e depois chame /api/internal/affiliates/migrate.";

type AffiliateRow = {
  id: string;
  user_id: string;
  code: string;
  display_name: string | null;
  commission_rate: number | string | null;
  stripe_account_id?: string | null;
  stripe_account_status?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return String(error ?? "");
}

export function getAffiliateSetupMessage() {
  return AFFILIATE_SETUP_MESSAGE;
}

export function isAffiliateSchemaMissingError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("programa de afiliados ainda nao foi ativado no banco") ||
    message.includes("could not find the table 'public.affiliates'") ||
    message.includes("could not find the table 'public.affiliate_clicks'") ||
    message.includes("could not find the table 'public.affiliate_referrals'") ||
    message.includes("could not find the table 'public.affiliate_commissions'") ||
    message.includes("relation \"affiliates\" does not exist") ||
    message.includes("relation \"affiliate_clicks\" does not exist") ||
    message.includes("relation \"affiliate_referrals\" does not exist") ||
    message.includes("relation \"affiliate_commissions\" does not exist")
  );
}

function wrapAffiliateError(error: unknown): Error {
  if (isAffiliateSchemaMissingError(error)) {
    return new Error(AFFILIATE_SETUP_MESSAGE);
  }
  return error instanceof Error ? error : new Error(getErrorMessage(error) || "Erro interno de afiliados");
}

export function normalizeAffiliateCode(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 24) || "afiliado";
}

export function buildAffiliateLink(code: string) {
  const baseUrl = process.env.APP_URL ?? "https://tamowork.com";
  return `${baseUrl}/?ref=${encodeURIComponent(code)}`;
}

export function calculateCommissionAmount(grossAmountCents: number, commissionRate = DEFAULT_AFFILIATE_COMMISSION_RATE) {
  return Math.max(0, Math.round(grossAmountCents * commissionRate));
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function ensureAffiliateForUser(userId: string, email?: string | null) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("affiliates")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw wrapAffiliateError(existingError);
  if (existing) return existing as AffiliateRow;

  const baseCode = normalizeAffiliateCode((email ?? "").split("@")[0] ?? "afiliado");
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.floor(100 + Math.random() * 900)}`;
    const code = `${baseCode}${suffix}`.slice(0, 30);
    const { data, error } = await supabase
      .from("affiliates")
      .insert({
        user_id: userId,
        code,
        display_name: email?.split("@")[0] ?? null,
        commission_rate: DEFAULT_AFFILIATE_COMMISSION_RATE,
      })
      .select("*")
      .single();

    if (!error && data) return data as AffiliateRow;
    lastError = wrapAffiliateError(error?.message ?? "Falha ao criar afiliado");
  }

  throw lastError ?? new Error("Falha ao criar afiliado");
}

export async function getAffiliateByCode(code: string) {
  const normalized = normalizeAffiliateCode(code);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();

  if (error) throw wrapAffiliateError(error);
  return (data as AffiliateRow | null) ?? null;
}

export async function getAffiliateReferralForUser(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("affiliate_referrals")
    .select("*")
    .eq("referred_user_id", userId)
    .maybeSingle();

  if (error) {
    if (isAffiliateSchemaMissingError(error)) {
      return null;
    }
    throw wrapAffiliateError(error);
  }
  return data;
}

export async function recordAffiliateClick(params: {
  code: string;
  visitorId: string;
  landingPath?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}) {
  const affiliate = await getAffiliateByCode(params.code);
  if (!affiliate) return null;

  const supabase = createSupabaseAdminClient();
  const ipHash = params.ip
    ? crypto.createHash("sha256").update(params.ip).digest("hex").slice(0, 32)
    : null;

  const { error } = await supabase
    .from("affiliate_clicks")
    .insert({
      affiliate_id: affiliate.id,
      referral_code: affiliate.code,
      visitor_id: params.visitorId,
      landing_path: params.landingPath ?? null,
      user_agent: params.userAgent ?? null,
      ip_hash: ipHash,
    });

  if (error) throw wrapAffiliateError(error);
  return affiliate;
}

export async function claimAffiliateReferral(params: {
  code: string;
  visitorId?: string | null;
  userId: string;
  userEmail?: string | null;
}) {
  const affiliate = await getAffiliateByCode(params.code);
  if (!affiliate) return null;
  if (affiliate.user_id === params.userId) return null;

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("affiliate_referrals")
    .select("*")
    .eq("referred_user_id", params.userId)
    .maybeSingle();

  if (existingError) throw wrapAffiliateError(existingError);

  const payload = {
    affiliate_id: affiliate.id,
    referred_user_id: params.userId,
    visitor_id: params.visitorId ?? null,
    referral_code: affiliate.code,
    referred_email: params.userEmail ?? null,
    status: existing?.converted_at ? existing.status : "signed_up",
    first_clicked_at: existing?.first_clicked_at ?? new Date().toISOString(),
    signed_up_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("affiliate_referrals")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw wrapAffiliateError(error);
    return data;
  }

  const { data, error } = await supabase
    .from("affiliate_referrals")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw wrapAffiliateError(error);
  return data;
}

export async function markAffiliateCheckoutStarted(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("affiliate_referrals")
    .update({
      status: "checkout_started",
      checkout_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("referred_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isAffiliateSchemaMissingError(error)) {
      return null;
    }
    throw wrapAffiliateError(error);
  }
  return data;
}
