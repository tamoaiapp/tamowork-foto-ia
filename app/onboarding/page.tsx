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

async function trackOBEvent(event: string, variant: string) {
  try {
    const tok = await getToken();
    fetch("/api/ab/event", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ event, variant }),
    }).catch(() => {});
  } catch { /* ignora */ }
}

export default function OnboardingPage() {
  return <Suspense><OnboardingPageInner /></Suspense>;
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [ready, setReady]       = useState(false);
  const [userId, setUserId]     = useState("");
  const [variant, setVariant]   = useState<Variant>("A");
  const [step, setStep]         = useState(1);

  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [produto, setProduto]   = useState("");
  const [cenario, setCenario]   = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [objetivo, setObjetivo]     = useState<Objetivo | null>(null);
  const [facilidade, setFacilidade] = useState<Facilidade | null>(null);
  const [ondeUsar, setOndeUsar]     = useState<OndeUsar | null>(null);

  // Auth + init
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }

      const forcedVariant = searchParams.get("v")?.toUpperCase();
      if (!forcedVariant) {
        try {
          if (localStorage.getItem(`onboarding_completed_${user.id}`) === "1") {
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
      } catch { setVariant("A"); }

      setReady(true);
    });
  }, [router]);

  // Tracking de funil — dispara quando o step muda
  useEffect(() => {
    if (!ready || !variant) return;
    if (step === 1) trackOBEvent("ob_welcome_viewed", variant);
    if (step === 2) trackOBEvent("ob_upload_viewed", variant);
  }, [ready, step, variant]);

  function pickFile(f: File) {
    setFile(f);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  // Cria job e redireciona para a experiência central
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

      // Criar job de foto (todas as variantes — narrativa difere, não o job)
      const cenarioFinal = cenario.trim() || "Produto em ambiente profissional, fundo clean";
      const prompt = `${produto.trim()} | cenário: ${cenarioFinal}`;

      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, input_image_url: imageUrl, source: `onboarding_${variant}`, format: "square" }),
      });
      if (!jobRes.ok) throw new Error("Falha ao criar foto");
      const { jobId } = await jobRes.json();

      // Salva estado para a página de experiência + para /tamo (fallback)
      try {
        sessionStorage.setItem("ob_job_id", jobId);
        sessionStorage.setItem("ob_variant", variant);
        sessionStorage.setItem("ob_product_name", produto.trim());
        sessionStorage.setItem("ob_image_url", imageUrl);
        if (preview && preview.length < 400_000) sessionStorage.setItem("ob_image_preview", preview);
        if (objetivo) sessionStorage.setItem("ob_objetivo", objetivo);
        if (facilidade) sessionStorage.setItem("ob_facilidade", facilidade);
        if (ondeUsar) sessionStorage.setItem("ob_onde_usar", ondeUsar);
        // Compat com /tamo
        sessionStorage.setItem("pending_job_id", jobId);
        sessionStorage.setItem("tamo_active_job", JSON.stringify({ id: jobId, input_image_url: imageUrl }));
        sessionStorage.setItem("onboarding_mode", variant);
      } catch { /* ignora */ }

      trackOBEvent("ob_photo_submitted", variant);
      router.push(`/onboarding/experiencia?job=${jobId}&v=${variant}&img=${encodeURIComponent(imageUrl)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar foto");
      setSubmitting(false);
    }
  }

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

  if (!ready) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (submitting) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 340, padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <style>{`
          @keyframes tamoTalk {
            0%, 100% { transform: scaleY(1); }
            25% { transform: scaleY(0.92); }
            50% { transform: scaleY(1.04); }
            75% { transform: scaleY(0.96); }
          }
        `}</style>
        <img
          src="/tamo/processing.png"
          alt="Tamo"
          style={{ width: 80, height: 80, objectFit: "contain", animation: "tamoTalk 0.9s ease-in-out infinite", transformOrigin: "bottom center" }}
        />
        <p style={{ fontSize: 16, fontWeight: 700, color: "#eef2f9", margin: 0, textAlign: "center" as const }}>Enviando sua foto...</p>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}><span style={s.logo}>TamoWork</span></div>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${(step / totalSteps) * 100}%` }} />
        </div>

        {step === 1 && <WelcomeStep variant={variant} onNext={() => setStep(2)} />}

        {step === 2 && (
          <UploadStep
            variant={variant} file={file} preview={preview}
            produto={produto} cenario={cenario} error={error}
            submitting={submitting && variant !== "C"} fileRef={fileRef}
            onPickFile={pickFile} onProduto={setProduto} onCenario={setCenario}
            onNext={nextStep} onBack={() => setStep(1)} isLastStep={variant !== "C"}
          />
        )}

        {step === 2 && variant === "B" && (
          <EngajamentoCards objetivo={objetivo} facilidade={facilidade} onObjetivo={setObjetivo} onFacilidade={setFacilidade} />
        )}

        {step === 3 && variant === "C" && (
          <OndeUsarStep ondeUsar={ondeUsar} onSelect={setOndeUsar} submitting={submitting} onNext={nextStep} onBack={() => setStep(2)} />
        )}
      </div>
    </div>
  );
}

