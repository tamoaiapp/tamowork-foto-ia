"use client";

import { useRef, useState } from "react";
import { downloadBlob } from "@/lib/downloadBlob";

const TAGS = [
  { label: "🔥 PROMOÇÃO",    bg: "#ef4444" },
  { label: "⚡ OFERTA",      bg: "#f97316" },
  { label: "🆕 LANÇAMENTO",  bg: "#8b5cf6" },
  { label: "⭐ DESTAQUE",    bg: "#eab308" },
  { label: "🎁 EXCLUSIVO",   bg: "#10b981" },
  { label: "🔴 QUEIMA",      bg: "#dc2626" },
];

interface Props {
  onBack: () => void;
  initialPhoto?: string;
}

export default function PromoCreator({ onBack, initialPhoto }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [photo, setPhoto]         = useState<string | null>(initialPhoto ?? null);
  const [photoRatio, setPhotoRatio] = useState<number>(1); // width/height natural
  const [nome, setNome]           = useState("");
  const [preco, setPreco]         = useState("");
  const [precoAnte, setPrecoAnte] = useState("");
  const [tagIdx, setTagIdx]       = useState(0);
  const [exporting, setExporting] = useState(false);

  const tag = TAGS[tagIdx];
  const desconto = precoAnte && preco
    ? Math.round((1 - Number(preco.replace(",", ".")) / Number(precoAnte.replace(",", "."))) * 100)
    : null;

  // Dimensões do card: largura fixa 300, altura proporcional à foto (máx 500, mín 220)
  const CARD_W = 300;
  const CARD_H = Math.min(500, Math.max(220, Math.round(CARD_W / photoRatio)));

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      // Mede ratio natural antes de setar
      const img = new Image();
      img.onload = () => {
        setPhotoRatio(img.naturalWidth / img.naturalHeight);
        setPhoto(src);
      };
      img.src = src;
    };
    reader.readAsDataURL(f);
  }

  // Também detecta ratio do initialPhoto ao montar
  useState(() => {
    if (initialPhoto) {
      const img = new Image();
      img.onload = () => setPhotoRatio(img.naturalWidth / img.naturalHeight);
      img.src = initialPhoto;
    }
  });

  async function handleDownload() {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      // Canvas 2D nativo — preserva proporções da foto original
      const OUTPUT_W = 1080;
      const OUTPUT_H = Math.round(OUTPUT_W / photoRatio);

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
      const ctx = canvas.getContext("2d")!;

      const scaleX = OUTPUT_W / CARD_W;
      const scaleY = OUTPUT_H / CARD_H;

      // Fundo
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);

      // Foto de fundo
      if (photo) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = photo;
        await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
        ctx.drawImage(img, 0, 0, OUTPUT_W, OUTPUT_H);
        // Gradiente inferior
        const grad = ctx.createLinearGradient(0, OUTPUT_H * 0.4, 0, OUTPUT_H);
        grad.addColorStop(0, "rgba(0,0,0,0.05)");
        grad.addColorStop(1, "rgba(0,0,0,0.85)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);
      }

      // Badge tag
      const TAG_X = 14 * scaleX;
      const TAG_Y = 14 * scaleY;
      const TAG_PAD_X = 12 * scaleX;
      const TAG_PAD_Y = 5 * scaleY;
      const TAG_FONT = Math.round(12 * scaleY);
      ctx.font = `800 ${TAG_FONT}px Outfit, sans-serif`;
      const tagW = ctx.measureText(tag.label).width + TAG_PAD_X * 2;
      const tagH = TAG_FONT + TAG_PAD_Y * 2;
      const tagR = 10 * Math.min(scaleX, scaleY);
      ctx.fillStyle = tag.bg;
      roundRect(ctx, TAG_X, TAG_Y, tagW, tagH, tagR);
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(tag.label, TAG_X + TAG_PAD_X, TAG_Y + tagH / 2);

      // Badge desconto
      if (desconto && desconto > 0 && desconto < 100) {
        const discText = `-${desconto}%`;
        ctx.font = `900 ${Math.round(13 * scaleY)}px Outfit, sans-serif`;
        const discW = ctx.measureText(discText).width + TAG_PAD_X * 2;
        const discH = Math.round(13 * scaleY) + TAG_PAD_Y * 2;
        const discX = OUTPUT_W - 14 * scaleX - discW;
        const discY = TAG_Y;
        ctx.fillStyle = "#fff";
        roundRect(ctx, discX, discY, discW, discH, tagR);
        ctx.fillStyle = "#ef4444";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(discText, discX + TAG_PAD_X, discY + discH / 2);
      }

      // Texto inferior
      const BOT_LEFT = 16 * scaleX;
      const BOT_RIGHT = OUTPUT_W - 16 * scaleX;
      let curY = OUTPUT_H - 16 * scaleY;

      // Preço novo
      if (preco) {
        const precoText = `R$ ${preco}`;
        ctx.font = `900 ${Math.round(24 * scaleY)}px Outfit, sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillText(precoText, BOT_LEFT, curY);
        curY -= Math.round(24 * scaleY) * 1.2;
      }

      // Preço antes (riscado)
      if (precoAnte) {
        const precoAnteText = `R$ ${precoAnte}`;
        ctx.font = `400 ${Math.round(13 * scaleY)}px Outfit, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "left";
        ctx.fillText(precoAnteText, BOT_LEFT, curY);
        // Linha riscada
        const tw = ctx.measureText(precoAnteText).width;
        const lineY = curY - Math.round(13 * scaleY) * 0.35;
        ctx.beginPath();
        ctx.moveTo(BOT_LEFT, lineY);
        ctx.lineTo(BOT_LEFT + tw, lineY);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        curY -= Math.round(13 * scaleY) * 1.5;
      }

      // Nome do produto
      if (nome) {
        ctx.font = `700 ${Math.round(16 * scaleY)}px Outfit, sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        // Quebra linha se necessário
        const words = nome.split(" ");
        let line = "";
        const lines: string[] = [];
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (ctx.measureText(test).width > BOT_RIGHT - BOT_LEFT) {
            if (line) lines.push(line);
            line = w;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        for (let i = lines.length - 1; i >= 0; i--) {
          ctx.fillText(lines[i], BOT_LEFT, curY);
          curY -= Math.round(16 * scaleY) * 1.3;
        }
      }

      // Exporta
      canvas.toBlob(async blob => {
        if (!blob) return;
        await downloadBlob(blob, "promocao.jpg");
        setExporting(false);
      }, "image/jpeg", 0.95);
    } catch {
      setExporting(false);
    }
  }

  return (
    <div style={s.wrap}>
      <button onClick={onBack} style={s.backBtn}>← Voltar</button>
      <div style={s.title}>Criar promoção</div>

      {/* Upload foto — só mostra quando não tem foto ainda */}
      {!photo && (
        <div style={s.uploadZone} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#eef2f9" }}>Foto do produto</div>
          <div style={{ fontSize: 12, color: "#4e5c72", marginTop: 4 }}>Clique para enviar</div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        </div>
      )}
      {photo && (
        <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", color: "#4e5c72", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", textAlign: "left" }}>
          📷 Trocar foto
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        </button>
      )}

      {/* Campos */}
      <div style={s.fields}>
        <div style={s.fieldGroup}>
          <label style={s.label}>Nome do produto</label>
          <input
            style={s.input}
            placeholder="Ex: Tênis Air Max branco"
            value={nome}
            onChange={e => setNome(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ ...s.fieldGroup, flex: 1 }}>
            <label style={s.label}>Preço de <span style={{ color: "#4e5c72" }}>(opcional)</span></label>
            <input
              style={s.input}
              placeholder="R$ 99,90"
              value={precoAnte}
              onChange={e => setPrecoAnte(e.target.value)}
            />
          </div>
          <div style={{ ...s.fieldGroup, flex: 1 }}>
            <label style={s.label}>Preço por</label>
            <input
              style={s.input}
              placeholder="R$ 69,90"
              value={preco}
              onChange={e => setPreco(e.target.value)}
            />
          </div>
        </div>

        {/* Seletor de tag */}
        <div style={s.fieldGroup}>
          <label style={s.label}>Tag</label>
          <div style={s.tagGrid}>
            {TAGS.map((t, i) => (
              <button
                key={i}
                onClick={() => setTagIdx(i)}
                style={{
                  ...s.tagBtn,
                  background: tagIdx === i ? t.bg : "rgba(255,255,255,0.05)",
                  border: tagIdx === i ? `1.5px solid ${t.bg}` : "1.5px solid rgba(255,255,255,0.1)",
                  color: tagIdx === i ? "#fff" : "#8394b0",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      {(photo || nome || preco) && (
        <div style={s.previewSection}>
          <div style={s.previewLabel}>Prévia</div>
          <div style={s.previewOuter}>
            <div ref={previewRef} style={{ ...s.card, width: CARD_W, height: CARD_H }}>
              {/* Foto */}
              {photo && (
                <div style={s.cardImgWrap}>
                  <img src={photo} alt="" style={s.cardImg} />
                  <div style={s.cardGradient} />
                </div>
              )}
              {!photo && <div style={s.cardImgPlaceholder} />}

              {/* Badge tag */}
              <div style={{ ...s.cardTag, background: tag.bg }}>{tag.label}</div>

              {/* Desconto badge */}
              {desconto && desconto > 0 && desconto < 100 && (
                <div style={s.descontoBadge}>-{desconto}%</div>
              )}

              {/* Texto inferior */}
              <div style={s.cardBottom}>
                {nome && <div style={s.cardNome}>{nome}</div>}
                <div style={s.cardPrecos}>
                  {precoAnte && (
                    <span style={s.precoAnte}>R$ {precoAnte}</span>
                  )}
                  {preco && (
                    <span style={s.precoNovo}>R$ {preco}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={exporting}
            style={{ ...s.downloadBtn, opacity: exporting ? 0.6 : 1 }}
          >
            {exporting ? "Gerando..." : "⬇ Baixar promoção"}
          </button>
        </div>
      )}
    </div>
  );
}

// Helper: retângulo com bordas arredondadas para Canvas 2D
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 16 },
  backBtn: {
    background: "transparent", border: "none", color: "#8394b0",
    fontSize: 14, cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center", gap: 4, fontWeight: 600, width: "fit-content",
  },
  title: { fontSize: 20, fontWeight: 800, color: "#eef2f9" },

  uploadZone: {
    border: "2px dashed rgba(255,255,255,0.12)",
    borderRadius: 16, height: 160,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    cursor: "pointer", overflow: "hidden",
    background: "#111820",
  },

  fields: { display: "flex", flexDirection: "column", gap: 14 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: "#8394b0", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  input: {
    background: "#111820", border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "11px 14px", color: "#eef2f9",
    fontSize: 14, outline: "none", width: "100%",
    boxSizing: "border-box" as const,
  },

  tagGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  tagBtn: {
    borderRadius: 10, padding: "8px 4px", fontSize: 11,
    fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
  },

  // Preview
  previewSection: { display: "flex", flexDirection: "column", gap: 14 },
  previewLabel: { fontSize: 12, fontWeight: 700, color: "#8394b0", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  previewOuter: { display: "flex", justifyContent: "center" },

  card: {
    borderRadius: 20, overflow: "hidden",
    position: "relative" as const,
    background: "#1a1a2e",
    flexShrink: 0,
  },
  cardImgWrap: { position: "absolute" as const, inset: 0 },
  cardImg: { width: "100%", height: "100%", objectFit: "cover" },
  cardGradient: {
    position: "absolute" as const, inset: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
  },
  cardImgPlaceholder: { width: "100%", height: "100%", background: "#111820" },

  cardTag: {
    position: "absolute" as const, top: 14, left: 14,
    borderRadius: 10, padding: "5px 12px",
    fontSize: 12, fontWeight: 800, color: "#fff",
    letterSpacing: "0.03em",
  },
  descontoBadge: {
    position: "absolute" as const, top: 14, right: 14,
    background: "#fff", borderRadius: 10,
    padding: "5px 10px", fontSize: 13, fontWeight: 900,
    color: "#ef4444",
  },
  cardBottom: {
    position: "absolute" as const, bottom: 16, left: 16, right: 16,
  },
  cardNome: {
    fontSize: 16, fontWeight: 700, color: "#fff",
    marginBottom: 6, lineHeight: 1.3,
    textShadow: "0 1px 6px rgba(0,0,0,0.5)",
  },
  cardPrecos: { display: "flex", alignItems: "center", gap: 10 },
  precoAnte: {
    fontSize: 13, color: "rgba(255,255,255,0.55)",
    textDecoration: "line-through",
  },
  precoNovo: {
    fontSize: 24, fontWeight: 900, color: "#fff",
    textShadow: "0 2px 8px rgba(0,0,0,0.4)",
  },

  downloadBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14, padding: "15px 0",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
};
