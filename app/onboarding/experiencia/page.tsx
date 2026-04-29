"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PRO_BR_MONTHLY_PRICE_LABEL,
  PRO_BR_MONTHLY_PRICE_PER_DAY_LABEL,
} from "@/lib/pricing";

type Variant = "A" | "B" | "C";
type Phase = "processing" | "done";

const HEADLINE: Record<Variant, string> = {
  A: "Sua foto virou uma peça de loja profissional. Sem fotógrafo, sem estúdio.",
  B: "Essa foto agora compete com marcas grandes. Sem investir em produção.",
  C: "Conteúdo criado automaticamente a partir do seu produto.",
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  const { data: rd } = await supabase.auth.refreshSession();
  return rd.session?.access_token ?? "";
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

  const [showPaywall, setShowPaywall] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth progress bar (0→90% during processing, 100% on done)
  useEffect(() => {
    if (phase !== "processing") return;
    progressRef.current = setInterval(() => {
      setProgress(p => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const target = Math.min(90, (elapsed / (elapsed + 30)) * 90);
        return p < target ? p + 0.5 : p;
      });
    }, 500);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [phase]);

  // Auth + read URL params com fallback para sessionStorage
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }

      let jid = searchParams.get("job") ?? "";
      const vParam = searchParams.get("v")?.toUpperCase();
      let v: Variant = (vParam && ["A","B","C"].includes(vParam)) ? vParam as Variant : "A";
      let imgUrl = searchParams.get("img") ? decodeURIComponent(searchParams.get("img")!) : "";
      let preview: string | null = null;

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

  const handleDone = useCallback((url: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setProgress(100);
    setOutputUrl(url);
    setPhase("done");
    setShowPaywall(true);
    trackOBEvent("ob_result_viewed", variant);
  }, [variant]);

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

  async function goToPro() {
    setNavigating(true);
    trackOBEvent("ob_paywall_pro", variant);
    try {
      const token = await getToken();
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: "monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        completeOnboarding();
        window.location.href = data.url;
      } else {
        completeOnboarding();
        router.push("/planos");
      }
    } catch {
      completeOnboarding();
      router.push("/planos");
    }
  }

  function goToFree() {
    setNavigating(true);
    trackOBEvent("ob_paywall_free", variant);
    completeOnboarding();
    router.push("/tamo");
  }

  if (!ready) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Tela de paywall (fase done) ───────────────────────────────────────────────
  if (showPaywall && outputUrl) {
    return (
      <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", paddingBottom: 40 }}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg) } }
            .cta-pro { background: linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7); color: #fff; border: none; border-radius: 14px; padding: 18px 28px; font-size: 17px; font-weight: 800; cursor: pointer; width: 100%; transition: opacity 0.2s; letter-spacing: -0.3px; }
            .cta-pro:hover { opacity: 0.9; }
            .cta-free { background: transparent; border: none; color: #4e5c72; font-size: 13px; cursor: pointer; width: 100%; padding: 14px; text-decoration: underline; transition: color 0.2s; }
            .cta-free:hover { color: #8394b0; }
            .feat-item { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; }
          `}</style>

          {/* Before/After — full width, sem padding lateral */}
          <div style={{ display: "flex", gap: 2, background: "#07080b" }}>
            <div style={{ flex: 1, position: "relative", aspectRatio: "1", background: "#0c1018", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src={inputPreview || inputImageUrl} alt="antes" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
              <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", color: "#8394b0", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8 }}>Antes</div>
            </div>
            <div style={{ flex: 1, position: "relative", aspectRatio: "1", background: "#0c1018", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src={outputUrl} alt="depois" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
              <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(99,102,241,0.9)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8 }}>Depois</div>
            </div>
          </div>

          {/* Headline + badges */}
          <div style={{ padding: "20px 20px 0", textAlign: "center" }}>
            <p style={{ color: "#eef2f9", fontSize: 15, lineHeight: 1.6, fontWeight: 500, margin: "0 0 14px" }}>
              {HEADLINE[variant]}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ background: "rgba(22,199,132,0.12)", border: "1px solid rgba(22,199,132,0.25)", color: "#16c784", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                Cancele quando quiser
              </span>
              <span style={{ color: "#4e5c72", fontSize: 12 }}>|</span>
              <span style={{ background: "rgba(22,199,132,0.12)", border: "1px solid rgba(22,199,132,0.25)", color: "#16c784", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                Sem fidelidade
              </span>
            </div>
          </div>

          {/* PRO card */}
          <div style={{ margin: "16px 16px 0", background: "#111820", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 22, padding: "24px 20px" }}>

            {/* PRO badge + preço */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "inline-block", background: "linear-gradient(135deg,#6366f1,#a855f7)", borderRadius: 20, padding: "3px 14px", fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: 1, marginBottom: 12 }}>
                PRO
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                <span style={{ color: "#eef2f9", fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>{PRO_BR_MONTHLY_PRICE_LABEL}</span>
                <span style={{ color: "#8394b0", fontSize: 16 }}>/mês</span>
              </div>
              <div style={{ color: "#4e5c72", fontSize: 13, marginTop: 6 }}>
                Menos de {PRO_BR_MONTHLY_PRICE_PER_DAY_LABEL} por dia • Cancele quando quiser
              </div>
            </div>

            {/* Feature list */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16, marginBottom: 20 }}>
              {[
                "Fotos ilimitadas de produto com IA",
                "Vídeos animados para Reels e TikTok",
                "Vídeo narrado com locução e cenas",
                "Foto pronta na hora, sem fila",
                "Alta qualidade, sem marca d'água",
                "Cancele quando quiser",
              ].map(feat => (
                <div key={feat} className="feat-item">
                  <span style={{ color: "#a855f7", fontSize: 15, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ color: "#eef2f9", fontSize: 14, lineHeight: 1.5 }}>{feat}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button className="cta-pro" onClick={goToPro} disabled={navigating}>
              {navigating ? "Aguarde..." : `🔥 Assinar agora — ${PRO_BR_MONTHLY_PRICE_LABEL}/mês`}
            </button>
            <p style={{ color: "#4e5c72", fontSize: 12, textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
              Pagamento seguro via Stripe • Cancele a qualquer momento
            </p>
          </div>

          {/* Skip link */}
          <button className="cta-free" onClick={goToFree} disabled={navigating}>
            Continuar grátis com limite
          </button>
        </div>
      </div>
    );
  }

  // ── Tela de processamento ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", justifyContent: "center" }}>
    <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", padding: "0 0 80px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header TAMO */}
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          <img src="/tamo/processing.png" alt="TAMO" style={{ width: 34, height: 34, objectFit: "contain" }} />
        </div>
        <div>
          <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 15 }}>TAMO</div>
          <div style={{ color: "#16c784", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16c784", display: "inline-block" }} />
            processando sua foto...
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#6366f1,#a855f7)", borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ color: "#4e5c72", fontSize: 11, marginTop: 6, textAlign: "right" }}>{Math.round(progress)}% concluído</div>
      </div>

      {/* Image preview — blurred during processing */}
      {(inputPreview || inputImageUrl) && (
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ borderRadius: 18, overflow: "hidden", position: "relative", background: "#111820" }}>
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
          </div>
        </div>
      )}

      {/* Error state */}
      {jobError && (
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 16, color: "#fca5a5", fontSize: 14 }}>
            {jobError}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
