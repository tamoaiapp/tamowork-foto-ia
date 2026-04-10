"use client";

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
    maxWidth: 860,
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
    marginBottom: 48,
  },
  heroHeadline: {
    fontSize: "clamp(26px, 4vw, 42px)",
    fontWeight: 800,
    lineHeight: 1.18,
    letterSpacing: "-0.02em",
    margin: "0 auto 16px",
    maxWidth: 640,
    background: "linear-gradient(135deg, #eef2f9 30%, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    fontSize: 17,
    color: "#8394b0",
    margin: "0 auto 16px",
    maxWidth: 520,
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
  cardsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 56,
  },
  cardAnnual: {
    background: "#111820",
    borderRadius: 22,
    padding: "32px 28px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    boxShadow: "0 0 0 2px #8b5cf6, 0 8px 32px rgba(139,92,246,0.2)",
    position: "relative",
  },
  cardMonthly: {
    background: "#111820",
    borderRadius: 22,
    padding: "32px 28px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    border: "1px solid rgba(255,255,255,0.07)",
  },
  badge: {
    display: "inline-block",
    background: "rgba(22,199,132,0.15)",
    color: "#16c784",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    padding: "5px 12px",
    borderRadius: 20,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  planLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#8394b0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  price: {
    fontSize: 44,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1,
    marginBottom: 4,
    letterSpacing: "-0.03em",
  },
  pricePeriod: {
    fontSize: 18,
    fontWeight: 400,
    color: "#8394b0",
  },
  priceBilled: {
    fontSize: 13,
    color: "#4e5c72",
    marginBottom: 6,
  },
  priceHighlight: {
    fontSize: 16,
    fontWeight: 800,
    color: "#a855f7",
    marginBottom: 24,
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.07)",
    margin: "0 0 20px",
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 28px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
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
    fontSize: 15,
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
    marginBottom: 8,
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
  },
  btnSecondary: {
    width: "100%",
    padding: "16px 0",
    borderRadius: 14,
    border: "1.5px solid rgba(139,92,246,0.4)",
    background: "transparent",
    color: "#a855f7",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    transition: "border-color 0.15s, background 0.15s",
    marginBottom: 8,
  },
  btnNote: {
    fontSize: 13,
    color: "#8394b0",
    textAlign: "center" as const,
  },
  strikethrough: {
    textDecoration: "line-through",
    color: "#4e5c72",
  },
  savingsNote: {
    fontSize: 13,
    color: "#8394b0",
    marginBottom: 24,
  },
  valueSection: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 0,
  },
  valueCard: {
    background: "#0c1018",
    borderRadius: 18,
    padding: "24px 20px",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  valueIcon: {
    fontSize: 28,
    marginBottom: 12,
    display: "block",
  },
  valueTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#eef2f9",
    marginBottom: 8,
  },
  valueDesc: {
    fontSize: 14,
    color: "#8394b0",
    lineHeight: 1.55,
  },
};

const annualFeaturesPT = [
  "Fotos ilimitadas — sem limite",
  "Vídeos ilimitados para Reels e TikTok",
  "Foto pronta na hora, sem fila",
  "Alta qualidade, sem marca d'água",
  "Novidades antes de todo mundo",
];
const annualFeaturesEN = [
  "Unlimited photos — no cap",
  "Unlimited videos for Reels & TikTok",
  "Photo ready instantly, no queue",
  "High quality, no watermark",
  "Early access to new features",
];
const annualFeaturesES = [
  "Fotos ilimitadas — sin límite",
  "Videos ilimitados para Reels y TikTok",
  "Foto lista al instante, sin cola",
  "Alta calidad, sin marca de agua",
  "Novedades antes que nadie",
];

const monthlyFeaturesPT = [
  "Fotos ilimitadas — sem limite",
  "Vídeos ilimitados para Reels e TikTok",
  "Foto pronta na hora, sem fila",
  "Alta qualidade, sem marca d'água",
];
const monthlyFeaturesEN = [
  "Unlimited photos — no cap",
  "Unlimited videos for Reels & TikTok",
  "Photo ready instantly, no queue",
  "High quality, no watermark",
];
const monthlyFeaturesES = [
  "Fotos ilimitadas — sin límite",
  "Videos ilimitados para Reels y TikTok",
  "Foto lista al instante, sin cola",
  "Alta calidad, sin marca de agua",
];

