"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";


// Modo → label amigável
const MODE_LABELS: Record<string, string> = {
  simulacao: "📸 Foto lifestyle",
  fundo_branco: "⬜ Fundo branco",
  catalogo: "🧍 Com modelo",
  personalizado: "✏️ Personalizado",
  video: "🎬 Vídeo curto",
  video_narrado: "🎙️ Vídeo narrado",
  video_longo: "🎞️ Vídeo longo 30s",
};

const MODE_TIPO: Record<string, "foto" | "video"> = {
  simulacao: "foto",
  fundo_branco: "foto",
  catalogo: "foto",
  personalizado: "foto",
  video: "video",
  video_narrado: "video",
  video_longo: "video",
};

type ItemMode = keyof typeof MODE_LABELS;

interface BatchItem {
  input_image_url: string;
  mode: ItemMode;
  prompt?: string;
  // campos retornados pelo agente:
  job_id?: string;
  result_status?: string;
  output_url?: string;
}

interface BatchJob {
  id: string;
  status: string;
  items: BatchItem[];
  current_index: number;
  scheduled_at: string;
  started_at?: string;
  error_message?: string;
  created_at: string;
}

interface RecentPhoto {
  id: string;
  output_image_url: string;
  input_image_url: string;
}

export default function MadrugadaPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [loading, setLoading] = useState(true);
  const [activeBatch, setActiveBatch] = useState<BatchJob | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);

  // Formulário de novo lote
  const [selectedItems, setSelectedItems] = useState<BatchItem[]>([]);
  const [scheduledHour, setScheduledHour] = useState("03:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: session } = await supabase.auth.getSession();
      const tk = session.session?.access_token ?? "";
      setToken(tk);

      // Plano
      const planRes = await fetch("/api/account", { headers: { Authorization: `Bearer ${tk}` } });
      if (planRes.ok) {
        const d = await planRes.json();
        setPlan(d.plan ?? "free");
      }

      // Lote ativo
      const batchRes = await fetch("/api/batch", { headers: { Authorization: `Bearer ${tk}` } });
      if (batchRes.ok) {
        const batches = await batchRes.json();
        const active = (batches as BatchJob[]).find(b => ["scheduled", "running"].includes(b.status));
        setActiveBatch(active ?? null);
      }

      // Fotos recentes prontas
      const photosRes = await fetch("/api/account", { headers: { Authorization: `Bearer ${tk}` } });
      if (photosRes.ok) {
        const d = await photosRes.json();
        const photos = (d.jobs ?? [])
          .filter((j: { status: string; output_image_url?: string }) => j.status === "done" && j.output_image_url)
          .slice(0, 12);
        setRecentPhotos(photos);
      }

      setLoading(false);
    });
  }, [router]);

  function addItem(photo: RecentPhoto, mode: ItemMode) {
    if (selectedItems.length >= 10) { setError("Máximo de 10 itens por lote."); return; }
    // Evitar duplicata exata
    const exists = selectedItems.some(i => i.input_image_url === photo.output_image_url && i.mode === mode);
    if (exists) return;
    setSelectedItems(prev => [...prev, { input_image_url: photo.output_image_url, mode }]);
    setError("");
  }

  function removeItem(index: number) {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (selectedItems.length === 0) { setError("Adicione pelo menos 1 item."); return; }
    setSubmitting(true);
    setError("");

    // Montar horário agendado para hoje ou amanhã
    const [h, m] = scheduledHour.split(":").map(Number);
    const scheduledDate = new Date();
    scheduledDate.setHours(h, m, 0, 0);
    if (scheduledDate.getTime() < Date.now() + 60000) {
      // já passou — agendar para amanhã mesmo horário
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    const res = await fetch("/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: selectedItems, scheduled_at: scheduledDate.toISOString() }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error === "already_scheduled") {
        setError("Você já tem um lote agendado. Cancele o atual para criar um novo.");
      } else if (data.error === "pro_required") {
        setError("Esta função é exclusiva do plano PRO.");
      } else {
        setError(data.error || "Erro ao agendar lote.");
      }
      setSubmitting(false);
      return;
    }

    setSuccess(`✅ Lote agendado para ${scheduledDate.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}!`);
    setSelectedItems([]);

    // Recarregar lote ativo
    const batchRes = await fetch("/api/batch", { headers: { Authorization: `Bearer ${token}` } });
    if (batchRes.ok) {
      const batches = await batchRes.json();
      const active = (batches as BatchJob[]).find(b => ["scheduled", "running"].includes(b.status));
      setActiveBatch(active ?? null);
    }
    setSubmitting(false);
  }

  async function handleCancel() {
    if (!activeBatch) return;
    if (!confirm("Cancelar o lote agendado?")) return;
    await fetch(`/api/batch?id=${activeBatch.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setActiveBatch(null);
    setSuccess("Lote cancelado.");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#8394b0" }}>Carregando...</div>
    </div>
  );

  if (plan !== "pro") return (
    <div style={{ minHeight: "100vh", background: "#07080b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
      <div style={{ fontSize: 48 }}>🌙</div>
      <div style={{ color: "#eef2f9", fontSize: 20, fontWeight: 700, textAlign: "center" }}>Exclusivo para membros PRO</div>
      <div style={{ color: "#8394b0", textAlign: "center", maxWidth: 300 }}>Agende criações em lote para rodar de madrugada, sem parar nada do que você faz durante o dia.</div>
      <button onClick={() => router.push("/planos")} style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", fontWeight: 700, fontSize: 16, cursor: "pointer", marginTop: 8 }}>
        Ver planos PRO
      </button>
      
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#07080b", color: "#eef2f9", fontFamily: "Outfit, sans-serif", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#8394b0", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 16 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 32 }}>🌙</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Trabalho enquanto você dorme</div>
            <div style={{ color: "#8394b0", fontSize: 14 }}>Agende até 10 criações para rodar de madrugada</div>
          </div>
        </div>
      </div>

      {/* Como funciona */}
      <div style={{ margin: "16px 20px", background: "#111820", borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 13, color: "#8394b0", lineHeight: 1.6 }}>
          <strong style={{ color: "#eef2f9" }}>Como funciona:</strong> Você escolhe as fotos e os tipos de criação. O sistema processa <strong>1 por vez</strong>, de forma inteligente, para não sobrecarregar. Quando terminar, você recebe uma notificação.
        </div>
      </div>

      {/* Lote ativo */}
      {activeBatch && (
        <div style={{ margin: "0 20px 20px", background: activeBatch.status === "running" ? "rgba(99,102,241,0.1)" : "rgba(251,191,36,0.08)", border: `1px solid ${activeBatch.status === "running" ? "rgba(99,102,241,0.3)" : "rgba(251,191,36,0.3)"}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {activeBatch.status === "running" ? "⚙️ Lote em andamento" : "⏰ Lote agendado"}
          </div>
          <div style={{ color: "#8394b0", fontSize: 13, marginBottom: 4 }}>
            {activeBatch.items.length} itens •{" "}
            {activeBatch.status === "running"
              ? `${activeBatch.current_index} de ${activeBatch.items.length} concluídos`
              : `Inicia às ${new Date(activeBatch.scheduled_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}`}
          </div>

          {/* Progresso dos itens */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {activeBatch.items.map((item, i) => {
              const isDone = item.result_status === "done";
              const isFailed = item.result_status === "failed" || item.result_status === "timeout";
              const isActive = activeBatch.status === "running" && i === activeBatch.current_index;
              const isPending = i > activeBatch.current_index;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                  <div style={{ fontSize: 16 }}>{isDone ? "✅" : isFailed ? "❌" : isActive ? "⏳" : "⬜"}</div>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <span style={{ color: isPending ? "#4e5c72" : "#eef2f9" }}>{MODE_LABELS[item.mode] ?? item.mode}</span>
                    {isActive && <span style={{ color: "#a855f7", marginLeft: 6 }}>criando...</span>}
                  </div>
                  {item.output_url && (
                    <a href={item.output_url} target="_blank" rel="noreferrer" style={{ color: "#a855f7", fontSize: 12, textDecoration: "none" }}>ver</a>
                  )}
                </div>
              );
            })}
          </div>

          {activeBatch.status === "scheduled" && (
            <button onClick={handleCancel} style={{ marginTop: 12, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "#8394b0", cursor: "pointer", fontSize: 13 }}>
              Cancelar lote
            </button>
          )}
        </div>
      )}

      {/* Formulário novo lote (só se não tem lote ativo) */}
      {!activeBatch && (
        <div style={{ padding: "0 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Montar novo lote</div>

          {/* Fotos recentes para adicionar */}
          {recentPhotos.length > 0 ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#8394b0", fontSize: 13, marginBottom: 10 }}>Clique numa foto e escolha o tipo de criação:</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {recentPhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} onAdd={addItem} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: "#8394b0", fontSize: 14, marginBottom: 20, padding: 16, background: "#111820", borderRadius: 12, textAlign: "center" }}>
              Crie algumas fotos primeiro para poder adicioná-las ao lote.
            </div>
          )}

          {/* Itens selecionados */}
          {selectedItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                Itens do lote ({selectedItems.length}/10):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedItems.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#111820", borderRadius: 10 }}>
                    <img src={item.input_image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                    <div style={{ flex: 1, fontSize: 13 }}>{MODE_LABELS[item.mode]}</div>
                    <span style={{ fontSize: 11, color: "#4e5c72", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>{MODE_TIPO[item.mode]}</span>
                    <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "#4e5c72", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Horário */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, color: "#8394b0", display: "block", marginBottom: 6 }}>Horário para iniciar:</label>
            <input
              type="time"
              value={scheduledHour}
              onChange={e => setScheduledHour(e.target.value)}
              style={{ background: "#111820", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#eef2f9", fontSize: 15, width: "100%", boxSizing: "border-box" }}
            />
            <div style={{ color: "#4e5c72", fontSize: 12, marginTop: 4 }}>
              Se o horário já passou hoje, o lote vai rodar amanhã nesse mesmo horário.
            </div>
          </div>

          {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", borderRadius: 10 }}>{error}</div>}
          {success && <div style={{ color: "#16c784", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "rgba(22,199,132,0.1)", borderRadius: 10 }}>{success}</div>}

          <button
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0}
            style={{
              width: "100%",
              background: selectedItems.length === 0 ? "#1a2030" : "linear-gradient(135deg,#6366f1,#a855f7)",
              color: selectedItems.length === 0 ? "#4e5c72" : "#fff",
              border: "none",
              borderRadius: 14,
              padding: "16px",
              fontWeight: 700,
              fontSize: 16,
              cursor: selectedItems.length === 0 ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {submitting ? "Agendando..." : `🌙 Agendar ${selectedItems.length > 0 ? `${selectedItems.length} criação${selectedItems.length > 1 ? "ões" : ""}` : "lote"}`}
          </button>
        </div>
      )}

      
    </div>
  );
}

// ── Sub-componente: card de foto com seletor de modo ─────────────────────────
function PhotoCard({ photo, onAdd }: { photo: RecentPhoto; onAdd: (photo: RecentPhoto, mode: ItemMode) => void }) {
  const [open, setOpen] = useState(false);

  const modes: ItemMode[] = ["simulacao", "fundo_branco", "catalogo", "video", "video_longo"];

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ aspectRatio: "1", background: "#111820", borderRadius: 10, overflow: "hidden", cursor: "pointer", border: open ? "2px solid #a855f7" : "2px solid transparent" }}
      >
        <img src={photo.output_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", padding: "4px 6px", textAlign: "center", fontSize: 11, color: "#eef2f9" }}>
          {open ? "✕ fechar" : "+ adicionar"}
        </div>
      </div>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1a2030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, zIndex: 10, overflow: "hidden" }}>
          {modes.map(mode => (
            <div
              key={mode}
              onClick={() => { onAdd(photo, mode); setOpen(false); }}
              style={{ padding: "9px 12px", cursor: "pointer", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#eef2f9" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(168,85,247,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {MODE_LABELS[mode]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
