"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type CreationMode = "simulacao" | "fundo_branco" | "catalogo" | "personalizado" | "video" | "promo" | "video_narrado" | "video_longo" | "produto_exposto";

const FOTO_MODES: CreationMode[] = ["simulacao", "catalogo", "produto_exposto", "fundo_branco", "personalizado"];
const VIDEO_MODES: CreationMode[] = ["video", "video_narrado", "video_longo"];

const BASE = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/examples";

const VIDEO_URLS = Array.from({ length: 9 }, (_, i) => `${BASE}/video${i + 1}.mp4`);

interface Props {
  selected?: CreationMode;
  onChange: (mode: CreationMode) => void;
  isPro?: boolean;
}

type ModeData = { id: CreationMode; name: string; title: string; desc: string; img: string; badge?: string; };

function getModes(lang: string): ModeData[] {
  if (lang === "en") return [
    { id: "simulacao",     name: "Lifestyle scene",   title: "Product in real setting",  desc: "Place your product in a beautiful, real-world scene.", img: `${BASE}/simulacao.jpg`, badge: "Most used" },
    { id: "catalogo",      name: "With model",         title: "AI-dressed model",         desc: "Virtual model wears your item — no photographer needed.", img: `${BASE}/modelo_opt1.jpg` },
    { id: "video",         name: "Animated video",     title: "Photo that moves",         desc: "Turn your photo into a video ready for Reels.", img: "", badge: "PRO" },
    { id: "video_narrado", name: "Narrated video",     title: "Photo + voiceover",        desc: "Your product photo becomes a video with AI narration. Write the script, AI reads it.", img: "", badge: "PRO" },
    { id: "video_longo",   name: "Long video",         title: "~32 second video",         desc: "AI generates 4 different scenes and joins them. Takes 20-40 min. PRO exclusive.", img: "", badge: "PRO" },
    { id: "produto_exposto", name: "Store display",      title: "Premium store display",    desc: "AI places your product on a mannequin, bust, counter or pedestal. No typing needed — AI reads the photo.", img: `${BASE}/simulacao.jpg`, badge: "PRO" },
    { id: "personalizado", name: "Custom",             title: "You choose the scene",     desc: "Describe what you want and the AI creates it your way.", img: `${BASE}/produto.jpg` },
  ];
  if (lang === "es") return [
    { id: "simulacao",     name: "Foto en escena",     title: "Producto en ambiente real", desc: "Pon tu producto en una escena bonita y real.", img: `${BASE}/simulacao.jpg`, badge: "Más usado" },
    { id: "catalogo",      name: "Con modelo",          title: "Ropa vestida por IA",       desc: "Modelo virtual usa tu prenda sin necesitar fotógrafo.", img: `${BASE}/modelo_opt1.jpg` },
    { id: "video",         name: "Video animado",       title: "Foto que se mueve",         desc: "Transforma tu foto en un video listo para Reels.", img: "", badge: "PRO" },
    { id: "video_narrado", name: "Video narrado",       title: "Foto + narración",          desc: "Tu foto se convierte en video con narración de IA. Escribe el guión, la IA lo lee.", img: "", badge: "PRO" },
    { id: "video_longo",   name: "Video largo",         title: "Video de ~32 segundos",     desc: "IA genera 4 escenas distintas y las une. Tarda 20-40 min. Solo PRO.", img: "", badge: "PRO" },
    { id: "produto_exposto", name: "Expositor premium", title: "Display de loja premium",  desc: "IA coloca seu produto em manequim, busto, bancada ou pedestal. Sem digitar nada — IA lê a foto.", img: `${BASE}/simulacao.jpg`, badge: "PRO" },
    { id: "personalizado", name: "A mi manera",         title: "Tú eliges la escena",       desc: "Describe lo que quieres y la IA lo crea a tu manera.", img: `${BASE}/produto.jpg` },
  ];
  return [
    { id: "simulacao",     name: "Foto em cena",       title: "Produto em ambiente real",  desc: "Coloca seu produto numa cena bonita e real.", img: `${BASE}/simulacao.jpg`, badge: "Mais usado" },
    { id: "catalogo",      name: "Com modelo",          title: "Roupa vestida por IA",      desc: "Modelo virtual usa sua peça sem precisar de fotógrafo.", img: `${BASE}/modelo_opt1.jpg` },
    { id: "video",         name: "Vídeo animado",       title: "Foto que se mexe",          desc: "Transforma sua foto num vídeo pronto para Reels.", img: "", badge: "PRO" },
    { id: "video_narrado", name: "Vídeo com narração",  title: "Foto + voz narrada",        desc: "Sua foto vira vídeo com narração de IA. Você escreve o roteiro, a IA fala.", img: "", badge: "PRO" },
    { id: "video_longo",   name: "Vídeo longo",         title: "Vídeo de ~32 segundos",     desc: "IA gera 4 cenas diferentes e junta num vídeo só. Demora 20-40 min. Exclusivo PRO.", img: "", badge: "PRO" },
    { id: "produto_exposto", name: "Expositor premium", title: "Display de loja premium",  desc: "IA coloca seu produto em manequim, busto, bancada ou pedestal. Sem digitar nada — IA lê a foto.", img: `${BASE}/simulacao.jpg`, badge: "PRO" },
    { id: "personalizado", name: "Do meu jeito",        title: "Você escolhe a cena",       desc: "Descreva o que quer e a IA cria do seu jeito.", img: `${BASE}/produto.jpg` },
  ];
}

