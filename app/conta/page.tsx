"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import JobProgress from "./JobProgress";
import BottomNav from "@/app/components/BottomNav";
import { useI18n } from "@/lib/i18n";

const VAPID_PUBLIC_KEY = "BOFpGK6deSOtMczLOppZ8RXLb8XbAP0cs4hDHOZtJrDsnLhvzdPQXeojc5CohPhnj0PvNkPd7B7HKLtUva03cGk";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registerPush(token: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return true;
  } catch {
    return false;
  }
}

interface AccountJob {
  id: string;
  status: string;
  output_image_url?: string;
  input_image_url?: string;
  created_at: string;
  prompt?: string;
}

interface PlanData {
  plan: string;
  period_end?: string;
  stripe_subscription_id?: string;
  mp_subscription_id?: string;
  created_at?: string;
}

export default function ContaPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AccountJob[]>([]);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"unknown" | "granted" | "denied" | "dismissed">("unknown");

  // Change email
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? "");

      const { data: session } = await supabase.auth.getSession();
      const t = session.session?.access_token ?? "";
      setToken(t);
      const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs ?? []);
        setPlanData(data.plan);
      }
      setLoading(false);

      // Check notification permission
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          setNotifStatus("granted");
          registerPush(t); // auto-register silently if already granted
        } else if (Notification.permission === "denied") {
          setNotifStatus("denied");
        }
      } else {
        setNotifStatus("denied");
      }
    });
  }, [router]);

  async function handleEnableNotif() {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifStatus("granted");
      if (token) await registerPush(token);
    } else {
      setNotifStatus("denied");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleDelete(jobId: string) {
    setDeletingId(jobId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch(`/api/image-jobs/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCancelStripe() {
    const confirmMsg = lang === "en"
      ? "Cancel subscription? You'll keep access until the end of the paid period."
      : lang === "es"
      ? "¿Cancelar suscripción? Mantendrás el acceso hasta el fin del período pagado."
      : "Cancelar assinatura? Você continuará com acesso até o fim do período pago.";
    if (!confirm(confirmMsg)) return;
    setCanceling(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch("/api/account/subscription/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCancelDone(true);
      else alert(lang === "en" ? "Error canceling. Please try again or contact us." : lang === "es" ? "Error al cancelar. Inténtalo de nuevo o contáctanos." : "Erro ao cancelar. Tente novamente ou entre em contato.");
    } finally {
      setCanceling(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    setEmailMsg("");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) setEmailMsg((lang === "en" ? "Error: " : lang === "es" ? "Error: " : "Erro: ") + error.message);
    else {
      setEmailMsg(
        lang === "en" ? `Confirmation sent to ${newEmail}. Check your inbox.`
        : lang === "es" ? `Confirmación enviada a ${newEmail}. Revisa tu bandeja de entrada.`
        : `Confirmação enviada para ${newEmail}. Verifique sua caixa de entrada.`
      );
      setNewEmail("");
    }
    setEmailLoading(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setPassMsg(lang === "en" ? "Passwords don't match." : lang === "es" ? "Las contraseñas no coinciden." : "As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setPassMsg(lang === "en" ? "Password must be at least 6 characters." : lang === "es" ? "La contraseña debe tener al menos 6 caracteres." : "Senha deve ter ao menos 6 caracteres.");
      return;
    }
    setPassLoading(true);
    setPassMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPassMsg((lang === "en" ? "Error: " : lang === "es" ? "Error: " : "Erro: ") + error.message);
    else {
      setPassMsg(lang === "en" ? "Password changed successfully!" : lang === "es" ? "¡Contraseña cambiada con éxito!" : "Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPassLoading(false);
  }

  function formatDate(iso?: string) {
    if (!iso) return "";
    const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
    return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
  }

  function isPro() {
    if (!planData || planData.plan !== "pro") return false;
    if (planData.period_end && new Date(planData.period_end) < new Date()) return false;
    return true;
  }

  const isProActive = isPro();
  const isMonthly = isProActive && !!planData?.stripe_subscription_id;
  const isAnnual = isProActive && !!planData?.mp_subscription_id;
  const isTrial = isProActive && !planData?.stripe_subscription_id && !planData?.mp_subscription_id;

  function daysLeft(isoDate?: string) {
    if (!isoDate) return null;
    const diff = new Date(isoDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  if (loading) return <div style={styles.centered}>{lang === "en" ? "Loading..." : lang === "es" ? "Cargando..." : "Carregando..."}</div>;

  return (
    <div style={styles.page} className="app-layout">
      <style>{`
        @media (min-width: 900px) {
          .conta-header-logo { display: none !important; }
          .conta-main { max-width: 100% !important; padding: 40px 60px !important; }
          .conta-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 32px !important; align-items: start !important; }
          .conta-left { display: flex; flex-direction: column; gap: 24px; }
          .conta-right { display: flex; flex-direction: column; gap: 24px; }
        }
      `}</style>

      <header style={styles.header} className="app-header">
        <button onClick={() => router.push("/")} style={styles.backBtn}>{lang === "en" ? "← Back" : lang === "es" ? "← Volver" : "← Voltar"}</button>
        <div style={styles.logo} className="conta-header-logo">
          TamoWork <span style={{ fontSize: 13, fontWeight: 400 }}>Foto IA</span>
        </div>
        <div style={{ width: 60 }} />
      </header>

      <main style={styles.main} className="app-main conta-main">
        <div className="conta-grid">

          {/* Coluna esquerda: Perfil + Assinatura */}
          <div className="conta-left">

            {/* Perfil */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{lang === "en" ? "My profile" : lang === "es" ? "Mi perfil" : "Meu perfil"}</h2>
              <div style={styles.profileCard}>
                <div style={styles.avatar}>{email.charAt(0).toUpperCase()}</div>
                <div style={styles.profileInfo}>
                  <div style={styles.profileEmail}>{email}</div>
                  <div style={styles.profileSub}>
                    {isProActive ? <span style={styles.proBadge}>✦ Pro</span> : <span style={styles.freeBadge}>{lang === "en" ? "Free" : lang === "es" ? "Gratis" : "Gratuito"}</span>}
                  </div>
                </div>
                <button onClick={handleLogout} style={styles.logoutBtn}>{lang === "en" ? "Sign out" : lang === "es" ? "Salir" : "Sair"}</button>
              </div>
            </section>

            {/* Assinatura */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{lang === "en" ? "My subscription" : lang === "es" ? "Mi suscripción" : "Minha assinatura"}</h2>
              <div style={styles.subCard}>
                {!isProActive && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4e5c72", flexShrink: 0 }} />
                      <div style={{ ...styles.subStatus, marginBottom: 0 }}>
                        {lang === "en" ? "Free Plan" : lang === "es" ? "Plan Gratuito" : "Plano Gratuito"}
                      </div>
                    </div>
                    <div style={styles.subDesc}>
                      {lang === "en" ? "1 photo per day. No video access." : lang === "es" ? "1 foto por día. Sin acceso a videos." : "1 foto por dia. Sem acesso a vídeos."}
                    </div>
                    <div style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))",
                      border: "1px solid rgba(168,85,247,0.25)",
                      borderRadius: 14, padding: "16px", marginBottom: 14,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#eef2f9", marginBottom: 4 }}>
                        {lang === "en" ? "Unlimited photos for less than $0.28/day" : lang === "es" ? "Fotos ilimitadas por menos de $0.28/día" : "Fotos ilimitadas por R$0,63/dia"}
                      </div>
                      <div style={{ fontSize: 13, color: "#8394b0", lineHeight: 1.5 }}>
                        {lang === "en" ? "No usage limit, no queue, no photographer." : lang === "es" ? "Sin límite de uso, sin cola de espera, sin fotógrafo." : "Sem limite de uso, sem fila de espera, sem fotógrafo."}
                      </div>
                    </div>
                    <button onClick={() => router.push("/planos")} style={styles.upgradeBtn}>
                      {lang === "en" ? "Subscribe now" : lang === "es" ? "Suscribirse ahora" : "Quero assinar agora"}
                    </button>
                    <div style={{ fontSize: 12, color: "#4e5c72", textAlign: "center", marginTop: 8 }}>
                      {lang === "en" ? "Cancel anytime — no commitment" : lang === "es" ? "Cancela cuando quieras — sin fidelidad" : "Cancele quando quiser — sem fidelidade"}
                    </div>
                  </>
                )}
                {isTrial && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                      <div style={{ ...styles.subStatus, marginBottom: 0 }}><span style={styles.proBadge}>✦ Pro</span> {lang === "en" ? "Bonus — active" : lang === "es" ? "Bono — activo" : "Bônus — ativo"}</div>
                    </div>
                    <div style={styles.daysBox}>
                      <span style={styles.daysNum}>{daysLeft(planData?.period_end)}</span>
                      <span style={styles.daysSub}>{lang === "en" ? "days left" : lang === "es" ? "días restantes" : "dias restantes"}</span>
                    </div>
                    <div style={styles.subDesc}>
                      {lang === "en" ? `Valid until ${formatDate(planData?.period_end)}. After this date, you'll automatically return to the free plan.`
                      : lang === "es" ? `Válido hasta ${formatDate(planData?.period_end)}. Después de esta fecha, volverás al plan gratuito automáticamente.`
                      : `Válido até ${formatDate(planData?.period_end)}. Após esse prazo, você volta ao plano gratuito automaticamente.`}
                    </div>
                    <button onClick={() => router.push("/planos")} style={styles.upgradeBtn}>
                      {lang === "en" ? "Continue with Pro" : lang === "es" ? "Continuar con Pro" : "Continuar com Pro"}
                    </button>
                  </>
                )}
                {isMonthly && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#16c784", flexShrink: 0 }} />
                      <div style={{ ...styles.subStatus, marginBottom: 0 }}><span style={styles.proBadge}>✦ Pro</span> {lang === "en" ? "Monthly — active" : lang === "es" ? "Mensual — activo" : "Mensal — ativo"}</div>
                    </div>
                    <div style={styles.daysBox}>
                      <span style={styles.daysNum}>{daysLeft(planData?.period_end)}</span>
                      <span style={styles.daysSub}>{lang === "en" ? "days left" : lang === "es" ? "días restantes" : "dias restantes"}</span>
                    </div>
                    <div style={styles.subDesc}>{lang === "en" ? `Next renewal: ${formatDate(planData?.period_end)}` : lang === "es" ? `Próxima renovación: ${formatDate(planData?.period_end)}` : `Próxima renovação: ${formatDate(planData?.period_end)}`}</div>
                    {cancelDone ? (
                      <div style={styles.canceledMsg}>
                        {lang === "en" ? `Cancellation scheduled — access kept until ${formatDate(planData?.period_end)}`
                        : lang === "es" ? `Cancelación programada — acceso mantenido hasta ${formatDate(planData?.period_end)}`
                        : `Cancelamento agendado — acesso mantido até ${formatDate(planData?.period_end)}`}
                      </div>
                    ) : (
                      <button onClick={handleCancelStripe} disabled={canceling} style={styles.cancelBtn}>
                        {canceling
                          ? (lang === "en" ? "Canceling..." : lang === "es" ? "Cancelando..." : "Cancelando...")
                          : (lang === "en" ? "Cancel subscription" : lang === "es" ? "Cancelar suscripción" : "Cancelar assinatura")}
                      </button>
                    )}
                  </>
                )}
                {isAnnual && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#16c784", flexShrink: 0 }} />
                      <div style={{ ...styles.subStatus, marginBottom: 0 }}><span style={styles.proBadge}>✦ Pro</span> {lang === "en" ? "Annual — active" : lang === "es" ? "Anual — activo" : "Anual — ativo"}</div>
                    </div>
                    <div style={styles.daysBox}>
                      <span style={styles.daysNum}>{daysLeft(planData?.period_end)}</span>
                      <span style={styles.daysSub}>{lang === "en" ? "days left" : lang === "es" ? "días restantes" : "dias restantes"}</span>
                    </div>
                    <div style={styles.subDesc}>{lang === "en" ? `Valid until ${formatDate(planData?.period_end)}` : lang === "es" ? `Válido hasta ${formatDate(planData?.period_end)}` : `Válido até ${formatDate(planData?.period_end)}`}</div>
                  </>
                )}
              </div>
            </section>

          </div>

          {/* Coluna direita: Configurações */}
          <div className="conta-right">

            {/* Alterar email */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{lang === "en" ? "Change email" : lang === "es" ? "Cambiar correo" : "Mudar e-mail"}</h2>
              <div style={styles.subCard}>
                <div style={styles.currentLabel}>{lang === "en" ? "Current email: " : lang === "es" ? "Correo actual: " : "E-mail atual: "}<strong style={{ color: "#eef2f9" }}>{email}</strong></div>
                <form onSubmit={handleChangeEmail} style={styles.credForm}>
                  <input
                    type="email" placeholder={lang === "en" ? "New email" : lang === "es" ? "Nuevo correo" : "Novo e-mail"} value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)} required style={styles.input}
                  />
                  <button type="submit" disabled={emailLoading} style={styles.credBtn}>
                    {emailLoading ? (lang === "en" ? "Sending..." : lang === "es" ? "Enviando..." : "Enviando...") : (lang === "en" ? "Confirm" : lang === "es" ? "Confirmar" : "Confirmar")}
                  </button>
                </form>
                {emailMsg && (
                  <div style={emailMsg.startsWith("Erro") || emailMsg.startsWith("Error") ? styles.msgError : styles.msgSuccess}>{emailMsg}</div>
                )}
              </div>
            </section>

            {/* Alterar senha */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{lang === "en" ? "Change password" : lang === "es" ? "Cambiar contraseña" : "Mudar senha"}</h2>
              <div style={styles.subCard}>
                <form onSubmit={handleChangePassword} style={{ ...styles.credForm, flexDirection: "column" }}>
                  <input
                    type="password" placeholder={lang === "en" ? "New password" : lang === "es" ? "Nueva contraseña" : "Nova senha"} value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} required style={styles.input}
                  />
                  <input
                    type="password" placeholder={lang === "en" ? "Confirm new password" : lang === "es" ? "Confirmar nueva contraseña" : "Confirmar nova senha"} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} required
                    style={{ ...styles.input, marginTop: 10 }}
                  />
                  <button type="submit" disabled={passLoading} style={{ ...styles.credBtn, marginTop: 10 }}>
                    {passLoading ? (lang === "en" ? "Saving..." : lang === "es" ? "Guardando..." : "Salvando...") : (lang === "en" ? "Change password" : lang === "es" ? "Cambiar contraseña" : "Alterar senha")}
                  </button>
                </form>
                {passMsg && (
                  <div style={passMsg.startsWith("Erro") || passMsg.startsWith("Error") || passMsg.includes("não coincidem") || passMsg.includes("don't match") || passMsg.includes("no coinciden") || passMsg.includes("ao menos") || passMsg.includes("least") || passMsg.includes("menos") ? styles.msgError : styles.msgSuccess}>
                    {passMsg}
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07080b", paddingBottom: 68 },
  centered: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8394b0" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#0c1018", position: "sticky", top: 0, zIndex: 10,
  },
  backBtn: { background: "transparent", border: "none", color: "#8394b0", fontSize: 14, cursor: "pointer", padding: 0 },
  logo: {
    fontSize: 18, fontWeight: 700,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  main: { maxWidth: 600, margin: "0 auto", padding: "32px 24px" },
  section: {},
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#8394b0", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" } as React.CSSProperties,

  // Profile card
  profileCard: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 18, padding: "20px 20px",
    display: "flex", alignItems: "center", gap: 16,
  },
  avatar: {
    width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 700, color: "#fff",
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileEmail: { fontSize: 14, color: "#eef2f9", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  profileSub: { marginTop: 4 },
  proBadge: { background: "linear-gradient(135deg, #6366f1, #a855f7)", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#fff" },
  freeBadge: { background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#4e5c72" },
  logoutBtn: {
    background: "transparent", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "8px 16px", color: "#f87171", fontSize: 13, cursor: "pointer", flexShrink: 0,
  },

  // Subscription
  subCard: { background: "#111820", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px 20px" },
  subStatus: { fontSize: 15, fontWeight: 600, color: "#eef2f9", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 },
  subDesc: { fontSize: 13, color: "#8394b0", marginBottom: 14, lineHeight: 1.5 },
  upgradeBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)", border: "none",
    borderRadius: 12, padding: "16px 20px", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", width: "100%",
    boxShadow: "0 4px 16px rgba(139,92,246,0.4)",
  },
  daysBox: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 10,
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 12,
    padding: "10px 16px",
  },
  daysNum: { fontSize: 32, fontWeight: 800, color: "#c4b5fd", lineHeight: 1 },
  daysSub: { fontSize: 13, color: "#8394b0", fontWeight: 500 },
  cancelBtn: {
    background: "transparent", border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: 10, padding: "9px 18px", color: "#f87171", fontSize: 13, cursor: "pointer",
  },
  canceledMsg: {
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13, lineHeight: 1.5,
  },

  // Credentials
  currentLabel: { fontSize: 13, color: "#8394b0", marginBottom: 14 },
  credForm: { display: "flex", gap: 10 },
  input: {
    flex: 1, background: "#0c1018", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: "11px 14px", color: "#eef2f9", fontSize: 14, outline: "none", width: "100%",
  },
  credBtn: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none",
    borderRadius: 12, padding: "11px 18px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0,
  },
  msgSuccess: {
    marginTop: 12, background: "rgba(22,199,132,0.1)", border: "1px solid rgba(22,199,132,0.3)",
    borderRadius: 10, padding: "10px 14px", color: "#34d399", fontSize: 13, lineHeight: 1.5,
  },
  msgError: {
    marginTop: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13, lineHeight: 1.5,
  },

  // Jobs
  empty: { color: "#4e5c72", fontSize: 14, textAlign: "center", padding: "32px 0" },
  jobGrid: { display: "flex", flexDirection: "column", gap: 10 },
  jobCard: {
    background: "#111820", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
  },
  jobThumb: { position: "relative", flexShrink: 0, width: 56, height: 56, borderRadius: 10, overflow: "hidden", background: "#0c1018" },
  jobImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  jobNoImg: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 },
  jobBadgeDone: {
    position: "absolute", top: 3, right: 3, background: "#16c784", borderRadius: "50%",
    width: 16, height: 16, fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
  },
  jobBadgeStatus: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    background: "rgba(0,0,0,0.7)", fontSize: 8, color: "#c4b5fd", textAlign: "center", padding: "2px 0",
  },
  jobInfo: { flex: 1, minWidth: 0 },
  jobDate: { fontSize: 12, color: "#4e5c72", marginBottom: 3 },
  jobPrompt: { fontSize: 13, color: "#8394b0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  deleteBtn: {
    background: "transparent", border: "none", fontSize: 18, cursor: "pointer",
    color: "#4e5c72", padding: "4px 6px", borderRadius: 8, flexShrink: 0,
  },

  // Notification banner
  notifBanner: {
    background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))",
    border: "1px solid rgba(168,85,247,0.3)",
    borderRadius: 16, padding: "16px 18px",
    display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" as const,
  },
  notifBannerIcon: { fontSize: 24, flexShrink: 0 },
  notifBannerText: { flex: 1, minWidth: 160 },
  notifBannerTitle: { fontSize: 14, fontWeight: 700, color: "#eef2f9", marginBottom: 3 },
  notifBannerSub: { fontSize: 12, color: "#8394b0", lineHeight: 1.4 },
  notifBannerBtns: { display: "flex", gap: 8, flexShrink: 0 },
  notifBannerBtn: {
    background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none",
    borderRadius: 10, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  notifBannerSkip: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "9px 14px", color: "#4e5c72", fontSize: 13, cursor: "pointer",
  },
};
