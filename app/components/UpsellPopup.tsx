"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Props {
  onAssinar: (plan: "annual" | "monthly") => void;
  onClose: () => void;
}

// ─── A/B variants ──────────────────────────────────────────────────────────────
// Each variant has: id, headline, subheadline, cta, badge, emoji, accentColor
const VARIANTS = [
  {
    id: "v1_escassez",
    emoji: "⚡",
    headline: "Fotos profissionais ilimitadas",
    subheadline: "Venda mais com imagens que vendem. Plano anual por apenas R$29/mês.",
    cta: "Quero o plano anual",
    badge: "🔥 Mais popular",
    accent: "#a855f7",
  },
  {
    id: "v2_economia",
    emoji: "💰",
    headline: "Economize R$600 por ano",
    subheadline: "Plano mensal sai R$948/ano. O anual, só R$348. A diferença paga um iPhone.",
    cta: "Assinar por R$348/ano",
    badge: "💸 Melhor custo-benefício",
    accent: "#16c784",
  },
  {
    id: "v3_resultado",
    emoji: "📸",
    headline: "Sua foto de produto em 60 segundos",
    subheadline: "Fotos ilimitadas, fundo branco, cenários profissionais e vídeos animados — tudo no anual.",
    cta: "Começar agora — R$29/mês",
    badge: "✨ Resultado garantido",
    accent: "#6366f1",
  },
  {
    id: "v4_urgencia",
    emoji: "🚀",
    headline: "Desbloqueie tudo agora",
    subheadline: "Você está limitado a 2 fotos/dia. Com o Pro, são fotos ilimitadas todo dia.",
    cta: "Desbloquear Pro",
    badge: "🔓 Sem limites",
    accent: "#f59e0b",
  },
  {
    id: "v5_social_proof",
    emoji: "⭐",
    headline: "Usado por +500 lojistas",
    subheadline: "Quem vende no Instagram e WhatsApp usa o TamoWork para ter fotos de catálogo sem fotógrafo.",
    cta: "Fazer parte — R$29/mês",
    badge: "👥 +500 usuários",
    accent: "#ec4899",
  },
  {
    id: "v6_dor",
    emoji: "😤",
    headline: "Chega de foto feia de produto",
    subheadline: "Fundo bagunçado, luz ruim, produto torto. Com o Pro, qualquer foto vira profissional.",
    cta: "Transformar minhas fotos",
    badge: "✅ Resultados reais",
    accent: "#ef4444",
  },
  {
    id: "v7_simples",
    emoji: "🎯",
    headline: "R$29 por mês. Fotos ilimitadas.",
    subheadline: "Sem taxa de fotógrafo. Sem estúdio. Sem edição manual. Só você e a IA.",
    cta: "Assinar o plano anual",
    badge: "🎯 Simples assim",
    accent: "#0ea5e9",
  },
  {
    id: "v8_comparacao",
    emoji: "📊",
    headline: "Fotógrafo: R$300/sessão. TamoWork: R$29/mês",
    subheadline: "Fotos ilimitadas, entregues em segundos. Sem agendamento, sem deslocamento.",
    cta: "Quero economizar agora",
    badge: "💡 Compare e decida",
    accent: "#14b8a6",
  },
  {
    id: "v9_exclusivo",
    emoji: "👑",
    headline: "Acesso Pro — plano exclusivo anual",
    subheadline: "Fotos ilimitadas + vídeo animado + fundo branco + catálogo com modelo. Por R$348/ano.",
    cta: "Quero acesso completo",
    badge: "👑 Tudo incluído",
    accent: "#8b5cf6",
  },
  {
    id: "v10_primeiro_job",
    emoji: "🎉",
    headline: "Sua primeira foto ficou incrível!",
    subheadline: "Imagina ter isso sem limite. Assine o anual por R$29/mês e gere fotos todo dia.",
    cta: "Continuar sem limites",
    badge: "🎉 Aproveite o momento",
    accent: "#f97316",
  },
] as const;

type Variant = typeof VARIANTS[number];

const STORAGE_KEY = "upsell_variant";
const SHOWN_KEY   = "upsell_shown_at";
const DISMISS_KEY = "upsell_dismissed_until";

/** Retorna ou sorteia a variante desta sessão */
function getVariant(): Variant {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = VARIANTS.find(v => v.id === saved);
      if (found) return found;
    }
    // Sorteia uma variante nova
    const v = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    localStorage.setItem(STORAGE_KEY, v.id);
    return v;
  } catch {
    return VARIANTS[0];
  }
}

/** Registra impressão no banco via API (fire-and-forget) */
function trackImpression(variantId: string) {
  try {
    fetch("/api/upsell-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "impression", variant: variantId }),
    }).catch(() => {});
  } catch { /* silencioso */ }
}

/** Registra clique no CTA */
function trackClick(variantId: string) {
  try {
    fetch("/api/upsell-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "click", variant: variantId }),
    }).catch(() => {});
  } catch { /* silencioso */ }
}