function VideoCard({ name, title, desc, badge, onClick, btnLabel }: {
  name: string; title: string; desc: string; badge?: string; onClick: () => void; btnLabel?: string;
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
    const handler = () => advance();
    el.addEventListener("ended", handler);
    return () => el.removeEventListener("ended", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot]);

  return (
    <ModeCard
      name={name} title={title} desc={desc} badge={badge}
      onClick={onClick} btnLabel={btnLabel}
      media={
        <>
          <video ref={refA} src={VIDEO_URLS[idxA]}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: activeSlot === "A" ? 1 : 0, transition: "opacity 0.7s ease" }}
            autoPlay muted playsInline preload="metadata" />
          <video ref={refB} src={VIDEO_URLS[idxB]}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: activeSlot === "B" ? 1 : 0, transition: "opacity 0.7s ease" }}
            muted playsInline preload="none" />
        </>
      }
    />
  );
}

function ModeCard({ name, title, desc, badge, onClick, media, img, btnLabel }: {
  name: string; title: string; desc: string; badge?: string;
  onClick: () => void; media?: React.ReactNode; img?: string; btnLabel?: string;
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
          {btnLabel ?? "Usar agora"}
        </button>
      </div>
    </div>
  );
}

export default function ModeSelector({ onChange }: Props) {
  const { lang } = useI18n();
  const [tab, setTab] = useState<"foto" | "video">("foto");
  const ALL_MODES = getModes(lang);
  const activeIds = tab === "foto" ? FOTO_MODES : VIDEO_MODES;
  const MODES = ALL_MODES.filter(m => activeIds.includes(m.id));

  const title = lang === "en" ? "What do you want to create?" : lang === "es" ? "¿Qué quieres crear?" : "O que você quer criar?";
  const subtitle = lang === "en" ? "Choose a mode to get started" : lang === "es" ? "Elige un modo para empezar" : "Escolha um modo para começar";

  const tabLabel = (t: "foto" | "video") => {
    if (t === "foto") return lang === "en" ? "📷 Photo" : "📷 Foto";
    return lang === "en" ? "🎬 Video" : "🎬 Vídeo";
  };

  return (
    <div className="mode-selector">
      <style>{`
        .mode-selector .mode-title {
          font-size: 16px;
          font-weight: 800;
          color: #eef2f9;
          letter-spacing: -0.01em;
          margin-top: 0;
          margin-bottom: 14px;
        }
        .mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding-bottom: 88px;
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
          }
          .mode-selector .mode-subtitle {
            display: block !important;
          }
          .mode-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            padding-bottom: 0;
          }
          .mode-card-img-wrap {
            aspect-ratio: 4 / 3;
          }
          .mode-card-desc { display: block; }
        }
      `}</style>

      <div className="mode-title">{title}</div>
      <div
        style={{ fontSize: 14, color: "#8394b0", marginBottom: 16, display: "none" }}
        className="mode-subtitle"
      >
        {subtitle}
      </div>

      {/* Abas Foto / Vídeo */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 20,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 12, padding: 4,
      }}>
        {(["foto", "video"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "10px 0",
              borderRadius: 9, border: "none",
              background: tab === t
                ? "linear-gradient(135deg, #6366f1, #a855f7)"
                : "transparent",
              color: tab === t ? "#fff" : "#8394b0",
              fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12 }} className="mode-grid">
        {MODES.map((mode) => {
          const btnLabel = lang === "en" ? "Use now" : lang === "es" ? "Usar ahora" : "Usar agora";
          if (mode.id === "video") {
            return (
              <VideoCard
                key="video"
                name={mode.name}
                title={mode.title}
                desc={mode.desc}
                badge={mode.badge}
                onClick={() => onChange("video")}
                btnLabel={btnLabel}
              />
            );
          }
          if (mode.id === "video_narrado") {
            return (
              <ModeCard
                key="video_narrado"
                name={mode.name}
                title={mode.title}
                desc={mode.desc}
                badge={mode.badge}
                media={
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(135deg, #1a0533 0%, #0f1a2e 50%, #07080b 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ fontSize: 44, lineHeight: 1 }}>🎙️</div>
                    <div style={{ fontSize: 11, color: "rgba(196,181,253,0.7)", fontWeight: 600, letterSpacing: "0.06em" }}>
                      FOTO + VOZ
                    </div>
                    {/* Animação de ondas sonoras */}
                    <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                      {[4, 8, 12, 8, 6, 10, 7, 5].map((h, i) => (
                        <div key={i} style={{
                          width: 3, height: h, background: "#a855f7",
                          borderRadius: 2, opacity: 0.7,
                          animation: `pulse 1.2s ease-in-out infinite`,
                          animationDelay: `${i * 0.12}s`,
                        }} />
                      ))}
                    </div>
                  </div>
                }
                onClick={() => onChange("video_narrado")}
                btnLabel={btnLabel}
              />
            );
          }
          if (mode.id === "video_longo") {
            return (
              <ModeCard
                key="video_longo"
                name={mode.name}
                title={mode.title}
                desc={mode.desc}
                badge={mode.badge}
                media={
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(135deg, #0a1628 0%, #1a0a2e 50%, #07080b 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 6,
                  }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["🏙️", "🌿", "🛋️", "🌅"].map((emoji, i) => (
                        <div key={i} style={{
                          fontSize: 20, lineHeight: 1,
                          animation: "pulse 1.8s ease-in-out infinite",
                          animationDelay: `${i * 0.35}s`,
                        }}>{emoji}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(196,181,253,0.7)", fontWeight: 600, letterSpacing: "0.06em", marginTop: 4 }}>
                      4 CENAS · ~32 SEGUNDOS
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                      {[6, 10, 14, 10, 8, 12, 9, 7, 11, 6].map((h, i) => (
                        <div key={i} style={{
                          width: 2.5, height: h, background: "linear-gradient(to top, #6366f1, #a855f7)",
                          borderRadius: 2, opacity: 0.8,
                          animation: "pulse 1.4s ease-in-out infinite",
                          animationDelay: `${i * 0.1}s`,
                        }} />
                      ))}
                    </div>
                  </div>
                }
                onClick={() => onChange("video_longo")}
                btnLabel={btnLabel}
              />
            );
          }
          return (
            <ModeCard
              key={mode.id}
              name={mode.name}
              title={mode.title}
              desc={mode.desc}
              badge={mode.badge}
              img={mode.img}
              onClick={() => onChange(mode.id)}
              btnLabel={btnLabel}
            />
          );
        })}
      </div>
    </div>
  );
}
