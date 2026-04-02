"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  imageUrl: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

type Tool = "text" | null;

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: string;
}

interface ImageLayer {
  id: string;
  src: string;
  type: "logo" | "foto";
  x: number;
  y: number;
  width: number;
  height: number;
  bgRemoved: boolean;
}

const PRESETS = [
  { label: "💰 Preço", text: "R$ 0,00", fontSize: 32, color: "#ffffff", fontWeight: "bold" },
  { label: "📞 Telefone", text: "(00) 00000-0000", fontSize: 22, color: "#ffffff", fontWeight: "normal" },
  { label: "🏷️ Desconto", text: "10% OFF", fontSize: 28, color: "#fbbf24", fontWeight: "bold" },
  { label: "✏️ Texto livre", text: "Seu texto aqui", fontSize: 20, color: "#ffffff", fontWeight: "normal" },
];

const LOGO_STORAGE_KEY = "tamowork_saved_logo";

export default function PhotoEditor({ imageUrl, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [images, setImages] = useState<ImageLayer[]>([]);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [removingLayerBg, setRemovingLayerBg] = useState(false);
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 360, h: 360 });
  const [savedLogo, setSavedLogo] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; type: "text" | "image"; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Load saved logo from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LOGO_STORAGE_KEY);
    if (saved) setSavedLogo(saved);
  }, []);

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = Math.min(360, window.innerWidth - 32);
      const ratio = img.height / img.width;
      setCanvasSize({ w: maxW, h: Math.round(maxW * ratio) });
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

    if (bgRemoved && bgRemovedUrl) {
      const size = 12;
      for (let y = 0; y < canvas.height; y += size) {
        for (let x = 0; x < canvas.width; x += size) {
          ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? "#e5e5e5" : "#ffffff";
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);

    // Image layers
    images.forEach((layer) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
        if (selectedId === layer.id) {
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(layer.x - 2, layer.y - 2, layer.width + 4, layer.height + 4);
          ctx.setLineDash([]);
        }
      };
      img.src = layer.src;
    });

    // Text layers
    texts.forEach((t) => {
      ctx.font = `${t.fontWeight} ${t.fontSize}px Outfit, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      if (selectedId === t.id) {
        const metrics = ctx.measureText(t.text);
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(t.x - 4, t.y - t.fontSize - 4, metrics.width + 8, t.fontSize + 10);
        ctx.setLineDash([]);
      }
    });
  }, [texts, images, canvasSize, selectedId, bgRemoved, bgRemovedUrl]);

  function addText(preset: typeof PRESETS[0]) {
    const id = `text_${Date.now()}`;
    setTexts((prev) => [...prev, {
      id, text: preset.text,
      x: canvasSize.w / 2 - 80, y: canvasSize.h / 2,
      fontSize: preset.fontSize, color: preset.color, fontWeight: preset.fontWeight,
    }]);
    setSelectedId(id);
    setTool(null);
  }

  function addImageLayer(src: string, type: "logo" | "foto") {
    const id = `${type}_${Date.now()}`;
    const size = type === "logo" ? 100 : 160;
    setImages((prev) => [...prev, {
      id, src, type,
      x: canvasSize.w / 2 - size / 2,
      y: canvasSize.h / 2 - size / 2,
      width: size, height: size,
      bgRemoved: false,
    }]);
    setSelectedId(id);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      localStorage.setItem(LOGO_STORAGE_KEY, src);
      setSavedLogo(src);
      addImageLayer(src, "logo");
    };
    reader.readAsDataURL(file);
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => addImageLayer(ev.target?.result as string, "foto");
    reader.readAsDataURL(file);
  }

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.font = `${t.fontWeight} ${t.fontSize}px Outfit, sans-serif`;
      const w = ctx.measureText(t.text).width;
      if (x >= t.x - 4 && x <= t.x + w + 4 && y >= t.y - t.fontSize - 4 && y <= t.y + 10) {
        setSelectedId(t.id);
        dragRef.current = { id: t.id, type: "text", startX: x, startY: y, origX: t.x, origY: t.y };
        return;
      }
    }

    for (let i = images.length - 1; i >= 0; i--) {
      const l = images[i];
      if (x >= l.x && x <= l.x + l.width && y >= l.y && y <= l.y + l.height) {
        setSelectedId(l.id);
        dragRef.current = { id: l.id, type: "image", startX: x, startY: y, origX: l.x, origY: l.y };
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
        t.id === dragRef.current!.id ? { ...t, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy } : t
      ));
    } else {
      setImages((prev) => prev.map((l) =>
        l.id === dragRef.current!.id ? { ...l, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy } : l
      ));
    }
  }

  async function handleRemoveBgMain() {
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
    }
  }

  async function handleRemoveLayerBg(layerId: string) {
    const layer = images.find((l) => l.id === layerId);
    if (!layer) return;
    setRemovingLayerBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(layer.src);
      const url = URL.createObjectURL(blob);
      setImages((prev) => prev.map((l) => l.id === layerId ? { ...l, src: url, bgRemoved: true } : l));
      // Update saved logo if it's the logo layer
      if (layer.type === "logo") {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
          setSavedLogo(dataUrl);
        };
        reader.readAsDataURL(blob);
      }
    } catch {
      alert("Não foi possível remover o fundo. Tente novamente.");
    } finally {
      setRemovingLayerBg(false);
    }
  }

  function deleteSelected() {
    setTexts((prev) => prev.filter((t) => t.id !== selectedId));
    setImages((prev) => prev.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  }

  function resizeSelected(delta: number) {
    setImages((prev) => prev.map((l) => {
      if (l.id !== selectedId) return l;
      const newW = Math.max(40, l.width + delta);
      const ratio = l.height / l.width;
      return { ...l, width: newW, height: Math.round(newW * ratio) };
    }));
  }

  function handleSaveClick() {
    const logosWithoutBgRemoval = images.filter((l) => l.type === "logo" && !l.bgRemoved);
    if (logosWithoutBgRemoval.length > 0) {
      setShowSaveConfirm(true);
    } else {
      doSave();
    }
  }

  function doSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setShowSaveConfirm(false);
    onSave(canvas.toDataURL("image/png"));
  }

  const selectedText = texts.find((t) => t.id === selectedId);
  const selectedImage = images.find((l) => l.id === selectedId);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
          <span style={s.headerTitle}>Editar foto</span>
          <button onClick={handleSaveClick} style={s.saveBtn}>⬇ Salvar</button>
        </div>

        {/* Canvas */}
        <div style={{ ...s.canvasWrap, width: canvasSize.w, height: canvasSize.h }}>
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

        {/* Selected text controls */}
        {selectedText && (
          <div style={s.layerControls}>
            <input
              style={s.textInput}
              value={selectedText.text}
              onChange={(e) => setTexts((prev) => prev.map((t) => t.id === selectedText.id ? { ...t, text: e.target.value } : t))}
            />
            <div style={s.controlRow}>
              <span style={s.controlLabel}>Tamanho</span>
              <input type="range" min="12" max="72" value={selectedText.fontSize}
                onChange={(e) => setTexts((prev) => prev.map((t) => t.id === selectedText.id ? { ...t, fontSize: Number(e.target.value) } : t))}
                style={{ flex: 1 }}
              />
              <input type="color" value={selectedText.color}
                onChange={(e) => setTexts((prev) => prev.map((t) => t.id === selectedText.id ? { ...t, color: e.target.value } : t))}
                style={s.colorPicker}
              />
              <button onClick={deleteSelected} style={s.deleteBtn}>🗑</button>
            </div>
          </div>
        )}

        {/* Selected image controls */}
        {selectedImage && (
          <div style={s.layerControls}>
            <div style={s.controlRow}>
              <span style={s.controlLabel}>
                {selectedImage.type === "logo" ? "🖼 Logo" : "📷 Foto"}
              </span>
              <button onClick={() => resizeSelected(-20)} style={s.iconBtn}>−</button>
              <button onClick={() => resizeSelected(20)} style={s.iconBtn}>+</button>
              {!selectedImage.bgRemoved && (
                <button
                  onClick={() => handleRemoveLayerBg(selectedImage.id)}
                  disabled={removingLayerBg}
                  style={s.removeBgBtn}
                >
                  {removingLayerBg ? "⏳ removendo..." : "✂️ remover fundo"}
                </button>
              )}
              {selectedImage.bgRemoved && (
                <span style={s.bgRemovedBadge}>✓ fundo removido</span>
              )}
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

          {/* Logo — salva automaticamente */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button style={s.toolBtn} onClick={() => logoFileRef.current?.click()}>
              <span style={s.toolIcon}>🖼</span>
              <span style={s.toolLabel}>Logo</span>
            </button>
            {savedLogo && (
              <button style={s.useSavedBtn} onClick={() => addImageLayer(savedLogo, "logo")}>
                usar salva
              </button>
            )}
          </div>
          <input ref={logoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />

          {/* Foto por cima */}
          <button style={s.toolBtn} onClick={() => photoFileRef.current?.click()}>
            <span style={s.toolIcon}>📷</span>
            <span style={s.toolLabel}>Foto</span>
          </button>
          <input ref={photoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />

          {/* Remover fundo da imagem principal */}
          <button style={{ ...s.toolBtn, ...(bgRemoved ? s.toolBtnActive : {}) }} onClick={handleRemoveBgMain} disabled={removingBg}>
            <span style={s.toolIcon}>{removingBg ? "⏳" : "✂️"}</span>
            <span style={s.toolLabel}>{removingBg ? "..." : "Fundo"}</span>
          </button>
        </div>

        {/* Text presets */}
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

      {/* Confirm save modal */}
      {showSaveConfirm && (
        <div style={s.confirmOverlay}>
          <div style={s.confirmBox}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🖼️</div>
            <div style={s.confirmTitle}>A logo tem fundo</div>
            <div style={s.confirmDesc}>Quer remover o fundo da logo antes de salvar?</div>
            <div style={s.confirmBtns}>
              <button
                style={s.confirmYes}
                onClick={async () => {
                  const logoLayer = images.find((l) => l.type === "logo" && !l.bgRemoved);
                  if (logoLayer) await handleRemoveLayerBg(logoLayer.id);
                  doSave();
                }}
                disabled={removingLayerBg}
              >
                {removingLayerBg ? "Removendo..." : "✂️ Remover e salvar"}
              </button>
              <button style={s.confirmNo} onClick={doSave}>
                Salvar assim mesmo
              </button>
            </div>
          </div>
        </div>
      )}
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
    position: "sticky", top: 0, background: "#07080b", zIndex: 10,
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
  canvasWrap: { margin: "12px auto", borderRadius: 12, overflow: "hidden", cursor: "crosshair" },

  layerControls: {
    width: "calc(100% - 32px)", padding: "10px 14px",
    background: "#111820", borderRadius: 12, marginBottom: 8,
    display: "flex", flexDirection: "column", gap: 8,
  },
  controlRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  controlLabel: { fontSize: 12, color: "#8394b0", fontWeight: 600, flexShrink: 0 },
  textInput: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 12px", color: "#eef2f9", fontSize: 14, outline: "none", width: "100%",
  },
  colorPicker: { width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer", padding: 2, background: "transparent", flexShrink: 0 },
  deleteBtn: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8, color: "#f87171", cursor: "pointer", padding: "4px 10px", flexShrink: 0,
  },
  iconBtn: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#eef2f9", cursor: "pointer", padding: "4px 12px", fontSize: 16, flexShrink: 0,
  },
  removeBgBtn: {
    background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 8, color: "#a855f7", cursor: "pointer", padding: "4px 10px", fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  bgRemovedBadge: {
    fontSize: 11, color: "#34d399", fontWeight: 600, flexShrink: 0,
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
  toolBtnActive: { borderColor: "#a855f7", background: "rgba(168,85,247,0.1)" },
  toolIcon: { fontSize: 20 },
  toolLabel: { fontSize: 11, color: "#8394b0", fontWeight: 600 },
  useSavedBtn: {
    background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 8, color: "#a855f7", fontSize: 10, fontWeight: 700,
    cursor: "pointer", padding: "3px 8px", whiteSpace: "nowrap" as const,
  },

  presets: {
    display: "flex", gap: 8, padding: "0 16px 12px",
    width: "100%", overflowX: "auto",
  },
  presetBtn: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20, padding: "7px 14px", color: "#eef2f9",
    fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
  },

  // Confirm modal
  confirmOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 300, padding: 24,
  },
  confirmBox: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20, padding: "28px 24px", maxWidth: 320, width: "100%",
    textAlign: "center",
  },
  confirmTitle: { fontSize: 17, fontWeight: 700, color: "#eef2f9", marginBottom: 8 },
  confirmDesc: { fontSize: 13, color: "#8394b0", lineHeight: 1.5, marginBottom: 20 },
  confirmBtns: { display: "flex", flexDirection: "column", gap: 10 },
  confirmYes: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none",
    borderRadius: 12, padding: "13px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  confirmNo: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "12px", color: "#8394b0", fontSize: 14, cursor: "pointer",
  },
};