export default function PlanosPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMP, setLoadingMP] = useState(false);
  const [loadingMPMonthly, setLoadingMPMonthly] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [isBR, setIsBR] = useState(true);

  const annualFeatures = lang === "es" ? annualFeaturesES : lang === "pt" ? annualFeaturesPT : annualFeaturesEN;
  const monthlyFeatures = lang === "es" ? monthlyFeaturesES : lang === "pt" ? monthlyFeaturesPT : monthlyFeaturesEN;

  useEffect(() => {
    const lang = (typeof navigator !== "undefined" ? navigator.language : "pt-BR") || "pt-BR";
    setIsBR(lang.startsWith("pt"));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        setUser(data.user);
        setLoading(false);
      }
    });
  }, [router]);

  async function handleMPMonthly() {
    if (!user) return;
    setLoadingMPMonthly(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "monthly" }),
      });
      const json = await res.json();
      if (json.init_point) {
        window.location.href = json.init_point;
      } else {
        alert("Erro ao iniciar pagamento. Tente novamente.");
      }
    } catch {
      alert("Erro ao iniciar pagamento. Tente novamente.");
    } finally {
      setLoadingMPMonthly(false);
    }
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
      if (json.url) {
        window.location.href = json.url;
      } else {
        alert("Payment error. Please try again.");
      }
    } catch {
      alert("Payment error. Please try again.");
    } finally {
      setLoadingStripe(false);
    }
  }

  async function handleMercadoPago() {
    if (!user) return;
    setLoadingMP(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.init_point) {
        window.location.href = json.init_point;
      } else {
        alert("Erro ao iniciar pagamento. Tente novamente.");
      }
    } catch {
      alert("Erro ao iniciar pagamento. Tente novamente.");
    } finally {
      setLoadingMP(false);
    }
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
              ? "Professional product photos for less than $0.28 a day"
              : lang === "es"
              ? "Fotos profesionales de productos por menos de $0.28 al día"
              : "Fotos profissionais para seus produtos por menos de R$0,63 por dia"}
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

        {/* Pricing Cards */}
        <div style={styles.cardsRow}>
          {/* Annual Card */}
          <div style={styles.cardAnnual}>
            <span style={styles.badge}>{isBR ? "MAIS POPULAR" : "MOST POPULAR"}</span>
            <div style={styles.planLabel}>{isBR ? "Plano Anual" : "Annual Plan"}</div>
            {isBR ? (
              <>
                <div style={styles.price}>R$19<span style={styles.pricePeriod}> /mês</span></div>
                <div style={styles.priceBilled}>Cobrado R$228 por ano</div>
                <div style={styles.priceHighlight}>Menos de R$0,61 por dia</div>
              </>
            ) : (
              <>
                <div style={styles.price}>$100<span style={styles.pricePeriod}> /year</span></div>
                <div style={styles.priceBilled}>Billed $100 once a year</div>
                <div style={styles.priceHighlight}>Less than $0.28 per day</div>
              </>
            )}
            <div style={styles.divider} />
            <ul style={styles.featureList}>
              {annualFeatures.map((f) => (
                <li key={f} style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {isBR ? (
              <button
                style={{ ...styles.btnPrimary, opacity: loadingMP ? 0.7 : 1 }}
                onClick={handleMercadoPago}
                disabled={loadingMP}
                onMouseEnter={(e) => { if (!loadingMP) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
                onMouseLeave={(e) => { if (!loadingMP) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                {loadingMP ? "Aguarde..." : "Quero assinar agora — R$228/ano"}
              </button>
            ) : (
              <button
                style={{ ...styles.btnPrimary, opacity: loadingStripe ? 0.7 : 1 }}
                onClick={handleStripe}
                disabled={loadingStripe}
                onMouseEnter={(e) => { if (!loadingStripe) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
                onMouseLeave={(e) => { if (!loadingStripe) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                {loadingStripe ? "Loading..." : "Subscribe now — $100/year"}
              </button>
            )}
            <div style={{ ...styles.btnNote, fontWeight: 700, color: "#16c784" }}>
              {isBR ? "Economize R$360 comparado ao plano mensal" : "Save vs monthly billing"}
            </div>
          </div>

          {/* Monthly Card — BR only */}
          <div style={{ ...styles.cardMonthly, ...(isBR ? {} : { opacity: 0.45, pointerEvents: "none" }) }}>
            <div style={{ height: 28, marginBottom: 16 }} />
            <div style={styles.planLabel}>{isBR ? "Plano Mensal" : "Monthly Plan"}</div>
            <div style={styles.price}>
              R$49<span style={styles.pricePeriod}> /mês</span>
            </div>
            <div style={styles.priceBilled}>
              <span style={styles.strikethrough}>R$588/ano</span>
              {" "}→ {lang === "en" ? "annual saves R$360" : lang === "es" ? "el anual ahorra R$360" : "anual sai R$360 mais barato"}
            </div>
            <div style={{ marginBottom: 24 }} />
            <div style={styles.divider} />
            <ul style={styles.featureList}>
              {monthlyFeatures.map((f) => (
                <li key={f} style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              style={{ ...styles.btnSecondary, opacity: loadingMPMonthly ? 0.7 : 1 }}
              onClick={handleMPMonthly}
              disabled={loadingMPMonthly}
              onMouseEnter={(e) => {
                if (!loadingMPMonthly) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.08)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#8b5cf6";
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingMPMonthly) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(139,92,246,0.4)";
                }
              }}
            >
              {loadingMPMonthly ? "Aguarde..." : "Assinar por R$49/mês"}
            </button>
            <div style={styles.btnNote}>
              {isBR ? "\u00a0" : "Brazil only (MercadoPago)"}
            </div>
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
                ? "No queue. Generate as many photos as you want, any time of day."
                : lang === "es"
                ? "Sin cola. Genera las fotos que quieras, a cualquier hora del día."
                : "Sem esperar na fila. Gere quantas fotos quiser, a qualquer hora do dia."}
            </div>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>🎬</span>
            <div style={styles.valueTitle}>
              {lang === "en" ? "Photo & video with AI" : lang === "es" ? "Foto y video con IA" : "Foto e vídeo com IA"}
            </div>
            <div style={styles.valueDesc}>
              {lang === "en"
                ? "Create animated videos of your products to post on Reels and TikTok."
                : lang === "es"
                ? "Crea videos animados de tus productos para publicar en Reels y TikTok."
                : "Crie vídeos animados dos seus produtos para postar no Reels e TikTok."}
            </div>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>☕</span>
            <div style={styles.valueTitle}>
              {lang === "en" ? "Less than a coffee" : lang === "es" ? "Menos que un café" : "Menos que um café"}
            </div>
            <div style={styles.valueDesc}>
              {lang === "en"
                ? "$0.28 per day. Less than a coffee to transform your business."
                : lang === "es"
                ? "$0.28 por día. Menos que un café para transformar tu negocio."
                : "R$0,63 por dia. Menos do que um cafezinho para transformar seu negócio."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
