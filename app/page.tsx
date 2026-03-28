"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

type JobStatus = "queued" | "submitted" | "processing" | "done" | "failed" | "canceled" | null;
type Plan = "free" | "pro";

interface Job {
  id: string;
  status: JobStatus;
  output_image_url?: string;
  input_image_url?: string;
  error_message?: string;
}

function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

function formatMs(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan>("free");

  // Form
  const [produto, setProduto] = useState("");
  const [cenario, setCenario] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Job state
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [formError, setFormError] = useState("");
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blur animation: decreases from 40px to 8px over ~90s
  const [blurPx, setBlurPx] = useState(40);
  const blurRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const countdown = useCountdown(rateLimitedUntil);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? "";
      const res = await fetch("/api/image-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // API retorna { jobs, plan }
        const jobs: Job[] = Array.isArray(data) ? data : (data.jobs ?? []);
        const userPlan: Plan = data.plan ?? "free";
        setPlan(userPlan);

        const active = jobs.find(
          (j) => j.status !== "done" && j.status !== "failed" && j.status !== "canceled"
        );
        if (active) {
          setJob(active);
          if (active.input_image_url) setPreview(active.input_image_url);
        } else {
          const done = jobs.find((j) => j.status === "done");
          if (done) setJob(done);
        }
      }

      setLoading(false);
    });
  }, [router]);

  // Polling a cada 10s enquanto job estiver ativo
  useEffect(() => {
    if (!job || !user) return;
    if (job.status === "done" || job.status === "failed" || job.status === "canceled") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
      setShowCancel(false);
      return;
    }

    pollRef.current = setInterval(() => fetchJobStatus(job.id), 10_000);
    setShowCancel(false);
    cancelTimerRef.current = setTimeout(() => setShowCancel(true), 30_000);

    // Animação de blur: começa em 40px, reduz ~0.35px/s → chega ~8px em ~90s
    setBlurPx(40);
    blurRef.current = setInterval(() => {
      setBlurPx((prev) => Math.max(8, prev - 0.35));
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, user]);

  // Countdown: quando chegar a 0, limpar rate limit
  useEffect(() => {
    if (rateLimitedUntil && countdown === 0) {
      setRateLimitedUntil(null);
    }
  }, [countdown, rateLimitedUntil]);

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

  async function requestNotificationPermission() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
  }

  function sendNotification(title: string, body: string) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    n.onclick = () => { window.focus(); n.close(); };
  }

  async function fetchJobStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data: Job = await res.json();
    if (data.status === "done") sendNotification("Sua foto está pronta! 🎉", "Clique para ver a imagem gerada pela IA.");
    else if (data.status === "failed") sendNotification("Erro na geração", "Não foi possível gerar a foto. Tente novamente.");
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
    await requestNotificationPermission();

    try {
      const token = await getToken();

      const form = new FormData();
      form.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) throw new Error("Falha ao enviar imagem");
      const { url: imageUrl } = await uploadRes.json();

      const prompt = cenario.trim() ? `${produto} | cenário: ${cenario}` : produto;
      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, input_image_url: imageUrl }),
      });

      if (jobRes.status === 429) {
        const err = await jobRes.json();
        setRateLimitedUntil(new Date(err.nextAvailableAt));
        setSubmitting(false);
        return;
      }

      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Falha ao criar job");
      }
      const { jobId } = await jobRes.json();

      setJob({ id: jobId, status: "queued" });
      setTimeout(() => fetchJobStatus(jobId), 10_000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setSubmitting(false);
    }
  }

  function resetJob() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    if (blurRef.current) clearInterval(blurRef.current);
    setShowCancel(false);
    setJob(null);
    setProduto("");
    setCenario("");
    setImageFile(null);
    setPreview(null);
  }

  async function handleCancel() {
    if (!job?.id || canceling) return;
    setCanceling(true);
    try {
      const token = await getToken();
      await fetch(`/api/image-jobs/${job.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignora */ } finally {
      setCanceling(false);
      resetJob();
    }
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "foto-ia.jpg";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isGenerating = submitting || (!!job && job.status !== "done" && job.status !== "failed" && job.status !== "canceled");

  if (loading) return <div style={styles.centered}>Carregando...</div>;

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>TamoWork <span style={styles.logoTag}>Foto IA</span></div>
        <div style={styles.headerRight}>
          {plan === "pro" && <span style={styles.proBadge}>✦ Pro</span>}
          <span style={styles.email}>{user?.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Formulário */}
        {!isGenerating && job?.status !== "done" && (
          <div style={styles.card}>
            <h1 style={styles.title}>Gere fotos profissionais do seu produto</h1>
            <p style={styles.desc}>
              Envie uma foto, descreva o produto e escolha um cenário. A IA transforma em imagem profissional.
            </p>

            {/* Rate limit */}
            {rateLimitedUntil && countdown > 0 && (
              <div style={styles.rateLimitBox}>
                <div style={styles.rateLimitIcon}>⏳</div>
                <div>
                  <div style={styles.rateLimitTitle}>Próxima foto disponível em</div>
                  <div style={styles.rateLimitTimer}>{formatMs(countdown)}</div>
                  <div style={styles.rateLimitSub}>
                    Usuários gratuitos podem gerar 1 foto a cada 3 horas.{" "}
                    <span style={{ color: "#8b5cf6", cursor: "pointer" }}>Assine o Pro</span> para gerar sem limites.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
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
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>O que é o produto?</label>
                <input type="text" placeholder="Ex: bolo de chocolate artesanal com morango" value={produto} onChange={(e) => setProduto(e.target.value)} required style={styles.input} />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Cenário <span style={{ color: "#4e5c72" }}>(opcional)</span></label>
                <input type="text" placeholder="Ex: mesa rústica, fundo branco, estúdio com luz suave" value={cenario} onChange={(e) => setCenario(e.target.value)} style={styles.input} />
              </div>

              {formError && <div style={styles.error}>{formError}</div>}

              <button
                type="submit"
                disabled={submitting || (!!rateLimitedUntil && countdown > 0)}
                style={{
                  ...styles.submitBtn,
                  opacity: (submitting || (!!rateLimitedUntil && countdown > 0)) ? 0.5 : 1,
                }}
              >
                {submitting ? "Enviando..." : "✨ Gerar foto com IA"}
              </button>
            </form>
          </div>
        )}

        {/* Gerando — blur animation estilo GPT */}
        {isGenerating && (
          <div style={styles.card}>
            {/* Título animado */}
            <div style={styles.generatingTitle}>
              <span style={styles.shimmerText}>Transformando sua foto</span>
              <span style={styles.dots}>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
              </span>
            </div>
            <p style={{ ...styles.centerDesc, marginBottom: 20 }}>
              Pode fechar o aplicativo — te avisamos quando a foto ficar pronta. 🔔
            </p>

            {/* Imagem com blur progressivo */}
            {preview && (
              <div style={styles.blurWrapper}>
                <img
                  src={preview}
                  alt="produto"
                  style={{
                    ...styles.blurImg,
                    filter: `blur(${blurPx}px) brightness(0.7)`,
                    transform: `scale(${1 + blurPx * 0.002})`,
                  }}
                />
                {/* overlay gradiente roxo */}
                <div style={styles.blurOverlay} />
                {/* badge central */}
                <div style={styles.blurBadge}>
                  <span style={styles.blurDot} />
                  {submitting ? "Enviando..." : statusLabel(job?.status ?? null)}
                </div>
              </div>
            )}

            {/* Botão cancelar — aparece após 30s */}
            {showCancel && job?.id && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <button onClick={handleCancel} disabled={canceling} style={styles.cancelBtn}>
                  {canceling ? "Cancelando..." : "✕ Cancelar e recomeçar"}
                </button>
              </div>
            )}

            {/* Oferta Pro */}
            {plan === "free" && (
              <div style={styles.offerBox}>
                <div style={styles.offerTitle}>⚡ Quer gerar sem esperar?</div>
                <div style={styles.offerDesc}>No plano Pro você gera sem limite de tempo e tem acesso a geração de vídeos.</div>
                <div style={styles.offerBadge}>Em breve</div>
              </div>
            )}
          </div>
        )}

        {/* Resultado */}
        {job?.status === "done" && job.output_image_url && (
          <div style={{ ...styles.card, animation: "fadeIn 0.5s ease" }}>
            <h2 style={styles.centerTitle}>Sua foto está pronta! ✨</h2>
            <img src={job.output_image_url} alt="Foto gerada" style={styles.resultImg} />
            <button onClick={() => handleDownload(job.output_image_url!)} style={styles.downloadBtn}>
              ⬇ Baixar foto
            </button>
            <div style={styles.resultActions}>
              <button onClick={resetJob} style={styles.newBtn}>🔄 Gerar outra foto</button>
              <button onClick={() => alert("Em breve!")} style={styles.videoBtn}>
                🎬 Criar vídeo
              </button>
            </div>
          </div>
        )}

        {/* Erro */}
        {job?.status === "failed" && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>❌</div>
            <h2 style={styles.centerTitle}>Algo deu errado</h2>
            <p style={styles.centerDesc}>{job.error_message ?? "Não foi possível gerar a foto. Tente novamente."}</p>
            <button onClick={resetJob} style={styles.submitBtn}>Tentar novamente</button>
          </div>
        )}
      </main>
    </div>
  );
}

function statusLabel(status: JobStatus): string {
  const labels: Record<string, string> = {
    queued: "Na fila...",
    submitted: "Preparando...",
    processing: "Gerando imagem...",
  };
  return labels[status ?? ""] ?? "Processando...";
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
  proBadge: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#fff",
  },
  email: { fontSize: 13, color: "#8394b0" },
  logoutBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "6px 14px", color: "#8394b0", fontSize: 13, cursor: "pointer",
  },
  main: { flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px" },
  card: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 22, padding: "36px 32px", width: "100%", maxWidth: 520,
  },
  title: { fontSize: 22, fontWeight: 700, margin: "0 0 8px" },
  desc: { color: "#8394b0", fontSize: 15, margin: "0 0 28px", lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  dropzone: {
    background: "#0c1018", border: "2px dashed rgba(255,255,255,0.1)",
    borderRadius: 18, padding: "32px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    cursor: "pointer", gap: 8, minHeight: 140,
  },
  dropzoneWithPreview: { padding: 0, overflow: "hidden", minHeight: 200 },
  previewImg: { width: "100%", height: 260, objectFit: "contain", borderRadius: 16, display: "block", background: "#0c1018" },
  uploadIcon: { fontSize: 32 },
  uploadText: { color: "#eef2f9", fontSize: 14, fontWeight: 500 },
  uploadSub: { color: "#4e5c72", fontSize: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#8394b0", fontWeight: 500 },
  input: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: "11px 14px", color: "#eef2f9", fontSize: 15, outline: "none", width: "100%",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "14px 0",
    color: "#fff", fontSize: 16, fontWeight: 600, marginTop: 4, cursor: "pointer",
  },
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13,
  },
  rateLimitBox: {
    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 16, padding: "18px 20px", marginBottom: 20,
    display: "flex", gap: 14, alignItems: "flex-start",
  },
  rateLimitIcon: { fontSize: 28, flexShrink: 0 },
  rateLimitTitle: { fontSize: 13, color: "#8394b0", marginBottom: 4 },
  rateLimitTimer: {
    fontSize: 32, fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    marginBottom: 6,
  },
  rateLimitSub: { fontSize: 12, color: "#4e5c72", lineHeight: 1.5 },

  // Blur animation
  generatingTitle: {
    fontSize: 20, fontWeight: 700, textAlign: "center",
    marginBottom: 8, display: "flex", justifyContent: "center", alignItems: "center", gap: 2,
  },
  shimmerText: {
    background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #a855f7, #6366f1)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    animation: "shimmer 3s linear infinite",
  },
  dots: { color: "#8b5cf6", fontSize: 22, letterSpacing: 2, display: "flex" },
  blurWrapper: {
    position: "relative", borderRadius: 18, overflow: "hidden",
    marginBottom: 20, background: "#0c1018", height: 300,
  },
  blurImg: {
    width: "100%", height: "100%", objectFit: "cover",
    display: "block", transition: "filter 1s ease, transform 1s ease",
  },
  blurOverlay: {
    position: "absolute", inset: 0,
    background: "linear-gradient(180deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.25) 100%)",
    pointerEvents: "none",
  },
  blurBadge: {
    position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
    background: "rgba(13,14,20,0.85)", border: "1px solid rgba(139,92,246,0.4)",
    borderRadius: 20, padding: "6px 16px", fontSize: 13, color: "#c4b5fd", fontWeight: 500,
    display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)", whiteSpace: "nowrap",
  },
  blurDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6",
    animation: "pulse 1.2s ease-in-out infinite", flexShrink: 0,
  },
  cancelBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "8px 20px", color: "#8394b0", fontSize: 13, cursor: "pointer",
  },
  centerTitle: { fontSize: 20, fontWeight: 700, textAlign: "center", margin: "0 0 8px" },
  centerDesc: { color: "#8394b0", fontSize: 14, textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 },
  offerBox: {
    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 16, padding: "20px 24px",
  },
  offerTitle: { fontSize: 15, fontWeight: 600, marginBottom: 6 },
  offerDesc: { fontSize: 13, color: "#8394b0", lineHeight: 1.5, marginBottom: 12 },
  offerBadge: {
    display: "inline-block", background: "rgba(99,102,241,0.2)", borderRadius: 8,
    padding: "4px 10px", fontSize: 12, color: "#8b5cf6", fontWeight: 600,
  },
  bigIcon: { fontSize: 48, textAlign: "center", marginBottom: 16 },
  resultImg: { width: "100%", borderRadius: 16, display: "block", marginBottom: 16 },
  resultActions: { display: "flex", gap: 10, marginTop: 10 },
  downloadBtn: {
    width: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "13px 0", color: "#fff",
    fontSize: 15, fontWeight: 600, textAlign: "center", display: "block",
    cursor: "pointer", marginBottom: 10,
  },
  newBtn: {
    flex: 1, background: "#1a2535", border: "none", borderRadius: 14,
    padding: "13px 0", color: "#eef2f9", fontSize: 15, fontWeight: 500, cursor: "pointer",
  },
  videoBtn: {
    flex: 1, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
    borderRadius: 14, padding: "13px 0", color: "#34d399", fontSize: 15, fontWeight: 600, cursor: "pointer",
  },
};
