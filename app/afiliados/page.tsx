"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";

type DashboardData = {
  affiliate: {
    id: string;
    code: string;
    display_name: string | null;
    commission_rate: number;
    link: string;
    stripe_account_id: string | null;
    stripe_account_status: "not_connected" | "pending" | "active" | "restricted";
    stripe_onboarding_complete: boolean;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
  };
  metrics: {
    clicks: number;
    unique_visitors: number;
    signups: number;
    paid_users: number;
    active_subscribers: number;
    total_commission_cents: number;
    pending_commission_cents: number;
    transferred_commission_cents: number;
    paid_commission_cents: number;
  };
  referrals: Array<{
    id: string;
    referred_email: string | null;
    status: "clicked" | "signed_up" | "checkout_started" | "active" | "canceled";
    signed_up_at: string | null;
    converted_at: string | null;
    last_paid_at: string | null;
    next_billing_at: string | null;
    total_paid_cents: number;
    total_commission_cents: number;
    stripe_subscription_id: string | null;
    latest_invoice_id: string | null;
    created_at: string;
  }>;
  commissions: Array<{
    id: string;
    stripe_invoice_id: string;
    gross_amount_cents: number;
    commission_amount_cents: number;
    currency: string;
    status: "pending" | "transferred" | "paid" | "canceled" | "failed";
    earned_at: string;
    available_at: string | null;
    transferred_at: string | null;
    paid_at: string | null;
    payout_estimated_at: string | null;
    created_at: string;
  }>;
};

const statusLabel: Record<string, string> = {
  not_connected: "NÃ£o conectado",
  restricted: "RevisÃ£o necessÃ¡ria",
  clicked: "Entrou pelo link",
  signed_up: "Criou conta",
  checkout_started: "Iniciou checkout",
  active: "Assinante ativo",
  canceled: "Cancelado",
  pending: "Pendente",
  transferred: "Transferida ao Stripe",
  paid: "Paga",
  failed: "Falhou",
};