// ── WelcomeStep ───────────────────────────────────────────────────────────────
function WelcomeStep({ variant, onNext }: { variant: Variant; onNext: () => void }) {
  const cfg = {
    A: {
      badge: "⚡ Resultado em ~2 min",
      headline: "1 foto. Resultado profissional em 2 minutos.",
      sub: "Sem fotógrafo, sem editor, sem complicação.",
      benefits: [
        { icon: "📸", label: "Foto profissional do produto" },
        { icon: "🎬", label: "Vídeo narrado pronto para postar" },
        { icon: "📝", label: "Legenda e hashtags incluídas" },
      ],
      cta: "Criar meu primeiro conteúdo grátis →",
    },
    B: {
      badge: "🎁 Grátis para começar",
      headline: "Fotos que vendem mais — sem esforço.",
      sub: "Transformo a foto do seu produto em criativo que prende atenção e converte.",
      benefits: [
        { icon: "📸", label: "Foto profissional do produto" },
        { icon: "🎬", label: "Vídeo para Reels e TikTok" },
        { icon: "⚡", label: "Pronto em menos de 2 minutos" },
      ],
      cta: "Quero vender mais agora →",
    },
    C: {
      badge: "✨ Sem cartão de crédito",
      headline: "Conteúdo de produto em 2 min, não 2 horas.",
      sub: "Foto, vídeo e legenda — tudo em um lugar, sem nenhuma ferramenta extra.",
      benefits: [
        { icon: "📸", label: "Foto profissional automática" },
        { icon: "🎬", label: "Vídeo narrado gerado por IA" },
        { icon: "📋", label: "Legenda pronta para copiar" },
      ],
      cta: "Começar agora →",
    },
  }[variant];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 12 }}>
      {/* Avatar + badge */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <img src="/tamo/idle.png" alt="Tamo" style={{ width: 76, height: 76, objectFit: "contain" }} />
          <div style={{ position: "absolute", bottom: -4, right: -8, background: "rgba(168,85,247,0.9)", borderRadius: 12, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#fff" }}>IA</div>
        </div>
        <span style={s.badge}>{cfg.badge}</span>
      </div>

      {/* Social proof */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ display: "flex" }}>
          {[11, 26, 44, 57].map((n, i) => (
            <img
              key={n}
              src={`https://i.pravatar.cc/40?img=${n}`}
              alt=""
              style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #07080b", marginLeft: i ? -8 : 0, objectFit: "cover" }}
            />
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#8394b0" }}>
          <strong style={{ color: "#c4b5fd" }}>+25.000</strong> empreendedores já usam
        </span>
      </div>

      {/* Headline + sub */}
      <div>
        <h1 style={s.headline}>{cfg.headline}</h1>
        <p style={s.sub}>{cfg.sub}</p>
      </div>

      {/* Benefits */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cfg.benefits.map(({ icon, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0c1018", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px" }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 14, color: "#eef2f9", fontWeight: 600 }}>{label}</span>
            <span style={{ marginLeft: "auto", color: "#16c784", fontSize: 14 }}>✓</span>
          </div>
        ))}
      </div>

      <button onClick={onNext} style={s.primaryBtn}>{cfg.cta}</button>

      <p style={{ textAlign: "center" as const, color: "#4e5c72", fontSize: 12, margin: 0 }}>
        Sem cartão de crédito · Cancele quando quiser
      </p>
    </div>
  );
}

// ── UploadStep ────────────────────────────────────────────────────────────────
interface UploadStepProps {
  variant: Variant; file: File | null; preview: string | null;
  produto: string; cenario: string; error: string; submitting: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: (f: File) => void; onProduto: (v: string) => void;
  onCenario: (v: string) => void; onNext: () => void; onBack: () => void;
  isLastStep: boolean;
}
function UploadStep({ variant, file, preview, produto, cenario, error, submitting, fileRef, onPickFile, onProduto, onCenario, onNext, onBack, isLastStep }: UploadStepProps) {
  void variant; void file;
  const ctaLabel = submitting ? "Criando sua foto..." : isLastStep ? "✨ Gerar foto profissional" : "Próximo →";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
      <div><h2 style={s.stepTitle}>Envie a foto do produto</h2><p style={s.stepSub}>Qualquer foto serve — até tirada com celular</p></div>
      <div style={{ ...s.dropzone, ...(preview ? s.dropzonePreview : {}) }} onClick={() => fileRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) onPickFile(f); }}
        onDragOver={(e) => e.preventDefault()}>
        {preview ? <img src={preview} alt="produto" style={s.previewImg} /> : (
          <><div style={{ fontSize: 36, marginBottom: 8 }}>📷</div><div style={s.uploadText}>Clique para enviar a foto</div><div style={s.uploadSub}>JPG, PNG, HEIC — até 20MB</div></>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }} style={{ display: "none" }} />
      </div>
      <div style={s.fieldGroup}>
        <label style={s.fieldLabel}>Nome do produto</label>
        <input autoFocus style={s.input} placeholder="Ex: Tênis Nike, Bolsa de couro, Caneca..." value={produto} onChange={(e) => onProduto(e.target.value)} maxLength={120} />
      </div>
      <div style={s.fieldGroup}>
        <label style={s.fieldLabel}>Estilo da foto <span style={{ color: "#4e5c72", fontWeight: 400 }}>(opcional)</span></label>
        <input style={s.input} placeholder="Ex: fundo branco, mulher usando, ao ar livre..." value={cenario} onChange={(e) => onCenario(e.target.value)} maxLength={200} />
        <div style={s.chips}>
          {CENARIOS.map((c) => (<button key={c} type="button" onClick={() => onCenario(c)} style={{ ...s.chip, ...(cenario === c ? s.chipActive : {}) }}>{c}</button>))}
        </div>
      </div>
      {error && <div style={s.errorBox}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <button onClick={onNext} disabled={submitting} style={{ ...s.primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}>{ctaLabel}</button>
      </div>
    </div>
  );
}

