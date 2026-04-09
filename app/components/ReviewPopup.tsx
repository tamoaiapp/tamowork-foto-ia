"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.tamowork.app";
const STORAGE_KEY = "tw_review_asked";

export default function ReviewPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    const alreadyAsked = localStorage.getItem(STORAGE_KEY);
    if (!isAndroid || alreadyAsked) return;

    let timer: ReturnType<typeof setTimeout>;

    // Só mostra se o usuário estiver logado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      timer = setTimeout(() => setVisible(true), 10000);
    });

    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function openPlayStore() {
    localStorage.setItem(STORAGE_KEY, "1");
    window.open(PLAY_STORE_URL, "_blank");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={s.overlay} onClick={dismiss}>
      <div style={s.card} onClick={e => e.stopPropagation()}>
        <div style={s.stars}>⭐⭐⭐⭐⭐</div>
        <div style={s.title}>Está gostando do TamoWork?</div>
        <div style={s.sub}>
          Sua avaliação na Play Store ajuda mais lojistas a nos encontrar e nos motiva a melhorar cada vez mais!
        </div>
        <button onClick={openPlayStore} style={s.btn}>
          Avaliar na Play Store
        </button>
        <button onClick={dismiss} style={s.dismiss}>Agora não</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 9999,
    padding: "0 0 24px",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#13102a",
    border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 24,
    padding: "28px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    margin: "0 16px",
    boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
    fontFamily: "'Outfit', sans-serif",
  },
  stars: { fontSize: 32, letterSpacing: 4, lineHeight: 1 },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: "#eef2f9",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: "#8394b0",
    textAlign: "center",
    lineHeight: 1.6,
  },
  btn: {
    width: "100%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
    marginTop: 8,
  },
  dismiss: {
    background: "none",
    border: "none",
    color: "#4e5c72",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },
};
