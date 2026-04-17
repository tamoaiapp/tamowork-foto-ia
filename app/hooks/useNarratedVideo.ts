"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth/getToken";

type NarratedJob = {
  id: string;
  status: string;
  output_video_url?: string;
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
 * Gerencia estado e polling do job de vídeo narrado.
 * Faz polling a cada 15s enquanto o job estiver ativo.
 * Envia push notification ao concluir.
 */
export function useNarratedVideo({ user }: Options) {
  const [narratedJob, setNarratedJob] = useState<NarratedJob | null>(null);
  const [narratedRoteiro, setNarratedRoteiro] = useState("");
  const [narratedSubmitting, setNarratedSubmitting] = useState(false);
  const [narratedError, setNarratedError] = useState("");
  const [narratedElapsed, setNarratedElapsed] = useState(0);
  const [narratedVoice, setNarratedVoice] = useState<"feminino" | "masculino">("feminino");
  const [narratedMode, setNarratedMode] = useState(false);
  const [narratedDisplayProgress, setNarratedDisplayProgress] = useState(0);
  const [narratedSceneSource, setNarratedSceneSource] = useState<"generate" | "existing">("generate");
  const [narratedDonePhotos, setNarratedDonePhotos] = useState<{ id: string; output_image_url: string }[]>([]);
  const [narratedSelectedScenes, setNarratedSelectedScenes] = useState<string[]>([]);

  const narratedPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const narratedElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling a cada 15s enquanto job estiver ativo
  useEffect(() => {
    if (!narratedJob || !user) return;
    if (["done", "failed", "canceled"].includes(narratedJob.status)) {
      if (narratedPollRef.current) clearInterval(narratedPollRef.current);
      if (narratedElapsedRef.current) clearInterval(narratedElapsedRef.current);
      if (narratedJob.status === "done") {
        sendPush("Seu vídeo com narração está pronto! 🎙️", "Toque para ver o vídeo.");
        setNarratedMode(true);
      }
      if (narratedJob.status === "failed") {
        setNarratedMode(false);
      }
      return;
    }
    setNarratedElapsed(0);
    narratedElapsedRef.current = setInterval(() => setNarratedElapsed((s: number) => s + 1), 1000);
    narratedPollRef.current = setInterval(async () => {
      const token = await getToken();
      const res = await fetch(`/api/narrated-video/${narratedJob.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setNarratedJob(await res.json());
    }, 15_000);
    return () => {
      if (narratedPollRef.current) clearInterval(narratedPollRef.current);
      if (narratedElapsedRef.current) clearInterval(narratedElapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narratedJob?.id, narratedJob?.status, user]);

  // Animação da barra de narração (máx 90% em ~5min)
  useEffect(() => {
    const MAX_SEC = 300;
    const target = Math.min(90, Math.round((narratedElapsed / MAX_SEC) * 90));
    setNarratedDisplayProgress((prev: number) => prev + (target - prev) * 0.08);
  }, [narratedElapsed]);

  function resetNarratedVideo() {
    if (narratedPollRef.current) clearInterval(narratedPollRef.current);
    if (narratedElapsedRef.current) clearInterval(narratedElapsedRef.current);
    setNarratedJob(null);
    setNarratedRoteiro("");
    setNarratedError("");
    setNarratedElapsed(0);
    setNarratedDisplayProgress(0);
    setNarratedMode(false);
    setNarratedVoice("feminino");
    setNarratedSceneSource("generate");
    setNarratedSelectedScenes([]);
  }

  return {
    narratedJob, setNarratedJob,
    narratedRoteiro, setNarratedRoteiro,
    narratedSubmitting, setNarratedSubmitting,
    narratedError, setNarratedError,
    narratedElapsed,
    narratedVoice, setNarratedVoice,
    narratedMode, setNarratedMode,
    narratedDisplayProgress,
    narratedSceneSource, setNarratedSceneSource,
    narratedDonePhotos, setNarratedDonePhotos,
    narratedSelectedScenes, setNarratedSelectedScenes,
    resetNarratedVideo,
  };
}
