"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useI18n } from "@/lib/i18n";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#07080b",
    padding: "40px 24px 80px",
    fontFamily: "inherit",
    color: "#eef2f9",
  },
  inner: {
    maxWidth: 520,
    margin: "0 auto",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: "#8394b0",
    fontSize: 15,
    cursor: "pointer",
    padding: "0 0 32px",
    fontFamily: "inherit",
    transition: "color 0.15s",
  },
  hero: {
    textAlign: "center",
    marginBottom: 40,
  },
  heroHeadline: {
    fontSize: "clamp(24px, 4vw, 36px)",
    fontWeight: 800,
    lineHeight: 1.18,
    letterSpacing: "-0.02em",
    margin: "0 auto 16px",
    maxWidth: 480,
    background: "linear-gradient(135deg, #eef2f9 30%, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    fontSize: 16,
    color: "#8394b0",
    margin: "0 auto 20px",
    maxWidth: 440,
    lineHeight: 1.6,
  },
  heroTrust: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(22,199,132,0.1)",
    border: "1px solid rgba(22,199,132,0.25)",
    borderRadius: 20,
    padding: "8px 16px",
    fontSize: 13,
    color: "#16c784",
    fontWeight: 600,
  },
  card: {
    background: "#111820",
    borderRadius: 22,
    padding: "36px 32px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    boxShadow: "0 0 0 2px #8b5cf6, 0 12px 40px rgba(139,92,246,0.25)",
    marginBottom: 48,
  },
  badge: {
    display: "inline-block",
    background: "rgba(168,85,247,0.15)",
    color: "#c084fc",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    padding: "5px 14px",
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: "center",
  },
  price: {
    fontSize: 56,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1,
    marginBottom: 4,
    letterSpacing: "-0.03em",
    textAlign: "center" as const,
  },
  pricePeriod: {
    fontSize: 22,
    fontWeight: 400,
    color: "#8394b0",
  },
  priceSub: {
    fontSize: 14,
    color: "#4e5c72",
    marginBottom: 28,
    textAlign: "center" as const,
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.07)",
    margin: "0 0 24px",
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 32px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    flexGrow: 1,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    color: "#eef2f9",
  },
  featureCheck: {
    color: "#16c784",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  btnPrimary: {
    width: "100%",
    padding: "18px 0",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    color: "#fff",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    transition: "opacity 0.15s, transform 0.1s",
    marginBottom: 12,
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
  },
  btnNote: {
    fontSize: 13,
    color: "#8394b0",
    textAlign: "center" as const,
  },
  valueSection: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  valueCard: {
    background: "#0c1018",
    borderRadius: 18,
    padding: "22px 18px",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  valueIcon: {
    fontSize: 26,
    marginBottom: 10,
    display: "block",
  },
  valueTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#eef2f9",
    marginBottom: 6,
  },
  valueDesc: {
    fontSize: 13,
    color: "#8394b0",
    lineHeight: 1.55,
  },
};

const featuresPT = [
  "Fotos ilimitadas de produto com IA",
  "Vídeos animados para Reels e TikTok",
  "Vídeo narrado com locução e cenas",
  "Foto pronta na hora, sem fila",
  "Alta qualidade, sem marca d'água",
  "Cancele quando quiser",
];
const featuresEN = [
  "Unlimited AI product photos",
  "Animated videos for Reels & TikTok",
  "Narrated video with voiceover & scenes",
  "Photo ready instantly, no queue",
  "High quality, no watermark",
  "Cancel anytime",
];
const featuresES = [
  "Fotos de producto ilimitadas con IA",
  "Videos animados para Reels y TikTok",
  "Video narrado con locución y escenas",
  "Foto lista al instante, sin cola",
  "Alta calidad, sin marca de agua",
  "Cancela cuando quieras",
];

