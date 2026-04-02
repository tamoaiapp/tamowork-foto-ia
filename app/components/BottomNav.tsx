"use client";

import { usePathname, useRouter } from "next/navigation";

interface Props {
  hasActiveJob?: boolean;
}

export default function BottomNav({ hasActiveJob = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    {
      key: "criar",
      label: "Criar",
      path: "/",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "#4e5c72"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
    {
      key: "explorar",
      label: "Explorar",
      path: "/explorar",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "#4e5c72"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      key: "criacoes",
      label: "Criações",
      path: "/conta",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#a855f7" : "#4e5c72"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
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
          <button
            key={tab.key}
            onClick={() => router.push(tab.path)}
            style={s.tab}
          >
            <div style={{ position: "relative" }}>
              {tab.icon(active)}
              {tab.key === "criar" && hasActiveJob && (
                <span style={s.activeDot} />
              )}
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
