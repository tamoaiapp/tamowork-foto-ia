"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useI18n, LangSelector } from "@/lib/i18n";

const S3 = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object";
const VID = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/video-jobs";

const DEMO_CARDS = [
  {
    label: "Óculos retrô",
    before: `${S3}/public/input-images/onboard/oculos.jpeg`,
    after:  `${S3}/sign/image-jobs/d7b2fe90-4383-4f6d-92bb-672b210de218.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2Q3YjJmZTkwLTQzODMtNGY2ZC05MmJiLTY3MmIyMTBkZTIxOC5qcGciLCJpYXQiOjE3NzQ5NTgwMDUsImV4cCI6MjA5MDMxODAwNX0.4DG7PNfy--I0dO76hrsxIQvYnKgZ9YkaYicebKzR98w`,
    video:  `${VID}/396aed09-3745-4d78-8b0a-5aec13513282.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzLzM5NmFlZDA5LTM3NDUtNGQ3OC04YjBhLTVhZWMxMzUxMzI4Mi5tcDQiLCJpYXQiOjE3NzQ5NTg2NTMsImV4cCI6MjA5MDMxODY1M30.5H9g-PfaOIG0HUMAdTb-SiyWNbovLhoUSb1n0Pq4YrM`,
  },
  {
    label: "Tênis bordado",
    before: `${S3}/public/input-images/onboard/tenis.jpg`,
    after:  `${S3}/sign/image-jobs/800f27c5-7d73-4603-b252-d2e9853563b8.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzgwMGYyN2M1LTdkNzMtNDYwMy1iMjUyLWQyZTk4NTM1NjNiOC5qcGciLCJpYXQiOjE3NzQ5NTgwMDQsImV4cCI6MjA5MDMxODAwNH0.WnYrCu2rEopYvByQKFu8L5Hm-3jzA9IXUqgjuFI2unQ`,
    video:  `${VID}/6ce857bd-9f7f-43db-a624-08da9a9050bd.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzLzZjZTg1N2JkLTlmN2YtNDNkYi1hNjI0LTA4ZGE5YTkwNTBiZC5tcDQiLCJpYXQiOjE3NzQ5NjE1NTksImV4cCI6MjA5MDMyMTU1OX0.q_JFA0rsLIL73L560WcYZAQI_iSW7m4sMdqxFfAA6OQ`,
  },
  {
    label: "Fantasia infantil",
    before: `${S3}/public/input-images/onboard/fantasia.webp`,
    after:  `${S3}/sign/image-jobs/4bfe5d4a-7d6a-41e9-8c15-15ecbc4e1571.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzRiZmU1ZDRhLTdkNmEtNDFlOS04YzE1LTE1ZWNiYzRlMTU3MS5qcGciLCJpYXQiOjE3NzQ5NTgwMDUsImV4cCI6MjA5MDMxODAwNX0.mItnYXMEOLDmMn8ViKTZz219qSx9dNOKoGoEWyYCbno`,
    video:  `${VID}/11af3ceb-12fa-4c05-bb66-5f4ad981bc1c.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzLzExYWYzY2ViLTEyZmEtNGMwNS1iYjY2LTVmNGFkOTgxYmMxYy5tcDQiLCJpYXQiOjE3NzQ5NjE1NjAsImV4cCI6MjA5MDMyMTU2MH0.UEaFTP_FxncuvR_FYvzqFgC4e-TwdDXUdmw2v6xTj1g`,
  },
  {
    label: "Colar de praia",
    before: `${S3}/public/input-images/onboard/colar.webp`,
    after:  `${S3}/sign/image-jobs/e307caef-e00b-4e45-b27e-311090bbe285.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2UzMDdjYWVmLWUwMGItNGU0NS1iMjdlLTMxMTA5MGJiZTI4NS5qcGciLCJpYXQiOjE3NzQ5NTgwMDQsImV4cCI6MjA5MDMxODAwNH0.8y-i7FEDxSDPJxHkwKwZ4LkctT1a04eTOw46Tek0UXE`,
    video:  `${VID}/aa76a131-3cde-4c1d-bbfa-af6686fcc1be.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlby1qb2JzL2FhNzZhMTMxLTNjZGUtNGMxZC1iYmZhLWFmNjY4NmZjYzFiZS5tcDQiLCJpYXQiOjE3NzQ5NTg2NTQsImV4cCI6MjA5MDMxODY1NH0.FgXQHovRxQK3TEwLOWY2weOCbPPdvlsrIZVS1B4Nyfc`,
  },
];

