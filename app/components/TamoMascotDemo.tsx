"use client"

import React, { useState } from "react"
import TamoMascot, { TamoState } from "./TamoMascot"

const STATES: { state: TamoState; label: string; description: string }[] = [
  {
    state: "idle",
    label: "Oi! Sou o Tamo 👋",
    description: "Relaxado · respiração suave · cauda balançando devagar",
  },
  {
    state: "receiving",
    label: "Recebi sua foto!",
    description: "Bounce · língua para fora · bochechas rosadas · cauda agitada",
  },
  {
    state: "processing",
    label: "Tô criando agora...",
    description: "Shimmer de cores · pupilas girando em sentidos opostos · cauda rápida",
  },
  {
    state: "done",
    label: "Ficou incrível! ✨",
    description: "Jump · braços erguidos · estrelinhas animadas · cauda comemorando",
  },
  {
    state: "error",
    label: "Poxa, deu ruim...",
    description: "Shake horizontal · cores dessaturadas · X nos olhos · cauda caída",
  },
]

export default function TamoMascotDemo() {
  const [activeState, setActiveState] = useState<TamoState | null>(null)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07080b",
        fontFamily: "'Outfit', sans-serif",
        color: "#eef2f9",
        padding: "40px 24px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}
        >
          Tamo — Demo de Animações
        </h1>
        <p style={{ color: "#8394b0", marginTop: 8, fontSize: 15 }}>
          Mascote camaleão · 5 estados · PNG transparente + CSS keyframes
        </p>
      </div>

      {/* Grid de estados */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
          maxWidth: 1100,
          margin: "0 auto 48px",
        }}
      >
        {STATES.map(({ state, label, description }) => (
          <div
            key={state}
            onClick={() => setActiveState(activeState === state ? null : state)}
            style={{
              background: "#111820",
              border: `1.5px solid ${activeState === state ? "#7c3aed" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 18,
              padding: "28px 20px 22px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              cursor: "pointer",
              transition: "border-color 0.2s, transform 0.15s",
              transform: activeState === state ? "scale(1.02)" : "scale(1)",
            }}
          >
            <TamoMascot
              state={state}
              size={140}
              label={label}
              resultImage={state === "done" ? "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80" : undefined}
            />

            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  background: "rgba(124,58,237,0.15)",
                  color: "#a855f7",
                  borderRadius: 20,
                  padding: "3px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                {state}
              </span>
              <p
                style={{
                  color: "#8394b0",
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tamanhos diferentes */}
      <div
        style={{
          background: "#111820",
          border: "1.5px solid rgba(255,255,255,0.07)",
          borderRadius: 22,
          padding: "32px 24px",
          maxWidth: 1100,
          margin: "0 auto 40px",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 24px", color: "#8394b0" }}>
          Tamanhos disponíveis (prop <code style={{ color: "#a855f7" }}>size</code>)
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          {[48, 72, 100, 140, 180].map((sz) => (
            <div key={sz} style={{ textAlign: "center" }}>
              <TamoMascot state="idle" size={sz} />
              <p style={{ color: "#4e5c72", fontSize: 11, marginTop: 6 }}>{sz}px</p>
            </div>
          ))}
        </div>
      </div>

      {/* Instrução de integração */}
      <div
        style={{
          background: "#111820",
          border: "1.5px solid rgba(255,255,255,0.07)",
          borderRadius: 22,
          padding: "28px 24px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px", color: "#8394b0" }}>
          Como usar
        </h2>
        <pre
          style={{
            background: "#07080b",
            borderRadius: 12,
            padding: "16px 20px",
            fontSize: 13,
            color: "#a855f7",
            overflowX: "auto",
            margin: 0,
            lineHeight: 1.7,
          }}
        >
{`import TamoMascot from "@/app/components/TamoMascot"

// Básico
<TamoMascot state="idle" />

// Com tamanho e legenda
<TamoMascot state="processing" size={140} label="Tô criando agora..." />

// Controlado por estado da sua lógica
const [jobState, setJobState] = useState<TamoState>("idle")
<TamoMascot state={jobState} size={120} label={labels[jobState]} />

// Quando tiver as imagens reais — trocar o SVG por:
// <img src={imagesByState[state]} alt="Tamo" width={size} height={size} />`}
        </pre>
      </div>
    </div>
  )
}
