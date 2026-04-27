"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import dynamic_next from "next/dynamic";

import AppHeader from "@/app/components/AppHeader";
import TamoMascot from "@/app/components/TamoMascot";
import PushConversionAgent from "@/app/components/PushConversionAgent";

const BotChat = dynamic_next(() => import("@/app/components/BotChat"), { ssr: false });

const VAPID_PUBLIC = "BOFpGK6deSOtMczLOppZ8RXLb8XbAP0cs4hDHOZtJrDsnLhvzdPQXeojc5CohPhnj0PvNkPd7B7HKLtUva03cGk";

async function registerPush(token: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const padding = "=".repeat((4 - (VAPID_PUBLIC.length % 4)) % 4);
    const base64 = (VAPID_PUBLIC + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const key = Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    await fetch("/api/push/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "enabled" }),
    });
  } catch { /* ignora */ }
}

async function requestAndRegisterPush() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "denied") return;
  if (Notification.permission === "default") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  await registerPush(token);
}

type JobStatus = "queued" | "submitted" | "processing" | "done" | "failed" | "canceled" | null;
type VideoJobType = "video" | "narrated" | "long";

interface ActiveJob {
  id: string;
  status: JobStatus;
  output_image_url?: string;
  input_image_url?: string;
  error_message?: string;
  created_at?: string;
}

interface ActiveVideoJob {
  id: string;
  type: VideoJobType;
  status: string;
  output_video_url?: string;
  input_image_url?: string;
  error_message?: string;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

type OnboardingVariant = "A" | "B" | "C" | null;

function videoApiPath(type: VideoJobType, id: string) {
  if (type === "narrated") return `/api/narrated-video/${id}`;
  if (type === "long") return `/api/long-video/${id}`;
  return `/api/video-jobs/${id}`;
}

export default function TamoPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [ready, setReady] = useState(false);

  // ── Foto job ────────────────────────────────────────────────────────────────
  const [job, setJob] = useState<ActiveJob | null>(null);
  const [progressVal, setProgressVal] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  // ── Vídeo job ───────────────────────────────────────────────────────────────
  const [videoJob, setVideoJob] = useState<ActiveVideoJob | null>(null);
  const [videoElapsedSec, setVideoElapsedSec] = useState(0);
  const videoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [botActive, setBotActive] = useState(false);

  // Push notification prompt durante processamento
  const [pushTrigger, setPushTrigger] = useState<"processing" | "photo_done" | "rate_limit" | "return_visit" | null>(null);
  const pushShownRef = useRef(false);

  // Onboarding mode
  const [obVariant, setObVariant] = useState<OnboardingVariant>(null);
  const [obObjetivo, setObObjetivo] = useState<string | null>(null);
  const [obOndeUsar, setObOndeUsar] = useState<string | null>(null);

