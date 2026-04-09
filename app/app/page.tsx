"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Troque pela URL real do Play Store quando publicar
const ANDROID_APP_URL = "https://play.google.com/store/apps/details?id=com.tamowork.app";
// Para abrir direto o PWA no Android (fallback se não tiver Play Store)
const ANDROID_FALLBACK = "https://tamowork.com/login";

function detectPlatform(): "android" | "ios" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "desktop";
}

export default function AppRedirectPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop" | null>(null);
  const [dots, setDots] = useState(".");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    if (p === "android") {
      setRedirecting(true);
      const timer = setTimeout(() => {
        // Tenta abrir o app nativo; se não tiver instalado vai para Play Store
        window.location.href = ANDROID_APP_URL;
        // Fallback: se não abriu em 2s, vai para web
        setTimeout(() => {
          window.location.href = ANDROID_FALLBACK;
        }, 2000);
      }, 1800);
      return () => clearTimeout(timer);
    } else {
      // iOS ou desktop → vai para login após 1.4s
      const timer = setTimeout(() => {
        router.replace("/login");
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [router]);

  // Animação dos pontinhos
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(id);
  }, []);

  const isAndroid = platform === "android";

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 30px rgba(139,92,246,0.4), 0 0 60px rgba(99,102,241,0.15); }
          50%       { box-shadow: 0 0 50px rgba(139,92,246,0.7), 0 0 100px rgba(99,102,241,0.3); }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#07080b",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: 24,
      }}>

        {/* Logo com anel giratório */}
        <div style={{ position: "relative", marginBottom: 36, animation: "fadeUp 0.5s ease both" }}>
          {/* Anel giratório */}
          <div style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTop: "2px solid #6366f1",
            borderRight: "2px solid #a855f7",
            animation: "spinRing 1.2s linear infinite",
          }} />
          {/* Ícone */}
          <div style={{
            width: 90,
            height: 90,
            borderRadius: 24,
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "pulse 2s ease-in-out infinite, glow 2s ease-in-out infinite",
          }}>
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
              <path d="M8 22l5-7 4 4.5 4.5-6.5L25 22H8z" fill="white" opacity="0.95" />
              <circle cx="12.5" cy="11" r="3" fill="white" opacity="0.95" />
            </svg>
          </div>
        </div>

        {/* Textos */}
        <div style={{ textAlign: "center", animation: "fadeUp 0.5s 0.15s ease both", opacity: 0 }}>
          <div style={{
            fontSize: 28,
            fontWeight: 900,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.03em",
            marginBottom: 6,
          }}>
            TamoWork
          </div>
          <div style={{ fontSize: 14, color: "#4e5c72", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 32 }}>
            FOTO IA
          </div>
        </div>

        {/* Status */}
        <div style={{ textAlign: "center", animation: "fadeUp 0.5s 0.3s ease both", opacity: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#eef2f9", marginBottom: 8 }}>
            {isAndroid && redirecting
              ? `Abrindo o app${dots}`
              : platform === "ios"
              ? `Abrindo${dots}`
              : platform === "desktop"
              ? `Redirecionando${dots}`
              : `Carregando${dots}`}
          </div>
          <div style={{ fontSize: 13, color: "#4e5c72" }}>
            {isAndroid
              ? "Você será redirecionado em instantes"
              : "Preparando sua conta grátis"}
          </div>
        </div>

        {/* Barra de progresso */}
        <div style={{
          marginTop: 40,
          width: 180,
          height: 3,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 99,
          overflow: "hidden",
          animation: "fadeUp 0.5s 0.4s ease both",
          opacity: 0,
        }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg, #6366f1, #a855f7)",
            borderRadius: 99,
            animation: "spinRing 1.4s ease-in-out infinite alternate",
            width: "60%",
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* Link manual caso não redirecione */}
        {platform !== null && (
          <div style={{ marginTop: 48, animation: "fadeUp 0.5s 0.6s ease both", opacity: 0, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#4e5c72", marginBottom: 8 }}>
              Não redirecionou?
            </div>
            <a
              href={isAndroid ? ANDROID_APP_URL : "/login"}
              style={{
                fontSize: 13,
                color: "#8b5cf6",
                fontWeight: 600,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {isAndroid ? "Abrir na Play Store" : "Acessar agora"}
            </a>
          </div>
        )}
      </div>
    </>
  );
}
