"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import dynamic_next from "next/dynamic";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";
import TamoMascot from "@/app/components/TamoMascot";

const BotChat = dynamic_next(() => import("@/app/components/BotChat"), { ssr: false });

type JobStatus = "queued" | "submitted" | "processing" | "done" | "failed" | "canceled" | null;

interface ActiveJob {
  id: string;
  status: JobStatus;
  output_image_url?: string;
  input_image_url?: string;
  error_message?: string;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

type OnboardingVariant = "A" | "B" | "C" | null;

export default function TamoPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [job, setJob] = useState<ActiveJob | null>(null);
  const [progressVal, setProgressVal] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [botActive, setBotActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  // Onboarding mode — lido do sessionStorage para mostrar conteúdo extra
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
      // Garante que usuário completou onboarding (acesso direto via URL)
      try {
        if (localStorage.getItem("onboarding_completed") !== "1") {
          router.push("/onboarding"); return;
        }
      } catch { /* ignora */ }
      setUser({ id: data.session.user.id });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!session) router.push("/login");
      else setUser({ id: session.user.id });
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Smooth progress
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayProgress(prev => {
        if (Math.abs(prev - progressVal) < 1) return progressVal;
        return prev + (progressVal - prev) * 0.12;
      });
    }, 60);
    return () => clearInterval(id);
  }, [progressVal]);

  // Carrega job ativo do sessionStorage + polling
  useEffect(() => {
    if (!user) return;

    let jobId = (() => {
      try { return sessionStorage.getItem("pending_job_id") ?? ""; } catch { return ""; }
    })();

    // Fallback: se não há pending_job_id, consulta a API para encontrar job ativo
    if (!jobId) {
      try {
        const token = await getToken();
        const listRes = await fetch("/api/image-jobs", { headers: { Authorization: `Bearer ${token}` } });
        if (listRes.ok) {
          const listData = await listRes.json();
          const jobs: ActiveJob[] = Array.isArray(listData) ? listData : (listData.jobs ?? []);
          const active = jobs.find(j => j.status && !["done", "failed", "canceled"].includes(j.status));
          if (active) {
            jobId = active.id;
            try { sessionStorage.setItem("pending_job_id", active.id); } catch { /* ignora */ }
          } else {
            // Sem job ativo — verifica done recente (últimas 24h)
            const recent = jobs.find(j => j.status === "done" && j.output_image_url &&
              new Date(j.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000);
            if (recent) {
              setJob(recent);
            }
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

        // Progresso
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

    setElapsedSec(0);
    elapsedRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") setElapsedSec(s => s + 1);
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [user]);

  // Lê input_image_url do sessionStorage para mostrar durante geração
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

  const workState = isDone ? "terminado" : isActive ? "trabalhando" : "sem_trabalho";

  function handleDownload(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `tamowork-foto-${Date.now()}.jpg`;
    a.click();
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

  return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>

        {/* ── SEM JOB ATIVO — idle ─────────────────────────────────────────── */}
        {!job && (
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

        {/* ── JOB ATIVO — processando ──────────────────────────────────────── */}
        {isActive && (
          <div style={{ background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
            {/* Preview com blur */}
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

              {/* Barra de progresso */}
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

        {/* ── ONBOARDING EXTRA — Variante B (engajamento) ──────────────────── */}
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

        {/* ── ONBOARDING EXTRA — Variante C (conversão) ────────────────────── */}
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

        {/* ── RESULTADO ────────────────────────────────────────────────────── */}
        {isDone && job?.output_image_url && (
          <div style={{ background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
            <img
              src={job.output_image_url}
              alt="Foto gerada"
              style={{ width: "100%", display: "block", maxHeight: 500, objectFit: "contain", background: "#07080b" }}
            />
            <div style={{ padding: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <TamoMascot state="done" size={110} resultImage={job.output_image_url} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#eef2f9", margin: 0 }}>Pronto! Ficou assim 🎉</p>
                  <p style={{ fontSize: 13, color: "#8394b0", margin: "4px 0 0" }}>Sua foto foi gerada com sucesso</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => handleDownload(job.output_image_url!)}
                  style={{ flex: 1, background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
                >
                  ⬇ Baixar foto
                </button>
                <button
                  onClick={() => router.push("/editor")}
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

        {/* ── FALHOU ───────────────────────────────────────────────────────── */}
        {isFailed && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: 24, textAlign: "center", marginBottom: 16 }}>
            <TamoMascot state="error" size={64} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9", margin: "12px 0 4px" }}>Ops, algo deu errado 😔</p>
            <p style={{ fontSize: 13, color: "#8394b0", margin: "0 0 16px" }}>{job?.error_message ?? "Tente criar a foto novamente."}</p>
            <button
              onClick={handleNewPhoto}
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── CANCELADO ────────────────────────────────────────────────────── */}
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

        {/* ── Chat do Tamo ─────────────────────────────────────────────────── */}
        <BotChat
          workState={workState as "sem_trabalho" | "trabalhando" | "terminado"}
          botActive={botActive}
          visible={true}
          onActivate24h={() => setBotActive(true)}
          embedded={false}
        />

      </div>

      <BottomNav hasActiveJob={!!isActive} hasDoneJob={!!isDone} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3 }
          50% { opacity: 1 }
        }
      `}</style>
    </div>
  );
}
