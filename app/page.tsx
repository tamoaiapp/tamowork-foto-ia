"use client";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "@/lib/downloadBlob";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import BottomNav from "@/app/components/BottomNav";
import ModeSelector, { type CreationMode } from "@/app/components/ModeSelector";
import dynamic from "next/dynamic";
import { useI18n, LangSelector } from "@/lib/i18n";
import { useProductVision } from "@/lib/vision/useProductVision";
const PhotoEditor = dynamic(() => import("@/app/components/PhotoEditor"), { ssr: false });
const PromoCreator = dynamic(() => import("@/app/components/PromoCreator"), { ssr: false });
const UpsellPopup = dynamic(() => import("@/app/components/UpsellPopup"), { ssr: false });
const BotChat = dynamic(() => import("@/app/components/BotChat"), { ssr: false });
const OnboardingScreen = dynamic(() => import("@/app/components/OnboardingScreen"), { ssr: false });
const ConversionScreen = dynamic(() => import("@/app/components/ConversionScreen"), { ssr: false });
const OnboardingChat = dynamic(() => import("@/app/components/OnboardingChat"), { ssr: false });

type JobStatus = "queued" | "submitted" | "processing" | "done" | "failed" | "canceled" | null;
type Plan = "free" | "pro";
// State machine explícito: sem_trabalho | trabalhando | terminado
type WorkState = "sem_trabalho" | "trabalhando" | "terminado";

function deriveWorkState(job: { status: JobStatus; output_image_url?: string } | null): WorkState {
  if (!job) return "sem_trabalho";
  if (job.status === "done" && job.output_image_url) return "terminado";
  if (job.status === "queued" || job.status === "submitted" || job.status === "processing") return "trabalhando";
  return "sem_trabalho"; // failed, canceled, ou done sem imagem
}

interface Job {
  id: string;
  status: JobStatus;
  output_image_url?: string;
  input_image_url?: string;
  error_message?: string;
  created_at?: string;
}

interface VideoJob {
  id: string;
  status: JobStatus;
  output_video_url?: string;
  input_image_url?: string;
  error_message?: string;
  created_at?: string;
}

