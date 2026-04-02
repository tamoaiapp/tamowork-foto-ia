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
  img: string;
}[] = [
  {
    id: "simulacao",
    name: "Simulação de uso",
    title: "Produto em contexto real",
    img: `${BASE}/simulacao.jpg`,
  },
  {
    id: "catalogo",
    name: "Catálogo com modelo",
    title: "Produto vestido por IA",
    img: `${BASE}/modelo_opt1.jpg`,
  },
  {
    id: "fundo_branco",
    name: "Fundo branco",
    title: "Ideal para e-commerce",
    img: `${BASE}/fundo_branco_split.jpg`,
  },
  {
    id: "video",
    name: "Criar vídeo",
    title: "Anime sua foto com IA",
    img: "",
  },
  {
    id: "personalizado",
    name: "Personalizado",
    title: "Você no controle",
    img: `${BASE}/produto.jpg`,
  },
  {
    id: "promo",
    name: "Criar promoção",
    title: "Arte pronta para postar",
    img: `${BASE}/promo_thumb.jpg`,
  },
];

function VideoCard({ name, title, onClick }: { name: string; title: string; onClick: () => void }) {
  // Dois slots: A e B. Sempre um tocando, o outro precarregado.
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [idxA, setIdxA] = useState(8); // video9 primeiro
  const [idxB, setIdxB] = useState(0);
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const fadingRef = useRef(false);

  function advance() {
    if (fadingRef.current) return;
    fadingRef.current = true;

    if (activeSlot === "A") {
      // B começa a tocar enquanto A desaparece
      refB.current?.play().catch(() => {});
      setActiveSlot("B");
      // Depois da transição, atualiza src do slot A para o próximo
      setTimeout(() => {
        setIdxA((idxB + 1) % VIDEO_URLS.length);
        fadingRef.current = false;
      }, 700);
    } else {
      refA.current?.play().catch(() => {});
      setActiveSlot("A");
      setTimeout(() => {
        setIdxB((idxA + 1) % VIDEO_URLS.length);
        fadingRef.current = false;
      }, 700);
    }
  }

  // Listener no vídeo ativo
  useEffect(() => {
    const el = activeSlot === "A" ? refA.current : refB.current;
    if (!el) return;
    el.addEventListener("ended", advance);
    return () => el.removeEventListener("ended", advance);
  });

  const videoStyle = (active: boolean): React.CSSProperties => ({
    position: "absolute" as const, inset: 0,
    width: "100%", height: "100%", objectFit: "cover" as const,
    opacity: active ? 1 : 0,
    transition: "opacity 0.7s ease-in-out",
  });

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.imgWrap}>
        <video ref={refA} src={VIDEO_URLS[idxA]} style={videoStyle(activeSlot === "A")} autoPlay muted playsInline preload="auto" />
        <video ref={refB} src={VIDEO_URLS[idxB]} style={videoStyle(activeSlot === "B")} muted playsInline preload="auto" />
        <div style={s.gradientBottom} />
        <div style={s.overlayBottom}>
          <div style={s.overlayName}>{name}</div>
          <div style={s.overlayTitle}>{title}</div>
        </div>
      </div>
      <div style={s.footer}>
        <button style={s.btn}>Usar agora</button>
      </div>
    </div>
  );
}

export default function ModeSelector({ onChange }: Props) {
  return (
    <div>
      <div style={s.question}>O que você quer criar?</div>
      <div style={s.grid}>
        {MODES.map((mode) =>
          mode.id === "video" ? (
            <VideoCard
              key="video"
              name={mode.name}
              title={mode.title}
              onClick={() => onChange("video")}
            />
          ) : (
            <div key={mode.id} style={s.card} onClick={() => onChange(mode.id)}>
              <div style={s.imgWrap}>
                <img src={mode.img} alt={mode.name} style={s.img} />
                <div style={s.gradientBottom} />
                <div style={s.overlayBottom}>
                  <div style={s.overlayName}>{mode.name}</div>
                  <div style={s.overlayTitle}>{mode.title}</div>
                </div>
              </div>
              <div style={s.footer}>
                <button style={s.btn}>Usar agora</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  question: {
    fontSize: 12, fontWeight: 700, color: "#8394b0",
    textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  card: {
    background: "#111820",
    border: "1.5px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  imgWrap: {
    position: "relative" as const,
    width: "100%",
    aspectRatio: "3 / 4",
    overflow: "hidden",
  },
  img: {
    width: "100%", height: "100%",
    objectFit: "cover", display: "block",
  },
  gradientBottom: {
    position: "absolute" as const,
    bottom: 0, left: 0, right: 0, height: "55%",
    background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
    pointerEvents: "none" as const,
  },
  overlayBottom: {
    position: "absolute" as const,
    bottom: 12, left: 12, right: 12,
  },
  overlayName: {
    fontSize: 11, fontWeight: 700,
    color: "rgba(196,181,253,0.9)",
    marginBottom: 3,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  overlayTitle: {
    fontSize: 14, fontWeight: 700,
    color: "#fff",
    lineHeight: 1.35,
    textShadow: "0 1px 6px rgba(0,0,0,0.5)",
  },
  footer: {
    padding: "10px 10px 12px",
  },
  btn: {
    width: "100%",
    background: "rgba(168,85,247,0.12)",
    border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 10, padding: "10px 0",
    color: "#c4b5fd", fontSize: 13, fontWeight: 700,
    cursor: "pointer",
  },
};
