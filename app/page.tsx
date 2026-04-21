"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "@/lib/downloadBlob";
import { supabase } from "@/lib/supabase/client";
import { getToken } from "@/lib/auth/getToken";
import { useAppBanner } from "@/app/hooks/useAppBanner";
import { useProgressBar } from "@/app/hooks/useProgressBar";
import { useRateLimit } from "@/app/hooks/useRateLimit";
import { usePhotoPolling } from "@/app/hooks/usePhotoPolling";
import { useVideoJob } from "@/app/hooks/useVideoJob";
import { useNarratedVideo } from "@/app/hooks/useNarratedVideo";
import { useLongVideo } from "@/app/hooks/useLongVideo";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import BottomNav from "@/app/components/BottomNav";
import ModeSelector, { type CreationMode } from "@/app/components/ModeSelector";
import PushConversionAgent from "@/app/components/PushConversionAgent";
import nextDynamic from "next/dynamic";
import { useI18n, LangSelector } from "@/lib/i18n";
import { useProductVision } from "@/lib/vision/useProductVision";
import { CONVERSION } from "@/app/config/conversion";
import type { ActiveJobInfo } from "@/app/components/BotChat";
const PhotoEditor = nextDynamic(() => import("@/app/components/PhotoEditor"), { ssr: false });
const PromoCreator = nextDynamic(() => import("@/app/components/PromoCreator"), { ssr: false });
const UpsellPopup = nextDynamic(() => import("@/app/components/UpsellPopup"), { ssr: false });
const BotChat = nextDynamic(() => import("@/app/components/BotChat"), { ssr: false });
const OnboardingScreen = nextDynamic(() => import("@/app/components/OnboardingScreen"), { ssr: false });
const ConversionScreen = nextDynamic(() => import("@/app/components/ConversionScreen"), { ssr: false });
const VideoHookScreen = nextDynamic(() => import("@/app/components/VideoHookScreen"), { ssr: false });
const OnboardingChat = nextDynamic(() => import("@/app/components/OnboardingChat"), { ssr: false });
const TamoMascot = nextDynamic(() => import("@/app/components/TamoMascot"), { ssr: false });
const MiniToast = nextDynamic(() => import("@/app/components/MiniToast"), { ssr: false });

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
  const [remaining, setRemaining] = useState<number>(() =>
    target ? Math.max(0, target.getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!target) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    tick(); // sincroniza imediatamente ao mudar o alvo
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

// Card unificado de limite diário — exibido no painel de resultado (substitui RateLimitCard + ProUpsell)
function RateLimitUpsell({ countdown, onAssinar }: { countdown: number; onAssinar: () => void }) {
  const isBR = (typeof navigator !== "undefined" ? navigator.language : "pt-BR").startsWith("pt");
  return (
    <div style={{
      background: "#111820",
      border: "1px solid rgba(168,85,247,0.3)",
      borderRadius: 18, padding: "20px 16px",
      display: "flex", flexDirection: "column" as const, gap: 14,
    }}>
      {/* Título + timer */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>
          Limite diário atingido
        </div>
        <div style={{ fontSize: 13, color: "#8394b0", marginBottom: 8 }}>
          Próxima criação disponível em
        </div>
        <div style={{
          fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1,
          background: "linear-gradient(135deg, #a5b4fc, #c084fc)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {formatMs(countdown)}
        </div>
        <div style={{ fontSize: 11, color: "#4e5c72", marginTop: 6 }}>
          Plano grátis: 1 foto + 1 vídeo por dia
        </div>
      </div>

      {/* Divisor */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* Badge PRO + preço */}
      <div style={{ textAlign: "center" as const }}>
        <div style={{ display: "inline-block", background: "linear-gradient(135deg,#6366f1,#a855f7)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: 1, marginBottom: 10 }}>PRO</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginBottom: 4 }}>
          <span style={{ color: "#eef2f9", fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>{isBR ? "R$79" : "$100"}</span>
          <span style={{ color: "#8394b0", fontSize: 14 }}>{isBR ? "/mês" : "/year"}</span>
        </div>
        <div style={{ fontSize: 12, color: "#4e5c72" }}>Menos de {isBR ? "R$2,63" : "$0.28"} por dia • Cancele quando quiser</div>
      </div>

      {/* Feature list */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {[
          "Fotos ilimitadas de produto com IA",
          "Vídeos animados para Reels e TikTok",
          "Vídeo narrado com locução e cenas",
          "Foto pronta na hora, sem fila",
          "Alta qualidade, sem marca d'água",
        ].map(feat => (
          <div key={feat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#a855f7", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓</span>
            <span style={{ color: "#eef2f9", fontSize: 13 }}>{feat}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button onClick={onAssinar} style={{
        width: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
        border: "none", borderRadius: 14, padding: "15px",
        color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
        fontFamily: "Outfit, sans-serif",
        boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
      }}>
        🔥 Assinar agora — {isBR ? "R$79/mês" : "$100/ano"}
      </button>
      <div style={{ fontSize: 11, color: "#4e5c72", textAlign: "center" as const }}>
        Pagamento seguro via {isBR ? "Stripe" : "Stripe"} • Cancele a qualquer momento
      </div>
    </div>
  );
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

function DailyLimitScreen({ countdown, onAssinar }: { countdown: number; onAssinar: () => void }) {
  const isBR = (typeof navigator !== "undefined" ? navigator.language : "pt-BR").startsWith("pt");
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" as const, gap: 0 }}>
      {/* Bloco superior: timer */}
      <div style={{ background: "#111820", border: "1px solid rgba(168,85,247,0.25)", borderRadius: "18px 18px 0 0", padding: "24px 20px 20px", textAlign: "center" as const }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
          Limite diário atingido
        </div>
        <div style={{ fontSize: 14, color: "#8394b0", marginBottom: 10 }}>
          Próxima criação disponível em
        </div>
        <div style={{ fontSize: 56, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1, background: "linear-gradient(135deg, #a5b4fc, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {formatMs(countdown)}
        </div>
        <div style={{ fontSize: 12, color: "#4e5c72", marginTop: 8 }}>
          Plano grátis: 1 foto + 1 vídeo por dia
        </div>
      </div>

      {/* Bloco inferior: PRO card */}
      <div style={{ background: "#0e1520", border: "1px solid rgba(168,85,247,0.25)", borderTop: "none", borderRadius: "0 0 18px 18px", padding: "20px" }}>
        {/* Badge PRO + preço */}
        <div style={{ textAlign: "center" as const, marginBottom: 16 }}>
          <div style={{ display: "inline-block", background: "linear-gradient(135deg,#6366f1,#a855f7)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: 1, marginBottom: 10 }}>PRO</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
            <span style={{ color: "#eef2f9", fontSize: 40, fontWeight: 900, letterSpacing: -1 }}>{isBR ? "R$79" : "$100"}</span>
            <span style={{ color: "#8394b0", fontSize: 14 }}>{isBR ? "/mês" : "/year"}</span>
          </div>
          <div style={{ fontSize: 12, color: "#4e5c72", marginTop: 4 }}>
            Menos de {isBR ? "R$2,63" : "$0.28"} por dia • Cancele quando quiser
          </div>
        </div>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 18 }}>
          {[
            "Fotos ilimitadas de produto com IA",
            "Vídeos animados para Reels e TikTok",
            "Vídeo narrado com locução e cenas",
            "Foto pronta na hora, sem fila",
            "Alta qualidade, sem marca d'água",
            "Cancele quando quiser",
          ].map(feat => (
            <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#a855f7", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span style={{ color: "#eef2f9", fontSize: 14 }}>{feat}</span>
            </div>
          ))}
        </div>

        <button onClick={onAssinar} style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", border: "none", borderRadius: 14, padding: "16px", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "Outfit, sans-serif", boxShadow: "0 4px 20px rgba(139,92,246,0.4)" }}>
          🔥 Assinar agora — {isBR ? "R$79/mês" : "$100/ano"}
        </button>
        <div style={{ fontSize: 11, color: "#4e5c72", textAlign: "center" as const, marginTop: 10 }}>
          Pagamento seguro via Stripe • Cancele a qualquer momento
        </div>
      </div>
    </div>
  );
}

const RATED_KEY = "tw_has_rated";

// ── Seletor de formato de saída ────────────────────────────────────────────────
const FORMAT_OPTIONS = [
  { id: "story",      label: "Story",      ratio: "9:16", icon: "📱" },
  { id: "square",     label: "Quadrado",   ratio: "1:1",  icon: "⬜" },
  { id: "portrait",   label: "Retrato",    ratio: "4:5",  icon: "🖼" },
  { id: "horizontal", label: "Wide",       ratio: "16:9", icon: "🖥" },
] as const;

function FormatSelector({ value, onChange }: { value: string; onChange: (v: "story"|"square"|"portrait"|"horizontal") => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#4e5c72", fontWeight: 600, marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Formato de saída
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
        {FORMAT_OPTIONS.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              style={{
                flex: "1 1 auto",
                minWidth: 70,
                background: active ? "linear-gradient(135deg,#6366f1,#a855f7)" : "#1a2535",
                border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "8px 6px",
                color: active ? "#fff" : "#8394b0",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                textAlign: "center" as const,
                fontFamily: "Outfit, sans-serif",
                transition: "all 0.15s",
                lineHeight: 1.3,
              }}
            >
              <div style={{ fontSize: 15, marginBottom: 2 }}>{f.icon}</div>
              <div>{f.label}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{f.ratio}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhotoRating({
  rating, hover, feedbackText, sent, loading,
  onHover, onRate, onFeedbackChange, onSubmit, onRetry, onRateApp, bonusLeft,
}: {
  rating: number | null;
  hover: number;
  feedbackText: string;
  sent: boolean;
  loading: boolean;
  onHover: (n: number) => void;
  onRetry?: () => void;
  onRateApp?: () => void;
  bonusLeft?: number;
  onRate: (n: number) => void;
  onFeedbackChange: (s: string) => void;
  onSubmit: () => void;
}) {
  const active = hover || rating || 0;
  const [hasRatedBefore, setHasRatedBefore] = useState(() =>
    typeof window !== "undefined" ? !!localStorage.getItem(RATED_KEY) : true
  );

  function handleRate(n: number) {
    if (!hasRatedBefore) {
      localStorage.setItem(RATED_KEY, "1");
      setHasRatedBefore(true);
    }
    onRate(n);
  }

  if (sent) {
    const isGood = (rating ?? 0) >= 4;
    const isBad = (rating ?? 0) <= 2 && (rating ?? 0) > 0;
    return (
      <div style={{ background: "rgba(22,199,132,0.06)", border: "1px solid rgba(22,199,132,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: (isGood && onRateApp) || (isBad && onRetry && (bonusLeft ?? 0) > 0) ? 10 : 0 }}>
          <img src="/tamo/idle.png" alt="Tamo" style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#16c784", fontWeight: 600 }}>
            {isGood ? "Que bom! Isso me motiva a melhorar 🦎" : "Obrigado! Vou analisar e melhorar! 🦎"}
          </span>
        </div>
        {/* Rating positivo (4-5★) → pede avaliação no app (só Android PWA) */}
        {isGood && onRateApp && (
          <button onClick={onRateApp} style={{ width: "100%", background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10, padding: "10px 14px", color: "#c4b5fd", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <img src="/tamo/idle.png" alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
            Me ajuda com uma avaliação de 5★ na loja?
          </button>
        )}
        {/* Rating negativo — já refez a foto automaticamente */}
        {isBad && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/tamo/idle.png" alt="Tamo" style={{ width: 22, height: 22, objectFit: "contain" }} />
            <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 600 }}>Já estou corrigindo sua foto! 🔄</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
      {/* Banner exclusividade — só antes da primeira avaliação */}
      {!hasRatedBefore && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
          <span style={{ fontSize: 12, color: "#a5b4fc", lineHeight: 1.55 }}>
            Sua avaliação é o que diferencia você dos outros usuários. A IA aprende com cada foto que você cria e avalia — e esse aprendizado é 100% seu, nunca compartilhado.
          </span>
        </div>
      )}
      {/* Linha de estrelas */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: rating !== null && rating <= 3 ? 8 : 0 }}>
        <img src="/tamo/idle.png" alt="Tamo" style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "#8394b0", flexShrink: 0 }}>Como ficou?</span>
        <div style={{ display: "flex", gap: 2 }} onMouseLeave={() => onHover(0)}>
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              onMouseEnter={() => onHover(n)}
              onClick={() => handleRate(n)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", fontSize: 18, lineHeight: 1, color: n <= active ? "#fbbf24" : "#4e5c72", transition: "color 0.1s, transform 0.1s", transform: n <= active ? "scale(1.15)" : "scale(1)" }}
            >★</button>
          ))}
        </div>
      </div>

      {/* Campo de texto — só aparece se nota ruim (≤3) */}
      {rating !== null && rating <= 3 && (
        <div style={{ marginTop: 4 }}>
          <textarea
            value={feedbackText}
            onChange={e => onFeedbackChange(e.target.value)}
            placeholder="Me fala o que não gostou que arrumo agora rapidinho 🦎"
            rows={2}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", color: "#eef2f9", fontSize: 12, fontFamily: "Outfit, sans-serif", resize: "none", boxSizing: "border-box" as const, outline: "none" }}
          />
          <button
            onClick={onSubmit}
            disabled={loading || !feedbackText.trim()}
            style={{ marginTop: 6, background: feedbackText.trim() ? "#7c3aed" : "rgba(124,58,237,0.3)", border: "none", borderRadius: 8, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: feedbackText.trim() ? "pointer" : "not-allowed", fontFamily: "Outfit, sans-serif" }}
          >
            {loading ? "Corrigindo..." : "Arrumar agora →"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProUpsell({ onAssinar }: { onAssinar: (plan: "annual" | "monthly") => void }) {
  const isBR = (typeof navigator !== "undefined" ? navigator.language : "pt-BR").startsWith("pt");

  const BENEFITS = [
    { icon: "🎬", text: "Vídeo animado do produto" },
    { icon: "♾️", text: "Fotos ilimitadas todo mês" },
    { icon: "⚡", text: "Fila prioritária" },
    { icon: "🎨", text: "Todos os estilos desbloqueados" },
  ];

  return (
    <div style={pu.wrap}>
      {/* Header */}
      <div style={pu.header}>
        <div style={pu.badge}>PRO</div>
        <div>
          <div style={pu.title}>Sua foto ficou incrível.</div>
          <div style={pu.subtitle}>Agora imagina com vídeo animado?</div>
        </div>
      </div>

      {/* Benefícios */}
      <div style={pu.benefits}>
        {BENEFITS.map((b) => (
          <div key={b.text} style={pu.benefit}>
            <span style={pu.benefitIcon}>{b.icon}</span>
            <span style={pu.benefitText}>{b.text}</span>
          </div>
        ))}
      </div>

      {/* Preço único */}
      <div style={{ ...pu.planCard, ...pu.planCardActive, width: "100%", boxSizing: "border-box" }}>
        <div style={pu.planName}>{isBR ? "Plano Mensal" : "Annual Plan"}</div>
        <div style={pu.planPrice}>
          <span style={pu.planAmount}>{isBR ? "R$79" : "$100"}</span>
          <span style={pu.planPer}>{isBR ? "/mês" : "/year"}</span>
        </div>
        <div style={pu.planBilled}>
          {isBR ? "Cobrado todo mês · cancele quando quiser" : "Billed once a year · cancel anytime"}
        </div>
      </div>

      {/* CTA */}
      <button onClick={() => onAssinar(isBR ? "monthly" : "annual")} style={pu.btn}>
        {isBR ? "Assinar por R$79/mês" : "Subscribe — $100/year"}
      </button>
      <div style={pu.guarantee}>Cancela quando quiser · Sem fidelidade</div>
    </div>
  );
}

const pu: Record<string, React.CSSProperties> = {
  wrap: {
    width: "100%",
    background: "linear-gradient(160deg, #13102a 0%, #0f1520 60%, #0c1018 100%)",
    border: "1px solid rgba(168,85,247,0.35)",
    borderRadius: 22,
    padding: "24px 18px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    marginTop: 4,
    boxShadow: "0 0 60px rgba(168,85,247,0.18), 0 0 120px rgba(99,102,241,0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  badge: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "0.08em",
    flexShrink: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 13,
    color: "#a78bfa",
    fontWeight: 600,
    marginTop: 2,
  },
  benefits: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  benefit: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  benefitIcon: {
    fontSize: 16,
    flexShrink: 0,
    width: 22,
    textAlign: "center" as const,
  },
  benefitText: {
    fontSize: 13,
    color: "#c4b5fd",
    fontWeight: 500,
  },

  /* Seletor de plano */
  planGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  planCard: {
    background: "rgba(255,255,255,0.03)",
    border: "2px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: "18px 16px",
    cursor: "pointer",
    textAlign: "left" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    position: "relative" as const,
    transition: "border-color 0.2s, background 0.2s",
  },
  planCardActive: {
    border: "2px solid #a855f7",
    background: "rgba(168,85,247,0.1)",
    boxShadow: "0 0 24px rgba(168,85,247,0.2)",
  },
  planBadge: {
    position: "absolute" as const,
    top: -10,
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 99,
    padding: "2px 10px",
    fontSize: 10,
    fontWeight: 800,
    color: "#fff",
    whiteSpace: "nowrap" as const,
  },
  planName: {
    fontSize: 11,
    fontWeight: 700,
    color: "#8394b0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginTop: 8,
  },
  planPrice: {
    display: "flex",
    alignItems: "baseline",
    gap: 2,
    marginTop: 6,
  },
  planAmount: {
    fontSize: 34,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  planPer: {
    fontSize: 13,
    color: "#8394b0",
  },
  planBilled: {
    fontSize: 12,
    color: "#4e5c72",
    marginTop: 4,
  },
  planSave: {
    fontSize: 12,
    color: "#16c784",
    fontWeight: 700,
    marginTop: 2,
  },

  btn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none",
    borderRadius: 16,
    padding: "16px 0",
    color: "#fff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    width: "100%",
    letterSpacing: "-0.01em",
    boxShadow: "0 4px 20px rgba(168,85,247,0.35)",
  },
  guarantee: {
    fontSize: 12,
    color: "#4e5c72",
    textAlign: "center" as const,
  },
};

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan>("free");

  // Bloqueia render completo até resolver o check de onboarding
  // Fonte de verdade: jobs do banco (auth useEffect) — evita conflito entre usuários no mesmo device
  // Não usar localStorage aqui pois o flag pode ser de outro usuário que usou o mesmo browser
  const [onboardingReady, setOnboardingReady] = useState(false);

  // Banner de app (Android / iOS)
  const { appBannerPlatform, setAppBannerPlatform, appBannerDismissed, setAppBannerDismissed } = useAppBanner();

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
  const [formError, setFormError] = useState("");
  const [timeoutError, setTimeoutError] = useState("");
  const [photosToday, setPhotosToday] = useState(0);
  const [freePhotosUsed, setFreePhotosUsed] = useState(() => {
    try {
      const n = parseInt(localStorage.getItem("free_photos_used") ?? "0", 10);
      return isNaN(n) ? 0 : n;
    } catch { return 0; }
  });
  const [pushTrigger, setPushTrigger] = useState<"photo_done" | "rate_limit" | "return_visit" | null>(null);
  const [abVariant, setAbVariant] = useState<"A" | "B" | "C" | null>(null);
  const [showVideoHook, setShowVideoHook] = useState(false);
  const notifiedJobsRef = useRef<Set<string>>(new Set());

  // Photo polling: blur, elapsed, cancel timer — gerenciados pelo hook
  const { blurPx, elapsedSec, showCancel, setShowCancel, resetPolling } = usePhotoPolling({
    job, user, fetchJobStatus, resetJob, setTimeoutError,
  });

  // Progress bar
  const { progressVal, displayProgress, resetProgress } = useProgressBar(job?.id, job?.status ?? undefined);

  // Creation mode
  const [creationMode, setCreationMode] = useState<CreationMode>("simulacao");
  const [modeSelected, setModeSelected] = useState(false); // true = mostra form, false = mostra menu

  // Photo editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [editExpanded, setEditExpanded] = useState(false);
  const [editFreePopup, setEditFreePopup] = useState(false);
  const [removingResultBg, setRemovingResultBg] = useState(false);

  // Formato de saída — compartilhado por todos os tipos de criação
  const [photoFormat, setPhotoFormat] = useState<"story"|"square"|"portrait"|"horizontal">("story");

  // Video state
  const [videoPrompt, setVideoPrompt] = useState("");
  const {
    videoJob, setVideoJob,
    videoElapsedSec,
    videoDisplayProgress,
    videoMode, setVideoMode,
    videoError, setVideoError,
    videoSubmitting, setVideoSubmitting,
    fetchVideoStatus,
    resetVideoJob,
  } = useVideoJob({ user, notifiedJobsRef });

  // Narrated video state
  type NarratedJob = { id: string; status: string; output_video_url?: string; error_message?: string; created_at?: string };
  const {
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
    narratedVoiceMode, setNarratedVoiceMode,
    narratedVoiceSampleUrl, setNarratedVoiceSampleUrl,
    resetNarratedVideo,
  } = useNarratedVideo({ user });

  // Voice recording state
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceBlobs, setVoiceBlobs] = useState<(Blob | null)[]>([null, null, null]);
  const [voiceStep, setVoiceStep] = useState(0);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [voiceEditMode, setVoiceEditMode] = useState(false);
  const [userPhotoForVideo, setUserPhotoForVideo] = useState<File | null>(null);
  const [userPhotoUrlForVideo, setUserPhotoUrlForVideo] = useState("");
  const userPhotoVideoRef = useRef<HTMLInputElement | null>(null);
  const voiceMediaRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const VOICE_TEXTS = [
    { label: "Animado", text: "Gente, olha o que chegou aqui! Esse produto é incrível, eu testei e aprovei. Vocês vão amar!" },
    { label: "Descritivo", text: "Deixa eu te mostrar os detalhes. A qualidade é muito boa, o acabamento é perfeito. Vale cada centavo." },
    { label: "Conversa", text: "Qualquer dúvida me chama aqui que eu respondo tudo. Aproveita que ainda tem disponível." },
  ];

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType });
        setVoiceBlobs(prev => { const next = [...prev]; next[voiceStep] = blob; return next; });
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      voiceMediaRef.current = recorder;
      setVoiceRecording(true);
    } catch {
      alert("Sem permissão para o microfone. Permita o acesso e tente novamente.");
    }
  }

  function stopVoiceRecording() {
    voiceMediaRef.current?.stop();
    voiceMediaRef.current = null;
    setVoiceRecording(false);
  }

  async function uploadVoiceSample(blobs: (Blob | null)[]) {
    const valid = blobs.filter((b): b is Blob => b !== null);
    if (valid.length === 0) return;
    setVoiceUploading(true);
    try {
      const token = await getToken();
      const mimeType = valid[0].type || "audio/webm";
      const combined = new Blob(valid, { type: mimeType });
      const res = await fetch("/api/voice-sample", {
        method: "POST",
        headers: { "Content-Type": mimeType, Authorization: `Bearer ${token}` },
        body: combined,
      });
      if (!res.ok) throw new Error("Falha no upload");
      const { url } = await res.json();
      setNarratedVoiceSampleUrl(url);
      setVoiceEditMode(false);
    } catch {
      alert("Erro ao salvar amostra de voz. Tente novamente.");
    } finally {
      setVoiceUploading(false);
    }
  }

  // Long video state
  type LongVideoJob = { id: string; status: string; output_video_url?: string; clip_urls?: string[]; error_message?: string; created_at?: string };
  const {
    longVideoJob, setLongVideoJob,
    longVideoMode, setLongVideoMode,
    longVideoSubmitting, setLongVideoSubmitting,
    longVideoError, setLongVideoError,
    longVideoElapsed,
    resetLongVideoJob,
  } = useLongVideo({ user });

  const { rateLimitedUntil, setRateLimitedUntil, countdown } = useRateLimit(plan, job);
  const vision = useProductVision();

  // Rating de qualidade da foto gerada
  const [photoRating, setPhotoRating] = useState<number | null>(null);
  const [ratingHover, setRatingHover] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Bonus de retry por rating negativo — máx 3/dia, tracked no localStorage
  const BONUS_KEY = "bonus_retry_v1";
  const [bonusLeft, setBonusLeft] = useState(() => {
    try {
      const raw = localStorage.getItem(BONUS_KEY);
      if (!raw) return 3;
      const { count, date } = JSON.parse(raw);
      const today = new Date().toDateString();
      if (date !== today) return 3; // reseta diariamente
      return Math.max(0, 3 - (count ?? 0));
    } catch { return 3; }
  });
  const [isBonusRetry, setIsBonusRetry] = useState(false);

  // Avaliação do app (Play Store) — só mostra uma vez
  const APP_RATED_KEY = "app_store_rated";
  const [showRateApp, setShowRateApp] = useState(false);
  // Detecta se está no Android PWA (standalone)
  useEffect(() => {
    try {
      const isAndroid = /android/i.test(navigator.userAgent);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const alreadyRated = !!localStorage.getItem(APP_RATED_KEY);
      if (isAndroid && isStandalone && !alreadyRated) setShowRateApp(true);
    } catch { /* ignora */ }
  }, []);

  // Upsell popup A/B
  const [showUpsell, setShowUpsell] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState(false); // veio do onboarding → funil ativo
  const [showConversion, setShowConversion] = useState(false); // tela de conversão pós-foto
  const onboardingDataRef = useRef<{ file: File; produto: string; cenario: string } | null>(null);

  // TamoBot — persiste em localStorage para sobreviver ao reload
  const [botActive, setBotActive] = useState(() => {
    try { return localStorage.getItem("bot_active_24h") === "1"; } catch { return false; }
  });
  const [botNavOpen, setBotNavOpen] = useState(false);
  const [hasDoneJob, setHasDoneJob] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [botTriggerMessage, setBotTriggerMessage] = useState<string | undefined>(undefined);

  function activateBot() {
    setBotActive(true);
    try { localStorage.setItem("bot_active_24h", "1"); } catch { /* ignora */ }
  }

  // warmupVision desabilitado — carrega sob demanda ao subir foto

  useEffect(() => {
    // Safety timeout reduzido para 5s — último recurso se tudo travar
    const safetyTimeout = setTimeout(() => {
      setOnboardingReady(true);
    }, 5_000);

    let ran = false;

    const run = async (user: import("@supabase/supabase-js").User | null, accessToken?: string) => {
      if (!user) {
        clearTimeout(safetyTimeout);
        router.push("/login");
        return;
      }

      // Usuário confirmado: libera tela imediatamente, dados carregam em background
      setUser(user);
      clearTimeout(safetyTimeout);
      setOnboardingReady(true);
      console.log("[tamo] run() user:", user.id, user.email);

      try {

      // Usa o token recebido diretamente (onAuthStateChange já tem a sessão)
      // Fallback: getSession() para o caso do getUser() backup
      let token = accessToken ?? "";
      if (!token) {
        const { data: sd } = await supabase.auth.getSession();
        token = sd.session?.access_token ?? "";
      }
      // Se ainda sem token, tenta refresh
      if (!token) {
        const { data: rd } = await supabase.auth.refreshSession();
        token = rd.session?.access_token ?? "";
      }
      let resolvedPlan: Plan = "free";
      let hasActivePhotoJob = false;

      // Pré-ativação Stripe legacy: verifica se o email está na fila de ativação
      if (user.email) {
        const { data: pending } = await supabase
          .from("stripe_pending_pro")
          .select("period_end")
          .eq("email", user.email.toLowerCase())
          .single();
        if (pending) {
          // Ativa PRO via API interna
          await fetch("/api/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ plan: "pro", period_end: pending.period_end, source: "stripe_legacy" }),
          }).catch(() => {});
          // Remove da fila
          await supabase.from("stripe_pending_pro").delete().eq("email", user.email.toLowerCase());
        }
      }

      // Timeout de 6s na chamada de jobs — não pode ficar pendurado infinitamente
      const res = await fetch("/api/image-jobs", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) {
        // Falha na API de jobs — apenas finaliza loading (tela já está visível)
      } else if (res.ok) {
        const data = await res.json();
        // API retorna { jobs, plan }
        const jobs: Job[] = Array.isArray(data) ? data : (data.jobs ?? []);
        const userPlan: Plan = data.plan ?? "free";
        resolvedPlan = userPlan;
        setPlan(userPlan);

        // Mostra upsell popup após 4s para usuários free (1x por dia)
        if (userPlan === "free") {
          const { shouldShowUpsell } = await import("@/app/components/UpsellPopup");
          if (shouldShowUpsell()) {
            setTimeout(() => setShowUpsell(true), 4000);
          }
        }

        // Se o usuário já tem jobs, marca onboarding como completo (fonte de verdade = banco)
        if (jobs.length > 0) {
          try {
            localStorage.setItem("onboarding_completed", "1");
            if (user?.id) localStorage.setItem(`onboarding_completed_${user.id}`, "1");
          } catch { /* ignora */ }
        }

        // Upsell popup removido da entrada — não empurrar venda antes do usuário ver valor

        const active = jobs.find(
          (j) => j.status !== "done" && j.status !== "failed" && j.status !== "canceled"
        );
        if (active) {
          hasActivePhotoJob = true;
          setJob(active);
          if (active.input_image_url) setPreview(active.input_image_url);
          try {
            sessionStorage.setItem("tamo_active_job", JSON.stringify({ id: active.id, input_image_url: active.input_image_url }));
            sessionStorage.setItem("pending_job_id", active.id);
          } catch { /* ignora */ }
        } else {
          // Restaura o job done mais recente (criado nas últimas 24h) para mostrar resultado
          // Ignora jobs que o usuário descartou explicitamente (clicou em "criar nova foto")
          const dismissedIds: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
          const recentDone = jobs.find(
            (j) => j.status === "done" && j.output_image_url &&
            !dismissedIds.includes(j.id) &&
            new Date(j.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000
          );
          if (recentDone) {
            setJob(recentDone);
            try { sessionStorage.removeItem("pending_job_id"); } catch { /* ignora */ }
          } else {
            // Nenhum job ativo nem done recente — verifica se há um job pendente salvo no sessionStorage
            try {
              const pendingJobId = sessionStorage.getItem("pending_job_id");
              if (pendingJobId && !dismissedIds.includes(pendingJobId)) {
                const pres = await fetch(`/api/image-jobs/${pendingJobId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (pres.ok) {
                  const pjob = await pres.json();
                  if (pjob?.id && pjob.status !== "canceled") {
                    hasActivePhotoJob = pjob.status !== "done" && pjob.status !== "failed";
                    setJob(pjob);
                    if (pjob.input_image_url) setPreview(pjob.input_image_url);
                  } else {
                    sessionStorage.removeItem("pending_job_id");
                  }
                } else {
                  sessionStorage.removeItem("pending_job_id");
                }
              }
            } catch { /* ignora */ }
          }
        }

        // Detecta rate limit no carregamento: free user com 2+ jobs COMPLETOS recentes (<24h)
        if (userPlan === "free") {
          const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
          const FREE_DAILY_LIMIT = 3;
          const since = Date.now() - FREE_COOLDOWN_MS;
          const recentDoneJobs = jobs
            .filter((j) => j.status === "done" && new Date(j.created_at ?? 0).getTime() > since)
            .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
          setPhotosToday(recentDoneJobs.length);
          if (recentDoneJobs.length >= FREE_DAILY_LIMIT) {
            const oldest = recentDoneJobs[0];
            const nextAvailable = new Date(new Date(oldest.created_at ?? 0).getTime() + FREE_COOLDOWN_MS);
            if (nextAvailable > new Date()) {
              setRateLimitedUntil(nextAvailable);
              // Gatilho de push — limite atingido é bom momento para engajar
              if (typeof Notification !== "undefined" && Notification.permission === "default") {
                setTimeout(() => setPushTrigger("rate_limit"), 2000);
              }
            }
          }
        }

        // Todo usuário novo (qualquer plano) que não completou onboarding vai para /onboarding
        // Fonte de verdade: jobs no banco (inclui failed/done). O flag localStorage pode
        // pertencer a outro usuário no mesmo browser — não confiar como única fonte.
        console.log("[tamo] jobs:", jobs.length, "| hasActivePhotoJob:", hasActivePhotoJob);

        // Gatilho return_visit: já criou fotos antes mas não tem push ativo
        // Não mostrar enquanto há job ativo para não interromper o fluxo
        const hasDoneJobs = jobs.some((j) => j.status === "done");
        const hasActiveJob = jobs.some((j) => ["queued","submitted","processing"].includes(j.status ?? ""));
        if (hasDoneJobs && !hasActiveJob && typeof Notification !== "undefined" && Notification.permission === "default") {
          setTimeout(() => setPushTrigger("return_visit"), 5000);
        }
      }

      // Restaura estado de vídeo ao recarregar a página
      const vres = await fetch("/api/video-jobs", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6_000),
      });
      if (vres.ok) {
        const vdata: VideoJob[] = await vres.json();
        const activeVideo = vdata.find(
          (v) => v.status !== "done" && v.status !== "failed" && v.status !== "canceled"
        );
        // Só restaura vídeo done se foi criado nas últimas 24h e não foi descartado pelo usuário
        const dismissedVideoIds: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
        const doneVideo = vdata.find(
          (v) => v.status === "done" &&
          !dismissedVideoIds.includes(v.id) &&
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

      // Restaura vídeo narrado ativo/recente
      const nres = await fetch("/api/narrated-video", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6_000) });
      if (nres.ok) {
        const ndata: NarratedJob[] = await nres.json();
        const dismissedNarrated: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
        const activeNarrated = ndata.find((v) => !["done", "failed", "canceled"].includes(v.status));
        const doneNarrated = ndata.find(
          (v) => v.status === "done" && v.output_video_url &&
          !dismissedNarrated.includes(v.id) &&
          new Date(v.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );
        if (activeNarrated) {
          setNarratedJob(activeNarrated);
          setNarratedMode(true);
          setCreationMode("video_narrado");
          setModeSelected(true);
        } else if (doneNarrated) {
          setNarratedJob(doneNarrated);
          setNarratedMode(true);
          setCreationMode("video_narrado");
          setModeSelected(true);
        }
      }

      // Restaura vídeo longo ativo/recente
      const lres = await fetch("/api/long-video", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6_000) });
      if (lres.ok) {
        const ldata: LongVideoJob[] = await lres.json();
        const dismissedLong: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
        const activeLong = ldata.find((v) => !["done", "failed", "canceled"].includes(v.status));
        const doneLong = ldata.find(
          (v) => v.status === "done" && v.output_video_url &&
          !dismissedLong.includes(v.id) &&
          new Date(v.created_at ?? 0).getTime() > Date.now() - 24 * 60 * 60 * 1000
        );
        if (activeLong) {
          setLongVideoJob(activeLong);
          setLongVideoMode(true);
          setCreationMode("video_longo");
          setModeSelected(true);
        } else if (doneLong) {
          setLongVideoJob(doneLong);
          setLongVideoMode(true);
          setCreationMode("video_longo");
          setModeSelected(true);
        }
      }

      // Vindo de Criações: abrir modo vídeo para um job específico
      const videoFromJob = sessionStorage.getItem("video_from_job");
      if (videoFromJob && !hasActivePhotoJob) {
        sessionStorage.removeItem("video_from_job");
        const { data: session2 } = await supabase.auth.getSession();
        const t2 = session2.session?.access_token ?? "";
        const jr = await fetch(`/api/image-jobs/${videoFromJob}`, { headers: { Authorization: `Bearer ${t2}` } });
        if (jr.ok) {
          const j = await jr.json();
          if (j.status === "done" && j.output_image_url) {
            setJob(j);
            setModeSelected(true);
            // Usa resolvedPlan (local) em vez de plan (React state ainda stale)
            if (resolvedPlan === "pro") setVideoMode(true);
          }
        }
      } else if (videoFromJob && hasActivePhotoJob) {
        // Tem foto sendo gerada — ignora pedido de vídeo, limpa sessionStorage
        sessionStorage.removeItem("video_from_job");
      }

      setLoading(false);

      } catch {
        // Erro/timeout — tela já está visível, só finaliza loading
        setLoading(false);
      }
    };

    // PRIMARY: onAuthStateChange — passa token direto para evitar getSession() null
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      if (ran) return; ran = true;
      run(session.user, session.access_token); // token direto da sessão
    });

    // BACKUP: getUser() server-side — cobre mobile e "sem sessão → login"
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (ran) return; ran = true;
      run(user); // sem token → run() vai fazer refresh
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [router]);

  // Marca job como "visto" no localStorage quando o resultado aparece na tela
  // Isso evita que o resultado reapareça em novas sessões/recargas
  const seenJobRef = useRef<string | null>(null);
  useEffect(() => {
    const id = job?.status === "done" && job.output_image_url && job.id !== "rate_limited" ? job.id : null;
    if (id && id !== seenJobRef.current) {
      seenJobRef.current = id;
      setTimeout(() => {
        try {
          const dismissed: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
          if (!dismissed.includes(id)) { dismissed.push(id); localStorage.setItem("dismissed_jobs", JSON.stringify(dismissed.slice(-50))); }
        } catch { /* ignora */ }
      }, 1500);
    }
  }, [job?.status, job?.id, job?.output_image_url]);

  const seenNarratedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = narratedJob?.status === "done" && narratedJob.output_video_url ? narratedJob.id : null;
    if (id && id !== seenNarratedRef.current) {
      seenNarratedRef.current = id;
      setTimeout(() => {
        try {
          const dismissed: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
          if (!dismissed.includes(id)) { dismissed.push(id); localStorage.setItem("dismissed_jobs", JSON.stringify(dismissed.slice(-50))); }
        } catch { /* ignora */ }
      }, 1500);
    }
  }, [narratedJob?.status, narratedJob?.id, narratedJob?.output_video_url]);

  const seenVideoRef = useRef<string | null>(null);
  useEffect(() => {
    const id = videoJob?.status === "done" && videoJob.output_video_url ? videoJob.id : null;
    if (id && id !== seenVideoRef.current) {
      seenVideoRef.current = id;
      setTimeout(() => {
        try {
          const dismissed: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
          if (!dismissed.includes(id)) { dismissed.push(id); localStorage.setItem("dismissed_jobs", JSON.stringify(dismissed.slice(-50))); }
        } catch { /* ignora */ }
      }, 1500);
    }
  }, [videoJob?.status, videoJob?.id, videoJob?.output_video_url]);

  // Quando foto fica pronta: mostra mini toast + badge em Criações + fecha Tamo se aberto
  const toastFiredRef = useRef(false);
  useEffect(() => {
    if (job?.status === "done" && job.output_image_url && job.id !== "rate_limited") {
      // Resultado fica dentro do Tamo — não fecha automaticamente
      if (!toastFiredRef.current) {
        toastFiredRef.current = true;
        setToastMessage("Sua foto ficou pronta!");
        setShowToast(true);
        setHasDoneJob(true);
      }
    } else {
      toastFiredRef.current = false;
    }
  }, [job?.status, job?.output_image_url]);

  // Funil onboarding: quando foto fica pronta, mostra tela de conversão
  useEffect(() => {
    if (!onboardingMode) return;
    if (job?.status === "done" && job.output_image_url) {
      setShowConversion(true);
    } else if (job?.status === "failed" || job?.status === "canceled") {
      setOnboardingMode(false); // reseta se falhou — evita estado preso
    }
  }, [onboardingMode, job?.status, job?.output_image_url]);

  // Timeout automático: usa setTimeout único em vez de checar a cada 1s (elapsedSec)
  useEffect(() => {
    if (!job || workState !== "trabalhando") return;
    const status = job.status;
    if (status === "done" || status === "failed" || status === "canceled") return;
    // queued/submitted: até 90 min (fila pode ter muitos jobs)
    // processing: 15 min (já está rodando, não deve demorar tanto)
    const limitSec = (status === "queued" || status === "submitted") ? 5400 : 900;
    const startTime = job.created_at ? new Date(job.created_at).getTime() : Date.now();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = limitSec - elapsed;
    if (remaining <= 0) {
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
      return;
    }
    const t = setTimeout(() => {
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
    }, remaining * 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, job?.created_at]);

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

  async function sendPhotoFeedback(rating: number, text: string) {
    if (feedbackSent || feedbackLoading) return;
    setFeedbackLoading(true);
    try {
      const token = await getToken();

      // Salva feedback no banco (sempre)
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          job_id: job?.id ?? null,
          rating,
          feedback_text: text || null,
          product_name: produto || null,
          input_url: job?.input_image_url ?? null,
          output_url: job?.output_image_url ?? null,
        }),
      });

      // Nota ruim + feedback escrito + bonus disponível → refaz a foto já com a correção
      if (rating <= 2 && text.trim() && bonusLeft > 0) {
        // Decrementa bonus
        try {
          const today = new Date().toDateString();
          const raw = localStorage.getItem(BONUS_KEY);
          const prev = raw ? JSON.parse(raw) : { count: 0, date: today };
          const used = prev.date === today ? (prev.count ?? 0) + 1 : 1;
          localStorage.setItem(BONUS_KEY, JSON.stringify({ count: used, date: today }));
          setBonusLeft(Math.max(0, 3 - used));
        } catch { /* ignora */ }

        // Monta prompt com a correção embutida
        const basePrompt = cenario.trim()
          ? `${produto} | cenário: ${cenario} | correcao: ${text.trim()}`
          : `${produto} | correcao: ${text.trim()}`;

        const jobRes = await fetch("/api/image-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            prompt: basePrompt,
            input_image_url: job?.input_image_url,
            format: photoFormat,
            bonus_retry: true,
          }),
        });

        if (jobRes.ok) {
          const { jobId } = await jobRes.json();
          try {
            sessionStorage.setItem("pending_job_id", jobId);
            sessionStorage.setItem("tamo_active_job", JSON.stringify({ id: jobId, input_image_url: job?.input_image_url }));
          } catch { /* ignora */ }
          setPhotoRating(null);
          setFeedbackText("");
          setRatingHover(0);
          router.push("/tamo");
          return;
        }
      }

      setFeedbackSent(true);
    } catch { /* ignora erros silenciosamente */ } finally {
      setFeedbackLoading(false);
    }
  }

  function handleBonusRetry() {
    if (bonusLeft <= 0) return;
    try {
      const today = new Date().toDateString();
      const raw = localStorage.getItem(BONUS_KEY);
      const prev = raw ? JSON.parse(raw) : { count: 0, date: today };
      const used = prev.date === today ? (prev.count ?? 0) + 1 : 1;
      localStorage.setItem(BONUS_KEY, JSON.stringify({ count: used, date: today }));
      setBonusLeft(Math.max(0, 3 - used));
    } catch { /* ignora */ }
    setIsBonusRetry(true);
    resetJob();
  }

  function handleRateApp() {
    try { localStorage.setItem(APP_RATED_KEY, "1"); } catch { /* ignora */ }
    setShowRateApp(false);
    // Abre Play Store na página do app (substitua pelo package name real)
    window.open("market://details?id=com.tamowork.app", "_blank");
  }

  // Registra subscription de Web Push no Service Worker
  async function registerPushSubscription(tok: string) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const VAPID_PUBLIC = "BOFpGK6deSOtMczLOppZ8RXLb8XbAP0cs4hDHOZtJrDsnLhvzdPQXeojc5CohPhnj0PvNkPd7B7HKLtUva03cGk";
      const padding = "=".repeat((4 - (VAPID_PUBLIC.length % 4)) % 4);
      const base64 = (VAPID_PUBLIC + padding).replace(/-/g, "+").replace(/_/g, "/");
      const raw = atob(base64);
      const key = Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
    } catch {}
  }

  // Pede permissão e registra — chamado após primeira foto pronta
  async function trackABEvent(event: string, variant: string) {
    try {
      const tok = await getToken();
      await fetch("/api/ab/event", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ event, variant }),
      });
    } catch {}
  }

  async function fetchABVariant(): Promise<"A" | "B" | "C"> {
    try {
      const tok = await getToken();
      const res = await fetch("/api/ab/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      });
      const { variant } = await res.json();
      return variant as "A" | "B" | "C";
    } catch { return "A"; }
  }

  async function syncPushStatus(status: "enabled" | "denied" | "skipped") {
    try {
      const tok = await getToken();
      await fetch("/api/push/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ status }),
      });
    } catch {}
  }

  async function requestAndRegisterPush() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "denied") {
      syncPushStatus("denied");
      return;
    }
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        syncPushStatus("denied");
        return;
      }
    }
    const tok = await getToken();
    await registerPushSubscription(tok);
    syncPushStatus("enabled");
  }

  // Envia notificação via servidor (Web Push real — funciona com app fechado)
  async function sendPushNotification(title: string, body: string) {
    try {
      const tok = await getToken();
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ title, body, url: "/" }),
      });
    } catch {}
  }

  async function fetchJobStatus(jobId: string) {
    const token = await getToken();
    const res = await fetch(`/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok) return;
    const data: Job = await res.json();
    if (data.status === "done") {
      // A/B test — dispara na 1ª foto de usuários free
      let variant = abVariant;
      if (!variant) {
        // Se o agente promoveu uma variante vencedora, usa ela para todos
        variant = CONVERSION.abPromotedVariant ?? await fetchABVariant();
        setAbVariant(variant);
      }
      // photosToday ainda é o valor anterior (antes do setPhotosToday acima)
      // Se for 0, é a 1ª foto
      setPhotosToday((prev) => {
        if (prev === 0 && variant && plan === "free") {
          trackABEvent("photo1_done", variant);
          if (variant === "B") {
            setTimeout(() => setShowConversion(true), 800);
          } else if (variant === "C") {
            setTimeout(() => setShowVideoHook(true), 800);
          }
        }
        return Math.max(prev, prev + 1 <= 2 ? prev + 1 : prev);
      });
      if (plan === "free") {
        setFreePhotosUsed((prev) => {
          const next = prev + 1;
          try { localStorage.setItem("free_photos_used", String(next)); } catch { /* ignora */ }
          return next;
        });
      }

      // Gatilho de conversão de push — só se ainda não tem permissão
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        setPushTrigger("photo_done");
      } else {
        await requestAndRegisterPush();
      }
      if (!notifiedJobsRef.current.has(jobId)) {
        notifiedJobsRef.current.add(jobId);
        await sendPushNotification(
          lang === "en" ? "Done! Here's how it turned out 👇" : lang === "es" ? "¡Listo! Así quedó 👇" : "Pronto! Ficou assim 👇",
          lang === "en" ? "Tap to see the photo I created for you." : lang === "es" ? "Toca para ver la foto que creé para ti." : "Toque para ver a foto que criei pra você."
        );
      }
    } else if (data.status === "failed") {
      sendPushNotification(
        lang === "en" ? "Generation error" : lang === "es" ? "Error en la generación" : "Erro na geração",
        lang === "en" ? "Could not generate the photo. Please try again." : lang === "es" ? "No se pudo generar la foto. Inténtalo de nuevo." : "Não foi possível gerar a foto. Tente novamente."
      );
    }
    setJob(data);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
      vision.reset();
    }
  }

  // Processa fundo branco no browser via WebAssembly (sem servidor)
  async function processWhiteBackground(file: File): Promise<File> {
    const { removeBackground } = await import("@imgly/background-removal");
    // Remove fundo → blob PNG transparente
    // proxyToWorker:false evita problemas de URL de worker no Next.js
    // Timeout de 90s: modelo WASM pesado, mobile lento pode demorar
    const noBgBlob = await Promise.race([
      removeBackground(file, {
        proxyToWorker: false,
        output: { format: "image/png" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          lang === "en" ? "Background removal timed out. Please try a smaller photo or try again."
          : lang === "es" ? "Tiempo de espera agotado. Intente con una foto más pequeña o vuelva a intentarlo."
          : "Tempo esgotado ao remover fundo. Tente com uma foto menor ou tente novamente."
        )), 90_000)
      ),
    ]);
    // Compõe sobre fundo branco usando Canvas
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(noBgBlob);
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], "whitebg.jpg", { type: "image/jpeg" }));
          else reject(new Error("Canvas toBlob falhou"));
        }, "image/jpeg", 0.92);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // Comprime e redimensiona qualquer imagem para JPEG max 2048px, ~1-2MB
  async function convertToJpegIfNeeded(file: File): Promise<File> {
    const MAX_DIM = 2048;
    const QUALITY = 0.88;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { naturalWidth: w, naturalHeight: h } = img;
        // Redimensiona se necessário
        if (w > MAX_DIM || h > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          else resolve(file);
        }, "image/jpeg", QUALITY);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // Faz upload de imagem via base64 JSON — mais confiável no iOS Safari
  // (FormData+File via fetch falha silenciosamente no WebKit com "Load failed")
  async function uploadImage(file: File, token: string): Promise<string> {
    const fileToUpload = await convertToJpegIfNeeded(file);
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(fileToUpload);
    });
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data_url: dataUrl, name: fileToUpload.name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? `Falha ao enviar imagem (${res.status})`);
    }
    const { url } = await res.json();
    return url as string;
  }

  async function handleSubmit(
    e: React.FormEvent,
    overrides?: { file?: File; produto?: string; cenario?: string; mode?: CreationMode }
  ) {
    e.preventDefault();
    if (submitting) return; // guard contra double-submit
    if (isPhotoJobActive) return; // guard contra foto dupla (Enter no teclado)

    const _mode    = overrides?.mode    ?? creationMode;
    const _file    = overrides?.file    ?? imageFile;
    const _produto = overrides?.produto ?? produto;
    const _cenario = overrides?.cenario ?? cenario;

    // Modo vídeo com narração: gerenciado pelo próprio componente — não passa por aqui
    if (_mode === "video_narrado") return;

    // Modo vídeo: rota separada
    if (_mode === "video") {
      if (!_file) { setVideoError("Envie uma foto"); return; }
      setFormError("");
      setVideoError("");
      setVideoSubmitting(true);
      try {
        const token = await getToken();
        const imageUrl = await uploadImage(_file, token);
        await handleVideoSubmit(imageUrl);
        setVideoMode(true);
      } catch (err) {
        setVideoError(err instanceof Error ? err.message : "Erro ao iniciar vídeo");
      } finally {
        setVideoSubmitting(false);
      }
      return;
    }

    if (_mode === "catalogo" && !modelFile && !modelPreview) { setFormError(lang === "en" ? "Choose a model" : lang === "es" ? "Elige un modelo" : "Escolha um modelo"); return; }
    if (!_file) { setFormError(lang === "en" ? "Upload the product photo" : lang === "es" ? "Sube la foto del producto" : "Envie a foto do produto"); return; }
    // produto_exposto: visão lê tudo, não precisa de texto nem cenário
    const modeNeedsProduct = _mode !== "produto_exposto";
    const modeNeedsCenario = _mode !== "fundo_branco" && _mode !== "produto_exposto";
    if (modeNeedsProduct && !_produto.trim()) { setFormError(lang === "en" ? "Describe the product" : lang === "es" ? "Describe el produto" : "Descreva o produto"); return; }
    if (modeNeedsCenario && !_cenario.trim()) { setFormError(lang === "en" ? "Describe the photo scene" : lang === "es" ? "Describe la escena de la foto" : "Descreva o cenário da foto"); return; }

    setFormError("");
    setTimeoutError("");
    setSubmitting(true);
    setJob(null);
    // Limpa resultados done de outros tipos para evitar conflito de exibição
    if (narratedJob && ["done", "failed", "canceled"].includes(narratedJob.status)) resetNarrated();
    if (videoJob && ["done", "failed", "canceled"].includes(videoJob.status ?? "")) resetVideo();
    if (longVideoJob && ["done", "failed", "canceled"].includes(longVideoJob.status)) resetLongVideo();

    try {
      const token = await getToken();

      // Upload da imagem do produto
      const imageUrl = await uploadImage(_file!, token);

      // Fundo branco: processa no browser (WebAssembly), depois registra job
      if (_mode === "fundo_branco") {
        const prompt = `${_produto} | fundo branco`;

        // 1. Converte para JPEG e processa no browser — remove fundo + adiciona branco
        const fileToUpload = await convertToJpegIfNeeded(_file!);
        const processedFile = await processWhiteBackground(fileToUpload);

        // 2. Faz upload da imagem já processada
        const outputUrl = await uploadImage(processedFile, token);

        // 3. Registra job como "done" (rate limit + job creation no servidor)
        const res = await fetch("/api/white-bg", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt, input_image_url: imageUrl, output_image_url: outputUrl }),
        });

        if (res.status === 429) {
          const err = await res.json().catch(() => ({}));
          const nextAt = err.nextAvailableAt ? new Date(err.nextAvailableAt) : null;
          const validAt = nextAt && !isNaN(nextAt.getTime()) && nextAt > new Date() ? nextAt : new Date(Date.now() + 60 * 60 * 1000);
          setRateLimitedUntil(validAt);
          setJob(null);
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
      if (_mode === "catalogo" && !modelFile && modelPreview?.startsWith("http")) {
        // Modelo do catálogo — usa URL diretamente
        modelImageUrl = modelPreview;
      } else if (_mode === "catalogo" && modelFile) {
        modelImageUrl = await uploadImage(modelFile, token);
      }

      // Monta prompt — cada modo tem seu formato
      // produto_exposto: prefixo [produto_exposto] + produto opcional (visão resolve o resto)
      // catálogo: model_img:URL | produto | cenário
      // demais: produto | cenário
      let basePrompt: string;
      if (_mode === "produto_exposto") {
        basePrompt = `[produto_exposto] ${_produto.trim()}`.trim();
      } else {
        basePrompt = _cenario.trim() ? `${_produto} | cenário: ${_cenario}` : _produto;
      }
      const prompt = modelImageUrl
        ? `model_img:${modelImageUrl} | ${basePrompt}`
        : basePrompt;

      const jobRes = await fetch("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, input_image_url: imageUrl, mode: _mode, format: photoFormat, ...(isBonusRetry ? { bonus_retry: true } : {}) }),
      });

      if (jobRes.status === 429) {
        const err = await jobRes.json().catch(() => ({}));
        const nextAt = err.nextAvailableAt ? new Date(err.nextAvailableAt) : null;
        const validAt = nextAt && !isNaN(nextAt.getTime()) && nextAt > new Date() ? nextAt : new Date(Date.now() + 60 * 60 * 1000);
        setRateLimitedUntil(validAt);
        setJob(null); // não deixa spinner infinito — volta para tela de limite diário
        setSubmitting(false);
        return;
      }

      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Falha ao criar job");
      }
      const { jobId } = await jobRes.json();

      // Persiste o ID do job no sessionStorage para restaurar na página /tamo
      try {
        sessionStorage.setItem("pending_job_id", jobId);
        sessionStorage.setItem("tamo_active_job", JSON.stringify({ id: jobId, input_image_url: imageUrl }));
      } catch { /* ignora */ }

      setIsBonusRetry(false);
      setModeSelected(false);
      router.push("/tamo");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssinarDireto(_selectedPlan?: "annual" | "monthly", source?: string) {
    // Rastreia clique de CTA no A/B test
    if (abVariant) trackABEvent("cta_clicked", abVariant);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      // BR → mensal R$79 | não-BR → anual $100 (como na página de planos)
      const isBR = (typeof navigator !== "undefined" ? navigator.language : "pt-BR").startsWith("pt");
      const plan = isBR ? "monthly" : "annual";
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, source: source ?? "app" }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else router.push("/planos");
    } catch {
      router.push("/planos");
    }
  }

  async function handleRemoveResultBg() {
    const url = editedImageUrl ?? job?.output_image_url;
    if (!url) return;
    setRemovingResultBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const res = await fetch(url);
      const blob = await res.blob();
      const noBgBlob = await removeBackground(blob, { proxyToWorker: false, output: { format: "image/png" } });
      setEditedImageUrl(URL.createObjectURL(noBgBlob));
    } catch {
      alert(lang === "en" ? "Could not remove background. Try again." : "Não foi possível remover o fundo. Tente novamente.");
    } finally {
      setRemovingResultBg(false);
    }
  }

  function resetJob() {
    // Marca o job atual como descartado para evitar restauração automática
    if (job?.id) {
      try {
        const dismissed: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
        if (!dismissed.includes(job.id)) {
          dismissed.push(job.id);
          localStorage.setItem("dismissed_jobs", JSON.stringify(dismissed));
        }
      } catch { /* ignora */ }
    }
    // Limpa job pendente salvo no sessionStorage
    try {
      sessionStorage.removeItem("pending_job_id");
      sessionStorage.removeItem("tamo_active_job");
    } catch { /* ignora */ }
    vision.reset();
    resetPolling();
    resetProgress();
    setJob(null);
    setBotNavOpen(false);
    setTimeoutError("");
    setFormError("");
    setProduto("");
    setCenario("");
    setImageFile(null);
    setPreview(null);
    setModelFile(null);
    setModelPreview(null);
    setModeSelected(false); // volta para o menu
    setEditExpanded(false);
    setEditedImageUrl(null); // limpa imagem editada para não vazar na próxima criação
    // Reseta rating
    setPhotoRating(null);
    setRatingHover(0);
    setFeedbackText("");
    setFeedbackSent(false);
    setFeedbackLoading(false);
    // Limpa videoJob concluído — evita que o botão "Criar vídeo" persista na nova foto
    if (videoJob && ["done", "canceled", "failed"].includes(videoJob.status ?? "")) {
      resetVideo();
    }
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

  async function handleVideoSubmit(rawImageUrl: string) {
    // Sanitiza URL malformada (ex: "https://htpps::https://storage...")
    let imageUrl = String(rawImageUrl).trim();
    imageUrl = imageUrl.replace(/^https?:\/\/[^/]{1,30}::https?:\/\//i, "https://");
    imageUrl = imageUrl.replace(/^https?:\/\/https?:\/\//i, "https://");
    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) imageUrl = "https://" + imageUrl;

    setVideoError("");
    setVideoSubmitting(true);
    // Limpa resultados done de outros tipos para evitar conflito de exibição
    if (narratedJob && ["done", "failed", "canceled"].includes(narratedJob.status)) resetNarrated();
    if (longVideoJob && ["done", "failed", "canceled"].includes(longVideoJob.status)) resetLongVideo();

    try {
      const token = await getToken();
      const res = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: videoPrompt, input_image_url: imageUrl, format: photoFormat }),
      });
      if (res.status === 403) { setVideoError("Disponível apenas no plano Pro."); return; }
      if (res.status === 503) { setVideoError("queue_busy"); return; }
      if (!res.ok) throw new Error("Erro ao criar job de vídeo");
      const { jobId } = await res.json();
      setVideoJob({ id: jobId, status: "queued" });
      setModeSelected(false);
      try {
        sessionStorage.setItem("pending_video_job_id", jobId);
        sessionStorage.setItem("pending_video_job_type", "video");
      } catch { /* ignora */ }
      router.push("/tamo");
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Erro");
    } finally {
      setVideoSubmitting(false);
    }
  }

  async function loadNarratedDonePhotos() {
    try {
      const token = await getToken();
      const res = await fetch("/api/image-jobs", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const jobs: { id: string; status: string; output_image_url?: string }[] = Array.isArray(data) ? data : (data.jobs ?? []);
      const done = jobs.filter((j) => j.status === "done" && j.output_image_url).slice(0, 20) as { id: string; output_image_url: string }[];
      setNarratedDonePhotos(done);
    } catch { /* ignora */ }
  }

  function toggleNarratedScene(url: string) {
    setNarratedSelectedScenes((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  async function handleNarratedSubmit() {
    if (narratedSceneSource === "generate" && !imageFile) {
      setNarratedError("Envie uma foto do produto"); return;
    }
    if (narratedSceneSource === "existing" && narratedSelectedScenes.length < 2) {
      setNarratedError("Selecione pelo menos 2 fotos para as cenas"); return;
    }
    if (!narratedRoteiro.trim()) { setNarratedError("Escreva o roteiro — o que você quer dizer no vídeo"); return; }
    setNarratedError("");
    setNarratedSubmitting(true);
    // Limpa resultados done de outros tipos para evitar conflito de exibição
    if (job && ["done", "failed", "canceled"].includes(job.status ?? "")) resetJob();
    if (videoJob && ["done", "failed", "canceled"].includes(videoJob.status ?? "")) resetVideo();
    if (longVideoJob && ["done", "failed", "canceled"].includes(longVideoJob.status)) resetLongVideo();

    try {
      const token = await getToken();
      let imageUrl: string | undefined;
      let userPhotoUrl: string | undefined;
      const uploads: Promise<void>[] = [];
      if (narratedSceneSource === "generate") {
        uploads.push(uploadImage(imageFile!, token).then(u => { imageUrl = u; }));
      }
      if (userPhotoForVideo) {
        uploads.push(uploadImage(userPhotoForVideo, token).then(u => { userPhotoUrl = u; }));
      }
      await Promise.all(uploads);
      // Cria job
      const res = await fetch("/api/narrated-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          input_image_url: imageUrl,
          roteiro: narratedRoteiro,
          voice: narratedVoice,
          voice_sample_url: narratedVoiceMode === "clone" && narratedVoiceSampleUrl ? narratedVoiceSampleUrl : undefined,
          user_photo_url: userPhotoUrl,
          scene_source: narratedSceneSource,
          scene_urls: narratedSceneSource === "existing" ? narratedSelectedScenes : undefined,
          format: photoFormat,
        }),
      });
      if (res.status === 403) { setNarratedError("Disponível apenas no plano Pro."); return; }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? "Erro ao criar job");
      }
      const { jobId } = await res.json();
      setNarratedJob({ id: jobId, status: "queued" });
      setNarratedMode(true);
      setModeSelected(false);
      try {
        sessionStorage.setItem("pending_video_job_id", jobId);
        sessionStorage.setItem("pending_video_job_type", "narrated");
      } catch { /* ignora */ }
      router.push("/tamo");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // iOS Safari lança "Load failed" para erros de rede — traduz para pt-BR
      if (!msg || msg === "Load failed" || msg === "Failed to fetch" || msg === "NetworkError when attempting to fetch resource.") {
        setNarratedError("Falha na conexão. Verifique sua internet e tente novamente.");
      } else {
        setNarratedError(msg || "Erro ao criar vídeo");
      }
    } finally {
      setNarratedSubmitting(false);
    }
  }

  function resetNarrated() {
    resetNarratedVideo();
  }

  function resetVideo() {
    // Marca o vídeo job atual como descartado para evitar restauração automática
    if (videoJob?.id) {
      try {
        const dismissed: string[] = JSON.parse(localStorage.getItem("dismissed_jobs") ?? "[]");
        if (!dismissed.includes(videoJob.id)) {
          dismissed.push(videoJob.id);
          localStorage.setItem("dismissed_jobs", JSON.stringify(dismissed));
        }
      } catch { /* ignora */ }
    }
    resetVideoJob();
    setVideoPrompt("");
  }

  function resetLongVideo() {
    resetLongVideoJob();
  }

  async function handleLongVideoSubmit(imageUrl: string, produtoName: string) {
    setLongVideoSubmitting(true);
    setLongVideoError("");
    try {
      const tok = await getToken();
      const res = await fetch("/api/long-video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ input_image_url: imageUrl, produto: produtoName, format: photoFormat }),
      });
      if (res.status === 403) { setLongVideoError("Disponível apenas no plano Pro."); return; }
      if (res.status === 409) {
        // Já tem um job ativo — restaura
        const d = await res.json();
        setLongVideoJob({ id: d.jobId, status: "queued" });
        setLongVideoMode(true);
        setModeSelected(false);
        setBotTriggerMessage(`🎬 Você já tem um vídeo longo em andamento! Acompanhe aqui. Posso ajudar com legenda enquanto espera.`);
        return;
      }
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "Erro"); }
      const { jobId } = await res.json();
      setLongVideoJob({ id: jobId, status: "queued" });
      setLongVideoMode(true);
      setModeSelected(false);
      const longTriggers = [
        `🎬 Vídeo longo de *${produtoName}* em produção! Pode demorar 20-40 min. Posso criar legendas enquanto aguarda.`,
        `🎬 Criando 4 cenas do *${produtoName}*! Me fala o preço — já preparo um texto de venda para cada cena.`,
        `🎬 Gerando seu vídeo longo! Quer hashtags ou legenda de venda enquanto espera?`,
      ];
      try {
        sessionStorage.setItem("pending_video_job_id", jobId);
        sessionStorage.setItem("pending_video_job_type", "long");
      } catch { /* ignora */ }
      router.push("/tamo");
      // Polling e elapsed gerenciados pelo useLongVideo hook (via useEffect)
    } catch (err) {
      setLongVideoError(err instanceof Error ? err.message : "Erro ao criar vídeo longo");
    } finally {
      setLongVideoSubmitting(false);
    }
  }

  function resetAll() {
    resetVideo();
    resetJob();
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await downloadBlob(blob, "foto-ia.jpg");
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
  // submitting=true OU job ativo = tela "Trabalhando..." — não volta para formulário até ter resultado
  const workState: WorkState = (submitting || (!!job && job.status !== "done" && job.status !== "failed" && job.status !== "canceled" && job.status !== null))
    ? "trabalhando"
    : deriveWorkState(job);

  // Bloqueio por tipo: foto ativa impede nova foto, vídeo ativo impede novo vídeo
  // Mas foto + vídeo podem rodar juntos (servidores distintos)
  const isPhotoJobActive = isGenerating;

  // Cards de status para o BotChat (Tamo como hub de processamento)
  const activeJobs: ActiveJobInfo[] = [
    ...(workState === "trabalhando" ? [{
      type: "photo" as const,
      productName: produto || undefined,
      status: job?.status ?? "queued",
      progress: displayProgress,
      onCancel: showCancel ? async () => {
        setCanceling(true);
        const tok = await getToken();
        if (job?.id) await fetch(`/api/image-jobs/${job.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
        setCanceling(false);
        resetJob();
      } : undefined,
    }] : []),
    ...(videoJob && !["done","failed","canceled"].includes(videoJob.status ?? "") ? [{
      type: "video" as const,
      productName: produto || undefined,
      status: videoJob.status ?? "queued",
      progress: videoDisplayProgress,
    }] : []),
    ...(narratedJob && !["done","failed","canceled"].includes(narratedJob.status) ? [{
      type: "narrated" as const,
      productName: produto || undefined,
      status: narratedJob.status,
      progress: narratedDisplayProgress,
    }] : []),
    ...(longVideoJob && !["done","failed","canceled"].includes(longVideoJob.status) ? [{
      type: "long_video" as const,
      productName: produto || undefined,
      status: longVideoJob.status,
      progress: ({ queued: 5, generating_photos: 30, generating_videos: 65, concatenating: 90 } as Record<string, number>)[longVideoJob.status] ?? 5,
    }] : []),
  ];
  const isVideoJobActive = videoSubmitting || narratedSubmitting || longVideoSubmitting
    || (!!videoJob && !["done","failed","canceled"].includes(videoJob.status ?? ""))
    || (!!narratedJob && !["done","failed","canceled"].includes(narratedJob.status ?? ""))
    || (!!longVideoJob && !["done","failed","canceled"].includes(longVideoJob.status ?? ""));

  // Bloqueia render até resolver check de onboarding — evita flash do app para novos usuários
  if (!onboardingReady) return (
    <div style={{ minHeight: "100dvh", background: "#07080b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes tamoJump {
          0%, 100% { transform: translateY(0px); }
          40% { transform: translateY(-18px); }
          60% { transform: translateY(-14px); }
        }
        @keyframes tamoShadow {
          0%, 100% { transform: scaleX(1); opacity: 0.3; }
          40% { transform: scaleX(0.55); opacity: 0.12; }
          60% { transform: scaleX(0.65); opacity: 0.16; }
        }
        .tamo-jump { animation: tamoJump 0.75s ease-in-out infinite; }
        .tamo-shadow { animation: tamoShadow 0.75s ease-in-out infinite; }
      `}</style>
      <div style={{ position: "relative", width: 90, height: 110 }}>
        <img
          src="/tamo/idle.png"
          alt="Tamo"
          className="tamo-jump"
          style={{ width: 90, objectFit: "contain", objectPosition: "bottom", display: "block" }}
        />
      </div>
      <div
        className="tamo-shadow"
        style={{ width: 48, height: 8, borderRadius: "50%", background: "rgba(168,85,247,0.35)", marginTop: 2, filter: "blur(3px)" }}
      />
    </div>
  );

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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
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
            grid-template-columns: 300px 1fr !important;
            gap: 0 !important;
            max-width: 860px !important;
            margin: 0 auto !important;
            height: calc(100vh - 140px) !important;
            max-height: 620px !important;
            background: #0d1117 !important;
            border-radius: 20px !important;
            overflow: hidden !important;
            border: 1px solid rgba(255,255,255,0.06) !important;
            padding: 0 !important;
          }
          .generating-panel {
            padding: 36px 28px !important;
            border-right: 1px solid rgba(255,255,255,0.06) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 20px !important;
          }
          .generating-preview {
            height: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
            overflow: hidden !important;
          }
          .generating-preview img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
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
          /* Remove padding do card de resultado no mobile — a largura é controlada pelo result-mobile-actions */
          .result-wrap { padding: 0 !important; overflow: hidden; }
        }
      `}</style>

      {/* Header */}
      <header style={styles.header} className="app-header page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="page-logo">
          <div style={styles.logo}>TamoWork</div>
        </div>
        <div style={styles.headerRight}>
          <LangSelector />
          {plan === "pro" && <span style={styles.proBadge}>✦ Pro</span>}
          <button onClick={() => router.push("/conta")} style={styles.accountBtn} aria-label="Minha conta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
        </div>
      </header>

      <main style={styles.main} className="app-main">

        {/* Banner de app — Android (Play Store) / iOS (tela inicial) */}
        {appBannerPlatform && !appBannerDismissed && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: appBannerPlatform === "android"
              ? "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.08))"
              : "linear-gradient(135deg,rgba(99,102,241,0.14),rgba(168,85,247,0.09))",
            border: `1px solid ${appBannerPlatform === "android" ? "rgba(34,197,94,0.3)" : "rgba(168,85,247,0.3)"}`,
            borderRadius: 14, padding: "12px 14px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>
              {appBannerPlatform === "android" ? "📲" : "📱"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#eef2f9", marginBottom: 2 }}>
                {appBannerPlatform === "android"
                  ? "Baixe o app TamoWork"
                  : "Adicione à tela inicial"}
              </div>
              <div style={{ fontSize: 12, color: "#8394b0" }}>
                {appBannerPlatform === "android"
                  ? "Acesse mais rápido pela Play Store"
                  : "Use como app no seu iPhone — é mais rápido"}
              </div>
            </div>
            <a
              href="/app"
              onClick={() => {
                if (appBannerPlatform === "ios") {
                  localStorage.setItem("ios_app_visited", "1");
                }
              }}
              style={{
                flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#fff",
                background: appBannerPlatform === "android"
                  ? "linear-gradient(135deg,#16c784,#10b981)"
                  : "linear-gradient(135deg,#6366f1,#a855f7)",
                borderRadius: 10, padding: "7px 12px", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              {appBannerPlatform === "android" ? "Baixar" : "Ver como"}
            </a>
            <button
              onClick={() => {
                setAppBannerDismissed(true);
                if (appBannerPlatform === "android") {
                  localStorage.setItem("app_banner_dismissed_android", "1");
                } else {
                  // iOS: guardar que já foi visitado para não mostrar novamente
                  localStorage.setItem("ios_app_visited", "1");
                }
              }}
              style={{
                flexShrink: 0, background: "none", border: "none", color: "#4e5c72",
                fontSize: 18, cursor: "pointer", padding: "0 2px", lineHeight: 1,
              }}
              aria-label="Fechar"
            >×</button>
          </div>
        )}

        {/* Banner de vídeo falhou — aparece quando !videoMode */}
        {videoJob?.status === "failed" && !videoMode && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>😔</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 14 }}>Erro ao gerar vídeo</div>
              <div style={{ color: "#8394b0", fontSize: 12 }}>Houve um problema. Tente novamente.</div>
            </div>
            <button onClick={() => { resetVideo(); setVideoMode(true); }} style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 10, padding: "6px 12px", color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Tentar
            </button>
            <button onClick={resetVideo} style={{ background: "none", border: "none", color: "#4e5c72", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Banner de vídeo em criação — aparece no topo quando usuário navega para outras telas */}
        {videoJob && !["done", "failed", "canceled"].includes(videoJob.status ?? "") && workState !== "trabalhando" && !videoMode && (
          <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.18),rgba(168,85,247,0.12))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setVideoMode(true)}>
            <span style={{ fontSize: 22 }}>🎬</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 14 }}>Tô criando seu vídeo...</div>
              <div style={{ color: "#8394b0", fontSize: 12 }}>Pode continuar usando o app — te aviso quando ficar pronto</div>
            </div>
            <div style={{ width: 80, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${videoDisplayProgress}%`, background: "linear-gradient(90deg,#6366f1,#a855f7)", borderRadius: 99, transition: "width 1s ease" }} />
            </div>
          </div>
        )}

        {/* Banner de narração em criação — aparece no topo quando usuário navega para outras telas */}
        {narratedJob && !["done", "failed", "canceled"].includes(narratedJob.status) && !narratedMode && (
          <div
            style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.18),rgba(99,102,241,0.12))", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => setNarratedMode(true)}
          >
            <span style={{ fontSize: 22 }}>🎙️</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 14 }}>Tô criando o vídeo com narração...</div>
              <div style={{ color: "#8394b0", fontSize: 12 }}>Toque para acompanhar — te aviso quando ficar pronto</div>
            </div>
            <div style={{ width: 80, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${narratedDisplayProgress}%`, background: "linear-gradient(90deg,#a855f7,#6366f1)", borderRadius: 99, transition: "width 1s ease" }} />
            </div>
          </div>
        )}

        {/* Banner de vídeo longo em andamento */}
        {longVideoJob && !["done", "failed", "canceled"].includes(longVideoJob.status) && !longVideoMode && (
          <div
            style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.18),rgba(168,85,247,0.12))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => setLongVideoMode(true)}
          >
            <span style={{ fontSize: 22 }}>🎬</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#eef2f9", fontWeight: 700, fontSize: 14 }}>Tô criando o vídeo longo (~32s)...</div>
              <div style={{ color: "#8394b0", fontSize: 12 }}>
                {{
                  queued: "Tô na fila — processo a cada 5 minutos",
                  generating_photos: "Gerando as cenas...",
                  generating_videos: "Gerando os vídeos...",
                  concatenating: "Juntando os clips...",
                }[longVideoJob.status] ?? "Processando..."}
              </div>
            </div>
            <span style={{ fontSize: 12, color: "#8394b0" }}>⏱ {Math.floor(longVideoElapsed / 60)}m</span>
          </div>
        )}

        {/* PASSO 1: Menu de escolha de modo */}
        {!modeSelected && !videoMode && !longVideoMode && (
          <div style={styles.menuWrap}>
            {rateLimitedUntil && countdown > 0 ? (
              <DailyLimitScreen countdown={countdown} onAssinar={() => handleAssinarDireto("annual", "limite_diario")} />
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

        {/* PASSO 2: Formulário — esconde quando resultado de foto está visível (exceto modos de vídeo ativos) */}
        {modeSelected && !videoMode && !longVideoMode && workState !== "trabalhando" && (workState !== "terminado" || narratedMode) && (
          <div style={styles.card}>
            {/* Botão voltar */}
            <button onClick={() => setModeSelected(false)} style={styles.backToMenuBtn}>
              {t("back")}
            </button>

            <div style={styles.modeHeader}>
              <div style={styles.modeName}>
                {{
                  simulacao: "Simulação de uso",
                  fundo_branco: "Fundo branco",
                  catalogo: "Catálogo com modelo",
                  personalizado: "Personalizado",
                  video: "Criar vídeo",
                  promo: "Criar promoção",
                  video_narrado: "🛍️ Mini Live Shop",
                  video_longo: "🎬 Vídeo longo (~32s)",
                  produto_exposto: "🏪 Expositor premium",
                }[creationMode]}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>

              {/* ── MODO VÍDEO LONGO ── */}
              {creationMode === "video_longo" ? (
                <>
                  {/* Aviso de tempo */}
                  <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>⏰</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 3 }}>Este processo demora 20-40 minutos</div>
                      <div style={{ fontSize: 12, color: "#8394b0", lineHeight: 1.5 }}>
                        Gero <strong style={{ color: "#eef2f9" }}>4 fotos em cenários diferentes</strong>, depois converto cada uma em vídeo de ~8s e uno tudo num vídeo final de ~32 segundos. Pode fechar o app — te aviso quando ficar pronto.
                      </div>
                    </div>
                  </div>

                  {/* Upload foto */}
                  <div onClick={() => fileRef.current?.click()} style={{ ...styles.uploadArea, cursor: "pointer" }}>
                    {preview ? (
                      <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 10 }} />
                    ) : (
                      <>
                        <div style={styles.uploadIcon}>📷</div>
                        <div style={styles.uploadTitle}>Me manda a foto do produto</div>
                        <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                  </div>

                  {/* Produto */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Nome / descrição do produto</label>
                    <input
                      type="text"
                      placeholder="Ex: tênis branco esportivo, bolsa feminina couro marrom…"
                      value={produto}
                      onChange={(e) => setProduto(e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  {longVideoError && <div style={styles.error}>{longVideoError}</div>}

                  <FormatSelector value={photoFormat} onChange={setPhotoFormat} />

                  <button
                    type="button"
                    disabled={longVideoSubmitting || !imageFile || !produto.trim() || plan !== "pro"}
                    onClick={async () => {
                      if (!imageFile || !produto.trim()) return;
                      setLongVideoSubmitting(true);
                      setLongVideoError("");
                      try {
                        const tok = await getToken();
                        const imageUrl = await uploadImage(imageFile, tok);
                        await handleLongVideoSubmit(imageUrl, produto);
                      } catch (err) {
                        setLongVideoError(err instanceof Error ? err.message : "Erro");
                        setLongVideoSubmitting(false);
                      }
                    }}
                    style={{ ...styles.submitBtn, opacity: (longVideoSubmitting || !imageFile || !produto.trim() || plan !== "pro") ? 0.5 : 1 }}
                  >
                    {longVideoSubmitting ? "Enviando..." : plan !== "pro" ? "🔒 Exclusivo PRO" : "🎬 Criar vídeo longo"}
                  </button>
                </>
              ) : null}

              {/* ── MODO VÍDEO COM NARRAÇÃO ── */}
              {creationMode === "video_narrado" ? (
                <>
                  {narratedJob && !["done", "failed", "canceled"].includes(narratedJob.status) ? (
                    /* Gerando... */
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "16px 0" }}>
                      <div style={{ fontSize: 44 }}>🎙️</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9", textAlign: "center" }}>
                        {narratedJob.status === "queued" || narratedJob.status === "submitting"
                          ? "Tô na fila..."
                          : narratedJob.status === "generating_scenes"
                          ? "Gerando as cenas..."
                          : "Montando o vídeo com narração..."}
                      </div>
                      <div style={{ fontSize: 12, color: "#8394b0", textAlign: "center" }}>
                        {narratedJob.status === "assembling"
                          ? "Adicionando voz e efeitos Ken Burns"
                          : "Pode demorar 5-10 minutos. Pode fechar o app!"}
                      </div>
                      {/* Barra de progresso baseada no tempo */}
                      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99 }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.min(90, Math.round((narratedElapsed / 480) * 90))}%`,
                          background: "linear-gradient(90deg, #a855f7, #6366f1)",
                          borderRadius: 99,
                          transition: "width 2s ease",
                        }} />
                      </div>
                      <button
                        type="button"
                        onClick={resetNarrated}
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", color: "#8394b0", fontSize: 13, cursor: "pointer" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : narratedJob?.status === "done" && narratedJob.output_video_url ? (
                    /* Resultado */
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#16c784", textAlign: "center" }}>
                        🎉 Pronto! Seu vídeo com narração ficou assim 👇
                      </div>
                      <video
                        src={narratedJob.output_video_url}
                        controls
                        playsInline
                        style={{ width: "100%", borderRadius: 14, background: "#000", maxHeight: 400 }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(narratedJob.output_video_url!);
                            const blob = await res.blob();
                            await downloadBlob(blob, "video-narrado.mp4");
                          } catch { window.open(narratedJob.output_video_url!, "_blank"); }
                        }}
                        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 14, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
                      >
                        ⬇ Baixar vídeo
                      </button>
                      <button
                        type="button"
                        onClick={resetNarrated}
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px", color: "#8394b0", fontSize: 13, cursor: "pointer" }}
                      >
                        Criar outro vídeo
                      </button>

                      {/* Upsell PRO para free após resultado de vídeo narrado */}
                      {plan === "free" && (
                        <button
                          type="button"
                          onClick={() => handleAssinarDireto("monthly", "resultado_narrado")}
                          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 14, padding: "16px", width: "100%", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 4 }}
                        >
                          🚀 Assinar Pro — vídeos ilimitados por R$79/mês
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Formulário */
                    <>
                      {narratedJob?.status === "failed" && (
                        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 14px", marginBottom: 4, fontSize: 13, color: "#fca5a5" }}>
                          Algo deu errado. Tente novamente.
                        </div>
                      )}

                      {/* Fonte das cenas */}
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Cenas do vídeo</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {([
                            { value: "generate", label: "✨ Gerar cenas novas" },
                            { value: "existing", label: "🖼️ Usar minhas fotos" },
                          ] as const).map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setNarratedSceneSource(value);
                                setNarratedSelectedScenes([]);
                                if (value === "existing") loadNarratedDonePhotos();
                              }}
                              style={{
                                flex: 1,
                                padding: "10px 6px",
                                borderRadius: 10,
                                border: `1.5px solid ${narratedSceneSource === value ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.08)"}`,
                                background: narratedSceneSource === value ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.03)",
                                color: narratedSceneSource === value ? "#c4b5fd" : "#8394b0",
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: "#4e5c72", marginTop: 4 }}>
                          {narratedSceneSource === "generate"
                            ? "Gero variações profissionais da sua foto de produto"
                            : "Use fotos que eu já criei pra você — selecione 2 ou mais abaixo"}
                        </div>
                      </div>

                      {/* Upload foto (apenas quando gerar cenas novas) */}
                      {narratedSceneSource === "generate" && (
                        <div
                          style={{ ...styles.dropzone, ...(preview ? styles.dropzoneWithPreview : {}) }}
                          onClick={() => fileRef.current?.click()}
                        >
                          {preview ? (
                            <img src={preview} alt="preview" style={styles.previewImg} />
                          ) : (
                            <>
                              <div style={styles.uploadIcon}>🎙️</div>
                              <div style={styles.uploadText}>Foto do produto</div>
                              <div style={styles.uploadSub}>JPG, PNG ou WEBP</div>
                            </>
                          )}
                          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
                        </div>
                      )}

                      {/* Galeria de fotos existentes */}
                      {narratedSceneSource === "existing" && (
                        <div style={{ marginBottom: 4 }}>
                          {narratedDonePhotos.length === 0 ? (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12, padding: "20px 16px", textAlign: "center", color: "#4e5c72", fontSize: 13 }}>
                              Nenhuma foto gerada ainda. Gere fotos profissionais primeiro na aba de simulação.
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: 12, color: "#8394b0", marginBottom: 8 }}>
                                Selecione as fotos para as cenas ({narratedSelectedScenes.length} selecionadas — mínimo 2)
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                                {narratedDonePhotos.map((p) => {
                                  const sel = narratedSelectedScenes.includes(p.output_image_url);
                                  return (
                                    <div
                                      key={p.id}
                                      onClick={() => toggleNarratedScene(p.output_image_url)}
                                      style={{
                                        position: "relative",
                                        borderRadius: 10,
                                        overflow: "hidden",
                                        cursor: "pointer",
                                        border: sel ? "2.5px solid #a855f7" : "2.5px solid transparent",
                                        aspectRatio: "1",
                                        transition: "border 0.15s",
                                      }}
                                    >
                                      <img src={p.output_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                      {sel && (
                                        <div style={{ position: "absolute", top: 4, right: 4, background: "#a855f7", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 800 }}>
                                          {narratedSelectedScenes.indexOf(p.output_image_url) + 1}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Foto do apresentador */}
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Sua foto <span style={{ color: "#4e5c72", fontWeight: 400 }}>(opcional)</span></label>
                        {userPhotoUrlForVideo ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <img src={userPhotoUrlForVideo} alt="Sua foto" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", border: "2px solid rgba(168,85,247,0.4)" }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: "#34d399", fontWeight: 600 }}>✅ Foto salva</div>
                              <div style={{ fontSize: 11, color: "#8394b0" }}>Sua aparência será usada nas cenas</div>
                            </div>
                            <button type="button" onClick={() => { setUserPhotoForVideo(null); setUserPhotoUrlForVideo(""); }}
                              style={{ fontSize: 12, color: "#8394b0", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                              Trocar
                            </button>
                          </div>
                        ) : (
                          <>
                            <button type="button" onClick={() => userPhotoVideoRef.current?.click()}
                              style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1.5px dashed rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.04)", color: "#c4b5fd", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                              📸 Adicionar foto sua
                            </button>
                            <input ref={userPhotoVideoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setUserPhotoForVideo(f);
                                setUserPhotoUrlForVideo(URL.createObjectURL(f));
                              }} />
                            <div style={{ marginTop: 8, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#8394b0", lineHeight: 1.6 }}>
                              Para melhor resultado:<br />
                              ✓ Rosto visível e bem iluminado<br />
                              ✓ Olhando para a câmera<br />
                              ✓ Fundo claro ou neutro<br />
                              ✗ Sem óculos escuros ou chapéu cobrindo o rosto
                            </div>
                          </>
                        )}
                      </div>

                      {/* Voz */}
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Voz da narração</label>
                        {/* Modo: IA built-in ou clone */}
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          {([["builtin", "🤖 Voz IA"], ["clone", "🎤 Sua voz"]] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => { setNarratedVoiceMode(mode); setVoiceBlobs([null,null,null]); setVoiceStep(0); setNarratedVoiceSampleUrl(""); setVoiceEditMode(false); }}
                              style={{
                                flex: 1,
                                padding: "10px 0",
                                borderRadius: 10,
                                border: `1.5px solid ${narratedVoiceMode === mode ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.08)"}`,
                                background: narratedVoiceMode === mode ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.03)",
                                color: narratedVoiceMode === mode ? "#c4b5fd" : "#8394b0",
                                fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                              }}
                            >{label}</button>
                          ))}
                        </div>

                        {/* Builtin: feminina/masculina */}
                        {narratedVoiceMode === "builtin" && (
                          <div style={{ display: "flex", gap: 8 }}>
                            {(["feminino", "masculino"] as const).map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setNarratedVoice(v)}
                                style={{
                                  flex: 1,
                                  padding: "10px 0",
                                  borderRadius: 10,
                                  border: `1.5px solid ${narratedVoice === v ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.08)"}`,
                                  background: narratedVoice === v ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.03)",
                                  color: narratedVoice === v ? "#c4b5fd" : "#8394b0",
                                  fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                                }}
                              >{v === "feminino" ? "👩 Feminina" : "👨 Masculina"}</button>
                            ))}
                          </div>
                        )}

                        {/* Clone: 3 gravações sequenciais */}
                        {narratedVoiceMode === "clone" && (
                          <div style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.18)", borderRadius: 12, padding: "14px" }}>
                            {narratedVoiceSampleUrl && !voiceEditMode ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ flex: 1, fontSize: 13, color: "#34d399", fontWeight: 600 }}>✅ Voz salva (3 gravações)</div>
                                <button type="button" onClick={() => { setVoiceEditMode(true); setVoiceBlobs([null,null,null]); setVoiceStep(0); }}
                                  style={{ fontSize: 12, color: "#c4b5fd", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
                                  ✏️ Regravar
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Indicador de progresso */}
                                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                                  {VOICE_TEXTS.map((_, i) => (
                                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: voiceBlobs[i] ? "#a855f7" : i === voiceStep ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)" }} />
                                  ))}
                                </div>
                                <div style={{ fontSize: 11, color: "#8394b0", marginBottom: 6 }}>
                                  Gravação {voiceStep + 1} de 3 — <span style={{ color: "#c4b5fd", fontWeight: 600 }}>{VOICE_TEXTS[voiceStep].label}</span>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#eef2f9", lineHeight: 1.55, marginBottom: 10, fontStyle: "italic" }}>
                                  &ldquo;{VOICE_TEXTS[voiceStep].text}&rdquo;
                                </div>
                                <button type="button" onClick={voiceRecording ? stopVoiceRecording : startVoiceRecording}
                                  style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: voiceRecording ? "rgba(239,68,68,0.25)" : "rgba(168,85,247,0.22)", color: voiceRecording ? "#fca5a5" : "#c4b5fd", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.15s" }}>
                                  {voiceRecording ? "⏹ Parar gravação" : `⏺ ${voiceBlobs[voiceStep] ? "Regravar" : "Gravar"}`}
                                </button>

                                {voiceBlobs[voiceStep] && !voiceRecording && (
                                  <div style={{ marginTop: 10 }}>
                                    <audio controls src={URL.createObjectURL(voiceBlobs[voiceStep]!)} style={{ width: "100%", height: 36, marginBottom: 8 }} />
                                    {voiceStep < 2 ? (
                                      <button type="button" onClick={() => setVoiceStep(s => s + 1)}
                                        style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "rgba(168,85,247,0.22)", color: "#c4b5fd", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                                        Próxima gravação →
                                      </button>
                                    ) : (
                                      <button type="button" disabled={voiceUploading} onClick={() => uploadVoiceSample(voiceBlobs)}
                                        style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "rgba(22,199,132,0.2)", color: "#34d399", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                                        {voiceUploading ? "Salvando..." : "✅ Usar esta voz"}
                                      </button>
                                    )}
                                  </div>
                                )}

                                {voiceEditMode && narratedVoiceSampleUrl && (
                                  <button type="button" onClick={() => { setVoiceEditMode(false); setVoiceBlobs([null,null,null]); setVoiceStep(0); }}
                                    style={{ marginTop: 8, width: "100%", padding: "8px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#8394b0", fontSize: 12, cursor: "pointer" }}>
                                    Cancelar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Roteiro */}
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>
                          O que você quer dizer no vídeo? <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <textarea
                          placeholder={"Ex: Oi pessoal, hoje vou mostrar nosso novo produto. Olha que diferença faz na sua vida do dia a dia. Aproveita o desconto especial só essa semana!"}
                          value={narratedRoteiro}
                          onChange={(e) => setNarratedRoteiro(e.target.value)}
                          rows={5}
                          style={{
                            ...styles.input,
                            resize: "vertical",
                            minHeight: 100,
                          } as React.CSSProperties}
                        />
                        <div style={{ fontSize: 11, color: "#4e5c72", marginTop: 4 }}>
                          Eu melhoro o texto e gero a narração automaticamente
                        </div>
                      </div>

                      {plan !== "pro" && (
                        <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", marginBottom: 4 }}>🔒 Disponível no plano Pro</div>
                          <div style={{ fontSize: 12, color: "#8394b0", marginBottom: 12 }}>Vídeos com narração de IA a partir de R$0,61/dia</div>
                          <button type="button" onClick={() => handleAssinarDireto(undefined, "lock_narrado")} style={styles.unlockBtn}>✨ Assinar agora</button>
                        </div>
                      )}

                      {narratedError && <div style={styles.error}>{narratedError}</div>}

                      <FormatSelector value={photoFormat} onChange={setPhotoFormat} />

                      {plan !== "pro" ? (
                        <button type="button" onClick={() => handleAssinarDireto(undefined, "lock_video")} style={styles.unlockBtn}>
                          ⚡ Assinar para criar vídeos
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={narratedSubmitting || (narratedSceneSource === "generate" ? !imageFile : narratedSelectedScenes.length < 2) || !narratedRoteiro.trim()}
                          onClick={handleNarratedSubmit}
                          style={{ ...styles.submitBtn, opacity: (narratedSubmitting || (narratedSceneSource === "generate" ? !imageFile : narratedSelectedScenes.length < 2) || !narratedRoteiro.trim()) ? 0.5 : 1 }}
                        >
                          {narratedSubmitting ? "Enviando..." : "🎙️ Criar vídeo com narração"}
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : creationMode === "video" ? (
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
                        <div style={styles.uploadText}>Me manda a foto que eu animo</div>
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
                      <button type="button" onClick={() => handleAssinarDireto(undefined, "lock_video_longo")} style={styles.unlockBtn}>✨ Assinar agora</button>
                    </div>
                  )}

                  {videoError && (
                    <div style={styles.error}>
                      {videoError === "queue_busy"
                        ? "⏳ Tô trabalhando em vários vídeos agora. Aguarda alguns minutinhos e tenta de novo!"
                        : videoError}
                    </div>
                  )}

                  <FormatSelector value={photoFormat} onChange={setPhotoFormat} />

                  {plan !== "pro" ? (
                    <button
                      type="button"
                      onClick={() => handleAssinarDireto(undefined, "lock_video_form")}
                      style={styles.unlockBtn}
                    >
                      ⚡ {lang === "en" ? "Subscribe to create videos" : lang === "es" ? "Suscribirse para crear videos" : "Assinar para criar vídeos"}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={videoSubmitting || !imageFile}
                      style={{ ...styles.submitBtn, opacity: (videoSubmitting || !imageFile) ? 0.5 : 1 }}
                    >
                      {videoSubmitting ? (lang === "en" ? "Sending..." : lang === "es" ? "Enviando..." : "Enviando...") : t("btn_generate_video")}
                    </button>
                  )}
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

              {/* Campo produto — oculto no produto_exposto (visão detecta automaticamente) */}
              {creationMode !== "produto_exposto" && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    {t("field_product")}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      creationMode === "simulacao"
                        ? (lang === "en" ? "Ex: women's dress, men's sneaker, floral kids headband…" : lang === "es" ? "Ej: vestido de mujer, zapatilla masculina, tiara floral infantil…" : "Ex: vestido feminino, tênis masculino, tiara floral infantil…")
                        : "Ex: conjunto feminino floral, blusa cropped azul, tênis branco…"
                    }
                    value={produto}
                    onChange={(e) => setProduto(e.target.value)}
                    style={styles.input}
                  />
                  {creationMode === "simulacao" && (
                    <div style={{ fontSize: 11, color: "#4e5c72", marginTop: 4, lineHeight: 1.4 }}>
                      {lang === "en"
                        ? "Helps me choose the right model gender and pose for your product."
                        : lang === "es"
                        ? "Me ayuda a elegir el género y la pose correcta para tu producto."
                        : "Ajuda eu escolher o gênero e pose certos para o seu produto."}
                    </div>
                  )}
                </div>
              )}

              {/* Campo cenário — oculto no produto_exposto (IA detecta tudo) */}
              {creationMode !== "fundo_branco" && creationMode !== "produto_exposto" && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    {creationMode === "personalizado"
                      ? (lang === "en" ? "Describe the result you want" : lang === "es" ? "Describe el resultado que quieres" : "Descreva o resultado que quer")
                      : t("field_scene")}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      creationMode === "simulacao"
                        ? (lang === "en" ? "Ex: kitchen counter, coffee shop, beach, bedroom shelf…" : lang === "es" ? "Ej: encimera de cocina, café, playa, estante de habitación…" : "Ex: bancada da cozinha, café, praia, prateleira do quarto…")
                        : creationMode === "catalogo"
                        ? (lang === "en" ? "Ex: streets of Paris, upscale café, modern urban setting" : lang === "es" ? "Ej: calle de París, café sofisticado, ambiente urbano moderno" : "Ex: rua de Paris, café sofisticado, ambiente urbano moderno")
                        : (lang === "en" ? "Freely describe what I should create" : lang === "es" ? "Describe libremente lo que voy a crear" : "Descreva livremente o que eu vou criar")
                    }
                    value={cenario}
                    onChange={(e) => setCenario(e.target.value)}
                    style={styles.input}
                  />
                </div>
              )}

              {/* Aviso produto exposto — IA lê tudo automaticamente */}
              {creationMode === "produto_exposto" && (
                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 8, fontSize: 13, color: "#a78bfa", lineHeight: 1.5 }}>
                  {lang === "en"
                    ? "✨ I read your photo and create the ideal display automatically — no description needed."
                    : lang === "es"
                    ? "✨ Leo tu foto y creo el expositor ideal automáticamente — no necesitas describir nada."
                    : "✨ Eu leio a foto e crio o expositor ideal — não precisa descrever nada."}
                </div>
              )}

              {timeoutError && <div style={{ ...styles.error, borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>{timeoutError}</div>}
              {formError && <div style={styles.error}>{formError}</div>}

              <FormatSelector value={photoFormat} onChange={setPhotoFormat} />

              {isPhotoJobActive ? (
                <div style={{ ...styles.card, textAlign: "center" as const, padding: "28px 24px" }}>
                  <div style={{ fontSize: 34, marginBottom: 10, lineHeight: 1 }}>📸</div>
                  <div style={{ fontSize: 15, color: "#eef2f9", fontWeight: 700, marginBottom: 6 }}>Sua foto ainda está sendo criada</div>
                  <div style={{ fontSize: 13, color: "#8394b0", marginBottom: 18, lineHeight: 1.5 }}>Aguarde terminar antes de criar outra</div>
                  <button
                    type="button"
                    onClick={() => router.push("/tamo")}
                    style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", borderRadius: 10, padding: "12px 24px", color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 44, width: "100%" }}
                  >
                    Ver andamento →
                  </button>
                </div>
              ) : (
              <button
                type="submit"
                disabled={submitting || (creationMode !== "produto_exposto" && creationMode !== "simulacao" && !cenario.trim()) || (creationMode === "simulacao" && !produto.trim())}
                style={{ ...styles.submitBtn, opacity: (submitting || (creationMode !== "produto_exposto" && creationMode !== "simulacao" && !cenario.trim()) || (creationMode === "simulacao" && !produto.trim())) ? 0.5 : 1 }}
              >
                {submitting ? t("btn_generating") : t("btn_generate")}
              </button>
              )}
              </>
              )}
            </form>
          </div>
        )}

        {/* Foto gerando — progresso em tempo real */}
        {workState === "trabalhando" && !videoMode && (
          <div style={{ ...styles.card, textAlign: "center" as const, padding: "32px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>📸</div>
            <div style={{ fontSize: 15, color: "#eef2f9", fontWeight: 700, marginBottom: 4 }}>Sua foto está sendo criada</div>
            <div style={{ fontSize: 13, color: "#8394b0", marginBottom: 14, lineHeight: 1.5 }}>
              {statusLabel(job?.status ?? null, elapsedSec, job?.created_at, lang)}
            </div>
            {/* Barra de progresso real (ComfyUI polling) */}
            <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginBottom: 20 }}>
              <div style={{
                height: "100%",
                width: `${displayProgress}%`,
                borderRadius: 3,
                background: displayProgress > 80
                  ? "linear-gradient(90deg, #6366f1, #22c55e)"
                  : "linear-gradient(90deg, #6366f1, #a855f7)",
                transition: "width 0.4s ease",
              }} />
            </div>
            <button
              type="button"
              onClick={() => router.push("/tamo")}
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "13px 32px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" }}
            >
              Ver andamento no Tamo →
            </button>
          </div>
        )}

        {/* Vídeo ativo — aviso simples (redirecionar para Tamo) */}
        {isVideoJobActive && videoMode && (
          <div style={{ ...styles.card, textAlign: "center" as const, padding: "32px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>🎬</div>
            <div style={{ fontSize: 15, color: "#eef2f9", fontWeight: 700, marginBottom: 6 }}>Seu vídeo está sendo criado</div>
            <div style={{ fontSize: 13, color: "#8394b0", marginBottom: 20, lineHeight: 1.5 }}>Acompanhe o andamento na aba Tamo</div>
            <button
              type="button"
              onClick={() => router.push("/tamo")}
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: 12, padding: "13px 32px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" }}
            >
              Ver andamento no Tamo →
            </button>
          </div>
        )}

        {/* Resultado (só aparece se Tamo fechado e sem outro modo de vídeo ativo) */}
        {workState === "terminado" && job && !videoMode && !narratedMode && !longVideoMode && !botNavOpen && (
          <div style={styles.card} className="result-wrap">
            {/* Imagem — coluna esquerda no desktop */}
            <div className="result-image-col">
              <img
                src={editedImageUrl ?? job.output_image_url}
                alt="Foto gerada"
                style={{ ...styles.resultImg, marginBottom: 0 }}
              />
            </div>

            {/* Ações — coluna direita no desktop / abaixo no mobile */}
            <div className="result-actions-col">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <TamoMascot state="done" size={64} />
                <div>
                  <h2 style={{ ...styles.centerTitle, textAlign: "left" as const, margin: 0, marginBottom: 2 }}>{t("result_ready")}</h2>
                  <p style={{ fontSize: 13, color: "#8394b0", margin: 0 }}>Sua foto foi gerada com sucesso</p>
                </div>
              </div>

              {/* Contador de uso free */}
              {plan === "free" && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#8394b0" }}>📸 Fotos grátis usadas</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: freePhotosUsed >= 3 ? "#f87171" : "#a5b4fc" }}>{Math.min(freePhotosUsed, 3)} / 3</span>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                    <div style={{ background: freePhotosUsed >= 3 ? "linear-gradient(135deg,#f87171,#ef4444)" : "linear-gradient(135deg,#6366f1,#a855f7)", borderRadius: 4, height: "100%", width: `${Math.min(100, (freePhotosUsed / 3) * 100)}%`, transition: "width 0.4s ease" }} />
                  </div>
                  {freePhotosUsed >= 3 && <p style={{ fontSize: 11, color: "#f87171", margin: "4px 0 0", textAlign: "center" as const }}>Limite gratuito atingido — assine o PRO para continuar criando</p>}
                </div>
              )}

              {/* Rating de qualidade */}
              <PhotoRating
                rating={photoRating}
                hover={ratingHover}
                feedbackText={feedbackText}
                sent={feedbackSent}
                loading={feedbackLoading}
                onHover={setRatingHover}
                onRate={(r) => {
                  setPhotoRating(r);
                  if (r >= 4) sendPhotoFeedback(r, "");
                }}
                onFeedbackChange={setFeedbackText}
                onSubmit={() => sendPhotoFeedback(photoRating!, feedbackText)}
                onRetry={plan === "free" ? handleBonusRetry : undefined}
                onRateApp={showRateApp ? handleRateApp : undefined}
                bonusLeft={bonusLeft}
              />

              {/* Baixar */}
              <button onClick={() => handleDownload(editedImageUrl ?? job.output_image_url!)} style={{ ...styles.downloadBtn, width: "100%", marginBottom: 8 }}>
                {t("result_download")}
              </button>

              {/* Botão único de edição → expande opções */}
              {!editExpanded ? (
                <button onClick={() => {
                  setEditExpanded(true);
                  if (plan === "free") {
                    try {
                      if (!localStorage.getItem("edit_free_seen")) {
                        localStorage.setItem("edit_free_seen", "1");
                        setEditFreePopup(true);
                      }
                    } catch { /* ignora */ }
                  }
                }} style={{ ...styles.editActionBtn, marginBottom: 8, width: "100%" }}>
                  ✏️ {lang === "en" ? "Edit photo" : "Editar foto"}
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => {
                    const url = editedImageUrl ?? job.output_image_url;
                    if (url) { sessionStorage.setItem("editor_image", url); setEditExpanded(false); router.push("/editor"); }
                  }} style={styles.editActionBtn}>
                    ✏️ {lang === "en" ? "Customize" : "Personalizar foto"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); setPromoOpen(true); }} style={styles.editActionBtn}>
                    🏷️ {lang === "en" ? "Create promo" : "Criar promoção"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); handleRemoveResultBg(); }} disabled={removingResultBg} style={styles.editActionBtn}>
                    {removingResultBg ? "⏳ " : "✂️ "}{lang === "en" ? "Remove background" : "Remover fundo"}
                  </button>
                  <button onClick={() => setEditExpanded(false)} style={{ ...styles.editActionBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#4e5c72" }}>
                    ✕ {lang === "en" ? "Cancel" : "Cancelar"}
                  </button>
                </div>
              )}

              {/* Gerar novamente */}
              <div style={{ marginBottom: 8 }}>
                {plan === "free" && freePhotosUsed >= 3 ? (
                  <button onClick={() => handleAssinarDireto("annual", "resultado_foto_limite")} style={{ ...styles.submitBtn, width: "100%", marginBottom: 0, background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                    🔓 Assinar PRO para criar mais fotos
                  </button>
                ) : plan === "free" && rateLimitedUntil && countdown > 0 ? (
                  <button disabled style={{ ...styles.newBtn, width: "100%", opacity: 0.4, cursor: "not-allowed", fontSize: 12 }}>
                    🔒 Nova foto em {formatMs(countdown)}
                  </button>
                ) : plan === "free" && photosToday === 1 ? (
                  <button onClick={resetJob} style={{ ...styles.submitBtn, width: "100%", marginBottom: 0 }}>
                    {CONVERSION.cta1Label}
                  </button>
                ) : (
                  <button onClick={resetJob} style={{ ...styles.newBtn, width: "100%" }}>{t("result_new")}</button>
                )}
              </div>

              {/* Criar vídeo — 100% largura */}
              {plan === "pro" ? (() => {
                const videoInProgress =
                  (videoJob && !["done", "failed", "canceled"].includes(videoJob.status ?? "")) ||
                  (narratedJob && !["done", "failed", "canceled"].includes(narratedJob.status));
                return videoInProgress ? (
                  <button
                    disabled
                    style={{ ...styles.videoBtn, width: "100%", marginBottom: 8, opacity: 0.45, cursor: "not-allowed" }}
                    title="Ainda tem um vídeo sendo criado"
                  >
                    🎬 Ainda tem vídeo sendo criado...
                  </button>
                ) : (
                  <button onClick={() => setVideoMode(true)} style={{ ...styles.videoBtn, width: "100%", marginBottom: 8 }}>
                    {t("result_create_video")}
                  </button>
                );
              })() : (
                <button onClick={() => handleAssinarDireto("annual", "resultado_foto_video_btn")} style={{ ...styles.videoBtnLocked, width: "100%", marginBottom: 8, cursor: "pointer", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc" }}>
                  🎬 Vídeo animado — exclusivo PRO ✨
                </button>
              )}

              {/* Upsell PRO — só para free */}
              {plan === "free" && (
                <>
                  {rateLimitedUntil && countdown > 0 ? (
                    <RateLimitUpsell countdown={countdown} onAssinar={() => handleAssinarDireto("annual", "resultado_foto_ratelimit")} />
                  ) : (
                    <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 14, padding: "14px", marginTop: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#eef2f9", marginBottom: 4 }}>Quer mais do que isso? 🚀</div>
                      <div style={{ fontSize: 12, color: "#8394b0", lineHeight: 1.6, marginBottom: 10 }}>
                        Com o PRO: fundo personalizado, vídeo animado para Reels, downloads ilimitados e sem fila de espera.
                      </div>
                      <button onClick={() => handleAssinarDireto("annual", "resultado_foto_hook")} style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Outfit, sans-serif", boxShadow: "0 4px 16px rgba(139,92,246,0.35)" }}>
                        Assinar PRO — R$79/mês
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mobile: mesmo layout, só muda padding */}
            <div className="result-mobile-actions" style={{ display: "block", padding: "16px 16px 28px" }}>
              {/* Contador de uso free — mobile */}
              {plan === "free" && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#8394b0" }}>📸 Fotos grátis usadas</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: freePhotosUsed >= 3 ? "#f87171" : "#a5b4fc" }}>{Math.min(freePhotosUsed, 3)} / 3</span>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                    <div style={{ background: freePhotosUsed >= 3 ? "linear-gradient(135deg,#f87171,#ef4444)" : "linear-gradient(135deg,#6366f1,#a855f7)", borderRadius: 4, height: "100%", width: `${Math.min(100, (freePhotosUsed / 3) * 100)}%`, transition: "width 0.4s ease" }} />
                  </div>
                  {freePhotosUsed >= 3 && <p style={{ fontSize: 11, color: "#f87171", margin: "4px 0 0", textAlign: "center" as const }}>Limite gratuito atingido — assine o PRO para continuar criando</p>}
                </div>
              )}

              {/* Rating de qualidade — mobile */}
              <PhotoRating
                rating={photoRating}
                hover={ratingHover}
                feedbackText={feedbackText}
                sent={feedbackSent}
                loading={feedbackLoading}
                onHover={setRatingHover}
                onRate={(r) => {
                  setPhotoRating(r);
                  if (r >= 4) sendPhotoFeedback(r, "");
                }}
                onFeedbackChange={setFeedbackText}
                onSubmit={() => sendPhotoFeedback(photoRating!, feedbackText)}
                onRetry={plan === "free" ? handleBonusRetry : undefined}
                onRateApp={showRateApp ? handleRateApp : undefined}
                bonusLeft={bonusLeft}
              />

              {/* Baixar */}
              <button onClick={() => handleDownload(editedImageUrl ?? job.output_image_url!)} style={{ ...styles.downloadBtn, width: "100%", marginBottom: 8 }}>
                {t("result_download")}
              </button>

              {/* Botão único de edição → expande opções */}
              {!editExpanded ? (
                <button onClick={() => {
                  setEditExpanded(true);
                  if (plan === "free") {
                    try {
                      if (!localStorage.getItem("edit_free_seen")) {
                        localStorage.setItem("edit_free_seen", "1");
                        setEditFreePopup(true);
                      }
                    } catch { /* ignora */ }
                  }
                }} style={{ ...styles.editActionBtn, marginBottom: 8, width: "100%" }}>
                  ✏️ {lang === "en" ? "Edit photo" : "Editar foto"}
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => {
                    const url = editedImageUrl ?? job.output_image_url;
                    if (url) { sessionStorage.setItem("editor_image", url); setEditExpanded(false); router.push("/editor"); }
                  }} style={styles.editActionBtn}>
                    ✏️ {lang === "en" ? "Customize" : "Personalizar foto"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); setPromoOpen(true); }} style={styles.editActionBtn}>
                    🏷️ {lang === "en" ? "Create promo" : "Criar promoção"}
                  </button>
                  <button onClick={() => { setEditExpanded(false); handleRemoveResultBg(); }} disabled={removingResultBg} style={styles.editActionBtn}>
                    {removingResultBg ? "⏳ " : "✂️ "}{lang === "en" ? "Remove background" : "Remover fundo"}
                  </button>
                  <button onClick={() => setEditExpanded(false)} style={{ ...styles.editActionBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#4e5c72" }}>
                    ✕ {lang === "en" ? "Cancel" : "Cancelar"}
                  </button>
                </div>
              )}

              {/* Gerar novamente */}
              <div style={{ marginBottom: 8 }}>
                {plan === "free" && freePhotosUsed >= 3 ? (
                  <button onClick={() => handleAssinarDireto("annual", "resultado_foto_limite")} style={{ ...styles.submitBtn, width: "100%", marginBottom: 0, background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                    🔓 Assinar PRO para criar mais fotos
                  </button>
                ) : plan === "free" && rateLimitedUntil && countdown > 0 ? (
                  <button disabled style={{ ...styles.newBtn, width: "100%", opacity: 0.4, cursor: "not-allowed", fontSize: 12 }}>
                    🔒 Nova foto em {formatMs(countdown)}
                  </button>
                ) : plan === "free" && photosToday === 1 ? (
                  <button onClick={resetJob} style={{ ...styles.submitBtn, width: "100%", marginBottom: 0 }}>
                    📷 Criar minha 2ª foto grátis
                  </button>
                ) : (
                  <button onClick={resetJob} style={{ ...styles.newBtn, width: "100%" }}>{t("result_new")}</button>
                )}
              </div>

              {/* Criar vídeo — 100% largura */}
              {plan === "pro" ? (() => {
                const videoInProgress =
                  (videoJob && !["done", "failed", "canceled"].includes(videoJob.status ?? "")) ||
                  (narratedJob && !["done", "failed", "canceled"].includes(narratedJob.status));
                return videoInProgress ? (
                  <button
                    disabled
                    style={{ ...styles.videoBtn, width: "100%", marginBottom: 8, opacity: 0.45, cursor: "not-allowed" }}
                  >
                    🎬 Ainda tem vídeo sendo criado...
                  </button>
                ) : (
                  <button onClick={() => setVideoMode(true)} style={{ ...styles.videoBtn, width: "100%", marginBottom: 8 }}>{t("result_create_video")}</button>
                );
              })() : (
                <button onClick={() => handleAssinarDireto("annual")} style={{ ...styles.videoBtnLocked, width: "100%", marginBottom: 8, cursor: "pointer", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc", fontSize: 12 }}>
                  🎬 Vídeo animado — exclusivo PRO ✨
                </button>
              )}

              {/* Upsell PRO — só para free */}
              {plan === "free" && (
                <>
                  {rateLimitedUntil && countdown > 0 ? (
                    <RateLimitUpsell countdown={countdown} onAssinar={() => handleAssinarDireto("annual", "resultado_foto_ratelimit")} />
                  ) : (
                    <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 14, padding: "14px", marginTop: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#eef2f9", marginBottom: 4 }}>Quer mais do que isso? 🚀</div>
                      <div style={{ fontSize: 12, color: "#8394b0", lineHeight: 1.6, marginBottom: 10 }}>
                        Com o PRO: fundo personalizado, vídeo animado para Reels, downloads ilimitados e sem fila de espera.
                      </div>
                      <button onClick={() => handleAssinarDireto("annual", "resultado_foto_hook")} style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)", border: "none", borderRadius: 12, padding: "12px", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Outfit, sans-serif", boxShadow: "0 4px 16px rgba(139,92,246,0.35)" }}>
                        Assinar PRO — R$79/mês
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}


        {/* Vídeo ativo — bloqueia criação de outro vídeo (qualquer tipo: regular, narrado, longo) */}
        {!botNavOpen && videoMode && isVideoJobActive && (
          <div style={{ ...styles.card, textAlign: "center" as const, padding: "28px 24px" }}>
            <div style={{ fontSize: 34, marginBottom: 10, lineHeight: 1 }}>🎬</div>
            <div style={{ fontSize: 15, color: "#eef2f9", fontWeight: 700, marginBottom: 6 }}>Seu vídeo ainda está sendo criado</div>
            <div style={{ fontSize: 13, color: "#8394b0", marginBottom: 18, lineHeight: 1.5 }}>Aguarde terminar antes de criar outro</div>
            <button
              type="button"
              onClick={() => router.push("/tamo")}
              style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", borderRadius: 10, padding: "12px 24px", color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 44, width: "100%" }}
            >
              Ver andamento →
            </button>
          </div>
        )}

        {/* Vídeo — form (só aparece se Tamo fechado e sem vídeo ativo) */}
        {!botNavOpen && videoMode && !isVideoJobActive && !videoJob && job?.status === "done" && job.output_image_url && (
          plan !== "pro" ? (
            /* Free tentou abrir vídeo — redireciona para planos */
            <div style={{ ...styles.card, textAlign: "center" as const, padding: "32px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#eef2f9", marginBottom: 8 }}>
                {lang === "en" ? "Animated video is PRO exclusive" : lang === "es" ? "El video animado es exclusivo PRO" : "Vídeo animado é exclusivo do PRO"}
              </div>
              <div style={{ fontSize: 14, color: "#8394b0", marginBottom: 24, lineHeight: 1.5 }}>
                {lang === "en" ? "Subscribe and generate amazing AI product videos." : lang === "es" ? "Suscríbete y genera videos increíbles de tus productos con IA." : "Assine e gere vídeos incríveis dos seus produtos com IA."}
              </div>
              <button onClick={() => handleAssinarDireto(undefined, "tela_video_locked")} style={{ ...styles.submitBtn, marginBottom: 12 }}>
                {lang === "en" ? "✨ Subscribe PRO" : lang === "es" ? "✨ Suscribirse PRO" : "✨ Assinar PRO"}
              </button>
              <button onClick={() => { setVideoMode(false); }} style={styles.backBtn}>{t("back")}</button>
            </div>
          ) : isGenerating ? (
            /* Tem foto sendo gerada — não pode criar vídeo agora */
            <div style={{ ...styles.card, textAlign: "center" as const, padding: "32px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#eef2f9", marginBottom: 8 }}>
                {lang === "en" ? "Wait for your photo to finish" : lang === "es" ? "Espera que tu foto esté lista" : "Aguarde sua foto ficar pronta"}
              </div>
              <div style={{ fontSize: 14, color: "#8394b0", marginBottom: 24 }}>
                {lang === "en" ? "You can't create a video while a photo is being generated." : lang === "es" ? "No puedes crear un video mientras se genera una foto." : "Não é possível criar um vídeo enquanto uma foto está sendo gerada."}
              </div>
              <button onClick={() => { setVideoMode(false); }} style={styles.backBtn}>{t("back")}</button>
            </div>
          ) : (
            <div style={styles.card}>
              <button onClick={resetVideo} style={styles.backBtn}>{t("back")}</button>
              <h2 style={styles.centerTitle}>{lang === "en" ? "🎬 Create video from photo" : lang === "es" ? "🎬 Crear video de la foto" : "🎬 Criar vídeo da foto"}</h2>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>{lang === "en" ? "Movement" : lang === "es" ? "Movimiento" : "Movimento"} <span style={{ color: "#4e5c72" }}>{t("field_scene_optional")}</span></label>
                <input
                  type="text"
                  placeholder={lang === "en" ? "Ex: camera slowly rotating to the left" : lang === "es" ? "Ej: cámara girando suavemente hacia la izquierda" : "Ex: câmera girando suavemente para a esquerda"}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  style={styles.input}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
                />
              </div>
              {videoError && (
                <div style={{ ...styles.error, marginTop: 12 }}>
                  {videoError === "queue_busy"
                    ? "⏳ Tô trabalhando em vários vídeos agora. Aguarda alguns minutinhos e tenta de novo!"
                    : videoError}
                </div>
              )}
              <button
                onClick={() => handleVideoSubmit(job.output_image_url!)}
                disabled={videoSubmitting}
                style={{ ...styles.submitBtn, marginTop: 16, opacity: videoSubmitting ? 0.6 : 1 }}
              >
                {videoSubmitting ? (lang === "en" ? "Sending..." : lang === "es" ? "Enviando..." : "Enviando...") : t("btn_generate_video")}
              </button>
              <img src={job.output_image_url} alt="base" style={{ ...styles.resultImg, marginTop: 20 }} />
            </div>
          )
        )}

        {/* Vídeo gerando — renderizado antes do BotChat (acima) */}

        {/* Vídeo — pronto (só aparece se Tamo fechado) */}
        {videoJob?.status === "done" && videoJob.output_video_url && videoMode && !botNavOpen && (
          <div style={{ ...styles.card, padding: 0, overflow: "hidden", animation: "fadeIn 0.5s ease" }}>
            <video
              src={videoJob.output_video_url}
              controls
              autoPlay
              loop
              playsInline
              style={{ width: "100%", display: "block", maxHeight: "60vh", background: "#000", objectFit: "contain" }}
            />
            <div style={{ padding: "16px 16px 20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#eef2f9", textAlign: "center" }}>
                🎬 Seu vídeo está pronto!
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(videoJob!.output_video_url!);
                      const blob = await res.blob();
                      await downloadBlob(blob, "video-ia.mp4");
                    } catch { window.open(videoJob!.output_video_url!, "_blank"); }
                  }}
                  style={{
                    flex: 1, background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    border: "none", borderRadius: 14, padding: "14px 0",
                    color: "#fff", fontSize: 15, fontWeight: 700, textAlign: "center",
                    display: "block", cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(139,92,246,0.35)",
                  }}
                >⬇ Baixar</button>
                <button
                  onClick={resetAll}
                  style={{
                    flex: 1, background: "#1a2535", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14, padding: "14px 0",
                    color: "#8394b0", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}
                >📷 Nova foto</button>
              </div>
            </div>
          </div>
        )}

        {/* Vídeo — erro (só aparece se Tamo fechado) */}
        {videoJob?.status === "failed" && videoMode && !botNavOpen && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>😔</div>
            <h2 style={styles.centerTitle}>Ops, algo deu errado</h2>
            <p style={styles.centerDesc}>Pedimos desculpas pelo transtorno. Houve um problema ao gerar seu vídeo, mas você pode tentar novamente agora — é gratuito.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { resetVideo(); }} style={styles.submitBtn}>Tentar novamente</button>
            </div>
          </div>
        )}

        {/* Erro foto (só aparece se Tamo fechado) */}
        {job?.status === "failed" && !botNavOpen && (
          <div style={styles.card}>
            <div style={styles.bigIcon}>😔</div>
            <h2 style={styles.centerTitle}>Ops, algo deu errado</h2>
            <p style={styles.centerDesc}>Pedimos desculpas pelo transtorno. Houve um problema ao gerar sua foto, mas você pode tentar novamente agora — é gratuito.</p>
            <button onClick={resetJob} style={styles.submitBtn}>Tentar novamente</button>
          </div>
        )}
      </main>
      <BottomNav
        hasActiveJob={isGenerating}
        hasDoneJob={hasDoneJob}
        botActive={botActive}
        onCriarWhileBusy={() => router.push("/tamo")}
      />

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

      {showUpsell && (
        <UpsellPopup
          onAssinar={(planType) => {
            setShowUpsell(false);
            handleAssinarDireto(planType, "popup");
          }}
          onClose={() => {
            setShowUpsell(false);
            // Onboarding desativado temporariamente — reativar descomentando abaixo
            // if (workState === "sem_trabalho" && !modeSelected && plan === "free") {
            //   setShowOnboarding(true);
            // }
          }}
        />
      )}

      {showOnboarding && (
        <OnboardingScreen
          onSubmit={(file, produtoVal, cenarioVal) => {
            setShowOnboarding(false);
            setOnboardingMode(true);
            setCreationMode("simulacao");
            setModeSelected(true);
            // Chama handleSubmit direto com os valores, sem depender do state
            handleSubmit({ preventDefault: () => {} } as React.FormEvent, {
              file,
              produto: produtoVal,
              cenario: cenarioVal,
              mode: "simulacao",
            });
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {workState !== "trabalhando" && <PushConversionAgent
        trigger={pushTrigger}
        onRequest={async () => {
          await requestAndRegisterPush();
          setPushTrigger(null);
        }}
        onSkip={() => {
          syncPushStatus("skipped");
          setPushTrigger(null);
        }}
      />}

      {showConversion && job?.output_image_url && (
        <ConversionScreen
          photoUrl={editedImageUrl ?? job.output_image_url}
          onMount={() => { if (abVariant) trackABEvent("conversion_screen", abVariant); }}
          onAssinar={() => {
            setShowConversion(false);
            setOnboardingMode(false);
            handleAssinarDireto("annual", "tela_conversao");
          }}
          onContinuar={() => {
            setShowConversion(false);
            setOnboardingMode(false);
          }}
        />
      )}

      {/* A/B Variante C — VideoHookScreen */}
      {showVideoHook && job?.output_image_url && (
        <VideoHookScreen
          photoUrl={editedImageUrl ?? job.output_image_url}
          onMount={() => { if (abVariant) trackABEvent("video_hook", abVariant); }}
          onAssinar={() => {
            setShowVideoHook(false);
            if (abVariant) trackABEvent("cta_clicked", abVariant);
            handleAssinarDireto("annual", "video_hook");
          }}
          onCriar2aFoto={() => {
            setShowVideoHook(false);
            if (abVariant) trackABEvent("photo2_started", abVariant);
            resetJob();
          }}
        />
      )}


      {/* Mini toast — foto/vídeo pronto */}
      {showToast && (
        <MiniToast
          message={toastMessage}
          linkLabel="Ver em Criações"
          linkHref="/criacoes"
          onDismiss={() => { setShowToast(false); }}
        />
      )}

      {promoOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "#07080b", overflowY: "auto", paddingBottom: 68 }}>
          <PromoCreator
            onBack={() => setPromoOpen(false)}
            initialPhoto={editedImageUrl ?? job?.output_image_url}
          />
        </div>
      )}

      {/* Popup: edição grátis — só na primeira vez que usuário free abre a seção */}
      {editFreePopup && (
        <div
          onClick={() => setEditFreePopup(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 90px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#111820", border: "1px solid rgba(99,102,241,0.35)", borderRadius: 22, padding: "28px 24px 24px", maxWidth: 380, width: "calc(100% - 32px)", textAlign: "center", animation: "slideUp 0.3s ease" }}
          >
            <div style={{ fontSize: 42, marginBottom: 12 }}>✏️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#eef2f9", marginBottom: 8 }}>
              {lang === "en" ? "Editing is 100% free" : lang === "es" ? "La edición es 100% gratis" : "Edição é 100% grátis"}
            </div>
            <div style={{ fontSize: 14, color: "#8394b0", lineHeight: 1.6, marginBottom: 22 }}>
              {lang === "en"
                ? "Customize, add promotions, remove backgrounds — use as much as you want, no limits."
                : lang === "es"
                ? "Personaliza, agrega promociones, elimina fondos — úsalo todo lo que quieras, sin límites."
                : "Personalize, crie promoções, remova fundos — use à vontade, sem limite nenhum."}
            </div>
            <button
              onClick={() => setEditFreePopup(false)}
              style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 14, padding: "13px 0", width: "100%", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              {lang === "en" ? "Got it!" : lang === "es" ? "¡Entendido!" : "Entendido!"}
            </button>
          </div>
        </div>
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
        Converse com seu assistente de IA enquanto sua foto é criada ✨
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div style={notifyStyles.notice}>
        Converse com seu assistente de IA enquanto sua foto é criada ✨
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

function statusLabel(status: JobStatus, elapsedSec: number, createdAt?: string, lang?: string): string {
  const realElapsed = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
    : elapsedSec;
  if (status === "processing") return lang === "en" ? "Generating your photo..." : lang === "es" ? "Generando tu foto..." : "Gerando sua foto...";
  if (status === "submitted") return realElapsed < 20
    ? (lang === "en" ? "Sending to AI..." : lang === "es" ? "Enviando a la IA..." : "Enviando para a IA...")
    : (lang === "en" ? "Processing..." : lang === "es" ? "Procesando..." : "Processando...");
  if (status === "queued") {
    if (realElapsed < 10) return lang === "en" ? "Preparing..." : lang === "es" ? "Preparando..." : "Preparando...";
    if (realElapsed < 120) return lang === "en" ? "In queue..." : lang === "es" ? "En cola..." : "Na fila...";
    return lang === "en" ? "Waiting in queue..." : lang === "es" ? "Esperando en cola..." : "Aguardando na fila...";
  }
  return lang === "en" ? "Processing..." : lang === "es" ? "Procesando..." : "Processando...";
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
  main: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "12px 16px 20px" },
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
  editActionBtn: {
    width: "100%", background: "#111820",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "13px 16px",
    color: "#eef2f9", fontSize: 14, fontWeight: 600,
    cursor: "pointer", textAlign: "left" as const,
    display: "flex", alignItems: "center", gap: 8,
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
  unlockBtn: {
    width: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none", borderRadius: 14, padding: "14px 0", color: "#fff",
    fontSize: 15, fontWeight: 800, cursor: "pointer",
    boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
    letterSpacing: "-0.01em",
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
