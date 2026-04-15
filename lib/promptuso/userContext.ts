/**
 * userContext.ts
 *
 * Busca o perfil de estilo e correções de âncora do usuário no Supabase.
 * Retorna um UserContext pronto para injetar no ollamaPrompt.
 */

import { createClient } from "@supabase/supabase-js";
import type { UserContext } from "./ollamaPrompt";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdmin() {
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Verifica se o produto atual bate com as keywords de uma correção.
 * Match case-insensitive — qualquer keyword presente no texto do produto/cena conta.
 */
function matchesProduct(keywords: string[], produto: string, cenario: string): boolean {
  const text = (produto + " " + cenario).toLowerCase();
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

export async function getUserContext(
  userId: string,
  produto: string,
  cenario: string
): Promise<UserContext> {
  const sb = getAdmin();

  // Busca perfil de estilo global
  const { data: profile } = await sb
    .from("user_prompt_profiles")
    .select("lighting, background, style_pref, extra_context")
    .eq("user_id", userId)
    .maybeSingle();

  // Busca correções de âncora do usuário
  const { data: corrections } = await sb
    .from("photo_product_corrections")
    .select("product_keywords, anchor_correction")
    .eq("user_id", userId);

  // Encontra a correção que bate com o produto atual
  const matched = corrections?.find((c) =>
    matchesProduct(c.product_keywords, produto, cenario)
  );

  const ctx: UserContext = {};

  if (profile) {
    const hasStyle =
      profile.lighting || profile.background || profile.style_pref || profile.extra_context;
    if (hasStyle) {
      ctx.style = {
        lighting: profile.lighting || undefined,
        background: profile.background || undefined,
        stylePreference: profile.style_pref || undefined,
        extraContext: profile.extra_context || undefined,
      };
    }
  }

  if (matched) {
    ctx.productCorrection = matched.anchor_correction;
  }

  return ctx;
}