const ACCENT = "#a855f7";

function DemoCarousel() {
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { t } = useI18n();

  function goTo(next: number) {
    setIdx((next + DEMO_CARDS.length) % DEMO_CARDS.length);
  }

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [idx]);

  const card = DEMO_CARDS[idx];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Nome + contador */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{card.label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}22`, padding: "3px 10px", borderRadius: 20 }}>
          {idx + 1}/{DEMO_CARDS.length}
        </span>
      </div>

      {/* Antes / Depois lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
          <img
            src={card.before}
            alt="antes"
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
          <span style={{
            position: "absolute", bottom: 6, left: 6,
            background: "rgba(0,0,0,0.72)", color: "#aaa",
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1,
          }}>ANTES</span>
        </div>
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
          <img
            src={card.after}
            alt="foto ia"
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
          <span style={{
            position: "absolute", bottom: 6, left: 6,
            background: ACCENT, color: "#fff",
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1,
          }}>DEPOIS IA</span>
        </div>
      </div>

      {/* Vídeo — avança ao terminar */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", lineHeight: 0 }}>
        {card.video ? (
          <video
            ref={videoRef}
            key={card.video}
            src={card.video}
            autoPlay
            muted
            playsInline
            onEnded={() => goTo(idx + 1)}
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
        ) : (
          <img
            src={card.after}
            alt="foto ia"
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
        )}
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          borderRadius: 8, padding: "3px 10px",
          fontSize: 11, fontWeight: 700, color: "#fff",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
          {card.label}
        </div>
        <span style={{
          position: "absolute", bottom: 8, left: 8,
          background: `${ACCENT}dd`, color: "#fff",
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1,
        }}>{card.video ? "VÍDEO IA" : "FOTO IA"}</span>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
        {DEMO_CARDS.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === idx ? 18 : 6, height: 6,
              borderRadius: 99,
              background: i === idx ? ACCENT : "rgba(255,255,255,0.25)",
              transition: "all 0.3s ease", cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}

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
        {/* Glow de fundo */}
        <div style={s.glow} />

        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
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
        <div style={s.headlineBlock}>
          <h1 style={s.headline}>
            Foto e vídeo de produto{" "}
            <span style={s.headlineAccent}>profissional com IA</span>
          </h1>
          <p style={s.sub}>Tira uma foto simples e a IA transforma em imagem de catálogo e vídeo animado.</p>
        </div>

        {/* Demo carousel */}
        <DemoCarousel />
      </div>

      {/* Auth card */}
      <div style={s.card}>
        {/* Google — ação principal */}
        <button onClick={handleGoogle} disabled={googleLoading} style={s.googleBtn}>
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
          <span style={s.dividerText}>ou e-mail</span>
          <div style={s.dividerLine} />
        </div>

        {!showEmail ? (
          <button onClick={() => setShowEmail(true)} style={s.emailToggle}>
            Usar e-mail e senha
          </button>
        ) : (
          <>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  },

  hero: {
    width: "100%",
    maxWidth: 480,
    padding: "56px 20px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    position: "relative",
  },
  glow: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: 360,
    height: 220,
    borderRadius: "50%",
    background: "radial-gradient(ellipse, rgba(99,102,241,0.16) 0%, transparent 70%)",
    pointerEvents: "none",
  },

  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  logoText: {
    fontSize: 18,
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
    marginTop: 2,
  },

  headlineBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  headline: {
    fontSize: 26,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
    margin: 0,
  },
  headlineAccent: {
    background: "linear-gradient(135deg, #818cf8, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  sub: {
    fontSize: 14,
    color: "#8394b0",
    margin: 0,
    lineHeight: 1.5,
  },

  /* Auth card */
  card: {
    width: "100%",
    maxWidth: 480,
    background: "#0c1018",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "24px 24px 0 0",
    padding: "24px 20px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: "auto",
  },

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
  },

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
  },

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

  terms: {
    color: "#4e5c72",
    fontSize: 11,
    textAlign: "center" as const,
    margin: 0,
    lineHeight: 1.5,
  },
};
