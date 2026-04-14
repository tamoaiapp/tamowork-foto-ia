"use client"

import React from "react"

export type TamoState = "idle" | "receiving" | "processing" | "done" | "error"

interface TamoMascotProps {
  state?: TamoState
  size?: number
  label?: string
}

const KEYFRAMES = `
@keyframes tamo-breathe {
  0%, 100% { transform: scale(1) translateY(0); }
  50%       { transform: scale(1.03) translateY(-2px); }
}

@keyframes tamo-tail-idle {
  0%, 100% { transform: rotate(0deg); transform-origin: 80% 60%; }
  50%       { transform: rotate(6deg); transform-origin: 80% 60%; }
}

@keyframes tamo-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  30%       { transform: translateY(-10px) scale(1.04, 0.96); }
  60%       { transform: translateY(-4px) scale(0.97, 1.03); }
  80%       { transform: translateY(-7px) scale(1.02, 0.98); }
}

@keyframes tamo-eye-spin {
  0%   { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes tamo-tail-agitated {
  0%, 100% { transform: rotate(-8deg); transform-origin: 80% 60%; }
  50%       { transform: rotate(10deg); transform-origin: 80% 60%; }
}

@keyframes tamo-shimmer {
  0%   { filter: hue-rotate(0deg) brightness(1); }
  50%  { filter: hue-rotate(30deg) brightness(1.15); }
  100% { filter: hue-rotate(0deg) brightness(1); }
}

@keyframes tamo-jump {
  0%   { transform: translateY(0) scale(1); }
  20%  { transform: translateY(-20px) scale(1.05, 0.95); }
  40%  { transform: translateY(-30px) scale(0.95, 1.05); }
  60%  { transform: translateY(-18px) scale(1.03, 0.97); }
  80%  { transform: translateY(-6px) scale(0.98, 1.02); }
  100% { transform: translateY(0) scale(1); }
}

@keyframes tamo-star {
  0%   { opacity: 0; transform: scale(0) rotate(0deg); }
  30%  { opacity: 1; transform: scale(1.2) rotate(20deg); }
  70%  { opacity: 1; transform: scale(1) rotate(-10deg); }
  100% { opacity: 0; transform: scale(0) rotate(30deg); }
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

@keyframes tamo-tail-droop {
  0%, 100% { transform: rotate(5deg); transform-origin: 80% 60%; }
  50%       { transform: rotate(0deg); transform-origin: 80% 60%; }
}

@keyframes tamo-pupil-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes tamo-label-fade {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
}
`

