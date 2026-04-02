"use client";

export type CreationMode = "simulacao" | "fundo_branco" | "catalogo" | "personalizado";

interface Props {
  selected: CreationMode;
  onChange: (mode: CreationMode) => void;
  isPro: boolean;
}

const MODES = [
  {
    id: "simulacao" as CreationMode,
    icon: "👗",
    label: "Simulação de uso",
    desc: "Produto em contexto real",
    pro: false,
  },
  {
    id: "fundo_branco" as CreationMode,
    icon: "⬜",
    label: "Fundo branco",
    desc: "Ideal para e-commerce",
    pro: false,
  },
  {
    id: "catalogo" as CreationMode,
    icon: "🧍",
    label: "Catálogo",
    desc: "Modelo humano com IA",
    pro: true,
  },
  {
    id: "personalizado" as CreationMode,
    icon: "✏️",
    label: "Personalizado",
    desc: "Você no controle",
    pro: true,
  },
];

export default function ModeSelector({ selected, onChange, isPro }: Props) {
  return (
    <div style={s.wrap}>
      {MODES.map((mode) => {
        const locked = mode.pro && !isPro;
        const active = selected === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => !locked && onChange(mode.id)}
            style={{
              ...s.btn,
              ...(active ? s.btnActive : {}),
              ...(locked ? s.btnLocked : {}),
            }}
          >
            <span style={s.icon}>{mode.icon}</span>
            <div style={s.textWrap}>
              <div style={s.label}>
                {mode.label}
                {locked && <span style={s.proBadge}>Pro</span>}
              </div>
              <div style={s.desc}>{mode.desc}</div>
            </div>
            {active && <span style={s.check}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 16,
  },
  btn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#111820",
    border: "1.5px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "border-color 0.15s",
  },
  btnActive: {
    borderColor: "#a855f7",
    background: "rgba(168,85,247,0.08)",
  },
  btnLocked: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  icon: { fontSize: 22, flexShrink: 0 },
  textWrap: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#eef2f9",
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  desc: {
    fontSize: 11,
    color: "#4e5c72",
    marginTop: 2,
  },
  proBadge: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 6,
    padding: "1px 6px",
    fontSize: 9,
    fontWeight: 800,
    color: "#fff",
  },
  check: {
    color: "#a855f7",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
};
