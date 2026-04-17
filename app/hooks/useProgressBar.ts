"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth/getToken";

/**
 * Gerencia a barra de progresso da geração de foto.
 * Faz polling a cada 4s enquanto o job estiver ativo,
 * e anima suavemente o valor exibido.
 */
export function useProgressBar(jobId: string | undefined, jobStatus: string | undefined) {
  const [progressVal, setProgressVal] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  async function fetchProgress(id: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${id}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setProgressVal(data.progress ?? 0);
  }

  // Poll progress enquanto job estiver ativo
  useEffect(() => {
    const activeStatuses = ["queued", "submitted", "processing"];
    if (!jobId || !activeStatuses.includes(jobStatus ?? "")) return;
    fetchProgress(jobId);
    const iv = setInterval(() => fetchProgress(jobId), 4000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, jobStatus]);

  // Animação suave do valor exibido
  useEffect(() => {
    const iv = setInterval(() => {
      setDisplayProgress((prev: number) => {
        if (Math.abs(prev - progressVal) < 1) return progressVal;
        return prev + (progressVal - prev) * 0.12;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [progressVal]);

  function resetProgress() {
    setProgressVal(0);
    setDisplayProgress(0);
  }

  return { progressVal, displayProgress, resetProgress };
}
