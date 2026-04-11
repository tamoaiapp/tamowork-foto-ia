"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LangSelector } from "@/lib/i18n";

interface AppHeaderProps {
  /** Título opcional exibido abaixo de "TamoWork" */
  subtitle?: string;
  /** Exibe botão de voltar (← ) antes da logo */
  back?: boolean;
  /** Ação personalizada do botão voltar (padrão: router.back()) */
  onBack?: () => void;
  /** Elemento adicional no lado direito (ex: botão Salvar) */
  rightExtra?: React.ReactNode;
}

export default function AppHeader({ subtitle, back, onBack, rightExtra }: AppHeaderProps) {
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("user_plans")
        .select("plan")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setIsPro(data?.plan === "pro");
    });
  }, []);

  return (
    <header style={s.header} className="app-header">
      <div style={s.left}>
        {back && (
          <button
            onClick={onBack ?? (() => router.back())}
            style={s.backBtn}
            aria-label="Voltar"
          >
            ←
          </button>
        )}
        <div style={s.logoIcon}>
          <img src="/icons/icon-192.png" alt="TamoWork" style={{ width: 34, height: 34, borderRadius: 9, display: "block", objectFit: "cover" }} />
        </div>
        <div>
          <div style={s.logoText}>TamoWork</div>
          {subtitle && <div style={s.subtitle}>{subtitle}</div>}
        </div>
      </div>

      <div style={s.right}>
        <LangSelector />
        {isPro && <span style={s.proBadge}>✦ Pro</span>}
        {rightExtra}
        <button
          onClick={() => router.push("/conta")}
          style={s.accountBtn}
          aria-label="Minha conta"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </button>
      </div>
    </header>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#0c1018",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "4px 10px",
    color: "#8394b0",
    fontSize: 16,
    cursor: "pointer",
    marginRight: 2,
  },
  logoIcon: {
    flexShrink: 0,
  },
  logoText: {
    fontSize: 15,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 10,
    color: "#4e5c72",
    fontWeight: 600,
    letterSpacing: "0.04em",
    marginTop: 1,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  proBadge: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    borderRadius: 8,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
  },
  accountBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "6px 10px",
    color: "#8394b0",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
};
