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
  cta1Label: "✨ Ver planos e criar mais fotos →",

  // ── RateLimitCard — aparece quando bate o limite ─────────────────────────
  rateLimitTitle: "⏰ Sua foto grátis de hoje foi usada!",
  rateLimitSubtitle: "Próxima foto grátis em",
  rateLimitCTALabel: "Quer criar mais agora mesmo?",
  rateLimitBtnLabel: "🚀 Quero fotos ilimitadas — Assinar PRO",
  rateLimitFooter: "Fotos ilimitadas · Vídeos · Cancela quando quiser",

  // ── A/B test — variante promovida ───────────────────────────────────────
  // null = sorteia pelo user_id (comportamento padrão)
  // "A" | "B" | "C" = força todos para a variante vencedora
  abPromotedVariant: null as "A" | "B" | "C" | null,

  // ── Metadados da última decisão do agente ───────────────────────────────
  _agentDecision: {
    updatedAt: "2026-04-13T21:00:00.000Z",
    reason: "7 free users com 1 foto sem retorno — CTA 2ª foto com mais urgência + rate limit com framing positivo",
  },
};
