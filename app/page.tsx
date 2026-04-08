"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import BottomNav from "@/app/components/BottomNav";
import ModeSelector, { type CreationMode } from "@/app/components/ModeSelector";
import dynamic from "next/dynamic";
import { useI18n, LangSelector } from "@/lib/i18n";
const PhotoEditor = dynamic(() => import("@/app/components/PhotoEditor"), { ssr: false });
const PromoCreator = dynamic(() => import("@/app/components/PromoCreator"), { ssr: false });

type JobStatus = "queued" | "submitted" | "processing" | "done" | "failed" | "canceled" | null;
type Plan = "free" | "pro";
// State machine explícito: sem_trabalho | trabalhando | terminado
type WorkState = "sem_trabalho" | "trabalhando" | "terminado";

function deriveWorkState(job: { status: JobStatus; output_image_url?: string } | null): WorkState {
  if (!job) return "sem_trabalho";
  if (job.status === "done" && job.output_image_url) return "terminado";
  if (job.status === "queued" || job.status === "submitted" || job.status === "processing") return "trabalhando";
  return "sem_trabalho"; // failed, canceled, ou done sem imagem
}

interface Job {
  id: string;
  status: JobStatus;
  output_image_url?: string;
  input_image_url?: string;
  error_message?: string;
  created_at?: string;
}

interface VideoJob {
  id: string;
  status: JobStatus;
  output_video_url?: string;
  input_image_url?: string;
  error_message?: string;
  created_at?: string;
}

function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

