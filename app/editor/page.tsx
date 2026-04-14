"use client";
export const dynamic = "force-dynamic";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import nextDynamic from "next/dynamic";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";
import { useI18n } from "@/lib/i18n";
import { downloadDataUrl } from "@/lib/downloadBlob";
const PromoCreator = nextDynamic(() => import("@/app/components/PromoCreator"), { ssr: false });

type EditorAction = "promo" | "remove_bg" | "personalizar" | null;

type Tool = "none" | "text" | "addImage" | "logo" | "crop" | "adjust" | "upscale" | "stickers";
type CropRatio = "livre" | "1:1" | "4:5" | "9:16" | "16:9";

interface StickerDef { label: string; bg: string; color: string; shape: "round" | "star" | "badge" | "pill" }
const STICKERS: StickerDef[] = [
  { label: "PROMOÇÃO",   bg: "#ef4444", color: "#fff",    shape: "round" },
  { label: "OFERTA",     bg: "#f97316", color: "#fff",    shape: "star"  },
  { label: "NOVIDADE",   bg: "#8b5cf6", color: "#fff",    shape: "pill"  },
  { label: "EXCLUSIVO",  bg: "#0ea5e9", color: "#fff",    shape: "badge" },
  { label: "LANÇAMENTO", bg: "#10b981", color: "#fff",    shape: "round" },
  { label: "SALE",       bg: "#f59e0b", color: "#000",    shape: "star"  },
  { label: "LIMITADO",   bg: "#ec4899", color: "#fff",    shape: "pill"  },
  { label: "GRÁTIS",     bg: "#16c784", color: "#000",    shape: "badge" },
  { label: "-10%",       bg: "#ef4444", color: "#fff",    shape: "round" },
  { label: "-20%",       bg: "#f97316", color: "#fff",    shape: "round" },
  { label: "-30%",       bg: "#8b5cf6", color: "#fff",    shape: "star"  },
  { label: "-50%",       bg: "#0ea5e9", color: "#fff",    shape: "star"  },
  { label: "FRETE FREE", bg: "#10b981", color: "#fff",    shape: "pill"  },
  { label: "DESTAQUE",   bg: "#fbbf24", color: "#000",    shape: "badge" },
  { label: "HOT",        bg: "#ef4444", color: "#fff",    shape: "pill"  },
  { label: "NEW",        bg: "#6366f1", color: "#fff",    shape: "badge" },
];

interface StickerLayer {
  id: string; kind: "sticker";
  def: StickerDef; x: number; y: number; scale: number;
}

interface TextLayer {
  id: string; kind: "text";
  text: string; x: number; y: number;
  size: number; color: string; bold: boolean; shadow: boolean;
}
interface ImgLayer {
  id: string; kind: "img";
  src: string; x: number; y: number; scale: number;
}
type Layer = TextLayer | ImgLayer | StickerLayer;

const RATIOS: Record<CropRatio, number | null> = {
  "livre": null, "1:1": 1, "4:5": 4/5, "9:16": 9/16, "16:9": 16/9,
};

