"use client";

import { useState, useEffect } from "react";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.tamowork.app";
const STORAGE_KEY = "tw_review_asked";

export default function ReviewPopup() {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Só mostra para Android, uma única vez
    const isAndroid = /android/i.test(navigator.userAgent);
    const alreadyAsked = localStorage.getItem(STORAGE_KEY);
    if (!isAndroid || alreadyAsked) return;

    // Aguarda 8s para não aparecer logo no início
    const t = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function handleStar(star: number) {
    setSelected(star);
    localStorage.setItem(STORAGE_KEY, "1");
    if (star >= 4) {
      setSent(true);
      setTimeout(() => {
        window.open(PLAY_STORE_URL, "_blank");
        setVisible(false);
      }, 800);
    } else {
      // Nota baixa — apenas fecha sem abrir a loja
      setSent(true);
      setTimeout(() => setVisible(false), 1200);
    }
  }

  if (!visible) return null;

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        {sent ? (
          <div style={s.thanks}>
            {selected >= 4 ? "⭐ Obrigado! Abrindo a Play Store..." : "Obrigado pelo feedback!"}
          </div>
        ) : (
          <>
            <div style={s.icon}>⭐</div>
            <div style={s.title}>Está gostando do TamoWork?</div>
            <div style={s.sub}>
              Sua avaliação ajuda mais lojistas a descobrir o app e nos motiva a melhorar!
            </div>

            {/* Estrelas */}
            <div style={s.stars}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => handleStar(n)}
                  style={s.starBtn}
                >
                  <span style={{
                    fontSize: 36,
                    filter: (hovered || selected) >= n ? "none" : "grayscale(1) opacity(0.4)",
                    transition: "filter 0.15s",
                  }}>
                    ⭐
                  </span>
                </button>
              ))}
            </div>

            <button onClick={dismiss} style={s.dismiss}>Agora não</button>
          </>
        )}
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
  },
  icon: { fontSize: 40, lineHeight: 1 },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: "#eef2f9",
    textAlign: "center",
    fontFamily: "'Outfit', sans-serif",
  },
  sub: {
    fontSize: 14,
    color: "#8394b0",
    textAlign: "center",
    lineHeight: 1.5,
    fontFamily: "'Outfit', sans-serif",
  },
  stars: {
    display: "flex",
    gap: 4,
    margin: "8px 0 4px",
  },
  starBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    lineHeight: 1,
  },
  dismiss: {
    background: "none",
    border: "none",
    color: "#4e5c72",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
    marginTop: 4,
  },
  thanks: {
    fontSize: 16,
    fontWeight: 700,
    color: "#a78bfa",
    textAlign: "center",
    padding: "16px 0",
    fontFamily: "'Outfit', sans-serif",
  },
};
