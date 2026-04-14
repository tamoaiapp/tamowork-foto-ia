"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  message: string;
  linkLabel?: string;
  linkHref?: string;
  duration?: number; // ms, default 5000
  onDismiss: () => void;
}

export default function MiniToast({ message, linkLabel, linkHref, duration = 5000, onDismiss }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // entrada suave
    const t1 = setTimeout(() => setVisible(true), 50);
    // auto-dismiss
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onDismiss]);

  return (
    <div style={{
      position: "fixed",
      bottom: 80,
      left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.25s ease, transform 0.25s ease",
      zIndex: 200,
      background: "#1a2235",
      border: "1px solid rgba(99,102,241,0.35)",
      borderRadius: 14,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)",
      maxWidth: 320,
      width: "calc(100vw - 32px)",
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🎉</span>
      <span style={{ fontSize: 13, color: "#eef2f9", fontWeight: 600, flex: 1 }}>{message}</span>
      {linkLabel && linkHref && (
        <button
          onClick={() => { onDismiss(); router.push(linkHref); }}
          style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {linkLabel}
        </button>
      )}
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        style={{ background: "none", border: "none", color: "#4e5c72", cursor: "pointer", padding: 0, fontSize: 16, flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}
