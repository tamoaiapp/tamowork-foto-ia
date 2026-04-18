"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type Variant = "A" | "B" | "C";
type Phase = "processing" | "done";

interface TamoMsg {
  id: string;
  from: "tamo" | "user";
  text: string;
}

const TAMO_SCRIPTS: Record<Variant, Array<{ delay: number; text: string }>> = {
  A: [
    { delay: 0, text: "Já comecei a transformar sua imagem em algo com cara de venda." },
    { delay: 15, text: "Estou ajustando a apresentação do produto para ficar mais profissional." },
    { delay: 35, text: "Falta pouco. Já já vou te mostrar o antes e depois." },
  ],
  B: [
    { delay: 0, text: "Analisei sua foto. Vou deixar com muito mais apelo comercial." },
    { delay: 15, text: "Imagens assim costumam prender mais atenção em anúncios. Estou caprichando." },
    { delay: 35, text: "Quase pronto. Isso vai fazer diferença no seu resultado de venda." },
  ],
  C: [
    { delay: 0, text: "Já comecei a produzir conteúdo a partir da sua foto." },
    { delay: 15, text: "Estou montando o material de apresentação para o seu produto." },
    { delay: 35, text: "Seu conteúdo está quase pronto para publicar." },
  ],
};

const TAMO_RESULT: Record<Variant, string> = {
  A: "Olha a diferença disso. Agora imagina esse padrão em todos os seus produtos.",
  B: "Isso não é só imagem bonita. Isso ajuda a vender.",
  C: "Você acabou de testar uma forma mais rápida de produzir conteúdo.",
};

const QUICK_REPLIES = [
  { label: "Ficou bom pra anúncio?", answer: "Esse estilo tem mais apelo em anúncios pagos. Tende a converter bem." },
  { label: "Depois faz legenda também", answer: "Combinado! Posso criar legenda e hashtags depois que terminar." },
  { label: "Quero vídeo também", answer: "Posso criar vídeo animado do resultado. Primeiro vamos ver a foto pronta." },
];

interface PaywallCopy {
  headline: string;
  subheadline: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

const PAYWALL: Record<Variant, PaywallCopy> = {
  A: {
    headline: "Você viu o que isso fez com sua foto.",
    subheadline: "Agora imagina esse nível em todos os seus produtos.",
    ctaPrimary: "Liberar tudo agora",
    ctaSecondary: "Continuar grátis com limite",
  },
  B: {
    headline: "Enquanto você usa fotos comuns, pode estar perdendo vendas.",
    subheadline: "Seu produto já mostrou que pode ter mais impacto. Agora é sua escolha.",
    ctaPrimary: "Quero vender mais agora",
    ctaSecondary: "Continuar no plano grátis",
  },
  C: {
    headline: "Seu conteúdo já começou a ser criado pra você.",
    subheadline: "Fotos melhores, vídeos quando aplicável, apoio do TAMO e mais velocidade.",
    ctaPrimary: "Ativar criação completa agora",
    ctaSecondary: "Seguir com acesso limitado",
  },
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  const { data: rd } = await supabase.auth.refreshSession();
  return rd.session?.access_token ?? "";
}

export default function ExperienciaPage() {
  return <Suspense><ExperienciaPageInner /></Suspense>;
}

function ExperienciaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [variant, setVariant] = useState<Variant>("A");
  const [jobId, setJobId] = useState("");
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [inputPreview, setInputPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [phase, setPhase] = useState<Phase>("processing");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [messages, setMessages] = useState<TamoMsg[]>([]);
  const [usedReplies, setUsedReplies] = useState<Set<string>>(new Set());
  const [resultMsgShown, setResultMsgShown] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(Date.now());
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth progress bar (0→90% during processing, 100% on done)
  useEffect(() => {
    if (phase !== "processing") return;
    progressRef.current = setInterval(() => {
      setProgress(p => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        // Asymptotic: 90% at ~90s
        const target = Math.min(90, (elapsed / (elapsed + 30)) * 90);
        return p < target ? p + 0.5 : p;
      });
    }, 500);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [phase]);

  // Auth + read URL params (primary) com fallback para sessionStorage
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }

      // Tenta URL params primeiro (mais confiável em PWA/iOS)
      let jid = searchParams.get("job") ?? "";
      const vParam = searchParams.get("v")?.toUpperCase();
      let v: Variant = (vParam && ["A","B","C"].includes(vParam)) ? vParam as Variant : "A";
      let imgUrl = searchParams.get("img") ? decodeURIComponent(searchParams.get("img")!) : "";
      let preview: string | null = null;

