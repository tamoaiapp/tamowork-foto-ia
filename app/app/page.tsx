"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.tamowork.app";

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
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    const sa = isInStandaloneMode();
    setPlatform(p);
    setStandalone(sa);

    if (p === "ios") {
      try { localStorage.setItem("ios_app_visited", "1"); } catch { /* ignora */ }
      if (sa) {
        // já instalado como PWA — vai direto pro app
        setTimeout(() => { router.replace("/"); }, 800);
      }
    } else if (p === "android") {
      // Abre Play Store imediatamente
      window.location.href = PLAY_STORE_URL;
    } else {
      setTimeout(() => { router.replace("/login"); }, 1000);
    }
  }, [router]);

  const showIOSInstructions = platform === "ios" && !standalone;
  const isAndroid = platform === "android";

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 30px rgba(139,92,246,0.4); }
          50%       { box-shadow: 0 0 55px rgba(139,92,246,0.7); }
        }
        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(6px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .fade1 { animation: fadeUp 0.45s ease both; }
        .fade2 { animation: fadeUp 0.45s 0.1s ease both; opacity: 0; }
        .fade3 { animation: fadeUp 0.45s 0.22s ease both; opacity: 0; }
        .fade4 { animation: fadeUp 0.45s 0.36s ease both; opacity: 0; }
      `}</style>

      <div style={{
        minHeight: "100dvh",
        background: "#07080b",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: showIOSInstructions ? "flex-start" : "center",
        padding: showIOSInstructions ? "44px 20px 100px" : "24px 20px",
        fontFamily: "Outfit, sans-serif",
        color: "#eef2f9",
      }}>

        {/* Logo */}
        <div className="fade1" style={{ position: "relative", marginBottom: 20 }}>
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: "2px solid transparent",
            borderTop: "2px solid #6366f1", borderRight: "2px solid #a855f7",
            animation: "spin 1.2s linear infinite",
          }} />
          <img
            src="/icons/icon-512.png"
            alt="TamoWork"
            style={{
              width: 76, height: 76, borderRadius: 20,
              display: "block", objectFit: "cover",
              animation: "glow 2.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Nome */}
        <div className="fade2" style={{ textAlign: "center", marginBottom: showIOSInstructions ? 28 : 0 }}>
          <div style={{
            fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 3,
          }}>TamoWork</div>
          <div style={{ fontSize: 12, color: "#4e5c72", fontWeight: 600, letterSpacing: "0.08em" }}>FOTO IA</div>
        </div>

        {/* ── iOS: instruções para adicionar à tela inicial ── */}
        {showIOSInstructions && (
          <div style={{ width: "100%", maxWidth: 370 }}>

            <div className="fade3" style={{
              background: "linear-gradient(160deg, #13102a 0%, #0f1520 60%, #0c1018 100%)",
              border: "1px solid rgba(168,85,247,0.28)",
              borderRadius: 20, padding: "22px 18px 18px",
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>
                📲 {lang === "en" ? "Install on your iPhone" : "Instalar no iPhone"}
              </div>
              <div style={{ fontSize: 13, color: "#8394b0", textAlign: "center", marginBottom: 22, lineHeight: 1.55 }}>
                {lang === "en"
                  ? "Add TamoWork to your home screen and use it like a native app — no App Store needed."
                  : "Adicione o TamoWork na tela inicial e use como um app nativo — sem precisar da App Store."}
              </div>

              {/* Passo 1 */}
              <div style={step}>
                <div style={badge}>1</div>
                <div>
                  <div style={stepTitle}>
                    {lang === "en" ? "Tap the " : "Toque no "}
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>
                      {lang === "en" ? "Share button" : "botão Compartilhar"}
                    </span>
                    {" "}
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle", marginBottom: 2 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="#a78bfa" strokeWidth="1.9" fill="none"/>
                      <path d="M12 3v10M9 6l3-3 3 3" stroke="#a78bfa" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div style={stepSub}>
                    {lang === "en" ? "Tap the icon at the bottom of Safari" : "Ícone na barra inferior do Safari"}
                  </div>
                </div>
              </div>

              {/* Passo 2 */}
              <div style={step}>
                <div style={badge}>2</div>
                <div>
                  <div style={stepTitle}>
                    {lang === "en" ? "Tap " : "Toque em "}
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>
                      {lang === "en" ? '"Add to Home Screen"' : '"Adicionar à Tela de Início"'}
                    </span>
                  </div>
                  <div style={stepSub}>
                    {lang === "en" ? "Scroll down in the share menu" : "Role o menu de compartilhamento para baixo"}
                  </div>
                </div>
              </div>

              {/* Passo 3 */}
              <div style={{ ...step, marginBottom: 0 }}>
                <div style={badge}>3</div>
                <div>
                  <div style={stepTitle}>
                    {lang === "en" ? "Tap " : "Toque em "}
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>
                      {lang === "en" ? '"Add"' : '"Adicionar"'}
                    </span>
                    {lang === "en" ? " to confirm" : " para confirmar"}
                  </div>
                  <div style={stepSub}>
                    {lang === "en" ? "The icon appears on your home screen" : "O ícone aparece na sua tela inicial 🎉"}
                  </div>
                </div>
              </div>
            </div>

            {/* Seta indicando barra inferior do Safari */}
            <div className="fade3" style={{ textAlign: "center", marginBottom: 14, animation: "arrowBounce 1.5s ease-in-out infinite" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12l7 7 7-7" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ fontSize: 11, color: "#4e5c72", marginTop: 2 }}>
                {lang === "en" ? "Safari's share button is here ↓" : "O botão Compartilhar do Safari fica aqui ↓"}
              </div>
            </div>

            {/* Separador */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
              <span style={{ fontSize: 12, color: "#4e5c72" }}>{lang === "en" ? "or" : "ou"}</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            </div>

            {/* Botão continuar pelo browser */}
            <a href="/login" className="fade4" style={{
              display: "block", textAlign: "center",
              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 14, padding: "13px",
              fontSize: 14, fontWeight: 600, color: "#a78bfa", textDecoration: "none",
            }}>
              {lang === "en" ? "Continue in Safari instead" : "Continuar pelo Safari mesmo"}
            </a>
          </div>
        )}

        {/* ── Android: botão Play Store ── */}
        {isAndroid && (
          <div className="fade3" style={{ textAlign: "center", marginTop: 24, width: "100%", maxWidth: 320 }}>
            <div style={{ fontSize: 15, color: "#8394b0", marginBottom: 20 }}>
              {lang === "en"
                ? "Opening Google Play Store..."
                : "Abrindo o Google Play Store..."}
            </div>

            <a
              href={PLAY_STORE_URL}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                background: "#1a1a2e", border: "1.5px solid rgba(255,255,255,0.12)",
                borderRadius: 16, padding: "16px 24px", textDecoration: "none",
                marginBottom: 12,
              }}
            >
              {/* Ícone Play Store */}
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M3 20.5v-17c0-.83 1-.83 1.5-.5l16 8.5-16 8.5C3.5 21.33 3 21.33 3 20.5z" fill="url(#ps)" />
                <defs>
                  <linearGradient id="ps" x1="3" y1="12" x2="20" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d2ff" />
                    <stop offset="0.5" stopColor="#00e676" />
                    <stop offset="1" stopColor="#ffee58" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, color: "#8394b0", letterSpacing: "0.04em" }}>
                  {lang === "en" ? "GET IT ON" : "DISPONÍVEL NO"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#eef2f9", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                  Google Play
                </div>
              </div>
            </a>

            <a href="/login" style={{ fontSize: 13, color: "#4e5c72", textDecoration: "underline" }}>
              {lang === "en" ? "Continue in browser instead" : "Continuar pelo navegador mesmo"}
            </a>
          </div>
        )}

        {/* ── Desktop / loading ── */}
        {platform === "desktop" && (
          <div className="fade3" style={{ textAlign: "center", marginTop: 20, color: "#4e5c72", fontSize: 14 }}>
            {lang === "en" ? "Redirecting..." : "Redirecionando..."}
          </div>
        )}

        {/* iOS standalone: já instalado */}
        {platform === "ios" && standalone && (
          <div className="fade3" style={{ textAlign: "center", marginTop: 20, color: "#16c784", fontSize: 14 }}>
            {lang === "en" ? "Opening app..." : "Abrindo o app..."}
          </div>
        )}

      </div>
    </>
  );
}

const step: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16,
};

const badge: React.CSSProperties = {
  width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 1,
  background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)",
  color: "#a78bfa", fontSize: 13, fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const stepTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: "#eef2f9", marginBottom: 2, lineHeight: 1.4,
};

const stepSub: React.CSSProperties = {
  fontSize: 12, color: "#4e5c72", lineHeight: 1.45,
};
