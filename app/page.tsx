"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

type JobStatus = "queued" | "submitted" | "processing" | "done" | "failed" | "canceled" | null;

interface Job {
  id: string;
  status: JobStatus;
  output_image_url?: string;
  error_message?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [produto, setProduto] = useState("");
  const [cenario, setCenario] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Job state
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
      else { setUser(user); setLoading(false); }
    });
  }, [router]);

  // Polling a cada 45s enquanto job estiver ativo
  useEffect(() => {
    if (!job || !user) return;
    if (job.status === "done" || job.status === "failed" || job.status === "canceled") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(() => fetchJobStatus(job.id), 45_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, user]);

  // Fallback: refresh ao voltar do background
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && job?.id && job.status !== "done" && job.status !== "failed") {
        fetchJobStatus(job.id);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function fetchJobStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setJob(data);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) setPreview(URL.createObjectURL(file));
    else setPreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) { setFormError("Envie uma foto do produto"); return; }
    if (!produto.trim()) { setFormError("Descreva o produto"); return; }

    setFormError("");
    setSubmitting(true);
    setJob(null);

    try {
      const token = await getToken();

      // 1. Upload da imagem
      const form = new FormData();
      form.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) throw new Error("Falha ao enviar imagem");
      const { url: imageUrl } = await uploadRes.json();

      // 2. Criar job (prompt = produto + cenário, clouda usa para gerar os prompts IA)
      const prompt = cenario.trim() ? `${produto} | cenário: ${cenario}` : produto;
      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, input_image_url: imageUrl }),
      });
      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Falha ao criar job");
      }
      const { jobId } = await jobRes.json();

      setJob({ id: jobId, status: "queued" });

      // Primeiro check em 45s
      setTimeout(() => fetchJobStatus(jobId), 45_000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setSubmitting(false);
    }
  }

  function resetJob() {
    setJob(null);
    setProduto("");
    setCenario("");
    setImageFile(null);
    setPreview(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return <div style={styles.centered}>Carregando...</div>;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>TamoWork <span style={styles.logoTag}>Foto IA</span></div>
        <div style={styles.headerRight}>
          <span style={styles.email}>{user?.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Formulário */}
        {!job && !submitting && (
          <div style={styles.card}>
            <h1 style={styles.title}>Gere fotos profissionais do seu produto</h1>
            <p style={styles.desc}>
              Envie uma foto, descreva o produto e escolha um cenário. A IA transforma em imagem profissional.
            </p>

            <form onSubmit={handleSubmit} style={styles.form}>
              {/* Upload */}
              <div
                style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}) }}
                onClick={() => fileRef.current?.click()}
              >
                {preview ? (
                  <img src={preview} alt="preview" style={styles.previewImg} />
                ) : (
                  <>
                    <div style={styles.uploadIcon}>📷</div>
                    <div style={styles.uploadText}>Clique para enviar a foto do produto</div>
                    <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>O que é o produto?</label>
                <input
                  type="text"
                  placeholder="Ex: bolo de chocolate artesanal com morango"
                  value={produto}
                  onChange={(e) => setProduto(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Cenário <span style={{ color: "#4e5c72" }}>(opcional)</span></label>
                <input
                  type="text"
                  placeholder="Ex: mesa rústica, fundo branco, estúdio com luz suave"
                  value={cenario}
                  onChange={(e) => setCenario(e.target.value)}
                  style={styles.input}
                />
              </div>

              {formError && <div style={styles.error}>{formError}</div>}

              <button type="submit" disabled={submitting} style={styles.submitBtn}>
                {submitting ? "Enviando..." : "✨ Gerar foto com IA"}
              </button>
            </form>
          </div>
        )}

        {/* Processando */}
        {(submitting || (job && job.status !== "done" && job.status !== "failed")) && (
          <div style={styles.card}>
            <h2 style={styles.centerTitle}>Gerando sua foto...</h2>
            <p style={{ ...styles.centerDesc, marginBottom: 20 }}>
              Isso leva em média 1–2 minutos. Pode deixar esta tela aberta.
            </p>

            {/* Foto com animação de scan */}
            {preview && (
              <div style={styles.scanWrapper}>
                <img src={preview} alt="produto" style={styles.scanImg} />
                {/* overlay escuro gradiente */}
                <div style={styles.scanOverlay} />
                {/* linha de scan animada */}
                <div style={styles.scanLine} />
                {/* partículas de canto */}
                <div style={{ ...styles.corner, top: 12, left: 12, borderTop: "2px solid #8b5cf6", borderLeft: "2px solid #8b5cf6" }} />
                <div style={{ ...styles.corner, top: 12, right: 12, borderTop: "2px solid #8b5cf6", borderRight: "2px solid #8b5cf6" }} />
                <div style={{ ...styles.corner, bottom: 12, left: 12, borderBottom: "2px solid #8b5cf6", borderLeft: "2px solid #8b5cf6" }} />
                <div style={{ ...styles.corner, bottom: 12, right: 12, borderBottom: "2px solid #8b5cf6", borderRight: "2px solid #8b5cf6" }} />
                {/* badge de status */}
                <div style={styles.scanBadge}>
                  <span style={styles.scanDot} />
                  {submitting ? "Enviando..." : statusLabel(job?.status ?? null)}
                </div>
              </div>
            )}

            {/* Oferta plano pago */}
            <div style={styles.offerBox}>
              <div style={styles.offerTitle}>⚡ Quer gerar mais rápido e sem fila?</div>
              <div style={styles.offerDesc}>
                No plano Pro você tem prioridade na geração, mais créditos e histórico de fotos.
              </div>
              <div style={styles.offerBadge}>Em breve</div>
            </div>
          </div>
        )}

        {/* Resultado */}
        {job?.status === "done" && job.output_image_url && (
          <div style={styles.card}>
            <h2 style={styles.centerTitle}>Sua foto está pronta!</h2>
            <img src={job.output_image_url} alt="Foto gerada" style={styles.resultImg} />
            <div style={styles.resultActions}>
              <a href={job.output_image_url} download="foto-ia.jpg" style={styles.downloadBtn}>
                ⬇ Baixar foto
              </a>
              <button onClick={resetJob} style={styles.newBtn}>
                Gerar outra
              </button>
            </div>
          </div>
        )}

        {/* Erro */}
        {job?.status === "failed" && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>❌</div>
            <h2 style={styles.centerTitle}>Algo deu errado</h2>
            <p style={styles.centerDesc}>
              {job.error_message ?? "Não foi possível gerar a foto. Tente novamente."}
            </p>
            <button onClick={resetJob} style={styles.submitBtn}>
              Tentar novamente
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function statusLabel(status: JobStatus): string {
  const labels: Record<string, string> = {
    queued: "Na fila...",
    submitted: "Enviando para o servidor...",
    processing: "Processando imagem...",
  };
  return labels[status ?? ""] ?? "Aguardando...";
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  centered: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8394b0" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#0c1018",
    position: "sticky", top: 0, zIndex: 10,
  },
  logo: {
    fontSize: 18, fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  logoTag: { fontSize: 13, fontWeight: 400 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  email: { fontSize: 13, color: "#8394b0" },
  logoutBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "6px 14px", color: "#8394b0", fontSize: 13,
  },
  main: { flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px" },
  card: {
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 22, padding: "36px 32px",
    width: "100%", maxWidth: 520,
  },
  title: { fontSize: 22, fontWeight: 700, margin: "0 0 8px" },
  desc: { color: "#8394b0", fontSize: 15, margin: "0 0 28px", lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  dropzone: {
    background: "#0c1018",
    border: "2px dashed rgba(255,255,255,0.1)",
    borderRadius: 18, padding: "32px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    cursor: "pointer", gap: 8, minHeight: 140, transition: "border-color 0.2s",
  },
  dropzoneWithPreview: { padding: 0, overflow: "hidden", minHeight: 200 },
  previewImg: { width: "100%", height: 260, objectFit: "contain", borderRadius: 16, display: "block", background: "#0c1018" },
  uploadIcon: { fontSize: 32 },
  uploadText: { color: "#eef2f9", fontSize: 14, fontWeight: 500 },
  uploadSub: { color: "#4e5c72", fontSize: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#8394b0", fontWeight: 500 },
  input: {
    background: "#0c1018",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: "11px 14px",
    color: "#eef2f9", fontSize: 15, outline: "none", width: "100%",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "14px 0",
    color: "#fff", fontSize: 16, fontWeight: 600, marginTop: 4,
  },
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13,
  },
  bigIcon: { fontSize: 48, textAlign: "center", marginBottom: 16 },
  scanWrapper: {
    position: "relative", borderRadius: 18, overflow: "hidden",
    marginBottom: 20, background: "#0c1018",
  },
  scanImg: { width: "100%", height: 280, objectFit: "contain", display: "block", background: "#0c1018" },
  scanOverlay: {
    position: "absolute", inset: 0,
    background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.12) 100%)",
    pointerEvents: "none",
  },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 2,
    background: "linear-gradient(90deg, transparent, #8b5cf6, #a855f7, #8b5cf6, transparent)",
    boxShadow: "0 0 12px 4px rgba(139,92,246,0.5)",
    animation: "scan 2s ease-in-out infinite",
    top: 0,
  },
  corner: { position: "absolute", width: 20, height: 20 },
  scanBadge: {
    position: "absolute", bottom: 14, left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(13,14,20,0.85)",
    border: "1px solid rgba(139,92,246,0.4)",
    borderRadius: 20, padding: "6px 16px",
    fontSize: 13, color: "#c4b5fd", fontWeight: 500,
    display: "flex", alignItems: "center", gap: 8,
    backdropFilter: "blur(8px)",
    whiteSpace: "nowrap",
  },
  scanDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6",
    animation: "pulse 1.2s ease-in-out infinite",
    flexShrink: 0,
  },
  centerTitle: { fontSize: 20, fontWeight: 700, textAlign: "center", margin: "0 0 8px" },
  centerDesc: { color: "#8394b0", fontSize: 14, textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 },
  statusRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 28 },
  statusDot: {
    width: 8, height: 8, borderRadius: "50%", background: "#6366f1",
    boxShadow: "0 0 8px #6366f1",
  },
  statusText: { fontSize: 14, color: "#8394b0" },
  offerBox: {
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 16, padding: "20px 24px",
  },
  offerTitle: { fontSize: 15, fontWeight: 600, marginBottom: 6 },
  offerDesc: { fontSize: 13, color: "#8394b0", lineHeight: 1.5, marginBottom: 12 },
  offerBadge: {
    display: "inline-block",
    background: "rgba(99,102,241,0.2)", borderRadius: 8,
    padding: "4px 10px", fontSize: 12, color: "#8b5cf6", fontWeight: 600,
  },
  resultImg: { width: "100%", borderRadius: 16, display: "block", marginBottom: 20 },
  resultActions: { display: "flex", gap: 12 },
  downloadBtn: {
    flex: 1, background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    borderRadius: 14, padding: "13px 0", color: "#fff",
    fontSize: 15, fontWeight: 600, textAlign: "center", textDecoration: "none", display: "block",
  },
  newBtn: {
    flex: 1, background: "#1a2535", border: "none", borderRadius: 14,
    padding: "13px 0", color: "#eef2f9", fontSize: 15, fontWeight: 500,
  },
};
