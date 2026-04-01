"use client";

import { useEffect, useState, useCallback } from "react";

interface ProgressData {
  status: string;
  progress: number;
  output_image_url?: string;
}

interface Props {
  jobId: string;
  token: string;
  prompt?: string;
  onDone: (outputUrl: string) => void;
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function fireNotification(prompt?: string) {
  if (!("serviceWorker" in navigator)) return;
  // Extrai nome do produto do prompt (antes de " | cenário:")
  const product = prompt?.split(" | cenário:")[0]?.trim() ?? "";
  const title = product
    ? `Foto de ${product} pronta! ✨`
    : "Sua foto ficou pronta! ✨";
  const body = "Toque para ver o resultado no TamoWork.";
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: "NOTIFY_DONE", title, body });
  });
}

export default function JobProgress({ jobId, token, prompt, onDone }: Props) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [notifStatus, setNotifStatus] = useState<"unknown" | "granted" | "denied">("unknown");

  // Detecta estado atual de notificação
  useEffect(() => {
    if (!("Notification" in window)) { setNotifStatus("denied"); return; }
    setNotifStatus(Notification.permission === "granted" ? "granted" : "unknown");
  }, []);

  async function handleEnableNotif() {
    const ok = await requestNotificationPermission();
    setNotifStatus(ok ? "granted" : "denied");
  }

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/image-jobs/${jobId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json: ProgressData = await res.json();
      setData(json);
      if (json.status === "done" && json.output_image_url) {
        fireNotification(prompt);
        onDone(json.output_image_url);
      }
    } catch {
      // silencioso
    }
  }, [jobId, token, onDone]);

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(() => {
      if (data?.status === "done" || data?.status === "failed" || data?.status === "canceled") {
        clearInterval(interval);
        return;
      }
      fetchProgress();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchProgress, data?.status]);

  // Animação suave
  useEffect(() => {
    if (!data) return;
    const target = data.progress;
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (Math.abs(prev - target) < 1) return target;
        return prev + (target - prev) * 0.12;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [data?.progress]);

  if (!data || data.status === "done") return null;

  if (data.status === "failed" || data.status === "canceled") {
    return <div style={s.error}>Erro ao processar. Tente novamente.</div>;
  }

  return (
    <div style={s.wrap}>
      {/* Barra */}
      <div style={s.barBg}>
        <div style={{
          ...s.barFill,
          width: `${displayProgress}%`,
          background: displayProgress > 80
            ? "linear-gradient(90deg, #6366f1, #22c55e)"
            : "linear-gradient(90deg, #6366f1, #a855f7)",
        }} />
      </div>

      {/* Pode fechar */}
      <div style={s.closeMsg}>
        Pode fechar o app — te avisamos quando estiver pronto
      </div>

      {/* Pedir notificação se ainda não concedida */}
      {notifStatus === "unknown" && (
        <button onClick={handleEnableNotif} style={s.notifBtn}>
          🔔 Ativar notificações
        </button>
      )}
      {notifStatus === "denied" && (
        <div style={s.notifOff}>
          Notificações bloqueadas — ative nas configurações do navegador
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    paddingTop: 10,
    width: "100%",
  },
  barBg: {
    width: "100%",
    height: 5,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
    transition: "width 0.4s ease",
  },
  closeMsg: {
    fontSize: 11,
    color: "#8394b0",
    marginBottom: 6,
  },
  notifBtn: {
    background: "rgba(168,85,247,0.12)",
    border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 8,
    color: "#a855f7",
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    cursor: "pointer",
    marginTop: 2,
  },
  notifOff: {
    fontSize: 11,
    color: "#4e5c72",
    marginTop: 2,
  },
  error: {
    fontSize: 12,
    color: "#f87171",
    paddingTop: 6,
  },
};
