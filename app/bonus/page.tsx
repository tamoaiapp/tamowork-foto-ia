"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Mode = "choose" | "login" | "signup";
type Step = "form" | "success" | "already_claimed";

export default function BonusPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode: mode === "login" ? "login" : "signup" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "already_claimed") {
          setStep("already_claimed");
          return;
        }
        setError(data.error ?? "Erro ao resgatar bônus. Tente novamente.");
        return;
      }

      // Faz login automático no cliente
      await supabase.auth.signInWithPassword({ email, password });
      setStep("success");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div style={s.root}>
        <div style={s.card}>
          <div style={s.successEmoji}>🎉</div>
          <h1 style={s.successTitle}>Bônus ativado!</h1>
          <p style={s.successDesc}>
            Você ganhou <strong>30 dias de acesso PRO</strong> gratuito.
            <br />Aproveite todas as funcionalidades sem limite.
          </p>
          <div style={s.successBox}>
            <div style={s.successBoxItem}>✅ Fotos profissionais ilimitadas</div>
            <div style={s.successBoxItem}>✅ Fundo branco automático</div>
            <div style={s.successBoxItem}>✅ Vídeos animados do produto</div>
            <div style={s.successBoxItem}>✅ Catálogo com modelo</div>
          </div>
          <a href="/" style={s.btnPrimary}>
            Ir para o app →
          </a>
        </div>
      </div>
    );
  }

  // ── Bônus já resgatado ────────────────────────────────────────────────────
  if (step === "already_claimed") {
    return (
      <div style={s.root}>
        <div style={s.card}>
          <div style={s.successEmoji}>😊</div>
          <h1 style={s.successTitle}>Bônus já resgatado</h1>
          <p style={s.successDesc}>
            Você já resgatou seus 30 dias de bônus anteriormente.
            <br />Acesse o app para continuar usando.
          </p>
          <a href="/" style={s.btnPrimary}>
            Acessar o app →
          </a>
        </div>
      </div>
    );
  }

  // ── Escolha: criar conta ou já tenho conta ────────────────────────────────
  if (mode === "choose") {
    return (
      <div style={s.root}>
        <div style={s.card}>
          <div style={s.badge}>⚡ Oferta exclusiva</div>
          <div style={s.emoji}>🎁</div>
          <h1 style={s.title}>Bônus liberado!</h1>
          <p style={s.desc}>
            Você ganhou <strong>30 dias de acesso PRO gratuito</strong> no TamoWork.
            <br />Crie sua conta ou entre para ativar agora.
          </p>

          <div style={s.features}>
            <div style={s.featureItem}><span style={s.featureIcon}>📸</span> Fotos profissionais com IA</div>
            <div style={s.featureItem}><span style={s.featureIcon}>✂️</span> Remoção de fundo automática</div>
            <div style={s.featureItem}><span style={s.featureIcon}>🎬</span> Vídeos animados do produto</div>
          </div>

          <div style={s.choiceRow}>
            <button style={s.btnPrimaryEl} onClick={() => setMode("signup")}>
              Criar conta grátis
            </button>
            <button style={s.btnSecondaryEl} onClick={() => setMode("login")}>
              Já tenho conta
            </button>
          </div>

          <p style={s.footnote}>Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </div>
    );
  }

  // ── Formulário (login ou signup) ──────────────────────────────────────────
  return (
    <div style={s.root}>
      <div style={s.card}>
        <button style={s.backBtn} onClick={() => { setMode("choose"); setError(""); }}>
          ← Voltar
        </button>

        <div style={s.emoji}>🎁</div>
        <h1 style={s.title}>
          {mode === "login" ? "Entre para ativar" : "Crie sua conta"}
        </h1>
        <p style={s.desc}>
          {mode === "login"
            ? "Entre com sua conta para receber os 30 dias bônus."
            : "Crie sua conta e receba 30 dias PRO gratuitamente."}
        </p>

        <form onSubmit={handleSubmit} style={s.form}>
          <input
            style={s.input}
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            style={s.input}
            type="password"
            placeholder={mode === "signup" ? "Crie uma senha (mín. 6 caracteres)" : "Sua senha"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && <div style={s.errorBox}>{error}</div>}

          <button style={{ ...s.btnPrimaryEl, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar e ativar bônus" : "Criar conta e ativar bônus"}
          </button>
        </form>

        <button
          style={s.switchBtn}
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
        >
          {mode === "login" ? "Não tenho conta → Criar agora" : "Já tenho conta → Entrar"}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    background: "#07080b",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'Outfit', sans-serif",
  },
  card: {
    width: "100%", maxWidth: 420,
    background: "#0c1018",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 24,
    padding: "36px 28px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    textAlign: "center",
  },
  badge: {
    background: "rgba(168,85,247,0.15)",
    border: "1px solid rgba(168,85,247,0.35)",
    borderRadius: 20, padding: "5px 14px",
    fontSize: 12, fontWeight: 700, color: "#a855f7",
  },
  emoji: { fontSize: 52, lineHeight: 1 },
  successEmoji: { fontSize: 64, lineHeight: 1 },
  title: {
    fontSize: 26, fontWeight: 800, color: "#eef2f9",
    margin: 0, lineHeight: 1.2,
  },
  successTitle: {
    fontSize: 28, fontWeight: 800, color: "#eef2f9",
    margin: 0, lineHeight: 1.2,
  },
  desc: {
    fontSize: 15, color: "#8394b0", lineHeight: 1.6, margin: 0,
  },
  successDesc: {
    fontSize: 15, color: "#8394b0", lineHeight: 1.7, margin: 0,
  },
  features: {
    width: "100%", display: "flex", flexDirection: "column", gap: 10,
    background: "#111820", borderRadius: 14, padding: "16px 18px",
  },
  featureItem: {
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 14, color: "#b0bec9", textAlign: "left",
  },
  featureIcon: { fontSize: 18 },
  successBox: {
    width: "100%", display: "flex", flexDirection: "column", gap: 10,
    background: "rgba(22,199,132,0.08)",
    border: "1px solid rgba(22,199,132,0.2)",
    borderRadius: 14, padding: "16px 18px",
  },
  successBoxItem: {
    fontSize: 14, color: "#16c784", textAlign: "left",
  },
  choiceRow: {
    width: "100%", display: "flex", flexDirection: "column", gap: 10,
  },
  btnPrimary: {
    display: "block", width: "100%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14, padding: "15px",
    color: "#fff", fontSize: 16, fontWeight: 800,
    cursor: "pointer", textDecoration: "none",
    textAlign: "center",
  },
  btnPrimaryEl: {
    width: "100%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14, padding: "15px",
    color: "#fff", fontSize: 16, fontWeight: 800,
    cursor: "pointer",
  },
  btnSecondaryEl: {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14, padding: "14px",
    color: "#8394b0", fontSize: 15,
    cursor: "pointer",
  },
  footnote: {
    fontSize: 11, color: "#4e5c72", margin: 0,
  },
  backBtn: {
    alignSelf: "flex-start",
    background: "transparent", border: "none",
    color: "#8394b0", fontSize: 13, cursor: "pointer", padding: 0,
  },
  form: {
    width: "100%", display: "flex", flexDirection: "column", gap: 12,
  },
  input: {
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "14px 16px",
    color: "#eef2f9", fontSize: 15, outline: "none", width: "100%",
    boxSizing: "border-box" as const,
  },
  errorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "10px 14px",
    color: "#f87171", fontSize: 13, textAlign: "left",
  },
  switchBtn: {
    background: "transparent", border: "none",
    color: "#6366f1", fontSize: 13, cursor: "pointer",
    textDecoration: "underline",
  },
};
