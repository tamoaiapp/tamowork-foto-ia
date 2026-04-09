"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.tamowork.app";

function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export default function ConvitePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Redireciona Android para Play Store
  useEffect(() => {
    if (isAndroid()) {
      window.location.href = PLAY_STORE_URL;
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao criar conta");
        setLoading(false);
        return;
      }

      // Login automático
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) {
        setError("Conta criada! Faça login em tamowork.com");
        setLoading(false);
        return;
      }

      setSuccess(data.message);
      setTimeout(() => router.push("/"), 2000);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>TamoWork</div>
        <div style={s.logoSub}>Foto IA</div>

        <div style={s.badge}>✨ Novidade exclusiva</div>
        <h1 style={s.title}>Conheça a versão nova<br />do TamoWork</h1>
        <p style={s.sub}>
          Transforme fotos de produto em fotos profissionais com IA — em segundos.
          <br />
          <span style={{ color: "#a78bfa" }}>Crie sua conta e acesse agora.</span>
        </p>

        {/* Benefícios */}
        <div style={s.benefits}>
          {[
            { icon: "✨", text: "Fotos de produto profissionais com IA" },
            { icon: "🎬", text: "Vídeos animados do produto" },
            { icon: "⚡", text: "Fundo branco instantâneo" },
            { icon: "🎨", text: "Estilos e cenários ilimitados" },
          ].map(b => (
            <div key={b.text} style={s.benefit}>
              <span style={s.benefitIcon}>{b.icon}</span>
              <span style={s.benefitText}>{b.text}</span>
            </div>
          ))}
        </div>

        {success ? (
          <div style={s.successBox}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#eef2f9", marginBottom: 4 }}>
              {success}
            </div>
            <div style={{ fontSize: 13, color: "#8394b0" }}>Redirecionando para o app...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.inputHint}>
              Se você já tinha conta na versão antiga, use o mesmo e-mail
            </div>
            <input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={s.input}
            />
            <input
              type="password"
              placeholder="Crie uma senha (mín. 6 caracteres)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={s.input}
            />
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? "Criando conta..." : "🚀 Acessar agora"}
            </button>
            <p style={s.terms}>
              Já tem conta?{" "}
              <a href="/login" style={{ color: "#a78bfa" }}>Fazer login</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#07080b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'Outfit', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "linear-gradient(160deg, #13102a 0%, #0f1520 60%, #0c1018 100%)",
    border: "1px solid rgba(168,85,247,0.25)",
    borderRadius: 24,
    padding: "36px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    boxShadow: "0 0 60px rgba(168,85,247,0.10)",
  },
  logo: { fontSize: 20, fontWeight: 800, color: "#eef2f9", textAlign: "center" },
  logoSub: { fontSize: 12, color: "#8394b0", textAlign: "center", marginBottom: 20 },
  badge: {
    display: "inline-block",
    background: "rgba(99,102,241,0.15)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 20,
    padding: "4px 14px",
    fontSize: 13,
    color: "#a78bfa",
    fontWeight: 600,
    textAlign: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: "#eef2f9",
    textAlign: "center",
    margin: "0 0 10px",
    lineHeight: 1.2,
  },
  sub: {
    fontSize: 14,
    color: "#8394b0",
    textAlign: "center",
    lineHeight: 1.6,
    margin: "0 0 20px",
  },
  benefits: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 24,
    background: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: "14px 16px",
  },
  benefit: { display: "flex", alignItems: "center", gap: 10 },
  benefitIcon: { fontSize: 16, width: 22, textAlign: "center" },
  benefitText: { fontSize: 13, color: "#c4b5fd", fontWeight: 500 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  inputHint: {
    fontSize: 12,
    color: "#a78bfa",
    textAlign: "center" as const,
    background: "rgba(167,139,250,0.08)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 8,
    padding: "7px 12px",
  },
  input: {
    background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 15,
    color: "#eef2f9",
    outline: "none",
    fontFamily: "'Outfit', sans-serif",
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    color: "#fca5a5",
  },
  btn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },
  terms: { fontSize: 13, color: "#8394b0", textAlign: "center", margin: "4px 0 0" },
  successBox: {
    textAlign: "center",
    padding: "24px",
    background: "rgba(22,199,132,0.08)",
    border: "1px solid rgba(22,199,132,0.2)",
    borderRadius: 14,
  },
};
