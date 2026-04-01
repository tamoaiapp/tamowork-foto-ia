"use client";

import { useEffect, useState, useCallback } from "react";

const VAPID_PUBLIC_KEY = "BOFpGK6deSOtMczLOppZ8RXLb8XbAP0cs4hDHOZtJrDsnLhvzdPQXeojc5CohPhnj0PvNkPd7B7HKLtUva03cGk";

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

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribePush(token: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return true;
  } catch {
    return false;
  }
}

export default function JobProgress({ jobId, token, prompt, onDone }: Props) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [notifStatus, setNotifStatus] = useState<"unknown" | "granted" | "denied">("unknown");

  useEffect(() => {
    if (!("Notification" in window)) { setNotifStatus("denied"); return; }
    if (Notification.permission === "granted") setNotifStatus("granted");
  }, []);

  async function handleEnableNotif() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifStatus("granted");
      await subscribePush(token);
    } else {
      setNotifStatus("denied");
    }
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

      {/* Mensagem + botão notificação */}
      {notifStatus === "granted" ? (
        <div style={s.closeMsg}>
          Pode fechar o app — te avisamos quando estiver pronto 🔔
        </div>
      ) : notifStatus === "denied" ? (
        <div style={s.closeMsg}>
          Pode fechar o app — atualize a página quando voltar para ver o resultado
        </div>
      ) : (
        <div style={s.notifRow}>
          <span style={s.closeMsg}>Pode fechar o app —</span>
          <button onClick={handleEnableNotif} style={s.notifBtn}>
            🔔 ativar aviso quando ficar pronto
          </button>
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
  },
  notifRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  notifBtn: {
    background: "none",
    border: "none",
    color: "#a855f7",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
  error: {
    fontSize: 12,
    color: "#f87171",
    paddingTop: 6,
  },
};
