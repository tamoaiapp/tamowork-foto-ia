"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

interface Props {
  hasActiveJob?: boolean;
  hasDoneJob?: boolean;       // badge verde em Criações
  botActive?: boolean;
  onCriarWhileBusy?: () => void; // callback quando Criar clicado durante job ativo
}

function IconCriar({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#a855f7" />
      <line x1="12" y1="7" x2="12" y2="17" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function IconEditor({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#a855f7" opacity="0.2"/>
      <path d="M8 16l2.5-3.5 2 2.5 2.5-3.5L19 16H8z" fill="#a855f7"/>
      <circle cx="9" cy="9" r="1.5" fill="#a855f7"/>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#a855f7" strokeWidth="1.8"/>
    </svg>
  ) : (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M8 16l2.5-3.5 2 2.5 2.5-3.5L19 16H8z"/>
      <circle cx="9" cy="9" r="1.5" fill={c} stroke="none"/>
    </svg>
  );
}

function IconCriacoes({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
    </svg>
  ) : (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

function IconBot({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="8" width="16" height="12" rx="3"
        fill={active ? "rgba(168,85,247,0.2)" : "none"}
        stroke={c} strokeWidth="1.8" />
      <circle cx="9" cy="13" r="1.5" fill={c} />
      <circle cx="15" cy="13" r="1.5" fill={c} />
      <path d="M9 17h6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 8V5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1" fill={c} />
    </svg>
  );
}

export default function BottomNav({ hasActiveJob = false, hasDoneJob = false, botActive = false, onCriarWhileBusy }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const check = () => {
      const wide = window.innerWidth >= 900;
      const hasTouch = navigator.maxTouchPoints > 0 || ("ontouchstart" in window);
      const pointerFine = window.matchMedia("(pointer: fine)").matches;
      // É desktop se: largo + sem touch + pointer fino
      setIsMobile(!(wide && !hasTouch && pointerFine));
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile) return null;
  if (pathname.startsWith("/convite") || pathname.startsWith("/login")) return null;

  const tabs = [
    { key: "criar", label: t("nav_criar"), path: "/" },
    { key: "editor", label: t("nav_editor"), path: "/editor" },
    { key: "criacoes", label: t("nav_criacoes"), path: "/criacoes" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const nav = (
    <nav style={s.nav} className="bottom-nav">
      <style>{`@keyframes pulseDone { 0%,100%{box-shadow:0 0 0 0 rgba(22,199,132,0.6)} 50%{box-shadow:0 0 0 4px rgba(22,199,132,0)} }`}</style>
      {/* Logo — visível apenas no desktop (sidebar) */}
      <div style={s.brand} className="sidebar-brand">
        <span style={s.brandText}>TamoWork</span>
      </div>

      {tabs.map((tab) => {
        const active = isActive(tab.path);
        const isCriar = tab.key === "criar";
        const isCriacoes = tab.key === "criacoes";
        return (
          <button
            key={tab.key}
            onClick={() => {
              if (isCriar && hasActiveJob && onCriarWhileBusy) {
                onCriarWhileBusy();
              } else {
                router.push(tab.path);
              }
            }}
            style={s.tab}
            className="nav-tab"
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              {isCriar && <IconCriar active={active} />}
              {tab.key === "editor" && <IconEditor active={active} />}
              {isCriacoes && <IconCriacoes active={active} />}
              {/* Ponto roxo: job ativo no Criar */}
              {isCriar && hasActiveJob && <span style={s.activeDot} />}
              {/* Ponto verde: resultado pronto em Criações */}
              {isCriacoes && hasDoneJob && <span style={s.doneDot} />}
            </div>
            <span style={{ ...s.label, color: active ? "#a855f7" : "#4e5c72" }} className="nav-label">
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* Tamo — sempre visível na nav */}
      <button onClick={() => router.push('/tamo')} style={s.tab} className="nav-tab" aria-label="Abrir Tamo">
        <div style={{ position: "relative", flexShrink: 0, width: 28, height: 28 }}>
          <img
            src="/tamo/idle.png"
            alt="Tamo"
            style={{ width: 28, height: 28, objectFit: "contain", objectPosition: "bottom", opacity: pathname === "/tamo" ? 1 : 0.6 }}
          />
          {hasActiveJob && <span style={s.activeDot} />}
        </div>
        <span style={{ ...s.label, color: pathname === "/tamo" ? "#a855f7" : "#4e5c72" }} className="nav-label">Tamo</span>
      </button>
    </nav>
  );

  // Portal: renderiza fora do .app-content para evitar bug de stacking context no iOS
  // (position: fixed dentro de overflow: auto não funciona corretamente no iOS Safari)
  if (typeof document === "undefined") return nav;
  return createPortal(nav, document.body);
}

const s: Record<string, React.CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 560,
    background: "#0c1018",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    zIndex: 200,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  brand: {
    display: "none",
    padding: "28px 26px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    marginBottom: 8,
    alignItems: "center",
  },
  brandText: {
    fontSize: 20,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.01em",
  },
  tab: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    padding: "12px 0 14px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    minHeight: 64,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.01em",
  },
  activeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#a855f7",
    border: "2px solid #0c1018",
  },
  doneDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#16c784",
    border: "2px solid #0c1018",
    animation: "pulseDone 2s ease-in-out infinite",
  },
};
