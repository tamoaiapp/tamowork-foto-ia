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

        <h2 style={s.headline}>Sua foto ficou incrível! 🎉</h2>
        <p style={s.sub}>
          Com o Pro, você gera fotos ilimitadas todo dia — sem esperar, sem limite.
        </p>

        <div style={s.benefits}>
          {[
            ["📸", "Fotos ilimitadas todos os dias"],
            ["🎬", "Vídeos animados do produto"],
            ["✂️", "Fundo branco automático"],
            ["👗", "Catálogo com modelo virtual"],
          ].map(([icon, text]) => (
            <div key={text} style={s.benefitRow}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={s.benefitText}>{text}</span>
            </div>
          ))}
        </div>

        {/* Preço dinâmico por região */}
        <div style={s.priceRow}>
          <div>
            <div style={s.priceLabel}>
              {isBR ? "Plano mensal" : "Annual plan"}
            </div>
            <div style={s.price}>
              <span style={s.priceNum}>{isBR ? "R$79" : "$100"}</span>
              <span style={s.pricePer}>{isBR ? "/mês" : "/year"}</span>
            </div>
            <div style={s.priceSub}>
              {isBR
                ? "Cobrado todo mês · Cancele quando quiser"
                : "Billed once a year · Cancel anytime"}
            </div>
          </div>
          <div style={s.saveBadge}>
            {isBR ? "Sem fidelidade" : "Cancel anytime"}
          </div>
        </div>

        <button onClick={onAssinar} style={s.ctaBtn}>
          {isBR ? "⚡ Assinar Pro agora · R$79/mês" : "⚡ Subscribe now · $100/year"}
        </button>

        <button onClick={onContinuar} style={s.skipBtn}>
          Ver minha foto primeiro
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
  benefitRow: { display: "flex", alignItems: "center", gap: 10 },
  benefitText: { fontSize: 13, color: "#b0bec9" },
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
