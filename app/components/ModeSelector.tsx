"use client";

import { useEffect, useRef, useState } from "react";

export type CreationMode = "simulacao" | "fundo_branco" | "catalogo" | "personalizado" | "video" | "promo";

const BASE = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/examples";

const VIDEO_URLS = Array.from({ length: 9 }, (_, i) => `${BASE}/video${i + 1}.mp4`);

interface Props {
  selected?: CreationMode;
  onChange: (mode: CreationMode) => void;
  isPro?: boolean;
}

const MODES: {
  id: CreationMode;
  name: string;
  title: string;
  desc: string;
  img: string;
  badge?: string;
}[] = [
  {
    id: "fundo_branco",
    name: "Fundo branco",
    title: "Foto igual Mercado Livre",
    desc: "Fundo limpo e profissional. Ideal para lojas online.",
    img: `${BASE}/fundo_branco_split.jpg`,
    badge: "Mais usado",
  },
  {
    id: "simulacao",
    name: "Foto em cena",
    title: "Produto em ambiente real",
    desc: "Coloca seu produto numa cena bonita e real.",
    img: `${BASE}/simulacao.jpg`,
  },
  {
    id: "catalogo",
    name: "Com modelo",
    title: "Roupa vestida por IA",
    desc: "Modelo virtual usa sua peça sem precisar de fotógrafo.",
    img: `${BASE}/modelo_opt1.jpg`,
  },
  {
    id: "video",
    name: "Vídeo animado",
    title: "Foto que se mexe",
    desc: "Transforma sua foto num vídeo pronto para Reels.",
    img: "",
    badge: "PRO",
  },
  {
    id: "promo",
    name: "Post de promoção",
    title: "Arte pronta para postar",
    desc: "Cria post com preço e texto para divulgar no Instagram.",
    img: `${BASE}/promo_thumb.jpg`,
  },
  {
    id: "personalizado",
    name: "Do meu jeito",
    title: "Você escolhe a cena",
    desc: "Descreva o que quer e a IA cria do seu jeito.",
    img: `${BASE}/produto.jpg`,
  },
];

function VideoCard({ name, title, desc, badge, onClick }: {
  name: string; title: string; desc: string; badge?: string; onClick: () => void;
}) {
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [idxA, setIdxA] = useState(8);
  const [idxB, setIdxB] = useState(0);
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
    el.addEventListener("ended", advance);
    return () => el.removeEventListener("ended", advance);
  });

  return (
    <ModeCard
      name={name} title={title} desc={desc} badge={badge}
      onClick={onClick}
      media={
        <>
          <video ref={refA} src={VIDEO_URLS[idxA]}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: activeSlot === "A" ? 1 : 0, transition: "opacity 0.7s ease" }}
            autoPlay muted playsInline preload="auto" />
          <video ref={refB} src={VIDEO_URLS[idxB]}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: activeSlot === "B" ? 1 : 0, transition: "opacity 0.7s ease" }}
            muted playsInline preload="auto" />
        </>
      }
    />
  );
}

function ModeCard({ name, title, desc, badge, onClick, media, img }: {
  name: string; title: string; desc: string; badge?: string;
  onClick: () => void; media?: React.ReactNode; img?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#111820",
        border: `1.5px solid ${hovered ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(168,85,247,0.15)" : "none",
        display: "flex",
        flexDirection: "column",
      }}
      className="mode-card"
    >
      {/* Image area */}
      <div style={{ position: "relative", width: "100%", overflow: "hidden" }} className="mode-card-img-wrap">
        {media || (img && <img src={img} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />)}
        {/* Gradient overlay */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          pointerEvents: "none",
        }} />
        {/* Badge */}
        {badge && (
          <div style={{
            position: "absolute", top: 10, right: 10,
            background: badge === "Mais usado"
              ? "linear-gradient(135deg, #16c784, #0ea86a)"
              : "linear-gradient(135deg, #6366f1, #a855f7)",
            borderRadius: 6, padding: "4px 10px",
            fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.04em",
          }}>{badge}</div>
        )}
        {/* Overlay text */}
        <div style={{ position: "absolute", bottom: 10, left: 12, right: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(196,181,253,0.8)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
            {name}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
            {title}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 64 }} className="mode-card-footer">
        <span style={{ fontSize: 12, color: "#8394b0", lineHeight: 1.4 }} className="mode-card-desc">{desc}</span>
        <button
          style={{
            background: hovered ? "rgba(168,85,247,0.25)" : "rgba(168,85,247,0.1)",
            border: "1px solid rgba(168,85,247,0.35)",
            borderRadius: 10, padding: "10px 16px",
            color: "#c4b5fd", fontSize: 13, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          Usar agora
        </button>
      </div>
    </div>
  );
}

export default function ModeSelector({ onChange }: Props) {
  return (
    <div className="mode-selector">
      <style>{`
        .mode-selector .mode-title {
          font-size: 12px;
          font-weight: 700;
          color: #8394b0;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 14px;
        }
        .mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .mode-card-img-wrap {
          aspect-ratio: 3 / 4;
        }
        .mode-card-desc { display: none; }
        .mode-card-footer { min-height: 56px; }
        .mode-card-footer button { min-height: 40px; }

        @media (min-width: 900px) {
          .mode-selector .mode-title {
            font-size: 22px;
            font-weight: 800;
            color: #eef2f9;
            letter-spacing: -0.01em;
            margin-bottom: 6px;
            text-transform: none;
          }
          .mode-selector .mode-subtitle {
            display: block !important;
          }
          .mode-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          .mode-card-img-wrap {
            aspect-ratio: 4 / 3;
          }
          .mode-card-desc { display: block; }
        }
      `}</style>

      <div className="mode-title">O que você quer criar?</div>
      <div
        style={{ fontSize: 14, color: "#8394b0", marginBottom: 24, display: "none" }}
        className="mode-subtitle"
      >
        Escolha um modo para começar
      </div>

      <div style={{ display: "grid", gap: 12 }} className="mode-grid">
        {MODES.map((mode) =>
          mode.id === "video" ? (
            <VideoCard
              key="video"
              name={mode.name}
              title={mode.title}
              desc={mode.desc}
              badge={mode.badge}
              onClick={() => onChange("video")}
            />
          ) : (
            <ModeCard
              key={mode.id}
              name={mode.name}
              title={mode.title}
              desc={mode.desc}
              badge={mode.badge}
              img={mode.img}
              onClick={() => onChange(mode.id)}
            />
          )
        )}
      </div>
    </div>
  );
}
