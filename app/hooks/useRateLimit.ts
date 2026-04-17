"use client";

import { useEffect, useState } from "react";

type Plan = "free" | "pro";

interface JobLike {
  id: string;
  status: string | null;
  created_at?: string;
}

function useCountdown(target: Date | null): number {
  const [remaining, setRemaining] = useState<number>(() =>
    target ? Math.max(0, target.getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!target) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

/**
 * Gerencia o rate limit FREE: ativa cooldown de 24h quando o job fica pronto,
 * e limpa o cooldown quando o countdown chega a zero.
 * Inclui o countdown derivado de rateLimitedUntil.
 */
export function useRateLimit(plan: Plan, job: JobLike | null) {
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);
  const countdown = useCountdown(rateLimitedUntil);

  // Quando job termina (done) no plano free, ativa cooldown de 24h
  useEffect(() => {
    if (plan === "free" && job?.status === "done" && job.id !== "rate_limited") {
      const jobTime = job.created_at ? new Date(job.created_at).getTime() : Date.now();
      const next = new Date(jobTime + 24 * 60 * 60 * 1000);
      if (next > new Date()) setRateLimitedUntil(next);
    }
  }, [job?.status, plan]);

  // Quando countdown chega a 0 E o prazo já passou de fato, limpa rate limit
  useEffect(() => {
    if (rateLimitedUntil && countdown === 0 && rateLimitedUntil.getTime() <= Date.now()) {
      setRateLimitedUntil(null);
    }
  }, [countdown, rateLimitedUntil]);

  return { rateLimitedUntil, setRateLimitedUntil, countdown };
}
