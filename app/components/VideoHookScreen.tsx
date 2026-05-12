"use client";

/**
 * VideoHookScreen — Variante C do A/B test
 * Aparece ~3s após a 1ª foto pronta de usuários free.
 *
 * Princípios de conversão aplicados aqui:
 *  1. Foto principal permanece visível atrás do sheet (não cobre o produto)
 *  2. Loss aversion: "1/1 fotos free hoje" — escassez REAL, não timer fake
 *  3. CTA único e grande; escape discreto
 *  4. Preço com anchor concreto ("menos que 1 foto de estúdio")
 *  5. Headline em 1 linha, copy curta (mobile-first)
 */

import { useEffect } from "react";
import { PRO_BR_MONTHLY_PRICE_LABEL } from "@/lib/pricing";

interface Props {
  photoUrl: string;
  onAssinar: () => void;
  onCriar2aFoto: () => void;
  onMount?: () => void;
}

export default function VideoHookScreen({ photoUrl, onAssinar, onCriar2aFoto, onMount }: Props) {
  useEffect(() => { onMount?.(); }, []);
  const isBR = (typeof navigator !== "undefined" ? navigator.language : "pt-BR").startsWith("pt");

  return (
    <div style={s.overlay}>
      <div style={s.backdropDim} onClick={onCriar2aFoto} />

      <div style={s.sheet}>
        {/* Drag handle visual */}
        <div style={s.handle} />

        {/* Escassez real — pega o pico emocional logo apos a foto pronta */}
        <div style={s.scarcity}>
          <span style={s.scarcityDot} />
          <span>{isBR ? "Você usou sua única foto grátis de hoje" : "You used your only free photo today"}</span>
        </div>

        {/* Headline com loss aversion */}
        <h2 style={s.headline}>
          {isBR ? "Próxima foto só amanhã" : "Next photo only tomorrow"}
          <span style={s.headlineAccent}>
            {isBR ? " — ou agora liberando o PRO" : " — or unlock PRO now"}
          </span>
        </h2>

        {/* Mini visual: foto -> vídeo (proof of value) */}
        <div style={s.transformDemo}>
          <img src={photoUrl} alt="" style={s.demoMini} />
          <span style={s.demoArrow}>→</span>
          <div style={s.demoVideoBox}>
            <span style={s.demoPlay}>▶</span>
            <span style={s.demoVideoLabel}>{isBR ? "vídeo" : "video"}</span>
          </div>
          <span style={s.demoArrow}>+</span>
          <div style={s.demoInfinity}>∞</div>
        </div>

        {/* Beneficios — 3 linhas curtas */}
        <div style={s.benefits}>
          <div style={s.benefitRow}>
            <span style={s.benefitIcon}>♾️</span>
            <span style={s.benefitText}>{isBR ? "Fotos ilimitadas todo dia" : "Unlimited photos every day"}</span>
          </div>
          <div style={s.benefitRow}>
            <span style={s.benefitIcon}>🎬</span>
            <span style={s.benefitText}>{isBR ? "Cada foto vira vídeo de venda (Reels/TikTok)" : "Each photo becomes a sales video"}</span>
          </div>
          <div style={s.benefitRow}>
            <span style={s.benefitIcon}>📱</span>
            <span style={s.benefitText}>{isBR ? "4 formatos: story, feed, anúncio, TikTok" : "4 formats: story, feed, ad, TikTok"}</span>
          </div>
        </div>

        {/* CTA com anchor de preco */}
        <button onClick={onAssinar} style={s.ctaBtn}>
          <span style={s.ctaTop}>
            {isBR ? `🚀 Liberar PRO — ${PRO_BR_MONTHLY_PRICE_LABEL}/mês` : "🚀 Unlock PRO — $100/year"}
          </span>
          <span style={s.ctaSub}>
            {isBR ? "menos que 1 foto profissional" : "less than 1 pro photo session"}
          </span>
        </button>

        <button onClick={onCriar2aFoto} style={s.skipBtn}>
          {isBR ? "Esperar até amanhã" : "Wait until tomorrow"}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 450,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    animation: "slideUp .35s cubic-bezier(.22,1,.36,1)",
    pointerEvents: "none" as const,
  },
  backdropDim: {
    position: "absolute", inset: 0,
    background: "linear-gradient(to top, rgba(7,8,11,0.78) 25%, rgba(7,8,11,0) 60%)",
    pointerEvents: "auto" as const,
  },
  sheet: {
    position: "relative", zIndex: 1,
    width: "100%", maxWidth: 520,
    background: "linear-gradient(180deg, #0f1422 0%, #0a0d15 100%)",
    borderRadius: "22px 22px 0 0",
    borderTop: "1px solid rgba(168,85,247,0.18)",
    padding: "10px 20px 28px",
    paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
    display: "flex", flexDirection: "column", gap: 12,
    boxShadow: "0 -8px 40px rgba(168,85,247,0.18), 0 -2px 20px rgba(0,0,0,.8)",
    overflowY: "auto", maxHeight: "62vh",
    pointerEvents: "auto" as const,
  },
  handle: {
    width: 36, height: 4, borderRadius: 99,
    background: "rgba(255,255,255,0.12)",
    margin: "0 auto 6px",
  },
  scarcity: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontSize: 12, fontWeight: 700, color: "#fbbf24",
    background: "rgba(251,191,36,0.08)",
    border: "1px solid rgba(251,191,36,0.22)",
    borderRadius: 99, padding: "6px 14px",
    alignSelf: "center",
  },
  scarcityDot: {
    width: 6, height: 6, borderRadius: "50%",
    background: "#fbbf24",
    boxShadow: "0 0 8px #fbbf24",
    display: "inline-block",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  headline: {
    fontSize: 20, fontWeight: 800,
    color: "#eef2f9", lineHeight: 1.25,
    margin: 0, textAlign: "center" as const,
    letterSpacing: "-0.02em",
  },
  headlineAccent: {
    background: "linear-gradient(135deg, #818cf8, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  transformDemo: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    margin: "4px 0",
  },
  demoMini: {
    width: 56, height: 56, objectFit: "cover", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
  } as React.CSSProperties,
  demoArrow: { fontSize: 16, color: "#4e5c72", fontWeight: 800 },
  demoVideoBox: {
    width: 56, height: 56, borderRadius: 10,
    background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))",
    border: "1px solid rgba(168,85,247,0.35)",
    display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
    gap: 2,
  },
  demoPlay: { fontSize: 14, color: "#a78bfa" },
  demoVideoLabel: { fontSize: 9, color: "#a78bfa", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 },
  demoInfinity: {
    width: 56, height: 56, borderRadius: 10,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#4ade80", fontSize: 26, fontWeight: 900,
  },
  benefits: {
    display: "flex", flexDirection: "column" as const, gap: 8,
    padding: "12px 14px",
    background: "rgba(255,255,255,0.02)",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.05)",
  },
  benefitRow: { display: "flex", alignItems: "center", gap: 10 },
  benefitIcon: { fontSize: 16, width: 22, textAlign: "center" as const },
  benefitText: { fontSize: 13, color: "#cbd5e1", lineHeight: 1.4 },
  ctaBtn: {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
    border: "none", borderRadius: 14,
    padding: "12px 16px",
    width: "100%",
    cursor: "pointer",
    boxShadow: "0 6px 24px rgba(139,92,246,0.45)",
    fontFamily: "Outfit, sans-serif",
    display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2,
  },
  ctaTop: {
    color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em",
  },
  ctaSub: {
    color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: 600,
  },
  skipBtn: {
    background: "transparent", border: "none",
    padding: "8px",
    color: "#4e5c72", fontSize: 12, cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    textAlign: "center" as const,
    textDecoration: "underline",
  },
};