function ChameleonSVG({
  size,
  state,
}: {
  size: number
  state: TamoState
}) {
  const isError = state === "error"
  const isProcessing = state === "processing"
  const isDone = state === "done"

  // Cores base — dessaturadas no estado error
  const bodyColor = isError ? "#6b6b8a" : "#7c3aed"
  const bodyLight = isError ? "#7a7a9a" : "#a855f7"
  const bodyDark  = isError ? "#4a4a6a" : "#5b21b6"
  const accentColor = isError ? "#5a7a6a" : "#16c784"
  const eyeWhite  = isError ? "#b0b0c0" : "#ffffff"
  const scaleId   = `tamo-scale-${state}`

  // Animações de estado para a cauda
  const tailAnim = {
    idle:       "tamo-tail-idle 3s ease-in-out infinite",
    receiving:  "tamo-tail-agitated 0.6s ease-in-out infinite",
    processing: "tamo-tail-agitated 0.4s ease-in-out infinite",
    done:       "tamo-tail-agitated 0.5s ease-in-out infinite",
    error:      "tamo-tail-droop 4s ease-in-out infinite",
  }[state]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`${scaleId}-body`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={bodyLight} />
          <stop offset="60%" stopColor={bodyColor} />
          <stop offset="100%" stopColor={bodyDark} />
        </radialGradient>

        <radialGradient id={`${scaleId}-head`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor={bodyLight} />
          <stop offset="100%" stopColor={bodyColor} />
        </radialGradient>

        <radialGradient id={`${scaleId}-eye`} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor={eyeWhite} />
          <stop offset="100%" stopColor={isError ? "#c0c0d0" : "#e0f2fe"} />
        </radialGradient>

        <filter id={`${scaleId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Cauda em espiral ── */}
      <g style={{ animation: tailAnim }}>
        <path
          d="M 148 115 C 165 110, 178 98, 182 83 C 186 68, 178 52, 165 50 C 152 48, 142 58, 144 70 C 146 80, 156 84, 162 78"
          stroke={bodyDark}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 148 115 C 165 110, 178 98, 182 83 C 186 68, 178 52, 165 50 C 152 48, 142 58, 144 70 C 146 80, 156 84, 162 78"
          stroke={bodyColor}
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        {/* escamas da cauda */}
        <path
          d="M 163 95 C 168 90, 173 85, 173 80"
          stroke={bodyLight}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M 170 78 C 173 73, 173 67, 170 63"
          stroke={bodyLight}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </g>

      {/* ── Corpo oval ── */}
      <ellipse
        cx="100"
        cy="120"
        rx="52"
        ry="36"
        fill={`url(#${scaleId}-body)`}
      />

      {/* Detalhes do corpo — padrão de escamas */}
      <path
        d="M 65 115 Q 80 108, 100 112 Q 120 116, 135 112"
        stroke={bodyLight}
        strokeWidth="2"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M 60 124 Q 78 118, 100 121 Q 122 124, 140 120"
        stroke={bodyLight}
        strokeWidth="2"
        fill="none"
        opacity="0.3"
      />

      {/* Barriga mais clara */}
      <ellipse
        cx="100"
        cy="126"
        rx="32"
        ry="18"
        fill={bodyLight}
        opacity="0.18"
      />

      {/* ── Patas dianteiras ── */}
      {/* esquerda frente */}
      <path
        d="M 72 138 Q 65 148, 60 155"
        stroke={bodyDark}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 72 138 Q 65 148, 60 155"
        stroke={bodyColor}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* garras esq frente */}
      <path d="M 60 155 Q 56 159, 54 162" stroke={bodyDark} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 60 155 Q 58 160, 57 164" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 60 155 Q 63 160, 63 164" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* direita frente */}
      <path
        d="M 128 138 Q 135 148, 140 155"
        stroke={bodyDark}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 128 138 Q 135 148, 140 155"
        stroke={bodyColor}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* garras dir frente */}
      <path d="M 140 155 Q 144 159, 146 162" stroke={bodyDark} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 140 155 Q 142 160, 143 164" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 140 155 Q 137 160, 137 164" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* ── Patas traseiras ── */}
      <path d="M 80 148 Q 76 160, 74 168" stroke={bodyDark} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M 80 148 Q 76 160, 74 168" stroke={bodyColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M 74 168 Q 70 172, 68 175" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 74 168 Q 73 173, 73 177" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 74 168 Q 77 173, 78 177" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />

      <path d="M 120 148 Q 124 160, 126 168" stroke={bodyDark} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M 120 148 Q 124 160, 126 168" stroke={bodyColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M 126 168 Q 130 172, 132 175" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 126 168 Q 127 173, 127 177" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 126 168 Q 123 173, 122 177" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* ── Pescoço ── */}
      <path
        d="M 80 100 Q 75 88, 78 80"
        stroke={bodyDark}
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 80 100 Q 75 88, 78 80"
        stroke={`url(#${scaleId}-head)`}
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Cabeça ── */}
      <ellipse
        cx="75"
        cy="72"
        rx="30"
        ry="24"
        fill={`url(#${scaleId}-head)`}
      />

      {/* Focinho levemente projetado */}
      <path
        d="M 45 72 Q 36 68, 34 72 Q 36 76, 45 74 Z"
        fill={bodyColor}
      />
      <path
        d="M 34 72 Q 32 70, 31 72 Q 32 74, 34 72 Z"
        fill={bodyDark}
      />

      {/* ── Crista ── */}
      <path
        d="M 68 48 Q 72 40, 76 44 Q 80 36, 84 41 Q 88 34, 90 40 Q 94 33, 96 40 Q 98 36, 99 42 Q 100 45, 96 48"
        fill={bodyDark}
        opacity="0.8"
      />
      <path
        d="M 68 48 Q 72 42, 76 46 Q 80 38, 84 43 Q 88 36, 90 42 Q 94 35, 96 42 Q 98 38, 99 44 Q 100 47, 96 50"
        fill={bodyColor}
        opacity="0.9"
      />

      {/* ── Olho grande (principal característica) ── */}
      {/* Anel externo */}
      <circle cx="82" cy="68" r="18" fill={bodyDark} />
      {/* Esclera */}
      <circle cx="82" cy="68" r="15" fill={`url(#${scaleId}-eye)`} />
      {/* Íris */}
      <circle cx="82" cy="68" r="9" fill={accentColor} opacity="0.9" />
      {/* Pupila — gira no estado processing */}
      <g
        style={
          isProcessing
            ? {
                transformOrigin: "82px 68px",
                animation: "tamo-pupil-spin 1.2s linear infinite",
              }
            : undefined
        }
      >
        <ellipse cx="82" cy="68" rx="5" ry="7" fill="#0f172a" />
        {/* reflexo de luz */}
        <circle cx="85" cy="64" r="2.5" fill="white" opacity="0.9" />
        <circle cx="79" cy="71" r="1.2" fill="white" opacity="0.5" />
      </g>
      {/* anel accent do olho */}
      <circle cx="82" cy="68" r="15" fill="none" stroke={accentColor} strokeWidth="1.5" opacity="0.4" />

      {/* Segundo olho menor (câmara do camaleão — olhos independentes) */}
      <circle cx="96" cy="58" r="10" fill={bodyDark} />
      <circle cx="96" cy="58" r="8.5" fill={`url(#${scaleId}-eye)`} />
      <circle cx="96" cy="58" r="5" fill={accentColor} opacity="0.85" />
      <g
        style={
          isProcessing
            ? {
                transformOrigin: "96px 58px",
                animation: "tamo-pupil-spin 0.9s linear infinite reverse",
              }
            : undefined
        }
      >
        <ellipse cx="96" cy="58" rx="3" ry="4" fill="#0f172a" />
        <circle cx="98" cy="55" r="1.5" fill="white" opacity="0.9" />
      </g>
      <circle cx="96" cy="58" r="8.5" fill="none" stroke={accentColor} strokeWidth="1.2" opacity="0.35" />

      {/* ── Língua (visível no estado receiving/done) ── */}
      {(state === "receiving" || state === "done") && (
        <>
          <path
            d="M 34 72 Q 22 72, 18 68"
            stroke={isError ? "#888" : "#ec4899"}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="18" cy="68" r="3" fill={isError ? "#888" : "#ec4899"} />
        </>
      )}

      {/* ── Bochechas (receiving/done — animado) ── */}
      {(state === "receiving" || state === "done") && (
        <>
          <circle cx="54" cy="76" r="7" fill="#f472b6" opacity="0.3" />
          <circle cx="97" cy="70" r="5" fill="#f472b6" opacity="0.25" />
        </>
      )}

      {/* ── Sorriso / expressão ── */}
      {state !== "error" && (
        <path
          d="M 38 76 Q 41 80, 45 78"
          stroke={bodyDark}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      )}
      {state === "error" && (
        <path
          d="M 38 80 Q 41 76, 45 78"
          stroke={bodyDark}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      )}

      {/* ── Estrelinhas (estado done) ── */}
      {isDone && (
        <>
          {[
            { cx: 28, cy: 50, delay: "0s",    size: 10 },
            { cx: 165, cy: 42, delay: "0.2s",  size: 8  },
            { cx: 155, cy: 70, delay: "0.4s",  size: 6  },
            { cx: 20,  cy: 90, delay: "0.15s", size: 7  },
            { cx: 50,  cy: 28, delay: "0.35s", size: 9  },
          ].map((star, i) => (
            <g
              key={i}
              style={{
                animation: `tamo-star 1.4s ease-in-out ${star.delay} infinite`,
                transformOrigin: `${star.cx}px ${star.cy}px`,
              }}
            >
              {/* estrela de 4 pontas simples */}
              <path
                d={`M ${star.cx} ${star.cy - star.size / 2} L ${star.cx + star.size * 0.15} ${star.cy - star.size * 0.15} L ${star.cx + star.size / 2} ${star.cy} L ${star.cx + star.size * 0.15} ${star.cy + star.size * 0.15} L ${star.cx} ${star.cy + star.size / 2} L ${star.cx - star.size * 0.15} ${star.cy + star.size * 0.15} L ${star.cx - star.size / 2} ${star.cy} L ${star.cx - star.size * 0.15} ${star.cy - star.size * 0.15} Z`}
                fill="#fbbf24"
              />
            </g>
          ))}
        </>
      )}

      {/* ── Braços levantados (estado done) ── */}
      {isDone && (
        <>
          <path
            d="M 68 105 Q 50 88, 42 75"
            stroke={bodyDark}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 68 105 Q 50 88, 42 75"
            stroke={bodyColor}
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M 42 75 Q 38 70, 36 67" stroke={bodyDark} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 42 75 Q 40 69, 39 66" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M 42 75 Q 45 70, 46 67" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />

          <path
            d="M 132 105 Q 150 88, 158 75"
            stroke={bodyDark}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 132 105 Q 150 88, 158 75"
            stroke={bodyColor}
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M 158 75 Q 162 70, 164 67" stroke={bodyDark} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 158 75 Q 160 69, 161 66" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M 158 75 Q 155 70, 154 67" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* ── Sinal de error (X nos olhos) ── */}
      {isError && (
        <>
          <line x1="77" y1="63" x2="87" y2="73" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="87" y1="63" x2="77" y2="73" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

// ── Wrapper com animação de estado ─────────────────────────────────────────
const stateWrapper: Record<TamoState, React.CSSProperties> = {
  idle: {
    animation: "tamo-breathe 3s cubic-bezier(0.45, 0, 0.55, 1) infinite",
  },
  receiving: {
    animation: "tamo-bounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) infinite",
  },
  processing: {
    animation: "tamo-shimmer 1.5s ease-in-out infinite",
  },
  done: {
    animation: "tamo-jump 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) infinite",
  },
  error: {
    animation: "tamo-shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) 0s 3",
    filter: "saturate(0.3)",
  },
}

const labelColor: Record<TamoState, string> = {
  idle:       "#8394b0",
  receiving:  "#a855f7",
  processing: "#6366f1",
  done:       "#16c784",
  error:      "#ef4444",
}

export default function TamoMascot({
  state = "idle",
  size = 120,
  label,
}: TamoMascotProps) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...stateWrapper[state],
          }}
        >
          <ChameleonSVG size={size} state={state} />
        </div>

        {label && (
          <span
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: Math.max(11, size * 0.11),
              fontWeight: 500,
              color: labelColor[state],
              animation: "tamo-label-fade 2s ease-in-out infinite",
              letterSpacing: "0.01em",
              textAlign: "center",
              maxWidth: size * 1.8,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </>
  )
}
