"use client";

/**
 * PushConversionAgent — mostra popup de ativação de push no momento certo.
 *
 * Gatilhos (por prioridade):
 *  1. Foto pronta (maior intenção — usuário acabou de ver resultado)
 *  2. Limite diário atingido (usuário quer mais — boa hora para engajar)
 *  3. 2ª visita ao app (usuário voltou — sinal de interesse)
 *
 * Regras anti-spam:
 *  - Não mostra se permission já granted ou denied pelo browser
 *  - Não mostra mais de 1x a cada 3 dias
 *  - Não mostra mais de 3x no total (desiste se usuário ignora sempre)
 */

import { useEffect, useRef, useState } from "react";

type Trigger = "photo_done" | "rate_limit" | "return_visit" | "processing";

interface Props {
  trigger: Trigger | null;       // gatilho ativo no momento
  onRequest: () => Promise<void>; // chama requestAndRegisterPush
  onSkip: () => void;             // chama syncPushStatus('skipped')
}

const STORAGE_KEY = "push_prompt_meta";
const MAX_SHOWS = 3;
const MIN_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

function getMeta(): { count: number; lastAt: number } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch { return { count: 0, lastAt: 0 }; }
}

function saveMeta(count: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ count, lastAt: Date.now() }));
}

function shouldShow(): boolean {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "default") return false;
  const { count = 0, lastAt = 0 } = getMeta();
  if (count >= MAX_SHOWS) return false;
  if (Date.now() - lastAt < MIN_INTERVAL_MS && count > 0) return false;
  return true;
}

const COPY: Record<Trigger, { title: string; body: string; cta: string }> = {
  processing: {
    title: "📸 Sua foto está sendo criada!",
    body: "Ativa as notificações e te avisamos na hora quando ficar pronta — mesmo com o celular bloqueado.",
    cta: "🔔 Me avisa quando ficar pronta",
  },
  photo_done: {
    title: "Sua foto ficou incrível! 🎉",
    body: "Ative as notificações e saiba na hora quando sua próxima foto estiver pronta — mesmo com o celular bloqueado.",
    cta: "Ativar notificações",
  },
  rate_limit: {
    title: "Não perde quando liberar! ⏰",
    body: "Suas fotos grátis renovam em breve. Ative as notificações e a gente te avisa na hora certa.",
    cta: "Me avisa quando liberar",
  },
  return_visit: {
    title: "Fique por dentro das novidades ✨",
    body: "Ative as notificações para saber quando sua foto ficar pronta e receber dicas exclusivas.",
    cta: "Ativar notificações",
  },
};

export default function PushConversionAgent({ trigger, onRequest, onSkip }: Props) {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!trigger || shownRef.current) return;
    if (!shouldShow()) return;

    // Pequeno delay para não aparecer junto com outra coisa
    const t = setTimeout(() => {
      shownRef.current = true;
      const { count = 0 } = getMeta();
      saveMeta(count + 1);
      setVisible(true);
    }, 1200);

    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible || !trigger) return null;

  const copy = COPY[trigger];

  async function handleAccept() {
    setVisible(false);
    await onRequest();
  }

  function handleSkip() {
    setVisible(false);
    onSkip();
  }

  return (
    <div style={s.backdrop} onClick={handleSkip}>
      <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={s.bell}>🔔</div>
        <div style={s.title}>{copy.title}</div>
        <div style={s.body}>{copy.body}</div>
        <button style={s.ctaBtn} onClick={handleAccept}>{copy.cta}</button>
        <button style={s.skipBtn} onClick={handleSkip}>Agora não</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 500,
    background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    animation: "fadeIn .2s ease",
  },
  sheet: {
    width: "100%", maxWidth: 480,
    background: "#111820",
    borderRadius: "24px 24px 0 0",
    padding: "32px 24px 40px",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 12,
    boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
    animation: "slideUp .3s ease",
  },
  bell: { fontSize: 40, marginBottom: 4 },
  title: {
    fontSize: 18, fontWeight: 800, color: "#eef2f9",
    textAlign: "center", lineHeight: 1.3,
  },
  body: {
    fontSize: 14, color: "#8394b0", textAlign: "center",
    lineHeight: 1.6, maxWidth: 340,
  },
  ctaBtn: {
    marginTop: 8,
    width: "100%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    border: "none", borderRadius: 14,
    padding: "16px", color: "#fff",
    fontSize: 15, fontWeight: 800,
    cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
  },
  skipBtn: {
    background: "transparent", border: "none",
    color: "#4e5c72", fontSize: 13, cursor: "pointer",
    padding: "8px", fontFamily: "Outfit, sans-serif",
  },
};
