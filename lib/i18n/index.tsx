"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translations, Lang, TranslationKey } from "./translations";

const I18nContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}>({
  lang: "pt",
  setLang: () => {},
  t: (key) => translations.pt[key] as string,
});

function detectLang(): Lang {
  if (typeof window === "undefined") return "pt";
  const saved = localStorage.getItem("tw_lang") as Lang | null;
  if (saved && ["pt", "en", "es"].includes(saved)) return saved;
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("tw_lang", l);
  }

  function t(key: TranslationKey): string {
    const dict = translations[lang] as Record<string, unknown>;
    const val = dict[key];
    if (typeof val === "string") return val;
    // fallback to pt
    const fb = (translations.pt as Record<string, unknown>)[key];
    return typeof fb === "string" ? fb : key;
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

// Selector de idioma para o header
export function LangSelector() {
  const { lang, setLang } = useI18n();
  const flags: Record<Lang, string> = { pt: "🇧🇷", en: "🇺🇸", es: "🇪🇸" };
  const labels: Record<Lang, string> = { pt: "PT", en: "EN", es: "ES" };
  const next: Record<Lang, Lang> = { pt: "en", en: "es", es: "pt" };

  return (
    <button
      onClick={() => setLang(next[lang])}
      title="Change language"
      style={{
        background: "none", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8, padding: "8px 10px", cursor: "pointer",
        color: "#8394b0", fontSize: 11, fontWeight: 700,
        display: "flex", alignItems: "center", gap: 4,
        fontFamily: "inherit", minHeight: 44, minWidth: 44,
      }}
    >
      {flags[lang]} {labels[lang]}
    </button>
  );
}
