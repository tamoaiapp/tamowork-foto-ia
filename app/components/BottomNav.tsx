"use client";

import { usePathname, useRouter } from "next/navigation";

interface Props {
  hasActiveJob?: boolean;
}

function IconCriar({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    // Filled: circle preenchido com plus branco
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#a855f7" />
      <line x1="12" y1="7" x2="12" y2="17" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ) : (
    // Outline
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function IconFeed({ active }: { active: boolean }) {
  return active ? (
    // Filled: casa estilo Instagram
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H15v-5h-6v5H4a1 1 0 01-1-1V10.5z" fill="#a855f7" />
    </svg>
  ) : (
    // Outline
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4e5c72" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H15v-5h-6v5H4a1 1 0 01-1-1V10.5z" />
    </svg>
  );
}

function IconCriacoes({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#4e5c72";
  return active ? (
    // Filled: 4 quadrados preenchidos
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
    </svg>
  ) : (
    // Outline
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

  const tabs = [
    { key: "criar", label: "Criar", path: "/" },
    { key: "explorar", label: "Feed", path: "/explorar" },
    { key: "criacoes", label: "Criações", path: "/criacoes" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav style={s.nav}>
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button key={tab.key} onClick={() => router.push(tab.path)} style={s.tab}>
            <div style={{ position: "relative" }}>
              {tab.key === "criar" && <IconCriar active={active} />}
              {tab.key === "explorar" && <IconFeed active={active} />}
              {tab.key === "criacoes" && <IconCriacoes active={active} />}
              {tab.key === "criar" && hasActiveJob && <span style={s.activeDot} />}
            </div>
            <span style={{ ...s.label, color: active ? "#a855f7" : "#4e5c72" }}>
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
