"use client";

/**
 * VideoHookScreen — Variante C do A/B test
 * Aparece após a 1ª foto pronta para usuários free.
 * Foca no vídeo como aspiração principal de conversão.
 */

interface Props {
  photoUrl: string;
  onAssinar: () => void;
  onCriar2aFoto: () => void;
}

export default function VideoHookScreen({ photoUrl, onAssinar, onCriar2aFoto }: Props) {
  return (
    <div style={s.overlay}>
      <div style={{ ...s.bgPhoto, backgroundImage: `url(${photoUrl})` }} />
      <div style={s.bgDim} />

      <div style={s.sheet}>
        {/* Before / After visual */}
        <div style={s.comparison}>
          <div style={s.compItem}>
            <img src={photoUrl} alt="Foto" style={s.compImg} />
            <div style={s.compLabel}>📸 Foto</div>
          </div>
          <div style={s.arrow}>→</div>
          <div style={{ ...s.compItem, ...s.compItemLocked }}>
            <img src={photoUrl} alt="Vídeo" style={{ ...s.compImg, filter: "blur(3px) brightness(0.6)" }} />
            <div style={s.videoOverlay}>
              <div style={s.playBtn}>▶</div>
              <div style={s.videoLabel}>🎬 Vídeo PRO</div>
            </div>
            <div style={s.compLabel}>🎬 Vídeo animado</div>
          </div>
        </div>

        <h2 style={s.headline}>Quer ver ela ganhar vida? 🎬</h2>
        <p style={s.sub}>
          Com o PRO, sua foto vira um vídeo animado em 2 minutos.
          Perfeito para stories e anúncios.
        </p>

        <div style={s.socialProof}>
          <span style={s.stars}>★★★★★</span>
          <span style={s.proofText}>&quot;Meu produto vendeu 3x mais depois dos vídeos&quot;</span>
        </div>

        <button onClick={onAssinar} style={s.ctaBtn}>
          🎬 Criar vídeo animado — Assinar PRO
        </button>

        <div style={s.price}>R$29/mês no plano anual · Cancele quando quiser</div>

        <button onClick={onCriar2aFoto} style={s.skipBtn}>
          Criar mais uma foto grátis primeiro
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
  comparison: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 12, marginBottom: 4,
  },
  compItem: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    position: "relative",
  },
  compItemLocked: {},
  compImg: {
    width: 100, height: 100, objectFit: "cover",
    borderRadius: 14,
    border: "2px solid rgba(168,85,247,0.4)",
  },
  videoOverlay: {
    position: "absolute", inset: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    borderRadius: 14,
  },
  playBtn: {
    width: 32, height: 32,
    background: "rgba(168,85,247,0.9)",
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, color: "#fff",
  },
  videoLabel: { fontSize: 10, color: "#c4b5fd", fontWeight: 700, marginTop: 4 },
  compLabel: { fontSize: 11, color: "#8394b0" },
  arrow: { fontSize: 20, color: "#4e5c72" },
  headline: {
    fontSize: 22, fontWeight: 800, color: "#eef2f9",
    textAlign: "center" as const, margin: "4px 0 0", lineHeight: 1.3,
  },
  sub: {
    fontSize: 14, color: "#8394b0", lineHeight: 1.6,
    textAlign: "center" as const, margin: 0,
  },
  socialProof: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 12, padding: "10px 14px",
    display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4,
  },
  stars: { color: "#f59e0b", fontSize: 14, letterSpacing: 2 },
  proofText: { fontSize: 12, color: "#8394b0", textAlign: "center" as const, fontStyle: "italic" },
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
  price: {
    fontSize: 11, color: "#4e5c72",
    textAlign: "center" as const,
  },
  skipBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "13px",
    color: "#8394b0", fontSize: 13, cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    textAlign: "center" as const,
  },
};
