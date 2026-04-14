"use client"

import React, { useEffect, useRef, useState } from "react"

export type TamoState = "idle" | "receiving" | "processing" | "done" | "error"

interface TamoMascotProps {
  state?: TamoState
  size?: number
  label?: string
  /** URL da foto resultado — exibida dentro da moldura no estado "done" */
  resultImage?: string
}

// ── PNG por estado (512×512, fundo transparente, alinhados pela base) ────────
const STATE_IMAGES: Record<TamoState, string> = {
  idle:       "/tamo/idle.png",
  receiving:  "/tamo/receiving.png",
  processing: "/tamo/processing.png",
  done:       "/tamo/done_moldura.png",
  error:      "/tamo/error.png",
}

// ── Posição da abertura da moldura em done_moldura.png (512×512) ─────────────
// A moldura dourada é opaca; o buraco interno (onde estava o verde) é transparente.
// A foto é colocada ATRÁS do mascote, posicionada nessa área.
// Valores em fração do container renderizado (0..1)
const FRAME = { left: 0.27, top: 0.34, width: 0.59, height: 0.36 }

// ── Keyframes CSS ────────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes tamo-breathe {
  0%, 100% { transform: scale(1) translateY(0); }
  50%       { transform: scale(1.03) translateY(-2px); }
}
@keyframes tamo-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  30%       { transform: translateY(-10px) scale(1.04, 0.97); }
  60%       { transform: translateY(-4px) scale(0.97, 1.03); }
  80%       { transform: translateY(-7px) scale(1.02, 0.98); }
}
@keyframes tamo-pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.04); }
}
@keyframes tamo-jump {
  0%   { transform: translateY(0) scale(1); }
  20%  { transform: translateY(-16px) scale(1.04, 0.96); }
  40%  { transform: translateY(-24px) scale(0.97, 1.04); }
  60%  { transform: translateY(-12px) scale(1.02, 0.98); }
  80%  { transform: translateY(-4px) scale(0.99, 1.01); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes tamo-shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-6px); }
  30%       { transform: translateX(6px); }
  45%       { transform: translateX(-4px); }
  60%       { transform: translateX(4px); }
  75%       { transform: translateX(-2px); }
  90%       { transform: translateX(2px); }
}
@keyframes tamo-star {
  0%   { opacity: 0; transform: scale(0) rotate(0deg); }
  30%  { opacity: 1; transform: scale(1.2) rotate(20deg); }
  70%  { opacity: 1; transform: scale(1) rotate(-10deg); }
  100% { opacity: 0; transform: scale(0) rotate(30deg); }
}
@keyframes tamo-label-fade {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
}
`

// ── Animação de wrapper por estado ──────────────────────────────────────────
const STATE_ANIM: Record<TamoState, React.CSSProperties> = {
  idle:       { animation: "tamo-breathe 3s cubic-bezier(0.45,0,0.55,1) infinite" },
  receiving:  { animation: "tamo-bounce 0.75s cubic-bezier(0.34,1.56,0.64,1) infinite" },
  processing: { animation: "tamo-pulse 1.4s ease-in-out infinite" },
  done:       { animation: "tamo-jump 1s cubic-bezier(0.34,1.56,0.64,1) infinite" },
  error:      {
    animation: "tamo-shake 0.6s ease-in-out infinite",
    filter: "saturate(0.45) brightness(0.8)",
  },
}

const LABEL_COLOR: Record<TamoState, string> = {
  idle:       "#8394b0",
  receiving:  "#a855f7",
  processing: "#6366f1",
  done:       "#16c784",
  error:      "#ef4444",
}

// ── Estrelinhas (estado done) ────────────────────────────────────────────────
function DoneStars({ size }: { size: number }) {
  const stars = [
    { x: -0.25, y: -0.10, delay: "0s",    s: 0.09 },
    { x:  0.90, y:  0.10, delay: "0.2s",  s: 0.075 },
    { x:  0.85, y:  0.55, delay: "0.4s",  s: 0.06 },
    { x: -0.15, y:  0.60, delay: "0.15s", s: 0.07 },
    { x:  0.45, y: -0.20, delay: "0.3s",  s: 0.08 },
  ]
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 3 }}
      viewBox={`0 0 ${size} ${size}`}
    >
      {stars.map((st, i) => {
        const hs = st.s * size / 2
        const q  = hs * 0.3
        const cx = (st.x + 0.5) * size
        const cy = (st.y + 0.5) * size
        return (
          <path
            key={i}
            d={`M ${cx} ${cy - hs} L ${cx + q} ${cy - q} L ${cx + hs} ${cy} L ${cx + q} ${cy + q} L ${cx} ${cy + hs} L ${cx - q} ${cy + q} L ${cx - hs} ${cy} L ${cx - q} ${cy - q} Z`}
            fill="#fbbf24"
            style={{ animation: `tamo-star 1.4s ease-in-out ${st.delay} infinite`, transformOrigin: `${cx}px ${cy}px` }}
          />
        )
      })}
    </svg>
  )
}

// ── Extrai cor dominante da foto resultado ───────────────────────────────────
function useDominantColor(imageUrl?: string) {
  const [color, setColor] = useState<string | null>(null)
  useEffect(() => {
    if (!imageUrl) { setColor(null); return }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 16; canvas.height = 16
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(img, 0, 0, 16, 16)
        const d = ctx.getImageData(0, 0, 16, 16).data
        let r = 0, g = 0, b = 0
        const px = d.length / 4
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2] }
        setColor(`rgb(${Math.round(r/px)},${Math.round(g/px)},${Math.round(b/px)})`)
      } catch { setColor(null) }
    }
    img.src = imageUrl
  }, [imageUrl])
  return color
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function TamoMascot({
  state = "idle",
  size = 120,
  label,
  resultImage,
}: TamoMascotProps) {
  const dominantColor = useDominantColor(state === "done" ? resultImage : undefined)
  const isDone = state === "done"

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10, userSelect: "none" }}>

        {/* Container animado */}
        <div style={{ position: "relative", width: size, height: size, ...STATE_ANIM[state] }}>

          {/* Glow de fundo (cor dominante da foto no estado done, roxo nos outros) */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
            background: dominantColor
              ? `radial-gradient(circle at 50% 65%, ${dominantColor}55 0%, transparent 70%)`
              : `radial-gradient(circle at 50% 65%, #7c3aed33 0%, transparent 70%)`,
          }} />

          {/* Foto resultado — fica atrás do mascote, na área da moldura */}
          {isDone && resultImage && (
            <div style={{
              position: "absolute",
              left:   FRAME.left   * size,
              top:    FRAME.top    * size,
              width:  FRAME.width  * size,
              height: FRAME.height * size,
              overflow: "hidden",
              borderRadius: 2,
              zIndex: 1,
            }}>
              <img src={resultImage} alt="Resultado" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}

          {/* Mascote PNG transparente */}
          <img
            src={STATE_IMAGES[state]}
            alt={`Tamo ${state}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "bottom center",
              display: "block",
              zIndex: 2,
            }}
            draggable={false}
          />

          {/* Estrelinhas no done */}
          {isDone && <DoneStars size={size} />}
        </div>

        {label && (
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: Math.max(11, size * 0.11),
            fontWeight: 500,
            color: LABEL_COLOR[state],
            animation: "tamo-label-fade 2s ease-in-out infinite",
            letterSpacing: "0.01em",
            textAlign: "center",
            maxWidth: size * 1.8,
          }}>
            {label}
          </span>
        )}
      </div>
    </>
  )
}
