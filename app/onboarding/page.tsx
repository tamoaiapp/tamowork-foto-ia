"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Screen = 1 | 2 | 3 | 4 | 5 | 6 | "register" | "paywall";
type Plan = "weekly" | "annual";

const YELLOW = "#F5C518";
const TOTAL_STEPS = 7; // telas 1-6 + registro + paywall

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(1);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showNotifPopup, setShowNotifPopup] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    // Se já fez onboarding, vai pro app
    if (typeof window !== "undefined" && localStorage.getItem("tw_onboarding_done")) {
      router.replace("/");
    }
  }, [router]);

  function goNext() {
    if (animating) return;
    // Na tela 1, mostra popup de notificação antes de avançar
    if (screen === 1) {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        setShowNotifPopup(true);
        return;
      }
    }
    advanceScreen();
  }

  function advanceScreen() {
    setAnimating(true);
    setTimeout(() => {
      setScreen((s) => {
        if (s === 1) return 2;
        if (s === 2) return 3;
        if (s === 3) return 4;
        if (s === 4) return 5;
        if (s === 5) return 6;
        if (s === 6) return "register";
        return "paywall";
      });
      setAnimating(false);
    }, 200);
  }

  async function handleNotifPopup(accept: boolean) {
    setShowNotifPopup(false);
    if (accept && typeof Notification !== "undefined") {
      await Notification.requestPermission();
    }
    advanceScreen();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");

    // Verifica se já está logado
    const { data: { user: existing } } = await supabase.auth.getUser();
    if (existing) {
      setScreen("paywall");
      setRegLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: { data: { full_name: regName } },
    });

    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already registered") || m.includes("already exists")) {
        // Tenta logar
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: regEmail, password: regPassword });
        if (loginErr) {
          setRegError("E-mail já cadastrado. Verifique sua senha.");
        } else {
          setScreen("paywall");
        }
      } else if (m.includes("password")) {
        setRegError("Senha deve ter pelo menos 6 caracteres.");
      } else if (m.includes("email")) {
        setRegError("E-mail inválido.");
      } else {
        setRegError("Erro ao criar conta. Tente novamente.");
      }
      setRegLoading(false);
      return;
    }

    if (data.session || data.user) {
      setScreen("paywall");
    } else {
      setRegError("Verifique seu e-mail para confirmar o cadastro.");
    }
    setRegLoading(false);
  }

  async function handleCheckout() {
    setLoadingCheckout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // Semanal vai pro plano mensal MP, Anual vai pro plano anual MP
      const body = selectedPlan === "weekly" ? { plan: "monthly" } : {};
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.init_point) {
        localStorage.setItem("tw_onboarding_done", "1");
        window.location.href = json.init_point;
      }
    } catch {
      // ignore
    } finally {
      setLoadingCheckout(false);
    }
  }

  function skip() {
    localStorage.setItem("tw_onboarding_done", "1");
    router.replace("/");
  }

  const step = screen === "paywall" ? TOTAL_STEPS : screen === "register" ? TOTAL_STEPS - 1 : typeof screen === "number" ? screen : 1;
  const progress = step / TOTAL_STEPS;

  return (
    <div style={s.root}>
      {/* Progress bar */}
      {(
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Popup notificação */}
      {showNotifPopup && (
        <div style={s.popupOverlay}>
          <div style={s.popupBox}>
            <div style={s.popupIcon}>🔔</div>
            <div style={s.popupTitle}>Ativar notificações?</div>
            <div style={s.popupSub}>Saiba quando sua foto estiver pronta.</div>
            <button style={s.popupBtnYellow} onClick={() => handleNotifPopup(true)}>
              Ativar
            </button>
            <button style={s.popupBtnGhost} onClick={() => handleNotifPopup(false)}>
              Agora não
            </button>
          </div>
        </div>
      )}

      <div style={{ ...s.screen, opacity: animating ? 0 : 1, transition: "opacity 0.2s" }}>

        {/* TELA 1 — Gancho */}
        {screen === 1 && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: YELLOW }}>
              Transforme qualquer produto em imagem profissional
            </h1>
            <div style={s.imageArea}>
              <div style={s.beforeAfterRow}>
                <div style={s.beforeCard}>
                  <div style={s.beforeImg}>
                    <span style={s.productEmoji}>📦</span>
                    <div style={s.beforeLabel}>Antes</div>
                  </div>
                </div>
                <div style={s.arrowBetween}>→</div>
                <div style={s.afterCard}>
                  <div style={s.afterImg}>
                    <span style={s.productEmoji}>✨</span>
                    <div style={s.afterLabel}>Depois</div>
                    <div style={s.afterSub}>Foto profissional com IA</div>
                  </div>
                </div>
              </div>
            </div>
            <p style={s.screenSub}>Sem estúdio. Sem fotógrafo. Sem complicação.</p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Próximo</button>
            </div>
          </div>
        )}

        {/* TELA 2 — Dor */}
        {screen === 2 && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: "#fff" }}>
              Você está perdendo vendas por fotos ruins
            </h1>
            <div style={s.imageArea}>
              <div style={s.painCard}>
                <div style={s.painLeft}>
                  <div style={s.painProductBad}>
                    <span style={{ fontSize: 48 }}>📷</span>
                    <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 700, marginTop: 8 }}>Foto ruim</div>
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>0 vendas hoje</div>
                  </div>
                </div>
                <div style={s.painRight}>
                  <div style={s.painProductGood}>
                    <span style={{ fontSize: 48 }}>🌟</span>
                    <div style={{ color: YELLOW, fontSize: 13, fontWeight: 700, marginTop: 8 }}>Foto profissional</div>
                    <div style={{ color: "#22c55e", fontSize: 12, marginTop: 4 }}>+47 vendas hoje</div>
                  </div>
                </div>
              </div>
            </div>
            <p style={s.screenSub}>
              Clientes compram com os olhos.{"\n"}Se sua imagem não chama atenção, você perde dinheiro.
            </p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Próximo</button>
            </div>
          </div>
        )}

        {/* TELA 3 — Solução */}
        {screen === 3 && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: YELLOW }}>
              Crie fotos e vídeos que vendem
            </h1>
            <div style={s.imageArea}>
              <div style={s.solutionGrid}>
                {[
                  { label: "Instagram", bg: "linear-gradient(135deg, #f58529, #dd2a7b, #8134af)", icon: "📸" },
                  { label: "Shopee", bg: "linear-gradient(135deg, #e8390e, #ff6b35)", icon: "🛒" },
                  { label: "WhatsApp", bg: "linear-gradient(135deg, #25d366, #128c7e)", icon: "💬" },
                  { label: "Catálogo", bg: "linear-gradient(135deg, #6366f1, #a855f7)", icon: "📋" },
                ].map((item) => (
                  <div key={item.label} style={{ ...s.solutionCard, background: item.bg }}>
                    <span style={{ fontSize: 32 }}>{item.icon}</span>
                    <span style={s.solutionCardLabel}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <p style={s.screenSub}>
              Gere conteúdo pronto para Instagram, Shopee, WhatsApp e catálogo.
            </p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Próximo</button>
            </div>
          </div>
        )}

        {/* TELA 4 — Diferencial ilimitado */}
        {screen === 4 && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: "#fff" }}>
              Fotos e vídeos{" "}
              <span style={{ color: YELLOW }}>ilimitados</span>{" "}
              com IA
            </h1>
            <div style={s.imageArea}>
              <div style={s.unlimitedGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{
                    ...s.unlimitedCard,
                    background: [
                      "linear-gradient(135deg, #1a1a2e, #16213e)",
                      "linear-gradient(135deg, #0f3460, #533483)",
                      "linear-gradient(135deg, #533483, #e94560)",
                      "linear-gradient(135deg, #16213e, #0f3460)",
                      "linear-gradient(135deg, #e94560, #533483)",
                      "linear-gradient(135deg, #0f3460, #1a1a2e)",
                    ][i],
                    animationDelay: `${i * 0.1}s`,
                  }}>
                    <span style={{ fontSize: 28 }}>{"📦🛍️👟👜📱🎁"[i]}</span>
                  </div>
                ))}
              </div>
              <div style={s.unlimitedBadge}>∞ ilimitado</div>
            </div>
            <p style={s.screenSub}>
              Teste quantas ideias quiser.{"\n"}Crie até encontrar o visual perfeito para vender.
            </p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Próximo</button>
            </div>
          </div>
        )}

        {/* TELA 5 — Velocidade */}
        {screen === 5 && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: YELLOW }}>
              Pronto em segundos
            </h1>
            <div style={s.imageArea}>
              <div style={s.speedCard}>
                <div style={s.speedRow}>
                  <div style={s.speedItem}>
                    <div style={s.speedIcon}>😰</div>
                    <div style={s.speedLabel}>Foto tradicional</div>
                    <div style={s.speedTime}>3–5 horas</div>
                  </div>
                  <div style={s.speedVs}>VS</div>
                  <div style={s.speedItem}>
                    <div style={s.speedIcon}>⚡</div>
                    <div style={s.speedLabel}>TamoWork IA</div>
                    <div style={{ ...s.speedTime, color: YELLOW }}>~30 segundos</div>
                  </div>
                </div>
                <div style={s.speedBar}>
                  <div style={s.speedBarFill} />
                </div>
                <div style={s.speedNote}>Enquanto outros levam horas, você já vendeu.</div>
              </div>
            </div>
            <p style={s.screenSub}>
              Enquanto outros levam horas para produzir,{"\n"}você cria em poucos segundos.
            </p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Próximo</button>
            </div>
          </div>
        )}

        {/* TELA 6 — Posicionamento */}
        {screen === 6 && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: "#fff" }}>
              Seu{" "}
              <span style={{ color: YELLOW }}>funcionário de conteúdo</span>{" "}
              com IA
            </h1>
            <div style={s.imageArea}>
              <div style={s.employeeCard}>
                <div style={s.employeeAvatar}>🤖</div>
                <div style={s.employeeName}>TamoWork IA</div>
                <div style={s.employeeRole}>Criador de Conteúdo</div>
                <div style={s.employeeTasks}>
                  {["Cria fotos profissionais", "Gera vídeos para vender", "Trabalha 24h por dia", "Nunca falta nem atrasa"].map((t) => (
                    <div key={t} style={s.employeeTask}>
                      <span style={{ color: YELLOW, marginRight: 8 }}>✓</span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p style={s.screenSub}>
              Ele cria suas fotos e vídeos automaticamente{"\n"}enquanto você foca em vender.
            </p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Continuar</button>
            </div>
          </div>
        )}

        {/* TELA REGISTRO */}
        {screen === "register" && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: "#fff" }}>
              Crie sua conta{"\n"}
              <span style={{ color: YELLOW }}>gratuita</span>
            </h1>
            <p style={{ ...s.screenSub, marginBottom: 28 }}>
              Acesse suas fotos e vídeos de qualquer lugar.
            </p>

            <form onSubmit={handleRegister} style={s.regForm}>
              <div style={s.regField}>
                <label style={s.regLabel}>Nome</label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  style={s.regInput}
                />
              </div>
              <div style={s.regField}>
                <label style={s.regLabel}>E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  style={s.regInput}
                />
              </div>
              <div style={s.regField}>
                <label style={s.regLabel}>Senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ ...s.regInput, paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={s.eyeBtn}
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {regError && <div style={s.regError}>{regError}</div>}

              <div style={{ ...s.bottomArea, paddingTop: 8 }}>
                <button
                  type="submit"
                  disabled={regLoading}
                  style={{ ...s.btnYellow, opacity: regLoading ? 0.7 : 1 }}
                >
                  {regLoading ? "Criando conta..." : "Criar conta grátis"}
                </button>
                <button type="button" style={s.btnGhost} onClick={() => setScreen("paywall")}>
                  Já tenho conta
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PAYWALL */}
        {screen === "paywall" && (
          <div style={s.paywallScreen}>
            <div style={s.paywallScroll}>
              <h1 style={s.paywallTitle}>
                Desbloqueie sua{"\n"}
                <span style={{ color: YELLOW }}>máquina de vendas</span>{"\n"}
                com IA
              </h1>
              <p style={s.paywallSub}>
                Crie fotos e vídeos ilimitados para seus produtos e venda mais todos os dias.
              </p>

              {/* Benefícios */}
              <div style={s.benefitsList}>
                {[
                  "Fotos ilimitadas para seus produtos",
                  "Vídeos ilimitados prontos para vender",
                  "Conteúdo para Instagram, Shopee e WhatsApp",
                  "Estilos profissionais automáticos",
                  "Alta resolução",
                  "Sem marca d'água",
                ].map((b) => (
                  <div key={b} style={s.benefitItem}>
                    <span style={s.benefitCheck}>✓</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              {/* Frase de conversão */}
              <div style={s.conversionLine}>
                Uma única imagem que vende já pode pagar o app.
              </div>

              {/* Planos */}
              <div style={s.plansArea}>
                {/* Semanal */}
                <button
                  style={{ ...s.planCard, ...(selectedPlan === "weekly" ? s.planCardSelected : {}) }}
                  onClick={() => setSelectedPlan("weekly")}
                >
                  <div style={s.planRadio}>
                    <div style={{ ...s.planRadioInner, ...(selectedPlan === "weekly" ? s.planRadioActive : {}) }} />
                  </div>
                  <div style={s.planInfo}>
                    <div style={s.planName}>Semanal</div>
                    <div style={s.planDesc}>Acesso completo + uso ilimitado</div>
                  </div>
                  <div style={s.planPrice}>R$29,90</div>
                </button>

                {/* Anual */}
                <button
                  style={{ ...s.planCard, ...(selectedPlan === "annual" ? s.planCardSelected : {}) }}
                  onClick={() => setSelectedPlan("annual")}
                >
                  <div style={s.planRadio}>
                    <div style={{ ...s.planRadioInner, ...(selectedPlan === "annual" ? s.planRadioActive : {}) }} />
                  </div>
                  <div style={s.planInfo}>
                    <div style={s.planNameRow}>
                      <span style={s.planName}>Anual</span>
                      <span style={s.planBadge}>MAIS VANTAJOSO</span>
                    </div>
                    <div style={s.planDesc}>Melhor custo + acesso completo</div>
                  </div>
                  <div style={s.planPrice}>R$199,90</div>
                </button>
              </div>

              <div style={s.cancelNote}>↺ Cancelamento a Qualquer Momento</div>
            </div>

            <div style={s.paywallBottom}>
              <button
                style={{ ...s.btnYellow, opacity: loadingCheckout ? 0.7 : 1 }}
                onClick={handleCheckout}
                disabled={loadingCheckout}
              >
                {loadingCheckout ? "Aguarde..." : "Começar a vender com IA"}
              </button>
              <button style={s.btnGhost} onClick={skip}>
                Talvez mais tarde
              </button>
              <div style={s.legalRow}>
                <span style={s.legalLink}>Política de Privacidade</span>
                <span style={s.legalLink}>Restaurar Compras</span>
                <span style={s.legalLink}>Termos de Uso</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Outfit', sans-serif",
    maxWidth: 430,
    margin: "0 auto",
    position: "relative",
    overflow: "hidden",
  },
  progressBar: {
    height: 3,
    background: "rgba(255,255,255,0.1)",
    position: "fixed",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 430,
    zIndex: 100,
  },
  progressFill: {
    height: "100%",
    background: YELLOW,
    transition: "width 0.4s ease",
    borderRadius: 2,
  },
  screen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },

  // --- TELA 0 NOTIFICAÇÕES ---
  notifScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "60px 24px 40px",
    minHeight: "100vh",
  },
  notifContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  notifTitle: {
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
    lineHeight: 1.2,
    margin: "0 0 12px",
    color: "#fff",
  },
  notifSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 1.5,
    margin: "0 0 40px",
  },
  notifMockup: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },
  phoneMock: {
    width: 220,
    height: 380,
    background: "#111",
    borderRadius: 32,
    border: "2px solid #222",
    overflow: "hidden",
    position: "relative",
  },
  phoneScreen: {
    width: "100%",
    height: "100%",
    background: "#0a0a0a",
    padding: 12,
    position: "relative",
  },
  appGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 8,
  },
  appCard: {
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    aspectRatio: "1",
  },
  appCardIcon: { fontSize: 28 },
  appCardLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600 },
  notifBubble: {
    position: "absolute",
    top: 16,
    left: -8,
    right: 8,
    background: "rgba(30,30,30,0.95)",
    backdropFilter: "blur(10px)",
    borderRadius: 14,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    animation: "slideDown 0.5s ease 0.5s both",
  },
  notifBubbleIcon: { fontSize: 24, flexShrink: 0 },
  notifBubbleTitle: { fontSize: 13, fontWeight: 700, color: "#fff" },
  notifBubbleSub: { fontSize: 11, color: "rgba(255,255,255,0.5)" },

  // --- TELAS DE CONTEÚDO ---
  contentScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "60px 24px 24px",
    minHeight: "100vh",
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.2,
    margin: "0 0 24px",
    letterSpacing: "-0.02em",
  },
  screenSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
    margin: "16px 0 0",
  },
  imageArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  // Before/After
  beforeAfterRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  beforeCard: { flex: 1 },
  afterCard: { flex: 1 },
  beforeImg: {
    background: "#1a1a1a",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    aspectRatio: "0.85",
    justifyContent: "center",
    border: "1px solid #333",
  },
  afterImg: {
    background: "linear-gradient(135deg, #1a1a2e, #533483)",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    aspectRatio: "0.85",
    justifyContent: "center",
    boxShadow: `0 0 30px rgba(245,197,24,0.3)`,
    border: `2px solid ${YELLOW}40`,
  },
  productEmoji: { fontSize: 56 },
  beforeLabel: { fontSize: 13, color: "#666", fontWeight: 600 },
  afterLabel: { fontSize: 13, color: YELLOW, fontWeight: 700 },
  afterSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  arrowBetween: { fontSize: 24, color: YELLOW, fontWeight: 700, flexShrink: 0 },

  // Pain
  painCard: {
    display: "flex",
    gap: 12,
  },
  painLeft: { flex: 1 },
  painRight: { flex: 1 },
  painProductBad: {
    background: "#1a1a1a",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    aspectRatio: "0.85",
    justifyContent: "center",
    border: "2px solid #ef4444",
  },
  painProductGood: {
    background: "linear-gradient(135deg, #0f3460, #533483)",
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    aspectRatio: "0.85",
    justifyContent: "center",
    border: `2px solid ${YELLOW}`,
    boxShadow: `0 0 30px rgba(245,197,24,0.2)`,
  },

  // Solution grid
  solutionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  solutionCard: {
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    aspectRatio: "1",
    justifyContent: "center",
  },
  solutionCardLabel: { fontSize: 14, fontWeight: 700, color: "#fff" },

  // Unlimited
  unlimitedGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  unlimitedCard: {
    borderRadius: 16,
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
  },
  unlimitedBadge: {
    background: YELLOW,
    color: "#000",
    fontWeight: 900,
    fontSize: 20,
    borderRadius: 50,
    padding: "10px 28px",
    textAlign: "center",
    letterSpacing: "0.05em",
  },

  // Speed
  speedCard: {
    background: "#111",
    borderRadius: 24,
    padding: 24,
    border: "1px solid #222",
  },
  speedRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  speedItem: { textAlign: "center" },
  speedIcon: { fontSize: 40, marginBottom: 8 },
  speedLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  speedTime: { fontSize: 18, fontWeight: 800, color: "#ef4444" },
  speedVs: { fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.3)" },
  speedBar: {
    height: 6,
    background: "#222",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  speedBarFill: {
    height: "100%",
    width: "92%",
    background: `linear-gradient(90deg, #ef4444 0%, ${YELLOW} 100%)`,
    borderRadius: 3,
  },
  speedNote: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 1.5,
  },

  // Employee
  employeeCard: {
    background: "#111",
    borderRadius: 24,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${YELLOW}30`,
  },
  employeeAvatar: {
    fontSize: 56,
    background: "#1a1a1a",
    borderRadius: 50,
    width: 80,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid ${YELLOW}`,
  },
  employeeName: { fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 4 },
  employeeRole: { fontSize: 13, color: YELLOW, fontWeight: 600, marginBottom: 12 },
  employeeTasks: { width: "100%", display: "flex", flexDirection: "column", gap: 10 },
  employeeTask: { fontSize: 15, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center" },

  // Bottom area
  bottomArea: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingTop: 24,
    paddingBottom: 8,
  },

  // --- PAYWALL ---
  paywallScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  paywallScroll: {
    flex: 1,
    padding: "60px 24px 24px",
    overflowY: "auto",
  },
  paywallTitle: {
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1.2,
    margin: "0 0 12px",
    whiteSpace: "pre-line",
    letterSpacing: "-0.02em",
  },
  paywallSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.6,
    margin: "0 0 24px",
  },
  benefitsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 20,
  },
  benefitItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 15,
    color: "#fff",
    fontWeight: 500,
  },
  benefitCheck: {
    color: YELLOW,
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  conversionLine: {
    textAlign: "center",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
    margin: "4px 0 20px",
    padding: "12px 16px",
    background: "rgba(245,197,24,0.05)",
    borderRadius: 12,
    border: `1px solid ${YELLOW}20`,
  },
  plansArea: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  planCard: {
    background: "#111",
    border: "1.5px solid #222",
    borderRadius: 16,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.2s",
    width: "100%",
  },
  planCardSelected: {
    borderColor: YELLOW,
    background: `rgba(245,197,24,0.05)`,
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    border: "2px solid #444",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  planRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: "transparent",
  },
  planRadioActive: {
    background: YELLOW,
  },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: 700, color: "#fff" },
  planNameRow: { display: "flex", alignItems: "center", gap: 8 },
  planBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: YELLOW,
    color: "#000",
    padding: "2px 8px",
    borderRadius: 20,
    letterSpacing: "0.05em",
  },
  planDesc: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  planPrice: { fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0 },
  cancelNote: {
    textAlign: "center",
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    margin: "4px 0 8px",
  },
  paywallBottom: {
    padding: "12px 24px 32px",
    background: "#000",
    borderTop: "1px solid #111",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  legalRow: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
  legalLink: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    cursor: "pointer",
  },

  // Notif popup
  popupOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 999,
    padding: "0 16px 32px",
  },
  popupBox: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 24,
    padding: "28px 24px 20px",
    width: "100%",
    maxWidth: 400,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    animation: "slideUp 0.3s ease",
  },
  popupIcon: { fontSize: 36, marginBottom: 4 },
  popupTitle: { fontSize: 18, fontWeight: 800, color: "#fff", textAlign: "center" as const },
  popupSub: { fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center" as const, marginBottom: 8 },
  popupBtnYellow: {
    width: "100%",
    padding: "14px 0",
    background: YELLOW,
    border: "none",
    borderRadius: 50,
    color: "#000",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },
  popupBtnGhost: {
    width: "100%",
    padding: "10px 0",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },

  // Register form
  regForm: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1,
  },
  regField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  regLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: "0.03em",
  },
  regInput: {
    background: "#111",
    border: "1.5px solid #222",
    borderRadius: 14,
    padding: "14px 16px",
    color: "#fff",
    fontSize: 16,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    fontFamily: "'Outfit', sans-serif",
  },
  eyeBtn: {
    position: "absolute" as const,
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
  },
  regError: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#f87171",
    fontSize: 14,
  },

  // Buttons
  btnYellow: {
    width: "100%",
    padding: "17px 0",
    background: YELLOW,
    border: "none",
    borderRadius: 50,
    color: "#000",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    fontFamily: "'Outfit', sans-serif",
  },
  btnGhost: {
    width: "100%",
    padding: "12px 0",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
  },
};
