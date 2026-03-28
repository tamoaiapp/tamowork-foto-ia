"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AccountJob[]>([]);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [email, setEmail] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

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
      const token = session.session?.access_token ?? "";
      const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs ?? []);
        setPlanData(data.plan);
      }
      setLoading(false);
    });
  }, [router]);

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
    if (!confirm("Cancelar assinatura? Você continuará com acesso até o fim do período pago.")) return;
    setCanceling(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch("/api/account/subscription/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCancelDone(true);
      else alert("Erro ao cancelar. Tente novamente ou entre em contato.");
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
    if (error) setEmailMsg("Erro: " + error.message);
    else {
      setEmailMsg("Confirmação enviada para " + newEmail + ". Verifique sua caixa de entrada.");
      setNewEmail("");
    }
    setEmailLoading(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) { setPassMsg("As senhas não coincidem."); return; }
    if (newPassword.length < 6) { setPassMsg("Senha deve ter ao menos 6 caracteres."); return; }
    setPassLoading(true);
    setPassMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPassMsg("Erro: " + error.message);
    else {
      setPassMsg("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPassLoading(false);
  }

  function formatDate(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  }

  function isPro() {
    if (!planData || planData.plan !== "pro") return false;
    if (planData.period_end && new Date(planData.period_end) < new Date()) return false;
    return true;
  }

  const isProActive = isPro();
  const isMonthly = isProActive && !!planData?.stripe_subscription_id;
  const isAnnual = isProActive && !!planData?.mp_subscription_id;

  if (loading) return <div style={styles.centered}>Carregando...</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => router.push("/")} style={styles.backBtn}>← Voltar</button>
        <div style={styles.logo}>TamoWork <span style={{ fontSize: 13, fontWeight: 400 }}>Foto IA</span></div>
        <div style={{ width: 60 }} />
      </header>

      <main style={styles.main}>

        {/* Perfil */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Minha conta</h2>
          <div style={styles.profileCard}>
            <div style={styles.avatar}>
              {email.charAt(0).toUpperCase()}
            </div>
            <div style={styles.profileInfo}>
              <div style={styles.profileEmail}>{email}</div>
              <div style={styles.profileSub}>
                {isProActive ? <span style={styles.proBadge}>✦ Pro</span> : <span style={styles.freeBadge}>Gratuito</span>}
              </div>
            </div>
            <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
          </div>
        </section>

        {/* Assinatura */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Assinatura</h2>
          <div style={styles.subCard}>
            {!isProActive && (
              <>
                <div style={styles.subStatus}>Plano Gratuito</div>
                <div style={styles.subDesc}>1 foto a cada 3 horas. Sem acesso a vídeos.</div>
                <button onClick={() => router.push("/planos")} style={styles.upgradeBtn}>
                  ✨ Assinar agora — R$0,61/dia
                </button>
              </>
            )}
            {isMonthly && (
              <>
                <div style={styles.subStatus}>
                  <span style={styles.proBadge}>✦ Pro</span> Mensal
                </div>
                <div style={styles.subDesc}>Próxima renovação: {formatDate(planData?.period_end)}</div>
                {cancelDone ? (
                  <div style={styles.canceledMsg}>
                    Cancelamento agendado — acesso mantido até {formatDate(planData?.period_end)}
                  </div>
                ) : (
                  <button onClick={handleCancelStripe} disabled={canceling} style={styles.cancelBtn}>
                    {canceling ? "Cancelando..." : "Cancelar assinatura"}
                  </button>
                )}
              </>
            )}
            {isAnnual && (
              <>
                <div style={styles.subStatus}>
                  <span style={styles.proBadge}>✦ Pro</span> Anual
                </div>
                <div style={styles.subDesc}>Assinatura feita em {formatDate(planData?.created_at)}</div>
                <div style={styles.subDesc}>Válido até {formatDate(planData?.period_end)}</div>
              </>
            )}
          </div>
        </section>

        {/* Alterar email */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Alterar e-mail</h2>
          <div style={styles.subCard}>
            <div style={styles.currentLabel}>E-mail atual: <strong style={{ color: "#eef2f9" }}>{email}</strong></div>
            <form onSubmit={handleChangeEmail} style={styles.credForm}>
              <input
                type="email"
                placeholder="Novo e-mail"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                style={styles.input}
              />
              <button type="submit" disabled={emailLoading} style={styles.credBtn}>
                {emailLoading ? "Enviando..." : "Confirmar"}
              </button>
            </form>
            {emailMsg && (
              <div style={emailMsg.startsWith("Erro") ? styles.msgError : styles.msgSuccess}>
                {emailMsg}
              </div>
            )}
          </div>
        </section>

        {/* Alterar senha */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Alterar senha</h2>
          <div style={styles.subCard}>
            <form onSubmit={handleChangePassword} style={{ ...styles.credForm, flexDirection: "column" }}>
              <input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={styles.input}
              />
              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ ...styles.input, marginTop: 10 }}
              />
              <button type="submit" disabled={passLoading} style={{ ...styles.credBtn, marginTop: 10 }}>
                {passLoading ? "Salvando..." : "Alterar senha"}
              </button>
            </form>
            {passMsg && (
              <div style={passMsg.startsWith("Erro") || passMsg.includes("não coincidem") || passMsg.includes("ao menos") ? styles.msgError : styles.msgSuccess}>
                {passMsg}
              </div>
            )}
          </div>
        </section>

        {/* Últimas criações */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Suas criações</h2>
          {jobs.length === 0 ? (
            <div style={styles.empty}>Nenhuma foto gerada ainda.</div>
          ) : (
            <div style={styles.jobGrid}>
              {jobs.map((job) => (
                <div key={job.id} style={styles.jobCard}>
                  <div style={styles.jobThumb}>
                    {(job.output_image_url || job.input_image_url) ? (
                      <img src={job.output_image_url ?? job.input_image_url} alt="foto" style={styles.jobImg} />
                    ) : (
                      <div style={styles.jobNoImg}>📷</div>
                    )}
                    {job.status === "done" && <span style={styles.jobBadgeDone}>✓</span>}
                    {job.status !== "done" && (
                      <span style={styles.jobBadgeStatus}>{job.status}</span>
                    )}
                  </div>
                  <div style={styles.jobInfo}>
                    <div style={styles.jobDate}>{formatDate(job.created_at)}</div>
                    {job.prompt && (
                      <div style={styles.jobPrompt} title={job.prompt}>
                        {job.prompt.length > 50 ? job.prompt.slice(0, 50) + "…" : job.prompt}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    style={styles.deleteBtn}
                    title="Apagar"
                  >
                    {deletingId === job.id ? "..." : "🗑"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#07080b" },
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
  main: { maxWidth: 560, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 28 },
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
    borderRadius: 12, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%",
  },
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
};
