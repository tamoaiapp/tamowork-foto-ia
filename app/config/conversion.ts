/**
 * conversion.ts — Alavancas de conversão do TamoWork Foto IA
 *
 * ⚠️ Este arquivo é editado automaticamente pelo agente-conversao.js
 * com base em dados reais de funil e A/B test.
 * Não edite manualmente sem atualizar o agente também.
 *
 * Última decisão do agente: inicialização — aguardando dados suficientes.
 */

export const CONVERSION = {
  // ── CTA após 1ª foto (painel de resultado) ──────────────────────────────
  cta1Label: "📷 Criar minha 2ª foto grátis",

  // ── RateLimitCard — aparece quando bate o limite ─────────────────────────
  rateLimitTitle: "🔒 Limite diário atingido",
  rateLimitSubtitle: "Próxima foto grátis em",
  rateLimitCTALabel: "Ou assine o PRO e crie agora:",
  rateLimitBtnLabel: "✨ Assinar PRO — criar agora",
  rateLimitFooter: "Fotos ilimitadas · Cancela quando quiser",

  // ── A/B test — variante promovida ───────────────────────────────────────
  // null = sorteia pelo user_id (comportamento padrão)
  // "A" | "B" | "C" = força todos para a variante vencedora
  abPromotedVariant: null as "A" | "B" | "C" | null,

  // ── Metadados da última decisão do agente ───────────────────────────────
  _agentDecision: {
    updatedAt: "",
    reason: "inicialização — aguardando dados suficientes",
  },
};
