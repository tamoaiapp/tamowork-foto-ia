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

export default function JobProgress({ jobId, token, onDone }: Props) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);

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

      <div style={s.closeMsg}>
        {typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
          ? "Pode fechar o app — te avisamos quando estiver pronto 🔔"
          : "Processando sua foto..."}
      </div>
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
  error: {
    fontSize: 12,
    color: "#f87171",
    paddingTop: 6,
  },
};
