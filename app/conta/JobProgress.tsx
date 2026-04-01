"use client";

import { useEffect, useState, useCallback } from "react";

interface ProgressData {
  status: string;
  position: number;
  queueSize: number;
  estimatedSeconds: number;
  progress: number;
  phase: string;
  output_image_url?: string;
}

interface Props {
  jobId: string;
  token: string;
  onDone: (outputUrl: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  queued:     "Na fila...",
  submitted:  "Enviando para IA...",
  processing: "Gerando imagem...",
  done:       "Pronto!",
  failed:     "Erro",
  canceled:   "Cancelado",
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return "alguns segundos";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
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

  // Polling: a cada 4s enquanto não terminar
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

  // Animação suave da barra de progresso
  useEffect(() => {
    if (!data) return;
    const target = data.progress;
    const step = () => {
      setDisplayProgress((prev) => {
        if (Math.abs(prev - target) < 1) return target;
        return prev + (target - prev) * 0.12;
      });
    };
    const timer = setInterval(step, 50);
    return () => clearInterval(timer);
  }, [data?.progress]);

  if (!data) {
    return (
      <div style={s.wrap}>
        <div style={s.label}>Verificando...</div>
        <div style={s.barBg}><div style={{ ...s.barFill, width: "5%" }} /></div>
      </div>
    );
  }

  const { status, position, estimatedSeconds, phase } = data;
  const isDone = status === "done";
  const isFailed = status === "failed" || status === "canceled";

  if (isDone) return null; // onDone já foi chamado, o pai vai renderizar a imagem

  return (
    <div style={s.wrap}>
      {/* Label da fase */}
      <div style={s.header}>
        <span style={{ ...s.label, color: isFailed ? "#f87171" : "#eef2f9" }}>
          {PHASE_LABELS[phase] ?? phase}
        </span>
        {!isFailed && (
          <span style={s.percent}>{Math.round(displayProgress)}%</span>
        )}
      </div>

      {/* Barra de progresso */}
      {!isFailed && (
        <div style={s.barBg}>
          <div
            style={{
              ...s.barFill,
              width: `${displayProgress}%`,
              background: displayProgress > 80
                ? "linear-gradient(90deg, #6366f1, #22c55e)"
                : "linear-gradient(90deg, #6366f1, #a855f7)",
            }}
          />
        </div>
      )}

      {/* Info de fila */}
      {phase === "queued" && position > 0 && (
        <div style={s.info}>
          <span style={s.infoItem}>
            📋 <strong style={{ color: "#eef2f9" }}>{position}</strong> na fila
          </span>
          {estimatedSeconds > 0 && (
            <span style={s.infoItem}>
              ⏱ Aprox. <strong style={{ color: "#eef2f9" }}>{formatTime(estimatedSeconds)}</strong>
            </span>
          )}
        </div>
      )}

      {phase === "processing" && estimatedSeconds > 0 && (
        <div style={s.info}>
          <span style={s.infoItem}>
            ⏱ Falta aprox. <strong style={{ color: "#eef2f9" }}>{formatTime(estimatedSeconds)}</strong>
          </span>
        </div>
      )}

      {phase === "submitted" && (
        <div style={s.info}>
          <span style={s.infoItem}>Enviando imagem para processamento...</span>
        </div>
      )}
    </div>
  );
}

const PURPLE = "#a855f7";

const s: Record<string, React.CSSProperties> = {
  wrap: {
    padding: "12px 0 4px",
    width: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#eef2f9",
  },
  percent: {
    fontSize: 13,
    fontWeight: 700,
    color: PURPLE,
  },
  barBg: {
    width: "100%",
    height: 6,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
    transition: "width 0.3s ease",
    background: `linear-gradient(90deg, #6366f1, ${PURPLE})`,
  },
  info: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  infoItem: {
    fontSize: 12,
    color: "#8394b0",
  },
};