export default function AfiliadosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [copyDone, setCopyDone] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState("");

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? "";
      if (!accessToken) {
        router.push("/login");
        return;
      }

      if (!active) return;
      setToken(accessToken);

      const connected = searchParams.get("connected");
      const refreshConnect = searchParams.get("refresh_connect");
      if (connected === "1") {
        setBanner("Conta Stripe conectada. Agora suas comissões podem ser transferidas automaticamente.");
      } else if (refreshConnect === "1") {
        setBanner("Continue o onboarding do Stripe para liberar recebimentos automáticos.");
      }

      await loadDashboard(accessToken, active);
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  async function loadDashboard(accessToken: string, active = true) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/affiliates/dashboard", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }).catch(() => null);

    if (!res) {
      if (!active) return;
      setError("NÃ£o foi possÃ­vel carregar o painel de afiliados.");
      setLoading(false);
      return;
    }

    const json = await res.json().catch(() => ({}));
    if (!active) return;

    if (!res.ok) {
      setError(json.error ?? "Erro ao carregar afiliados.");
      setLoading(false);
      return;
    }

    setDashboard(json as DashboardData);
    setLoading(false);
  }

  async function handleCopyLink() {
    if (!dashboard?.affiliate.link) return;
    try {
      await navigator.clipboard.writeText(dashboard.affiliate.link);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2200);
    } catch {
      setError("NÃ£o consegui copiar o link automaticamente.");
    }
  }

  async function handleConnectStripe() {
    if (!token) return;
    setConnecting(true);
    setError("");

    try {
      const res = await fetch("/api/affiliates/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Erro ao abrir onboarding do Stripe.");
      }

      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar Stripe.");
      setConnecting(false);
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
    return new Date(value).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatMoney(cents: number, currency = "brl") {
    const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format((cents ?? 0) / 100);
  }

  function getStripeStatusText() {
    if (!dashboard) return "";
    const affiliate = dashboard.affiliate;
    if (!affiliate.stripe_account_id) return "Conecte seu Stripe para receber comissÃµes automÃ¡ticas.";
    if (affiliate.stripe_account_status === "active" && affiliate.stripe_payouts_enabled) {
      return "Stripe conectado e pronto para repasses automÃ¡ticos.";
    }
    if (affiliate.stripe_account_status === "pending") {
      return "Stripe conectado, mas ainda faltam etapas do onboarding para liberar recebimentos.";
    }
    return "Sua conta Stripe precisa de revisÃ£o antes de receber automaticamente.";
  }

  if (loading) {
    return <div style={styles.centered}>Carregando afiliados...</div>;
  }

  return (
    <div style={styles.page} className="app-layout">
      <style>{`
        @media (min-width: 900px) {
          .affiliate-header-logo { display: none !important; }
          .affiliate-main { max-width: 100% !important; padding: 40px 60px 120px !important; }
          .affiliate-grid { display: grid !important; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr) !important; gap: 28px !important; align-items: start !important; }
          .affiliate-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        }
      `}</style>

      <header style={styles.header} className="app-header">
        <button onClick={() => router.push("/")} style={styles.backBtn}>← Voltar</button>
        <div style={styles.logo} className="affiliate-header-logo">
          TamoWork <span style={{ fontSize: 13, fontWeight: 400 }}>Afiliados</span>
        </div>
        <div style={{ width: 60 }} />
      </header>

      <main style={styles.main} className="app-main affiliate-main">
        <section style={styles.heroCard}>
          <div>
            <div style={styles.eyebrow}>Programa de afiliados</div>
            <h1 style={styles.heroTitle}>Ganhe 30% em toda renovaÃ§Ã£o dos clientes que assinarem pelo seu link.</h1>
            <p style={styles.heroText}>
              Acompanhamento completo de cliques, cadastros, pagantes e comissÃµes recorrentes em um sÃ³ painel.
            </p>
          </div>
          <div style={styles.heroBadges}>
            <span style={styles.badge}>ComissÃ£o recorrente</span>
            <span style={styles.badge}>Stripe automÃ¡tico</span>
            <span style={styles.badge}>Link individual</span>
          </div>
        </section>

        {banner ? <div style={styles.bannerSuccess}>{banner}</div> : null}
        {error ? <div style={styles.bannerError}>{error}</div> : null}

        {dashboard ? (
          <>
            <div className="affiliate-grid" style={styles.grid}>
              <div style={styles.column}>
                <section style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <div style={styles.sectionEyebrow}>Seu link</div>
                      <h2 style={styles.sectionTitle}>Compartilhe e acompanhe suas indicaÃ§Ãµes</h2>
                    </div>
                    <div style={styles.rateChip}>{Math.round(dashboard.affiliate.commission_rate * 100)}%</div>
                  </div>

                  <div style={styles.linkBox}>
                    <div style={styles.linkLabel}>Link de afiliado</div>
                    <div style={styles.linkValue}>{dashboard.affiliate.link}</div>
                  </div>

                  <div style={styles.actionRow}>
                    <button onClick={handleCopyLink} style={styles.primaryBtn}>
                      {copyDone ? "Link copiado" : "Copiar link"}
                    </button>
                    <button onClick={() => loadDashboard(token)} style={styles.secondaryBtn}>
                      Atualizar painel
                    </button>
                  </div>
                </section>

                <section style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <div style={styles.sectionEyebrow}>Resultados</div>
                      <h2 style={styles.sectionTitle}>Funil do seu link</h2>
                    </div>
                  </div>

                  <div className="affiliate-metrics" style={styles.metricGrid}>
                    <MetricCard label="Cliques" value={String(dashboard.metrics.clicks)} />
                    <MetricCard label="Visitantes" value={String(dashboard.metrics.unique_visitors)} />
                    <MetricCard label="Cadastros" value={String(dashboard.metrics.signups)} />
                    <MetricCard label="Pagantes" value={String(dashboard.metrics.paid_users)} />
                  </div>

                  <div className="affiliate-metrics" style={{ ...styles.metricGrid, marginTop: 14 }}>
                    <MetricCard label="Ativos" value={String(dashboard.metrics.active_subscribers)} />
                    <MetricCard label="Pendente" value={formatMoney(dashboard.metrics.pending_commission_cents)} />
                    <MetricCard label="Transferido" value={formatMoney(dashboard.metrics.transferred_commission_cents)} />
                    <MetricCard label="Total" value={formatMoney(dashboard.metrics.total_commission_cents)} />
                  </div>
                </section>

                <section style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <div style={styles.sectionEyebrow}>Quem entrou e pagou</div>
                      <h2 style={styles.sectionTitle}>IndicaÃ§Ãµes</h2>
                    </div>
                  </div>

                  {dashboard.referrals.length === 0 ? (
                    <div style={styles.emptyState}>Ainda nÃ£o existe nenhuma indicaÃ§Ã£o registrada no seu link.</div>
                  ) : (
                    <div style={styles.stack}>
                      {dashboard.referrals.map((item) => (
                        <div key={item.id} style={styles.listCard}>
                          <div style={styles.listTop}>
                            <div>
                              <div style={styles.listTitle}>{item.referred_email ?? "UsuÃ¡rio sem e-mail visÃ­vel"}</div>
                              <div style={styles.listMeta}>{statusLabel[item.status] ?? item.status}</div>
                            </div>
                            <StatusPill status={item.status} />
                          </div>
                          <div style={styles.infoGrid}>
                            <InfoItem label="Entrou/Cadastrou" value={formatDate(item.signed_up_at ?? item.created_at)} />
                            <InfoItem label="Primeiro pagamento" value={formatDate(item.converted_at)} />
                            <InfoItem label="Ãšltimo pagamento" value={formatDate(item.last_paid_at)} />
                            <InfoItem label="PrÃ³xima cobranÃ§a" value={formatDate(item.next_billing_at)} />
                            <InfoItem label="Total pago" value={formatMoney(item.total_paid_cents)} />
                            <InfoItem label="Sua comissÃ£o" value={formatMoney(item.total_commission_cents)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div style={styles.column}>
                <section style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <div style={styles.sectionEyebrow}>Recebimento</div>
                      <h2 style={styles.sectionTitle}>Stripe Connect</h2>
                    </div>
                  </div>

                  <div style={styles.stripeCard}>
                    <div style={styles.stripeStatusRow}>
                      <div>
                        <div style={styles.stripeStatusTitle}>{getStripeStatusText()}</div>
                        <div style={styles.stripeStatusMeta}>
                          Status atual: {statusLabel[dashboard.affiliate.stripe_account_status] ?? dashboard.affiliate.stripe_account_status}
                        </div>
                      </div>
                      <StatusPill status={dashboard.affiliate.stripe_account_status} />
                    </div>

                    <div style={styles.infoGrid}>
                      <InfoItem label="Conta Stripe" value={dashboard.affiliate.stripe_account_id ?? "Ainda nÃ£o conectada"} />
                      <InfoItem label="Onboarding" value={dashboard.affiliate.stripe_onboarding_complete ? "Completo" : "Pendente"} />
                      <InfoItem label="Recebimentos" value={dashboard.affiliate.stripe_payouts_enabled ? "Liberados" : "Bloqueados"} />
                      <InfoItem label="ComissÃ£o" value={`${Math.round(dashboard.affiliate.commission_rate * 100)}% em cada renovaÃ§Ã£o`} />
                    </div>

                    <button onClick={handleConnectStripe} disabled={connecting} style={styles.primaryBtn}>
                      {connecting ? "Abrindo Stripe..." : dashboard.affiliate.stripe_account_id ? "Revisar onboarding Stripe" : "Conectar Stripe"}
                    </button>
                  </div>
                </section>

                <section style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <div style={styles.sectionEyebrow}>ComissÃµes</div>
                      <h2 style={styles.sectionTitle}>HistÃ³rico de repasses</h2>
                    </div>
                  </div>

                  {dashboard.commissions.length === 0 ? (
                    <div style={styles.emptyState}>As comissÃµes vÃ£o aparecer aqui sempre que uma assinatura pagar ou renovar.</div>
                  ) : (
                    <div style={styles.stack}>
                      {dashboard.commissions.map((item) => (
                        <div key={item.id} style={styles.listCard}>
                          <div style={styles.listTop}>
                            <div>
                              <div style={styles.listTitle}>{formatMoney(item.commission_amount_cents, item.currency)}</div>
                              <div style={styles.listMeta}>Invoice {item.stripe_invoice_id.slice(0, 18)}...</div>
                            </div>
                            <StatusPill status={item.status} />
                          </div>

                          <div style={styles.infoGrid}>
                            <InfoItem label="Cliente pagou" value={formatDate(item.earned_at)} />
                            <InfoItem label="Valor pago" value={formatMoney(item.gross_amount_cents, item.currency)} />
                            <InfoItem label="Sua comissÃ£o" value={formatMoney(item.commission_amount_cents, item.currency)} />
                            <InfoItem label="Libera em" value={formatDate(item.available_at)} />
                            <InfoItem label="Transferida em" value={formatDate(item.transferred_at)} />
                            <InfoItem label="Paga em" value={formatDate(item.paid_at)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === "active" || status === "paid"
      ? styles.statusGood
      : status === "pending" || status === "checkout_started" || status === "signed_up"
        ? styles.statusWarn
        : status === "transferred"
          ? styles.statusInfo
          : styles.statusMuted;

  return <span style={style}>{statusLabel[status] ?? status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07080b", paddingBottom: 68 },
  centered: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#8394b0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#0c1018",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "#8394b0",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  main: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "28px 20px 110px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  heroCard: {
    background: "linear-gradient(135deg, rgba(17,24,32,0.96), rgba(18,10,34,0.96))",
    border: "1px solid rgba(168,85,247,0.18)",
    borderRadius: 22,
    padding: "24px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    color: "#c4b5fd",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  heroTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
    color: "#eef2f9",
    letterSpacing: "-0.03em",
  },
  heroText: {
    margin: "12px 0 0",
    color: "#93a0b4",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 720,
  },
  heroBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#d6def0",
    fontSize: 12,
    fontWeight: 700,
  },
  bannerSuccess: {
    background: "rgba(22,199,132,0.1)",
    border: "1px solid rgba(22,199,132,0.25)",
    color: "#34d399",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 14,
    lineHeight: 1.5,
  },
  bannerError: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#f87171",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 14,
    lineHeight: 1.5,
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  sectionCard: {
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 20,
    padding: "20px 18px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 16,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    color: "#8394b0",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 21,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1.15,
  },
  rateChip: {
    flexShrink: 0,
    padding: "9px 12px",
    borderRadius: 12,
    background: "rgba(168,85,247,0.14)",
    border: "1px solid rgba(168,85,247,0.28)",
    color: "#c4b5fd",
    fontSize: 16,
    fontWeight: 800,
  },
  linkBox: {
    background: "#0c1018",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "14px 16px",
  },
  linkLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#4e5c72",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  linkValue: {
    color: "#eef2f9",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-all",
  },
  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  primaryBtn: {
    border: "none",
    borderRadius: 14,
    padding: "13px 18px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "13px 18px",
    background: "transparent",
    color: "#cdd7e9",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  metricCard: {
    background: "#0c1018",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "16px 14px",
  },
  metricLabel: {
    fontSize: 12,
    color: "#8394b0",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#eef2f9",
    lineHeight: 1,
  },
  emptyState: {
    color: "#8394b0",
    fontSize: 14,
    lineHeight: 1.6,
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  listCard: {
    background: "#0c1018",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "15px 14px",
  },
  listTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  listTitle: {
    color: "#eef2f9",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  listMeta: {
    color: "#8394b0",
    fontSize: 12,
    marginTop: 4,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  infoItem: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: "10px 11px",
  },
  infoLabel: {
    color: "#4e5c72",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 5,
  },
  infoValue: {
    color: "#eef2f9",
    fontSize: 13,
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  stripeCard: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  stripeStatusRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  stripeStatusTitle: {
    color: "#eef2f9",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  stripeStatusMeta: {
    color: "#8394b0",
    fontSize: 12,
    marginTop: 4,
  },
  statusGood: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(22,199,132,0.12)",
    border: "1px solid rgba(22,199,132,0.24)",
    color: "#34d399",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  statusWarn: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.24)",
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  statusInfo: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.24)",
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  statusMuted: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};
