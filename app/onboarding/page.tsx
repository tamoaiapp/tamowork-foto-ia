"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

// ── Cenários sugeridos ──────────────────────────────────────────────────────
const CENARIOS = [
  "Mulher usando o produto, fundo clean",
  "Modelo elegante em estúdio profissional",
  "Fundo branco limpo, iluminação de estúdio",
  "Ao ar livre, luz natural",
  "Mesa de madeira, ambiente aconchegante",
];

type Variant   = "A" | "B" | "C";
type Objetivo  = "vender" | "melhorar" | "anuncios" | "testando";
type OndeUsar  = "instagram" | "whatsapp" | "loja";
type Facilidade = "sim" | "medio" | "dificil";

async function getToken() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  // getSession() pode retornar null em mobile — tenta refresh
  const { data: rd } = await supabase.auth.refreshSession();
  return rd.session?.access_token ?? "";
}

function assignVariant(): Variant {
  const r = Math.random();
  return r < 0.33 ? "A" : r < 0.66 ? "B" : "C";
}

// ── Wrapper com Suspense (obrigatório para useSearchParams no Next.js 14+) ──
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

  const [ready, setReady]         = useState(false);
  const [userId, setUserId]       = useState("");
  const [variant, setVariant]     = useState<Variant>("A");
  const [step, setStep]           = useState(1);

  // Formulário
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [produto, setProduto]     = useState("");
  const [cenario, setCenario]     = useState("");
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Variant B
  const [objetivo, setObjetivo]   = useState<Objetivo | null>(null);
  const [facilidade, setFacilidade] = useState<Facilidade | null>(null);

  // Variant C
  const [ondeUsar, setOndeUsar]   = useState<OndeUsar | null>(null);

  // ── Auth + init ─────────────────────────────────────────────────────────
  useEffect(() => {
    // getUser() faz validação server-side — funciona em mobile, magic link, token refresh
    // getSession() lê apenas localStorage e falha em vários cenários mobile
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }

      // Já completou onboarding → vai para o app (ignora se ?v= presente para permitir teste)
      const forcedVariant = searchParams.get("v")?.toUpperCase();
      if (!forcedVariant) {
        try {
          const flagKey = `onboarding_completed_${user.id}`;
          const flagValue = localStorage.getItem(flagKey);
          console.log("[onboarding] uid:", user.id, "| flag:", flagKey, "=", flagValue);
          if (flagValue === "1") {
            console.log("[onboarding] → já completou, voltando para /");
            router.replace("/");
            return;
          }
        } catch { /* ignora */ }
      }

      setUserId(user.id);

      // Atribui ou restaura variante — ?v=A/B/C força variante para testes
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

  // ── Arquivo ─────────────────────────────────────────────────────────────
  function pickFile(f: File) {
    setFile(f);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  // ── Criação do job ───────────────────────────────────────────────────────
  async function createJob() {
    if (!file) { setError("Envie a foto do produto para continuar"); return; }
    if (!produto.trim()) { setError("Digite o nome do produto"); return; }
    setError("");
    setSubmitting(true);

    try {
      const token = await getToken();

      // Upload da foto
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!upRes.ok) throw new Error("Falha ao enviar foto");
      const { url: imageUrl } = await upRes.json();

      // Prompt com produto + cenário (simulação real)
      const cenarioFinal = cenario.trim() || "Produto em ambiente profissional, fundo clean";
      const prompt = `${produto.trim()} | cenário: ${cenarioFinal}`;

      // Cria job
      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, input_image_url: imageUrl }),
      });
      if (!jobRes.ok) throw new Error("Falha ao criar foto");
      const { jobId } = await jobRes.json();

      // Persiste no sessionStorage para /tamo restaurar
      try {
        sessionStorage.setItem("pending_job_id", jobId);
        sessionStorage.setItem("tamo_active_job", JSON.stringify({ id: jobId, input_image_url: imageUrl }));
        sessionStorage.setItem("onboarding_mode", variant); // /tamo lê para mostrar conteúdo extra
        if (variant === "B" && objetivo)  sessionStorage.setItem("ob_objetivo", objetivo);
        if (variant === "B" && facilidade) sessionStorage.setItem("ob_facilidade", facilidade);
        if (variant === "C" && ondeUsar)  sessionStorage.setItem("ob_onde_usar", ondeUsar);
      } catch { /* ignora */ }

      // Marca onboarding como concluído (chave por usuário para evitar cross-user bug)
      try {
        localStorage.setItem("onboarding_completed", "1"); // legado
        if (userId) localStorage.setItem(`onboarding_completed_${userId}`, "1");
      } catch { /* ignora */ }

      router.push("/tamo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar foto");
      setSubmitting(false);
    }
  }

  // ── Número total de steps por variante ──────────────────────────────────
  const totalSteps = variant === "C" ? 3 : 2;

  // ── Avança step ─────────────────────────────────────────────────────────
  function nextStep() {
    if (step === 2 && variant !== "C") { createJob(); return; }
    if (step === 2 && variant === "C") {
      // Valida antes de avançar para o step 3
      if (!file) { setError("Envie a foto do produto"); return; }
      if (!produto.trim()) { setError("Digite o nome do produto"); return; }
      setError("");
      setStep(3);
      return;
    }
    if (step === 3) { createJob(); return; }
    setStep(s => s + 1);
  }

  if (!ready) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Cabeçalho */}
        <div style={s.header}>
          <span style={s.logo}>TamoWork</span>
        </div>

        {/* Barra de progresso */}
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${(step / totalSteps) * 100}%` }} />
        </div>

        {/* ── STEP 1: Boas-vindas (igual em A, B, C) ── */}
        {step === 1 && <WelcomeStep variant={variant} onNext={() => setStep(2)} />}

        {/* ── STEP 2: Upload + Produto + Cenário ── */}
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

        {/* ── STEP 3: Variant B — Objetivos durante upload ── */}
        {step === 2 && variant === "B" && (
          <EngajamentoCards
            objetivo={objetivo}
            facilidade={facilidade}
            onObjetivo={setObjetivo}
            onFacilidade={setFacilidade}
          />
        )}

        {/* ── STEP 3: Variant C — Onde vai usar? ── */}
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

// ── Welcome Step ─────────────────────────────────────────────────────────────
function WelcomeStep({ variant, onNext }: { variant: Variant; onNext: () => void }) {
  const configs = {
    A: {
      headline: "Sua primeira foto profissional — grátis",
      sub: "Em ~2 minutos a IA transforma qualquer foto de produto em algo digno de vitrine. Sem edição, sem designer.",
      cta: "Criar minha primeira foto →",
      badge: "⚡ Entrega em ~2 min",
    },
    B: {
      headline: "Vamos criar sua primeira foto juntos",
      sub: "Envie a foto do seu produto e eu coloco num cenário profissional. Leva ~2 minutos.",
      cta: "Começar agora →",
      badge: "🎁 Grátis para começar",
    },
    C: {
      headline: "Crie sua foto profissional grátis",
      sub: "A IA transforma a foto do seu produto em conteúdo pronto para vender — em ~2 minutos.",
      cta: "Criar foto grátis →",
      badge: "✨ Sem cartão de crédito",
    },
  }[variant];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 12 }}>
      {/* Mascote + animação */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <img src="/tamo/idle.png" alt="Tamo" style={{ width: 80, height: 80, objectFit: "contain" }} />
          <div style={{
            position: "absolute", bottom: -4, right: -8,
            background: "rgba(168,85,247,0.9)", borderRadius: 12,
            padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#fff",
          }}>
            IA
          </div>
        </div>
        <span style={s.badge}>{configs.badge}</span>
      </div>

      <div>
        <h1 style={s.headline}>{configs.headline}</h1>
        <p style={s.sub}>{configs.sub}</p>
      </div>

      {/* Exemplo visual (antes/depois simulado) */}
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

      <button onClick={onNext} style={s.primaryBtn}>{configs.cta}</button>
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
        <h2 style={s.stepTitle}>
          {variant === "A" ? "Envie a foto do produto" : "Foto do produto"}
        </h2>
        <p style={s.stepSub}>Qualquer foto serve — até tirada com celular</p>
      </div>

      {/* Dropzone */}
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

      {/* Nome do produto */}
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

      {/* Cenário */}
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
            <button
              key={c}
              type="button"
              onClick={() => onCenario(c)}
              style={{ ...s.chip, ...(cenario === c ? s.chipActive : {}) }}
            >
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

// ── Variant B: Cards de engajamento (mostrados no step 2 abaixo do form) ─────
interface EngajamentoCardsProps {
  objetivo: Objetivo | null;
  facilidade: Facilidade | null;
  onObjetivo: (v: Objetivo) => void;
  onFacilidade: (v: Facilidade) => void;
}

function EngajamentoCards({ objetivo, facilidade, onObjetivo, onFacilidade }: EngajamentoCardsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
      {/* Objetivo */}
      <div style={s.engCard}>
        <p style={s.engTitle}>Qual seu objetivo principal?</p>
        <div style={s.engOptions}>
          {([
            { key: "vender",    label: "📦 Vender mais" },
            { key: "melhorar",  label: "📸 Melhorar fotos" },
            { key: "anuncios",  label: "📣 Criar anúncios" },
            { key: "testando",  label: "👀 Só testando" },
          ] as { key: Objetivo; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onObjetivo(key)}
              style={{ ...s.engOption, ...(objetivo === key ? s.engOptionActive : {}) }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Facilidade */}
      <div style={s.engCard}>
        <p style={s.engTitle}>O app está fácil de usar até aqui?</p>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { key: "sim",    label: "👍 Sim" },
            { key: "medio",  label: "😐 Mais ou menos" },
            { key: "dificil",label: "😕 Difícil" },
          ] as { key: Facilidade; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onFacilidade(key)}
              style={{ ...s.engOption, flex: 1, ...(facilidade === key ? s.engOptionActive : {}) }}
            >
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
            style={{
              ...s.ondeCard,
              ...(ondeUsar === key ? s.ondeCardActive : {}),
            }}
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

      {/* Prévia do que vem depois */}
      <div style={s.futureCard}>
        <p style={{ margin: 0, fontSize: 13, color: "#8394b0", lineHeight: 1.6 }}>
          🦎 Depois da foto, posso criar <strong style={{ color: "#c4b5fd" }}>vídeo, legenda pronta</strong> e <strong style={{ color: "#c4b5fd" }}>anúncio</strong> para o mesmo produto.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <button
          onClick={onNext}
          disabled={submitting}
          style={{ ...s.primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Criando sua foto..." : "✨ Gerar foto profissional"}
        </button>
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "#07080b",
    overflowY: "auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: 480,
    padding: "32px 24px 60px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  logo: {
    fontSize: 18,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  skipBtn: {
    background: "transparent",
    border: "none",
    color: "#4e5c72",
    fontSize: 14,
    cursor: "pointer",
    padding: "4px 0",
    fontFamily: "Outfit, sans-serif",
  },
  progressBar: {
    height: 3,
    background: "rgba(255,255,255,0.07)",
    borderRadius: 2,
    marginBottom: 24,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #6366f1, #a855f7)",
    borderRadius: 2,
    transition: "width 0.4s ease",
  },
  badge: {
    background: "rgba(168,85,247,0.15)",
    border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 20,
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 700,
    color: "#c4b5fd",
  },
  headline: {
    fontSize: 22,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1.3,
    margin: "0 0 10px",
  },
  sub: {
    fontSize: 14,
    color: "#8394b0",
    lineHeight: 1.6,
    margin: 0,
  },
  exampleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  exampleCard: {
    flex: 1,
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "20px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  exampleIcon: {
    fontSize: 32,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8394b0",
  },
  arrow: {
    fontSize: 20,
    color: "#4e5c72",
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#eef2f9",
    margin: "0 0 6px",
  },
  stepSub: {
    fontSize: 13,
    color: "#8394b0",
    margin: 0,
  },
  dropzone: {
    background: "#111820",
    border: "2px dashed rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    gap: 6,
    minHeight: 140,
    transition: "border-color .15s",
  },
  dropzonePreview: {
    padding: 0,
    overflow: "hidden",
    minHeight: 200,
    border: "2px solid rgba(168,85,247,0.4)",
  },
  previewImg: {
    width: "100%",
    maxHeight: 260,
    objectFit: "contain",
    display: "block",
    background: "#111820",
  },
  uploadText: {
    color: "#eef2f9",
    fontSize: 14,
    fontWeight: 600,
  },
  uploadSub: {
    color: "#4e5c72",
    fontSize: 12,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#8394b0",
  },
  input: {
    background: "#111820",
    border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#eef2f9",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    fontFamily: "Outfit, sans-serif",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  },
  chip: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "5px 11px",
    color: "#8394b0",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    transition: "all .15s",
  },
  chipActive: {
    background: "rgba(168,85,247,0.15)",
    border: "1px solid rgba(168,85,247,0.5)",
    color: "#c4b5fd",
  },
  errorBox: {
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#f87171",
    fontSize: 13,
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none",
    borderRadius: 14,
    padding: "15px",
    width: "100%",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
  },
  backBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "15px 18px",
    color: "#8394b0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    whiteSpace: "nowrap" as const,
  },
  engCard: {
    background: "#0c1018",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  engTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#eef2f9",
    margin: 0,
  },
  engOptions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  engOption: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "8px 14px",
    color: "#8394b0",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    transition: "all .15s",
  },
  engOptionActive: {
    background: "rgba(168,85,247,0.15)",
    border: "1px solid rgba(168,85,247,0.5)",
    color: "#c4b5fd",
  },
  ondeCard: {
    background: "#111820",
    border: "1.5px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    transition: "all .15s",
    textAlign: "left" as const,
  },
  ondeCardActive: {
    background: "rgba(168,85,247,0.1)",
    border: "1.5px solid rgba(168,85,247,0.5)",
  },
  futureCard: {
    background: "rgba(168,85,247,0.07)",
    border: "1px solid rgba(168,85,247,0.2)",
    borderRadius: 14,
    padding: "14px 16px",
  },
};
