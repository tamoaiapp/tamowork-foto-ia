"use client";
export const dynamic = "force-dynamic";

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
  const { lang } = useI18n();

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{card.label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}22`, padding: "3px 10px", borderRadius: 20 }}>
          {idx + 1}/{DEMO_CARDS.length}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
          <img src={card.after} alt="depois" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
          <span style={{ position: "absolute", bottom: 6, left: 6, background: ACCENT, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1 }}>
            {lang === "en" ? "AI AFTER" : lang === "es" ? "IA DESPUÉS" : "DEPOIS IA"}
          </span>
        </div>
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
          <img src={card.before} alt="antes" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
          <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.72)", color: "#aaa", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1 }}>
            {lang === "en" ? "BEFORE" : lang === "es" ? "ANTES" : "ANTES"}
          </span>
        </div>
      </div>

      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", lineHeight: 0 }}>
        <video
          ref={videoRef}
          key={card.video}
          src={card.video}
          autoPlay muted playsInline
          onEnded={() => goTo(idx + 1)}
          style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
        />
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
          {card.label}
        </div>
        <span style={{ position: "absolute", bottom: 8, left: 8, background: `${ACCENT}dd`, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, letterSpacing: 1 }}>
          {lang === "en" ? "AI VIDEO" : lang === "es" ? "VIDEO IA" : "VÍDEO IA"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
        {DEMO_CARDS.map((_, i) => (
          <div key={i} onClick={() => goTo(i)} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 99, background: i === idx ? ACCENT : "rgba(255,255,255,0.25)", transition: "all 0.3s", cursor: "pointer" }} />
        ))}
      </div>
    </div>
  );
}

function AuthCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const { t, lang } = useI18n();

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(""); setMsg("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (data.session) router.push("/");
      else setMsg(t("login_verify_email"));
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError(lang === "en" ? "Enter your e-mail first" : lang === "es" ? "Ingresa tu e-mail primero" : "Digite seu e-mail primeiro");
      return;
    }
    setLoading(true); setError(""); setMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) setError(error.message);
    else setMsg(lang === "en" ? "Recovery e-mail sent! Check your inbox." : lang === "es" ? "¡E-mail de recuperación enviado!" : "E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    setLoading(false);
  }

  return (
    <div style={a.card}>
      {/* Logo mobile — só aparece no mobile via CSS */}
      <div className="login-logo-mobile" style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 4 }}>
        <img src="/icons/icon-512.png" alt="TamoWork" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TamoWork</div>
          <div style={{ fontSize: 10, color: "#4e5c72", fontWeight: 600, letterSpacing: "0.04em" }}>Foto IA</div>
        </div>
      </div>

      {/* Título */}
      <div style={a.cardTitle}>{lang === "en" ? "Start for free" : lang === "es" ? "Empieza gratis ahora" : "Comece grátis agora"}</div>
      <div style={a.cardSub}>{lang === "en" ? "No credit card required" : lang === "es" ? "Sin tarjeta de crédito" : "Sem cartão de crédito"}</div>

      {/* Google */}
      <button onClick={handleGoogle} disabled={googleLoading} style={a.googleBtn}>
        {googleLoading ? <span style={a.spinner} /> : (
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        <span>{googleLoading ? t("login_logging") : t("login_google")}</span>
      </button>

      {/* Divider */}
      <div style={a.divider}>
        <div style={a.divLine} />
        <span style={a.divText}>{lang === "en" ? "or email" : lang === "es" ? "o correo" : "ou e-mail"}</span>
        <div style={a.divLine} />
      </div>

      {!showEmail ? (
        <button onClick={() => setShowEmail(true)} style={a.emailToggle}>
          {lang === "en" ? "Use email & password" : lang === "es" ? "Usar correo y contraseña" : "Usar e-mail e senha"}
        </button>
      ) : (
        <>
          <div style={a.tabs}>
            <button style={{ ...a.tab, ...(mode === "login" ? a.tabActive : {}) }} onClick={() => { setMode("login"); setError(""); }}>{t("login_enter")}</button>
            <button style={{ ...a.tab, ...(mode === "signup" ? a.tabActive : {}) }} onClick={() => { setMode("signup"); setError(""); }}>{t("login_create_account")}</button>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" placeholder={t("login_email")} value={email} onChange={e => setEmail(e.target.value)} required style={a.input} />
            <input type="password" placeholder={t("login_password")} value={password} onChange={e => setPassword(e.target.value)} required style={a.input} />
            {mode === "login" && (
              <button type="button" onClick={handleForgotPassword} style={{ background: "none", border: "none", color: "#8394b0", fontSize: 13, cursor: "pointer", textAlign: "right", padding: "2px 0", textDecoration: "underline", fontFamily: "inherit" }}>
                {lang === "en" ? "Forgot password?" : lang === "es" ? "¿Olvidaste tu contraseña?" : "Esqueci minha senha"}
              </button>
            )}
            {error && <div style={a.errorBox}>{error}</div>}
            {msg && <div style={a.successBox}>{msg}</div>}
            <button type="submit" disabled={loading} style={a.submitBtn}>
              {loading ? (mode === "login" ? t("login_logging") : t("login_creating")) : (mode === "login" ? t("login_enter") : t("login_signup"))}
            </button>
          </form>
        </>
      )}

      <p style={a.terms}>
        {lang === "en" ? (
          <>By signing in you agree to our{" "}<a href="/privacidade" style={{ color: "#8394b0", textDecoration: "underline" }}>terms of use</a>.</>
        ) : lang === "es" ? (
          <>Al entrar aceptas nuestros{" "}<a href="/privacidade" style={{ color: "#8394b0", textDecoration: "underline" }}>términos de uso</a>.</>
        ) : (
          <>Ao entrar você concorda com nossos{" "}<a href="/privacidade" style={{ color: "#8394b0", textDecoration: "underline" }}>termos de uso</a>.</>
        )}
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#07080b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Mobile: auth no topo, exemplos abaixo */
        .login-root {
          min-height: 100vh;
          background: #07080b;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          align-items: center;
        }
        .login-hero {
          width: 100%;
          max-width: 480px;
          padding: 0 20px 40px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          order: 2;
        }
        .login-auth {
          width: 100%;
          max-width: 480px;
          order: 1;
          padding-top: env(safe-area-inset-top, 0px);
        }

        /* No mobile, esconde logo/headline do hero (já está no auth) */
        @media (max-width: 899px) {
          .login-logo-hero { display: none !important; }
          .login-headline-hero { display: none !important; }
        }

        /* Desktop: esconde logo mobile do auth card */
        @media (min-width: 900px) and (pointer: fine) {
          .login-logo-mobile { display: none !important; }
        }

        /* Desktop: duas colunas lado a lado */
        @media (min-width: 900px) and (pointer: fine) {
          .login-root {
            flex-direction: row;
            align-items: stretch;
            justify-content: center;
            min-height: 100vh;
          }
          .login-hero {
            max-width: 560px;
            flex: 1;
            padding: 60px 48px 60px 60px;
            overflow-y: auto;
          }
          .login-auth {
            width: 420px;
            flex-shrink: 0;
            border-left: 1px solid rgba(255,255,255,0.07);
            background: #0a0e15;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 36px;
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
          }
        }
      `}</style>

      <div className="login-root">
        {/* Lang */}
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 20 }}>
          <LangSelector />
        </div>

        {/* Coluna esquerda — hero + carousel */}
        <div className="login-hero">
          {/* Glow */}
          <div style={{ position: "absolute", top: 0, left: "30%", width: "min(400px, 70vw)", height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents: "none", overflow: "hidden" }} />

          {/* Logo — só aparece no desktop */}
          <div className="login-logo-hero" style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <img src="/icons/icon-512.png" alt="TamoWork" style={{ width: 40, height: 40, borderRadius: 11, objectFit: "cover" }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em", lineHeight: 1.1 }}>TamoWork</div>
              <div style={{ fontSize: 11, color: "#4e5c72", fontWeight: 600, letterSpacing: "0.04em" }}>Foto IA</div>
            </div>
          </div>

          {/* Headline */}
          <div style={{ position: "relative" }}>
            {lang === "en" ? (
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#eef2f9", lineHeight: 1.25, letterSpacing: "-0.02em", margin: 0 }}>
                Phone photo becomes{" "}
                <span style={{ background: "linear-gradient(135deg, #818cf8, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  catalog photo & video
                </span>{" "}
                in 1 minute
              </h1>
            ) : lang === "es" ? (
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#eef2f9", lineHeight: 1.25, letterSpacing: "-0.02em", margin: 0 }}>
                Foto de celular se convierte en{" "}
                <span style={{ background: "linear-gradient(135deg, #818cf8, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  foto y video de catálogo
                </span>{" "}
                en 1 minuto
              </h1>
            ) : (
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#eef2f9", lineHeight: 1.25, letterSpacing: "-0.02em", margin: 0 }}>
                Foto de celular vira{" "}
                <span style={{ background: "linear-gradient(135deg, #818cf8, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  foto e vídeo de catálogo
                </span>{" "}
                em 1 minuto
              </h1>
            )}
            <p style={{ fontSize: 15, color: "#8394b0", margin: "10px 0 0", lineHeight: 1.5 }}>
              {lang === "en"
                ? "For sellers on Instagram, Etsy or WhatsApp — no photographer, no studio."
                : lang === "es"
                ? "Para quienes venden en Instagram, Shopee o WhatsApp — sin fotógrafo, sin estudio."
                : "Para quem vende no Instagram, Shopee ou WhatsApp — sem fotógrafo, sem estúdio."}
            </p>
          </div>

          {/* Demo carousel */}
          <DemoCarousel />
        </div>

        {/* Coluna direita — auth */}
        <div className="login-auth">
          <AuthCard />
        </div>
      </div>
    </>
  );
}

/* ─── Estilos do AuthCard ─────────────────────────── */
const a: Record<string, React.CSSProperties> = {
  card: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "28px 20px 32px",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#eef2f9",
    letterSpacing: "-0.02em",
  },
  cardSub: {
    fontSize: 13,
    color: "#8394b0",
    marginTop: -8,
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
    padding: "15px 0",
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
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
  divLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.07)",
  },
  divText: {
    color: "#4e5c72",
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  },
  emailToggle: {
    background: "transparent",
    border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: "13px 0",
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
  },
  tabActive: {
    background: "#111820",
    color: "#eef2f9",
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
