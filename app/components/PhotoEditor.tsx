"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";

interface Props {
  imageUrl: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
}

interface ImageLayer {
  id: string;
  src: string;
  type: "logo" | "foto";
  x: number;
  y: number;
  size: number;
  bgRemoved: boolean;
}

type Layer = { kind: "text"; data: TextLayer } | { kind: "image"; data: ImageLayer };

const PRESETS = [
  { label: "💰 Preço",       text: "R$ 0,00",          fontSize: 36, color: "#FFD700", fontWeight: "bold"   as const },
  { label: "📞 Telefone",    text: "(00) 00000-0000",   fontSize: 22, color: "#ffffff", fontWeight: "normal" as const },
  { label: "🏷️ Desconto",   text: "10% OFF",            fontSize: 30, color: "#ff4444", fontWeight: "bold"   as const },
  { label: "✏️ Texto livre", text: "Seu texto aqui",    fontSize: 20, color: "#ffffff", fontWeight: "normal" as const },
];

const LOGO_KEY = "tamowork_saved_logo";

export default function PhotoEditor({ imageUrl, onClose, onSave }: Props) {
  const { lang } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<"text" | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingBg, setRemovingBg] = useState<string | null>(null);
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  const [savedLogo, setSavedLogo] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [kbOffset, setKbOffset] = useState(0); // keyboard height in px
  const logoFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const isDragging = useRef(false);

  // Detect keyboard height via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function onResize() {
      const kb = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
      setKbOffset(kb);
    }

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // Lock body scroll while editor is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(LOGO_KEY);
    if (saved) setSavedLogo(saved);
  }, []);

  const updateLayer = useCallback((id: string, patch: Partial<TextLayer> | Partial<ImageLayer>) => {
    setLayers(prev => prev.map(l => {
      if (l.data.id !== id) return l;
      return { ...l, data: { ...l.data, ...patch } } as Layer;
    }));
  }, []);

  function addText(preset: typeof PRESETS[0]) {
    const id = `text_${Date.now()}`;
    setLayers(prev => [...prev, {
      kind: "text",
      data: { id, text: preset.text, x: 20, y: 40, fontSize: preset.fontSize, color: preset.color, fontWeight: preset.fontWeight },
    }]);
    setSelectedId(id);
    setTool(null);
  }

  function addImageLayer(src: string, type: "logo" | "foto") {
    const id = `${type}_${Date.now()}`;
    setLayers(prev => [...prev, {
      kind: "image",
      data: { id, src, type, x: 20, y: 20, size: type === "logo" ? 90 : 160, bgRemoved: false },
    }]);
    setSelectedId(id);
    if (type === "logo") {
      localStorage.setItem(LOGO_KEY, src);
      setSavedLogo(src);
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => addImageLayer(ev.target?.result as string, "logo");
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => addImageLayer(ev.target?.result as string, "foto");
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Drag — preventDefault blocks page scroll during drag
  function onPointerDown(e: React.PointerEvent, id: string, x: number, y: number) {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);
    isDragging.current = false;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: x, origY: y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
    updateLayer(dragRef.current.id, {
      x: dragRef.current.origX + dx,
      y: dragRef.current.origY + dy,
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function deleteSelected() {
    setLayers(prev => prev.filter(l => l.data.id !== selectedId));
    setSelectedId(null);
  }

  async function handleRemoveBgMain() {
    setRemovingBg("main");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(imageUrl);
      setBgRemovedUrl(URL.createObjectURL(blob));
    } catch {
      alert(
        lang === "en" ? "Could not remove background. Please try again."
        : lang === "es" ? "No se pudo quitar el fondo. Inténtalo de nuevo."
        : "Não foi possível remover o fundo. Tente novamente."
      );
    } finally {
      setRemovingBg(null);
    }
  }

  async function handleRemoveLayerBg(layerId: string, src: string, isLogo: boolean) {
    setRemovingBg(layerId);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(src);
      const url = URL.createObjectURL(blob);
      updateLayer(layerId, { src: url, bgRemoved: true });
      if (isLogo) {
        const reader = new FileReader();
        reader.onload = ev => {
          const d = ev.target?.result as string;
          localStorage.setItem(LOGO_KEY, d);
          setSavedLogo(d);
        };
        reader.readAsDataURL(blob);
      }
    } catch {
      alert(
        lang === "en" ? "Could not remove background."
        : lang === "es" ? "No se pudo quitar el fondo."
        : "Não foi possível remover o fundo."
      );
    } finally {
      setRemovingBg(null);
    }
  }

  function hasLogoWithBg() {
    return layers.some(l => l.kind === "image" && (l.data as ImageLayer).type === "logo" && !(l.data as ImageLayer).bgRemoved);
  }

  async function doSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    setSelectedId(null);
    try {
      await new Promise(r => setTimeout(r, 80));
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(stageRef.current!, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: null,
      });
      onSave(canvas.toDataURL("image/png"));
    } catch {
      alert(
        lang === "en" ? "Export error. Please try again."
        : lang === "es" ? "Error al exportar. Inténtalo de nuevo."
        : "Erro ao exportar. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSaveClick() {
    if (hasLogoWithBg()) {
      setShowSaveConfirm(true);
    } else {
      doSave();
    }
  }

  const selectedLayer = layers.find(l => l.data.id === selectedId);
  const selectedText = selectedLayer?.kind === "text" ? selectedLayer.data as TextLayer : null;
  const selectedImg = selectedLayer?.kind === "image" ? selectedLayer.data as ImageLayer : null;

  return (
    <>
      {/* Full-screen fixed editor — NO scroll, NO overflow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#07080b",
          display: "flex",
          flexDirection: "column",
          zIndex: 200,
          // Shift up by keyboard height so bottom controls stay above keyboard
          transform: `translateY(-${kbOffset}px)`,
          transition: "transform 0.18s ease",
        }}
        onClick={() => setSelectedId(null)}
      >
        {/* Header */}
        <div style={s.header} onClick={e => e.stopPropagation()}>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
          <span style={s.headerTitle}>
            {lang === "en" ? "Edit photo" : "Editar foto"}
          </span>
          <button onClick={handleSaveClick} disabled={saving} style={s.saveBtn}>
            {saving ? "⏳" : lang === "en" ? "⬇ Save" : lang === "es" ? "⬇ Guardar" : "⬇ Salvar"}
          </button>
        </div>

        {/* Stage — fills remaining space, image centered, NO scroll */}
        <div
          style={s.stageArea}
          onClick={() => setSelectedId(null)}
        >
          <div
            ref={stageRef}
            style={s.stage}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={bgRemovedUrl ?? imageUrl}
              alt="base"
              style={s.baseImg}
              crossOrigin="anonymous"
              draggable={false}
            />

            {layers.map(layer => {
              if (layer.kind === "image") {
                const l = layer.data as ImageLayer;
                const sel = selectedId === l.id;
                return (
                  <img
                    key={l.id}
                    src={l.src}
                    alt={l.type}
                    crossOrigin="anonymous"
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: l.x,
                      top: l.y,
                      width: l.size,
                      height: "auto",
                      cursor: "grab",
                      userSelect: "none",
                      outline: sel ? "2px dashed #a855f7" : "none",
                      outlineOffset: 2,
                      touchAction: "none",
                    }}
                    onPointerDown={e => onPointerDown(e, l.id, l.x, l.y)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  />
                );
              } else {
                const t = layer.data as TextLayer;
                const sel = selectedId === t.id;
                return (
                  <div
                    key={t.id}
                    style={{
                      position: "absolute",
                      left: t.x,
                      top: t.y,
                      fontSize: t.fontSize,
                      color: t.color,
                      fontWeight: t.fontWeight,
                      fontFamily: "Outfit, Arial, sans-serif",
                      whiteSpace: "nowrap",
                      cursor: "grab",
                      userSelect: "none",
                      textShadow: "1px 1px 4px rgba(0,0,0,0.85)",
                      outline: sel ? "1px dashed #a855f7" : "none",
                      outlineOffset: 3,
                      padding: "2px 4px",
                      touchAction: "none",
                    }}
                    onPointerDown={e => onPointerDown(e, t.id, t.x, t.y)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    {t.text}
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* Bottom panel — controls + toolbar, stays above keyboard */}
        <div style={s.bottomPanel} onClick={e => e.stopPropagation()}>

          {/* Text layer controls */}
          {selectedText && (
            <div style={s.editPanel}>
              <input
                style={s.textInput}
                value={selectedText.text}
                onChange={e => updateLayer(selectedText.id, { text: e.target.value })}
                placeholder={lang === "en" ? "Type text..." : "Digite o texto..."}
              />
              <div style={s.editRow}>
                <span style={s.ctrlLabel}>A</span>
                <input
                  type="range" min="12" max="80" value={selectedText.fontSize}
                  onChange={e => updateLayer(selectedText.id, { fontSize: Number(e.target.value) })}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <input
                  type="color" value={selectedText.color}
                  onChange={e => updateLayer(selectedText.id, { color: e.target.value })}
                  style={s.colorPicker}
                />
                <button
                  onClick={() => updateLayer(selectedText.id, { fontWeight: selectedText.fontWeight === "bold" ? "normal" : "bold" })}
                  style={{ ...s.iconBtn, fontWeight: "bold", color: selectedText.fontWeight === "bold" ? "#a855f7" : "#4e5c72" }}
                >B</button>
                <button onClick={deleteSelected} style={s.deleteBtn}>🗑</button>
              </div>
            </div>
          )}

          {/* Image layer controls */}
          {selectedImg && (
            <div style={s.editPanel}>
              <div style={s.editRow}>
                <span style={s.ctrlLabel}>{selectedImg.type === "logo" ? "🖼" : "📷"}</span>
                <button onClick={() => updateLayer(selectedImg.id, { size: Math.max(30, selectedImg.size - 20) })} style={s.iconBtn}>−</button>
                <button onClick={() => updateLayer(selectedImg.id, { size: selectedImg.size + 20 })} style={s.iconBtn}>+</button>
                {!selectedImg.bgRemoved ? (
                  <button
                    onClick={() => handleRemoveLayerBg(selectedImg.id, selectedImg.src, selectedImg.type === "logo")}
                    disabled={!!removingBg}
                    style={s.removeBgBtn}
                  >
                    {removingBg === selectedImg.id ? "⏳" : lang === "en" ? "✂️ rm bg" : "✂️ remover fundo"}
                  </button>
                ) : (
                  <span style={s.bgOkBadge}>{lang === "en" ? "✓ no bg" : "✓ sem fundo"}</span>
                )}
                <button onClick={deleteSelected} style={s.deleteBtn}>🗑</button>
              </div>
            </div>
          )}

          {/* Text presets — shown when tool = text */}
          {tool === "text" && (
            <div style={s.presets}>
              {PRESETS.map(p => (
                <button key={p.label} style={s.presetBtn} onClick={() => addText(p)}>{p.label}</button>
              ))}
            </div>
          )}

          {/* Main toolbar */}
          <div style={s.toolbar}>
            {/* Text tool */}
            <button
              style={{ ...s.toolBtn, ...(tool === "text" ? s.toolActive : {}) }}
              onClick={() => setTool(tool === "text" ? null : "text")}
            >
              <span style={s.toolIcon}>T</span>
              <span style={s.toolLabel}>{lang === "en" ? "Text" : "Texto"}</span>
            </button>

            {/* Logo tool */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <button style={s.toolBtn} onClick={() => logoFileRef.current?.click()}>
                <span style={s.toolIcon}>🖼</span>
                <span style={s.toolLabel}>Logo</span>
              </button>
              {savedLogo && (
                <button style={s.useSavedBtn} onClick={() => addImageLayer(savedLogo, "logo")}>
                  {lang === "en" ? "use saved" : lang === "es" ? "usar guardado" : "usar salva"}
                </button>
              )}
            </div>

            {/* Photo tool */}
            <button style={s.toolBtn} onClick={() => photoFileRef.current?.click()}>
              <span style={s.toolIcon}>📷</span>
              <span style={s.toolLabel}>{lang === "en" ? "Photo" : "Foto"}</span>
            </button>

            {/* Remove BG (main image) */}
            <button
              style={{ ...s.toolBtn, ...(bgRemovedUrl ? s.toolActive : {}) }}
              onClick={handleRemoveBgMain}
              disabled={removingBg === "main"}
            >
              <span style={s.toolIcon}>{removingBg === "main" ? "⏳" : "✂️"}</span>
              <span style={s.toolLabel}>{removingBg === "main" ? "..." : lang === "en" ? "BG" : "Fundo"}</span>
            </button>
          </div>

          {/* Safe area bottom */}
          <div style={{ height: "env(safe-area-inset-bottom, 8px)" }} />
        </div>
      </div>

      {/* Hidden file inputs — outside fixed layout to avoid layout issues */}
      <input ref={logoFileRef}  type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
      <input ref={photoFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />

      {/* Save confirm modal */}
      {showSaveConfirm && (
        <div style={s.confirmOverlay} onClick={() => setShowSaveConfirm(false)}>
          <div style={s.confirmBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🖼️</div>
            <div style={s.confirmTitle}>
              {lang === "en" ? "Logo has background" : lang === "es" ? "El logo tiene fondo" : "A logo tem fundo"}
            </div>
            <div style={s.confirmDesc}>
              {lang === "en" ? "Remove the logo background before saving?"
               : lang === "es" ? "¿Quitar el fondo del logo antes de guardar?"
               : "Quer remover o fundo da logo antes de salvar?"}
            </div>
            <div style={s.confirmBtns}>
              <button
                style={s.confirmYes}
                disabled={!!removingBg}
                onClick={async () => {
                  const logoLayer = layers.find(l => l.kind === "image" && (l.data as ImageLayer).type === "logo" && !(l.data as ImageLayer).bgRemoved);
                  if (logoLayer) {
                    const l = logoLayer.data as ImageLayer;
                    await handleRemoveLayerBg(l.id, l.src, true);
                  }
                  doSave();
                }}
              >
                {removingBg ? "⏳..." : lang === "en" ? "✂️ Remove & save" : lang === "es" ? "✂️ Quitar y guardar" : "✂️ Remover e salvar"}
              </button>
              <button style={s.confirmNo} onClick={doSave}>
                {lang === "en" ? "Save anyway" : lang === "es" ? "Guardar igual" : "Salvar assim mesmo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#07080b",
    zIndex: 2,
  },
  headerTitle: { fontSize: 15, fontWeight: 700, color: "#eef2f9" },
  closeBtn: {
    background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8,
    color: "#8394b0", width: 32, height: 32, cursor: "pointer", fontSize: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  saveBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none",
    borderRadius: 10, padding: "7px 16px", color: "#fff",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  // Stage fills ALL remaining space — image is centered, no scroll
  stageArea: {
    flex: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    padding: "8px 12px",
    touchAction: "none", // blocks page scroll when interacting with stage
  },
  stage: {
    position: "relative", display: "inline-block",
    borderRadius: 12, overflow: "hidden",
    maxWidth: "100%", maxHeight: "100%",
    touchAction: "none",
    flexShrink: 0,
  },
  baseImg: {
    display: "block",
    maxWidth: "min(100%, 480px)",
    maxHeight: "calc(100vh - 200px)",
    width: "auto", height: "auto",
    borderRadius: 12,
    userSelect: "none", pointerEvents: "none",
  },
  // Bottom panel: controls + toolbar — fixed height, no scroll
  bottomPanel: {
    flexShrink: 0,
    background: "#07080b",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    display: "flex", flexDirection: "column",
    zIndex: 2,
  },
  editPanel: {
    padding: "8px 14px",
    background: "#111820",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    display: "flex", flexDirection: "column", gap: 8,
  },
  editRow: {
    display: "flex", alignItems: "center", gap: 8,
    flexWrap: "nowrap" as const, overflow: "hidden",
  },
  ctrlLabel: { fontSize: 12, color: "#8394b0", fontWeight: 600, flexShrink: 0 },
  textInput: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 12px", color: "#eef2f9",
    fontSize: 16, outline: "none", width: "100%",
  } as React.CSSProperties,
  colorPicker: {
    width: 32, height: 32, borderRadius: 6, border: "none",
    cursor: "pointer", padding: 2, background: "transparent", flexShrink: 0,
  },
  iconBtn: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#eef2f9", cursor: "pointer",
    padding: "4px 12px", fontSize: 15, flexShrink: 0,
  },
  deleteBtn: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8, color: "#f87171", cursor: "pointer",
    padding: "4px 10px", flexShrink: 0,
    marginLeft: "auto",
  },
  removeBgBtn: {
    background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 8, color: "#a855f7", cursor: "pointer",
    padding: "4px 10px", fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  bgOkBadge: { fontSize: 11, color: "#34d399", fontWeight: 600, flexShrink: 0 },
  presets: {
    display: "flex", gap: 8, padding: "8px 14px 4px",
    overflowX: "auto", flexShrink: 0,
    scrollbarWidth: "none",
  },
  presetBtn: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20, padding: "7px 14px", color: "#eef2f9",
    fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
  },
  toolbar: {
    display: "flex", gap: 8, padding: "8px 14px",
    overflowX: "auto", flexShrink: 0,
    scrollbarWidth: "none",
  },
  toolBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    background: "#111820", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "9px 16px", cursor: "pointer", flexShrink: 0,
  },
  toolActive: { borderColor: "#a855f7", background: "rgba(168,85,247,0.1)" },
  toolIcon: { fontSize: 20 },
  toolLabel: { fontSize: 11, color: "#8394b0", fontWeight: 600 },
  useSavedBtn: {
    background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 8, color: "#a855f7", fontSize: 10, fontWeight: 700,
    cursor: "pointer", padding: "3px 8px", whiteSpace: "nowrap" as const,
  },
  confirmOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 400, padding: 24,
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
