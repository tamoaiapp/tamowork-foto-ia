"use client";

import { useEffect, useRef, useState } from "react";

interface JobLike {
  id: string;
  status: string | null;
}

interface Options {
  job: JobLike | null;
  user: unknown;
  fetchJobStatus: (id: string) => void;
  resetJob: () => void;
  setTimeoutError: (msg: string) => void;
}

/**
 * Gerencia polling, blur animation, tempo decorrido e timer de cancelamento
 * enquanto um job de foto estiver em andamento.
 */
export function usePhotoPolling({ job, user, fetchJobStatus, resetJob, setTimeoutError }: Options) {
  const [blurPx, setBlurPx] = useState(40);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showCancel, setShowCancel] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling a cada 10s enquanto job estiver ativo
  useEffect(() => {
    if (!job || !user) return;
    if (job.status === "done" || job.status === "failed" || job.status === "canceled") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setShowCancel(false);
      if (job.status === "failed") {
        setTimeoutError("Algo deu errado na geração. Tenta novamente.");
        resetJob();
      }
      return;
    }

    pollRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchJobStatus(job.id);
    }, 10_000);
    setShowCancel(false);
    cancelTimerRef.current = setTimeout(() => setShowCancel(true), 30_000);

    setElapsedSec(0);
    elapsedRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") setElapsedSec((s: number) => s + 1);
    }, 1000);

    // Animação de blur: começa em 40px, reduz ~0.35px/s → chega ~8px em ~90s
    setBlurPx(40);
    blurRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") setBlurPx((prev: number) => Math.max(8, prev - 0.35));
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, user]);

  function resetPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    if (blurRef.current) clearInterval(blurRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    setShowCancel(false);
    setElapsedSec(0);
    setBlurPx(40);
  }

  return { blurPx, elapsedSec, showCancel, setShowCancel, resetPolling };
}
