"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";
import { useI18n } from "@/lib/i18n";

interface AccountJob {
  id: string;
  status: string;
  type: "photo" | "video";
  source?: "image_jobs" | "video_jobs" | "narrated_video_jobs" | "long_video_jobs";
  output_image_url?: string;
  output_video_url?: string;
  input_image_url?: string;
  created_at: string;
  prompt?: string;
}

function formatDate(iso?: string, lang?: string) {
  if (!iso) return "";
  const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

export default function CriacoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AccountJob[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [selected, setSelected] = useState<AccountJob | null>(null);
  const [videoBlocked, setVideoBlocked] = useState<"photo" | "video" | null>(null);
  const { t, lang } = useI18n();

  async function loadJobs(tok: string) {
    const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${tok}` } });
    if (res.ok) {
      const data = await res.json();
      setJobs((data.jobs ?? []).filter((j: AccountJob) =>
        j.status === "done" && (j.output_image_url || j.output_video_url)
      ));
    }
  }

  useEffect(() => {
    let savedToken = "";
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: session } = await supabase.auth.getSession();
      savedToken = session.session?.access_token ?? "";
      setToken(savedToken);
      await loadJobs(savedToken);
      setLoading(false);
    });

    // Recarrega ao voltar para a aba (ex: depois de criar no Tamo)
    function onVisibility() {
      if (document.visibilityState === "visible" && savedToken) {
        loadJobs(savedToken);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  function deleteEndpoint(job: AccountJob) {
    switch (job.source) {
      case "video_jobs": return `/api/video-jobs/${job.id}`;
      case "narrated_video_jobs": return `/api/narrated-video/${job.id}`;
      case "long_video_jobs": return `/api/long-video/${job.id}`;
      default: return `/api/image-jobs/${job.id}`;
    }
  }

  async function handleDelete(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (!job || !confirm(t("criacoes_confirm_delete"))) return;
    setDeletingId(id);
    await fetch(deleteEndpoint(job), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setDeletingId(null);
    if (selected?.id === id) setSelected(null);
  }

  if (loading) return <div style={s.centered}>{t("loading")}</div>;

  return (
    <div style={s.page} className="app-layout">
      <AppHeader subtitle={t("criacoes_title")} />

      <main style={s.main} className="app-main">
        {jobs.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📸</div>
            <div style={{ fontSize: 18, color: "#eef2f9", fontWeight: 700, marginBottom: 8 }}>
              {lang === "en" ? "Your photos appear here" : lang === "es" ? "Tus fotos aparecen aquí" : "Suas fotos aparecem aqui"}
            </div>
            <div style={{ fontSize: 14, color: "#8394b0", marginBottom: 8, lineHeight: 1.6, maxWidth: 260, textAlign: "center" }}>
              {lang === "en" ? "You haven't created any photos yet. Start now — it's easy and fast!" : lang === "es" ? "Aún no creaste ninguna foto. ¡Empieza ahora — es fácil y rápido!" : "Você ainda não criou nenhuma foto. Comece agora — é fácil e rápido!"}
            </div>
            <div style={{ fontSize: 13, color: "#4e5c72", marginBottom: 24 }}>
              {lang === "en" ? "Take a photo of your product and watch the magic happen." : lang === "es" ? "Toma una foto de tu producto y mira cómo ocurre la magia." : "Tire uma foto do seu produto e veja a mágica acontecer."}
            </div>
            <button onClick={() => router.push("/tamo")} style={s.createBtn}>
              {lang === "en" ? "Create my first photo" : lang === "es" ? "Crear mi primera foto" : "Criar minha primeira foto"}
            </button>
          </div>
        ) : (
          <div style={s.grid} className="criacoes-grid">
            {jobs.map((job) => (
              <div key={job.id} style={s.card} onClick={() => setSelected(job)}>
                {job.type === "video" ? (
                  <div style={{ position: "relative", width: "100%", height: "100%" }}>
                    {/* Thumbnail estático no grid — usa input_image_url para não crashar iOS */}
                    <img
                      src={job.input_image_url ?? job.output_video_url ?? ""}
                      alt="vídeo"
                      style={s.img}
                    />
                    <div style={s.videoBadge}>▶</div>
                  </div>
                ) : (
                  <img src={job.output_image_url!} alt="foto" style={s.img} />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de foto / vídeo */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            {selected.type === "video" && selected.output_video_url ? (
              <video
                src={selected.output_video_url}
                style={s.modalImg}
                controls
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img src={selected.output_image_url!} alt="foto" style={s.modalImg} />
            )}
            <div style={{ display: "flex", gap: 8, padding: "14px 16px 0" }}>
              {selected.type !== "video" && (
              <button onClick={() => {
                sessionStorage.setItem("editor_image", selected.output_image_url!);
                router.push("/editor");
              }} style={s.editBtn}>{t("criacoes_edit")}</button>
              )}
              {selected.type !== "video" && (
              <button onClick={async () => {
                // Verificar se há foto ou vídeo ativo antes de permitir criar novo vídeo
                const [imgRes, vidRes] = await Promise.all([
                  fetch("/api/image-jobs", { headers: { Authorization: `Bearer ${token}` } }),
                  fetch("/api/video-jobs", { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                if (imgRes.ok) {
                  const data = await imgRes.json();
                  const allJobs: AccountJob[] = Array.isArray(data) ? data : (data.jobs ?? []);
                  const hasActivePhoto = allJobs.some((j: AccountJob) => j.status !== "done" && j.status !== "failed" && j.status !== "canceled");
                  if (hasActivePhoto) {
                    setVideoBlocked("photo");
                    setTimeout(() => setVideoBlocked(null), 3500);
                    return;
                  }
                }
                if (vidRes.ok) {
                  const vdata = await vidRes.json();
                  const allVideos: AccountJob[] = Array.isArray(vdata) ? vdata : [];
                  const hasActiveVideo = allVideos.some((j: AccountJob) => j.status !== "done" && j.status !== "failed" && j.status !== "canceled");
                  if (hasActiveVideo) {
                    setVideoBlocked("video");
                    setTimeout(() => setVideoBlocked(null), 3500);
                    return;
                  }
                }
                sessionStorage.setItem("video_from_job", selected.id);
                router.push("/");
              }} style={s.videoBtn}>{t("criacoes_video")}</button>
              )}
            </div>
            <div style={s.modalActions}>
              <button onClick={async () => {
                const url = selected.type === "video" ? selected.output_video_url! : selected.output_image_url!;
                const ext = selected.type === "video" ? "mp4" : "jpg";
                try {
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `criacao-ia.${ext}`;
                  a.click();
                } catch { window.open(url, "_blank"); }
              }} style={s.dlBtn}>{t("criacoes_download")}</button>
              <button onClick={() => handleDelete(selected.id)} disabled={deletingId === selected.id} style={s.delBtn}>
                {deletingId === selected.id ? "..." : t("criacoes_delete")}
              </button>
            </div>
            <button onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
          </div>
        </div>
      )}

      {/* Toast: vídeo bloqueado por job ativo */}
      {videoBlocked && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#1e2330", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 12, padding: "12px 20px", color: "#eef2f9", fontSize: 14, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {videoBlocked === "video"
            ? (lang === "en" ? "⏳ Wait for the current video to finish before creating another" : lang === "es" ? "⏳ Espera que termine el video actual antes de crear otro" : "⏳ Aguarde o vídeo atual terminar antes de criar outro")
            : (lang === "en" ? "⏳ Wait for the current photo to finish before creating a video" : lang === "es" ? "⏳ Espera que termine la foto actual antes de crear un video" : "⏳ Aguarde a foto atual terminar antes de criar um vídeo")}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07080b", paddingBottom: 68 },
  centered: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8394b0" },
  main: { padding: "8px 12px" },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: "60vh", textAlign: "center",
  },
  createBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14, padding: "16px 32px",
    color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 3,
  },
  card: {
    aspectRatio: "1 / 1",
    overflow: "hidden",
    cursor: "pointer",
    borderRadius: 4,
    background: "#111820",
  },
  img: {
    width: "100%", height: "100%", objectFit: "cover",
    display: "block", transition: "opacity 0.2s",
  },
  videoBadge: {
    position: "absolute", bottom: 6, right: 6,
    background: "rgba(0,0,0,0.6)", borderRadius: "50%",
    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, color: "#fff", pointerEvents: "none",
  },
  // Modal
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 20,
  },
  modal: {
    background: "#111820", borderRadius: 20, overflow: "hidden",
    maxWidth: 440, width: "100%", position: "relative",
  },
  modalImg: { width: "100%", display: "block", maxHeight: "70vh", objectFit: "contain" },
  modalActions: {
    display: "flex", gap: 10, padding: "16px 16px 20px",
  },
  editBtn: {
    flex: 1, background: "#1a2235", border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 12, padding: "11px 0",
    color: "#a855f7", fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  videoBtn: {
    flex: 1, background: "#1a2235", border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 12, padding: "11px 0",
    color: "#818cf8", fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  dlBtn: {
    flex: 1, background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 12, padding: "16px 0",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 16px rgba(139,92,246,0.4)",
  },
  delBtn: {
    flex: 1, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: 12, padding: "13px 0",
    color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  closeBtn: {
    position: "absolute", top: 12, right: 12,
    background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
    width: 32, height: 32, color: "#fff", fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
};
