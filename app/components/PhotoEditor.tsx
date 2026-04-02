"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  imageUrl: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

type Tool = "text" | "logo" | "removebg" | null;

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: string;
  dragging: boolean;
}

interface ImageLayer {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dragging: boolean;
}

const PRESETS = [
  { label: "💰 Preço", text: "R$ 0,00", fontSize: 32, color: "#ffffff", fontWeight: "bold" },
  { label: "📞 Telefone", text: "(00) 00000-0000", fontSize: 22, color: "#ffffff", fontWeight: "normal" },
  { label: "🏷️ Desconto", text: "10% OFF", fontSize: 28, color: "#fbbf24", fontWeight: "bold" },
  { label: "✏️ Texto livre", text: "Seu texto aqui", fontSize: 20, color: "#ffffff", fontWeight: "normal" },
];

export default function PhotoEditor({ imageUrl, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [logos, setLogos] = useState<ImageLayer[]>([]);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 360, h: 360 });
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; type: "text" | "logo"; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Load background image and set canvas size
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = Math.min(360, window.innerWidth - 32);
      const ratio = img.height / img.width;
      const w = maxW;
      const h = Math.round(w * ratio);
      setCanvasSize({ w, h });
      bgImgRef.current = img;
    };
    img.src = bgRemovedUrl ?? imageUrl;
  }, [imageUrl, bgRemovedUrl]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImgRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;

    // Background
    if (bgRemoved && bgRemovedUrl) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Checkerboard for transparency
      const size = 12;
      for (let y = 0; y < canvas.height; y += size) {
        for (let x = 0; x < canvas.width; x += size) {
          ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? "#e5e5e5" : "#ffffff";
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);

    // Logo layers
    logos.forEach((logo) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, logo.x, logo.y, logo.width, logo.height);
        if (selectedId === logo.id) {
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(logo.x - 2, logo.y - 2, logo.width + 4, logo.height + 4);
          ctx.setLineDash([]);
        }
      };
      img.src = logo.src;
    });

    // Text layers
    texts.forEach((t) => {
      ctx.font = `${t.fontWeight} ${t.fontSize}px Outfit, sans-serif`;
      ctx.fillStyle = t.color;
      // Shadow
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      if (selectedId === t.id) {
        const metrics = ctx.measureText(t.text);
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(t.x - 4, t.y - t.fontSize - 4, metrics.width + 8, t.fontSize + 10);
        ctx.setLineDash([]);
      }
    });
  }, [texts, logos, canvasSize, selectedId, bgRemoved, bgRemovedUrl]);

  function addText(preset: typeof PRESETS[0]) {
    const id = `text_${Date.now()}`;
    setTexts((prev) => [...prev, {
      id,
      text: preset.text,
      x: canvasSize.w / 2 - 80,
      y: canvasSize.h / 2,
      fontSize: preset.fontSize,
      color: preset.color,
      fontWeight: preset.fontWeight,
      dragging: false,
    }]);
    setSelectedId(id);
    setTool(null);
  }

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check text hits (bottom-up)
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      ctx.font = `${t.fontWeight} ${t.fontSize}px Outfit, sans-serif`;
      const w = ctx.measureText(t.text).width;
      if (x >= t.x - 4 && x <= t.x + w + 4 && y >= t.y - t.fontSize - 4 && y <= t.y + 10) {
        setSelectedId(t.id);
        dragRef.current = { id: t.id, type: "text", startX: x, startY: y, origX: t.x, origY: t.y };
        return;
      }
    }

    // Check logo hits
    for (let i = logos.length - 1; i >= 0; i--) {
      const l = logos[i];
      if (x >= l.x && x <= l.x + l.width && y >= l.y && y <= l.y + l.height) {
        setSelectedId(l.id);
        dragRef.current = { id: l.id, type: "logo", startX: x, startY: y, origX: l.x, origY: l.y };
        return;
      }
    }

    setSelectedId(null);
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - dragRef.current.startX;
    const dy = y - dragRef.current.startY;

    if (dragRef.current.type === "text") {
      setTexts((prev) => prev.map((t) =>
        t.id === dragRef.current!.id
          ? { ...t, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }
          : t
      ));
    } else {
      setLogos((prev) => prev.map((l) =>
        l.id === dragRef.current!.id
          ? { ...l, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }
          : l
      ));
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const id = `logo_${Date.now()}`;
      setLogos((prev) => [...prev, {
        id, src,
        x: canvasSize.w / 2 - 60,
        y: canvasSize.h / 2 - 60,
        width: 120, height: 120,
        dragging: false,
      }]);
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
    setTool(null);
  }

  async function handleRemoveBg() {
    setRemovingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(imageUrl);
      const url = URL.createObjectURL(blob);
      setBgRemovedUrl(url);
      setBgRemoved(true);

      const img = new Image();
      img.onload = () => { bgImgRef.current = img; };
      img.src = url;
    } catch {
      alert("Não foi possível remover o fundo. Tente novamente.");
    } finally {
      setRemovingBg(false);
      setTool(null);
    }
  }

  function deleteSelected() {
    if (!selectedId) return;
    setTexts((prev) => prev.filter((t) => t.id !== selectedId));
    setLogos((prev) => prev.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  const selectedText = texts.find((t) => t.id === selectedId);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
          <span style={s.headerTitle}>Editar foto</span>
          <button onClick={handleSave} style={s.saveBtn}>⬇ Salvar</button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} style={{ ...s.canvasWrap, width: canvasSize.w, height: canvasSize.h }}>
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ display: "block", borderRadius: 12, touchAction: "none" }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={() => { dragRef.current = null; }}
          />
        </div>

        {/* Selected text editor */}
        {selectedText && editingText === null && (
          <div style={s.textEditor}>
            <input
              style={s.textInput}
              value={selectedText.text}
              onChange={(e) => setTexts((prev) => prev.map((t) => t.id === selectedText.id ? { ...t, text: e.target.value } : t))}
              placeholder="Digite o texto..."
            />
            <div style={s.textControls}>
              <input
                type="range" min="12" max="72" value={selectedText.fontSize}
                onChange={(e) => setTexts((prev) => prev.map((t) => t.id === selectedText.id ? { ...t, fontSize: Number(e.target.value) } : t))}
                style={{ flex: 1 }}
              />
              <input
                type="color" value={selectedText.color}
                onChange={(e) => setTexts((prev) => prev.map((t) => t.id === selectedText.id ? { ...t, color: e.target.value } : t))}
                style={s.colorPicker}
              />
              <button onClick={deleteSelected} style={s.deleteBtn}>🗑</button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={s.toolbar}>
          {/* Texto */}
          <button style={{ ...s.toolBtn, ...(tool === "text" ? s.toolBtnActive : {}) }} onClick={() => setTool(tool === "text" ? null : "text")}>
            <span style={s.toolIcon}>T</span>
            <span style={s.toolLabel}>Texto</span>
          </button>

          {/* Logo */}
          <button style={{ ...s.toolBtn, ...(tool === "logo" ? s.toolBtnActive : {}) }} onClick={() => logoFileRef.current?.click()}>
            <span style={s.toolIcon}>🖼</span>
            <span style={s.toolLabel}>Logo</span>
          </button>
          <input ref={logoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />

          {/* Remover fundo */}
          <button style={{ ...s.toolBtn, ...(bgRemoved ? s.toolBtnActive : {}) }} onClick={handleRemoveBg} disabled={removingBg}>
            <span style={s.toolIcon}>{removingBg ? "⏳" : "✂️"}</span>
            <span style={s.toolLabel}>{removingBg ? "..." : "Fundo"}</span>
          </button>

          {/* Apagar selecionado */}
          {selectedId && (
            <button style={{ ...s.toolBtn, borderColor: "rgba(239,68,68,0.4)" }} onClick={deleteSelected}>
              <span style={s.toolIcon}>🗑</span>
              <span style={s.toolLabel}>Apagar</span>
            </button>
          )}
        </div>

        {/* Text presets dropdown */}
        {tool === "text" && (
          <div style={s.presets}>
            {PRESETS.map((p) => (
              <button key={p.label} style={s.presetBtn} onClick={() => addText(p)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 200,
  },
  modal: {
    background: "#07080b", width: "100%", maxWidth: 560,
    borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom, 16px)",
    display: "flex", flexDirection: "column", alignItems: "center",
    maxHeight: "95vh", overflowY: "auto",
  },
  header: {
    width: "100%", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  headerTitle: { fontSize: 15, fontWeight: 700, color: "#eef2f9" },
  closeBtn: {
    background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8,
    color: "#8394b0", width: 32, height: 32, cursor: "pointer", fontSize: 14,
  },
  saveBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none",
    borderRadius: 10, padding: "7px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  canvasWrap: {
    margin: "12px auto",
    borderRadius: 12, overflow: "hidden",
    cursor: "crosshair",
  },
  textEditor: {
    width: "calc(100% - 32px)", padding: "10px 16px",
    background: "#111820", borderRadius: 12, marginBottom: 8,
    display: "flex", flexDirection: "column", gap: 8,
  },
  textInput: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 12px", color: "#eef2f9", fontSize: 14, outline: "none",
  },
  textControls: { display: "flex", alignItems: "center", gap: 10 },
  colorPicker: { width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer", padding: 2, background: "transparent" },
  deleteBtn: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8, color: "#f87171", cursor: "pointer", padding: "4px 10px",
  },
  toolbar: {
    display: "flex", gap: 10, padding: "10px 16px 4px",
    width: "100%", overflowX: "auto",
  },
  toolBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "#111820", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "10px 18px", cursor: "pointer", flexShrink: 0,
  },
  toolBtnActive: {
    borderColor: "#a855f7", background: "rgba(168,85,247,0.1)",
  },
  toolIcon: { fontSize: 20 },
  toolLabel: { fontSize: 11, color: "#8394b0", fontWeight: 600 },
  presets: {
    display: "flex", gap: 8, padding: "0 16px 12px",
    width: "100%", overflowX: "auto",
  },
  presetBtn: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20, padding: "7px 14px", color: "#eef2f9",
    fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
  },
};