export default function EditorPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const addImgRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [action, setAction] = useState<EditorAction>(null); // qual das 3 opções o user escolheu
  const [removingBg, setRemovingBg] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoNatural, setPhotoNatural] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<Tool>("none");
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);

  // Text tool state
  const [newText, setNewText] = useState("Seu texto aqui");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(28);
  const [textBold, setTextBold] = useState(false);
  const [textShadow, setTextShadow] = useState(true);

  // Crop state
  const [cropRatio, setCropRatio] = useState<CropRatio>("livre");
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 80 }); // percentages

  // Adjust state
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Upscale state
  const [upscaling, setUpscaling] = useState(false);
  const [upscaled, setUpscaled] = useState<string | null>(null);

  // Carregar foto vinda da tela de resultado (sessionStorage)
  useEffect(() => {
    const url = sessionStorage.getItem("editor_image");
    if (url) {
      sessionStorage.removeItem("editor_image");
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        setPhotoNatural({ w: img.naturalWidth, h: img.naturalHeight });
        setPhoto(dataUrl);
      };
      img.onerror = () => {
        // Se CORS bloquear, usa a URL direto (funciona para exibição, export pode falhar)
        setPhoto(url);
      };
      img.src = url;
    }
  }, []);

  // Load photo
  function handlePhotoFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => setPhotoNatural({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = src;
      setPhoto(src);
      setLayers([]);
      setUpscaled(null);
      setTool("none");
    };
    reader.readAsDataURL(file);
  }

  // Add text layer
  function addSticker(def: StickerDef) {
    const layer: StickerLayer = {
      id: Date.now().toString(), kind: "sticker",
      def, x: 30, y: 20, scale: 1,
    };
    setLayers(l => [...l, layer]);
    setTool("none");
  }

  function addText() {
    if (!newText.trim()) return;
    const layer: TextLayer = {
      id: Date.now().toString(), kind: "text",
      text: newText, x: 20, y: 40,
      size: textSize, color: textColor, bold: textBold, shadow: textShadow,
    };
    setLayers(l => [...l, layer]);
    setTool("none");
  }

  // Add image/logo layer
  function handleAddImg(src: string) {
    const layer: ImgLayer = {
      id: Date.now().toString(), kind: "img",
      src, x: 20, y: 20, scale: 30,
    };
    setLayers(l => [...l, layer]);
    setTool("none");
  }

  // Apply crop
  function applyCrop() {
    if (!photo) return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const sx = (cropBox.x / 100) * img.naturalWidth;
      const sy = (cropBox.y / 100) * img.naturalHeight;
      const sw = (cropBox.w / 100) * img.naturalWidth;
      const sh = (cropBox.h / 100) * img.naturalHeight;
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      setPhoto(canvas.toDataURL("image/jpeg", 0.95));
      setPhotoNatural({ w: sw, h: sh });
      setLayers([]);
      setTool("none");
    };
    img.src = photo;
  }

  // Update crop box when ratio changes
  useEffect(() => {
    const ratio = RATIOS[cropRatio];
    if (!ratio || !photoNatural.w) {
      setCropBox({ x: 5, y: 5, w: 90, h: 90 });
      return;
    }
    const imgRatio = photoNatural.w / photoNatural.h;
    if (ratio > imgRatio) {
      const h = (imgRatio / ratio) * 90;
      setCropBox({ x: 5, y: (100 - h) / 2, w: 90, h });
    } else {
      const w = (ratio / imgRatio) * 90;
      setCropBox({ x: (100 - w) / 2, y: 5, w, h: 90 });
    }
  }, [cropRatio, photoNatural]);

  // 4K upscale — canvas 2× com melhor qualidade
  function doUpscale() {
    if (!photo) return;
    setUpscaling(true);
    const img = new window.Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Draw upscaled
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Subtle sharpening via overlay
      ctx.globalAlpha = 0.08;
      ctx.globalCompositeOperation = "overlay";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      const result = canvas.toDataURL("image/jpeg", 0.97);
      setUpscaled(result);
      setPhoto(result);
      setPhotoNatural({ w: canvas.width, h: canvas.height });
      setUpscaling(false);
      setTool("none");
    };
    img.src = photo;
  }

  // Drag layers
  const onMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    setSelectedId(id);
    setDragging({ id, ox: clientX - (layer.x / 100) * rect.width, oy: clientY - (layer.y / 100) * rect.height });
  }, [layers]);

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const x = Math.max(0, Math.min(90, ((clientX - dragging.ox) / rect.width) * 100));
      const y = Math.max(0, Math.min(90, ((clientY - dragging.oy) / rect.height) * 100));
      setLayers(ls => ls.map(l => l.id === dragging.id ? { ...l, x, y } : l));
    };
    const up = () => setDragging(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dragging]);

  // Delete selected layer
  function deleteSelected() {
    if (!selectedId) return;
    setLayers(l => l.filter(x => x.id !== selectedId));
    setSelectedId(null);
  }

  // Export final image
  function exportImage() {
    if (!photo) return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      // Apply adjust filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = "none";
      // Draw layers
      const drawLayers = () => {
        layers.forEach(layer => {
          if (layer.kind === "text") {
            const sz = (layer.size / 100) * img.naturalHeight * 0.12;
            ctx.font = `${layer.bold ? "bold " : ""}${sz}px Outfit, sans-serif`;
            ctx.fillStyle = layer.color;
            if (layer.shadow) {
              ctx.shadowColor = "rgba(0,0,0,0.7)";
              ctx.shadowBlur = sz * 0.4;
            }
            ctx.fillText(layer.text, (layer.x / 100) * img.naturalWidth, (layer.y / 100) * img.naturalHeight);
            ctx.shadowBlur = 0;
          } else if (layer.kind === "img") {
            const imgL = new window.Image();
            imgL.src = layer.src;
            const w = (layer.scale / 100) * img.naturalWidth;
            const h = w * (imgL.naturalHeight / imgL.naturalWidth || 1);
            ctx.drawImage(imgL, (layer.x / 100) * img.naturalWidth, (layer.y / 100) * img.naturalHeight, w, h);
          } else if (layer.kind === "sticker") {
            const baseFontSize = Math.round(img.naturalWidth * 0.045 * layer.scale);
            ctx.font = `800 ${baseFontSize}px Outfit, sans-serif`;
            ctx.fillStyle = layer.def.bg;
            const px = (layer.x / 100) * img.naturalWidth;
            const py = (layer.y / 100) * img.naturalHeight;
            const metrics = ctx.measureText(layer.def.label);
            const padX = baseFontSize * 0.7;
            const padY = baseFontSize * 0.5;
            const w = metrics.width + padX * 2;
            const h = baseFontSize + padY * 2;
            const r = layer.def.shape === "pill" ? h / 2 : layer.def.shape === "round" ? Math.min(w, h) / 2 : 8;
            ctx.beginPath();
            ctx.roundRect(px, py, w, h, r);
            ctx.fill();
            ctx.fillStyle = layer.def.color;
            ctx.textBaseline = "middle";
            ctx.fillText(layer.def.label, px + padX, py + h / 2);
            ctx.textBaseline = "alphabetic";
          }
        });
        downloadDataUrl(canvas.toDataURL("image/jpeg", 0.96), "foto-editada.jpg");
      };
      // Pre-load image layers
      const imgLayers = layers.filter((l): l is ImgLayer => l.kind === "img");
      if (imgLayers.length === 0) { drawLayers(); return; }
      let loaded = 0;
      imgLayers.forEach(layer => {
        const i = new window.Image();
        i.onload = () => { loaded++; if (loaded === imgLayers.length) drawLayers(); };
        i.src = layer.src;
      });
    };
    img.src = photo;
  }

  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  // ── Tela de escolha: qual ação o usuário quer fazer ───────────────────────
  if (!action) {
    const ACTIONS = [
      { id: "promo"      as EditorAction, icon: "🏷️", label: lang === "en" ? "Create promo"       : "Criar promoção",  desc: lang === "en" ? "Post with price and text for Instagram" : "Post com preço e texto para Instagram" },
      { id: "remove_bg"  as EditorAction, icon: "✂️", label: lang === "en" ? "Remove background"  : "Remover fundo",   desc: lang === "en" ? "Clean background, transparent or white"  : "Fundo limpo, transparente ou branco" },
      { id: "personalizar" as EditorAction, icon: "✏️", label: lang === "en" ? "Customize"         : "Personalizar",    desc: lang === "en" ? "Add text, stickers and more"             : "Adicione texto, stickers e mais" },
    ];
    return (
      <div style={s.page} className="app-layout">
        <AppHeader subtitle={lang === "en" ? "Edit photo" : "Editar foto"} onBack={() => router.back()} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: "24px 20px", gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8394b0", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {lang === "en" ? "What do you want to do?" : "O que você quer fazer?"}
          </div>
          {ACTIONS.map(a => (
            <button
              key={a.id}
              onClick={() => setAction(a.id)}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                background: "#111820", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "18px 20px", cursor: "pointer",
                textAlign: "left", width: "100%",
              }}
            >
              <span style={{ fontSize: 32, flexShrink: 0 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#eef2f9", marginBottom: 3 }}>{a.label}</div>
                <div style={{ fontSize: 13, color: "#8394b0" }}>{a.desc}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "#4e5c72", fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Modo Promo: abre PromoCreator com layout + BottomNav ──────────────────
  if (action === "promo") {
    return (
      <div style={s.page} className="app-layout">
        <AppHeader subtitle={lang === "en" ? "Create promo" : "Criar promoção"} onBack={() => setAction(null)} />
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
          <PromoCreator onBack={() => setAction(null)} initialPhoto={photo ?? undefined} />
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Modo Remove BG ou Personalizar: pede foto primeiro ───────────────────
  if (!photo) {
    async function handleFileForAction(file: File) {
      if (action === "remove_bg") {
        setRemovingBg(true);
        handlePhotoFile(file); // carrega a foto para exibição
        try {
          const { removeBackground } = await import("@imgly/background-removal");
          const blob = await removeBackground(file, { proxyToWorker: false, output: { format: "image/png" } });
          const url = URL.createObjectURL(blob);
          const img = new window.Image();
          img.onload = () => { setPhotoNatural({ w: img.naturalWidth, h: img.naturalHeight }); setPhoto(url); };
          img.src = url;
        } catch {
          alert(lang === "en" ? "Could not remove background." : "Não foi possível remover o fundo.");
        } finally {
          setRemovingBg(false);
        }
      } else {
        handlePhotoFile(file);
      }
    }

    return (
      <div style={s.page} className="app-layout">
        <AppHeader
          subtitle={action === "remove_bg" ? (lang === "en" ? "Remove background" : "Remover fundo") : (lang === "en" ? "Customize" : "Personalizar")}
          onBack={() => setAction(null)}
        />

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileForAction(f); e.target.value = ""; }} />

        <div style={s.previewEmpty} onClick={() => !removingBg && fileRef.current?.click()}>
          <div style={{ textAlign: "center" }}>
            {removingBg ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 15, color: "#a855f7", fontWeight: 600 }}>
                  {lang === "en" ? "Removing background..." : "Removendo fundo..."}
                </div>
                <div style={{ fontSize: 12, color: "#4e5c72", marginTop: 6 }}>
                  {lang === "en" ? "This may take a few seconds" : "Pode levar alguns segundos"}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.3 }}>🖼️</div>
                <div style={s.uploadCenterBtn}>{t("editor_upload")}</div>
                <div style={{ fontSize: 12, color: "#4e5c72", marginTop: 8 }}>{t("editor_upload_sub")}</div>
              </>
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={s.page} className="app-layout">
      <style>{`
        .layer-handle { cursor: grab; user-select: none; }
        .layer-handle:active { cursor: grabbing; }
      `}</style>

      {/* Header */}
      <AppHeader
        subtitle={t("editor_title")}
        onBack={() => { setPhoto(null); setLayers([]); setAction(null); }}
        rightExtra={
          <button onClick={exportImage} style={s.dlBtn}>{t("editor_save")}</button>
        }
      />

      {/* Preview area */}
      <div ref={previewRef} style={s.preview} onClick={() => setSelectedId(null)}>
        {/* Base image */}
        <img src={photo} alt="base" style={{ ...s.previewImg, filter: filterStyle }} />

        {/* Crop overlay */}
        {tool === "crop" && (
          <>
            <div style={{ ...s.cropDark, top: 0, left: 0, width: "100%", height: `${cropBox.y}%` }} />
            <div style={{ ...s.cropDark, bottom: 0, left: 0, width: "100%", height: `${100 - cropBox.y - cropBox.h}%` }} />
            <div style={{ ...s.cropDark, top: `${cropBox.y}%`, left: 0, width: `${cropBox.x}%`, height: `${cropBox.h}%` }} />
            <div style={{ ...s.cropDark, top: `${cropBox.y}%`, right: 0, width: `${100 - cropBox.x - cropBox.w}%`, height: `${cropBox.h}%` }} />
            <div style={{ ...s.cropBorder, top: `${cropBox.y}%`, left: `${cropBox.x}%`, width: `${cropBox.w}%`, height: `${cropBox.h}%` }} />
          </>
        )}

        {/* Layers */}
        {layers.map(layer => {
          const sel = selectedId === layer.id;
          if (layer.kind === "text") {
            return (
              <div key={layer.id} className="layer-handle"
                style={{ ...s.textLayer, left: `${layer.x}%`, top: `${layer.y}%`,
                  fontSize: layer.size, fontWeight: layer.bold ? 700 : 400,
                  color: layer.color,
                  outline: sel ? "2px dashed #a855f7" : "none",
                  textShadow: layer.shadow ? "0 2px 8px rgba(0,0,0,0.8)" : "none",
                }}
                onMouseDown={e => onMouseDown(e, layer.id)}
                onTouchStart={e => onMouseDown(e, layer.id)}>
                {layer.text}
              </div>
            );
          } else if (layer.kind === "img") {
            return (
              <div key={layer.id} className="layer-handle"
                style={{ ...s.imgLayerWrap, left: `${layer.x}%`, top: `${layer.y}%`,
                  width: `${layer.scale}%`, outline: sel ? "2px dashed #a855f7" : "none" }}
                onMouseDown={e => onMouseDown(e, layer.id)}
                onTouchStart={e => onMouseDown(e, layer.id)}>
                <img src={layer.src} alt="" style={{ width: "100%", display: "block" }} />
              </div>
            );
          } else if (layer.kind === "sticker") {
            const shapeStyle: React.CSSProperties =
              layer.def.shape === "round"  ? { borderRadius: "50%", padding: "10px", minWidth: 56, textAlign: "center" } :
              layer.def.shape === "star"   ? { borderRadius: "12px", padding: "8px 14px", transform: `rotate(-8deg) scale(${layer.scale})`, boxShadow: `0 0 0 4px ${layer.def.bg}55` } :
              layer.def.shape === "badge"  ? { borderRadius: "6px 6px 6px 0", padding: "7px 13px", boxShadow: `3px 3px 0 ${layer.def.bg}66` } :
                                             { borderRadius: 999, padding: "8px 16px" };
            return (
              <div key={layer.id} className="layer-handle"
                style={{ ...s.stickerLayer, left: `${layer.x}%`, top: `${layer.y}%`,
                  background: layer.def.bg, color: layer.def.color,
                  outline: sel ? "2px dashed #fff" : "none",
                  transform: layer.def.shape !== "star" ? `scale(${layer.scale})` : undefined,
                  ...shapeStyle }}
                onMouseDown={e => onMouseDown(e, layer.id)}
                onTouchStart={e => onMouseDown(e, layer.id)}>
                {layer.def.label}
              </div>
            );
          } else {
            return null;
          }
        })}
      </div>

      {/* Selected layer controls — shown below photo when any layer is selected */}
      {selectedId && (() => {
        const sel = layers.find(l => l.id === selectedId);
        if (!sel) return null;
        return (
          <div style={s.selPanel}>
            {sel.kind === "text" && (
              <>
                <input value={sel.text}
                  onChange={e => setLayers(ls => ls.map(l => l.id === selectedId ? { ...l, text: e.target.value } : l))}
                  style={s.textInput} placeholder={t("editor_text_placeholder")} />
                <div style={s.row}>
                  <label style={s.label}>{t("editor_color")}</label>
                  <input type="color" value={sel.color}
                    onChange={e => setLayers(ls => ls.map(l => l.id === selectedId ? { ...l, color: e.target.value } : l))}
                    style={s.colorPicker} />
                  <label style={s.label}>{t("editor_size")}</label>
                  <input type="range" min={14} max={72} value={sel.size}
                    onChange={e => setLayers(ls => ls.map(l => l.id === selectedId ? { ...l, size: +e.target.value } : l))}
                    style={{ flex: 1 }} />
                  <span style={{ color: "#8394b0", fontSize: 12 }}>{sel.size}</span>
                </div>
                <div style={s.row}>
                  <button onClick={() => setLayers(ls => ls.map(l => l.id === selectedId && l.kind === "text" ? { ...l, bold: !l.bold } : l))}
                    style={{ ...s.toggleBtn, background: sel.bold ? "#a855f7" : "#1a2235" }}><b>N</b></button>
                  <button onClick={() => setLayers(ls => ls.map(l => l.id === selectedId && l.kind === "text" ? { ...l, shadow: !l.shadow } : l))}
                    style={{ ...s.toggleBtn, background: sel.shadow ? "#a855f7" : "#1a2235" }}>{t("editor_shadow")}</button>
                  <button onClick={() => { deleteSelected(); }} style={{ ...s.toggleBtn, background: "#ef444422", color: "#ef4444", marginLeft: "auto" }}>{t("editor_remove")}</button>
                </div>
              </>
            )}
            {(sel.kind === "img" || sel.kind === "sticker") && (
              <div style={s.row}>
                <span style={s.label}>{t("editor_size_label")}</span>
                <input type="range"
                  min={sel.kind === "img" ? 10 : 0.5}
                  max={sel.kind === "img" ? 80 : 3}
                  step={sel.kind === "sticker" ? 0.1 : 1}
                  value={sel.scale}
                  style={{ flex: 1 }}
                  onChange={e => setLayers(ls => ls.map(l => l.id === selectedId ? { ...l, scale: +e.target.value } : l))} />
                <button onClick={deleteSelected} style={{ ...s.toggleBtn, background: "#ef444422", color: "#ef4444" }}>✕</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tool panel — shown when no layer selected */}
      {!selectedId && tool === "crop" && (
        <div style={s.panel}>
          <div style={s.row}>
            {(["livre", "1:1", "4:5", "9:16", "16:9"] as CropRatio[]).map(r => (
              <button key={r} onClick={() => setCropRatio(r)}
                style={{ ...s.ratioBtn, background: cropRatio === r ? "#a855f7" : "#1a2235" }}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={applyCrop} style={s.applyBtn}>{t("editor_apply_crop")}</button>
        </div>
      )}

      {!selectedId && tool === "adjust" && (
        <div style={s.panel}>
          {([
            { label: t("editor_brightness"), val: brightness, set: setBrightness },
            { label: t("editor_contrast"), val: contrast, set: setContrast },
            { label: t("editor_saturation"), val: saturation, set: setSaturation },
          ] as { label: string; val: number; set: (v: number) => void }[]).map(({ label, val, set }) => (
            <div key={label} style={{ ...s.row, marginBottom: 6 }}>
              <span style={{ ...s.label, minWidth: 90 }}>{label}</span>
              <input type="range" min={50} max={200} value={val}
                onChange={e => (set as (v: number) => void)(+e.target.value)} style={{ flex: 1 }} />
              <span style={{ color: "#8394b0", fontSize: 12, minWidth: 30 }}>{val}%</span>
            </div>
          ))}
          <button onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); }}
            style={{ ...s.toggleBtn, alignSelf: "flex-start" }}>
            {t("editor_reset")}
          </button>
        </div>
      )}

      {!selectedId && tool === "upscale" && (
        <div style={s.panel}>
          <div style={{ color: "#eef2f9", fontSize: 14, marginBottom: 10 }}>
            🔍 {t("editor_upscale_desc")}
            {upscaled && <span style={{ color: "#16c784", marginLeft: 8 }}>{t("editor_upscale_applied")}</span>}
          </div>
          <button onClick={doUpscale} disabled={upscaling}
            style={{ ...s.applyBtn, opacity: upscaling ? 0.5 : 1 }}>
            {upscaling ? t("editor_upscale_processing") : t("editor_upscale_btn")}
          </button>
        </div>
      )}

      {!selectedId && tool === "stickers" && (
        <div style={{ ...s.panel, padding: "10px 12px" }}>
          <div style={{ color: "#eef2f9", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("editor_stickers_tap")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STICKERS.map((def, i) => {
              const shapeStyle: React.CSSProperties =
                def.shape === "round"  ? { borderRadius: "50%", padding: "8px", minWidth: 52, textAlign: "center" } :
                def.shape === "star"   ? { borderRadius: "10px", padding: "6px 12px", transform: "rotate(-8deg)" } :
                def.shape === "badge"  ? { borderRadius: "5px 5px 5px 0", padding: "6px 11px" } :
                                         { borderRadius: 999, padding: "6px 14px" };
              return (
                <button key={i} onClick={() => addSticker(def)}
                  style={{ background: def.bg, color: def.color, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 800, letterSpacing: "0.05em",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)", ...shapeStyle }}>
                  {def.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={s.toolbar}>
        {([
          { key: "crop",     icon: "✂️", label: t("editor_crop")     },
          { key: "text",     icon: "T",  label: t("editor_text")     },
          { key: "addImage", icon: "🖼️", label: t("editor_photo")    },
          { key: "logo",     icon: "🏷️", label: t("editor_logo")     },
          { key: "adjust",   icon: "🎨", label: t("editor_adjust")   },
          { key: "upscale",  icon: "⬆",  label: t("editor_upscale")  },
          { key: "stickers", icon: "🏷",  label: t("editor_stickers") },
        ] as { key: Tool; icon: string; label: string }[]).map(({ key, icon, label }) => (
          <button key={key} onClick={() => {
            if (key === "addImage") { addImgRef.current?.click(); return; }
            if (key === "logo") { logoRef.current?.click(); return; }
            if (key === "text") {
              const layer: TextLayer = {
                id: Date.now().toString(), kind: "text",
                text: "Seu texto aqui", x: 20, y: 40,
                size: 28, color: "#ffffff", bold: false, shadow: true,
              };
              setLayers(l => [...l, layer]);
              setSelectedId(layer.id);
              setTool("none");
              return;
            }
            setSelectedId(null);
            setTool(t => t === key ? "none" : key);
          }} style={{ ...s.toolBtn, background: tool === key ? "rgba(168,85,247,0.15)" : "transparent",
            borderColor: tool === key ? "#a855f7" : "transparent" }}>
            <span style={{ fontSize: key === "text" ? 18 : 20, fontWeight: key === "text" ? 900 : 400 }}>{icon}</span>
            <span style={s.toolLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* Hidden file inputs */}
      <input ref={addImgRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => handleAddImg(ev.target?.result as string); r.readAsDataURL(f); e.target.value = ""; } }} />
      <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => handleAddImg(ev.target?.result as string); r.readAsDataURL(f); e.target.value = ""; } }} />

      <canvas ref={canvasRef} style={{ display: "none" }} />
      <BottomNav />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#07080b", paddingBottom: 68 },
  dlBtn: { background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  uploadWrap: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  uploadBox: { background: "#111820", border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 20, padding: "48px 32px", textAlign: "center", cursor: "pointer", width: "100%", maxWidth: 340 },
  uploadTopBar: { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#111820", borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" },
  uploadArrow: { marginLeft: "auto", fontSize: 28, color: "#a855f7", fontWeight: 300, lineHeight: 1 },
  previewEmpty: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#07080b", cursor: "pointer" },
  uploadCenterBtn: { background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-block" },
  preview: { position: "relative", flex: 1, overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, maxHeight: "calc(100vh - 240px)" },
  previewImg: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" },
  cropDark: { position: "absolute", background: "rgba(0,0,0,0.55)", pointerEvents: "none" },
  cropBorder: { position: "absolute", border: "2px solid #a855f7", pointerEvents: "none", boxSizing: "border-box" },
  textLayer: { position: "absolute", whiteSpace: "nowrap", lineHeight: 1.2, padding: "2px 4px", cursor: "grab" },
  imgLayerWrap: { position: "absolute", cursor: "grab" },
  stickerLayer: { position: "absolute", cursor: "grab", fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", whiteSpace: "nowrap", transformOrigin: "top left", boxShadow: "0 2px 10px rgba(0,0,0,0.5)" },
  delBtn: { position: "absolute", top: -10, right: -10, background: "#ef4444", border: "none", color: "#fff", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  scaleSlider: { position: "absolute", bottom: -24, left: 0, width: "100%", cursor: "pointer" },
  panel: { background: "#0c1018", borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 },
  selPanel: { background: "#0d1220", borderTop: "2px solid rgba(168,85,247,0.3)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", gap: 8 },
  label: { fontSize: 12, color: "#8394b0", whiteSpace: "nowrap" },
  textInput: { background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#eef2f9", fontSize: 15, padding: "8px 12px", width: "100%", boxSizing: "border-box" as const },
  colorPicker: { width: 32, height: 32, border: "none", background: "none", cursor: "pointer", borderRadius: 6, padding: 0 },
  toggleBtn: { border: "none", color: "#eef2f9", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  applyBtn: { background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", color: "#fff", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" },
  ratioBtn: { border: "none", color: "#eef2f9", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  toolbar: { background: "#0c1018", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-around", padding: "8px 0 4px" },
  toolBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "1px solid transparent", borderRadius: 10, padding: "6px 10px", cursor: "pointer", minWidth: 50 },
  toolLabel: { fontSize: 10, color: "#8394b0", fontWeight: 600 },
};
