"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { trackEvent } from "@/lib/meta/pixel";

export default function ObrigadoPage() {
  const router = useRouter();
  const { lang } = useI18n();

  useEffect(() => {
    trackEvent("Purchase");
    const t = setTimeout(() => router.replace("/"), 4000);
    return () => clearTimeout(t);
  }, [router]);

  const copy = lang === "en"
    ? { title: "Subscription confirmed!", body: "Your Pro plan is active. Start generating unlimited photos and videos now.", redirect: "Redirecting shortly..." }
    : lang === "es"
    ? { title: "¡Suscripción confirmada!", body: "Tu plan Pro está activo. Empieza a generar fotos y videos ilimitados ahora.", redirect: "Redirigiendo en unos instantes..." }
    : { title: "Assinatura confirmada!", body: "Seu plano Pro está ativo. Pode começar a gerar fotos e vídeos ilimitados agora.", redirect: "Redirecionando em instantes..." };

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
        {copy.title}
      </h1>
      <p style={{ fontSize: 16, color: "#8394b0", marginBottom: 32, maxWidth: 400 }}>
        {copy.body}
      </p>
      <p style={{ fontSize: 13, color: "#4e5c72" }}>
        {copy.redirect}
      </p>
    </div>
  );
}
