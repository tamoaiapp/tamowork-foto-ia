"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";


interface ExploreItem {
  id: string;
  media_url: string;
  prompt?: string;
  created_at: string;
  type: "photo" | "video";
  likes: number;
  liked: boolean;
}

function extractProduct(prompt?: string) {

  if (!prompt) return null;
  const clean = prompt.startsWith("model_img:") ? prompt.split(" | ").slice(1).join(" | ") : prompt;
  return clean.split(" | cenário:")[0]?.trim() || null;
}

function fakeLikes(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % 97) + 3;
}

export default function FeedPage() {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [token, setToken] = useState("");
  const loadingMore = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? "");
    });
  }, []);

  const fetchItems = useCallback(async (cursorVal: string | null = null) => {
    if (loadingMore.current) return;
    loadingMore.current = true;
    const url = `/api/explore${cursorVal ? `?cursor=${encodeURIComponent(cursorVal)}` : ""}`;
    const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    if (res.ok) {
      const data = await res.json();
      setItems(prev => cursorVal ? [...prev, ...data.items] : data.items);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    }
    setLoading(false);
    loadingMore.current = false;
  }, [token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function toggleLike(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, liked: !item.liked, likes: item.liked ? item.likes - 1 : item.likes + 1 }
        : item
    ));
    // Persiste no servidor
    if (token) {
      await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: id }),
      }).catch(() => {});
    }
  }

  // Scroll infinito: carrega mais quando chega perto do fim
  const containerRef = useRef<HTMLDivElement>(null);
  function handleScroll() {
    const el = containerRef.current;
    if (!el || !hasMore) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - el.clientHeight * 1.5;
    if (nearBottom) fetchItems(cursor);
  }

  if (loading) return (
    <div style={sk.page}>
      {[0,1,2].map(i => <div key={i} style={sk.card} />)}
      
      <style>{`@keyframes skP{0%,100%{opacity:.6}50%{opacity:.2}}`}</style>
    </div>
  );

  return (
    <div ref={containerRef} style={s.page} onScroll={handleScroll}>
      <style>{`
        @keyframes heartPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
      `}</style>

      {items.map((item) => {
        const nome = extractProduct(item.prompt);
        const isLiked = item.liked;
        const likes = item.likes;

        return (
          <div key={item.id} style={s.slide}>
            {/* Mídia de fundo */}
            {item.type === "video" ? (
              <video
                src={item.media_url}
                style={s.img}
                autoPlay muted loop playsInline
              />
            ) : (
              <img src={item.media_url} alt="" style={s.img} />
            )}

            {/* Gradiente inferior */}
            <div style={s.gradient} />

            {/* Info inferior esquerda */}
            <div style={s.info}>
              {nome && <div style={s.nome}>{nome}</div>}
              {item.type === "video" && <div style={s.modeBadge}>🎬 Vídeo IA</div>}
            </div>

            {/* Ações direita */}
            <div style={s.actions}>
              <button
                style={s.actionBtn}
                onClick={(e) => toggleLike(item.id, e)}
              >
                <svg
                  width="28" height="28" viewBox="0 0 24 24"
                  fill={isLiked ? "#ef4444" : "none"}
                  stroke={isLiked ? "#ef4444" : "#fff"}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: isLiked ? "heartPop 0.3s ease" : "none", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span style={s.actionCount}>{likes}</span>
              </button>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 24, height: 24, border: "2px solid #a855f7", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      
    </div>
  );
}

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    fundo_branco: "Fundo branco", catalogo: "Catálogo",
    personalizado: "Personalizado", simulacao: "Simulação", video: "Vídeo",
  };
  return labels[mode] ?? mode;
}

const s: Record<string, React.CSSProperties> = {
  page: {
    height: "100dvh",
    overflowY: "scroll",
    scrollSnapType: "y mandatory",
    background: "#000",
    paddingBottom: 64,
  },
  slide: {
    position: "relative",
    width: "100%",
    height: "100dvh",
    scrollSnapAlign: "start",
    scrollSnapStop: "always",
    overflow: "hidden",
    background: "#0c1018",
    flexShrink: 0,
  },
  img: {
    position: "absolute", inset: 0,
    width: "100%", height: "100%",
    objectFit: "cover",
    display: "block",
  },
  gradient: {
    position: "absolute", inset: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 40%, transparent 70%)",
    pointerEvents: "none",
  },
  info: {
    position: "absolute",
    bottom: 80, left: 16, right: 70,
  },
  nome: {
    fontSize: 16, fontWeight: 700, color: "#fff",
    textShadow: "0 1px 8px rgba(0,0,0,0.7)",
    marginBottom: 6,
  },
  modeBadge: {
    display: "inline-block",
    background: "rgba(168,85,247,0.35)",
    border: "1px solid rgba(168,85,247,0.5)",
    backdropFilter: "blur(6px)",
    borderRadius: 20, padding: "3px 10px",
    fontSize: 11, fontWeight: 700, color: "#e9d5ff",
  },
  actions: {
    position: "absolute",
    bottom: 80, right: 12,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
  },
  actionBtn: {
    background: "none", border: "none", cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    padding: 0,
  },
  actionCount: {
    fontSize: 12, fontWeight: 700, color: "#fff",
    textShadow: "0 1px 4px rgba(0,0,0,0.7)",
  },
};

const sk: Record<string, React.CSSProperties> = {
  page: { height: "100dvh", background: "#000", overflow: "hidden", paddingBottom: 64 },
  card: {
    width: "100%", height: "100dvh",
    background: "linear-gradient(180deg, #0c1018 0%, #111820 100%)",
    animation: "skP 1.4s ease-in-out infinite",
  },
};