export default function UpsellPopup({ onAssinar, onClose }: Props) {
  const { lang } = useI18n();
  const [variant] = useState<Variant>(() => getVariant());
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Registra horário em que foi exibido
    try { localStorage.setItem(SHOWN_KEY, Date.now().toString()); } catch { /* */ }
    trackImpression(variant.id);
  }, [variant.id]);

  function handleClose() {
    // Suprime por 24h após fechar
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000)); } catch { /* */ }
    setClosing(true);
    setTimeout(onClose, 280);
  }

  function handleCTA() {
    trackClick(variant.id);
    onAssinar("annual");
    handleClose();
  }

  function handleMonthly() {
    trackClick(variant.id + "_monthly");
    onAssinar("monthly");
    handleClose();
  }

  const acc = variant.accent;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: closing ? "fadeOut .28s ease forwards" : "fadeIn .28s ease",
      }}
      onClick={handleClose}
    >
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div
        style={{
          width: "100%", maxWidth: 520,
          background: "#07080b",
          borderRadius: "24px 24px 0 0",
          padding: "28px 24px 32px",
          paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
          display: "flex", flexDirection: "column", gap: 20,
          animation: closing ? undefined : "slideUp .32s cubic-bezier(.22,1,.36,1)",
          boxShadow: `0 -4px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleClose}
            style={{
              background: "rgba(255,255,255,.07)", border: "none", borderRadius: 8,
              color: "#8394b0", width: 30, height: 30, cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* Badge */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{
            background: `${acc}22`, border: `1px solid ${acc}55`,
            borderRadius: 20, padding: "5px 14px",
            fontSize: 12, fontWeight: 700, color: acc,
          }}>
            {variant.badge}
          </span>
        </div>

        {/* Emoji + headline */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 14 }}>{variant.emoji}</div>
          <h2 style={{
            fontSize: 22, fontWeight: 800, color: "#eef2f9",
            lineHeight: 1.25, margin: 0, marginBottom: 10,
          }}>
            {variant.headline}
          </h2>
          <p style={{
            fontSize: 14, color: "#8394b0", lineHeight: 1.6, margin: 0,
          }}>
            {variant.subheadline}
          </p>
        </div>

        {/* Price highlight */}
        <div style={{
          background: "#111820", borderRadius: 16,
          border: `1px solid ${acc}44`,
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 12, color: "#8394b0", marginBottom: 4 }}>
              {lang === "en" ? "Annual plan" : "Plano anual"}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#eef2f9" }}>R$29</span>
              <span style={{ fontSize: 14, color: "#8394b0" }}>/mês</span>
            </div>
            <div style={{ fontSize: 11, color: "#4e5c72", marginTop: 2 }}>R$348 cobrado uma vez</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              background: "#16c78422", border: "1px solid #16c78455",
              borderRadius: 10, padding: "6px 12px",
              fontSize: 13, fontWeight: 700, color: "#16c784",
            }}>
              {lang === "en" ? "Save R$600" : "Economize R$600"}
            </div>
          </div>
        </div>

        {/* Feature bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["✅", lang === "en" ? "Unlimited professional photos" : "Fotos profissionais ilimitadas"],
            ["✅", lang === "en" ? "Animated product videos" : "Vídeos animados do produto"],
            ["✅", lang === "en" ? "White background removal" : "Fundo branco automático"],
            ["✅", lang === "en" ? "Model catalog" : "Catálogo com modelo"],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              <span style={{ fontSize: 13, color: "#b0bec9" }}>{text}</span>
            </div>
          ))}
        </div>

        {/* CTA principal */}
        <button
          onClick={handleCTA}
          style={{
            background: `linear-gradient(135deg, ${acc}, #6366f1)`,
            border: "none", borderRadius: 14,
            padding: "16px", width: "100%",
            color: "#fff", fontSize: 16, fontWeight: 800,
            cursor: "pointer", letterSpacing: "-.2px",
            boxShadow: `0 4px 20px ${acc}55`,
          }}
        >
          {variant.cta}
        </button>

        {/* CTA secundário mensal */}
        <button
          onClick={handleMonthly}
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 12, padding: "12px", width: "100%",
            color: "#8394b0", fontSize: 13, cursor: "pointer",
          }}
        >
          {lang === "en" ? "Monthly plan — R$79/mo" : "Plano mensal — R$79/mês"}
        </button>

        {/* Rodapé */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#4e5c72", margin: 0 }}>
          {lang === "en"
            ? "Cancel anytime · Secure payment · Instant access"
            : "Cancele quando quiser · Pagamento seguro · Acesso imediato"}
        </p>
      </div>
    </div>
  );
}

/**
 * Verifica se o popup deve ser exibido para este usuário.
 * - Nunca exibe se já foi descartado nas últimas 24h
 * - Exibe 3s após o login
 */
export function shouldShowUpsell(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() > until;
  } catch {
    return true;
  }
}
