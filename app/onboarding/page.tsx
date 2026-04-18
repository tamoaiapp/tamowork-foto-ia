"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

const CENARIOS = [
  "Mulher usando o produto, fundo clean",
  "Modelo elegante em estúdio profissional",
  "Fundo branco limpo, iluminação de estúdio",
  "Ao ar livre, luz natural",
  "Mesa de madeira, ambiente aconchegante",
];

type Variant    = "A" | "B" | "C";
type Objetivo   = "vender" | "melhorar" | "anuncios" | "testando";
type OndeUsar   = "instagram" | "whatsapp" | "loja";
type Facilidade = "sim" | "medio" | "dificil";
type JobStatus  = "queued" | "submitted" | "processing" | "done" | "failed" | "canceled" | null;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  const { data: rd } = await supabase.auth.refreshSession();
  return rd.session?.access_token ?? "";
}

function assignVariant(): Variant {
  const r = Math.random();
  return r < 0.33 ? "A" : r < 0.66 ? "B" : "C";
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady]       = useState(false);
  const [userId, setUserId]     = useState("");
  const [variant, setVariant]   = useState<Variant>("A");
  const [step, setStep]         = useState(1);

  // Form
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [produto, setProduto]   = useState("");
  const [cenario, setCenario]   = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Variant B
  const [objetivo, setObjetivo]     = useState<Objetivo | null>(null);
  const [facilidade, setFacilidade] = useState<Facilidade | null>(null);

  // Variant C
  const [ondeUsar, setOndeUsar] = useState<OndeUsar | null>(null);

  // Job state
  const [jobId, setJobId]           = useState<string | null>(null);
  const [jobStatus, setJobStatus]   = useState<JobStatus>(null);
  const [jobOutputUrl, setJobOutputUrl] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Auth + init
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }

      const forcedVariant = searchParams.get("v")?.toUpperCase();
      if (!forcedVariant) {
        try {
          const flagKey = `onboarding_completed_${user.id}`;
          if (localStorage.getItem(flagKey) === "1") {
            router.replace("/");
            return;
          }
        } catch { /* ignora */ }
      }

      setUserId(user.id);

      try {
        const forced = searchParams.get("v")?.toUpperCase() as Variant | null;
        if (forced && ["A", "B", "C"].includes(forced)) {
          localStorage.setItem("onboarding_variant", forced);
          setVariant(forced);
        } else {
          const saved = localStorage.getItem("onboarding_variant") as Variant | null;
          if (saved && ["A", "B", "C"].includes(saved)) {
            setVariant(saved);
          } else {
            const v = assignVariant();
            localStorage.setItem("onboarding_variant", v);
            setVariant(v);
          }
        }
      } catch {
        setVariant("A");
      }

      setReady(true);
    });
  }, [router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  function pickFile(f: File) {
    setFile(f);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  function startPolling(id: string) {
    setElapsedSec(0);
    elapsedRef.current = setInterval(() => {
      setElapsedSec(s => s + 1);
    }, 1000);

    async function poll() {
      try {
        const token = await getToken();
        const res = await fetch(`/api/image-jobs/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setJobStatus(data.status);

        if (["done", "failed", "canceled"].includes(data.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          if (data.status === "done") setJobOutputUrl(data.output_image_url);
        }
      } catch { /* ignora */ }
    }

    poll();
    pollRef.current = setInterval(poll, 8000);
  }

  async function createJob() {
    if (!file) { setError("Envie a foto do produto para continuar"); return; }
    if (!produto.trim()) { setError("Digite o nome do produto"); return; }
    setError("");
    setSubmitting(true);

    try {
      const token = await getToken();

      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!upRes.ok) throw new Error("Falha ao enviar foto");
      const { url: imageUrl } = await upRes.json();

      const cenarioFinal = cenario.trim() || "Produto em ambiente profissional, fundo clean";
      const prompt = `${produto.trim()} | cenário: ${cenarioFinal}`;

      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, input_image_url: imageUrl }),
      });
      if (!jobRes.ok) throw new Error("Falha ao criar foto");
      const { jobId: newJobId } = await jobRes.json();

      try {
        sessionStorage.setItem("pending_job_id", newJobId);
        sessionStorage.setItem("tamo_active_job", JSON.stringify({ id: newJobId, input_image_url: imageUrl }));
        sessionStorage.setItem("onboarding_mode", variant);
        if (variant === "B" && objetivo) sessionStorage.setItem("ob_objetivo", objetivo);
        if (variant === "B" && facilidade) sessionStorage.setItem("ob_facilidade", facilidade);
        if (variant === "C" && ondeUsar) sessionStorage.setItem("ob_onde_usar", ondeUsar);
      } catch { /* ignora */ }

      setJobId(newJobId);
      setJobStatus("queued");
      setSubmitting(false);
      startPolling(newJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar foto");
      setSubmitting(false);
    }
  }

  function completeOnboarding() {
    try {
      localStorage.setItem("onboarding_completed", "1");
      if (userId) localStorage.setItem(`onboarding_completed_${userId}`, "1");
    } catch { /* ignora */ }
  }

  function handleContinueFree() {
    completeOnboarding();
    router.push("/tamo");
  }

  function handleAssinarPro() {
    completeOnboarding();
    router.push("/planos");
  }

  // Steps
  const totalSteps = variant === "C" ? 3 : 2;

  function nextStep() {
    if (step === 2 && variant !== "C") { createJob(); return; }
    if (step === 2 && variant === "C") {
      if (!file) { setError("Envie a foto do produto"); return; }
      if (!produto.trim()) { setError("Digite o nome do produto"); return; }
      setError("");
      setStep(3);
      return;
    }
    if (step === 3) { createJob(); return; }
    setStep(s => s + 1);
  }

  // ── Loading inicial ──────────────────────────────────────────────────────────
  if (!ready) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Uploading/submitting ─────────────────────────────────────────────────────
  if (submitting) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 360, padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ position: "relative", width: 80, height: 80 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "4px solid rgba(168,85,247,0.15)", borderTopColor: "#a855f7", animation: "spin 0.9s linear infinite" }} />
          <img src="/tamo/idle.png" alt="Tamo" style={{ position: "absolute", inset: 8, objectFit: "contain" }} />
        </div>
        <div style={{ textAlign: "center" as const }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#eef2f9", margin: "0 0 8px" }}>Enviando sua foto...</p>
          <p style={{ fontSize: 13, color: "#8394b0", margin: 0 }}>Só um segundo!</p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Processando (job criado, aguardando IA) ──────────────────────────────────
  if (jobId && !["done", "failed", "canceled"].includes(jobStatus ?? "")) {
    return <ProcessingScreen elapsedSec={elapsedSec} inputPreview={preview} />;
  }

  // ── Falha ────────────────────────────────────────────────────────────────────
  if (jobId && (jobStatus === "failed" || jobStatus === "canceled")) {
    return (
      <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <div style={{ maxWidth: 360, width: "100%", textAlign: "center" as const, display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#f87171", margin: 0 }}>Ops! Algo deu errado.</p>
          <p style={{ fontSize: 14, color: "#8394b0", margin: 0 }}>Não conseguimos criar sua foto. Tente novamente.</p>
          <button
            onClick={() => { setJobId(null); setJobStatus(null); }}
            style={s.primaryBtn}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ── Resultado + conversão ────────────────────────────────────────────────────
  if (jobId && jobStatus === "done" && jobOutputUrl) {
    return (
      <ResultScreen
        outputUrl={jobOutputUrl}
        inputPreview={preview}
        variant={variant}
        onContinueFree={handleContinueFree}
        onAssinar={handleAssinarPro}
      />
    );
  }

  // ── Formulário (steps 1, 2, 3) ───────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <span style={s.logo}>TamoWork</span>
        </div>

        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${(step / totalSteps) * 100}%` }} />
        </div>

        {step === 1 && <WelcomeStep variant={variant} onNext={() => setStep(2)} />}

        {step === 2 && (
          <UploadStep
            variant={variant}
            file={file}
            preview={preview}
            produto={produto}
            cenario={cenario}
            error={error}
            submitting={submitting && variant !== "C"}
            fileRef={fileRef}
            onPickFile={pickFile}
            onProduto={setProduto}
            onCenario={setCenario}
            onNext={nextStep}
            onBack={() => setStep(1)}
            isLastStep={variant !== "C"}
          />
        )}

        {step === 2 && variant === "B" && (
          <EngajamentoCards
            objetivo={objetivo}
            facilidade={facilidade}
            onObjetivo={setObjetivo}
            onFacilidade={setFacilidade}
          />
        )}

        {step === 3 && variant === "C" && (
          <OndeUsarStep
            ondeUsar={ondeUsar}
            onSelect={setOndeUsar}
            submitting={submitting}
            onNext={nextStep}
            onBack={() => setStep(2)}
          />
        )}

      </div>
    </div>
  );
}

// ── Processing Screen ─────────────────────────────────────────────────────────
function ProcessingScreen({ elapsedSec, inputPreview }: { elapsedSec: number; inputPreview: string | null }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ marginBottom: 32, fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg, #6366f1, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        TamoWork
      </div>

      {inputPreview ? (
        <div style={{ position: "relative", width: 180, height: 180, borderRadius: 18, overflow: "hidden", marginBottom: 28 }}>
          <img src={inputPreview} alt="produto" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(6px) brightness(0.6)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Transformando...</span>
          </div>
        </div>
      ) : (
        <div style={{ width: 60, height: 60, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite", marginBottom: 28 }} />
      )}

      <p style={{ fontSize: 18, fontWeight: 800, color: "#eef2f9", margin: "0 0 8px", textAlign: "center" as const }}>
        Criando sua foto profissional...
      </p>
      <p style={{ fontSize: 14, color: "#8394b0", margin: "0 0 28px", textAlign: "center" as const }}>
        A IA está trabalhando. Leva cerca de 2 minutos.
      </p>

      <div style={{ width: "100%", maxWidth: 300, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #a855f7)", borderRadius: 2, animation: "loading-bar 2.5s ease-in-out infinite" }} />
      </div>
      <span style={{ fontSize: 12, color: "#4e5c72" }}>{elapsedSec}s · aguardando resultado</span>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes loading-bar {
          0%   { width: 0%;   margin-left: 0; }
          50%  { width: 70%;  margin-left: 15%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

// ── Result Screen (resultado + conversão) ────────────────────────────────────
interface ResultScreenProps {
  outputUrl: string;
  inputPreview: string | null;
  variant: Variant;
  onContinueFree: () => void;
  onAssinar: () => void;
}

function ResultScreen({ outputUrl, inputPreview, variant, onContinueFree, onAssinar }: ResultScreenProps) {
  const headlines: Record<Variant, string> = {
    A: "Sua foto profissional ficou pronta! 🎉",
    B: "Perfeito para vender mais! 🚀",
    C: "Resultado incrível para seus Reels! ✨",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#07080b", overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "32px 24px 60px", display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg, #6366f1, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          TamoWork
        </div>

        <div style={{ textAlign: "center" as const }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#eef2f9", margin: "0 0 6px" }}>{headlines[variant]}</h2>
          <p style={{ fontSize: 13, color: "#8394b0", margin: 0 }}>Veja o antes e depois do seu produto</p>
        </div>

        {/* Antes / Depois */}
        <div style={{ display: "flex", gap: 8 }}>
          {inputPreview && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4e5c72", textAlign: "center" as const, textTransform: "uppercase" as const, letterSpacing: 1 }}>Antes</span>
              <img src={inputPreview} alt="antes" style={{ width: "100%", borderRadius: 14, objectFit: "cover", aspectRatio: "1/1" }} />
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#a855f7", textAlign: "center" as const, textTransform: "uppercase" as const, letterSpacing: 1 }}>Depois ✨</span>
            <img src={outputUrl} alt="depois" style={{ width: "100%", borderRadius: 14, objectFit: "cover", aspectRatio: "1/1", border: "1.5px solid rgba(168,85,247,0.4)" }} />
          </div>
        </div>

        {/* PRO upsell */}
        <div style={{ background: "rgba(168,85,247,0.08)", border: "1.5px solid rgba(168,85,247,0.35)", borderRadius: 18, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#c4b5fd" }}>⚡ Plano Pro</span>
            <div>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#eef2f9" }}>R$79</span>
              <span style={{ fontSize: 12, color: "#8394b0" }}>/mês</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              "✦ Fotos profissionais ilimitadas",
              "🎬 Vídeos animados e narrados ilimitados",
              "⚡ Sem fila de espera",
              "📣 Legenda e hashtags prontas",
            ].map(f => (
              <span key={f} style={{ fontSize: 13, color: "#8394b0" }}>{f}</span>
            ))}
          </div>
          <button
            onClick={onAssinar}
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 14, padding: "15px", width: "100%", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Outfit, sans-serif", boxShadow: "0 4px 20px rgba(139,92,246,0.4)" }}
          >
            ⚡ Assinar Pro — R$79/mês
          </button>
        </div>

        {/* Continuar grátis */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <button
            onClick={onContinueFree}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 24px", color: "#8394b0", fontSize: 14, cursor: "pointer", fontFamily: "Outfit, sans-serif", width: "100%" }}
          >
            Continuar grátis (3 fotos · 2 vídeos)
          </button>
          <p style={{ fontSize: 11, color: "#4e5c72", margin: 0 }}>Grátis para sempre · Sem cartão de crédito</p>
        </div>

      </div>
    </div>
  );
}

// ── Welcome Step ──────────────────────────────────────────────────────────────
function WelcomeStep({ variant, onNext }: { variant: Variant; onNext: () => void }) {
  const configs: Record<Variant, { headline: string; sub: string; cta: string; badge: string }> = {
    A: {
      headline: "Seu primeiro conteúdo em vídeo começa com 1 foto",
      sub: "Em ~2 minutos eu transformo a foto do seu produto em criativo pronto. Depois você pode gerar vídeo animado e narrado.",
      cta: "Começar agora →",
      badge: "⚡ Entrega em ~2 min",
    },
    B: {
      headline: "Vamos criar seu criativo para vender mais",
      sub: "Manda a foto do produto e eu monto cena profissional. Em seguida você já pode subir para vídeo com narração.",
      cta: "Criar meu primeiro criativo →",
      badge: "🎁 Grátis para começar",
    },
    C: {
      headline: "Vídeo vende mais — vamos preparar o seu",
      sub: "Começa com uma foto, eu cuido da parte pesada e te entrego conteúdo pronto para Reels e anúncios.",
      cta: "Preparar meu vídeo →",
      badge: "✨ Sem cartão de crédito",
    },
  };

  const cfg = configs[variant];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <img src="/tamo/idle.png" alt="Tamo" style={{ width: 80, height: 80, objectFit: "contain" }} />
          <div style={{ position: "absolute", bottom: -4, right: -8, background: "rgba(168,85,247,0.9)", borderRadius: 12, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#fff" }}>IA</div>
        </div>
        <span style={s.badge}>{cfg.badge}</span>
      </div>

      <div>
        <h1 style={s.headline}>{cfg.headline}</h1>
        <p style={s.sub}>{cfg.sub}</p>
      </div>

      <div style={s.exampleRow}>
        <div style={s.exampleCard}>
          <div style={s.exampleIcon}>📷</div>
          <span style={s.exampleLabel}>Sua foto</span>
        </div>
        <div style={s.arrow}>→</div>
        <div style={{ ...s.exampleCard, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}>
          <div style={s.exampleIcon}>✨</div>
          <span style={{ ...s.exampleLabel, color: "#c4b5fd" }}>Foto profissional</span>
        </div>
      </div>

      <button onClick={onNext} style={s.primaryBtn}>{cfg.cta}</button>
    </div>
  );
}

// ── Upload Step ───────────────────────────────────────────────────────────────
interface UploadStepProps {
  variant: Variant;
  file: File | null;
  preview: string | null;
  produto: string;
  cenario: string;
  error: string;
  submitting: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: (f: File) => void;
  onProduto: (v: string) => void;
  onCenario: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLastStep: boolean;
}

function UploadStep({ variant, file, preview, produto, cenario, error, submitting, fileRef, onPickFile, onProduto, onCenario, onNext, onBack, isLastStep }: UploadStepProps) {
  const ctaLabel = submitting
    ? "Criando sua foto..."
    : isLastStep
    ? "✨ Gerar foto profissional"
    : "Próximo →";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
      <div>
        <h2 style={s.stepTitle}>{variant === "A" ? "Envie a foto do produto" : "Foto do produto"}</h2>
        <p style={s.stepSub}>Qualquer foto serve — até tirada com celular</p>
      </div>

      <div
        style={{ ...s.dropzone, ...(preview ? s.dropzonePreview : {}) }}
        onClick={() => fileRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) onPickFile(f); }}
        onDragOver={(e) => e.preventDefault()}
      >
        {preview ? (
          <img src={preview} alt="produto" style={s.previewImg} />
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
            <div style={s.uploadText}>Clique para enviar a foto</div>
            <div style={s.uploadSub}>JPG, PNG, HEIC — até 20MB</div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }}
          style={{ display: "none" }}
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.fieldLabel}>Nome do produto</label>
        <input
          autoFocus
          style={s.input}
          placeholder="Ex: Tênis Nike, Bolsa de couro, Caneca..."
          value={produto}
          onChange={(e) => onProduto(e.target.value)}
          maxLength={120}
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.fieldLabel}>Estilo da foto <span style={{ color: "#4e5c72", fontWeight: 400 }}>(opcional)</span></label>
        <input
          style={s.input}
          placeholder="Ex: mulher usando o produto, fundo branco, ao ar livre..."
          value={cenario}
          onChange={(e) => onCenario(e.target.value)}
          maxLength={200}
        />
        <div style={s.chips}>
          {CENARIOS.map((c) => (
            <button key={c} type="button" onClick={() => onCenario(c)} style={{ ...s.chip, ...(cenario === c ? s.chipActive : {}) }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <button onClick={onNext} disabled={submitting} style={{ ...s.primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

// ── Variant B: Cards de engajamento ──────────────────────────────────────────
interface EngajamentoCardsProps {
  objetivo: Objetivo | null;
  facilidade: Facilidade | null;
  onObjetivo: (v: Objetivo) => void;
  onFacilidade: (v: Facilidade) => void;
}

function EngajamentoCards({ objetivo, facilidade, onObjetivo, onFacilidade }: EngajamentoCardsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
      <div style={s.engCard}>
        <p style={s.engTitle}>Qual seu objetivo principal?</p>
        <div style={s.engOptions}>
          {([
            { key: "vender",   label: "📦 Vender mais" },
            { key: "melhorar", label: "📸 Melhorar fotos" },
            { key: "anuncios", label: "📣 Criar anúncios" },
            { key: "testando", label: "👀 Só testando" },
          ] as { key: Objetivo; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => onObjetivo(key)} style={{ ...s.engOption, ...(objetivo === key ? s.engOptionActive : {}) }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.engCard}>
        <p style={s.engTitle}>O app está fácil de usar até aqui?</p>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { key: "sim",     label: "👍 Sim" },
            { key: "medio",   label: "😐 Mais ou menos" },
            { key: "dificil", label: "😕 Difícil" },
          ] as { key: Facilidade; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => onFacilidade(key)} style={{ ...s.engOption, flex: 1, ...(facilidade === key ? s.engOptionActive : {}) }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Variant C: Onde vai usar? ─────────────────────────────────────────────────
interface OndeUsarStepProps {
  ondeUsar: OndeUsar | null;
  onSelect: (v: OndeUsar) => void;
  submitting: boolean;
  onNext: () => void;
  onBack: () => void;
}

function OndeUsarStep({ ondeUsar, onSelect, submitting, onNext, onBack }: OndeUsarStepProps) {
  const options: { key: OndeUsar; icon: string; label: string; sub: string }[] = [
    { key: "instagram", icon: "📸", label: "Instagram", sub: "Feed, Stories e Reels" },
    { key: "whatsapp",  icon: "💬", label: "WhatsApp",  sub: "Catálogo e grupos" },
    { key: "loja",      icon: "🛍️", label: "Loja online", sub: "Site, Shopee, Mercado" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
      <div>
        <h2 style={s.stepTitle}>Onde vai usar a foto?</h2>
        <p style={s.stepSub}>Vou deixar otimizada para esse canal</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map(({ key, icon, label, sub }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{ ...s.ondeCard, ...(ondeUsar === key ? s.ondeCardActive : {}) }}
          >
            <span style={{ fontSize: 28 }}>{icon}</span>
            <div style={{ textAlign: "left" as const }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9" }}>{label}</div>
              <div style={{ fontSize: 12, color: "#8394b0", marginTop: 2 }}>{sub}</div>
            </div>
            {ondeUsar === key && <span style={{ marginLeft: "auto", color: "#a855f7", fontSize: 18 }}>✓</span>}
          </button>
        ))}
      </div>

      <div style={s.futureCard}>
        <p style={{ margin: 0, fontSize: 13, color: "#8394b0", lineHeight: 1.6 }}>
          🦎 Depois da foto, posso criar <strong style={{ color: "#c4b5fd" }}>vídeo, legenda pronta</strong> e <strong style={{ color: "#c4b5fd" }}>anúncio</strong> para o mesmo produto.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <button onClick={onNext} disabled={submitting} style={{ ...s.primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Criando sua foto..." : "✨ Gerar foto profissional"}
        </button>
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#07080b", overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center" },
  container: { width: "100%", maxWidth: 480, padding: "32px 24px 60px", display: "flex", flexDirection: "column", gap: 0 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  logo: { fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg, #6366f1, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  progressBar: { height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginBottom: 24, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #6366f1, #a855f7)", borderRadius: 2, transition: "width 0.4s ease" },
  badge: { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: "#c4b5fd" },
  headline: { fontSize: 22, fontWeight: 800, color: "#eef2f9", lineHeight: 1.3, margin: "0 0 10px" },
  sub: { fontSize: 14, color: "#8394b0", lineHeight: 1.6, margin: 0 },
  exampleRow: { display: "flex", alignItems: "center", gap: 12 },
  exampleCard: { flex: 1, background: "#111820", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  exampleIcon: { fontSize: 32 },
  exampleLabel: { fontSize: 12, fontWeight: 600, color: "#8394b0" },
  arrow: { fontSize: 20, color: "#4e5c72" },
  stepTitle: { fontSize: 20, fontWeight: 800, color: "#eef2f9", margin: "0 0 6px" },
  stepSub: { fontSize: 13, color: "#8394b0", margin: 0 },
  dropzone: { background: "#111820", border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 18, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 6, minHeight: 140, transition: "border-color .15s" },
  dropzonePreview: { padding: 0, overflow: "hidden", minHeight: 200, border: "2px solid rgba(168,85,247,0.4)" },
  previewImg: { width: "100%", maxHeight: 260, objectFit: "contain", display: "block", background: "#111820" },
  uploadText: { color: "#eef2f9", fontSize: 14, fontWeight: 600 },
  uploadSub: { color: "#4e5c72", fontSize: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: "#8394b0" },
  input: { background: "#111820", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", color: "#eef2f9", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "Outfit, sans-serif" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "5px 11px", color: "#8394b0", fontSize: 11, cursor: "pointer", fontFamily: "Outfit, sans-serif", transition: "all .15s" },
  chipActive: { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.5)", color: "#c4b5fd" },
  errorBox: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13 },
  primaryBtn: { background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 14, padding: "15px", width: "100%", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Outfit, sans-serif", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "15px 18px", color: "#8394b0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Outfit, sans-serif", whiteSpace: "nowrap" },
  engCard: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", gap: 12 },
  engTitle: { fontSize: 13, fontWeight: 700, color: "#eef2f9", margin: 0 },
  engOptions: { display: "flex", flexWrap: "wrap", gap: 8 },
  engOption: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", color: "#8394b0", fontSize: 13, cursor: "pointer", fontFamily: "Outfit, sans-serif", transition: "all .15s" },
  engOptionActive: { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.5)", color: "#c4b5fd" },
  ondeCard: { background: "#111820", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", fontFamily: "Outfit, sans-serif", width: "100%", transition: "all .15s" },
  ondeCardActive: { background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.4)" },
  futureCard: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" },
};
