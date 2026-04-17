"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { getToken } from "@/lib/auth/getToken";

interface VideoJob {
  id: string;
  status: string | null;
  output_video_url?: string;
  input_image_url?: string;
  error_message?: string;
  created_at?: string;
}

interface Options {
  user: unknown;
  notifiedJobsRef: MutableRefObject<Set<string>>;
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
 * Gerencia estado e polling do job de vídeo curto.
 * Faz polling a cada 15s enquanto o job estiver ativo.
 * Envia push notification ao concluir.
 */
export function useVideoJob({ user, notifiedJobsRef }: Options) {
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);
  const [videoElapsedSec, setVideoElapsedSec] = useState(0);
  const [videoDisplayProgress, setVideoDisplayProgress] = useState(0);
  const [videoMode, setVideoMode] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoSubmitting, setVideoSubmitting] = useState(false);

  const videoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchVideoStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/video-jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    setVideoJob(await res.json());
  }

  // Polling a cada 15s enquanto job estiver ativo
  useEffect(() => {
    if (!videoJob || !user) return;
    if (["done", "failed", "canceled"].includes(videoJob.status ?? "")) {
      if (videoPollRef.current) clearInterval(videoPollRef.current);
      if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
      if (videoJob.status === "done") {
        if (!notifiedJobsRef.current.has(videoJob.id)) {
          notifiedJobsRef.current.add(videoJob.id);
          sendPush("Seu vídeo está pronto! 🎬", "Toque para ver o vídeo gerado.");
        }
        setVideoMode(true);
      }
      if (videoJob.status === "failed") {
        setVideoMode(false);
      }
      return;
    }
    setVideoElapsedSec(0);
    videoElapsedRef.current = setInterval(() => setVideoElapsedSec((s: number) => s + 1), 1000);
    videoPollRef.current = setInterval(() => fetchVideoStatus(videoJob.id), 15_000);
    return () => {
      if (videoPollRef.current) clearInterval(videoPollRef.current);
      if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoJob?.id, videoJob?.status, user]);

  // Animação suave da barra de vídeo (máx 90% em ~4min)
  useEffect(() => {
    const MAX_SEC = 240;
    const target = Math.min(90, Math.round((videoElapsedSec / MAX_SEC) * 90));
    setVideoDisplayProgress((prev: number) => prev + (target - prev) * 0.08);
  }, [videoElapsedSec]);

  function resetVideoJob() {
    if (videoPollRef.current) clearInterval(videoPollRef.current);
    if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
    setVideoMode(false);
    setVideoJob(null);
    setVideoError("");
    setVideoElapsedSec(0);
    setVideoDisplayProgress(0);
  }

  return {
    videoJob, setVideoJob,
    videoElapsedSec,
    videoDisplayProgress,
    videoMode, setVideoMode,
    videoError, setVideoError,
    videoSubmitting, setVideoSubmitting,
    fetchVideoStatus,
    resetVideoJob,
  };
}
