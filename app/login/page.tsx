"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useI18n, LangSelector } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
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
      <div style={{ position: "absolute", top: 16, right: 16 }}><LangSelector /></div>
      {/* Logo area */}
      <div style={s.logoArea}>
        <div style={s.logo}>TamoWork</div>
        <div style={s.tagline}>{t("login_tagline")}</div>
      </div>

      <div style={s.card}>
        {/* Tabs */}
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(mode === "login" ? s.tabActive : {}) }} onClick={() => setMode("login")}>
            {t("login_enter")}
          </button>
          <button style={{ ...s.tab, ...(mode === "signup" ? s.tabActive : {}) }} onClick={() => setMode("signup")}>
            {t("login_create_account")}
          </button>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <input type="email" placeholder={t("login_email")} value={email}
            onChange={(e) => setEmail(e.target.value)} required style={s.input} />
          <input type="password" placeholder={t("login_password")} value={password}
            onChange={(e) => setPassword(e.target.value)} required style={s.input} />

          {error && <div style={s.error}>{error}</div>}
          {msg && <div style={s.success}>{msg}</div>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? t("loading") : mode === "login" ? t("login_enter") : t("login_create_account")}
          </button>
        </form>
      </div>

      <div style={s.footer}>
        Ao entrar, você concorda com nossos termos de uso.
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
    justifyContent: "center",
    padding: "24px",
    gap: 24,
  },
  logoArea: {
    textAlign: "center",
  },
  logo: {
    fontSize: 28,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: 6,
    letterSpacing: "-0.5px",
  },
  tagline: {
    color: "#8394b0",
    fontSize: 14,
  },
  card: {
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 22,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 380,
  },
  googleBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 0",
    color: "#1a1a2e",
    fontSize: 15,
    fontWeight: 600,
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
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "20px 0",
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
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
    background: "#0c1018",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: "#8394b0",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "#1a2535",
    color: "#eef2f9",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    background: "#0c1018",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#eef2f9",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none",
    borderRadius: 14,
    padding: "13px 0",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    marginTop: 4,
    cursor: "pointer",
    width: "100%",
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#f87171",
    fontSize: 13,
  },
  success: {
    background: "rgba(22,199,132,0.1)",
    border: "1px solid rgba(22,199,132,0.3)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#16c784",
    fontSize: 13,
  },
  footer: {
    color: "#4e5c72",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 300,
  },
};
