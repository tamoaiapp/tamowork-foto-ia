"use client";

import { useRef, useState } from "react";

interface Props {
  onSubmit: (file: File, produto: string, cenario: string) => void;
  onSkip: () => void;
}

const CENARIOS = [
  "Mesa de madeira, luz natural",
  "Fundo neutro cinza, estúdio",
  "Ambiente moderno minimalista",
  "Varanda com plantas, luz do dia",
  "Cozinha clean, bancada branca",
];

export default function OnboardingScreen({ onSubmit, onSkip }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [produto, setProduto] = useState("");
  const [cenario, setCenario] = useState("");
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleSubmit() {
    if (!file) { setError("Envie a foto do produto"); return; }
    if (!produto.trim()) { setError("Escreva o nome do produto"); return; }
    if (!cenario.trim()) { setError("Descreva ou escolha um cenário"); return; }
    setError("");
    onSubmit(file, produto.trim(), cenario.trim());
  }

  return (
    <div style={s.overlay}>
      <div style={s.sheet}>

        {/* Cabeçalho */}
        <div style={s.header}>
          <div style={s.logo}>TamoWork</div>
          <button onClick={onSkip} style={s.skipBtn}>Pular</button>
        </div>

        <div style={s.headline}>Crie sua primeira foto agora ✨</div>
        <p style={s.sub}>
          Envie a foto do produto, escreva o nome e escolha onde vai aparecer.
          A IA cuida do resto.
        </p>

        {/* Upload */}
        <div
          style={{ ...s.dropzone, ...(preview ? s.dropzonePreview : {}) }}
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {preview ? (
            <img src={preview} alt="produto" style={s.previewImg} />
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
              <div style={s.uploadText}>Foto do produto</div>
              <div style={s.uploadSub}>Clique ou arraste a imagem</div>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        </div>

        {/* Nome do produto */}
        <div style={s.fieldGroup}>
          <label style={s.label}>Nome do produto</label>
          <input
            style={s.input}
            placeholder="Ex: Tênis Nike branco, Caneca xícara, Bolsa de couro..."
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            maxLength={120}
          />
        </div>

        {/* Cenário */}
        <div style={s.fieldGroup}>
          <label style={s.label}>Onde vai aparecer?</label>
          <input
            style={s.input}
            placeholder="Ex: mesa de madeira com luz natural, fundo cinza neutro..."
            value={cenario}
            onChange={(e) => setCenario(e.target.value)}
            maxLength={200}
          />
          {/* Chips de sugestão */}
          <div style={s.chips}>
            {CENARIOS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCenario(c)}
                style={{
                  ...s.chip,
                  ...(cenario === c ? s.chipActive : {}),
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button onClick={handleSubmit} style={s.submitBtn}>
          ✨ Gerar foto com IA
        </button>

        <button onClick={onSkip} style={s.secondaryBtn}>
          Prefiro explorar por conta
        </button>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 400,
    background: "#07080b",
    overflowY: "auto",
    display: "flex", flexDirection: "column",
    animation: "fadeIn .25s ease",
  },
  sheet: {
    width: "100%", maxWidth: 520,
    margin: "0 auto",
    padding: "20px 20px 40px",
    display: "flex", flexDirection: "column", gap: 16,
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  logo: {
    fontSize: 20, fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  skipBtn: {
    background: "transparent", border: "none",
    color: "#4e5c72", fontSize: 14, cursor: "pointer", padding: "4px 8px",
  },
  headline: {
    fontSize: 22, fontWeight: 800, color: "#eef2f9", lineHeight: 1.3,
    marginTop: 4,
  },
  sub: {
    fontSize: 14, color: "#8394b0", lineHeight: 1.6, margin: 0,
  },
  dropzone: {
    background: "#111820",
    border: "2px dashed rgba(255,255,255,0.12)",
    borderRadius: 18, padding: "32px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    cursor: "pointer", gap: 6, minHeight: 140,
    transition: "border-color .15s",
  },
  dropzonePreview: {
    padding: 0, overflow: "hidden", minHeight: 200,
    border: "2px solid rgba(168,85,247,0.4)",
  },
  previewImg: {
    width: "100%", maxHeight: 260, objectFit: "contain",
    display: "block", background: "#111820",
  },
  uploadText: { color: "#eef2f9", fontSize: 14, fontWeight: 600 },
  uploadSub: { color: "#4e5c72", fontSize: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, color: "#8394b0", fontWeight: 600 },
  input: {
    background: "#111820", border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "12px 14px",
    color: "#eef2f9", fontSize: 14, outline: "none",
    width: "100%", boxSizing: "border-box" as const,
    fontFamily: "Outfit, sans-serif",
  },
  chips: {
    display: "flex", flexWrap: "wrap" as const, gap: 6,
  },
  chip: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20, padding: "6px 12px",
    color: "#8394b0", fontSize: 12, cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    transition: "all .15s",
  },
  chipActive: {
    background: "rgba(168,85,247,0.15)",
    border: "1px solid rgba(168,85,247,0.5)",
    color: "#c4b5fd",
  },
  error: {
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: 10, padding: "10px 14px",
    color: "#f87171", fontSize: 13,
  },
  submitBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14,
    padding: "16px", width: "100%",
    color: "#fff", fontSize: 16, fontWeight: 800,
    cursor: "pointer", letterSpacing: "-.2px",
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
    fontFamily: "Outfit, sans-serif",
    marginTop: 4,
  },
  secondaryBtn: {
    background: "transparent", border: "none",
    color: "#4e5c72", fontSize: 13, cursor: "pointer",
    padding: "8px", fontFamily: "Outfit, sans-serif",
    textAlign: "center" as const,
  },
};
