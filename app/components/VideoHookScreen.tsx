"use client";

/**
 * VideoHookScreen — Variante C do A/B test
 * Aparece após a 1ª foto pronta para usuários free.
 * Foca no vídeo animado + vídeo narrado que vende mais.
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
      <div style={{ ...s.bgPhoto, backgroundImage: `url(${photoUrl})` }} />
      <div style={s.bgDim} />

      <div style={s.sheet}>
        {/* Before / After visual */}
        <div style={s.videoDemo}>
          <div style={s.demoBox}>
            <div style={s.demoLabel}>📸 Sua foto</div>
            <img src={photoUrl} alt="Foto" style={s.demoImg} />
          </div>
          <div style={s.demoArrow}>→</div>
          <div style={s.demoBox}>
            <div style={s.demoLabel}>🎬 Vira um vídeo que vende</div>
            <div style={{ ...s.demoImg, background: "#1a1f2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={s.playIcon}>▶</div>
            </div>
          </div>
        </div>

        <h2 style={s.headline}>Seu produto em vídeo? Vendas explodem 📈</h2>
        <p style={s.sub}>
          A mesma foto vira um vídeo animado — ou um vídeo narrado onde a IA roteiriza, fala do produto e monta tudo.
        </p>

        <div style={s.features}>
          {[
            ["🎬", "Vídeo animado com zoom e efeitos — pronto para Reels"],
            ["🎙️", "Vídeo narrado: IA escreve roteiro, narra com voz natural e monta 4 cenas"],
            ["📱", "Formatos automáticos: Stories, Reels, TikTok, anúncio"],
            ["⚡", "Gera em 2 minutos — você posta na hora"],
          ].map(([icon, text]) => (
            <div key={text} style={s.featureRow}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={s.featureText}>{text}</span>
            </div>
          ))}
        </div>

        <div style={s.socialProof}>
          <span style={s.stars}>★★★★★</span>
          <span style={s.proofText}>&quot;Minhas vendas cresceram depois que comecei a postar vídeos do produto&quot;</span>
        </div>

        <div style={s.priceHighlight}>
          <span style={s.priceHighlightText}>{isBR ? `Tudo por ${PRO_BR_MONTHLY_PRICE_LABEL}/mês` : "Everything for $100/year"}</span>
          <span style={s.priceHighlightSub}>{isBR ? "Fotos ilimitadas + vídeos + editor" : "Unlimited photos + videos + editor"}</span>
        </div>

        <button onClick={onAssinar} style={s.ctaBtn}>
          {isBR ? "🎬 Criar vídeos que vendem — Assinar PRO" : "🎬 Create videos that sell — Subscribe"}
        </button>

        <button onClick={onCriar2aFoto} style={s.skipBtn}>
          {isBR ? "Ver meu resultado primeiro" : "View my result first"}
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
  },
  bgPhoto: {
    position: "absolute", inset: 0,
    backgroundSize: "cover", backgroundPosition: "center",
    filter: "blur(20px) brightness(0.25)",
    transform: "scale(1.1)",
  },
  bgDim: {
    position: "absolute", inset: 0,
    background: "linear-gradient(to top, rgba(7,8,11,0.98) 60%, rgba(7,8,11,0.7))",
  },
  sheet: {
    position: "relative", zIndex: 1,
    width: "100%", maxWidth: 520,
    background: "#0c1018",
    borderRadius: "24px 24px 0 0",
    padding: "24px 20px 36px",
    paddingBottom: "calc(36px + env(safe-area-inset-bottom, 0px))",
    display: "flex", flexDirection: "column", gap: 14,
    boxShadow: "0 -4px 40px rgba(0,0,0,.8)",
    overflowY: "auto", maxHeight: "90vh",
  },
  videoDemo: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 12, marginBottom: 4,
  },
  demoBox: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  },
  demoLabel: { fontSize: 11, color: "#8394b0", fontWeight: 600 },
  demoImg: {
    width: 100, height: 100, objectFit: "cover",
    borderRadius: 14,
    border: "2px solid rgba(168,85,247,0.4)",
  } as React.CSSProperties,
  playIcon: {
    width: 40, height: 40,
    background: "rgba(168,85,247,0.85)",
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, color: "#fff", fontWeight: 800,
  },
  demoArrow: { fontSize: 20, color: "#4e5c72", fontWeight: 800 },
  headline: {
    fontSize: 22, fontWeight: 800, color: "#eef2f9",
    textAlign: "center" as const, margin: "4px 0 0", lineHeight: 1.3,
  },
  sub: {
    fontSize: 14, color: "#8394b0", lineHeight: 1.6,
    textAlign: "center" as const, margin: 0,
  },
  features: {
    background: "#111820", borderRadius: 14,
    padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 10,
  },
  featureRow: { display: "flex", alignItems: "flex-start", gap: 10 },
  featureText: { fontSize: 13, color: "#b0bec9", lineHeight: 1.5 },
  socialProof: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 12, padding: "10px 14px",
    display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4,
  },
  stars: { color: "#f59e0b", fontSize: 14, letterSpacing: 2 },
  proofText: { fontSize: 12, color: "#8394b0", textAlign: "center" as const, fontStyle: "italic" },
  priceHighlight: {
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 14, padding: "14px 16px",
    display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4,
  },
  priceHighlightText: { fontSize: 16, fontWeight: 800, color: "#eef2f9" },
  priceHighlightSub: { fontSize: 12, color: "#8394b0" },
  ctaBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14,
    padding: "16px", width: "100%",
    color: "#fff", fontSize: 15, fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
    fontFamily: "Outfit, sans-serif",
    letterSpacing: "-.2px",
  },
  skipBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "13px",
    color: "#8394b0", fontSize: 13, cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    textAlign: "center" as const,
  },
};
