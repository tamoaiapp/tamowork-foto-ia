"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";

function IconCriar({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#8394b0";
  return active ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#a855f7" />
      <line x1="12" y1="7" x2="12" y2="17" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function IconEditor({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#8394b0";
  return active ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#a855f7" opacity="0.2"/>
      <path d="M8 16l2.5-3.5 2 2.5 2.5-3.5L19 16H8z" fill="#a855f7"/>
      <circle cx="9" cy="9" r="1.5" fill="#a855f7"/>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#a855f7" strokeWidth="1.8"/>
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M8 16l2.5-3.5 2 2.5 2.5-3.5L19 16H8z"/>
      <circle cx="9" cy="9" r="1.5" fill={c} stroke="none"/>
    </svg>
  );
}

function IconCriacoes({ active }: { active: boolean }) {
  const c = active ? "#a855f7" : "#8394b0";
  return active ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="#a855f7" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

function IconPlans() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8394b0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function IconAccount() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8394b0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

const HIDDEN_PATHS = ["/login", "/onboarding", "/privacidade", "/convite"];

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  // Exige largura ≥ 900px E ausência de touch
  const wideEnough = window.innerWidth >= 900;
  const hasTouch = navigator.maxTouchPoints > 0 || ("ontouchstart" in window);
  const pointerFine = window.matchMedia("(pointer: fine)").matches;
  return wideEnough && !hasTouch && pointerFine;
}

export default function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useI18n();
  const [show, setShow] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const check = () => setShow(isDesktop());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("user_plans")
        .select("plan, period_end")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const active =
        data?.plan === "pro" &&
        (!data.period_end || new Date(data.period_end) > new Date());
      setIsPro(active);
    });
  }, []);

  // Não mostra em páginas públicas/auth
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;
  // Não mostra em mobile/touch/app
  if (!show) return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const navItems = [
    { key: "criar",    label: t("nav_criar"),    path: "/",        icon: (a: boolean) => <IconCriar active={a} /> },
    { key: "editor",   label: t("nav_editor"),   path: "/editor",  icon: (a: boolean) => <IconEditor active={a} /> },
    { key: "criacoes", label: t("nav_criacoes"), path: "/criacoes",icon: (a: boolean) => <IconCriacoes active={a} /> },
  ];

  return (
    <aside className="desktop-sidebar" style={s.sidebar}>
      {/* Logo */}
      <div style={s.logoArea}>
        <div>
          <div style={s.logoText}>TamoWork</div>
          <div style={s.logoSub}>Foto IA</div>
        </div>
      </div>

      {/* Nav principal */}
      <nav style={s.nav}>
        <div style={s.navSection}>{lang === "en" ? "Tools" : lang === "es" ? "Herramientas" : "Ferramentas"}</div>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.key}
              onClick={() => {
                router.push(item.path);
              }}
              style={{
                ...s.navItem,
                background: active ? "rgba(168,85,247,0.12)" : "transparent",
                color: active ? "#c4b5fd" : "#8394b0",
              }}
              className="sidebar-nav-item"
            >
              {item.icon(active)}
              <span style={{ ...s.navLabel, color: active ? "#c4b5fd" : "#8394b0" }}>{item.label}</span>
              {active && <div style={s.activeBar} />}
            </button>
          );
        })}
      </nav>

      {/* Tamo — chat/status */}
      <div style={{ padding: "4px 12px 12px" }}>
        <div style={s.navSection}>Tamo</div>
        <button
          onClick={() => router.push("/tamo")}
          style={{
            ...s.navItem,
            background: pathname === "/tamo" ? "rgba(168,85,247,0.12)" : "transparent",
          }}
          className="sidebar-nav-item"
        >
          <div style={{ position: "relative", width: 22, height: 22, flexShrink: 0 }}>
            <img
              src="/tamo/idle.png"
              alt="Tamo"
              style={{ width: 22, height: 22, objectFit: "contain", objectPosition: "bottom", opacity: pathname === "/tamo" ? 1 : 0.7 }}
            />
          </div>
          <span style={{ ...s.navLabel, color: pathname === "/tamo" ? "#c4b5fd" : "#8394b0" }}>
            {lang === "en" ? "Tamo AI" : "Tamo"}
          </span>
          {pathname === "/tamo" && <div style={s.activeBar} />}
        </button>
      </div>

      {/* Bottom */}
      <div style={s.bottom}>
        {isPro ? (
          <div style={s.proBadge}>
            <span style={{ fontSize: 14 }}>⭐</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd" }}>{lang === "en" ? "Pro plan active" : lang === "es" ? "Plan Pro activo" : "Plano Pro ativo"}</span>
          </div>
        ) : (
          <button onClick={() => router.push("/planos")} style={s.proBtn}>
            <IconPlans />
            <span>{lang === "en" ? "Subscribe Pro" : lang === "es" ? "Suscribirse Pro" : "Assinar Pro"}</span>
          </button>
        )}
        <button onClick={() => router.push("/conta")} style={s.accountItem} className="sidebar-nav-item">
          <IconAccount />
          <span style={s.navLabel}>{lang === "en" ? "My account" : lang === "es" ? "Mi cuenta" : "Minha conta"}</span>
        </button>
      </div>
    </aside>
  );
}

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: 220,
    background: "#0a0e15",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    zIndex: 100,
    overflowY: "auto",
  },
  logoArea: {
    padding: "24px 20px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.01em",
    lineHeight: 1,
  },
  logoSub: {
    fontSize: 11,
    fontWeight: 500,
    color: "#4e5c72",
    marginTop: 3,
    letterSpacing: "0.04em",
  },
  nav: {
    flex: 1,
    padding: "4px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  navSection: {
    fontSize: 10,
    fontWeight: 700,
    color: "#4e5c72",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    padding: "12px 8px 6px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "left" as const,
    transition: "background 0.15s, color 0.15s",
    position: "relative" as const,
    width: "100%",
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
  },
  activeBar: {
    position: "absolute" as const,
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    width: 3,
    height: 20,
    borderRadius: 2,
    background: "#a855f7",
  },
  bottom: {
    padding: "12px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  proBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(168,85,247,0.3)",
    background: "rgba(168,85,247,0.08)",
    color: "#c4b5fd",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  proBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(99,102,241,0.25)",
    background: "rgba(99,102,241,0.06)",
    width: "100%",
  },
  accountItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#8394b0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    textAlign: "left" as const,
  },
};
