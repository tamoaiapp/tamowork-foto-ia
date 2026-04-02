"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/app/components/BottomNav";

interface ExploreItem {
  id: string;
  output_image_url: string;
  prompt?: string;
  created_at: string;
  mode?: string;
}

export default function ExplorarPage() {
  const router = useRouter();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [token, setToken] = useState("");
  const [selected, setSelected] = useState<ExploreItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? "";
      setToken(t);
    });
  }, []);

  const fetchItems = useCallback(async (cursorVal: string | null = null) => {
    const url = `/api/explore${cursorVal ? `?cursor=${encodeURIComponent(cursorVal)}` : ""}`;
    const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    if (!res.ok) return;
    const data = await res.json();
    setItems((prev) => cursorVal ? [...prev, ...data.items] : data.items);
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function extractProduct(prompt?: string) {
    if (!prompt) return null;
    return prompt.split(" | cenário:")[0]?.trim() || null;
  }

  function extractCenario(prompt?: string) {
    if (!prompt) return null;
    return prompt.split(" | cenário:")[1]?.trim() || null;
  }

  function handleUseReference(item: ExploreItem) {
    const product = extractProduct(item.prompt);
    const cenario = extractCenario(item.prompt);
    const params = new URLSearchParams();
    if (product) params.set("produto", product);
    if (cenario) params.set("cenario", cenario);
    if (item.mode) params.set("mode", item.mode);
    router.push(`/?${params.toString()}`);
  }

  async function handleCopyPrompt(item: ExploreItem) {
    const text = item.prompt ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div style={s.page}>
      <div style={s.centered}>Carregando...</div>
      <BottomNav />
    </div>
  );

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.logo}>TamoWork</div>
        <div style={s.headerSub}>Explorar</div>
      </header>

      <main style={s.main}>
        {items.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
            <div>Nenhuma criação pública ainda.</div>
            <div style={{ fontSize: 13, color: "#4e5c72", marginTop: 6 }}>
              Seja o primeiro a compartilhar!
            </div>
          </div>
        ) : (
          <>
            <div style={s.grid}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={s.card}
                  onClick={() => setSelected(item)}
                >
                  <img
                    src={item.output_image_url}
                    alt="criação"
                    style={s.img}
                    loading="lazy"
                  />
                  {item.mode && item.mode !== "simulacao" && (
                    <span style={s.modeBadge}>{modeLabel(item.mode)}</span>
                  )}
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => fetchItems(cursor)}
                style={s.loadMoreBtn}
              >
                Carregar mais
              </button>
            )}
          </>
        )}
      </main>

      {/* Modal de detalhes */}
      {selected && (
        <div style={s.modalOverlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setSelected(null)}>✕</button>
            <img src={selected.output_image_url} alt="resultado" style={s.modalImg} />
            {selected.prompt && (
              <div style={s.promptBox}>
                <div style={s.promptLabel}>Criado com:</div>
                <div style={s.promptText}>
                  {extractProduct(selected.prompt)}
                  {extractCenario(selected.prompt) && (
                    <span style={{ color: "#4e5c72" }}> · {extractCenario(selected.prompt)}</span>
                  )}
                </div>
              </div>
            )}
            <button
              style={s.useRefBtn}
              onClick={() => handleUseReference(selected)}
            >
              ✨ Usar como referência
            </button>
            <button
              style={s.copyBtn}
              onClick={() => handleCopyPrompt(selected)}
            >
              {copied ? "✓ Copiado!" : "📋 Copiar prompt"}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    fundo_branco: "Fundo branco",
    catalogo: "Catálogo",
    personalizado: "Personalizado",
    simulacao: "Simulação",
  };
  return labels[mode] ?? mode;
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07080b", paddingBottom: 80 },
  centered: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#4e5c72" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#0c1018", position: "sticky", top: 0, zIndex: 10,
  },
  logo: {
    fontSize: 18, fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  headerSub: { fontSize: 14, color: "#8394b0", fontWeight: 500 },
  main: { maxWidth: 560, margin: "0 auto", padding: "16px" },
  empty: { textAlign: "center", padding: "60px 24px", color: "#8394b0", fontSize: 15 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  card: {
    position: "relative", borderRadius: 12, overflow: "hidden",
    cursor: "pointer", background: "#111820",
    aspectRatio: "1",
  },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  modeBadge: {
    position: "absolute", bottom: 6, left: 6,
    background: "rgba(0,0,0,0.7)", color: "#a855f7",
    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
    backdropFilter: "blur(4px)",
  },
  loadMoreBtn: {
    display: "block", width: "100%", marginTop: 16,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "12px", color: "#8394b0", fontSize: 14, cursor: "pointer",
  },

  // Modal
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 100, padding: "0",
  },
  modal: {
    background: "#0c1018", borderRadius: "20px 20px 0 0",
    padding: "20px 20px 40px", width: "100%", maxWidth: 560,
    display: "flex", flexDirection: "column", gap: 12,
    maxHeight: "90vh", overflowY: "auto",
  },
  closeBtn: {
    alignSelf: "flex-end", background: "rgba(255,255,255,0.07)",
    border: "none", borderRadius: 8, color: "#8394b0",
    width: 32, height: 32, cursor: "pointer", fontSize: 14,
  },
  modalImg: { width: "100%", borderRadius: 14, objectFit: "cover", maxHeight: 400 },
  promptBox: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: "12px 14px",
  },
  promptLabel: { fontSize: 11, color: "#4e5c72", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" },
  promptText: { fontSize: 13, color: "#8394b0", lineHeight: 1.5 },
  useRefBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 12, padding: "13px",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
  copyBtn: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "11px",
    color: "#8394b0", fontSize: 14, cursor: "pointer",
  },
};
