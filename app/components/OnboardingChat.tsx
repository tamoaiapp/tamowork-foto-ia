"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  { delay: 2000,  text: "Estou gerando a foto do seu produto agora... ✨" },
  { delay: 8000,  text: "Com o Pro você gera fotos ilimitadas — sem esperar 24h. 📸" },
  { delay: 18000, text: "Usuários Pro criam vídeos animados dos produtos para o Reels. 🎬" },
  { delay: 28000, text: "Fundo branco profissional em segundos — sem fundo bagunçado. ✂️" },
  { delay: 40000, text: "Catálogo com modelo virtual: sua roupa, sem precisar de fotógrafo. 👗" },
  { delay: 55000, text: "Quase pronto! A maioria das fotos fica em menos de 90 segundos. ⏱️" },
  { delay: 70000, text: "+500 lojistas já vendem mais com fotos do TamoWork. ⭐" },
  { delay: 85000, text: "Acabando... vai ficar incrível! 🚀" },
];

export default function OnboardingChat() {
  const [visible, setVisible] = useState<typeof MESSAGES>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = MESSAGES.map((msg) =>
      setTimeout(() => {
        setVisible((prev) => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }, msg.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  if (visible.length === 0) return null;

  return (
    <div style={s.wrap}>
      {visible.map((msg, i) => (
        <div key={i} style={s.bubble}>
          <div style={s.avatar}>✦</div>
          <div style={s.text}>{msg.text}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex", flexDirection: "column", gap: 10,
    padding: "16px 0 8px",
    width: "100%",
  },
  bubble: {
    display: "flex", alignItems: "flex-start", gap: 10,
    animation: "slideUp .3s ease",
  },
  avatar: {
    width: 30, height: 30, borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 800, color: "#fff",
    flexShrink: 0, marginTop: 2,
  },
  text: {
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "4px 16px 16px 16px",
    padding: "10px 14px",
    fontSize: 14, color: "#eef2f9", lineHeight: 1.5,
    maxWidth: "calc(100% - 42px)",
  },
};
