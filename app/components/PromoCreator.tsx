"use client";

import { useRef, useState } from "react";

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
}

export default function PromoCreator({ onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [photo, setPhoto]         = useState<string | null>(null);
  const [nome, setNome]           = useState("");
  const [preco, setPreco]         = useState("");
  const [precoAnte, setPrecoAnte] = useState("");
  const [tagIdx, setTagIdx]       = useState(0);
  const [exporting, setExporting] = useState(false);

  const tag = TAGS[tagIdx];
  const desconto = precoAnte && preco
    ? Math.round((1 - Number(preco.replace(",", ".")) / Number(precoAnte.replace(",", "."))) * 100)
    : null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleDownload() {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.95);
      a.download = "promocao.jpg";
      a.click();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={s.wrap}>
      <button onClick={onBack} style={s.backBtn}>← Voltar</button>
      <div style={s.title}>Criar promoção</div>

      {/* Upload foto */}
      <div style={s.uploadZone} onClick={() => fileRef.current?.click()}>
        {photo
          ? <img src={photo} alt="produto" style={s.uploadImg} />
          : <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#eef2f9" }}>Foto do produto</div>
              <div style={{ fontSize: 12, color: "#4e5c72", marginTop: 4 }}>Clique para enviar</div>
            </>
        }
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      </div>

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
            <div ref={previewRef} style={s.card}>
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
  uploadImg: { width: "100%", height: "100%", objectFit: "cover" },

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
    width: 300, height: 300,
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