function formatMs(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const BASE_CATALOG = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/catalog";

const CATALOG_GROUPS = [
  {
    label: "Mulheres",
    models: [
      { id: "mulher1", label: "Mulher 1", url: `${BASE_CATALOG}/mulher1.jpg` },
      { id: "mulher2", label: "Mulher 2", url: `${BASE_CATALOG}/mulher2.jpg` },
    ],
  },
  {
    label: "Homens",
    models: [
      { id: "homem1", label: "Homem 1", url: `${BASE_CATALOG}/homem1.jpg` },
      { id: "homem2", label: "Homem 2", url: `${BASE_CATALOG}/homem2.jpg` },
    ],
  },
  {
    label: "Crianças",
    models: [
      { id: "crianca_menino", label: "Menino", url: `${BASE_CATALOG}/crianca_menino.jpg` },
      { id: "crianca_menina", label: "Menina", url: `${BASE_CATALOG}/crianca_menina.jpg` },
    ],
  },
  {
    label: "Bebês",
    models: [
      { id: "bebe_menino", label: "Bebê M", url: `${BASE_CATALOG}/bebe_menino.jpg` },
      { id: "bebe_menina", label: "Bebê F", url: `${BASE_CATALOG}/bebe_menina.jpg` },
    ],
  },
];

function CatalogModelPicker({
  selected, onSelect, onCustom,
}: { selected: string | null; onSelect: (url: string) => void; onCustom: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {CATALOG_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8394b0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            {group.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {group.models.map(m => (
              <div
                key={m.id}
                onClick={() => onSelect(m.url)}
                style={{
                  borderRadius: 12, overflow: "hidden", cursor: "pointer",
                  border: selected === m.url ? "2.5px solid #a855f7" : "2px solid rgba(255,255,255,0.07)",
                  aspectRatio: "3/4", position: "relative",
                  boxShadow: selected === m.url ? "0 0 0 3px rgba(168,85,247,0.25)" : "none",
                  transition: "border-color 0.15s",
                }}
              >
                <img src={m.url} alt={m.label} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
                {selected === m.url && (
                  <div style={{
                    position: "absolute", top: 4, right: 4,
                    background: "#a855f7", borderRadius: "50%",
                    width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff", fontWeight: 800,
                  }}>✓</div>
                )}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                  padding: "8px 4px 4px", fontSize: 9, fontWeight: 700,
                  color: "rgba(255,255,255,0.9)", textAlign: "center",
                }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onCustom}
        style={{
          background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.15)",
          borderRadius: 12, padding: "10px", color: "#8394b0",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        📷 Usar minha própria foto
      </button>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan>("free");

  // Form
  const [produto, setProduto] = useState("");
  const [cenario, setCenario] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Catálogo: foto do modelo
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const modelFileRef = useRef<HTMLInputElement>(null);

  // Job state
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [formError, setFormError] = useState("");
  const [timeoutError, setTimeoutError] = useState("");
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blur animation: decreases from 40px to 8px over ~90s
  const [blurPx, setBlurPx] = useState(40);
  const blurRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tempo decorrido desde início da geração
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress bar
  const [progressVal, setProgressVal] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Creation mode
  const [creationMode, setCreationMode] = useState<CreationMode>("simulacao");
  const [modeSelected, setModeSelected] = useState(false); // true = mostra form, false = mostra menu

  // Photo editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);

  // Video state
  const [videoMode, setVideoMode] = useState(false);
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoSubmitting, setVideoSubmitting] = useState(false);
  const [videoError, setVideoError] = useState("");
  const videoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [videoElapsedSec, setVideoElapsedSec] = useState(0);
  const [videoDisplayProgress, setVideoDisplayProgress] = useState(0);
  const videoElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const countdown = useCountdown(rateLimitedUntil);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? "";
      const res = await fetch("/api/image-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // API retorna { jobs, plan }
        const jobs: Job[] = Array.isArray(data) ? data : (data.jobs ?? []);
        const userPlan: Plan = data.plan ?? "free";
        setPlan(userPlan);

        const active = jobs.find(
          (j) => j.status !== "done" && j.status !== "failed" && j.status !== "canceled"
        );
        if (active) {
          setJob(active);
          if (active.input_image_url) setPreview(active.input_image_url);
          setModeSelected(true);
        } else {
          // Restaura o job done mais recente (criado nas últimas 3h) para mostrar resultado
          const recentDone = jobs.find(
            (j) => j.status === "done" && j.output_image_url &&
            new Date(j.created_at ?? 0).getTime() > Date.now() - 3 * 60 * 60 * 1000
          );
          if (recentDone) setJob(recentDone);
        }

        // Detecta rate limit no carregamento: free user com job recente (<3h)
        if (userPlan === "free") {
          const FREE_COOLDOWN_MS = 3 * 60 * 60 * 1000;
          const lastJob = jobs
            .filter((j) => j.status !== "canceled")
            .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];
          if (lastJob?.created_at) {
            const nextAvailable = new Date(new Date(lastJob.created_at).getTime() + FREE_COOLDOWN_MS);
            if (nextAvailable > new Date()) {
              setRateLimitedUntil(nextAvailable);
            }
          }
        }
      }

      // Restaura estado de vídeo ao recarregar a página
      const vres = await fetch("/api/video-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (vres.ok) {
        const vdata: VideoJob[] = await vres.json();
        const activeVideo = vdata.find(
          (v) => v.status !== "done" && v.status !== "failed" && v.status !== "canceled"
        );
        // Só restaura vídeo done se foi criado nas últimas 24h
        const doneVideo = vdata.find(
          (v) => v.status === "done" &&
          new Date(v.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );
        if (activeVideo) {
          setVideoJob(activeVideo);
          setVideoMode(true);
        } else if (doneVideo) {
          setVideoJob(doneVideo);
          setVideoMode(true);
        }
      }

      // Vindo de Criações: abrir modo vídeo para um job específico
      const videoFromJob = sessionStorage.getItem("video_from_job");
      if (videoFromJob) {
        sessionStorage.removeItem("video_from_job");
        const { data: session2 } = await supabase.auth.getSession();
        const t2 = session2.session?.access_token ?? "";
        const jr = await fetch(`/api/image-jobs/${videoFromJob}`, { headers: { Authorization: `Bearer ${t2}` } });
        if (jr.ok) {
          const j = await jr.json();
          if (j.status === "done" && j.output_image_url) {
            setJob(j);
            setModeSelected(true);
            setVideoMode(true);
          }
        }
      }

      setLoading(false);
    });
  }, [router]);

  // Polling a cada 10s enquanto job estiver ativo
  useEffect(() => {
    if (!job || !user) return;
    if (job.status === "done" || job.status === "failed" || job.status === "canceled") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setShowCancel(false);
      // Se falhou, reseta automaticamente para o formulário com mensagem de erro
      if (job.status === "failed") {
        setTimeoutError("Algo deu errado na geração. Tenta novamente.");
        resetJob();
      }
      return;
    }

    pollRef.current = setInterval(() => fetchJobStatus(job.id), 10_000);
    setShowCancel(false);
    cancelTimerRef.current = setTimeout(() => setShowCancel(true), 30_000);

    // Tempo decorrido
    setElapsedSec(0);
    elapsedRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);

    // Animação de blur: começa em 40px, reduz ~0.35px/s → chega ~8px em ~90s
    setBlurPx(40);
    blurRef.current = setInterval(() => {
      setBlurPx((prev) => Math.max(8, prev - 0.35));
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (blurRef.current) clearInterval(blurRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, user]);

  // Countdown: quando chegar a 0, limpar rate limit
  useEffect(() => {
    if (rateLimitedUntil && countdown === 0) {
      setRateLimitedUntil(null);
    }
  }, [countdown, rateLimitedUntil]);

  // Timeout automático: usa created_at do job para não resetar ao reabrir o app
  useEffect(() => {
    if (!job || workState !== "trabalhando") return;
    const status = job.status;
    // queued/submitted: até 90 min (fila pode ter muitos jobs)
    // processing: 15 min (já está rodando, não deve demorar tanto)
    const limitSec = (status === "queued" || status === "submitted") ? 5400 : 900;
    // Se temos created_at, calcula elapsed real; senão usa o contador local
    const realElapsed = job.created_at
      ? Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000)
      : elapsedSec;
    if (realElapsed >= limitSec) {
      const msg = (status === "queued" || status === "submitted")
        ? "Algo deu errado — o servidor não conseguiu processar. Tenta novamente."
        : "Algo deu errado — a geração demorou demais. Tenta novamente.";
      setTimeoutError(msg);
      getToken().then(token => {
        if (job.id) fetch(`/api/image-jobs/${job.id}/cancel`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      });
      resetJob();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, job?.id]);

  // Fallback: refresh ao voltar do background
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && job?.id && job.status !== "done" && job.status !== "failed") {
        fetchJobStatus(job.id);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? "";
    // Se token expirou (exp no passado), forçar refresh
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp && payload.exp * 1000 < Date.now() + 60_000) {
          const { data: r } = await supabase.auth.refreshSession();
          return r.session?.access_token ?? token;
        }
      } catch { /* ignora erro de parse */ }
    }
    return token;
  }

  async function requestNotificationPermission() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
  }

  function sendNotification(title: string, body: string) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    n.onclick = () => { window.focus(); n.close(); };
  }

  async function fetchJobStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data: Job = await res.json();
    if (data.status === "done") sendNotification("Sua foto está pronta! 🎉", "Clique para ver a imagem gerada pela IA.");
    else if (data.status === "failed") sendNotification("Erro na geração", "Não foi possível gerar a foto. Tente novamente.");
    setJob(data);
  }

  async function fetchProgress(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${jobId}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setProgressVal(data.progress ?? 0);
  }

  // Poll progress
  useEffect(() => {
    const activeStatuses = ["queued", "submitted", "processing"];
    if (!job?.id || !activeStatuses.includes(job.status ?? "")) return;
    fetchProgress(job.id);
    const iv = setInterval(() => fetchProgress(job.id), 4000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  // Smooth progress animation
  useEffect(() => {
    const iv = setInterval(() => {
      setDisplayProgress((prev) => {
        if (Math.abs(prev - progressVal) < 1) return progressVal;
        return prev + (progressVal - prev) * 0.12;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [progressVal]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) setPreview(URL.createObjectURL(file));
    else setPreview(null);
  }

  async function convertToJpegIfNeeded(file: File): Promise<File> {
    const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
    if (!isHeic) return file;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" }));
          else resolve(file);
        }, "image/jpeg", 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Modo vídeo: rota separada
    if (creationMode === "video") {
      if (!imageFile) { setFormError("Envie uma foto"); return; }
      setFormError("");
      setVideoError("");
      try {
        const token = await getToken();
        const fileToUpload = await convertToJpegIfNeeded(imageFile);
        const form = new FormData();
        form.append("file", fileToUpload);
        const uploadRes = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
        if (!uploadRes.ok) throw new Error("Falha ao enviar imagem");
        const { url: imageUrl } = await uploadRes.json();
        await handleVideoSubmit(imageUrl);
        setVideoMode(true);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Erro");
      }
      return;
    }

    if (creationMode === "catalogo" && !modelFile && !modelPreview) { setFormError("Escolha um modelo"); return; }
    if (!imageFile) { setFormError("Envie a foto do produto"); return; }
    if (!produto.trim()) { setFormError("Descreva o produto"); return; }
    if (creationMode !== "fundo_branco" && !cenario.trim()) { setFormError("Descreva o cenário da foto"); return; }

    setFormError("");
    setTimeoutError("");
    setSubmitting(true);
    setJob(null);
    await requestNotificationPermission();

    try {
      const token = await getToken();

      // Upload da imagem do produto (converte HEIC/HEIF para JPEG)
      const fileToUpload = await convertToJpegIfNeeded(imageFile);
      const form = new FormData();
      form.append("file", fileToUpload);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Falha ao enviar imagem");
      }
      const { url: imageUrl } = await uploadRes.json();

      // Fundo branco: processa no servidor, sem fila GPU
      if (creationMode === "fundo_branco") {
        const prompt = `${produto} | fundo branco`;
        const res = await fetch("/api/white-bg", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt, input_image_url: imageUrl }),
        });

        if (res.status === 429) {
          const err = await res.json();
          setRateLimitedUntil(new Date(err.nextAvailableAt));
          setSubmitting(false);
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Falha ao processar");
        }
        const data = await res.json();
        setJob({ id: data.jobId, status: "done", output_image_url: data.output_image_url });
        setSubmitting(false);
        return;
      }

      // Catálogo: modelo pode ser do catálogo (URL pública) ou upload manual
      let modelImageUrl: string | null = null;
      if (creationMode === "catalogo" && !modelFile && modelPreview?.startsWith("http")) {
        // Modelo do catálogo — usa URL diretamente
        modelImageUrl = modelPreview;
      } else if (creationMode === "catalogo" && modelFile) {
        const mform = new FormData();
        mform.append("file", modelFile);
        const mres = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: mform,
        });
        if (!mres.ok) throw new Error("Falha ao enviar foto do modelo");
        const { url } = await mres.json();
        modelImageUrl = url;
      }

      // Monta prompt (catálogo codifica model_img no prefixo)
      const basePrompt = cenario.trim() ? `${produto} | cenário: ${cenario}` : produto;
      const prompt = modelImageUrl
        ? `model_img:${modelImageUrl} | ${basePrompt}`
        : basePrompt;

      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, input_image_url: imageUrl, mode: creationMode }),
      });

      if (jobRes.status === 429) {
        const err = await jobRes.json();
        setRateLimitedUntil(new Date(err.nextAvailableAt));
        setSubmitting(false);
        return;
      }

      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Falha ao criar job");
      }
      const { jobId } = await jobRes.json();

      setJob({ id: jobId, status: "queued" });
      setTimeout(() => fetchJobStatus(jobId), 10_000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setSubmitting(false);
    }
  }

  function resetJob() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    if (blurRef.current) clearInterval(blurRef.current);
    setShowCancel(false);
    setJob(null);
    setProduto("");
    setCenario("");
    setImageFile(null);
    setPreview(null);
    setModelFile(null);
    setModelPreview(null);
    setModeSelected(false); // volta para o menu
  }

  async function handleCancel() {
    if (!job?.id || canceling) return;
    setCanceling(true);
    try {
      const token = await getToken();
      await fetch(`/api/image-jobs/${job.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignora */ } finally {
      setCanceling(false);
      resetJob();
    }
  }

  // Polling de vídeo a cada 15s
  useEffect(() => {
    if (!videoJob || !user) return;
    if (["done", "failed", "canceled"].includes(videoJob.status ?? "")) {
      if (videoPollRef.current) clearInterval(videoPollRef.current);
      if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
      if (videoJob.status === "done") sendNotification("Seu vídeo está pronto! 🎬", "Clique para ver o vídeo gerado.");
      return;
    }
    // Timer de tempo decorrido para barra de progresso
    setVideoElapsedSec(0);
    videoElapsedRef.current = setInterval(() => setVideoElapsedSec((s) => s + 1), 1000);
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
    setVideoDisplayProgress((prev) => prev + (target - prev) * 0.08);
  }, [videoElapsedSec]);

  async function fetchVideoStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/video-jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    setVideoJob(await res.json());
  }

  async function handleVideoSubmit(imageUrl: string) {
    setVideoError("");
    setVideoSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: videoPrompt, input_image_url: imageUrl }),
      });
      if (res.status === 403) { setVideoError("Disponível apenas no plano Pro."); return; }
      if (!res.ok) throw new Error("Erro ao criar job de vídeo");
      const { jobId } = await res.json();
      setVideoJob({ id: jobId, status: "queued" });
      setTimeout(() => fetchVideoStatus(jobId), 15_000);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Erro");
    } finally {
      setVideoSubmitting(false);
    }
  }

  function resetVideo() {
    if (videoPollRef.current) clearInterval(videoPollRef.current);
    if (videoElapsedRef.current) clearInterval(videoElapsedRef.current);
    setVideoMode(false);
    setVideoJob(null);
    setVideoPrompt("");
    setVideoError("");
    setVideoDisplayProgress(0);
    setVideoElapsedSec(0);
  }

  function resetAll() {
    resetVideo();
    resetJob();
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "foto-ia.jpg";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isGenerating = (submitting || (!!job && job.status !== "done" && job.status !== "failed" && job.status !== "canceled")) && job?.status !== "done";
  // State machine: sem_trabalho | trabalhando | terminado
  const workState: WorkState = submitting ? "trabalhando" : deriveWorkState(job);

  if (loading) return (
    <div style={styles.page} className="app-layout">
      <style>{`
        @keyframes skeletonShimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
      <header style={styles.header} className="app-header">
        <div style={skl.logoBlock} />
        <div style={skl.avatarBlock} />
      </header>
      <main style={styles.main} className="app-main">
        <div style={skl.labelBlock} />
        <div style={skl.grid}>
          {[0,1,2,3].map(i => (
            <div key={i} style={skl.card}>
              <div style={{ position: "relative" as const, width: "100%", aspectRatio: "3 / 4" }}>
                <div style={skl.cardImg} />
                {/* overlay de texto no rodapé do card */}
                <div style={skl.cardOverlay}>
                  <div style={skl.cardTextSm} />
                  <div style={skl.cardTextLg} />
                </div>
              </div>
              <div style={skl.cardFooter}>
                <div style={skl.cardBtn} />
              </div>
            </div>
          ))}
        </div>
      </main>
      <div style={skl.bottomNav}>
        {[0,1,2].map(i => (
          <div key={i} style={skl.navItem}>
            <div style={skl.navIcon} />
            <div style={skl.navLabel} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.page} className="app-layout">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseBtnAnim {
          0% { box-shadow: 0 0 0 0 rgba(168,85,247,0.55); transform: scale(1); }
          60% { box-shadow: 0 0 0 14px rgba(168,85,247,0); transform: scale(1.03); }
          100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); transform: scale(1); }
        }
        /* Desktop: header simplificado */
        @media (min-width: 900px) {
          .page-logo { display: none !important; }
          .page-header {
            background: transparent !important;
            border-bottom: none !important;
            position: relative !important;
            padding: 12px 48px !important;
            justify-content: flex-end !important;
          }
          /* Estado gerando: 2 colunas */
          .generating-wrap {
            display: grid !important;
            grid-template-columns: 340px 1fr !important;
            gap: 0 !important;
            max-width: 100% !important;
            min-height: calc(100vh - 120px) !important;
            background: #0d1117 !important;
            border-radius: 20px !important;
            overflow: hidden !important;
            border: 1px solid rgba(255,255,255,0.06) !important;
            padding: 0 !important;
          }
          .generating-panel {
            padding: 48px 36px !important;
            border-right: 1px solid rgba(255,255,255,0.06) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 20px !important;
          }
          .generating-preview {
            height: 100% !important;
            min-height: 500px !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          /* Estado resultado: 2 colunas */
          .result-wrap {
            display: grid !important;
            grid-template-columns: 1fr 360px !important;
            gap: 0 !important;
            max-width: 100% !important;
            background: #0d1117 !important;
            border-radius: 20px !important;
            overflow: hidden !important;
            border: 1px solid rgba(255,255,255,0.06) !important;
            padding: 0 !important;
            animation: fadeIn 0.5s ease !important;
          }
          .result-image-col {
            background: #07080b;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 32px !important;
            min-height: 500px !important;
          }
          .result-image-col img {
            max-height: 70vh !important;
            width: auto !important;
            max-width: 100% !important;
            border-radius: 12px !important;
          }
          .result-actions-col {
            padding: 48px 36px !important;
            border-left: 1px solid rgba(255,255,255,0.06) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 14px !important;
          }
          /* No desktop: esconde as ações mobile duplicadas */
          .result-mobile-actions { display: none !important; }
          /* Imagem resultado: proporcional, não estica */
          .result-image-col img {
            max-height: 75vh !important;
            width: auto !important;
            max-width: 100% !important;
            object-fit: contain !important;
            border-radius: 12px !important;
            margin-bottom: 0 !important;
          }
        }
        /* Mobile: esconde as ações desktop */
        @media (max-width: 899px) {
          .result-actions-col { display: none !important; }
          .result-image-col { padding: 0 !important; background: transparent !important; }
          .result-image-col img { border-radius: 16px !important; width: 100% !important; max-height: none !important; }
          .generating-panel { padding: 0 !important; border: none !important; }
        }
      `}</style>

      {/* Header */}
      <header style={styles.header} className="app-header page-header">
        <div style={styles.logo} className="page-logo">TamoWork</div>
        <div style={styles.headerRight}>
          <LangSelector />
          {plan === "pro" && <span style={styles.proBadge}>✦ Pro</span>}
          <button onClick={() => router.push("/conta")} style={styles.accountBtn} title={user?.email}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </button>
        </div>
      </header>

      <main style={styles.main} className="app-main">
        {/* PASSO 1: Menu de escolha de modo */}
        {workState === "sem_trabalho" && !modeSelected && (
          <div style={styles.menuWrap}>
            {rateLimitedUntil && countdown > 0 ? (
              <div style={{ ...styles.card, textAlign: "center", padding: "36px 32px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#8394b0", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Plano gratuito · 1 foto a cada 3h
                </div>
                <div style={{ fontSize: 14, color: "#eef2f9", marginBottom: 6 }}>Próxima foto disponível em</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 20, fontVariantNumeric: "tabular-nums" }}>
                  {formatMs(countdown)}
                </div>
                <div style={{ fontSize: 13, color: "#8394b0", marginBottom: 24, lineHeight: 1.6 }}>
                  Por menos de <strong style={{ color: "#c4b5fd" }}>R$0,61/dia</strong> você gera fotos e vídeos sem limite
                </div>
                <button onClick={() => router.push("/planos")} style={styles.pulsingBtn}>
                  🔓 Libere agora
                </button>
              </div>
            ) : (
              <ModeSelector
                selected={creationMode}
                onChange={(m) => {
                  setCreationMode(m);
                  setImageFile(null); setPreview(null);
                  setModelFile(null); setModelPreview(null);
                  if (m === "fundo_branco") setCenario("fundo branco limpo, luz de estúdio");
                  else setCenario("");
                  setModeSelected(true);
                }}
              />
            )}
          </div>
        )}

        {/* PASSO 2: Modo Promo — componente próprio */}
        {workState === "sem_trabalho" && modeSelected && creationMode === "promo" && (
          <PromoCreator onBack={() => setModeSelected(false)} />
        )}

        {/* PASSO 2: Formulário após escolher o modo */}
        {workState === "sem_trabalho" && modeSelected && creationMode !== "promo" && (
          <div style={styles.card}>
            {/* Botão voltar */}
            <button onClick={() => setModeSelected(false)} style={styles.backToMenuBtn}>
              ← Voltar
            </button>

            <div style={styles.modeHeader}>
              <div style={styles.modeName}>
                {{
                  simulacao: "Simulação de uso",
                  fundo_branco: "Fundo branco",
                  catalogo: "Catálogo com modelo",
                  personalizado: "Personalizado",
                  video: "Criar vídeo",
                }[creationMode]}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>

              {/* ── MODO VÍDEO ── */}
              {creationMode === "video" ? (
                <>
                  <div
                    style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}) }}
                    onClick={() => fileRef.current?.click()}
                  >
                    {preview ? (
                      <img src={preview} alt="preview" style={styles.previewImg} />
                    ) : (
                      <>
                        <div style={styles.uploadIcon}>🎬</div>
                        <div style={styles.uploadText}>Envie a foto que vira vídeo</div>
                        <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>O que você quer que aconteça? <span style={{ color: "#4e5c72" }}>(opcional)</span></label>
                    <input
                      type="text"
                      placeholder="Ex: câmera girando suavemente, produto rotacionando"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  {plan !== "pro" && (
                    <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", marginBottom: 4 }}>🔒 Disponível no plano Pro</div>
                      <div style={{ fontSize: 12, color: "#8394b0", marginBottom: 12 }}>Vídeos com IA a partir de R$0,61/dia</div>
                      <button type="button" onClick={() => router.push("/planos")} style={styles.unlockBtn}>✨ Assinar agora</button>
                    </div>
                  )}

                  {videoError && <div style={styles.error}>{videoError}</div>}

                  <button
                    type="submit"
                    disabled={videoSubmitting || !imageFile || plan !== "pro"}
                    style={{ ...styles.submitBtn, opacity: (videoSubmitting || !imageFile || plan !== "pro") ? 0.5 : 1 }}
                  >
                    {videoSubmitting ? "Enviando..." : "🎬 Gerar vídeo"}
                  </button>
                </>
              ) : (
              <>
              {/* ── MODOS DE FOTO ── */}
              {creationMode === "catalogo" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={styles.uploadLabel}>1. Escolha o modelo</div>
                    <CatalogModelPicker
                      selected={modelPreview}
                      onSelect={(url) => {
                        setModelPreview(url);
                        setModelFile(null); // modelo do catálogo: URL direta
                      }}
                      onCustom={() => modelFileRef.current?.click()}
                    />
                    <input ref={modelFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setModelFile(f); setModelPreview(f ? URL.createObjectURL(f) : null);
                    }} style={{ display: "none" }} />
                  </div>
                  <div>
                    <div style={styles.uploadLabel}>2. Foto do produto</div>
                    <div
                      style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}), marginBottom: 0 }}
                      onClick={() => fileRef.current?.click()}
                    >
                      {preview ? (
                        <img src={preview} alt="produto" style={styles.previewImg} />
                      ) : (
                        <>
                          <div style={styles.uploadIcon}>📦</div>
                          <div style={styles.uploadText}>Foto do produto</div>
                          <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                        </>
                      )}
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}) }}
                  onClick={() => fileRef.current?.click()}
                >
                  {preview ? (
                    <img src={preview} alt="preview" style={styles.previewImg} />
                  ) : (
                    <>
                      <div style={styles.uploadIcon}>📷</div>
                      <div style={styles.uploadText}>
                        {creationMode === "fundo_branco" ? "Foto do produto (qualquer fundo)" : "Foto do produto"}
                      </div>
                      <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                </div>
              )}

              <div style={styles.fieldGroup}>
                <label style={styles.label}>O que é o produto?</label>
                <input type="text" placeholder="Ex: bolo de chocolate artesanal com morango" value={produto} onChange={(e) => setProduto(e.target.value)} required style={styles.input} />
              </div>

              {creationMode !== "fundo_branco" && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    {creationMode === "personalizado" ? "Descreva o resultado que quer" : "Cenário"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      creationMode === "simulacao" ? "Ex: mesa rústica, estúdio com luz suave" :
                      creationMode === "catalogo" ? "Ex: ambiente urbano, loja moderna" :
                      "Descreva livremente o que a IA deve criar"
                    }
                    value={cenario}
                    onChange={(e) => setCenario(e.target.value)}
                    required
                    style={styles.input}
                  />
                </div>
              )}

              {timeoutError && <div style={{ ...styles.error, borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>{timeoutError}</div>}
              {formError && <div style={styles.error}>{formError}</div>}

              <button
                type="submit"
                disabled={submitting || !cenario.trim()}
                style={{ ...styles.submitBtn, opacity: (submitting || !cenario.trim()) ? 0.5 : 1 }}
              >
                {submitting ? "Enviando..." : "✨ Gerar foto com IA"}
              </button>
              </>
              )}
            </form>
          </div>
        )}

        {/* Gerando — blur animation estilo GPT */}
        {workState === "trabalhando" && (
          <div style={styles.card} className="generating-wrap">
            {/* Painel esquerdo: status */}
            <div className="generating-panel">
              <div style={styles.generatingTitle}>
                <span style={styles.shimmerText}>Transformando sua foto</span>
                <span style={styles.dots}>
                  <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                  <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                  <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
                </span>
              </div>
              {!submitting && (
                <div style={styles.progressBarBg}>
                  <div style={{
                    ...styles.progressBarFill,
                    width: `${displayProgress}%`,
                    background: displayProgress > 80
                      ? "linear-gradient(90deg, #6366f1, #22c55e)"
                      : "linear-gradient(90deg, #6366f1, #a855f7)",
                  }} />
                </div>
              )}
              <NotifyButton onRequest={requestNotificationPermission} />
              {showCancel && (
                <button onClick={async () => {
                  setCanceling(true);
                  const token = await getToken();
                  if (job?.id) await fetch(`/api/image-jobs/${job.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                  setCanceling(false);
                  resetJob();
                }} disabled={canceling} style={styles.cancelBtn}>
                  {canceling ? "Cancelando..." : "Cancelar"}
                </button>
              )}
            </div>
            {/* Preview (visível no mobile como bloco, no desktop como coluna direita) */}
            {preview && (
              <div style={{ ...styles.blurWrapper, marginBottom: 0 }} className="generating-preview">
                <img
                  src={preview}
                  alt="produto"
                  style={{
                    ...styles.blurImg,
                    filter: `blur(${blurPx}px) brightness(0.7)`,
                    transform: `scale(${1 + blurPx * 0.002})`,
                  }}
                />
                <div style={styles.blurOverlay} />
                <div style={styles.blurBadge}>
                  <span style={styles.blurDot} />
                  {submitting ? "Enviando..." : statusLabel(job?.status ?? null, elapsedSec, job?.created_at)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado */}
        {workState === "terminado" && job && !videoMode && (
          <div style={styles.card} className="result-wrap">
            {/* Imagem — coluna esquerda no desktop */}
            <div className="result-image-col">
              <img
                src={editedImageUrl ?? job.output_image_url}
                alt="Foto gerada"
                style={{ ...styles.resultImg, marginBottom: 0 }}
              />
            </div>
            {/* Ações — coluna direita no desktop */}
            <div className="result-actions-col">
              <h2 style={{ ...styles.centerTitle, textAlign: "left" as const, marginBottom: 4 }}>{t("result_ready")}</h2>
              <p style={{ fontSize: 13, color: "#8394b0", marginBottom: 8 }}>Sua foto foi gerada com sucesso</p>
              <button onClick={() => handleDownload(editedImageUrl ?? job.output_image_url!)} style={styles.downloadBtn}>
                {t("result_download")}
              </button>
              <button onClick={() => {
                const url = editedImageUrl ?? job.output_image_url;
                if (url) { sessionStorage.setItem("editor_image", url); router.push("/editor"); }
              }} style={{ ...styles.editBtn, width: "100%", textAlign: "center" as const }}>
                {t("result_edit")}
              </button>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={resetJob} style={{ ...styles.newBtn, flex: 1 }}>{t("result_new")}</button>
                {plan === "pro" ? (
                  <button onClick={() => setVideoMode(true)} style={{ ...styles.videoBtn, flex: 1 }}>
                    {t("result_create_video")}
                  </button>
                ) : (
                  <button onClick={() => router.push("/planos")} style={{ ...styles.videoBtnLocked, flex: 1 }}>
                    <div>{t("result_video_locked")}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>{t("result_video_locked_sub")}</div>
                  </button>
                )}
              </div>
            </div>
            {/* Mobile: ações abaixo da imagem */}
            <div className="result-mobile-actions" style={{ display: "block", padding: "0 24px 24px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => handleDownload(editedImageUrl ?? job.output_image_url!)} style={{ ...styles.downloadBtn, flex: 1 }}>
                  {t("result_download")}
                </button>
                <button onClick={() => {
                  const url = editedImageUrl ?? job.output_image_url;
                  if (url) { sessionStorage.setItem("editor_image", url); router.push("/editor"); }
                }} style={styles.editBtn}>{t("result_edit")}</button>
              </div>
              <div style={styles.resultActions}>
                <button onClick={resetJob} style={styles.newBtn}>{t("result_new")}</button>
                {plan === "pro" ? (
                  <button onClick={() => setVideoMode(true)} style={styles.videoBtn}>{t("result_create_video")}</button>
                ) : (
                  <button onClick={() => router.push("/planos")} style={styles.videoBtnLocked}>
                    <div>{t("result_video_locked")}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>{t("result_video_locked_sub")}</div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}


        {/* Vídeo — form */}
        {videoMode && !videoJob && job?.status === "done" && job.output_image_url && (
          <div style={styles.card}>
            <button onClick={resetVideo} style={styles.backBtn}>← Voltar</button>
            <h2 style={styles.centerTitle}>🎬 Criar vídeo da foto</h2>
            <p style={{ ...styles.centerDesc, marginBottom: 16 }}>
              Descreva como a câmera vai se mover ou o que vai acontecer na cena.
            </p>
            <img src={job.output_image_url} alt="base" style={{ ...styles.resultImg, marginBottom: 16 }} />
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Movimento <span style={{ color: "#4e5c72" }}>(opcional)</span></label>
              <input
                type="text"
                placeholder="Ex: câmera girando suavemente para a esquerda"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                style={styles.input}
              />
            </div>
            {videoError && <div style={{ ...styles.error, marginTop: 12 }}>{videoError}</div>}
            <button
              onClick={() => handleVideoSubmit(job.output_image_url!)}
              disabled={videoSubmitting}
              style={{ ...styles.submitBtn, marginTop: 16, opacity: videoSubmitting ? 0.6 : 1 }}
            >
              {videoSubmitting ? "Enviando..." : "🎬 Gerar vídeo"}
            </button>
          </div>
        )}

        {/* Vídeo — gerando */}
        {videoJob && !["done", "failed"].includes(videoJob.status ?? "") && (
          <div style={styles.card}>
            <div style={styles.generatingTitle}>
              <span style={styles.shimmerText}>Criando seu vídeo</span>
              <span style={styles.dots}>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
              </span>
            </div>
            {/* Barra de progresso do vídeo */}
            <div style={styles.progressBarBg}>
              <div style={{
                ...styles.progressBarFill,
                width: `${videoDisplayProgress}%`,
                background: videoDisplayProgress > 80
                  ? "linear-gradient(90deg, #6366f1, #22c55e)"
                  : "linear-gradient(90deg, #6366f1, #a855f7)",
              }} />
            </div>

            <p style={{ ...styles.centerDesc, marginBottom: 20 }}>
              Vídeos levam 3–5 minutos. Pode fechar — te avisamos quando ficar pronto. 🔔
            </p>
            {job?.output_image_url && (
              <div style={styles.blurWrapper}>
                <img src={job.output_image_url} alt="base" style={{ ...styles.blurImg, filter: "blur(20px) brightness(0.6)" }} />
                <div style={styles.blurOverlay} />
                <div style={styles.blurBadge}><span style={styles.blurDot} />Vou fazer seu vídeo agora...</div>
              </div>
            )}
          </div>
        )}

        {/* Vídeo — pronto */}
        {videoJob?.status === "done" && videoJob.output_video_url && (
          <div style={{ ...styles.card, animation: "fadeIn 0.5s ease" }}>
            <h2 style={styles.centerTitle}>Seu vídeo está pronto! 🎬</h2>
            <video
              src={videoJob.output_video_url}
              controls
              autoPlay
              loop
              playsInline
              style={{ width: "100%", borderRadius: 16, display: "block", marginBottom: 16 }}
            />
            <div style={styles.resultActions}>
              <a href={videoJob.output_video_url} download="video-ia.mp4" style={styles.downloadBtn}>⬇ Baixar vídeo</a>
              <button onClick={resetAll} style={styles.newBtn}>📷 Nova foto</button>
            </div>
          </div>
        )}

        {/* Vídeo — erro */}
        {videoJob?.status === "failed" && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>❌</div>
            <h2 style={styles.centerTitle}>Erro ao gerar vídeo</h2>
            <p style={styles.centerDesc}>{videoJob.error_message ?? "Não foi possível gerar o vídeo."}</p>
            <button onClick={resetVideo} style={styles.submitBtn}>Tentar novamente</button>
          </div>
        )}

        {/* Erro */}
        {job?.status === "failed" && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>❌</div>
            <h2 style={styles.centerTitle}>Algo deu errado</h2>
            <p style={styles.centerDesc}>Ocorreu um erro inesperado ao gerar sua foto. Tente novamente.</p>
            <button onClick={resetJob} style={styles.submitBtn}>Tentar novamente</button>
          </div>
        )}
      </main>
      <BottomNav hasActiveJob={isGenerating} />

      {/* Mini editor */}
      {editorOpen && job?.output_image_url && (
        <PhotoEditor
          imageUrl={editedImageUrl ?? job.output_image_url}
          onClose={() => setEditorOpen(false)}
          onSave={(dataUrl) => {
            setEditedImageUrl(dataUrl);
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NotifyButton({ onRequest }: { onRequest: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "granted" | "denied">(() => {
    if (typeof Notification === "undefined") return "granted";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return "idle";
  });

  async function handle() {
    await onRequest();
    if (typeof Notification !== "undefined") {
      setState(Notification.permission === "granted" ? "granted" : "denied");
    }
  }

  if (state === "granted") {
    return (
      <div style={notifyStyles.notice}>
        Pode fechar o app — te avisamos quando ficar pronta
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div style={notifyStyles.notice}>
        Pode fechar o app — ative notificações no navegador para receber aviso
      </div>
    );
  }

  return (
    <button onClick={handle} style={notifyStyles.btn}>
      Ativar aviso quando ficar pronta
    </button>
  );
}

const notifyStyles: Record<string, React.CSSProperties> = {
  notice: {
    fontSize: 13, color: "#8394b0", textAlign: "center",
    padding: "10px 0", lineHeight: 1.5,
  },
  btn: {
    width: "100%", background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 12, padding: "12px 20px", color: "#c4b5fd",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
};

function statusLabel(status: JobStatus, elapsedSec: number, createdAt?: string): string {
  const realElapsed = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
    : elapsedSec;
  if (status === "processing") return "Gerando sua foto...";
  if (status === "submitted") return realElapsed < 20 ? "Enviando para a IA..." : "Processando...";
  if (status === "queued") {
    if (realElapsed < 10) return "Preparando...";
    if (realElapsed < 120) return "Na fila...";
    return "Aguardando na fila...";
  }
  return "Processando...";
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 68 },
  centered: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8394b0" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#0c1018",
    position: "sticky", top: 0, zIndex: 10,
  },
  logo: {
    fontSize: 18, fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  logoTag: { fontSize: 13, fontWeight: 400 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  proBadge: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#fff",
  },
  email: { fontSize: 13, color: "#8394b0" },
  logoutBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "6px 14px", color: "#8394b0", fontSize: 13, cursor: "pointer",
  },
  main: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "20px 16px" },
  menuWrap: { width: "100%", maxWidth: 960 },
  card: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 22, padding: "36px 32px", width: "100%", maxWidth: 520, margin: "0 auto",
  },
  title: { fontSize: 22, fontWeight: 700, margin: "0 0 8px" },
  desc: { color: "#8394b0", fontSize: 15, margin: "0 0 28px", lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  dropzone: {
    background: "#0c1018", border: "2px dashed rgba(255,255,255,0.1)",
    borderRadius: 18, padding: "32px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    cursor: "pointer", gap: 8, minHeight: 140,
  },
  dropzoneWithPreview: { padding: 0, overflow: "hidden", minHeight: 200 },
  previewImg: { width: "100%", height: 260, objectFit: "contain", borderRadius: 16, display: "block", background: "#0c1018" },
  uploadIcon: { fontSize: 32 },
  uploadText: { color: "#eef2f9", fontSize: 14, fontWeight: 500 },
  uploadSub: { color: "#4e5c72", fontSize: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#8394b0", fontWeight: 500 },
  input: {
    background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: "11px 14px", color: "#eef2f9", fontSize: 15, outline: "none", width: "100%",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "14px 0",
    color: "#fff", fontSize: 16, fontWeight: 600, marginTop: 4, cursor: "pointer",
  },
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13,
  },
  rateLimitBox: {
    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 16, padding: "18px 20px", marginBottom: 20,
    display: "flex", gap: 14, alignItems: "flex-start",
  },
  rateLimitIcon: { fontSize: 28, flexShrink: 0 },
  rateLimitTitle: { fontSize: 13, color: "#8394b0", marginBottom: 4 },
  rateLimitTimer: {
    fontSize: 32, fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    marginBottom: 6,
  },
  rateLimitSub: { fontSize: 12, color: "#4e5c72", lineHeight: 1.5 },

  // Blur animation
  generatingTitle: {
    fontSize: 20, fontWeight: 700, textAlign: "center",
    marginBottom: 8, display: "flex", justifyContent: "center", alignItems: "center", gap: 2,
  },
  shimmerText: {
    background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #a855f7, #6366f1)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    animation: "shimmer 3s linear infinite",
  },
  dots: { color: "#8b5cf6", fontSize: 22, letterSpacing: 2, display: "flex" },
  blurWrapper: {
    position: "relative", borderRadius: 18, overflow: "hidden",
    marginBottom: 20, background: "#0c1018", height: 300,
  },
  blurImg: {
    width: "100%", height: "100%", objectFit: "cover",
    display: "block", transition: "filter 1s ease, transform 1s ease",
  },
  blurOverlay: {
    position: "absolute", inset: 0,
    background: "linear-gradient(180deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.25) 100%)",
    pointerEvents: "none",
  },
  blurBadge: {
    position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
    background: "rgba(13,14,20,0.85)", border: "1px solid rgba(139,92,246,0.4)",
    borderRadius: 20, padding: "6px 16px", fontSize: 13, color: "#c4b5fd", fontWeight: 500,
    display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)", whiteSpace: "nowrap",
  },
  blurDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6",
    animation: "pulse 1.2s ease-in-out infinite", flexShrink: 0,
  },
  cancelBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "8px 20px", color: "#8394b0", fontSize: 13, cursor: "pointer",
  },
  resetBtn: {
    background: "transparent", border: "none",
    color: "#4e5c72", fontSize: 13, cursor: "pointer", padding: "4px 8px",
    textDecoration: "underline", textDecorationStyle: "dotted" as const,
  },
  timeEstimate: {
    fontSize: 13, color: "#8394b0", textAlign: "center", marginBottom: 16, minHeight: 20,
  },
  editBtn: {
    background: "#111820", border: "1px solid rgba(168,85,247,0.4)",
    borderRadius: 12, padding: "12px 18px", color: "#a855f7",
    fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0,
  },
  progressBarBg: {
    width: "100%", height: 5, background: "rgba(255,255,255,0.08)",
    borderRadius: 99, overflow: "hidden", marginBottom: 16,
  },
  progressBarFill: {
    height: "100%", borderRadius: 99, transition: "width 0.4s ease",
  },
  centerTitle: { fontSize: 20, fontWeight: 700, textAlign: "center", margin: "0 0 8px" },
  centerDesc: { color: "#8394b0", fontSize: 14, textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 },
  offerBox: {
    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 16, padding: "20px 24px",
  },
  offerTitle: { fontSize: 15, fontWeight: 600, marginBottom: 6 },
  offerDesc: { fontSize: 13, color: "#8394b0", lineHeight: 1.5, marginBottom: 12 },
  offerBadge: {
    display: "inline-block", background: "rgba(99,102,241,0.2)", borderRadius: 8,
    padding: "4px 10px", fontSize: 12, color: "#8b5cf6", fontWeight: 600,
  },
  bigIcon: { fontSize: 48, textAlign: "center", marginBottom: 16 },
  resultImg: { width: "100%", borderRadius: 16, display: "block", marginBottom: 16 },
  resultActions: { display: "flex", gap: 10, marginTop: 10 },
  downloadBtn: {
    width: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "13px 0", color: "#fff",
    fontSize: 15, fontWeight: 600, textAlign: "center", display: "block",
    cursor: "pointer", marginBottom: 10,
  },
  newBtn: {
    flex: 1, background: "#1a2535", border: "none", borderRadius: 14,
    padding: "13px 0", color: "#eef2f9", fontSize: 15, fontWeight: 500, cursor: "pointer",
  },
  videoBtn: {
    flex: 1, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
    borderRadius: 14, padding: "13px 0", color: "#34d399", fontSize: 15, fontWeight: 600, cursor: "pointer",
  },
  videoBtnLocked: {
    flex: 1, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 14, padding: "11px 8px", color: "#8b5cf6", fontSize: 14, fontWeight: 600, cursor: "pointer",
    lineHeight: 1.2,
  },
  accountBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "6px 10px", color: "#8394b0", cursor: "pointer",
    display: "flex", alignItems: "center",
  },
  backBtn: {
    background: "transparent", border: "none", color: "#8394b0",
    fontSize: 14, cursor: "pointer", padding: "0 0 16px", display: "block",
  },
  unlockBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 10, padding: "10px 18px",
    color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
  },
  backToMenuBtn: {
    background: "transparent", border: "none", color: "#8394b0",
    fontSize: 14, cursor: "pointer", padding: "0 0 16px 0",
    display: "flex", alignItems: "center", gap: 4, fontWeight: 600,
  },
  modeHeader: { marginBottom: 16 },
  modeName: {
    fontSize: 18, fontWeight: 800, color: "#eef2f9",
  },
  uploadLabel: {
    fontSize: 11, fontWeight: 700, color: "#8394b0", textTransform: "uppercase" as const,
    letterSpacing: "0.05em", marginBottom: 6,
  },
  pulsingBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 16, padding: "16px 40px",
    color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
    width: "100%", animation: "pulseBtnAnim 1.6s ease-in-out infinite",
    boxShadow: "0 0 0 0 rgba(168,85,247,0.5)",
  },
};

const SKL_BASE: React.CSSProperties = {
  background: "linear-gradient(90deg, #111820 25%, #1a2235 50%, #111820 75%)",
  backgroundSize: "800px 100%",
  animation: "skeletonShimmer 1.4s ease-in-out infinite",
  borderRadius: 10,
};

const skl: Record<string, React.CSSProperties> = {
  logoBlock: { ...SKL_BASE, width: 110, height: 22, borderRadius: 8 },
  avatarBlock: { ...SKL_BASE, width: 32, height: 32, borderRadius: "50%" },
  labelBlock: { ...SKL_BASE, width: 160, height: 14, borderRadius: 6, marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  card: { background: "#111820", borderRadius: 16, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.07)" },
  cardImg: { ...SKL_BASE, width: "100%", aspectRatio: "3 / 4", borderRadius: 0 },
  cardFooter: { padding: "10px 10px 12px" },
  cardBtn: { ...SKL_BASE, height: 38, borderRadius: 10 },
  bottomNav: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 560,
    background: "#0c1018", borderTop: "1px solid rgba(255,255,255,0.07)",
    display: "flex", zIndex: 50,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  navItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0 14px" },
  navIcon: { ...SKL_BASE, width: 24, height: 24, borderRadius: 6 },
  navLabel: { ...SKL_BASE, width: 36, height: 10, borderRadius: 4 },
  cardOverlay: { position: "absolute" as const, bottom: 12, left: 12, right: 12, display: "flex", flexDirection: "column" as const, gap: 6 },
  cardTextSm: { ...SKL_BASE, height: 10, width: "55%", borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 75%)", backgroundSize: "800px 100%" },
  cardTextLg: { ...SKL_BASE, height: 14, width: "80%", borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 75%)", backgroundSize: "800px 100%" },
};
