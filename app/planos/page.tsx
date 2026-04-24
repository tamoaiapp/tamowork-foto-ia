"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useI18n } from "@/lib/i18n";
import { trackEvent } from "@/lib/meta/pixel";

/* ─── Auth Modal ──────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function translateError(msg: string, lang: string): string {
  if (lang !== "pt") return msg;
  const m = msg.toLowerCase();
  if (m.includes("user already registered") || m.includes("already registered"))
    return "Este e-mail já está cadastrado. Clique em 'Entrar' para acessar.";
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (m.includes("password should be at least"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("security purposes"))
    return "Muitas tentativas. Aguarde alguns minutos.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "Formato de e-mail inválido.";
  return msg;
}

interface AuthModalProps {
  isBR: boolean;
  lang: string;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

function AuthModal({ isBR, lang, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const isSignup = mode === "signup";

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/planos?checkout=1` },
    });
    if (error) { setError(translateError(error.message, lang)); setGoogleLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(""); setMsg("");

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(translateError(error.message, lang)); setLoading(false); return; }
      if (data.session) onSuccess(data.session.access_token);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(translateError(error.message, lang)); setLoading(false); return; }
      trackEvent("CompleteRegistration");
      if (data.session) {
        onSuccess(data.session.access_token);
      } else {
        setMsg(lang === "en" ? "Check your e-mail to confirm your account." : lang === "es" ? "Revisa tu correo para confirmar tu cuenta." : "Verifique seu e-mail para confirmar sua conta.");
      }
    }
    setLoading(false);
  }

  const labels = isSignup ? {
    title: lang === "en" ? "Create free account" : lang === "es" ? "Crear cuenta gratis" : "Criar conta grátis",
    sub: lang === "en" ? "Then go straight to checkout" : lang === "es" ? "Luego ir directo al pago" : "Depois vai direto para o pagamento",
    google: lang === "en" ? "Sign up with Google" : lang === "es" ? "Registrarse con Google" : "Criar conta com Google",
    submit: loading ? "..." : (lang === "en" ? "Create account →" : lang === "es" ? "Crear cuenta →" : "Criar conta →"),
    toggle: lang === "en" ? "Already have an account?" : lang === "es" ? "¿Ya tienes cuenta?" : "Já tenho conta",
    toggleCta: lang === "en" ? "Sign in →" : lang === "es" ? "Entrar →" : "Entrar →",
  } : {
    title: lang === "en" ? "Sign in" : lang === "es" ? "Iniciar sesión" : "Entrar na conta",
    sub: lang === "en" ? "Then go straight to checkout" : lang === "es" ? "Luego ir directo al pago" : "Depois vai direto para o pagamento",
    google: lang === "en" ? "Continue with Google" : lang === "es" ? "Continuar con Google" : "Entrar com Google",
    submit: loading ? "..." : (lang === "en" ? "Sign in →" : lang === "es" ? "Entrar →" : "Entrar →"),
    toggle: lang === "en" ? "Don't have an account?" : lang === "es" ? "¿No tienes cuenta?" : "Não tenho conta",
    toggleCta: lang === "en" ? "Create for free →" : lang === "es" ? "Crear gratis →" : "Criar grátis →",
  };

  return (
    <div style={m.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={m.modal}>
        <button onClick={onClose} style={m.closeBtn}>✕</button>

        <div style={m.title}>{labels.title}</div>
        <div style={m.sub}>{labels.sub}</div>

        <button onClick={handleGoogle} disabled={googleLoading} style={m.googleBtn}>
          {googleLoading
            ? <span style={m.spinner} />
            : <GoogleIcon />}
          <span>{googleLoading ? "..." : labels.google}</span>
        </button>

        <div style={m.divider}>
          <div style={m.divLine} />
          <span style={m.divText}>{lang === "en" ? "or with e-mail" : lang === "es" ? "o con correo" : "ou com e-mail"}</span>
          <div style={m.divLine} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required style={m.input} autoComplete={isSignup ? "email" : "username"} />
          <input type="password" placeholder={lang === "en" ? "Password" : lang === "es" ? "Contraseña" : "Senha"} value={password} onChange={e => setPassword(e.target.value)} required style={m.input} autoComplete={isSignup ? "new-password" : "current-password"} />
          {error && <div style={m.errorBox}>{error}</div>}
          {msg && <div style={m.successBox}>{msg}</div>}
          <button type="submit" disabled={loading} style={{ ...m.submitBtn, opacity: loading ? 0.7 : 1 }}>
            {labels.submit}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span style={{ color: "#4e5c72", fontSize: 13 }}>{labels.toggle}</span>
          <button type="button" onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); setMsg(""); }}
            style={{ background: "none", border: "none", color: "#a855f7", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            {labels.toggleCta}
          </button>
        </div>
      </div>
    </div>
  );
}

const m: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 999,
    background: "rgba(7,8,11,0.85)",
    backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "20px",
  },
  modal: {
    background: "#111820",
    borderRadius: 22,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 0 0 1px rgba(139,92,246,0.3), 0 24px 60px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    position: "relative",
  },
  closeBtn: {
    position: "absolute", top: 16, right: 16,
    background: "none", border: "none", color: "#4e5c72",
    fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4,
  },
  title: { fontSize: 22, fontWeight: 800, color: "#eef2f9", letterSpacing: "-0.02em" },
  sub: { fontSize: 13, color: "#8394b0", marginTop: -6 },
  googleBtn: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    background: "#ffffff", border: "none", borderRadius: 14, padding: "15px 0",
    color: "#1a1a2e", fontSize: 15, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
  },
  spinner: {
    display: "inline-block", width: 18, height: 18,
    border: "2px solid #ccc", borderTop: "2px solid #6366f1",
    borderRadius: "50%", animation: "spin 0.8s linear infinite",
  },
  divider: { display: "flex", alignItems: "center", gap: 10 },
  divLine: { flex: 1, height: 1, background: "rgba(255,255,255,0.07)" },
  divText: { color: "#4e5c72", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" },
  input: {
    background: "#07080b", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "13px 16px",
    color: "#eef2f9", fontSize: 15, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "14px 0",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 2,
  },
  errorBox: {
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13,
  },
  successBox: {
    background: "rgba(22,199,132,0.08)", border: "1px solid rgba(22,199,132,0.25)",
    borderRadius: 10, padding: "10px 14px", color: "#16c784", fontSize: 13,
  },
};

/* ─── Planos Page ─────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#07080b",
    padding: "40px 24px 80px",
    fontFamily: "inherit",
    color: "#eef2f9",
  },
  inner: {
    maxWidth: 520,
    margin: "0 auto",
  },
  urgencyBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 12,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 700,
    color: "#f87171",
    textAlign: "center" as const,
    marginBottom: 8,
  },
  urgencyPulse: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#f87171",
    flexShrink: 0,
    boxShadow: "0 0 0 0 rgba(248,113,113,0.4)",
    animation: "pulseDot 1.5s ease-in-out infinite",
  },
  socialBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "16px 12px",
    marginBottom: 4,
  },
  socialStat: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 3,
  },
  socialNum: {
    fontSize: 20,
    fontWeight: 800,
    color: "#eef2f9",
    letterSpacing: "-0.02em",
  },
  socialLabel: {
    fontSize: 11,
    color: "#8394b0",
    textAlign: "center" as const,
  },
  socialDivider: {
    width: 1,
    height: 32,
    background: "rgba(255,255,255,0.07)",
    flexShrink: 0,
  },
  testimonialGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  testimonialCard: {
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 18,
    padding: "18px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  testimonialStars: {
    fontSize: 13,
    letterSpacing: 1,
  },
  testimonialText: {
    margin: 0,
    fontSize: 14,
    color: "#c8d4e8",
    lineHeight: 1.65,
    fontStyle: "italic" as const,
  },
  testimonialAuthor: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  testimonialName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#eef2f9",
  },
  testimonialHandle: {
    fontSize: 12,
    color: "#8394b0",
  },
  comparisonCard: {
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 18,
    padding: "20px 16px",
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#8394b0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: 14,
    textAlign: "center" as const,
  },
  comparisonGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
  },
  comparisonHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  comparisonHeaderFree: {
    fontSize: 12,
    fontWeight: 700,
    color: "#4e5c72",
    textAlign: "center" as const,
  },
  comparisonHeaderPro: {
    fontSize: 12,
    fontWeight: 700,
    color: "#a855f7",
    textAlign: "center" as const,
  },
  comparisonRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  comparisonFree: {
    fontSize: 13,
    color: "#4e5c72",
    textAlign: "center" as const,
  },
  comparisonPro: {
    fontSize: 13,
    color: "#16c784",
    fontWeight: 600,
    textAlign: "center" as const,
  },
  hero: {
    textAlign: "center",
    marginBottom: 24,
  },
  heroHeadline: {
    fontSize: "clamp(24px, 4vw, 36px)",
    fontWeight: 800,
    lineHeight: 1.18,
    letterSpacing: "-0.02em",
    margin: "0 auto 16px",
    maxWidth: 480,
    background: "linear-gradient(135deg, #eef2f9 30%, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    fontSize: 16,
    color: "#8394b0",
    margin: "0 auto 20px",
    maxWidth: 440,
    lineHeight: 1.6,
  },
  heroTrust: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(22,199,132,0.1)",
    border: "1px solid rgba(22,199,132,0.25)",
    borderRadius: 20,
    padding: "8px 16px",
    fontSize: 13,
    color: "#16c784",
    fontWeight: 600,
  },
  card: {
    background: "#111820",
    borderRadius: 22,
    padding: "36px 32px 32px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 0 0 2px #8b5cf6, 0 12px 40px rgba(139,92,246,0.25)",
    marginBottom: 48,
  },
  badge: {
    display: "inline-block",
    background: "rgba(168,85,247,0.15)",
    color: "#c084fc",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    padding: "5px 14px",
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: "center",
  },
  price: {
    fontSize: 56,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1,
    marginBottom: 4,
    letterSpacing: "-0.03em",
    textAlign: "center" as const,
  },
  pricePeriod: {
    fontSize: 22,
    fontWeight: 400,
    color: "#8394b0",
  },
  priceSub: {
    fontSize: 14,
    color: "#4e5c72",
    marginBottom: 28,
    textAlign: "center" as const,
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.07)",
    margin: "0 0 24px",
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 32px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    flexGrow: 1,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    color: "#eef2f9",
  },
  featureCheck: {
    color: "#16c784",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  btnPrimary: {
    width: "100%",
    padding: "18px 0",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    color: "#fff",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    transition: "opacity 0.15s",
    marginBottom: 12,
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
  },
  btnNote: {
    fontSize: 13,
    color: "#8394b0",
    textAlign: "center" as const,
  },
  valueSection: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  valueCard: {
    background: "#0c1018",
    borderRadius: 18,
    padding: "22px 18px",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  valueIcon: { fontSize: 26, marginBottom: 10, display: "block" },
  valueTitle: { fontSize: 14, fontWeight: 700, color: "#eef2f9", marginBottom: 6 },
  valueDesc: { fontSize: 13, color: "#8394b0", lineHeight: 1.55 },
};

const featuresPT = [
  "Fotos ilimitadas de produto com IA",
  "Vídeos animados para Reels e TikTok",
  "Vídeo narrado com locução e cenas",
  "Foto pronta na hora, sem fila",
  "Alta qualidade, sem marca d'água",
  "Cancele quando quiser",
];
const featuresEN = [
  "Unlimited AI product photos",
  "Animated videos for Reels & TikTok",
  "Narrated video with voiceover & scenes",
  "Photo ready instantly, no queue",
  "High quality, no watermark",
  "Cancel anytime",
];
const featuresES = [
  "Fotos de producto ilimitadas con IA",
  "Videos animados para Reels y TikTok",
  "Video narrado con locución y escenas",
  "Foto lista al instante, sin cola",
  "Alta calidad, sin marca de agua",
  "Cancela cuando quieras",
];

export default function PlanosPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [isBR, setIsBR] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const features = lang === "es" ? featuresES : lang === "pt" ? featuresPT : featuresEN;

  useEffect(() => {
    const l = (typeof navigator !== "undefined" ? navigator.language : "pt-BR") || "pt-BR";
    setIsBR(l.startsWith("pt"));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user ?? null;
      setUser(u);
      setLoading(false);

      if (!u) {
        const params = new URLSearchParams(window.location.search);
        if (params.get("checkout") === "1") return; // OAuth ainda carregando
        // Não redireciona — exibe a página de vendas e abre modal no clique
      }
    });
  }, []);

  useEffect(() => {
    trackEvent("ViewContent");
  }, []);

  // After Google OAuth redirect, auto-checkout if ?checkout=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "1") return;
    // Remove param from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.toString());
    // Wait for session then checkout
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) startStripeCheckout(session.access_token);
    });
  }, []);

  async function startStripeCheckout(tok: string) {
    setLoadingStripe(true);
    try {
      trackEvent("InitiateCheckout", { value: isBR ? 29 : 100, currency: isBR ? "BRL" : "USD" }, tok);
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: isBR ? "monthly" : "annual" }),
      });
      const json = await res.json();
      if (json.url) { window.location.href = json.url; return; }
      throw new Error(json.error ?? "Sem URL");
    } catch {
      alert(lang === "pt" ? "Erro ao iniciar pagamento. Tente novamente." : "Payment error. Please try again.");
    } finally {
      setLoadingStripe(false);
    }
  }

  async function handleCheckout() {
    if (loadingStripe) return;
    if (!user) {
      setShowModal(true);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) startStripeCheckout(session.access_token);
  }

  function handleAuthSuccess(token: string) {
    setShowModal(false);
    startStripeCheckout(token);
  }

  if (loading) return null;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.5); }
          50% { box-shadow: 0 0 0 6px rgba(248,113,113,0); }
        }
      `}</style>

      {showModal && (
        <AuthModal
          isBR={isBR}
          lang={lang}
          onClose={() => setShowModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      <div style={styles.page} className="app-layout">
        <div style={styles.inner}>

          {/* Urgency banner */}
          {isBR && (
            <div style={styles.urgencyBanner}>
              <span style={styles.urgencyPulse} />
              ⏰ Oferta especial &mdash; R$29/mês válido até domingo (27/04)
            </div>
          )}

          {/* Hero */}
          <div style={styles.hero}>
            <h1 style={styles.heroHeadline}>
              {lang === "en"
                ? "Professional product photos with AI"
                : lang === "es"
                ? "Fotos profesionales de productos con IA"
                : "Fotos e vídeos profissionais dos seus produtos com IA"}
            </h1>
            <p style={styles.heroSub}>
              {lang === "en"
                ? "Take a photo with your phone, AI transforms it into a professional store photo. No photographer, no studio."
                : lang === "es"
                ? "Toma una foto con el celular, la IA la transforma en foto profesional de tienda. Sin fotógrafo, sin estudio."
                : "Tire foto com o celular — a IA transforma em foto de loja profissional e vídeo pra Reels. Sem fotógrafo, sem estúdio."}
            </p>
            <div style={styles.heroTrust}>
              <span>{lang === "en" ? "Cancel anytime" : lang === "es" ? "Cancela cuando quieras" : "Cancele quando quiser"}</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>{lang === "en" ? "No commitment" : lang === "es" ? "Sin fidelidad" : "Sem fidelidade"}</span>
            </div>
          </div>

          {/* Social proof bar */}
          <div style={styles.socialBar}>
            <div style={styles.socialStat}>
              <span style={styles.socialNum}>25.000+</span>
              <span style={styles.socialLabel}>{lang === "en" ? "entrepreneurs" : lang === "es" ? "emprendedores" : "empreendedores"}</span>
            </div>
            <div style={styles.socialDivider} />
            <div style={styles.socialStat}>
              <span style={styles.socialNum}>+20%</span>
              <span style={styles.socialLabel}>{lang === "en" ? "more sales" : lang === "es" ? "más ventas" : "em vendas"}</span>
            </div>
            <div style={styles.socialDivider} />
            <div style={styles.socialStat}>
              <span style={styles.socialNum}>⭐ 4.9</span>
              <span style={styles.socialLabel}>{lang === "en" ? "rating" : lang === "es" ? "valoración" : "avaliação"}</span>
            </div>
          </div>

          {/* Testimonials */}
          {isBR && (
            <div style={styles.testimonialGrid}>
              {[
                {
                  text: "Meu Instagram explodiu. As fotos ficam melhores que de fotógrafo profissional, e o vídeo animado é o que mais bombou nos Reels.",
                  name: "Maria G.",
                  handle: "@emporiomariag",
                },
                {
                  text: "Economizei mais de R$400/mês em fotógrafo. Em 30 segundos tenho foto de catálogo profissional. Meus clientes pensam que contratei estúdio.",
                  name: "Carlos R.",
                  handle: "@docescarlos_rj",
                },
                {
                  text: "Passei de 500 para 3.000 seguidores em 2 meses só mudando as fotos do produto. O vídeo narrado com IA é o diferencial.",
                  name: "Ana P.",
                  handle: "@modamimosa_sp",
                },
              ].map((t) => (
                <div key={t.handle} style={styles.testimonialCard}>
                  <div style={styles.testimonialStars}>⭐⭐⭐⭐⭐</div>
                  <p style={styles.testimonialText}>&ldquo;{t.text}&rdquo;</p>
                  <div style={styles.testimonialAuthor}>
                    <span style={styles.testimonialName}>{t.name}</span>
                    <span style={styles.testimonialHandle}>{t.handle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Free vs PRO comparison */}
          {isBR && (
            <div style={styles.comparisonCard}>
              <div style={styles.comparisonTitle}>Gratuito vs PRO</div>
              <div style={styles.comparisonGrid}>
                <div style={styles.comparisonHeader}>
                  <span style={styles.comparisonHeaderFree}>Gratuito</span>
                  <span style={styles.comparisonHeaderPro}>✨ PRO</span>
                </div>
                {[
                  ["3 fotos por dia", "Fotos ilimitadas"],
                  ["1 vídeo por dia", "Vídeos ilimitados"],
                  ["Sem editor de foto", "Editor completo"],
                  ["Com marca d'água", "Sem marca d'água"],
                  ["Fila de espera", "Geração instantânea"],
                ].map(([free, pro]) => (
                  <div key={free} style={styles.comparisonRow}>
                    <span style={styles.comparisonFree}>✗ {free}</span>
                    <span style={styles.comparisonPro}>✓ {pro}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Card */}
          <div style={styles.card}>
            <span style={styles.badge}>PRO</span>

            {isBR ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 20, color: "#4e5c72", textDecoration: "line-through", marginRight: 8 }}>R$79</span>
                  <span style={{ fontSize: 12, background: "rgba(239,68,68,0.15)", color: "#f87171", borderRadius: 8, padding: "2px 8px", fontWeight: 700 }}>-63%</span>
                </div>
                <div style={styles.price}>R$29<span style={styles.pricePeriod}> /mês</span></div>
                <div style={styles.priceSub}>Menos de R$0,97/dia • Cancele quando quiser • Válido até domingo</div>
</>
            ) : (
              <>
                <div style={styles.price}>$100<span style={styles.pricePeriod}> /year</span></div>
                <div style={styles.priceSub}>Less than $0.28 per day • Cancel anytime</div>
              </>
            )}

            <div style={styles.divider} />

            <ul style={styles.featureList}>
              {features.map((f) => (
                <li key={f} style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              style={{ ...styles.btnPrimary, opacity: loadingStripe ? 0.7 : 1 }}
              onClick={handleCheckout}
              disabled={loadingStripe}
              onMouseEnter={(e) => { if (!loadingStripe) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
              onMouseLeave={(e) => { if (!loadingStripe) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              {loadingStripe
                ? (lang === "en" ? "Redirecting..." : lang === "es" ? "Redirigiendo..." : "Redirecionando...")
                : isBR
                ? "🔥 Assinar agora — R$29/mês"
                : lang === "es"
                ? "🔥 Suscribirse — $100/año"
                : "🔥 Subscribe now — $100/year"}
            </button>

            <div style={styles.btnNote}>
              {lang === "pt"
                ? "Pagamento seguro via Stripe • Cancele a qualquer momento"
                : lang === "es"
                ? "Pago seguro vía Stripe • Cancela cuando quieras"
                : "Secure payment via Stripe • Cancel anytime"}
            </div>
          </div>

          {/* Value Props */}
          <div style={styles.valueSection}>
            <div style={styles.valueCard}>
              <span style={styles.valueIcon}>⚡</span>
              <div style={styles.valueTitle}>
                {lang === "en" ? "Instant photos" : lang === "es" ? "Fotos al instante" : "Foto pronta na hora"}
              </div>
              <div style={styles.valueDesc}>
                {lang === "en"
                  ? "No queue. Generate as many as you want, anytime."
                  : lang === "es"
                  ? "Sin cola. Genera las que quieras, a cualquier hora."
                  : "Sem fila. Gere quantas quiser, a qualquer hora."}
              </div>
            </div>
            <div style={styles.valueCard}>
              <span style={styles.valueIcon}>🎬</span>
              <div style={styles.valueTitle}>
                {lang === "en" ? "Photo & video AI" : lang === "es" ? "Foto y video IA" : "Foto e vídeo com IA"}
              </div>
              <div style={styles.valueDesc}>
                {lang === "en"
                  ? "Animated videos and narrated reels for your products."
                  : lang === "es"
                  ? "Videos animados y reels narrados para tus productos."
                  : "Vídeos animados e reels narrados dos seus produtos."}
              </div>
            </div>
            <div style={styles.valueCard}>
              <span style={styles.valueIcon}>☕</span>
              <div style={styles.valueTitle}>
                {lang === "en" ? "Less than a coffee" : lang === "es" ? "Menos que un café" : "Menos que um café"}
              </div>
              <div style={styles.valueDesc}>
                {isBR
                  ? "R$0,97 por dia para transformar as fotos do seu negócio."
                  : lang === "es"
                  ? "$0.28 por día para transformar tu negocio."
                  : "$0.28 per day to transform your business visuals."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