function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState<number>(() =>
    target ? Math.max(0, target.getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!target) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick(); // sincroniza imediatamente ao mudar o alvo
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

const BASE_CATALOG = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/catalog";

const CATALOG_GROUPS = [
  {
    label: "Mulheres",
    models: [
      { id: "mulher1", label: "Mulher 1", url: `${BASE_CATALOG}/mulher1.jpg` },
      { id: "mulher2", label: "Mulher 2", url: `${BASE_CATALOG}/mulher2.jpg` },
    ],
  },
  {
    label: "Homens",
    models: [
      { id: "homem1", label: "Homem 1", url: `${BASE_CATALOG}/homem1.jpg` },
      { id: "homem2", label: "Homem 2", url: `${BASE_CATALOG}/homem2.jpg` },
    ],
  },
  {
    label: "Crianças",
    models: [
      { id: "crianca_menino", label: "Menino", url: `${BASE_CATALOG}/crianca_menino.jpg` },
      { id: "crianca_menina", label: "Menina", url: `${BASE_CATALOG}/crianca_menina.jpg` },
    ],
  },
  {
    label: "Bebês",
    models: [
      { id: "bebe_menino", label: "Bebê M", url: `${BASE_CATALOG}/bebe_menino.jpg` },
      { id: "bebe_menina", label: "Bebê F", url: `${BASE_CATALOG}/bebe_menina.jpg` },
    ],
  },
];

function CatalogModelPicker({
  selected, onSelect, onCustom,
}: { selected: string | null; onSelect: (url: string) => void; onCustom: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {CATALOG_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8394b0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            {group.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {group.models.map(m => (
              <div
                key={m.id}
                onClick={() => onSelect(m.url)}
                style={{
                  borderRadius: 12, overflow: "hidden", cursor: "pointer",
                  border: selected === m.url ? "2.5px solid #a855f7" : "2px solid rgba(255,255,255,0.07)",
                  aspectRatio: "3/4", position: "relative",
                  boxShadow: selected === m.url ? "0 0 0 3px rgba(168,85,247,0.25)" : "none",
                  transition: "border-color 0.15s",
                }}
              >
                <img src={m.url} alt={m.label} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
                {selected === m.url && (
                  <div style={{
                    position: "absolute", top: 4, right: 4,
                    background: "#a855f7", borderRadius: "50%",
                    width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff", fontWeight: 800,
                  }}>✓</div>
                )}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                  padding: "8px 4px 4px", fontSize: 9, fontWeight: 700,
                  color: "rgba(255,255,255,0.9)", textAlign: "center",
                }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onCustom}
        style={{
          background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.15)",
          borderRadius: 12, padding: "10px", color: "#8394b0",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        📷 Usar minha própria foto
      </button>
    </div>
  );
}

function DailyLimitScreen({ countdown, onAssinar }: { countdown: number; onAssinar: () => void }) {
  return (
    <div style={pu.wrap}>
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#8394b0", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>
          Limite diário atingido
        </div>
        <div style={{ fontSize: 15, color: "#eef2f9", fontWeight: 600, marginBottom: 4 }}>
          Sua próxima foto gratuita estará disponível em
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginBottom: 4 }}>
          {formatMs(countdown)}
        </div>
        <div style={{ fontSize: 12, color: "#4e5c72", marginBottom: 20 }}>
          O plano gratuito permite 1 foto por dia
        </div>
      </div>

      <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, color: "#c4b5fd", fontWeight: 700, marginBottom: 6 }}>
          Com o PRO você não espera:
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          {["🎬 Cria fotos e vídeos ilimitados", "⚡ Processa mais rápido na fila", "🎨 Todos os estilos desbloqueados"].map(t => (
            <div key={t} style={{ fontSize: 13, color: "#8394b0" }}>{t}</div>
          ))}
        </div>
      </div>

      <button onClick={onAssinar} style={pu.btn}>
        Assinar e criar agora
      </button>
      <div style={pu.guarantee}>Cancela quando quiser · Sem fidelidade</div>
    </div>
  );
}

function ProUpsell({ onAssinar }: { onAssinar: (plan: "annual" | "monthly") => void }) {
  const [selected, setSelected] = useState<"annual" | "monthly">("annual");

  const BENEFITS = [
    { icon: "🎬", text: "Vídeo animado do produto" },
    { icon: "♾️", text: "Fotos ilimitadas todo mês" },
    { icon: "⚡", text: "Fila prioritária" },
    { icon: "🎨", text: "Todos os estilos desbloqueados" },
  ];

  return (
    <div style={pu.wrap}>
      {/* Header */}
      <div style={pu.header}>
        <div style={pu.badge}>PRO</div>
        <div>
          <div style={pu.title}>Sua foto ficou incrível.</div>
          <div style={pu.subtitle}>Agora imagina com vídeo animado?</div>
        </div>
      </div>

      {/* Benefícios */}
      <div style={pu.benefits}>
        {BENEFITS.map((b) => (
          <div key={b.text} style={pu.benefit}>
            <span style={pu.benefitIcon}>{b.icon}</span>
            <span style={pu.benefitText}>{b.text}</span>
          </div>
        ))}
      </div>

      {/* Seletor de plano */}
      <div style={pu.planGrid}>
        {/* Anual — recomendado */}
        <button
          onClick={() => setSelected("annual")}
          style={{ ...pu.planCard, ...(selected === "annual" ? pu.planCardActive : {}) }}
        >
          {selected === "annual" && (
            <div style={pu.planBadge}>Recomendado</div>
          )}
          <div style={pu.planName}>Anual</div>
          <div style={pu.planPrice}>
            <span style={pu.planAmount}>R$19</span>
            <span style={pu.planPer}>/mês</span>
          </div>
          <div style={pu.planBilled}>R$228 cobrado uma vez</div>
          <div style={pu.planSave}>Economize R$360</div>
        </button>

        {/* Mensal */}
        <button
          onClick={() => setSelected("monthly")}
          style={{ ...pu.planCard, ...(selected === "monthly" ? pu.planCardActive : {}) }}
        >
          <div style={pu.planName}>Mensal</div>
          <div style={pu.planPrice}>
            <span style={pu.planAmount}>R$49</span>
            <span style={pu.planPer}>/mês</span>
          </div>
          <div style={pu.planBilled}>Cobrado todo mês</div>
          <div style={{ ...pu.planSave, color: "#4e5c72" }}>R$360 a mais/ano</div>
        </button>
      </div>

      {/* CTA */}
      <button onClick={() => onAssinar(selected)} style={pu.btn}>
        {selected === "annual" ? "Assinar por R$228/ano" : "Assinar por R$49/mês"}
      </button>
      <div style={pu.guarantee}>Cancela quando quiser · Sem fidelidade</div>
    </div>
  );
}

const pu: Record<string, React.CSSProperties> = {
  wrap: {
    width: "100%",
    background: "linear-gradient(160deg, #13102a 0%, #0f1520 60%, #0c1018 100%)",
    border: "1px solid rgba(168,85,247,0.35)",
    borderRadius: 22,
    padding: "24px 18px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    marginTop: 4,
    boxShadow: "0 0 60px rgba(168,85,247,0.18), 0 0 120px rgba(99,102,241,0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  badge: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "0.08em",
    flexShrink: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 13,
    color: "#a78bfa",
    fontWeight: 600,
    marginTop: 2,
  },
  benefits: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  benefit: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  benefitIcon: {
    fontSize: 16,
    flexShrink: 0,
    width: 22,
    textAlign: "center" as const,
  },
  benefitText: {
    fontSize: 13,
    color: "#c4b5fd",
    fontWeight: 500,
  },

  /* Seletor de plano */
  planGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  planCard: {
    background: "rgba(255,255,255,0.03)",
    border: "2px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: "18px 16px",
    cursor: "pointer",
    textAlign: "left" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    position: "relative" as const,
    transition: "border-color 0.2s, background 0.2s",
  },
  planCardActive: {
    border: "2px solid #a855f7",
    background: "rgba(168,85,247,0.1)",
    boxShadow: "0 0 24px rgba(168,85,247,0.2)",
  },
  planBadge: {
    position: "absolute" as const,
    top: -10,
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 99,
    padding: "2px 10px",
    fontSize: 10,
    fontWeight: 800,
    color: "#fff",
    whiteSpace: "nowrap" as const,
  },
  planName: {
    fontSize: 11,
    fontWeight: 700,
    color: "#8394b0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginTop: 8,
  },
  planPrice: {
    display: "flex",
    alignItems: "baseline",
    gap: 2,
    marginTop: 6,
  },
  planAmount: {
    fontSize: 34,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  planPer: {
    fontSize: 13,
    color: "#8394b0",
  },
  planBilled: {
    fontSize: 12,
    color: "#4e5c72",
    marginTop: 4,
  },
  planSave: {
    fontSize: 12,
    color: "#16c784",
    fontWeight: 700,
    marginTop: 2,
  },

  btn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none",
    borderRadius: 16,
    padding: "16px 0",
    color: "#fff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    width: "100%",
    letterSpacing: "-0.01em",
    boxShadow: "0 4px 20px rgba(168,85,247,0.35)",
  },
  guarantee: {
    fontSize: 12,
    color: "#4e5c72",
    textAlign: "center" as const,
  },
};

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan>("free");

  // Banner de app (Android / iOS)
  const [appBannerPlatform, setAppBannerPlatform] = useState<"android" | "ios" | null>(null);
  const [appBannerDismissed, setAppBannerDismissed] = useState(false);

  // Form
  const [produto, setProduto] = useState("");
  const [cenario, setCenario] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Catálogo: foto do modelo
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const modelFileRef = useRef<HTMLInputElement>(null);

  // Job state
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [formError, setFormError] = useState("");
  const [timeoutError, setTimeoutError] = useState("");
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blur animation: decreases from 40px to 8px over ~90s
  const [blurPx, setBlurPx] = useState(40);
  const blurRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tempo decorrido desde início da geração
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress bar
  const [progressVal, setProgressVal] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Creation mode
  const [creationMode, setCreationMode] = useState<CreationMode>("simulacao");
  const [modeSelected, setModeSelected] = useState(false); // true = mostra form, false = mostra menu

  // Photo editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [editExpanded, setEditExpanded] = useState(false);
  const [removingResultBg, setRemovingResultBg] = useState(false);

  // Video state
  const [videoMode, setVideoMode] = useState(false);
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoSubmitting, setVideoSubmitting] = useState(false);
  const [videoError, setVideoError] = useState("");
  const videoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [videoElapsedSec, setVideoElapsedSec] = useState(0);
  const [videoDisplayProgress, setVideoDisplayProgress] = useState(0);
  const videoElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const countdown = useCountdown(rateLimitedUntil);
  const vision = useProductVision();
  const [pendingResult, setPendingResult] = useState(false);

  // Upsell popup A/B
  const [showUpsell, setShowUpsell] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState(false); // veio do onboarding → funil ativo
  const [showConversion, setShowConversion] = useState(false); // tela de conversão pós-foto
  const onboardingDataRef = useRef<{ file: File; produto: string; cenario: string } | null>(null);

  // TamoBot — persiste em localStorage para sobreviver ao reload
  const [botActive, setBotActive] = useState(() => {
    try { return localStorage.getItem("bot_active_24h") === "1"; } catch { return false; }
  });
  const [botNavOpen, setBotNavOpen] = useState(false);

  function activateBot() {
    setBotActive(true);
    try { localStorage.setItem("bot_active_24h", "1"); } catch { /* ignora */ }
  }

  // warmupVision desabilitado — carrega sob demanda ao subir foto

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? "";
      let resolvedPlan: Plan = "free";
      let hasActivePhotoJob = false;

      const res = await fetch("/api/image-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // API retorna { jobs, plan }
        const jobs: Job[] = Array.isArray(data) ? data : (data.jobs ?? []);
        const userPlan: Plan = data.plan ?? "free";
        resolvedPlan = userPlan;
        setPlan(userPlan);

        // Exibe upsell popup 1s após login para usuários free
        if (userPlan === "free") {
          setTimeout(async () => {
            const { shouldShowUpsell } = await import("@/app/components/UpsellPopup");
            if (shouldShowUpsell()) setShowUpsell(true);
          }, 1000);
        }

        const active = jobs.find(
          (j) => j.status !== "done" && j.status !== "failed" && j.status !== "canceled"
        );
        if (active) {
          hasActivePhotoJob = true;
          setJob(active);
          if (active.input_image_url) setPreview(active.input_image_url);
          setModeSelected(true);
          // Job ativo encontrado — limpa pending_job_id do sessionStorage
          try { sessionStorage.removeItem("pending_job_id"); } catch { /* ignora */ }
        } else {
          // Restaura o job done mais recente (criado nas últimas 24h) para mostrar resultado
          // Ignora jobs que o usuário descartou explicitamente (clicou em "criar nova foto")
          const dismissedIds: string[] = JSON.parse(sessionStorage.getItem("dismissed_jobs") ?? "[]");
          const recentDone = jobs.find(
            (j) => j.status === "done" && j.output_image_url &&
            !dismissedIds.includes(j.id) &&
            new Date(j.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000
          );
          if (recentDone) {
            setJob(recentDone);
            try { sessionStorage.removeItem("pending_job_id"); } catch { /* ignora */ }
          } else {
            // Nenhum job ativo nem done recente — verifica se há um job pendente salvo no sessionStorage
            // (ocorre quando o usuário navega para outra página enquanto o job ainda estava sendo criado)
            try {
              const pendingJobId = sessionStorage.getItem("pending_job_id");
              if (pendingJobId && !dismissedIds.includes(pendingJobId)) {
                // Busca esse job específico na API
                const pres = await fetch(`/api/image-jobs/${pendingJobId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (pres.ok) {
                  const pjob = await pres.json();
                  if (pjob?.id && pjob.status !== "canceled") {
                    hasActivePhotoJob = pjob.status !== "done" && pjob.status !== "failed";
                    setJob(pjob);
                    if (pjob.input_image_url) setPreview(pjob.input_image_url);
                    if (hasActivePhotoJob) setModeSelected(true);
                  } else {
                    sessionStorage.removeItem("pending_job_id");
                  }
                } else {
                  sessionStorage.removeItem("pending_job_id");
                }
              }
            } catch { /* ignora */ }
          }
        }

        // Detecta rate limit no carregamento: free user com job COMPLETO recente (<24h)
        if (userPlan === "free") {
          const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
          const lastDoneJob = jobs
            .filter((j) => j.status === "done")
            .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];
          if (lastDoneJob?.created_at) {
            const nextAvailable = new Date(new Date(lastDoneJob.created_at).getTime() + FREE_COOLDOWN_MS);
            if (nextAvailable > new Date()) {
              setRateLimitedUntil(nextAvailable);
            }
          }
        }
      }

      // Restaura estado de vídeo ao recarregar a página
      const vres = await fetch("/api/video-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (vres.ok) {
        const vdata: VideoJob[] = await vres.json();
        const activeVideo = vdata.find(
          (v) => v.status !== "done" && v.status !== "failed" && v.status !== "canceled"
        );
        // Só restaura vídeo done se foi criado nas últimas 24h e não foi descartado pelo usuário
        const dismissedVideoIds: string[] = JSON.parse(sessionStorage.getItem("dismissed_jobs") ?? "[]");
        const doneVideo = vdata.find(
          (v) => v.status === "done" &&
          !dismissedVideoIds.includes(v.id) &&
          new Date(v.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );
        if (activeVideo) {
          setVideoJob(activeVideo);
          setVideoMode(true);
        } else if (doneVideo) {
          setVideoJob(doneVideo);
          setVideoMode(true);
          setPendingResult(false); // vídeo pronto — esconde "Ver Resultado" da foto
        }
      }

      // Vindo de Criações: abrir modo vídeo para um job específico
      const videoFromJob = sessionStorage.getItem("video_from_job");
      if (videoFromJob && !hasActivePhotoJob) {
        sessionStorage.removeItem("video_from_job");
        const { data: session2 } = await supabase.auth.getSession();
        const t2 = session2.session?.access_token ?? "";
        const jr = await fetch(`/api/image-jobs/${videoFromJob}`, { headers: { Authorization: `Bearer ${t2}` } });
        if (jr.ok) {
          const j = await jr.json();
          if (j.status === "done" && j.output_image_url) {
            setJob(j);
            setModeSelected(true);
            // Usa resolvedPlan (local) em vez de plan (React state ainda stale)
            if (resolvedPlan === "pro") setVideoMode(true);
          }
        }
      } else if (videoFromJob && hasActivePhotoJob) {
        // Tem foto sendo gerada — ignora pedido de vídeo, limpa sessionStorage
        sessionStorage.removeItem("video_from_job");
      }

      setLoading(false);
    });
  }, [router]);

  // Banner de app: detecta plataforma e decide se exibe
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isStandalone =
      (window.navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) return; // já está como PWA instalado — não mostra banner

    if (isAndroid) {
      const dismissed = localStorage.getItem("app_banner_dismissed_android");
      if (!dismissed) setAppBannerPlatform("android");
    } else if (isIOS) {
      // Mostra se o usuário nunca visitou /app (nunca viu as instruções de instalação)
      const visited = localStorage.getItem("ios_app_visited");
      if (!visited) setAppBannerPlatform("ios");
    }
  }, []);

  // Polling a cada 10s enquanto job estiver ativo
  useEffect(() => {
    if (!job || !user) return;
    if (job.status === "done" || job.status === "failed" || job.status === "canceled") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setShowCancel(false);
      // Se falhou, reseta automaticamente para o formulário com mensagem de erro
      if (job.status === "failed") {
        setTimeoutError("Algo deu errado na geração. Tenta novamente.");
        resetJob();
      }
      return;
    }

    pollRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchJobStatus(job.id);
    }, 10_000);
    setShowCancel(false);
    cancelTimerRef.current = setTimeout(() => setShowCancel(true), 30_000);

    // Tempo decorrido — só atualiza quando tab está visível (evita crash iOS em background)
    setElapsedSec(0);
    elapsedRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") setElapsedSec((s) => s + 1);
    }, 1000);

    // Animação de blur: começa em 40px, reduz ~0.35px/s → chega ~8px em ~90s
    setBlurPx(40);
    blurRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") setBlurPx((prev) => Math.max(8, prev - 0.35));
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, user]);

  // Countdown: quando chegar a 0 E o prazo já passou de fato, limpar rate limit
  useEffect(() => {
    if (rateLimitedUntil && countdown === 0 && rateLimitedUntil.getTime() <= Date.now()) {
      setRateLimitedUntil(null);
    }
  }, [countdown, rateLimitedUntil]);

  // Quando job termina (done) no plano free, ativa cooldown de 24h automaticamente
  useEffect(() => {
    if (plan === "free" && job?.status === "done" && job.id !== "rate_limited") {
      const jobTime = job.created_at ? new Date(job.created_at).getTime() : Date.now();
      const next = new Date(jobTime + 24 * 60 * 60 * 1000);
      if (next > new Date()) setRateLimitedUntil(next);
    }
  }, [job?.status, plan]);

  // Quando foto fica pronta: segura na tela de carregamento — usuário vê botão "Ver Resultado"
  useEffect(() => {
    if (job?.status === "done" && job.output_image_url && job.id !== "rate_limited") {
      setPendingResult(true);
    }
  }, [job?.status, job?.output_image_url]);

  // Funil onboarding: quando foto fica pronta, mostra tela de conversão
  useEffect(() => {
    if (onboardingMode && job?.status === "done" && job.output_image_url) {
      setShowConversion(true);
    }
  }, [onboardingMode, job?.status, job?.output_image_url]);

  // Timeout automático: usa setTimeout único em vez de checar a cada 1s (elapsedSec)
  useEffect(() => {
    if (!job || workState !== "trabalhando") return;
    const status = job.status;
    if (status === "done" || status === "failed" || status === "canceled") return;
    // queued/submitted: até 90 min (fila pode ter muitos jobs)
    // processing: 15 min (já está rodando, não deve demorar tanto)
    const limitSec = (status === "queued" || status === "submitted") ? 5400 : 900;
    const startTime = job.created_at ? new Date(job.created_at).getTime() : Date.now();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = limitSec - elapsed;
    if (remaining <= 0) {
      const msg = (status === "queued" || status === "submitted")
        ? "Algo deu errado — o servidor não conseguiu processar. Tenta novamente."
        : "Algo deu errado — a geração demorou demais. Tenta novamente.";
      setTimeoutError(msg);
      getToken().then(token => {
        if (job.id) fetch(`/api/image-jobs/${job.id}/cancel`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      });
      resetJob();
      return;
    }
    const t = setTimeout(() => {
      const msg = (status === "queued" || status === "submitted")
        ? "Algo deu errado — o servidor não conseguiu processar. Tenta novamente."
        : "Algo deu errado — a geração demorou demais. Tenta novamente.";
      setTimeoutError(msg);
      getToken().then(token => {
        if (job.id) fetch(`/api/image-jobs/${job.id}/cancel`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      });
      resetJob();
    }, remaining * 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, job?.created_at]);

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
    const token = data.session?.access_token ?? "";
    // Se token expirou (exp no passado), forçar refresh
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp && payload.exp * 1000 < Date.now() + 60_000) {
          const { data: r } = await supabase.auth.refreshSession();
          return r.session?.access_token ?? token;
        }
      } catch { /* ignora erro de parse */ }
    }
    return token;
  }

  // Registra subscription de Web Push no Service Worker
  async function registerPushSubscription(tok: string) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const VAPID_PUBLIC = "BOFpGK6deSOtMczLOppZ8RXLb8XbAP0cs4hDHOZtJrDsnLhvzdPQXeojc5CohPhnj0PvNkPd7B7HKLtUva03cGk";
      const padding = "=".repeat((4 - (VAPID_PUBLIC.length % 4)) % 4);
      const base64 = (VAPID_PUBLIC + padding).replace(/-/g, "+").replace(/_/g, "/");
      const raw = atob(base64);
      const key = Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
    } catch {}
  }

  // Pede permissão e registra — chamado após primeira foto pronta
  async function requestAndRegisterPush() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "denied") return;
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    }
    const tok = await getToken();
    await registerPushSubscription(tok);
  }

  // Envia notificação via servidor (Web Push real — funciona com app fechado)
  async function sendPushNotification(title: string, body: string) {
    try {
      const tok = await getToken();
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ title, body, url: "/" }),
      });
    } catch {}
  }

  async function fetchJobStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok) return;
    const data: Job = await res.json();
    if (data.status === "done") {
      await requestAndRegisterPush();
      await sendPushNotification(
        lang === "en" ? "Your photo is ready! 🎉" : lang === "es" ? "¡Tu foto está lista! 🎉" : "Sua foto está pronta! 🎉",
        lang === "en" ? "Tap to see the AI-generated image." : lang === "es" ? "Toca para ver la imagen generada por IA." : "Toque para ver a imagem gerada pela IA."
      );
    } else if (data.status === "failed") {
      sendPushNotification(
        lang === "en" ? "Generation error" : lang === "es" ? "Error en la generación" : "Erro na geração",
        lang === "en" ? "Could not generate the photo. Please try again." : lang === "es" ? "No se pudo generar la foto. Inténtalo de nuevo." : "Não foi possível gerar a foto. Tente novamente."
      );
    }
    setJob(data);
  }

  async function fetchProgress(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${jobId}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setProgressVal(data.progress ?? 0);
  }

  // Poll progress
  useEffect(() => {
    const activeStatuses = ["queued", "submitted", "processing"];
    if (!job?.id || !activeStatuses.includes(job.status ?? "")) return;
    fetchProgress(job.id);
    const iv = setInterval(() => fetchProgress(job.id), 4000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  // Smooth progress animation
  useEffect(() => {
    const iv = setInterval(() => {
      setDisplayProgress((prev) => {
        if (Math.abs(prev - progressVal) < 1) return progressVal;
        return prev + (progressVal - prev) * 0.12;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [progressVal]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
      vision.reset();
    }
  }

  // Processa fundo branco no browser via WebAssembly (sem servidor)
  async function processWhiteBackground(file: File): Promise<File> {
    const { removeBackground } = await import("@imgly/background-removal");
    // Remove fundo → blob PNG transparente
    // proxyToWorker:false evita problemas de URL de worker no Next.js
    // Timeout de 90s: modelo WASM pesado, mobile lento pode demorar
    const noBgBlob = await Promise.race([
      removeBackground(file, {
        proxyToWorker: false,
        output: { format: "image/png" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          lang === "en" ? "Background removal timed out. Please try a smaller photo or try again."
          : lang === "es" ? "Tiempo de espera agotado. Intente con una foto más pequeña o vuelva a intentarlo."
          : "Tempo esgotado ao remover fundo. Tente com uma foto menor ou tente novamente."
        )), 90_000)
      ),
    ]);
    // Compõe sobre fundo branco usando Canvas
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(noBgBlob);
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], "whitebg.jpg", { type: "image/jpeg" }));
          else reject(new Error("Canvas toBlob falhou"));
        }, "image/jpeg", 0.92);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function convertToJpegIfNeeded(file: File): Promise<File> {
    const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
    if (!isHeic) return file;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" }));
          else resolve(file);
        }, "image/jpeg", 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleSubmit(
    e: React.FormEvent,
    overrides?: { file?: File; produto?: string; cenario?: string; mode?: CreationMode }
  ) {
    e.preventDefault();

    const _mode    = overrides?.mode    ?? creationMode;
    const _file    = overrides?.file    ?? imageFile;
    const _produto = overrides?.produto ?? produto;
    const _cenario = overrides?.cenario ?? cenario;

    // Modo vídeo: rota separada
    if (_mode === "video") {
      if (!_file) { setFormError("Envie uma foto"); return; }
      setFormError("");
      setVideoError("");
      try {
        const token = await getToken();
        const fileToUpload = await convertToJpegIfNeeded(_file);
        const form = new FormData();
        form.append("file", fileToUpload);
        const uploadRes = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
        if (!uploadRes.ok) throw new Error("Falha ao enviar imagem");
        const { url: imageUrl } = await uploadRes.json();
        await handleVideoSubmit(imageUrl);
        setVideoMode(true);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Erro");
      }
      return;
    }

    if (_mode === "catalogo" && !modelFile && !modelPreview) { setFormError(lang === "en" ? "Choose a model" : lang === "es" ? "Elige un modelo" : "Escolha um modelo"); return; }
    if (!_file) { setFormError(lang === "en" ? "Upload the product photo" : lang === "es" ? "Sube la foto del producto" : "Envie a foto do produto"); return; }
    if (!_produto.trim()) { setFormError(lang === "en" ? "Describe the product" : lang === "es" ? "Describe el produto" : "Descreva o produto"); return; }
    if (_mode !== "fundo_branco" && !_cenario.trim()) { setFormError(lang === "en" ? "Describe the photo scene" : lang === "es" ? "Describe la escena de la foto" : "Descreva o cenário da foto"); return; }

    setFormError("");
    setTimeoutError("");
    setSubmitting(true);
    setJob(null);

    try {
      const token = await getToken();

      // Upload da imagem do produto (converte HEIC/HEIF para JPEG)
      const fileToUpload = await convertToJpegIfNeeded(_file!);
      const form = new FormData();
      form.append("file", fileToUpload);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Falha ao enviar imagem");
      }
      const { url: imageUrl } = await uploadRes.json();

      // Fundo branco: processa no browser (WebAssembly), depois registra job
      if (_mode === "fundo_branco") {
        const prompt = `${_produto} | fundo branco`;

        // 1. Processa no browser — remove fundo + adiciona branco
        const processedFile = await processWhiteBackground(fileToUpload);

        // 2. Faz upload da imagem já processada
        const pfForm = new FormData();
        pfForm.append("file", processedFile);
        const pfRes = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: pfForm,
        });
        if (!pfRes.ok) throw new Error("Falha ao enviar imagem processada");
        const { url: outputUrl } = await pfRes.json();

        // 3. Registra job como "done" (rate limit + job creation no servidor)
        const res = await fetch("/api/white-bg", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt, input_image_url: imageUrl, output_image_url: outputUrl }),
        });

        if (res.status === 429) {
          const err = await res.json().catch(() => ({}));
          const nextAt = err.nextAvailableAt ? new Date(err.nextAvailableAt) : null;
          const validAt = nextAt && !isNaN(nextAt.getTime()) && nextAt > new Date() ? nextAt : new Date(Date.now() + 60 * 60 * 1000);
          setRateLimitedUntil(validAt);
          setJob(null);
          setSubmitting(false);
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Falha ao processar");
        }
        const data = await res.json();
        setJob({ id: data.jobId, status: "done", output_image_url: data.output_image_url });
        setSubmitting(false);
        return;
      }

      // Catálogo: modelo pode ser do catálogo (URL pública) ou upload manual
      let modelImageUrl: string | null = null;
      if (_mode === "catalogo" && !modelFile && modelPreview?.startsWith("http")) {
        // Modelo do catálogo — usa URL diretamente
        modelImageUrl = modelPreview;
      } else if (_mode === "catalogo" && modelFile) {
        const mform = new FormData();
        mform.append("file", modelFile);
        const mres = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: mform,
        });
        if (!mres.ok) throw new Error("Falha ao enviar foto do modelo");
        const { url } = await mres.json();
        modelImageUrl = url;
      }

      // Monta prompt (catálogo codifica model_img no prefixo)
      const basePrompt = _cenario.trim() ? `${_produto} | cenário: ${_cenario}` : _produto;
      const prompt = modelImageUrl
        ? `model_img:${modelImageUrl} | ${basePrompt}`
        : basePrompt;

      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, input_image_url: imageUrl, mode: _mode }),
      });

      if (jobRes.status === 429) {
        const err = await jobRes.json().catch(() => ({}));
        const nextAt = err.nextAvailableAt ? new Date(err.nextAvailableAt) : null;
        const validAt = nextAt && !isNaN(nextAt.getTime()) && nextAt > new Date() ? nextAt : new Date(Date.now() + 60 * 60 * 1000);
        setRateLimitedUntil(validAt);
        setJob(null); // não deixa spinner infinito — volta para tela de limite diário
        setSubmitting(false);
        return;
      }

      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Falha ao criar job");
      }
      const { jobId } = await jobRes.json();

      // Persiste o ID do job no sessionStorage para restaurar caso o usuário navegue para outra página
      try { sessionStorage.setItem("pending_job_id", jobId); } catch { /* ignora */ }

      setJob({ id: jobId, status: "queued" });
      setTimeout(() => fetchJobStatus(jobId), 10_000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssinarDireto(selectedPlan: "annual" | "monthly") {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const body = selectedPlan === "monthly" ? { plan: "monthly" } : {};
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.init_point) window.location.href = json.init_point;
      else router.push("/planos");
    } catch {
      router.push("/planos");
    }
  }

  async function handleRemoveResultBg() {
    const url = editedImageUrl ?? job?.output_image_url;
    if (!url) return;
    setRemovingResultBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const res = await fetch(url);
      const blob = await res.blob();
      const noBgBlob = await removeBackground(blob, { proxyToWorker: false, output: { format: "image/png" } });
      setEditedImageUrl(URL.createObjectURL(noBgBlob));
    } catch {
      alert(lang === "en" ? "Could not remove background. Try again." : "Não foi possível remover o fundo. Tente novamente.");
    } finally {
      setRemovingResultBg(false);
    }
  }

  function resetJob() {
    // Marca o job atual como descartado para evitar restauração automática
    if (job?.id) {
      try {
        const dismissed: string[] = JSON.parse(sessionStorage.getItem("dismissed_jobs") ?? "[]");
        if (!dismissed.includes(job.id)) {
          dismissed.push(job.id);
          sessionStorage.setItem("dismissed_jobs", JSON.stringify(dismissed));
        }
      } catch { /* ignora */ }
    }
    // Limpa job pendente salvo no sessionStorage
    try { sessionStorage.removeItem("pending_job_id"); } catch { /* ignora */ }
    vision.reset();
    if (pollRef.current) clearInterval(pollRef.current);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    if (blurRef.current) clearInterval(blurRef.current);
    setShowCancel(false);
    setJob(null);
    setPendingResult(false);
    setTimeoutError("");
    setFormError("");
    setProduto("");
    setCenario("");
    setImageFile(null);
    setPreview(null);
    setModelFile(null);
    setModelPreview(null);
    setModeSelected(false); // volta para o menu
    setEditExpanded(false);
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

  // Polling de vídeo a cada 15s
  useEffect(() => {
    if (!videoJob || !user) return;
    if (["done", "failed", "canceled"].includes(videoJob.status ?? "")) {
      if (videoPollRef.current) clearInterval(videoPollRef.current);
      if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
      if (videoJob.status === "done") {
        sendPushNotification("Seu vídeo está pronto! 🎬", "Toque para ver o vídeo gerado.");
        setVideoMode(true); // garante que o resultado aparece
        setPendingResult(false); // limpa "Ver Resultado" da foto
      }
      if (videoJob.status === "failed") {
        setVideoMode(false); // volta para o resultado da foto
      }
      return;
    }
    // Timer de tempo decorrido para barra de progresso
    setVideoElapsedSec(0);
    videoElapsedRef.current = setInterval(() => setVideoElapsedSec((s) => s + 1), 1000);
    videoPollRef.current = setInterval(() => fetchVideoStatus(videoJob.id), 15_000);
    return () => {
      if (videoPollRef.current) clearInterval(videoPollRef.current);
      if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoJob?.id, videoJob?.status, user]);

  // Animação suave da barra de vídeo (máx 90% em ~4min)
  useEffect(() => {
    const MAX_SEC = 240;
    const target = Math.min(90, Math.round((videoElapsedSec / MAX_SEC) * 90));
    setVideoDisplayProgress((prev) => prev + (target - prev) * 0.08);
  }, [videoElapsedSec]);

  async function fetchVideoStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/video-jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    setVideoJob(await res.json());
  }

  async function handleVideoSubmit(rawImageUrl: string) {
    // Sanitiza URL malformada (ex: "https://htpps::https://storage...")
    let imageUrl = String(rawImageUrl).trim();
    imageUrl = imageUrl.replace(/^https?:\/\/[^/]{1,30}::https?:\/\//i, "https://");
    imageUrl = imageUrl.replace(/^https?:\/\/https?:\/\//i, "https://");
    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) imageUrl = "https://" + imageUrl;

    setVideoError("");
    setVideoSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: videoPrompt, input_image_url: imageUrl }),
      });
      if (res.status === 403) { setVideoError("Disponível apenas no plano Pro."); return; }
      if (!res.ok) throw new Error("Erro ao criar job de vídeo");
      const { jobId } = await res.json();
      setVideoJob({ id: jobId, status: "queued" });
      setTimeout(() => fetchVideoStatus(jobId), 15_000);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Erro");
    } finally {
      setVideoSubmitting(false);
    }
  }

  function resetVideo() {
    // Marca o vídeo job atual como descartado para evitar restauração automática
    if (videoJob?.id) {
      try {
        const dismissed: string[] = JSON.parse(sessionStorage.getItem("dismissed_jobs") ?? "[]");
        if (!dismissed.includes(videoJob.id)) {
          dismissed.push(videoJob.id);
          sessionStorage.setItem("dismissed_jobs", JSON.stringify(dismissed));
        }
      } catch { /* ignora */ }
    }
    if (videoPollRef.current) clearInterval(videoPollRef.current);
    if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
    setVideoMode(false);
    setVideoJob(null);
    setVideoPrompt("");
    setVideoError("");
    setVideoDisplayProgress(0);
    setVideoElapsedSec(0);
  }

  function resetAll() {
    resetVideo();
    resetJob();
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await downloadBlob(blob, "foto-ia.jpg");
    } catch {
      window.open(url, "_blank");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isGenerating = (submitting || (!!job && job.status !== "done" && job.status !== "failed" && job.status !== "canceled")) && job?.status !== "done";
  // State machine: sem_trabalho | trabalhando | terminado
  // submitting=true OU job ativo = tela "Trabalhando..." — não volta para formulário até ter resultado
  const workState: WorkState = (submitting || pendingResult || (!!job && job.status !== "done" && job.status !== "failed" && job.status !== "canceled" && job.status !== null))
    ? "trabalhando"
    : deriveWorkState(job);

  if (loading) return (
    <div style={styles.page} className="app-layout">
      <style>{`
        @keyframes skeletonShimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
      <header style={styles.header} className="app-header">
        <div style={skl.logoBlock} />
        <div style={skl.avatarBlock} />
      </header>
      <main style={styles.main} className="app-main">
        <div style={skl.labelBlock} />
        <div style={skl.grid}>
          {[0,1,2,3].map(i => (
            <div key={i} style={skl.card}>
              <div style={{ position: "relative" as const, width: "100%", aspectRatio: "3 / 4" }}>
                <div style={skl.cardImg} />
                {/* overlay de texto no rodapé do card */}
                <div style={skl.cardOverlay}>
                  <div style={skl.cardTextSm} />
                  <div style={skl.cardTextLg} />
                </div>
              </div>
              <div style={skl.cardFooter}>
                <div style={skl.cardBtn} />
              </div>
            </div>
          ))}
        </div>
      </main>
      <div style={skl.bottomNav}>
        {[0,1,2].map(i => (
          <div key={i} style={skl.navItem}>
            <div style={skl.navIcon} />
            <div style={skl.navLabel} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.page} className="app-layout">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseBtnAnim {
          0% { box-shadow: 0 0 0 0 rgba(168,85,247,0.55); transform: scale(1); }
          60% { box-shadow: 0 0 0 14px rgba(168,85,247,0); transform: scale(1.03); }
          100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); transform: scale(1); }
        }
        /* Desktop: header simplificado */
        @media (min-width: 900px) {
          .page-logo { display: none !important; }
          .page-header {
            background: transparent !important;
            border-bottom: none !important;
            position: relative !important;
            padding: 12px 48px !important;
            justify-content: flex-end !important;
          }
          /* Estado gerando: 2 colunas */
          .generating-wrap {
            display: grid !important;
            grid-template-columns: 300px 1fr !important;
            gap: 0 !important;
            max-width: 860px !important;
            margin: 0 auto !important;
            height: calc(100vh - 140px) !important;
            max-height: 620px !important;
            background: #0d1117 !important;
            border-radius: 20px !important;
            overflow: hidden !important;
            border: 1px solid rgba(255,255,255,0.06) !important;
            padding: 0 !important;
          }
          .generating-panel {
            padding: 36px 28px !important;
            border-right: 1px solid rgba(255,255,255,0.06) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 20px !important;
          }
          .generating-preview {
            height: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
            overflow: hidden !important;
          }
          .generating-preview img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
          /* Estado resultado: 2 colunas */
          .result-wrap {
            display: grid !important;
            grid-template-columns: 1fr 360px !important;
            gap: 0 !important;
            max-width: 100% !important;
            background: #0d1117 !important;
            border-radius: 20px !important;
            overflow: hidden !important;
            border: 1px solid rgba(255,255,255,0.06) !important;
            padding: 0 !important;
            animation: fadeIn 0.5s ease !important;
          }
          .result-image-col {
            background: #07080b;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 32px !important;
            min-height: 500px !important;
          }
          .result-image-col img {
            max-height: 70vh !important;
            width: auto !important;
            max-width: 100% !important;
            border-radius: 12px !important;
          }
          .result-actions-col {
            padding: 48px 36px !important;
            border-left: 1px solid rgba(255,255,255,0.06) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 14px !important;
          }
          /* No desktop: esconde as ações mobile duplicadas */
          .result-mobile-actions { display: none !important; }
          /* Imagem resultado: proporcional, não estica */
          .result-image-col img {
            max-height: 75vh !important;
            width: auto !important;
            max-width: 100% !important;
            object-fit: contain !important;
            border-radius: 12px !important;
            margin-bottom: 0 !important;
          }
        }
        /* Mobile: esconde as ações desktop */
        @media (max-width: 899px) {
          .result-actions-col { display: none !important; }
          .result-image-col { padding: 0 !important; background: transparent !important; }
          .result-image-col img { border-radius: 16px !important; width: 100% !important; max-height: none !important; }
          .generating-panel { padding: 0 !important; border: none !important; }
          /* Remove padding do card de resultado no mobile — a largura é controlada pelo result-mobile-actions */
          .result-wrap { padding: 0 !important; overflow: hidden; }
        }
      `}</style>

      {/* Header */}
      <header style={styles.header} className="app-header page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="page-logo">
          <img src="/icons/icon-512.png" alt="TamoWork" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
          <div style={styles.logo}>TamoWork</div>
        </div>
        <div style={styles.headerRight}>
          <LangSelector />
          {plan === "pro" && <span style={styles.proBadge}>✦ Pro</span>}
          <button onClick={() => router.push("/conta")} style={styles.accountBtn} aria-label="Minha conta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
        </div>
      </header>

      <main style={styles.main} className="app-main">

        {/* Banner de app — Android (Play Store) / iOS (tela inicial) */}
        {appBannerPlatform && !appBannerDismissed && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: appBannerPlatform === "android"
              ? "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.08))"
              : "linear-gradient(135deg,rgba(99,102,241,0.14),rgba(168,85,247,0.09))",
            border: `1px solid ${appBannerPlatform === "android" ? "rgba(34,197,94,0.3)" : "rgba(168,85,247,0.3)"}`,
            borderRadius: 14, padding: "12px 14px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>
              {appBannerPlatform === "android" ? "📲" : "📱"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#eef2f9", marginBottom: 2 }}>
                {appBannerPlatform === "android"
                  ? "Baixe o app TamoWork"
                  : "Adicione à tela inicial"}
              </div>
              <div style={{ fontSize: 12, color: "#8394b0" }}>
                {appBannerPlatform === "android"
                  ? "Acesse mais rápido pela Play Store"
                  : "Use como app no seu iPhone — é mais rápido"}
              </div>
            </div>
            <a
              href="/app"
              onClick={() => {
                if (appBannerPlatform === "ios") {
                  localStorage.setItem("ios_app_visited", "1");
                }
              }}
              style={{
                flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#fff",
                background: appBannerPlatform === "android"
                  ? "linear-gradient(135deg,#16c784,#10b981)"
                  : "linear-gradient(135deg,#6366f1,#a855f7)",
                borderRadius: 10, padding: "7px 12px", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              {appBannerPlatform === "android" ? "Baixar" : "Ver como"}
            </a>
            <button
              onClick={() => {
                setAppBannerDismissed(true);
                if (appBannerPlatform === "android") {
                  localStorage.setItem("app_banner_dismissed_android", "1");
                } else {
                  // iOS: guardar que já foi visitado para não mostrar novamente
                  localStorage.setItem("ios_app_visited", "1");
                }
              }}
              style={{
                flexShrink: 0, background: "none", border: "none", color: "#4e5c72",
                fontSize: 18, cursor: "pointer", padding: "0 2px", lineHeight: 1,
              }}
              aria-label="Fechar"
            >×</button>
          </div>
        )}

        {/* Banner de vídeo falhou — aparece quando !videoMode */}
        {videoJob?.status === "failed" && !videoMode && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>😔</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 14 }}>Erro ao gerar vídeo</div>
              <div style={{ color: "#8394b0", fontSize: 12 }}>Houve um problema. Tente novamente.</div>
            </div>
            <button onClick={() => { resetVideo(); setVideoMode(true); }} style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 10, padding: "6px 12px", color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Tentar
            </button>
            <button onClick={resetVideo} style={{ background: "none", border: "none", color: "#4e5c72", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Banner de vídeo em criação — aparece no topo quando usuário navega para outras telas */}
        {videoJob && !["done", "failed", "canceled"].includes(videoJob.status ?? "") && workState !== "trabalhando" && !videoMode && (
          <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.18),rgba(168,85,247,0.12))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setVideoMode(true)}>
            <span style={{ fontSize: 22 }}>🎬</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 14 }}>Criando seu vídeo...</div>
              <div style={{ color: "#8394b0", fontSize: 12 }}>Pode continuar usando o app — te avisamos quando ficar pronto</div>
            </div>
            <div style={{ width: 80, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${videoDisplayProgress}%`, background: "linear-gradient(90deg,#6366f1,#a855f7)", borderRadius: 99, transition: "width 1s ease" }} />
            </div>
          </div>
        )}

        {/* PASSO 1: Menu de escolha de modo */}
        {workState === "sem_trabalho" && !modeSelected && !videoMode && (
          <div style={styles.menuWrap}>
            {rateLimitedUntil && countdown > 0 ? (
              <DailyLimitScreen countdown={countdown} onAssinar={() => handleAssinarDireto("annual")} />
            ) : (
              <ModeSelector
                selected={creationMode}
                onChange={(m) => {
                  setCreationMode(m);
                  setImageFile(null); setPreview(null);
                  setModelFile(null); setModelPreview(null);
                  if (m === "fundo_branco") setCenario("fundo branco limpo, luz de estúdio");
                  else setCenario("");
                  setModeSelected(true);
                }}
              />
            )}
          </div>
        )}

        {/* PASSO 2: Formulário após escolher o modo */}
        {workState === "sem_trabalho" && modeSelected && !videoMode && (
          <div style={styles.card}>
            {/* Botão voltar */}
            <button onClick={() => setModeSelected(false)} style={styles.backToMenuBtn}>
              {t("back")}
            </button>

            <div style={styles.modeHeader}>
              <div style={styles.modeName}>
                {{
                  simulacao: "Simulação de uso",
                  fundo_branco: "Fundo branco",
                  catalogo: "Catálogo com modelo",
                  personalizado: "Personalizado",
                  video: "Criar vídeo",
                  promo: "Criar promoção",
                }[creationMode]}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>

              {/* ── MODO VÍDEO ── */}
              {creationMode === "video" ? (
                <>
                  <div
                    style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}) }}
                    onClick={() => fileRef.current?.click()}
                  >
                    {preview ? (
                      <img src={preview} alt="preview" style={styles.previewImg} />
                    ) : (
                      <>
                        <div style={styles.uploadIcon}>🎬</div>
                        <div style={styles.uploadText}>Envie a foto que vira vídeo</div>
                        <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>O que você quer que aconteça? <span style={{ color: "#4e5c72" }}>(opcional)</span></label>
                    <input
                      type="text"
                      placeholder="Ex: câmera girando suavemente, produto rotacionando"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  {plan !== "pro" && (
                    <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", marginBottom: 4 }}>🔒 Disponível no plano Pro</div>
                      <div style={{ fontSize: 12, color: "#8394b0", marginBottom: 12 }}>Vídeos com IA a partir de R$0,61/dia</div>
                      <button type="button" onClick={() => router.push("/planos")} style={styles.unlockBtn}>✨ Assinar agora</button>
                    </div>
                  )}

                  {videoError && <div style={styles.error}>{videoError}</div>}

                  <button
                    type="submit"
                    disabled={videoSubmitting || !imageFile || plan !== "pro"}
                    style={{ ...styles.submitBtn, opacity: (videoSubmitting || !imageFile || plan !== "pro") ? 0.5 : 1 }}
                  >
                    {videoSubmitting ? (lang === "en" ? "Sending..." : lang === "es" ? "Enviando..." : "Enviando...") : t("btn_generate_video")}
                  </button>
                </>
              ) : (
              <>
              {/* ── MODOS DE FOTO ── */}
              {creationMode === "catalogo" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={styles.uploadLabel}>1. Escolha o modelo</div>
                    <CatalogModelPicker
                      selected={modelPreview}
                      onSelect={(url) => {
                        setModelPreview(url);
                        setModelFile(null); // modelo do catálogo: URL direta
                      }}
                      onCustom={() => modelFileRef.current?.click()}
                    />
                    <input ref={modelFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setModelFile(f); setModelPreview(f ? URL.createObjectURL(f) : null);
                    }} style={{ display: "none" }} />
                  </div>
                  <div>
                    <div style={styles.uploadLabel}>2. Foto do produto</div>
                    <div
                      style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}), marginBottom: 0 }}
                      onClick={() => fileRef.current?.click()}
                    >
                      {preview ? (
                        <img src={preview} alt="produto" style={styles.previewImg} />
                      ) : (
                        <>
                          <div style={styles.uploadIcon}>📦</div>
                          <div style={styles.uploadText}>Foto do produto</div>
                          <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                        </>
                      )}
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}) }}
                  onClick={() => fileRef.current?.click()}
                >
                  {preview ? (
                    <img src={preview} alt="preview" style={styles.previewImg} />
                  ) : (
                    <>
                      <div style={styles.uploadIcon}>📷</div>
                      <div style={styles.uploadText}>
                        {creationMode === "fundo_branco" ? "Foto do produto (qualquer fundo)" : "Foto do produto"}
                      </div>
                      <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                </div>
              )}

              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  {t("field_product")}
                </label>
                <input
                  type="text"
                  placeholder="Ex: conjunto feminino floral, blusa cropped azul, tênis branco…"
                  value={produto}
                  onChange={(e) => setProduto(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>

              {creationMode !== "fundo_branco" && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    {creationMode === "personalizado"
                      ? (lang === "en" ? "Describe the result you want" : lang === "es" ? "Describe el resultado que quieres" : "Descreva o resultado que quer")
                      : t("field_scene")}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      creationMode === "simulacao"
                        ? (lang === "en" ? "Ex: stylish woman in elegant place, modern studio with soft light" : lang === "es" ? "Ej: mujer elegante en lugar sofisticado, estudio moderno con luz suave" : "Ex: mulher estilosa em lugar elegante, estúdio moderno com luz suave")
                        : creationMode === "catalogo"
                        ? (lang === "en" ? "Ex: streets of Paris, upscale café, modern urban setting" : lang === "es" ? "Ej: calle de París, café sofisticado, ambiente urbano moderno" : "Ex: rua de Paris, café sofisticado, ambiente urbano moderno")
                        : (lang === "en" ? "Freely describe what the AI should create" : lang === "es" ? "Describe libremente lo que la IA debe crear" : "Descreva livremente o que a IA deve criar")
                    }
                    value={cenario}
                    onChange={(e) => setCenario(e.target.value)}
                    required
                    style={styles.input}
                  />
                </div>
              )}

              {timeoutError && <div style={{ ...styles.error, borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>{timeoutError}</div>}
              {formError && <div style={styles.error}>{formError}</div>}

              <button
                type="submit"
                disabled={submitting || !cenario.trim()}
                style={{ ...styles.submitBtn, opacity: (submitting || !cenario.trim()) ? 0.5 : 1 }}
              >
                {submitting ? "Enviando..." : "✨ Gerar foto com IA"}
              </button>
              </>
              )}
            </form>
          </div>
        )}

        {/* Gerando — blur animation estilo GPT */}
        {workState === "trabalhando" && !(videoMode && videoJob?.status === "done") && (
          <div style={styles.card} className="generating-wrap">
            {/* Rate limit detectado durante o envio — mostra timer em vez de spinner */}
            {rateLimitedUntil && countdown > 0 ? (
              <DailyLimitScreen countdown={countdown} onAssinar={() => handleAssinarDireto("annual")} />
            ) : (
              <>
                {/* Painel esquerdo: status */}
                <div className="generating-panel">
                  {pendingResult ? (
                    /* Foto pronta — mostra botão "Ver Resultado" no lugar da barra */
                    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                      <div style={{ fontSize: 13, color: "#16c784", fontWeight: 700, marginBottom: 14, letterSpacing: "0.01em" }}>
                        🎉 Sua foto ficou pronta!
                      </div>
                      <button
                        onClick={() => setPendingResult(false)}
                        className="result-btn"
                        style={{
                          width: "100%",
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
                          border: "none",
                          borderRadius: 14,
                          padding: "16px 0",
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: 800,
                          cursor: "pointer",
                          letterSpacing: "-0.01em",
                          boxShadow: "0 4px 24px rgba(139,92,246,0.5)",
                        }}
                      >
                        ✨ Ver Resultado
                      </button>
                    </div>
                  ) : (
                    /* Foto ainda processando */
                    <>
                      <div style={styles.generatingTitle}>
                        <span style={styles.shimmerText}>Transformando sua foto</span>
                        <span style={styles.dots}>
                          <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                          <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                          <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
                        </span>
                      </div>
                      {!submitting && (
                        <div style={styles.progressBarBg}>
                          <div style={{
                            ...styles.progressBarFill,
                            width: `${displayProgress}%`,
                            background: displayProgress > 80
                              ? "linear-gradient(90deg, #6366f1, #22c55e)"
                              : "linear-gradient(90deg, #6366f1, #a855f7)",
                          }} />
                        </div>
                      )}
                      <NotifyButton onRequest={requestAndRegisterPush} />
                      {showCancel && (
                        <button onClick={async () => {
                          setCanceling(true);
                          const token = await getToken();
                          if (job?.id) await fetch(`/api/image-jobs/${job.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                          setCanceling(false);
                          resetJob();
                        }} disabled={canceling} style={styles.cancelBtn}>
                          {canceling ? "Cancelando..." : "Cancelar"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Chat durante geração: modo onboarding mostra benefícios Pro, modo normal mostra BotChat */}
        {workState === "trabalhando" && !(rateLimitedUntil && countdown > 0) && !(videoMode && videoJob?.status === "done") && (
          onboardingMode ? (
            <OnboardingChat />
          ) : (
            <BotChat
              workState={workState}
              resultReady={pendingResult}
              onViewResult={() => setPendingResult(false)}
              botActive={botActive}
              visible={true}
              onActivate24h={activateBot}
            />
          )
        )}

        {/* Resultado */}
        {workState === "terminado" && job && !videoMode && (
          <div style={styles.card} className="result-wrap">
            {/* Imagem — coluna esquerda no desktop */}
            <div className="result-image-col">
              <img
                src={editedImageUrl ?? job.output_image_url}
                alt="Foto gerada"
                style={{ ...styles.resultImg, marginBottom: 0 }}
              />
            </div>

            {/* Ações — coluna direita no desktop / abaixo no mobile */}
            <div className="result-actions-col">
              <h2 style={{ ...styles.centerTitle, textAlign: "left" as const, marginBottom: 4 }}>{t("result_ready")}</h2>
              <p style={{ fontSize: 13, color: "#8394b0", marginBottom: 12 }}>Sua foto foi gerada com sucesso</p>

              {/* Baixar */}
              <button onClick={() => handleDownload(editedImageUrl ?? job.output_image_url!)} style={{ ...styles.downloadBtn, width: "100%", marginBottom: 8 }}>
                {t("result_download")}
              </button>

              {/* Botão único de edição → expande opções */}
              {!editExpanded ? (
                <button onClick={() => setEditExpanded(true)} style={{ ...styles.editActionBtn, marginBottom: 8, width: "100%" }}>
                  ✏️ {lang === "en" ? "Edit photo" : "Editar foto"}
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => {
                    const url = editedImageUrl ?? job.output_image_url;
                    if (url) { sessionStorage.setItem("editor_image", url); setEditExpanded(false); router.push("/editor"); }
                  }} style={styles.editActionBtn}>
                    ✏️ {lang === "en" ? "Customize" : "Personalizar foto"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); setPromoOpen(true); }} style={styles.editActionBtn}>
                    🏷️ {lang === "en" ? "Create promo" : "Criar promoção"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); handleRemoveResultBg(); }} disabled={removingResultBg} style={styles.editActionBtn}>
                    {removingResultBg ? "⏳ " : "✂️ "}{lang === "en" ? "Remove background" : "Remover fundo"}
                  </button>
                  <button onClick={() => setEditExpanded(false)} style={{ ...styles.editActionBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#4e5c72" }}>
                    ✕ {lang === "en" ? "Cancel" : "Cancelar"}
                  </button>
                </div>
              )}

              {/* Gerar novamente + Criar vídeo lado a lado */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {plan === "free" && rateLimitedUntil && countdown > 0 ? (
                  <button disabled style={{ ...styles.newBtn, flex: 1, opacity: 0.4, cursor: "not-allowed", fontSize: 12 }}>
                    🔒 Nova foto em {formatMs(countdown)}
                  </button>
                ) : (
                  <button onClick={resetJob} style={{ ...styles.newBtn, flex: 1 }}>{t("result_new")}</button>
                )}
                {plan === "pro" ? (
                  <button onClick={() => setVideoMode(true)} style={{ ...styles.videoBtn, flex: 1 }}>
                    {t("result_create_video")}
                  </button>
                ) : (
                  <button disabled style={{ ...styles.videoBtnLocked, flex: 1, cursor: "not-allowed" }}>
                    🔒 {t("result_create_video")}
                  </button>
                )}
              </div>

              {/* Upsell PRO — só para free */}
              {plan === "free" && (
                <>
                  {rateLimitedUntil && countdown > 0 && (
                    <p style={{ fontSize: 12, color: "#8394b0", textAlign: "center" as const, margin: "0 0 4px", lineHeight: 1.5 }}>
                      Plano gratuito · 1 criação a cada 24h<br/>
                      <span style={{ color: "#6366f1" }}>Próxima disponível em {formatMs(countdown)}</span>
                    </p>
                  )}
                  <ProUpsell onAssinar={handleAssinarDireto} />
                </>
              )}
            </div>

            {/* Mobile: mesmo layout, só muda padding */}
            <div className="result-mobile-actions" style={{ display: "block", padding: "16px 16px 28px" }}>
              {/* Baixar */}
              <button onClick={() => handleDownload(editedImageUrl ?? job.output_image_url!)} style={{ ...styles.downloadBtn, width: "100%", marginBottom: 8 }}>
                {t("result_download")}
              </button>

              {/* Botão único de edição → expande opções */}
              {!editExpanded ? (
                <button onClick={() => setEditExpanded(true)} style={{ ...styles.editActionBtn, marginBottom: 8, width: "100%" }}>
                  ✏️ {lang === "en" ? "Edit photo" : "Editar foto"}
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => {
                    const url = editedImageUrl ?? job.output_image_url;
                    if (url) { sessionStorage.setItem("editor_image", url); setEditExpanded(false); router.push("/editor"); }
                  }} style={styles.editActionBtn}>
                    ✏️ {lang === "en" ? "Customize" : "Personalizar foto"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); setPromoOpen(true); }} style={styles.editActionBtn}>
                    🏷️ {lang === "en" ? "Create promo" : "Criar promoção"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); handleRemoveResultBg(); }} disabled={removingResultBg} style={styles.editActionBtn}>
                    {removingResultBg ? "⏳ " : "✂️ "}{lang === "en" ? "Remove background" : "Remover fundo"}
                  </button>
                  <button onClick={() => setEditExpanded(false)} style={{ ...styles.editActionBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#4e5c72" }}>
                    ✕ {lang === "en" ? "Cancel" : "Cancelar"}
                  </button>
                </div>
              )}

              {/* Gerar novamente + Criar vídeo */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {plan === "free" && rateLimitedUntil && countdown > 0 ? (
                  <button disabled style={{ ...styles.newBtn, flex: 1, opacity: 0.4, cursor: "not-allowed", fontSize: 12 }}>
                    🔒 Nova foto em {formatMs(countdown)}
                  </button>
                ) : (
                  <button onClick={resetJob} style={{ ...styles.newBtn, flex: 1 }}>{t("result_new")}</button>
                )}
                {plan === "pro" ? (
                  <button onClick={() => setVideoMode(true)} style={{ ...styles.videoBtn, flex: 1 }}>{t("result_create_video")}</button>
                ) : (
                  <button disabled style={{ ...styles.videoBtnLocked, flex: 1, cursor: "not-allowed", fontSize: 12 }}>
                    🔒 {t("result_create_video")}
                  </button>
                )}
              </div>

              {/* Upsell PRO — só para free */}
              {plan === "free" && (
                <>
                  {rateLimitedUntil && countdown > 0 && (
                    <p style={{ fontSize: 12, color: "#8394b0", textAlign: "center" as const, margin: "0 0 4px", lineHeight: 1.5 }}>
                      Plano gratuito · 1 criação a cada 24h<br/>
                      <span style={{ color: "#6366f1" }}>Próxima disponível em {formatMs(countdown)}</span>
                    </p>
                  )}
                  <ProUpsell onAssinar={handleAssinarDireto} />
                </>
              )}
            </div>
          </div>
        )}


        {/* Vídeo — form */}
        {videoMode && !videoJob && job?.status === "done" && job.output_image_url && (
          plan !== "pro" ? (
            /* Free tentou abrir vídeo — redireciona para planos */
            <div style={{ ...styles.card, textAlign: "center" as const, padding: "32px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#eef2f9", marginBottom: 8 }}>
                {lang === "en" ? "Animated video is PRO exclusive" : lang === "es" ? "El video animado es exclusivo PRO" : "Vídeo animado é exclusivo do PRO"}
              </div>
              <div style={{ fontSize: 14, color: "#8394b0", marginBottom: 24, lineHeight: 1.5 }}>
                {lang === "en" ? "Subscribe and generate amazing AI product videos." : lang === "es" ? "Suscríbete y genera videos increíbles de tus productos con IA." : "Assine e gere vídeos incríveis dos seus produtos com IA."}
              </div>
              <button onClick={() => router.push("/planos")} style={{ ...styles.submitBtn, marginBottom: 12 }}>
                {lang === "en" ? "✨ Subscribe PRO" : lang === "es" ? "✨ Suscribirse PRO" : "✨ Assinar PRO"}
              </button>
              <button onClick={() => { setVideoMode(false); }} style={styles.backBtn}>{t("back")}</button>
            </div>
          ) : isGenerating ? (
            /* Tem foto sendo gerada — não pode criar vídeo agora */
            <div style={{ ...styles.card, textAlign: "center" as const, padding: "32px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#eef2f9", marginBottom: 8 }}>
                {lang === "en" ? "Wait for your photo to finish" : lang === "es" ? "Espera que tu foto esté lista" : "Aguarde sua foto ficar pronta"}
              </div>
              <div style={{ fontSize: 14, color: "#8394b0", marginBottom: 24 }}>
                {lang === "en" ? "You can't create a video while a photo is being generated." : lang === "es" ? "No puedes crear un video mientras se genera una foto." : "Não é possível criar um vídeo enquanto uma foto está sendo gerada."}
              </div>
              <button onClick={() => { setVideoMode(false); }} style={styles.backBtn}>{t("back")}</button>
            </div>
          ) : (
            <div style={styles.card}>
              <button onClick={resetVideo} style={styles.backBtn}>{t("back")}</button>
              <h2 style={styles.centerTitle}>{lang === "en" ? "🎬 Create video from photo" : lang === "es" ? "🎬 Crear video de la foto" : "🎬 Criar vídeo da foto"}</h2>
              <p style={{ ...styles.centerDesc, marginBottom: 16 }}>
                {lang === "en" ? "Describe how the camera will move or what will happen in the scene." : lang === "es" ? "Describe cómo se moverá la cámara o qué ocurrirá en la escena." : "Descreva como a câmera vai se mover ou o que vai acontecer na cena."}
              </p>
              <img src={job.output_image_url} alt="base" style={{ ...styles.resultImg, marginBottom: 16 }} />
              <div style={styles.fieldGroup}>
                <label style={styles.label}>{lang === "en" ? "Movement" : lang === "es" ? "Movimiento" : "Movimento"} <span style={{ color: "#4e5c72" }}>{t("field_scene_optional")}</span></label>
                <input
                  type="text"
                  placeholder={lang === "en" ? "Ex: camera slowly rotating to the left" : lang === "es" ? "Ej: cámara girando suavemente hacia la izquierda" : "Ex: câmera girando suavemente para a esquerda"}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  style={styles.input}
                />
              </div>
              {videoError && <div style={{ ...styles.error, marginTop: 12 }}>{videoError}</div>}
              <button
                onClick={() => handleVideoSubmit(job.output_image_url!)}
                disabled={videoSubmitting}
                style={{ ...styles.submitBtn, marginTop: 16, opacity: videoSubmitting ? 0.6 : 1 }}
              >
                {videoSubmitting ? (lang === "en" ? "Sending..." : lang === "es" ? "Enviando..." : "Enviando...") : t("btn_generate_video")}
              </button>
            </div>
          )
        )}

        {/* Vídeo — gerando (card completo — só aparece quando videoMode está ativo) */}
        {videoJob && !["done", "failed"].includes(videoJob.status ?? "") && videoMode && (
          <div style={styles.card}>
            <div style={styles.generatingTitle}>
              <span style={styles.shimmerText}>{lang === "en" ? "Creating your video" : lang === "es" ? "Creando tu video" : "Criando seu vídeo"}</span>
              <span style={styles.dots}>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
              </span>
            </div>
            {/* Barra de progresso do vídeo */}
            <div style={styles.progressBarBg}>
              <div style={{
                ...styles.progressBarFill,
                width: `${videoDisplayProgress}%`,
                background: videoDisplayProgress > 80
                  ? "linear-gradient(90deg, #6366f1, #22c55e)"
                  : "linear-gradient(90deg, #6366f1, #a855f7)",
              }} />
            </div>

            <p style={{ ...styles.centerDesc, marginBottom: 20 }}>
              {lang === "en" ? "Videos take 3–5 minutes. You can close — we'll notify you when it's ready. 🔔" : lang === "es" ? "Los videos tardan 3–5 minutos. Puedes cerrar — te avisamos cuando esté listo. 🔔" : "Vídeos levam 3–5 minutos. Pode fechar — te avisamos quando ficar pronto. 🔔"}
            </p>
            {(job?.output_image_url || videoJob?.input_image_url) && (
              <div style={styles.blurWrapper}>
                <img src={job?.output_image_url || videoJob!.input_image_url!} alt="base" style={{ ...styles.blurImg, filter: "blur(20px) brightness(0.6)" }} />
                <div style={styles.blurOverlay} />
                <div style={styles.blurBadge}><span style={styles.blurDot} />Criando seu vídeo...</div>
              </div>
            )}
          </div>
        )}

        {/* Vídeo — pronto */}
        {videoJob?.status === "done" && videoJob.output_video_url && videoMode && (
          <div style={{ ...styles.card, padding: 0, overflow: "hidden", animation: "fadeIn 0.5s ease" }}>
            <video
              src={videoJob.output_video_url}
              controls
              autoPlay
              loop
              playsInline
              style={{ width: "100%", display: "block", maxHeight: "60vh", background: "#000", objectFit: "contain" }}
            />
            <div style={{ padding: "16px 16px 20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#eef2f9", textAlign: "center" }}>
                🎬 Seu vídeo está pronto!
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(videoJob!.output_video_url!);
                      const blob = await res.blob();
                      await downloadBlob(blob, "video-ia.mp4");
                    } catch { window.open(videoJob!.output_video_url!, "_blank"); }
                  }}
                  style={{
                    flex: 1, background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    border: "none", borderRadius: 14, padding: "14px 0",
                    color: "#fff", fontSize: 15, fontWeight: 700, textAlign: "center",
                    display: "block", cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(139,92,246,0.35)",
                  }}
                >⬇ Baixar</button>
                <button
                  onClick={resetAll}
                  style={{
                    flex: 1, background: "#1a2535", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14, padding: "14px 0",
                    color: "#8394b0", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}
                >📷 Nova foto</button>
              </div>
            </div>
          </div>
        )}

        {/* Vídeo — erro (só dentro do videoMode) */}
        {videoJob?.status === "failed" && videoMode && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>😔</div>
            <h2 style={styles.centerTitle}>Ops, algo deu errado</h2>
            <p style={styles.centerDesc}>Pedimos desculpas pelo transtorno. Houve um problema ao gerar seu vídeo, mas você pode tentar novamente agora — é gratuito.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { resetVideo(); }} style={styles.submitBtn}>Tentar novamente</button>
            </div>
          </div>
        )}

        {/* Erro */}
        {job?.status === "failed" && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>😔</div>
            <h2 style={styles.centerTitle}>Ops, algo deu errado</h2>
            <p style={styles.centerDesc}>Pedimos desculpas pelo transtorno. Houve um problema ao gerar sua foto, mas você pode tentar novamente agora — é gratuito.</p>
            <button onClick={resetJob} style={styles.submitBtn}>Tentar novamente</button>
          </div>
        )}
      </main>
      <BottomNav hasActiveJob={isGenerating} botActive={botActive} onOpenBot={() => setBotNavOpen(true)} />

      {/* Mini editor */}
      {editorOpen && job?.output_image_url && (
        <PhotoEditor
          imageUrl={editedImageUrl ?? job.output_image_url}
          onClose={() => setEditorOpen(false)}
          onSave={(dataUrl) => {
            setEditedImageUrl(dataUrl);
            setEditorOpen(false);
          }}
        />
      )}

      {showUpsell && (
        <UpsellPopup
          onAssinar={(planType) => {
            setShowUpsell(false);
            handleAssinarDireto(planType);
          }}
          onClose={() => {
            setShowUpsell(false);
            // Só mostra onboarding se usuário ainda não tem nenhum job
            if (workState === "sem_trabalho" && !modeSelected) {
              setShowOnboarding(true);
            }
          }}
        />
      )}

      {showOnboarding && (
        <OnboardingScreen
          onSubmit={(file, produtoVal, cenarioVal) => {
            setShowOnboarding(false);
            setOnboardingMode(true);
            setCreationMode("simulacao");
            setModeSelected(true);
            // Chama handleSubmit direto com os valores, sem depender do state
            handleSubmit({ preventDefault: () => {} } as React.FormEvent, {
              file,
              produto: produtoVal,
              cenario: cenarioVal,
              mode: "simulacao",
            });
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {showConversion && job?.output_image_url && (
        <ConversionScreen
          photoUrl={editedImageUrl ?? job.output_image_url}
          onAssinar={() => {
            setShowConversion(false);
            setOnboardingMode(false);
            handleAssinarDireto("annual");
          }}
          onContinuar={() => {
            setShowConversion(false);
            setOnboardingMode(false);
          }}
        />
      )}

      {/* Chat via ícone da nav — posicionado entre header e bottom nav */}
      {botNavOpen && (
        <div style={{
          position: "fixed",
          top: 66, bottom: 70,
          left: 0, right: 0,
          zIndex: 100,
          background: "#07080b",
          display: "flex", flexDirection: "column",
          padding: "10px 16px 12px",
          overflowY: "hidden",
        }}>
          <button
            onClick={() => setBotNavOpen(false)}
            style={{ background: "none", border: "none", color: "#8394b0", fontSize: 14, cursor: "pointer", padding: "0 0 8px", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}
          >
            ← Voltar
          </button>
          <BotChat
            workState={workState}
            resultReady={false}
            botActive={botActive}
            visible={true}
            navMode={true}
            onActivate24h={activateBot}
          />
        </div>
      )}

      {promoOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "#07080b", overflowY: "auto", paddingBottom: 68 }}>
          <PromoCreator
            onBack={() => setPromoOpen(false)}
            initialPhoto={editedImageUrl ?? job?.output_image_url}
          />
        </div>
      )}
    </div>
  );
}

function NotifyButton({ onRequest }: { onRequest: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "granted" | "denied">(() => {
    if (typeof Notification === "undefined") return "granted";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return "idle";
  });

  async function handle() {
    await onRequest();
    if (typeof Notification !== "undefined") {
      setState(Notification.permission === "granted" ? "granted" : "denied");
    }
  }

  if (state === "granted") {
    return (
      <div style={notifyStyles.notice}>
        Converse com seu assistente de IA enquanto sua foto é criada ✨
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div style={notifyStyles.notice}>
        Converse com seu assistente de IA enquanto sua foto é criada ✨
      </div>
    );
  }

  return (
    <button onClick={handle} style={notifyStyles.btn}>
      Ativar aviso quando ficar pronta
    </button>
  );
}

const notifyStyles: Record<string, React.CSSProperties> = {
  notice: {
    fontSize: 13, color: "#8394b0", textAlign: "center",
    padding: "10px 0", lineHeight: 1.5,
  },
  btn: {
    width: "100%", background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 12, padding: "12px 20px", color: "#c4b5fd",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
};

function statusLabel(status: JobStatus, elapsedSec: number, createdAt?: string, lang?: string): string {
  const realElapsed = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
    : elapsedSec;
  if (status === "processing") return lang === "en" ? "Generating your photo..." : lang === "es" ? "Generando tu foto..." : "Gerando sua foto...";
  if (status === "submitted") return realElapsed < 20
    ? (lang === "en" ? "Sending to AI..." : lang === "es" ? "Enviando a la IA..." : "Enviando para a IA...")
    : (lang === "en" ? "Processing..." : lang === "es" ? "Procesando..." : "Processando...");
  if (status === "queued") {
    if (realElapsed < 10) return lang === "en" ? "Preparing..." : lang === "es" ? "Preparando..." : "Preparando...";
    if (realElapsed < 120) return lang === "en" ? "In queue..." : lang === "es" ? "En cola..." : "Na fila...";
    return lang === "en" ? "Waiting in queue..." : lang === "es" ? "Esperando en cola..." : "Aguardando na fila...";
  }
  return lang === "en" ? "Processing..." : lang === "es" ? "Procesando..." : "Processando...";
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 68 },
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
  main: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "12px 16px 20px" },
  menuWrap: { width: "100%", maxWidth: 960 },
  card: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 22, padding: "36px 32px", width: "100%", maxWidth: 520, margin: "0 auto",
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
  resetBtn: {
    background: "transparent", border: "none",
    color: "#4e5c72", fontSize: 13, cursor: "pointer", padding: "4px 8px",
    textDecoration: "underline", textDecorationStyle: "dotted" as const,
  },
  timeEstimate: {
    fontSize: 13, color: "#8394b0", textAlign: "center", marginBottom: 16, minHeight: 20,
  },
  editBtn: {
    background: "#111820", border: "1px solid rgba(168,85,247,0.4)",
    borderRadius: 12, padding: "12px 18px", color: "#a855f7",
    fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0,
  },
  editActionBtn: {
    width: "100%", background: "#111820",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "13px 16px",
    color: "#eef2f9", fontSize: 14, fontWeight: 600,
    cursor: "pointer", textAlign: "left" as const,
    display: "flex", alignItems: "center", gap: 8,
  },
  progressBarBg: {
    width: "100%", height: 5, background: "rgba(255,255,255,0.08)",
    borderRadius: 99, overflow: "hidden", marginBottom: 16,
  },
  progressBarFill: {
    height: "100%", borderRadius: 99, transition: "width 0.4s ease",
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
  videoBtnLocked: {
    flex: 1, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 14, padding: "11px 8px", color: "#8b5cf6", fontSize: 14, fontWeight: 600, cursor: "pointer",
    lineHeight: 1.2,
  },
  unlockBtn: {
    width: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "14px 0", color: "#fff",
    fontSize: 15, fontWeight: 800, cursor: "pointer",
    boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
    letterSpacing: "-0.01em",
  },
  accountBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "6px 10px", color: "#8394b0", cursor: "pointer",
    display: "flex", alignItems: "center",
  },
  backBtn: {
    background: "transparent", border: "none", color: "#8394b0",
    fontSize: 14, cursor: "pointer", padding: "0 0 16px", display: "block",
  },
  backToMenuBtn: {
    background: "transparent", border: "none", color: "#8394b0",
    fontSize: 14, cursor: "pointer", padding: "0 0 16px 0",
    display: "flex", alignItems: "center", gap: 4, fontWeight: 600,
  },
  modeHeader: { marginBottom: 16 },
  modeName: {
    fontSize: 18, fontWeight: 800, color: "#eef2f9",
  },
  uploadLabel: {
    fontSize: 11, fontWeight: 700, color: "#8394b0", textTransform: "uppercase" as const,
    letterSpacing: "0.05em", marginBottom: 6,
  },
  pulsingBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 16, padding: "16px 40px",
    color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
    width: "100%", animation: "pulseBtnAnim 1.6s ease-in-out infinite",
    boxShadow: "0 0 0 0 rgba(168,85,247,0.5)",
  },
};

const SKL_BASE: React.CSSProperties = {
  background: "linear-gradient(90deg, #111820 25%, #1a2235 50%, #111820 75%)",
  backgroundSize: "800px 100%",
  animation: "skeletonShimmer 1.4s ease-in-out infinite",
  borderRadius: 10,
};

const skl: Record<string, React.CSSProperties> = {
  logoBlock: { ...SKL_BASE, width: 110, height: 22, borderRadius: 8 },
  avatarBlock: { ...SKL_BASE, width: 32, height: 32, borderRadius: "50%" },
  labelBlock: { ...SKL_BASE, width: 160, height: 14, borderRadius: 6, marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  card: { background: "#111820", borderRadius: 16, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.07)" },
  cardImg: { ...SKL_BASE, width: "100%", aspectRatio: "3 / 4", borderRadius: 0 },
  cardFooter: { padding: "10px 10px 12px" },
  cardBtn: { ...SKL_BASE, height: 38, borderRadius: 10 },
  bottomNav: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 560,
    background: "#0c1018", borderTop: "1px solid rgba(255,255,255,0.07)",
    display: "flex", zIndex: 50,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  navItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0 14px" },
  navIcon: { ...SKL_BASE, width: 24, height: 24, borderRadius: 6 },
  navLabel: { ...SKL_BASE, width: 36, height: 10, borderRadius: 4 },
  cardOverlay: { position: "absolute" as const, bottom: 12, left: 12, right: 12, display: "flex", flexDirection: "column" as const, gap: 6 },
  cardTextSm: { ...SKL_BASE, height: 10, width: "55%", borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 75%)", backgroundSize: "800px 100%" },
  cardTextLg: { ...SKL_BASE, height: 14, width: "80%", borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 75%)", backgroundSize: "800px 100%" },
};
