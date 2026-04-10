"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const ANDROID_APP_URL = "https://play.google.com/store/apps/details?id=com.tamowork.app";
const ANDROID_FALLBACK = "https://tamowork.com/login";

function detectPlatform(): "android" | "ios" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "desktop";
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
}

export default function AppRedirectPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop" | null>(null);
  const [dots, setDots] = useState(".");
  const [redirecting, setRedirecting] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    const sa = isInStandaloneMode();
    setPlatform(p);
    setStandalone(sa);

    // Marca que o usuário iOS visitou esta página (viu as instruções de instalação)
    if (p === "ios") {
      try { localStorage.setItem("ios_app_visited", "1"); } catch { /* ignora */ }
    }

    if (p === "android") {
      setRedirecting(true);
      const timer = setTimeout(() => {
        window.location.href = ANDROID_APP_URL;
        setTimeout(() => { window.location.href = ANDROID_FALLBACK; }, 2000);
      }, 1800);
      return () => clearTimeout(timer);
    } else if (p === "ios" && sa) {
      // Já está rodando como PWA — vai direto pro app
      const timer = setTimeout(() => { router.replace("/"); }, 1000);
      return () => clearTimeout(timer);
    } else if (p === "desktop") {
      const timer = setTimeout(() => { router.replace("/login"); }, 1400);
      return () => clearTimeout(timer);
    }
    // iOS sem standalone: não redireciona automaticamente — mostra instruções
  }, [router]);

  // Animação dos pontinhos
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(id);
  }, []);

  const isAndroid = platform === "android";
  const isIOS = platform === "ios";
  const showIOSInstructions = isIOS && !standalone;

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
        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @keyframes shimmer {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#07080b",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: showIOSInstructions ? "flex-start" : "center",
        gap: 0,
        padding: showIOSInstructions ? "48px 24px 120px" : 24,
      }}>

        {/* Logo com anel giratório */}
        <div style={{ position: "relative", marginBottom: 28, animation: "fadeUp 0.5s ease both" }}>
          <div style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTop: "2px solid #6366f1",
            borderRight: "2px solid #a855f7",
            animation: "spinRing 1.2s linear infinite",
          }} />
          <img
            src="/icons/icon-512.png"
            alt="TamoWork"
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              display: "block",
              animation: "pulse 2s ease-in-out infinite, glow 2s ease-in-out infinite",
              objectFit: "cover",
            }}
          />
        </div>

        {/* Nome */}
        <div style={{ textAlign: "center", animation: "fadeUp 0.5s 0.1s ease both", opacity: 0, marginBottom: showIOSInstructions ? 32 : 0 }}>
          <div style={{
            fontSize: 26,
            fontWeight: 900,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.03em",
            marginBottom: 4,
          }}>
            TamoWork
          </div>
          <div style={{ fontSize: 13, color: "#4e5c72", fontWeight: 600, letterSpacing: "0.06em" }}>
            FOTO IA
          </div>
        </div>

        {/* ── iOS: instruções para adicionar à tela inicial ── */}
        {showIOSInstructions && (
          <div style={{ width: "100%", maxWidth: 380, animation: "fadeUp 0.5s 0.25s ease both", opacity: 0 }}>

            {/* Card principal */}
            <div style={{
              background: "linear-gradient(160deg, #13102a 0%, #0f1520 60%, #0c1018 100%)",
              border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: 20,
              padding: "24px 20px",
              marginBottom: 16,
              boxShadow: "0 0 40px rgba(168,85,247,0.08)",
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#eef2f9", marginBottom: 6, textAlign: "center" }}>
                {lang === "en" ? "Add to Home Screen 📲" : lang === "es" ? "Añadir a Pantalla de Inicio 📲" : "Adicione à Tela Inicial 📲"}
              </div>
              <div style={{ fontSize: 13, color: "#8394b0", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
                {lang === "en"
                  ? "Use TamoWork as an app directly from your iPhone home screen — no need to open Safari every time."
                  : lang === "es"
                  ? "Accede a TamoWork como una app directamente desde tu iPhone — sin abrir Safari cada vez."
                  : "Acesse o TamoWork como um app direto da tela do seu iPhone — sem abrir o Safari toda vez."}
              </div>

              {/* Passo 1 */}
              <div style={stepStyle}>
                <div style={stepNum}>1</div>
                <div style={{ flex: 1 }}>
                  <div style={stepTitle}>
                    {lang === "en" ? "Tap " : lang === "es" ? "Toca " : "Toque em "}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="#a78bfa" strokeWidth="1.8" fill="none"/>
                        <path d="M12 3v10M9 6l3-3 3 3" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ color: "#a78bfa", fontWeight: 700 }}>
                        {lang === "en" ? "Share" : lang === "es" ? "Compartir" : "Compartilhar"}
                      </span>
                    </span>
                  </div>
                  <div style={stepSub}>
                    {lang === "en" ? "In Safari's bottom toolbar" : lang === "es" ? "En la barra inferior de Safari" : "Na barra inferior do Safari"}
                  </div>
                </div>
              </div>

              {/* Passo 2 */}
              <div style={stepStyle}>
                <div style={stepNum}>2</div>
                <div style={{ flex: 1 }}>
                  <div style={stepTitle}>
                    {lang === "en" ? "Select " : lang === "es" ? "Selecciona " : "Selecione "}
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>
                      {lang === "en" ? '"Add to Home Screen"' : lang === "es" ? '"Añadir a pantalla de inicio"' : '"Adicionar à Tela de Início"'}
                    </span>
                  </div>
                  <div style={stepSub}>
                    {lang === "en" ? "Scroll down the options list" : lang === "es" ? "Desplázate por la lista de opciones" : "Role a lista de opções para baixo"}
                  </div>
                </div>
              </div>

              {/* Passo 3 */}
              <div style={{ ...stepStyle, marginBottom: 0 }}>
                <div style={stepNum}>3</div>
                <div style={{ flex: 1 }}>
                  <div style={stepTitle}>
                    {lang === "en" ? "Tap " : lang === "es" ? "Toca " : "Toque em "}
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>
                      {lang === "en" ? '"Add"' : lang === "es" ? '"Agregar"' : '"Adicionar"'}
                    </span>
                  </div>
                  <div style={stepSub}>
                    {lang === "en" ? "The icon appears on your home screen" : lang === "es" ? "El ícono aparece en tu pantalla de inicio" : "O ícone aparece na sua tela inicial"}
                  </div>
                </div>
              </div>
            </div>

            {/* Seta apontando para baixo */}
            <div style={{ textAlign: "center", marginBottom: 16, animation: "arrowBounce 1.5s ease-in-out infinite" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12l7 7 7-7" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Separador */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
              <span style={{ fontSize: 12, color: "#4e5c72" }}>{lang === "en" ? "or" : lang === "es" ? "o" : "ou"}</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            </div>

            {/* Botão entrar pelo browser */}
            <a
              href="/login"
              style={{
                display: "block",
                textAlign: "center",
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: 14,
                padding: "13px",
                fontSize: 14,
                fontWeight: 600,
                color: "#a78bfa",
                textDecoration: "none",
              }}
            >
              {lang === "en" ? "Continue in Safari instead" : lang === "es" ? "Continuar en Safari de todos modos" : "Continuar pelo Safari mesmo"}
            </a>
          </div>
        )}

        {/* ── Android / Desktop: status de redirecionamento ── */}
        {!showIOSInstructions && platform !== null && (
          <>
            <div style={{ textAlign: "center", animation: "fadeUp 0.5s 0.3s ease both", opacity: 0, marginTop: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#eef2f9", marginBottom: 8 }}>
                {isAndroid && redirecting
                  ? `${lang === "en" ? "Opening app" : lang === "es" ? "Abriendo app" : "Abrindo o app"}${dots}`
                  : platform === "desktop"
                  ? `${lang === "en" ? "Redirecting" : lang === "es" ? "Redirigiendo" : "Redirecionando"}${dots}`
                  : `${lang === "en" ? "Loading" : lang === "es" ? "Cargando" : "Carregando"}${dots}`}
              </div>
              <div style={{ fontSize: 13, color: "#4e5c72" }}>
                {isAndroid
                  ? (lang === "en" ? "You'll be redirected shortly" : lang === "es" ? "Serás redirigido en instantes" : "Você será redirecionado em instantes")
                  : (lang === "en" ? "Preparing your free account" : lang === "es" ? "Preparando tu cuenta gratis" : "Preparando sua conta grátis")}
              </div>
            </div>

            {/* Barra de progresso */}
            <div style={{
              marginTop: 32,
              width: 160,
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
              }} />
            </div>

            {/* Link manual */}
            <div style={{ marginTop: 40, animation: "fadeUp 0.5s 0.6s ease both", opacity: 0, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#4e5c72", marginBottom: 8 }}>
                {lang === "en" ? "Didn't redirect?" : lang === "es" ? "¿No redirigió?" : "Não redirecionou?"}
              </div>
              <a
                href={isAndroid ? ANDROID_APP_URL : "/login"}
                style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 600, textDecoration: "underline" }}
              >
                {isAndroid
                  ? (lang === "en" ? "Open in Play Store" : lang === "es" ? "Abrir en Play Store" : "Abrir na Play Store")
                  : (lang === "en" ? "Access now" : lang === "es" ? "Acceder ahora" : "Acessar agora")}
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}

const stepStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 16,
};

const stepNum: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "rgba(99,102,241,0.2)",
  border: "1px solid rgba(99,102,241,0.4)",
  color: "#a78bfa",
  fontSize: 13,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  marginTop: 1,
};

const stepTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#eef2f9",
  marginBottom: 2,
  lineHeight: 1.4,
};

const stepSub: React.CSSProperties = {
  fontSize: 12,
  color: "#4e5c72",
};