  useEffect(() => {
    try {
      const mode = sessionStorage.getItem("onboarding_mode") as OnboardingVariant;
      if (mode && ["A","B","C"].includes(mode)) {
        setObVariant(mode);
        setObObjetivo(sessionStorage.getItem("ob_objetivo"));
        setObOndeUsar(sessionStorage.getItem("ob_onde_usar"));
      }
    } catch { /* ignora */ }
  }, []);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push("/login"); return; }
      try {
        const hasPendingJob = !!sessionStorage.getItem("pending_job_id") || !!sessionStorage.getItem("pending_video_job_id");
        if (localStorage.getItem("onboarding_completed") !== "1" && !hasPendingJob) {
          router.push("/onboarding"); return;
        }
      } catch { /* ignora */ }
      setUser({ id: data.session.user.id });
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!session) router.push("/login");
      else setUser({ id: session.user.id });
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Smooth progress para foto
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayProgress(prev => {
        if (Math.abs(prev - progressVal) < 1) return progressVal;
        return prev + (progressVal - prev) * 0.12;
      });
    }, 60);
    return () => clearInterval(id);
  }, [progressVal]);

  // ── Carrega foto job do sessionStorage + polling ────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function init() {
      let jobId = (() => {
        try { return sessionStorage.getItem("pending_job_id") ?? ""; } catch { return ""; }
      })();

      if (!jobId) {
        try {
          const token = await getToken();
          const listRes = await fetch("/api/image-jobs", { headers: { Authorization: `Bearer ${token}` } });
          if (listRes.ok) {
            const listData = await listRes.json();
            const jobs: ActiveJob[] = Array.isArray(listData) ? listData : (listData.jobs ?? []);
            const active = jobs.find(j => j.status && !["done", "failed", "canceled"].includes(j.status ?? ""));
            if (active) {
              jobId = active.id;
              try { sessionStorage.setItem("pending_job_id", active.id); } catch { /* ignora */ }
            } else {
              const recent = jobs.find(j => j.status === "done" && j.output_image_url &&
                new Date(j.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000);
              if (recent) setJob(recent);
              return;
            }
          }
        } catch { /* ignora */ }
        if (!jobId) return;
      }

      async function fetchStatus() {
        if (!jobId) return;
        try {
          const token = await getToken();
          const res = await fetch(`/api/image-jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data: ActiveJob = await res.json();
          setJob(data);

          if (data.status === "done" || data.status === "failed" || data.status === "canceled") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (elapsedRef.current) clearInterval(elapsedRef.current);
            if (data.status === "done" && !notifiedRef.current.has(jobId)) {
              notifiedRef.current.add(jobId);
            }
            return;
          }

          try {
            const pr = await fetch(`/api/image-jobs/${jobId}/progress`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (pr.ok) {
              const pd = await pr.json();
              setProgressVal(pd.progress ?? 0);
            }
          } catch { /* ignora */ }
        } catch { /* ignora */ }
      }

      fetchStatus();
      pollRef.current = setInterval(fetchStatus, 10_000);

      // Popup de push ~4s após iniciar processamento (momento estratégico)
      if (!pushShownRef.current && typeof Notification !== "undefined" && Notification.permission === "default") {
        setTimeout(() => {
          if (!pushShownRef.current) {
            pushShownRef.current = true;
            setPushTrigger("processing");
          }
        }, 4000);
      }

      setElapsedSec(0);
      elapsedRef.current = setInterval(() => {
        if (document.visibilityState !== "hidden") setElapsedSec(s => s + 1);
      }, 1000);
    }

    init();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [user]);

  // ── Carrega vídeo job do sessionStorage + polling ───────────────────────────
  useEffect(() => {
    if (!user) return;

    async function initVideo() {
      let videoJobId = "";
      let videoJobType: VideoJobType = "video";
      try {
        videoJobId = sessionStorage.getItem("pending_video_job_id") ?? "";
        videoJobType = (sessionStorage.getItem("pending_video_job_type") as VideoJobType) ?? "video";
      } catch { /* ignora */ }

      if (!videoJobId) {
        // Tenta encontrar vídeo ativo via API
        try {
          const token = await getToken();
          const res = await fetch("/api/video-jobs", { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            const jobs = Array.isArray(data) ? data : [];
            const active = jobs.find((j: ActiveVideoJob) => j.status && !["done", "failed", "canceled"].includes(j.status));
            if (active) {
              videoJobId = active.id;
              videoJobType = "video";
              try { sessionStorage.setItem("pending_video_job_id", active.id); } catch { /* ignora */ }
            }
          }
        } catch { /* ignora */ }
        if (!videoJobId) return;
      }

      async function fetchVideoStatus() {
        if (!videoJobId) return;
        try {
          const token = await getToken();
          const res = await fetch(videoApiPath(videoJobType, videoJobId), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = await res.json();
          setVideoJob({ id: videoJobId, type: videoJobType, ...data });

          if (["done", "failed", "canceled"].includes(data.status)) {
            if (videoPollRef.current) clearInterval(videoPollRef.current);
            if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
            if (data.status !== "done") {
              // Limpa sessionStorage em caso de falha/cancel
              try { sessionStorage.removeItem("pending_video_job_id"); sessionStorage.removeItem("pending_video_job_type"); } catch { /* ignora */ }
            }
          }
        } catch { /* ignora */ }
      }

      fetchVideoStatus();
      videoPollRef.current = setInterval(fetchVideoStatus, 15_000);

      setVideoElapsedSec(0);
      videoElapsedRef.current = setInterval(() => {
        if (document.visibilityState !== "hidden") setVideoElapsedSec(s => s + 1);
      }, 1000);
    }

    initVideo();

    return () => {
      if (videoPollRef.current) clearInterval(videoPollRef.current);
      if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
    };
  }, [user]);

  // Lê preview do input do sessionStorage
  const [inputPreview, setInputPreview] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tamo_active_job");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.input_image_url) setInputPreview(parsed.input_image_url);
      }
    } catch { /* ignora */ }
  }, []);

  const isActive = job && job.status && !["done", "failed", "canceled"].includes(job.status);
  const isDone = job?.status === "done";
  const isFailed = job?.status === "failed";
  const isCanceled = job?.status === "canceled";

  const isVideoActive = videoJob && !["done", "failed", "canceled"].includes(videoJob.status ?? "");
  const isVideoDone = videoJob?.status === "done";
  const isVideoFailed = videoJob?.status === "failed";

  const workState = isDone ? "terminado" : isActive ? "trabalhando" : "sem_trabalho";

  const hasAnything = !!job || !!videoJob;

  function handleDownload(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `tamowork-foto-${Date.now()}.jpg`;
    a.click();
  }

  async function handleDownloadVideo(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tamowork-video-${Date.now()}.mp4`;
      a.click();
    } catch { window.open(url, "_blank"); }
  }

  function handleNewPhoto() {
    try {
      sessionStorage.removeItem("pending_job_id");
      sessionStorage.removeItem("tamo_active_job");
      sessionStorage.removeItem("onboarding_mode");
      sessionStorage.removeItem("ob_objetivo");
      sessionStorage.removeItem("ob_facilidade");
      sessionStorage.removeItem("ob_onde_usar");
    } catch { /* ignora */ }
    setJob(null);
    router.push("/");
  }

  function handleNewVideo() {
    try {
      sessionStorage.removeItem("pending_video_job_id");
      sessionStorage.removeItem("pending_video_job_type");
    } catch { /* ignora */ }
    setVideoJob(null);
    router.push("/");
  }

  function videoTypeLabel(type: VideoJobType) {
    if (type === "narrated") return "narrado";
    if (type === "long") return "longo";
    return "animado";
  }

  if (!ready) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>

        {/* ── SEM JOB ATIVO ───────────────────────────────────────────────────── */}
        {!hasAnything && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 24 }}>
            <div style={{ background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 22, padding: "36px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 340 }}>
              <TamoMascot state="idle" size={110} label="Olá! Sou o Tamo 🦎" />
              <p style={{ fontSize: 14, color: "#8394b0", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                Crie uma foto profissional para ver o andamento aqui.
              </p>
              <button
                onClick={() => router.push("/")}
                style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 10, padding: "13px 32px", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Outfit, sans-serif", width: "100%", boxShadow: "0 4px 18px rgba(139,92,246,0.35)" }}
              >
                + Criar foto
              </button>
            </div>
          </div>
        )}

        {/* ── FOTO: JOB ATIVO ─────────────────────────────────────────────────── */}
        {isActive && (
          <div style={{ background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
            {inputPreview && (
              <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
                <img
                  src={inputPreview}
                  alt="produto"
                  style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${Math.max(8, 40 - elapsedSec * 0.35)}px)`, transition: "filter 1s ease" }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, #0c1018)" }} />
              </div>
            )}

            <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <TamoMascot state="processing" size={80} label="Tô trabalhando..." />

              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#eef2f9", background: "linear-gradient(135deg, #6366f1, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Transformando sua foto
                </span>
                <span style={{ color: "#a855f7", fontSize: 16 }}>
                  <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                  <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                  <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
                </span>
              </div>

              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${displayProgress}%`,
                  borderRadius: 3,
                  background: displayProgress > 80
                    ? "linear-gradient(90deg, #6366f1, #22c55e)"
                    : "linear-gradient(90deg, #6366f1, #a855f7)",
                  transition: "width 0.4s ease",
                }} />
              </div>

              <span style={{ fontSize: 12, color: "#4e5c72" }}>
                {job?.status === "queued" ? "Na fila..." : job?.status === "submitted" ? "Iniciando..." : "Gerando..."}
                {elapsedSec > 0 && ` • ${elapsedSec}s`}
              </span>
            </div>
          </div>
        )}

        {/* ── ONBOARDING EXTRA — Variante B ───────────────────────────────────── */}
        {isActive && obVariant === "B" && (
          <div style={{ background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16, marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#eef2f9", margin: 0 }}>
              🦎 Enquanto crio sua foto...
            </p>
            {obObjetivo && (
              <p style={{ fontSize: 12, color: "#8394b0", margin: 0 }}>
                Ótimo! Vou focar em ajudar você a <strong style={{ color: "#c4b5fd" }}>
                  {obObjetivo === "vender" ? "vender mais" : obObjetivo === "melhorar" ? "melhorar suas fotos" : obObjetivo === "anuncios" ? "criar anúncios" : "explorar o app"}
                </strong>.
              </p>
            )}
            <p style={{ fontSize: 12, color: "#8394b0", margin: 0 }}>
              Depois da foto, posso escrever a <strong style={{ color: "#c4b5fd" }}>legenda</strong> e sugerir <strong style={{ color: "#c4b5fd" }}>hashtags</strong> para você.
            </p>
          </div>
        )}

        {/* ── ONBOARDING EXTRA — Variante C ───────────────────────────────────── */}
        {isActive && obVariant === "C" && (
          <div style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd", margin: "0 0 8px" }}>
              🦎 Isso é só o começo...
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { icon: "🎬", text: "Transformar essa foto em vídeo" },
                { icon: "✍️", text: "Criar legenda e hashtags" },
                { icon: "📣", text: "Montar anúncio pronto para publicar" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8394b0" }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
            {obOndeUsar && (
              <p style={{ fontSize: 11, color: "#4e5c72", margin: "10px 0 0" }}>
                Otimizando para {obOndeUsar === "instagram" ? "Instagram" : obOndeUsar === "whatsapp" ? "WhatsApp" : "loja online"} 🎯
              </p>
            )}
          </div>
        )}

        {/* ── FOTO: RESULTADO ─────────────────────────────────────────────────── */}
        {isDone && job?.output_image_url && (
          <div style={{ background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
            <img
              src={job.output_image_url}
              alt="Foto gerada"
              style={{ width: "100%", display: "block", maxHeight: 500, objectFit: "contain", background: "#07080b" }}
            />
            <div style={{ padding: "16px" }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#eef2f9", margin: 0 }}>Pronto! Ficou assim 🎉</p>
                <p style={{ fontSize: 13, color: "#8394b0", margin: "4px 0 0" }}>Sua foto foi gerada com sucesso</p>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => handleDownload(job.output_image_url!)}
                  style={{ flex: 1, background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
                >
                  ⬇ Baixar foto
                </button>
                <button
                  onClick={() => { try { sessionStorage.setItem("editor_image", job.output_image_url!); } catch { /* ignora */ } router.push("/editor"); }}
                  style={{ flex: 1, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, padding: "12px", color: "#a5b4fc", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
                >
                  ✏️ Editar
                </button>
              </div>

              <button
                onClick={() => router.push("/criacoes")}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "11px", color: "#8394b0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Outfit, sans-serif", marginBottom: 8 }}
              >
                🖼 Ver todas as criações
              </button>

              <button
                onClick={handleNewPhoto}
                style={{ width: "100%", background: "transparent", border: "none", color: "#4e5c72", fontSize: 13, cursor: "pointer", fontFamily: "Outfit, sans-serif", padding: "8px 0" }}
              >
                📷 Criar nova foto
              </button>
            </div>
          </div>
        )}

        {/* ── FOTO: FALHOU ────────────────────────────────────────────────────── */}
        {isFailed && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: 24, textAlign: "center", marginBottom: 16 }}>
            <TamoMascot state="error" size={64} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9", margin: "12px 0 4px" }}>
              {obVariant ? "Não consegui gerar a foto 😔" : "Ops, algo deu errado 😔"}
            </p>
            <p style={{ fontSize: 13, color: "#8394b0", margin: "0 0 20px" }}>
              {obVariant
                ? "Aconteceu um problema técnico. Mas não precisa começar do zero — clique para tentar de novo."
                : (job?.error_message ?? "Tente criar a foto novamente.")}
            </p>
            <button
              onClick={handleNewPhoto}
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "13px 32px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif", width: "100%" }}
            >
              {obVariant ? "📷 Criar foto novamente" : "Tentar novamente"}
            </button>
          </div>
        )}

        {/* ── FOTO: CANCELADA ─────────────────────────────────────────────────── */}
        {isCanceled && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, textAlign: "center", marginBottom: 16 }}>
            <TamoMascot state="idle" size={64} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9", margin: "12px 0 4px" }}>Criação cancelada</p>
            <p style={{ fontSize: 13, color: "#8394b0", margin: "0 0 16px" }}>Que tal tentar com uma foto ou descrição diferente?</p>
            <button
              onClick={handleNewPhoto}
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
            >
              Criar nova foto
            </button>
          </div>
        )}

        {/* ── VÍDEO: EM ANDAMENTO ─────────────────────────────────────────────── */}
        {isVideoActive && (
          <div style={{ background: "#0c1018", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, padding: "24px 20px", marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Vídeo {videoTypeLabel(videoJob!.type)}
            </div>

            <TamoMascot state="processing" size={80} label="Criando vídeo..." />

            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9" }}>
                Criando seu vídeo
              </span>
              <span style={{ color: "#6366f1", fontSize: 15 }}>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
              </span>
              <p style={{ fontSize: 12, color: "#4e5c72", margin: "6px 0 0" }}>
                {videoJob!.type === "long" ? "Isso pode levar 20–40 min..." : "Isso leva 1–3 min..."}
                {videoElapsedSec > 0 && ` • ${videoElapsedSec}s`}
              </p>
            </div>

            <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: videoJob!.status === "queued" ? "15%" : videoJob!.status === "submitted" ? "35%" : "65%",
                background: "linear-gradient(90deg, #6366f1, #a855f7)",
                borderRadius: 2,
                transition: "width 1s ease",
              }} />
            </div>
          </div>
        )}

        {/* ── VÍDEO: PRONTO ───────────────────────────────────────────────────── */}
        {isVideoDone && videoJob?.output_video_url && (
          <div style={{ background: "#0c1018", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
            <video
              src={videoJob.output_video_url}
              controls
              autoPlay
              loop
              playsInline
              muted
              style={{ width: "100%", display: "block", maxHeight: "60vh", background: "#000", objectFit: "contain" }}
            />
            <div style={{ padding: "16px" }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#eef2f9", textAlign: "center", margin: "0 0 14px" }}>
                🎬 Seu vídeo está pronto!
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  onClick={() => handleDownloadVideo(videoJob.output_video_url!)}
                  style={{ flex: 1, background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
                >
                  ⬇ Baixar vídeo
                </button>
                <button
                  onClick={() => router.push("/criacoes")}
                  style={{ flex: 1, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, padding: "12px", color: "#818cf8", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
                >
                  🖼 Ver criações
                </button>
              </div>
              <button
                onClick={handleNewVideo}
                style={{ width: "100%", background: "transparent", border: "none", color: "#4e5c72", fontSize: 13, cursor: "pointer", fontFamily: "Outfit, sans-serif", padding: "8px 0" }}
              >
                📷 Nova foto ou vídeo
              </button>
            </div>
          </div>
        )}

        {/* ── VÍDEO: FALHOU ───────────────────────────────────────────────────── */}
        {isVideoFailed && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: 24, textAlign: "center", marginBottom: 16 }}>
            <TamoMascot state="error" size={64} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9", margin: "12px 0 4px" }}>Vídeo não pôde ser criado 😔</p>
            <p style={{ fontSize: 13, color: "#8394b0", margin: "0 0 16px" }}>Pode tentar novamente agora.</p>
            <button
              onClick={handleNewVideo}
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── Chat do Tamo ─────────────────────────────────────────────────────── */}
        <BotChat
          workState={workState as "sem_trabalho" | "trabalhando" | "terminado"}
          botActive={botActive}
          visible={true}
          onActivate24h={() => setBotActive(true)}
          embedded={false}
        />

      </div>

      

      <PushConversionAgent
        trigger={pushTrigger}
        onRequest={async () => { await requestAndRegisterPush(); setPushTrigger(null); }}
        onSkip={() => setPushTrigger(null)}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3 }
          50% { opacity: 1 }
        }
      `}</style>
    </div>
  );
}
