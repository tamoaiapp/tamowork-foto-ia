"use client";

import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

interface Props {
  hasActiveJob?: boolean;
}

function IconCriar({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#a855f7" />
      <line x1="12" y1="7" x2="12" y2="17" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function IconEditor({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#a855f7" opacity="0.2"/>
      <path d="M8 16l2.5-3.5 2 2.5 2.5-3.5L19 16H8z" fill="#a855f7"/>
      <circle cx="9" cy="9" r="1.5" fill="#a855f7"/>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#a855f7" strokeWidth="1.8"/>
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M8 16l2.5-3.5 2 2.5 2.5-3.5L19 16H8z"/>
      <circle cx="9" cy="9" r="1.5" fill={c} stroke="none"/>
    </svg>
  );
}

function IconCriacoes({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

export default function BottomNav({ hasActiveJob = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs = [
    { key: "criar", label: t("nav_criar"), path: "/" },
    { key: "editor", label: t("nav_editor"), path: "/editor" },
    { key: "criacoes", label: t("nav_criacoes"), path: "/criacoes" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav style={s.nav} className="bottom-nav">
      {/* Logo — visível apenas no desktop (sidebar) */}
      <div style={s.brand} className="sidebar-brand">
        <span style={s.brandText}>TamoWork</span>
      </div>

      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button key={tab.key} onClick={() => router.push(tab.path)} style={s.tab} className="nav-tab">
            <div style={{ position: "relative", flexShrink: 0 }}>
              {tab.key === "criar" && <IconCriar active={active} />}
              {tab.key === "editor" && <IconEditor active={active} />}
              {tab.key === "criacoes" && <IconCriacoes active={active} />}
              {tab.key === "criar" && hasActiveJob && <span style={s.activeDot} />}
            </div>
            <span style={{ ...s.label, color: active ? "#a855f7" : "#4e5c72" }} className="nav-label">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
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
    zIndex: 50,
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
    gap: 4,
    padding: "10px 0 12px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.02em",
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
};
