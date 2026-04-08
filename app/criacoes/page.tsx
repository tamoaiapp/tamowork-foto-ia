"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { useI18n } from "@/lib/i18n";

interface AccountJob {
  id: string;
  status: string;
  output_image_url?: string;
  input_image_url?: string;
  created_at: string;
  prompt?: string;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function CriacoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AccountJob[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [selected, setSelected] = useState<AccountJob | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: session } = await supabase.auth.getSession();
      const t = session.session?.access_token ?? "";
      setToken(t);
      const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setJobs((data.jobs ?? []).filter((j: AccountJob) => j.status === "done" && j.output_image_url));
      }
      setLoading(false);
    });
  }, [router]);

  async function handleDelete(id: string) {
    if (!confirm(t("criacoes_confirm_delete"))) return;
    setDeletingId(id);
    await fetch(`/api/image-jobs/${id}`, {
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
      <header style={s.header} className="app-header">
        <div style={s.logo}>{t("criacoes_title")}</div>
      </header>

      <main style={s.main} className="app-main">
        {jobs.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🖼</div>
            <div style={{ fontSize: 15, color: "#eef2f9", fontWeight: 600, marginBottom: 6 }}>{t("criacoes_empty_title")}</div>
            <div style={{ fontSize: 13, color: "#4e5c72", marginBottom: 20 }}>{t("criacoes_empty_sub")}</div>
            <button onClick={() => router.push("/")} style={s.createBtn}>{t("criacoes_create")}</button>
          </div>
        ) : (
          <div style={s.grid} className="criacoes-grid">
            {jobs.map((job) => (
              <div key={job.id} style={s.card} onClick={() => setSelected(job)}>
                <img src={job.output_image_url!} alt="foto" style={s.img} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de foto */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <img src={selected.output_image_url!} alt="foto" style={s.modalImg} />
            <div style={{ display: "flex", gap: 8, padding: "14px 16px 0" }}>
              <button onClick={() => {
                sessionStorage.setItem("editor_image", selected.output_image_url!);
                router.push("/editor");
              }} style={s.editBtn}>{t("criacoes_edit")}</button>
              <button onClick={() => {
                sessionStorage.setItem("video_from_job", selected.id);
                router.push("/");
              }} style={s.videoBtn}>{t("criacoes_video")}</button>
            </div>
            <div style={s.modalActions}>
              <button onClick={async () => {
                try {
                  const res = await fetch(selected.output_image_url!);
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "foto-ia.jpg";
                  a.click();
                } catch { window.open(selected.output_image_url!, "_blank"); }
              }} style={s.dlBtn}>{t("criacoes_download")}</button>
              <button onClick={() => handleDelete(selected.id)} disabled={deletingId === selected.id} style={s.delBtn}>
                {deletingId === selected.id ? "..." : t("criacoes_delete")}
              </button>
            </div>
            <button onClick={() => setSelected(null)} style={s.closeBtn}>✕</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07080b", paddingBottom: 68 },
  centered: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8394b0" },
  header: {
    padding: "20px 20px 12px",
    background: "#07080b",
  },
  logo: {
    fontSize: 20, fontWeight: 800, color: "#eef2f9",
  },
  main: { padding: "8px 12px" },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: "60vh", textAlign: "center",
  },
  createBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14, padding: "13px 28px",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
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
    border: "none", borderRadius: 12, padding: "13px 0",
    color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
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
