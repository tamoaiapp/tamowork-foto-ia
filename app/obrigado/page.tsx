"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ObrigadoPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace("/"), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07080b",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "inherit",
      color: "#eef2f9",
      textAlign: "center",
      padding: "24px",
    }}>
      <div style={{ fontSize: 56, marginBottom: 24 }}>🎉</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        Assinatura confirmada!
      </h1>
      <p style={{ fontSize: 16, color: "#8394b0", marginBottom: 32, maxWidth: 400 }}>
        Seu plano Pro está ativo. Pode começar a gerar fotos e vídeos ilimitados agora.
      </p>
      <p style={{ fontSize: 13, color: "#4e5c72" }}>
        Redirecionando em instantes...
      </p>
    </div>
  );
}
