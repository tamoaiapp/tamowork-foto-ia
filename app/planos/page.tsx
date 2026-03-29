"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

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
    marginBottom: 52,
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
    margin: "0 auto",
    maxWidth: 520,
    lineHeight: 1.6,
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
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    padding: "4px 10px",
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
    fontSize: 13,
    fontWeight: 600,
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
    padding: "15px 0",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    transition: "opacity 0.15s, transform 0.1s",
    marginBottom: 10,
  },
  btnSecondary: {
    width: "100%",
    padding: "15px 0",
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
    marginBottom: 10,
  },
  btnNote: {
    fontSize: 12,
    color: "#4e5c72",
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

const annualFeatures = [
  "Fotos ilimitadas com IA",
  "Vídeos ilimitados com IA",
  "Sem fila de espera",
  "Resultados em alta resolução",
  "Acesso a novos recursos primeiro",
];

const monthlyFeatures = [
  "Fotos ilimitadas com IA",
  "Vídeos ilimitados com IA",
  "Sem fila de espera",
  "Resultados em alta resolução",
];

export default function PlanosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMP, setLoadingMP] = useState(false);

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
        <span style={{ color: "#4e5c72", fontSize: 15 }}>Carregando...</span>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <button
          style={styles.backBtn}
          onClick={() => router.back()}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#eef2f9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#8394b0")}
        >
          ← Voltar
        </button>

        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.heroHeadline}>
            Fotos e vídeos ilimitados por menos de R$0,61 por dia
          </h1>
          <p style={styles.heroSub}>
            Transforme qualquer produto em foto profissional com IA. Sem limite de uso, sem fila de espera.
          </p>
        </div>

        {/* Pricing Cards */}
        <div style={styles.cardsRow}>
          {/* Annual Card */}
          <div style={styles.cardAnnual}>
            <span style={styles.badge}>MAIS POPULAR</span>
            <div style={styles.planLabel}>Plano Anual</div>
            <div style={styles.price}>
              R$19<span style={styles.pricePeriod}> /mês</span>
            </div>
            <div style={styles.priceBilled}>Cobrado R$228 por ano</div>
            <div style={styles.priceHighlight}>Menos de R$0,61 por dia</div>
            <div style={styles.divider} />
            <ul style={styles.featureList}>
              {annualFeatures.map((f) => (
                <li key={f} style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              style={{ ...styles.btnPrimary, opacity: loadingMP ? 0.7 : 1 }}
              onClick={handleMercadoPago}
              disabled={loadingMP}
              onMouseEnter={(e) => { if (!loadingMP) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
              onMouseLeave={(e) => { if (!loadingMP) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              {loadingMP ? "Aguarde..." : "Assinar por R$228/ano"}
            </button>
            <div style={styles.btnNote}>Economize R$360 comparado ao mensal</div>
          </div>

          {/* Monthly Card */}
          <div style={styles.cardMonthly}>
            <div style={{ height: 28, marginBottom: 16 }} /> {/* spacer to align with badge */}
            <div style={styles.planLabel}>Plano Mensal</div>
            <div style={styles.price}>
              R$49<span style={styles.pricePeriod}> /mês</span>
            </div>
            <div style={styles.priceBilled}>
              <span style={styles.strikethrough}>R$588/ano</span>
              {" "}→ anual sai R$360 mais barato
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
              style={styles.btnSecondary}
              onClick={() => alert("Em breve! Stripe chegando em breve.")}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.08)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#8b5cf6";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(139,92,246,0.4)";
              }}
            >
              Assinar por R$49/mês
            </button>
            <div style={styles.btnNote}>&nbsp;</div>
          </div>
        </div>

        {/* Value Props */}
        <div style={styles.valueSection}>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>⚡</span>
            <div style={styles.valueTitle}>Sem fila de espera</div>
            <div style={styles.valueDesc}>
              Suas fotos são priorizadas. Gere quantas quiser, quando quiser.
            </div>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>🎬</span>
            <div style={styles.valueTitle}>Fotos E vídeos</div>
            <div style={styles.valueDesc}>
              Crie vídeos animados dos seus produtos. Recurso exclusivo para assinantes.
            </div>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueIcon}>💰</span>
            <div style={styles.valueTitle}>Menos de R$0,61/dia</div>
            <div style={styles.valueDesc}>
              Por menos que um café, você automatiza toda a criação visual do seu negócio.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
