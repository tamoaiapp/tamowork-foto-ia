"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useI18n, LangSelector } from "@/lib/i18n";

const EXAMPLES = [
  {
    before: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/input-images/catalog/mulher1.jpg`,
    after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/output-images/demo/demo1.jpg",
    label: "Moda",
  },
  {
    before: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/input-images/catalog/homem1.jpg`,
    after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/output-images/demo/demo2.jpg",
    label: "Produto",
  },
];

const FEATURES = [
  { icon: "✨", label: "IA profissional" },
  { icon: "⚡", label: "30 segundos" },
  { icon: "🎨", label: "Fundo perfeito" },
  { icon: "📦", label: "Qualquer produto" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const { t } = useI18n();

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const done = typeof window !== "undefined" && localStorage.getItem("tw_onboarding_done");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${done ? "/" : "/onboarding"}` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    const done = typeof window !== "undefined" && localStorage.getItem("tw_onboarding_done");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push(done ? "/" : "/onboarding");
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (data.session) router.push("/onboarding");
      else setMsg(t("login_verify_email"));
    }
    setLoading(false);
  }

  return (
    <div style={s.page}>
      {/* Lang selector */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10 }}>
        <LangSelector />
      </div>

      {/* Hero */}
      <div style={s.hero}>
        {/* Glow */}
        <div style={s.glow1} />
        <div style={s.glow2} />

        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="url(#lg)" />
              <path d="M10 22l4-5.5 3 3.5 3.5-5L25 22H10z" fill="white" opacity="0.95" />
              <circle cx="13" cy="12" r="2.5" fill="white" opacity="0.95" />
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div style={s.logoText}>TamoWork</div>
            <div style={s.logoSub}>Foto IA</div>
          </div>
        </div>

        {/* Headline */}
        <h1 style={s.headline}>
          Fotos de produto<br />
          <span style={s.headlineAccent}>profissionais com IA</span>
        </h1>
        <p style={s.sub}>{t("login_tagline")}</p>

        {/* Feature pills */}
        <div style={s.pills}>
          {FEATURES.map((f) => (
            <div key={f.label} style={s.pill}>
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Example strip */}
        <div style={s.exampleStrip}>
          <ExampleCard />
          <ExampleCard alt />
          <ExampleCard />
        </div>
      </div>

      {/* Auth card */}
      <div style={s.card}>
        {/* Google — ação principal */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          style={s.googleBtn}
        >
          {googleLoading ? (
            <span style={s.spinner} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span>{googleLoading ? "Entrando..." : t("login_google")}</span>
        </button>

        {/* Divider */}
        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>ou continue com e-mail</span>
          <div style={s.dividerLine} />
        </div>

        {!showEmail ? (
          <button onClick={() => setShowEmail(true)} style={s.emailToggle}>
            Usar e-mail e senha
          </button>
        ) : (
          <>
            {/* Tabs */}
            <div style={s.tabs}>
              <button
                style={{ ...s.tab, ...(mode === "login" ? s.tabActive : {}) }}
                onClick={() => { setMode("login"); setError(""); }}
              >
                {t("login_enter")}
              </button>
              <button
                style={{ ...s.tab, ...(mode === "signup" ? s.tabActive : {}) }}
                onClick={() => { setMode("signup"); setError(""); }}
              >
                {t("login_create_account")}
              </button>
            </div>

            <form onSubmit={handleSubmit} style={s.form}>
              <input
                type="email"
                placeholder={t("login_email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={s.input}
              />
              <input
                type="password"
                placeholder={t("login_password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={s.input}
              />

              {error && <div style={s.errorBox}>{error}</div>}
              {msg && <div style={s.successBox}>{msg}</div>}

              <button type="submit" disabled={loading} style={s.submitBtn}>
                {loading
                  ? (mode === "login" ? t("login_logging") : t("login_creating"))
                  : (mode === "login" ? t("login_enter") : t("login_create_account"))}
              </button>
            </form>
          </>
        )}

        <p style={s.terms}>
          Ao entrar você concorda com nossos{" "}
          <a href="/privacidade" style={{ color: "#8394b0", textDecoration: "underline" }}>termos de uso</a>.
        </p>
      </div>
    </div>
  );
}

/* Cartão de exemplo decorativo — gradiente simulando before/after */
function ExampleCard({ alt }: { alt?: boolean }) {
  return (
    <div style={{
      flex: "0 0 auto",
      width: 120,
      height: 160,
      borderRadius: 14,
      overflow: "hidden",
      position: "relative",
      border: "1px solid rgba(255,255,255,0.08)",
      background: alt
        ? "linear-gradient(160deg, #1a1030 0%, #2d1b4e 50%, #1a0e2e 100%)"
        : "linear-gradient(160deg, #0f1a2e 0%, #1a2a4a 50%, #0e1828 100%)",
    }}>
      {/* Brilho no centro */}
      <div style={{
        position: "absolute", top: "30%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 60, height: 60,
        borderRadius: "50%",
        background: alt
          ? "radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)",
      }} />
      {/* Ícone produto simulado */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
        padding: "20px 8px 8px",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#16c784",
        }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
          {alt ? "Gerado com IA" : "Foto profissional"}
        </span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "#07080b",
    overflowX: "hidden",
  },

  /* Hero */
  hero: {
    width: "100%",
    maxWidth: 480,
    padding: "60px 24px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    position: "relative",
    textAlign: "center",
  },
  glow1: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: 400,
    height: 300,
    borderRadius: "50%",
    background: "radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  glow2: {
    position: "absolute",
    top: 80,
    left: "50%",
    transform: "translateX(-50%)",
    width: 300,
    height: 200,
    borderRadius: "50%",
    background: "radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },

  /* Logo */
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    position: "relative",
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  logoText: {
    fontSize: 20,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 11,
    fontWeight: 600,
    color: "#4e5c72",
    letterSpacing: "0.04em",
    marginTop: 1,
  },

  /* Headline */
  headline: {
    fontSize: 30,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
    margin: 0,
    position: "relative",
  },
  headlineAccent: {
    background: "linear-gradient(135deg, #818cf8, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  sub: {
    fontSize: 15,
    color: "#8394b0",
    margin: 0,
    maxWidth: 300,
    lineHeight: 1.5,
    position: "relative",
  },

  /* Pills */
  pills: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    justifyContent: "center",
    position: "relative",
  },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 99,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 12,
    fontWeight: 600,
    color: "#8394b0",
  },

  /* Example strip */
  exampleStrip: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },

  /* Auth card */
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#0c1018",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "24px 24px 0 0",
    padding: "28px 24px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: "auto",
    position: "sticky",
    bottom: 0,
  },

  /* Google button */
  googleBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "#ffffff",
    border: "none",
    borderRadius: 14,
    padding: "14px 0",
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  spinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    border: "2px solid #ccc",
    borderTop: "2px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  /* Divider */
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.07)",
  },
  dividerText: {
    color: "#4e5c72",
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  },

  /* Email toggle */
  emailToggle: {
    background: "transparent",
    border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: "12px 0",
    color: "#8394b0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    transition: "border-color 0.2s, color 0.2s",
  },

  /* Tabs */
  tabs: {
    display: "flex",
    gap: 6,
    background: "#07080b",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    borderRadius: 9,
    background: "transparent",
    color: "#4e5c72",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "#111820",
    color: "#eef2f9",
  },

  /* Form */
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  input: {
    background: "#07080b",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "13px 16px",
    color: "#eef2f9",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  submitBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none",
    borderRadius: 14,
    padding: "14px 0",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    marginTop: 2,
  },

  /* Feedback */
  errorBox: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#f87171",
    fontSize: 13,
  },
  successBox: {
    background: "rgba(22,199,132,0.08)",
    border: "1px solid rgba(22,199,132,0.25)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#16c784",
    fontSize: 13,
  },

  /* Terms */
  terms: {
    color: "#4e5c72",
    fontSize: 11,
    textAlign: "center" as const,
    margin: 0,
    lineHeight: 1.5,
  },
};
