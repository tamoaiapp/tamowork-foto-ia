"use client";

import { useEffect, useRef, useState } from "react";

export type CreationMode = "simulacao" | "fundo_branco" | "catalogo" | "personalizado" | "video" | "promo" | "video_narrado" | "video_longo" | "produto_exposto";

const BASE = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/examples";
const VIDEO_URLS = [1,3,4,6,7,8,9].map(i => `${BASE}/video${i}.mp4`);

interface Props {
  selected?: CreationMode;
  onChange: (mode: CreationMode) => void;
  isPro?: boolean;
}

// ── Card com vídeo em loop para modo "vídeo curto" ───────────────────────────
function VideoMedia() {
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(1);
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const fadingRef = useRef(false);

  function advance() {
    if (fadingRef.current) return;
    fadingRef.current = true;
    if (activeSlot === "A") {
      refB.current?.play().catch(() => {});
      setActiveSlot("B");
      setTimeout(() => { setIdxA((idxB + 1) % VIDEO_URLS.length); fadingRef.current = false; }, 700);
    } else {
      refA.current?.play().catch(() => {});
      setActiveSlot("A");
      setTimeout(() => { setIdxB((idxA + 1) % VIDEO_URLS.length); fadingRef.current = false; }, 700);
    }
  }

  useEffect(() => {
    const el = activeSlot === "A" ? refA.current : refB.current;
    if (!el) return;
    const handler = () => advance();
    el.addEventListener("ended", handler);
    return () => el.removeEventListener("ended", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video ref={refA} src={VIDEO_URLS[idxA]}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: activeSlot === "A" ? 1 : 0, transition: "opacity 0.7s" }}
        autoPlay muted playsInline preload="metadata" />
      <video ref={refB} src={VIDEO_URLS[idxB]}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: activeSlot === "B" ? 1 : 0, transition: "opacity 0.7s" }}
        muted playsInline preload="none" />
    </div>
  );
}

// ── Card horizontal principal ─────────────────────────────────────────────────
function CreationCard({
  icon,
  label,
  highlightWord,
  desc,
  media,
  badge,
  onClick,
}: {
  icon: string;
  label: string;       // "Criar foto que"
  highlightWord: string; // "vende"
  desc: string;
  media: React.ReactNode;
  badge?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "#111820",
        border: `1.5px solid ${hovered ? "rgba(168,85,247,0.55)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 28px rgba(168,85,247,0.14)" : "none",
        minHeight: 110,
        position: "relative",
      }}
    >
      {/* Left: text */}
      <div style={{ flex: 1, padding: "18px 16px 18px 18px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, minWidth: 0 }}>
        {badge && (
          <div style={{
            display: "inline-flex", alignSelf: "flex-start",
            background: badge === "Mais usado"
              ? "linear-gradient(135deg, #16c784, #0ea86a)"
              : "linear-gradient(135deg, #6366f1, #a855f7)",
            borderRadius: 6, padding: "3px 9px",
            fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.05em",
            marginBottom: 2,
          }}>{badge}</div>
        )}
        <div style={{ fontSize: 18, fontWeight: 800, color: "#eef2f9", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
          <span style={{ color: "#eef2f9" }}>{icon} {label} </span>
          <span style={{
            background: "linear-gradient(90deg, #a855f7, #6366f1)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>{highlightWord}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#8394b0", lineHeight: 1.45, fontWeight: 400 }}>
          {desc}
        </div>
      </div>

      {/* Right: image/video */}
      <div style={{
        width: 140,
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }} className="mode-card-media">
        {/* gradient fade from left */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 40,
          background: "linear-gradient(to right, #111820, transparent)",
          zIndex: 1, pointerEvents: "none",
        }} />
        {media}
      </div>
    </div>
  );
}

// ── Animação de ondas sonoras para vídeo narrado ──────────────────────────────
function AudioWaveMedia() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(135deg, #120825 0%, #0d1a2e 60%, #07080b 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 10,
    }}>
      <div style={{ fontSize: 40, lineHeight: 1 }}>🎙️</div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {[5, 9, 14, 10, 7, 12, 8, 5, 11, 7].map((h, i) => (
          <div key={i} style={{
            width: 3, height: h,
            background: "linear-gradient(to top, #6366f1, #a855f7)",
            borderRadius: 2,
            animation: "modeWave 1.3s ease-in-out infinite",
            animationDelay: `${i * 0.11}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Export principal ──────────────────────────────────────────────────────────
export default function ModeSelector({ onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 88 }} className="mode-selector-v2">
      <style>{`
        @keyframes modeWave {
          0%, 100% { transform: scaleY(1); opacity: 0.7; }
          50% { transform: scaleY(1.8); opacity: 1; }
        }
        .mode-selector-v2 .mode-card-media {
          width: 130px;
        }
        @media (min-width: 480px) {
          .mode-selector-v2 .mode-card-media {
            width: 160px;
          }
        }
        @media (min-width: 900px) {
          .mode-selector-v2 {
            padding-bottom: 0 !important;
          }
          .mode-selector-v2 .mode-card-media {
            width: 200px;
          }
        }
      `}</style>

      {/* 1 — Live Shop (vídeo narrado) — PRIMEIRO */}
      <CreationCard
        icon="🛍️"
        label="Mini live que"
        highlightWord="vende"
        desc="Vídeo 10–12s estilo live shop com sua voz e imagem"
        badge="Mais usado"
        onClick={() => onChange("video_narrado")}
        media={<AudioWaveMedia />}
      />

      {/* 2 — Foto */}
      <CreationCard
        icon="📸"
        label="Criar foto que"
        highlightWord="vende"
        desc="Transforme sua foto em imagem profissional com IA"
        onClick={() => onChange("simulacao")}
        media={
          <img
            src={`${BASE}/simulacao.jpg`}
            alt="Foto profissional"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        }
      />

      {/* 3 — Vídeo curto animado */}
      <CreationCard
        icon="🎬"
        label="Criar vídeo que"
        highlightWord="vende"
        desc="Vídeo curto animado pra atrair clientes no Reels"
        onClick={() => onChange("video")}
        media={<VideoMedia />}
      />
    </div>
  );
}
