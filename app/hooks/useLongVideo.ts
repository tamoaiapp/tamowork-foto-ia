"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth/getToken";

type LongVideoJob = {
  id: string;
  status: string;
  output_video_url?: string;
  clip_urls?: string[];
  error_message?: string;
  created_at?: string;
};

interface Options {
  user: unknown;
}

async function sendPush(title: string, body: string) {
  try {
    const tok = await getToken();
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title, body, url: "/" }),
    });
  } catch { /* silencioso */ }
}

/**
 * Gerencia estado e polling do job de vídeo longo.
 * Faz polling a cada 30s enquanto o job estiver ativo.
 * Envia push notification ao concluir.
 */
export function useLongVideo({ user }: Options) {
  const [longVideoJob, setLongVideoJob] = useState<LongVideoJob | null>(null);
  const [longVideoMode, setLongVideoMode] = useState(false);
  const [longVideoSubmitting, setLongVideoSubmitting] = useState(false);
  const [longVideoError, setLongVideoError] = useState("");
  const [longVideoElapsed, setLongVideoElapsed] = useState(0);

  const longVideoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longVideoElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling a cada 30s enquanto job estiver ativo
  useEffect(() => {
    if (!longVideoJob || !user) return;
    if (["done", "failed", "canceled"].includes(longVideoJob.status)) {
      if (longVideoPollRef.current) clearInterval(longVideoPollRef.current);
      if (longVideoElapsedRef.current) clearInterval(longVideoElapsedRef.current);
      if (longVideoJob.status === "done") {
        sendPush("Seu vídeo longo está pronto! 🎬", "Toque para ver o vídeo.");
        setLongVideoMode(true);
      }
      if (longVideoJob.status === "failed") setLongVideoMode(false);
      return;
    }
    longVideoElapsedRef.current = setInterval(() => setLongVideoElapsed((s: number) => s + 1), 1000);
    longVideoPollRef.current = setInterval(async () => {
      const t = await getToken();
      const r = await fetch(`/api/long-video/${longVideoJob.id}`, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) return;
      const d = await r.json() as LongVideoJob;
      setLongVideoJob(d);
    }, 30_000);
    return () => {
      if (longVideoPollRef.current) clearInterval(longVideoPollRef.current);
      if (longVideoElapsedRef.current) clearInterval(longVideoElapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [longVideoJob?.id, longVideoJob?.status, user]);

  function resetLongVideoJob() {
    if (longVideoPollRef.current) clearInterval(longVideoPollRef.current);
    if (longVideoElapsedRef.current) clearInterval(longVideoElapsedRef.current);
    setLongVideoJob(null);
    setLongVideoMode(false);
    setLongVideoError("");
    setLongVideoElapsed(0);
  }

  return {
    longVideoJob, setLongVideoJob,
    longVideoMode, setLongVideoMode,
    longVideoSubmitting, setLongVideoSubmitting,
    longVideoError, setLongVideoError,
    longVideoElapsed,
    resetLongVideoJob,
  };
}
