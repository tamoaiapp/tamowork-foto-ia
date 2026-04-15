"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Props {
  onAssinar: (plan: "annual" | "monthly") => void;
  onClose: () => void;
}

// ─── A/B variants ──────────────────────────────────────────────────────────────
const VARIANTS = [
  {
    id: "v1_escassez",
    emoji: "⚡",
    headline: "Fotos profissionais ilimitadas",
    subheadline: "Venda mais com imagens que vendem. Fotos e vídeos animados sem limite.",
    cta_br: "Assinar por R$79/mês",
    cta_en: "Subscribe — $100/year",
    badge: "🔥 Mais popular",
    accent: "#a855f7",
  },
  {
    id: "v2_economia",
    emoji: "💰",
    headline: "Menos de R$2,63 por dia",
    subheadline: "Fotos de catálogo profissionais por menos do que um cafezinho. Cancele quando quiser.",
    cta_br: "Assinar por R$79/mês",
    cta_en: "Subscribe — $100/year",
    badge: "💸 Melhor custo-benefício",
    accent: "#16c784",
  },
  {
    id: "v3_resultado",
    emoji: "📸",
    headline: "Sua foto de produto em 60 segundos",
    subheadline: "Fotos ilimitadas, fundo branco, cenários profissionais e vídeos animados.",
    cta_br: "Começar agora — R$79/mês",
    cta_en: "Get started — $100/year",
    badge: "✨ Resultado garantido",
    accent: "#6366f1",
  },
  {
    id: "v4_urgencia",
    emoji: "🚀",
    headline: "Desbloqueie tudo agora",
    subheadline: "Você está limitado a 2 fotos/dia. Com o Pro, são fotos ilimitadas todo dia.",
    cta_br: "Desbloquear Pro — R$79/mês",
    cta_en: "Unlock Pro — $100/year",
    badge: "🔓 Sem limites",
    accent: "#f59e0b",
  },
  {
    id: "v5_social_proof",
    emoji: "⭐",
    headline: "Usado por +500 lojistas",
    subheadline: "Quem vende no Instagram e WhatsApp usa o TamoWork para ter fotos de catálogo sem fotógrafo.",
    cta_br: "Fazer parte — R$79/mês",
    cta_en: "Join now — $100/year",
    badge: "👥 +500 usuários",
    accent: "#ec4899",
  },
  {
    id: "v6_dor",
    emoji: "😤",
    headline: "Chega de foto feia de produto",
    subheadline: "Fundo bagunçado, luz ruim, produto torto. Com o Pro, qualquer foto vira profissional.",
    cta_br: "Transformar minhas fotos — R$79/mês",
    cta_en: "Transform my photos — $100/year",
    badge: "✅ Resultados reais",
    accent: "#ef4444",
  },
  {
    id: "v7_simples",
    emoji: "🎯",
    headline: "R$79 por mês. Fotos ilimitadas.",
    subheadline: "Sem taxa de fotógrafo. Sem estúdio. Sem edição manual. Só você e a IA.",
    cta_br: "Assinar agora",
    cta_en: "Subscribe — $100/year",
    badge: "🎯 Simples assim",
    accent: "#0ea5e9",
  },
  {
    id: "v8_comparacao",
    emoji: "📊",
    headline: "Fotógrafo: R$300/sessão. TamoWork: R$79/mês",
    subheadline: "Fotos ilimitadas, entregues em segundos. Sem agendamento, sem deslocamento.",
    cta_br: "Quero economizar agora",
    cta_en: "Start saving now",
    badge: "💡 Compare e decida",
    accent: "#14b8a6",
  },
  {
    id: "v9_exclusivo",
    emoji: "👑",
    headline: "Acesso Pro completo",
    subheadline: "Fotos ilimitadas + vídeo animado + fundo branco + catálogo com modelo. Tudo incluso.",
    cta_br: "Quero acesso completo — R$79/mês",
    cta_en: "Get full access — $100/year",
    badge: "👑 Tudo incluído",
    accent: "#8b5cf6",
  },
  {
    id: "v10_primeiro_job",
    emoji: "🎉",
    headline: "Sua primeira foto ficou incrível!",
    subheadline: "Imagina ter isso sem limite. Assine e gere fotos profissionais todo dia.",
    cta_br: "Continuar sem limites — R$79/mês",
    cta_en: "Go unlimited — $100/year",
    badge: "🎉 Aproveite o momento",
    accent: "#f97316",
  },
] as const;

type Variant = typeof VARIANTS[number];

const STORAGE_KEY = "upsell_variant";
const SHOWN_KEY   = "upsell_shown_at";
const DISMISS_KEY = "upsell_dismissed_until";

function getVariant(): Variant {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = VARIANTS.find(v => v.id === saved);
      if (found) return found;
    }
    const v = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    localStorage.setItem(STORAGE_KEY, v.id);
    return v;
  } catch {
    return VARIANTS[0];
  }
}

function trackImpression(variantId: string) {
  try {
    fetch("/api/upsell-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "impression", variant: variantId }),
    }).catch(() => {});
  } catch { /* silencioso */ }
}

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

  const isBR = (typeof navigator !== "undefined" ? navigator.language : "pt-BR").startsWith("pt");

  useEffect(() => {
    try { localStorage.setItem(SHOWN_KEY, Date.now().toString()); } catch { /* */ }
    trackImpression(variant.id);
  }, [variant.id]);

  function handleClose() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000)); } catch { /* */ }
    setClosing(true);
    setTimeout(onClose, 280);
  }

  function handleCTA() {
    trackClick(variant.id);
    onAssinar(isBR ? "monthly" : "annual");
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
          <p style={{ fontSize: 14, color: "#8394b0", lineHeight: 1.6, margin: 0 }}>
            {variant.subheadline}
          </p>
        </div>

        {/* Price block — dinâmico por região */}
        <div style={{
          background: "#111820", borderRadius: 16,
          border: `1px solid ${acc}44`,
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 12, color: "#8394b0", marginBottom: 4 }}>
              {isBR ? "Plano mensal" : (lang === "en" ? "Annual plan" : "Plan anual")}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#eef2f9" }}>
                {isBR ? "R$79" : "$100"}
              </span>
              <span style={{ fontSize: 14, color: "#8394b0" }}>
                {isBR ? "/mês" : "/year"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#4e5c72", marginTop: 2 }}>
              {isBR
                ? "Cancele quando quiser"
                : (lang === "en" ? "Billed once a year" : "Facturado una vez al año")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              background: "#16c78422", border: "1px solid #16c78455",
              borderRadius: 10, padding: "6px 12px",
              fontSize: 13, fontWeight: 700, color: "#16c784",
            }}>
              {isBR ? "Sem fidelidade" : (lang === "en" ? "Cancel anytime" : "Sin permanencia")}
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

        {/* CTA único */}
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
          {isBR ? variant.cta_br : variant.cta_en}
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

export function shouldShowUpsell(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() > until;
  } catch {
    return true;
  }
}
