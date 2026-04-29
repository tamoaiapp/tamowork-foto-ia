"use client";

import { useEffect } from "react";

interface Props {
  photoUrl: string;
  onAssinar: () => void;
  onContinuar: () => void;
  onMount?: () => void;
}

export default function ConversionScreen({ photoUrl, onAssinar, onContinuar, onMount }: Props) {
  const isBR = (typeof navigator !== "undefined" ? navigator.language : "pt-BR").startsWith("pt");

  useEffect(() => { onMount?.(); }, []);

  return (
    <div style={s.overlay}>
      <div style={{ ...s.bgPhoto, backgroundImage: `url(${photoUrl})` }} />
      <div style={s.bgDim} />

      <div style={s.sheet}>
        <div style={s.photoWrap}>
          <img src={photoUrl} alt="Foto gerada" style={s.photo} />
          <div style={s.photoBadge}>✨ Pronta!</div>
        </div>

        <h2 style={s.headline}>Foto profissional pronta em 30 segundos</h2>
        <p style={s.sub}>
          Isso que você viu foi apenas 1 clique. Imagina quantas fotos você consegue pra vender mais no Instagram.
        </p>

        <div style={s.benefits}>
          {[
            ["📸", "Fotos ilimitadas — tire quantas precisar, todo dia"],
            ["🎬", "Vídeos animados do produto direto para Reels"],
            ["🎙️", "Vídeo narrado: IA roteiriza, narra e monta tudo"],
            ["✏️", "Editor de foto: personalize, mude fundo, adicione texto"],
            ["📱", "Todos os formatos: Stories, Reels, feed, anúncios"],
            ["⚡", "Sem fila, sem esperar — tudo automático e pronto"],
          ].map(([icon, text]) => (
            <div key={text} style={s.benefitRow}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={s.benefitText}>{text}</span>
            </div>
          ))}
        </div>

        <div style={s.priceRow}>
          <div>
            <div style={s.priceLabel}>{isBR ? "Oferta especial" : "Annual plan"}</div>
            {isBR && (
              <div style={{ fontSize: 11, color: "#4e5c72", textDecoration: "line-through", marginBottom: 2 }}>R$79/mês</div>
            )}
            <div style={s.price}>
              <span style={s.priceNum}>{isBR ? "R$29" : "$100"}</span>
              <span style={s.pricePer}>{isBR ? "/mês" : "/year"}</span>
            </div>
            <div style={s.priceSub}>
              {isBR
                ? "Menos de R$0,97/dia · Cancele sem motivo"
                : "Less than $0.28/day · Cancel anytime"}
            </div>
          </div>
          <div style={s.saveBadge}>{isBR ? "-63% OFF" : "No commitment"}</div>
        </div>

        <button onClick={onAssinar} style={s.ctaBtn}>
          {isBR ? "🚀 Liberar fotos ilimitadas — R$29/mês" : "🚀 Get unlimited photos — $100/year"}
        </button>

        <button onClick={onContinuar} style={s.skipBtn}>
          {isBR ? "Ver minha foto primeiro" : "View photo first"}
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
    filter: "blur(20px) brightness(0.3)",
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
  photoWrap: {
    display: "flex", justifyContent: "center",
    position: "relative", marginBottom: 4,
  },
  photo: {
    width: 120, height: 120, objectFit: "cover",
    borderRadius: 16,
    border: "2px solid rgba(168,85,247,0.5)",
    boxShadow: "0 8px 32px rgba(168,85,247,0.3)",
  },
  photoBadge: {
    position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 20, padding: "3px 12px",
    fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
  },
  headline: {
    fontSize: 22, fontWeight: 800, color: "#eef2f9",
    textAlign: "center", margin: "8px 0 0", lineHeight: 1.3,
  },
  sub: {
    fontSize: 14, color: "#8394b0", lineHeight: 1.6,
    textAlign: "center", margin: 0,
  },
  benefits: {
    background: "#111820", borderRadius: 14,
    padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 10,
  },
  benefitRow: { display: "flex", alignItems: "flex-start", gap: 10 },
  benefitText: { fontSize: 13, color: "#b0bec9", lineHeight: 1.5 },
  priceRow: {
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 14, padding: "14px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  priceLabel: { fontSize: 11, color: "#8394b0", marginBottom: 3 },
  price: { display: "flex", alignItems: "baseline", gap: 3 },
  priceNum: { fontSize: 28, fontWeight: 800, color: "#eef2f9" },
  pricePer: { fontSize: 13, color: "#8394b0" },
  priceSub: { fontSize: 11, color: "#4e5c72", marginTop: 2 },
  saveBadge: {
    background: "rgba(22,199,132,0.15)",
    border: "1px solid rgba(22,199,132,0.4)",
    borderRadius: 10, padding: "6px 12px",
    fontSize: 12, fontWeight: 700, color: "#16c784",
    whiteSpace: "nowrap",
  },
  ctaBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14,
    padding: "16px", width: "100%",
    color: "#fff", fontSize: 16, fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
    fontFamily: "Outfit, sans-serif",
    letterSpacing: "-.2px",
  },
  skipBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "13px",
    color: "#8394b0", fontSize: 14, cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    textAlign: "center" as const,
  },
};