// ── EngajamentoCards (Variant B) ──────────────────────────────────────────────
function EngajamentoCards({ objetivo, facilidade, onObjetivo, onFacilidade }: { objetivo: Objetivo | null; facilidade: Facilidade | null; onObjetivo: (v: Objetivo) => void; onFacilidade: (v: Facilidade) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
      <div style={s.engCard}>
        <p style={s.engTitle}>Qual seu objetivo principal?</p>
        <div style={s.engOptions}>
          {([ { key: "vender", label: "📦 Vender mais" }, { key: "melhorar", label: "📸 Melhorar fotos" }, { key: "anuncios", label: "📣 Criar anúncios" }, { key: "testando", label: "👀 Só testando" }] as { key: Objetivo; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => onObjetivo(key)} style={{ ...s.engOption, ...(objetivo === key ? s.engOptionActive : {}) }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={s.engCard}>
        <p style={s.engTitle}>O app está fácil de usar até aqui?</p>
        <div style={{ display: "flex", gap: 8 }}>
          {([{ key: "sim", label: "👍 Sim" }, { key: "medio", label: "😐 Mais ou menos" }, { key: "dificil", label: "😕 Difícil" }] as { key: Facilidade; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => onFacilidade(key)} style={{ ...s.engOption, flex: 1, ...(facilidade === key ? s.engOptionActive : {}) }}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── OndeUsarStep (Variant C) ──────────────────────────────────────────────────
function OndeUsarStep({ ondeUsar, onSelect, submitting, onNext, onBack }: { ondeUsar: OndeUsar | null; onSelect: (v: OndeUsar) => void; submitting: boolean; onNext: () => void; onBack: () => void }) {
  const options: { key: OndeUsar; icon: string; label: string; sub: string }[] = [
    { key: "instagram", icon: "📸", label: "Instagram", sub: "Feed, Stories e Reels" },
    { key: "whatsapp", icon: "💬", label: "WhatsApp", sub: "Catálogo e grupos" },
    { key: "loja", icon: "🛍️", label: "Loja online", sub: "Site, Shopee, Mercado" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
      <div><h2 style={s.stepTitle}>Onde vai usar o conteúdo?</h2><p style={s.stepSub}>Vou deixar otimizado para esse canal</p></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map(({ key, icon, label, sub }) => (
          <button key={key} onClick={() => onSelect(key)} style={{ ...s.ondeCard, ...(ondeUsar === key ? s.ondeCardActive : {}) }}>
            <span style={{ fontSize: 28 }}>{icon}</span>
            <div style={{ textAlign: "left" as const }}><div style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9" }}>{label}</div><div style={{ fontSize: 12, color: "#8394b0", marginTop: 2 }}>{sub}</div></div>
            {ondeUsar === key && <span style={{ marginLeft: "auto", color: "#a855f7", fontSize: 18 }}>✓</span>}
          </button>
        ))}
      </div>
      <div style={s.futureCard}>
        <p style={{ margin: 0, fontSize: 13, color: "#8394b0", lineHeight: 1.6 }}>
          🦎 Crio <strong style={{ color: "#c4b5fd" }}>foto profissional</strong>, <strong style={{ color: "#c4b5fd" }}>vídeo narrado</strong> e <strong style={{ color: "#c4b5fd" }}>legenda pronta</strong> para o mesmo produto.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <button onClick={onNext} disabled={submitting} style={{ ...s.primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Criando..." : "✨ Gerar conteúdo"}
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
  dropzone: { background: "#111820", border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 18, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 6, minHeight: 140 },
  dropzonePreview: { padding: 0, overflow: "hidden", minHeight: 200, border: "2px solid rgba(168,85,247,0.4)" },
  previewImg: { width: "100%", maxHeight: 260, objectFit: "contain", display: "block", background: "#111820" },
  uploadText: { color: "#eef2f9", fontSize: 14, fontWeight: 600 },
  uploadSub: { color: "#4e5c72", fontSize: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: "#8394b0" },
  input: { background: "#111820", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", color: "#eef2f9", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "Outfit, sans-serif" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "5px 11px", color: "#8394b0", fontSize: 11, cursor: "pointer", fontFamily: "Outfit, sans-serif" },
  chipActive: { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.5)", color: "#c4b5fd" },
  errorBox: { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13 },
  primaryBtn: { background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 14, padding: "15px", width: "100%", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Outfit, sans-serif", boxShadow: "0 4px 20px rgba(139,92,246,0.35)" },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "15px 18px", color: "#8394b0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Outfit, sans-serif", whiteSpace: "nowrap" },
  engCard: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", gap: 12 },
  engTitle: { fontSize: 13, fontWeight: 700, color: "#eef2f9", margin: 0 },
  engOptions: { display: "flex", flexWrap: "wrap", gap: 8 },
  engOption: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", color: "#8394b0", fontSize: 13, cursor: "pointer", fontFamily: "Outfit, sans-serif" },
  engOptionActive: { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.5)", color: "#c4b5fd" },
  ondeCard: { background: "#111820", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", fontFamily: "Outfit, sans-serif", width: "100%" },
  ondeCardActive: { background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.4)" },
  futureCard: { background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" },
};
