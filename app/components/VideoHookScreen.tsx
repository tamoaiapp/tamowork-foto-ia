"use client";

/**
 * VideoHookScreen — Variante C do A/B test
 * Pagina cheia de oferta pos 1a foto (NAO eh modal sobreposto).
 * Toma a tela inteira para focar 100% em conversao.
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
    <div style={s.page}>
      {/* Header fino com botao de fechar */}
      <header style={s.header}>
        <button onClick={onCriar2aFoto} style={s.closeBtn} aria-label="Fechar">×</button>
      </header>

      <div style={s.scroll}>
        {/* Escassez no topo — pega o pico emocional logo apos a foto */}
        <div style={s.scarcityBadge}>
          <span style={s.scarcityDot} />
          <span>{isBR ? "Sua única foto grátis de hoje" : "Your only free photo today"}</span>
        </div>

        <h1 style={s.h1}>
          {isBR ? "Pronto! E agora?" : "Done! What's next?"}
        </h1>
        <p style={s.lede}>
          {isBR
            ? "Próxima foto só amanhã — ou libera o PRO agora e tira o limite."
            : "Next photo only tomorrow — or unlock PRO now and remove all limits."}
        </p>

        {/* Foto do cliente em destaque */}
        <div style={s.photoCard}>
          <img src={photoUrl} alt="Sua foto" style={s.photo} />
          <div style={s.photoCaption}>
            <span style={s.photoCaptionIcon}>✨</span>
            <span>{isBR ? "Sua foto criada agora" : "Your photo, just now"}</span>
          </div>
        </div>

        {/* Comparativo Free vs PRO */}
        <div style={s.compareGrid}>
          <div style={s.compareCol}>
            <div style={s.compareTitle}>{isBR ? "Hoje (Free)" : "Today (Free)"}</div>
            <ul style={s.compareList}>
              <li style={{ ...s.compareItem, opacity: 0.55 }}>
                <span style={s.compareCross}>✕</span>
                <span>{isBR ? "1 foto por dia" : "1 photo per day"}</span>
              </li>
              <li style={{ ...s.compareItem, opacity: 0.55 }}>
                <span style={s.compareCross}>✕</span>
                <span>{isBR ? "Sem vídeo" : "No video"}</span>
              </li>
              <li style={{ ...s.compareItem, opacity: 0.55 }}>
                <span style={s.compareCross}>✕</span>
                <span>{isBR ? "Sem editor" : "No editor"}</span>
              </li>
              <li style={{ ...s.compareItem, opacity: 0.55 }}>
                <span style={s.compareCross}>✕</span>
                <span>{isBR ? "1 formato" : "1 format"}</span>
              </li>
            </ul>
          </div>

          <div style={s.compareColPro}>
            <div style={s.compareTitlePro}>{isBR ? "Com PRO" : "With PRO"}</div>
            <ul style={s.compareList}>
              <li style={s.compareItem}>
                <span style={s.compareCheck}>✓</span>
                <span><strong>{isBR ? "Fotos ilimitadas" : "Unlimited photos"}</strong></span>
              </li>
              <li style={s.compareItem}>
                <span style={s.compareCheck}>✓</span>
                <span>{isBR ? "Cada foto vira vídeo" : "Each photo becomes a video"}</span>
              </li>
              <li style={s.compareItem}>
                <span style={s.compareCheck}>✓</span>
                <span>{isBR ? "Editor + retoques" : "Editor + retouching"}</span>
              </li>
              <li style={s.compareItem}>
                <span style={s.compareCheck}>✓</span>
                <span>{isBR ? "Story, Feed, Reels, Anúncio" : "Story, Feed, Reels, Ad"}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Social proof */}
        <div style={s.socialProof}>
          <div style={s.stars}>★★★★★</div>
          <p style={s.proofText}>
            {isBR
              ? '"Comecei a postar vídeos do produto e minhas vendas no Instagram subiram muito. Vale cada centavo."'
              : '"Started posting product videos and my Instagram sales went way up. Worth every cent."'}
          </p>
          <p style={s.proofAuthor}>— {isBR ? "Camila R., loja de roupas" : "Camila R., clothing store"}</p>
        </div>

        {/* Garantia */}
        <div style={s.guarantee}>
          <span style={s.guaranteeIcon}>🛡️</span>
          <div>
            <div style={s.guaranteeTitle}>{isBR ? "Cancela quando quiser" : "Cancel anytime"}</div>
            <div style={s.guaranteeSub}>
              {isBR ? "Sem fidelidade. Acesso vale até o fim do mês pago." : "No commitment. Access lasts until end of paid month."}
            </div>
          </div>
        </div>

        {/* Espaco para o CTA fixo nao cobrir conteudo */}
        <div style={{ height: 140 }} />
      </div>

      {/* CTA fixo no rodape */}
      <div style={s.ctaBar}>
        <button onClick={onAssinar} style={s.ctaBtn}>
          <span style={s.ctaTop}>
            {isBR ? `🚀 Liberar PRO — ${PRO_BR_MONTHLY_PRICE_LABEL}/mês` : "🚀 Unlock PRO — $100/year"}
          </span>
          <span style={s.ctaSub}>
            {isBR ? "menos que 1 foto de estúdio" : "less than 1 pro photo session"}
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
  page: {
    position: "fixed", inset: 0, zIndex: 500,
    background: "#07080b",
    display: "flex", flexDirection: "column" as const,
    animation: "slideUp .35s cubic-bezier(.22,1,.36,1)",
  },
  header: {
    flexShrink: 0,
    height: 48,
    display: "flex", alignItems: "center", justifyContent: "flex-end",
    padding: "env(safe-area-inset-top, 0px) 12px 0",
  },
  closeBtn: {
    width: 36, height: 36,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "50%",
    color: "#cbd5e1", fontSize: 22, fontWeight: 600,
    cursor: "pointer", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  scroll: {
    flex: 1, overflowY: "auto" as const,
    padding: "8px 20px 20px",
    maxWidth: 560, width: "100%",
    margin: "0 auto",
    display: "flex", flexDirection: "column" as const, gap: 18,
  },
  scarcityBadge: {
    display: "inline-flex", alignItems: "center", gap: 8,
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
  h1: {
    fontSize: 28, fontWeight: 800,
    color: "#eef2f9", lineHeight: 1.15,
    margin: 0, textAlign: "center" as const,
    letterSpacing: "-0.02em",
  },
  lede: {
    fontSize: 15, color: "#8394b0", lineHeight: 1.5,
    margin: 0, textAlign: "center" as const,
    maxWidth: 420, alignSelf: "center",
  },
  photoCard: {
    position: "relative" as const,
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(168,85,247,0.18)",
  },
  photo: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,
  photoCaption: {
    position: "absolute" as const,
    bottom: 10, left: 10,
    background: "rgba(7,8,11,0.78)",
    backdropFilter: "blur(8px)",
    borderRadius: 99, padding: "5px 12px",
    fontSize: 12, fontWeight: 700, color: "#eef2f9",
    display: "flex", alignItems: "center", gap: 6,
  },
  photoCaptionIcon: { fontSize: 13 },
  compareGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
  },
  compareCol: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14, padding: "14px 14px 16px",
  },
  compareColPro: {
    background: "linear-gradient(180deg, rgba(99,102,241,0.10), rgba(168,85,247,0.10))",
    border: "1px solid rgba(168,85,247,0.32)",
    borderRadius: 14, padding: "14px 14px 16px",
    boxShadow: "0 4px 18px rgba(168,85,247,0.12)",
  },
  compareTitle: {
    fontSize: 11, fontWeight: 700, color: "#8394b0",
    textTransform: "uppercase" as const, letterSpacing: 1,
    marginBottom: 10,
  },
  compareTitlePro: {
    fontSize: 11, fontWeight: 800,
    background: "linear-gradient(135deg, #818cf8, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textTransform: "uppercase" as const, letterSpacing: 1,
    marginBottom: 10,
  },
  compareList: {
    listStyle: "none" as const, padding: 0, margin: 0,
    display: "flex", flexDirection: "column" as const, gap: 8,
  },
  compareItem: {
    display: "flex", alignItems: "flex-start", gap: 8,
    fontSize: 13, color: "#cbd5e1", lineHeight: 1.4,
  },
  compareCross: {
    color: "#64748b", fontSize: 12, fontWeight: 800,
    width: 14, flexShrink: 0,
  },
  compareCheck: {
    color: "#4ade80", fontSize: 13, fontWeight: 800,
    width: 14, flexShrink: 0,
  },
  socialProof: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14, padding: "14px 18px",
    display: "flex", flexDirection: "column" as const, gap: 6,
  },
  stars: { color: "#fbbf24", fontSize: 14, letterSpacing: 3, textAlign: "center" as const },
  proofText: {
    fontSize: 13, color: "#cbd5e1", lineHeight: 1.55,
    margin: 0, textAlign: "center" as const, fontStyle: "italic" as const,
  },
  proofAuthor: {
    fontSize: 11, color: "#8394b0", margin: 0, textAlign: "center" as const,
  },
  guarantee: {
    display: "flex", alignItems: "center", gap: 12,
    background: "rgba(34,197,94,0.06)",
    border: "1px solid rgba(34,197,94,0.18)",
    borderRadius: 12, padding: "10px 14px",
  },
  guaranteeIcon: { fontSize: 22 },
  guaranteeTitle: { fontSize: 13, fontWeight: 700, color: "#86efac", marginBottom: 2 },
  guaranteeSub: { fontSize: 11, color: "#8394b0", lineHeight: 1.4 },
  ctaBar: {
    flexShrink: 0,
    padding: "14px 20px",
    paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
    background: "linear-gradient(to top, #07080b 70%, rgba(7,8,11,0))",
    borderTop: "1px solid rgba(168,85,247,0.16)",
    display: "flex", flexDirection: "column" as const, gap: 8,
    maxWidth: 560, width: "100%",
    margin: "0 auto",
  },
  ctaBtn: {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
    border: "none", borderRadius: 14,
    padding: "14px 16px",
    width: "100%",
    cursor: "pointer",
    boxShadow: "0 8px 28px rgba(139,92,246,0.5)",
    fontFamily: "Outfit, sans-serif",
    display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3,
  },
  ctaTop: { color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" },
  ctaSub: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: 600 },
  skipBtn: {
    background: "transparent", border: "none",
    padding: "6px",
    color: "#4e5c72", fontSize: 12, cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    textAlign: "center" as const,
    textDecoration: "underline",
  },
};