export default function PlanosPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMP, setLoadingMP] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [isBR, setIsBR] = useState(true);

  const features = lang === "es" ? featuresES : lang === "pt" ? featuresPT : featuresEN;

  useEffect(() => {
    const l = (typeof navigator !== "undefined" ? navigator.language : "pt-BR") || "pt-BR";
    setIsBR(l.startsWith("pt"));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else { setUser(data.user); setLoading(false); }
    });
  }, [router]);

  async function handleMP() {
    if (!user) return;
    setLoadingMP(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "monthly" }),
      });
      const json = await res.json();
      if (json.init_point) window.location.href = json.init_point;
      else alert("Erro ao iniciar pagamento. Tente novamente.");
    } catch { alert("Erro ao iniciar pagamento. Tente novamente."); }
    finally { setLoadingMP(false); }
  }

  async function handleStripe() {
    if (!user) return;
    setLoadingStripe(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else alert("Payment error. Please try again.");
    } catch { alert("Payment error. Please try again."); }
    finally { setLoadingStripe(false); }
  }

  if (loading) {
    return (
      <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#4e5c72", fontSize: 15 }}>
          {lang === "en" ? "Loading..." : lang === "es" ? "Cargando..." : "Carregando..."}
        </span>
      </div>
    );
  }

  const isLoading = isBR ? loadingMP : loadingStripe;

  return (
    <div style={styles.page} className="app-layout">
      <div style={styles.inner}>
        <button
          style={styles.backBtn}
          onClick={() => router.back()}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#eef2f9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#8394b0")}
        >
          {lang === "en" ? "← Back" : lang === "es" ? "← Volver" : "← Voltar"}
        </button>

        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.heroHeadline}>
            {lang === "en"
              ? "Professional product photos with AI"
              : lang === "es"
              ? "Fotos profesionales de productos con IA"
              : "Fotos profissionais dos seus produtos com IA"}
          </h1>
          <p style={styles.heroSub}>
            {lang === "en"
              ? "Take a photo with your phone, AI transforms it into a professional store photo. No photographer, no studio."
              : lang === "es"
              ? "Toma una foto con el celular, la IA la transforma en foto profesional de tienda. Sin fotógrafo, sin estudio."
              : "Tire foto com o celular, a IA transforma em foto de loja profissional. Sem fotógrafo, sem estúdio."}
          </p>
          <div style={styles.heroTrust}>
            <span>{lang === "en" ? "Cancel anytime" : lang === "es" ? "Cancela cuando quieras" : "Cancele quando quiser"}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>{lang === "en" ? "No commitment" : lang === "es" ? "Sin fidelidad" : "Sem fidelidade"}</span>
          </div>
        </div>

        {/* Plan Card */}
        <div style={styles.card}>
          <span style={styles.badge}>PRO</span>

          <div style={styles.price}>
            R$79<span style={styles.pricePeriod}> /mês</span>
          </div>
          <div style={styles.priceSub}>
            {lang === "en"
              ? "Less than R$2.63 per day — cancel anytime"
              : lang === "es"
              ? "Menos de R$2,63 por día — cancela cuando quieras"
              : "Menos de R$2,63 por dia — cancele quando quiser"}
          </div>

          <div style={styles.divider} />

          <ul style={styles.featureList}>
            {features.map((f) => (
              <li key={f} style={styles.featureItem}>
                <span style={styles.featureCheck}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            style={{ ...styles.btnPrimary, opacity: isLoading ? 0.7 : 1 }}
            onClick={isBR ? handleMP : handleStripe}
            disabled={isLoading}
            onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            {isLoading
              ? (lang === "en" ? "Loading..." : lang === "es" ? "Cargando..." : "Aguarde...")
              : lang === "en"
              ? "Subscribe — R$79/month"
              : lang === "es"
              ? "Suscribirse — R$79/mes"
              : "Assinar agora — R$79/mês"}
          </button>

          <div style={styles.btnNote}>
            {isBR
              ? "Pagamento seguro via MercadoPago • Cancele a qualquer momento"
              : "Secure payment via Stripe • Cancel anytime"}
          </div>
        </div>

        {/* Value Props */}
        <div style={styles.valueSection}>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>⚡</span>
            <div style={styles.valueTitle}>
              {lang === "en" ? "Instant photos" : lang === "es" ? "Fotos al instante" : "Foto pronta na hora"}
            </div>
            <div style={styles.valueDesc}>
              {lang === "en"
                ? "No queue. Generate as many as you want, anytime."
                : lang === "es"
                ? "Sin cola. Genera las que quieras, a cualquier hora."
                : "Sem fila. Gere quantas quiser, a qualquer hora."}
            </div>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>🎬</span>
            <div style={styles.valueTitle}>
              {lang === "en" ? "Photo & video AI" : lang === "es" ? "Foto y video IA" : "Foto e vídeo com IA"}
            </div>
            <div style={styles.valueDesc}>
              {lang === "en"
                ? "Animated videos and narrated reels for your products."
                : lang === "es"
                ? "Videos animados y reels narrados para tus productos."
                : "Vídeos animados e reels narrados dos seus produtos."}
            </div>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>☕</span>
            <div style={styles.valueTitle}>
              {lang === "en" ? "Less than a coffee" : lang === "es" ? "Menos que un café" : "Menos que um café"}
            </div>
            <div style={styles.valueDesc}>
              {lang === "en"
                ? "R$2.63 per day to transform your business visuals."
                : lang === "es"
                ? "R$2,63 por día para transformar tu negocio."
                : "R$2,63 por dia para transformar as fotos do seu negócio."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