      // Fallback sessionStorage se URL params ausentes
      if (!jid) {
        try {
          jid = sessionStorage.getItem("ob_job_id") ?? "";
          const sv = sessionStorage.getItem("ob_variant");
          if (sv && ["A","B","C"].includes(sv)) v = sv as Variant;
          imgUrl = imgUrl || (sessionStorage.getItem("ob_image_url") ?? "");
        } catch { /* ignore */ }
      }
      try {
        preview = sessionStorage.getItem("ob_image_preview");
      } catch { /* ignore */ }

      if (!jid) { router.replace("/onboarding"); return; }

      setUserId(user.id);
      setJobId(jid);
      setVariant(v);
      setInputImageUrl(imgUrl);
      if (preview) setInputPreview(preview);
      setReady(true);
    });
  }, [router, searchParams]);

  const addTamoMsg = useCallback((text: string) => {
    setMessages(prev => [...prev, { id: `t_${Date.now()}_${Math.random()}`, from: "tamo", text }]);
  }, []);

  // Start scripted TAMO messages when ready
  useEffect(() => {
    if (!ready) return;
    const script = TAMO_SCRIPTS[variant];
    script.forEach(({ delay, text }) => {
      const t = setTimeout(() => addTamoMsg(text), delay * 1000);
      scriptTimersRef.current.push(t);
    });
    return () => scriptTimersRef.current.forEach(clearTimeout);
  }, [ready, variant, addTamoMsg]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Job done handling
  const handleDone = useCallback((url: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    scriptTimersRef.current.forEach(clearTimeout);
    setProgress(100);
    setOutputUrl(url);
    setPhase("done");
    setShowPaywall(true);
  }, []);

  // Show TAMO result comment once after done
  useEffect(() => {
    if (phase === "done" && !resultMsgShown) {
      setResultMsgShown(true);
      setTimeout(() => addTamoMsg(TAMO_RESULT[variant]), 800);
    }
  }, [phase, resultMsgShown, variant, addTamoMsg]);

  // Polling
  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/image-jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const job = await res.json();

      if (job.status === "done" && job.output_image_url) {
        handleDone(job.output_image_url);
      } else if (job.status === "failed" || job.status === "canceled") {
        if (pollRef.current) clearInterval(pollRef.current);
        setJobError("Ocorreu um erro ao processar a foto. Tente novamente.");
      }
    } catch { /* ignore network errors */ }
  }, [jobId, handleDone]);

  useEffect(() => {
    if (!ready || !jobId) return;
    poll();
    pollRef.current = setInterval(poll, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [ready, jobId, poll]);

  function handleQuickReply(chip: { label: string; answer: string }) {
    if (usedReplies.has(chip.label)) return;
    setUsedReplies(prev => new Set([...prev, chip.label]));
    setMessages(prev => [
      ...prev,
      { id: `u_${Date.now()}`, from: "user", text: chip.label },
    ]);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: `t_${Date.now()}`, from: "tamo", text: chip.answer },
      ]);
    }, 600);
  }

  function completeOnboarding() {
    try {
      localStorage.setItem("onboarding_completed", "1");
      if (userId) localStorage.setItem(`onboarding_completed_${userId}`, "1");
      sessionStorage.removeItem("ob_job_id");
      sessionStorage.removeItem("ob_variant");
      sessionStorage.removeItem("ob_image_url");
      sessionStorage.removeItem("ob_image_preview");
      sessionStorage.removeItem("ob_product_name");
    } catch { /* ignore */ }
  }

  function goToPro() {
    setNavigating(true);
    completeOnboarding();
    router.push("/planos");
  }

  function goToFree() {
    setNavigating(true);
    completeOnboarding();
    router.push("/tamo");
  }

  const pw = PAYWALL[variant];
  const availableChips = QUICK_REPLIES.filter(c => !usedReplies.has(c.label));

  if (!ready) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 80px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        .msg-bubble { animation: fadeUp 0.35s ease; }
        .tamo-bubble { background: #161e2e; border-radius: 0 14px 14px 14px; }
        .user-bubble { background: linear-gradient(135deg,#6366f1,#a855f7); border-radius: 14px 14px 0 14px; }
        .chip-btn { background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.3); color: #c4b5fd; border-radius: 20px; padding: 8px 16px; font-size: 13px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .chip-btn:hover { background: rgba(168,85,247,0.25); border-color: rgba(168,85,247,0.6); }
        .cta-primary { background: linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7); color: #fff; border: none; border-radius: 14px; padding: 16px 28px; font-size: 16px; font-weight: 700; cursor: pointer; width: 100%; transition: opacity 0.2s; }
        .cta-primary:hover { opacity: 0.9; }
        .cta-secondary { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #8394b0; border-radius: 14px; padding: 14px 28px; font-size: 14px; cursor: pointer; width: 100%; margin-top: 10px; transition: all 0.2s; }
        .cta-secondary:hover { border-color: rgba(255,255,255,0.3); color: #eef2f9; }
      `}</style>

      {/* Header TAMO */}
      <div style={{ width: "100%", maxWidth: 480, padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>T</div>
        <div>
          <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 15 }}>TAMO</div>
          <div style={{ color: "#16c784", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16c784", display: "inline-block" }} />
            processando sua foto
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {phase === "processing" && (
        <div style={{ width: "100%", maxWidth: 480, padding: "16px 20px 0" }}>
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#6366f1,#a855f7)", borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ color: "#4e5c72", fontSize: 11, marginTop: 6, textAlign: "right" }}>{Math.round(progress)}% concluído</div>
        </div>
      )}

      {/* Image preview (blurred during processing, clear when done) */}
      {(inputPreview || inputImageUrl) && (
        <div style={{ width: "100%", maxWidth: 480, padding: "16px 20px 0" }}>
          <div style={{ borderRadius: 18, overflow: "hidden", position: "relative", background: "#111820" }}>
            {phase === "processing" ? (
              <div style={{ position: "relative" }}>
                <img
                  src={inputPreview || inputImageUrl}
                  alt="foto original"
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", filter: "blur(12px) brightness(0.6)", display: "block" }}
                />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                    <div style={{ color: "#c4b5fd", fontSize: 13 }}>Transformando...</div>
                  </div>
                </div>
              </div>
            ) : outputUrl ? (
              /* Before/After when done */
              <div style={{ display: "flex", gap: 2 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <img src={inputPreview || inputImageUrl} alt="antes" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", color: "#8394b0", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>Antes</div>
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  <img src={outputUrl} alt="depois" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(99,102,241,0.9)", color: "#fff", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>Depois</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Error state */}
      {jobError && (
        <div style={{ width: "100%", maxWidth: 480, padding: "16px 20px 0" }}>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 16, color: "#fca5a5", fontSize: 14 }}>
            {jobError}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div style={{ width: "100%", maxWidth: 480, padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map(msg => (
          <div key={msg.id} className="msg-bubble" style={{ display: "flex", justifyContent: msg.from === "user" ? "flex-end" : "flex-start" }}>
            {msg.from === "tamo" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginRight: 8, alignSelf: "flex-end" }}>T</div>
            )}
            <div className={msg.from === "tamo" ? "tamo-bubble" : "user-bubble"} style={{ maxWidth: "80%", padding: "10px 14px", color: "#eef2f9", fontSize: 14, lineHeight: 1.5 }}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Quick reply chips — show only during processing */}
      {phase === "processing" && availableChips.length > 0 && (
        <div style={{ width: "100%", maxWidth: 480, padding: "12px 20px 0" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableChips.map(chip => (
              <button key={chip.label} className="chip-btn" onClick={() => handleQuickReply(chip)}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paywall — shown after result */}
      {showPaywall && (
        <div style={{ width: "100%", maxWidth: 480, padding: "24px 20px 0" }}>
          <div style={{ background: "#111820", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 22, padding: "24px 20px", textAlign: "center" }}>
            {/* Sparkle icon */}
            <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>

            <h2 style={{ color: "#eef2f9", fontSize: 20, fontWeight: 800, lineHeight: 1.3, margin: "0 0 10px" }}>
              {pw.headline}
            </h2>
            <p style={{ color: "#8394b0", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
              {pw.subheadline}
            </p>

            {/* Price highlight */}
            <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ color: "#c4b5fd", fontSize: 13, marginBottom: 4 }}>Plano PRO</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                <span style={{ color: "#eef2f9", fontSize: 32, fontWeight: 800 }}>R$79</span>
                <span style={{ color: "#8394b0", fontSize: 14 }}>/mês</span>
              </div>
              <div style={{ color: "#4e5c72", fontSize: 12, marginTop: 4 }}>
                Fotos ilimitadas · Vídeos narrados · Suporte prioritário
              </div>
            </div>

            <button className="cta-primary" onClick={goToPro} disabled={navigating}>
              {navigating ? "Aguarde..." : pw.ctaPrimary}
            </button>
            <button className="cta-secondary" onClick={goToFree} disabled={navigating}>
              {pw.ctaSecondary}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
