"use client";

/**
 * Rota temporaria de preview do VideoHookScreen.
 * Acesse: https://tamowork.com/preview-upsell
 * Pode remover depois de aprovado.
 */

import { useState } from "react";
import VideoHookScreen from "@/app/components/VideoHookScreen";

// Foto mock — output public real de um job done (bucket publico, sem signed url)
const MOCK_PHOTO = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/image-jobs/6ac2cd5b-47a2-4861-9f17-b8767458798c.jpg";

export default function PreviewUpsell() {
  const [open, setOpen] = useState(true);

  return (
    <main style={{ minHeight: "100dvh", background: "#07080b", color: "#eef2f9", padding: "0 16px" }}>
      {/* Simula a tela de resultado da foto que ficaria atras */}
      <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: 60, paddingBottom: 80 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>📸 Sua foto está pronta</h1>
        <p style={{ color: "#8394b0", fontSize: 14, marginBottom: 24 }}>
          Esta é a tela que o cliente FREE vê após a 1ª foto. O upsell aparece em cima.
        </p>
        <img
          src={MOCK_PHOTO}
          alt="Foto exemplo"
          style={{
            width: "100%", borderRadius: 16,
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        />
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button
            onClick={() => setOpen(true)}
            style={{
              flex: 1, padding: "12px",
              background: "rgba(99,102,241,0.18)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: 10, color: "#a78bfa",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >Reabrir upsell</button>
          <button
            onClick={() => setOpen(false)}
            style={{
              flex: 1, padding: "12px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, color: "#8394b0",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >Fechar</button>
        </div>
      </div>

      {open && (
        <VideoHookScreen
          photoUrl={MOCK_PHOTO}
          onAssinar={() => alert("CTA: Liberar PRO clicado (em prod chama Stripe)")}
          onCriar2aFoto={() => setOpen(false)}
        />
      )}
    </main>
  );
}
