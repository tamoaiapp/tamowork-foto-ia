"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const S3 = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object";

// 5 produtos reais: foto original → foto IA → vídeo IA
const DEMO_CARDS = [
  {
    label: "Tênis bordado",
    before: `${S3}/public/input-images/onboard/tenis.jpg`,
    after:  `${S3}/sign/image-jobs/800f27c5-7d73-4603-b252-d2e9853563b8.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzgwMGYyN2M1LTdkNzMtNDYwMy1iMjUyLWQyZTk4NTM1NjNiOC5qcGciLCJpYXQiOjE3NzQ5NTgwMDQsImV4cCI6MjA5MDMxODAwNH0.WnYrCu2rEopYvByQKFu8L5Hm-3jzA9IXUqgjuFI2unQ`,
    video:  null as string | null, // será preenchido quando o vídeo ficar pronto
  },
  {
    label: "Óculos retrô",
    before: `${S3}/public/input-images/onboard/oculos.jpeg`,
    after:  `${S3}/sign/image-jobs/d7b2fe90-4383-4f6d-92bb-672b210de218.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2Q3YjJmZTkwLTQzODMtNGY2ZC05MmJiLTY3MmIyMTBkZTIxOC5qcGciLCJpYXQiOjE3NzQ5NTgwMDUsImV4cCI6MjA5MDMxODAwNX0.4DG7PNfy--I0dO76hrsxIQvYnKgZ9YkaYicebKzR98w`,
    video:  null as string | null,
  },
  {
    label: "Fantasia infantil",
    before: `${S3}/public/input-images/onboard/fantasia.webp`,
    after:  `${S3}/sign/image-jobs/4bfe5d4a-7d6a-41e9-8c15-15ecbc4e1571.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzRiZmU1ZDRhLTdkNmEtNDFlOS04YzE1LTE1ZWNiYzRlMTU3MS5qcGciLCJpYXQiOjE3NzQ5NTgwMDUsImV4cCI6MjA5MDMxODAwNX0.mItnYXMEOLDmMn8ViKTZz219qSx9dNOKoGoEWyYCbno`,
    video:  null as string | null,
  },
  {
    label: "Colar de praia",
    before: `${S3}/public/input-images/onboard/colar.webp`,
    after:  `${S3}/sign/image-jobs/e307caef-e00b-4e45-b27e-311090bbe285.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2UzMDdjYWVmLWUwMGItNGU0NS1iMjdlLTMxMTA5MGJiZTI4NS5qcGciLCJpYXQiOjE3NzQ5NTgwMDQsImV4cCI6MjA5MDMxODAwNH0.8y-i7FEDxSDPJxHkwKwZ4LkctT1a04eTOw46Tek0UXE`,
    video:  null as string | null,
  },
  {
    label: "Vestido estampado",
    before: `${S3}/public/input-images/onboard/vestido.jpg`,
    after:  `${S3}/sign/image-jobs/be971c3f-bd0a-4aaa-afcc-a6ddef73949b.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2JlOTcxYzNmLWJkMGEtNGFhYS1hZmNjLWE2ZGRlZjczOTQ5Yi5qcGciLCJpYXQiOjE3NzQ5NTgwMDMsImV4cCI6MjA5MDMxODAwM30.9u6Jm4fbeuHD2JMAt5aJcYnRyS_N-Vmjj7_JzzWqSC8`,
    video:  null as string | null,
  },
];

type Screen = 1 | 2 | 3;
type Plan = "weekly" | "annual";

const BRAND = "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)";
const ACCENT = "#a855f7";
const BG = "#07080b";
const CARD = "#111820";
const LINE = "rgba(255,255,255,0.07)";
const TOTAL_STEPS = 3;

// vídeos serão preenchidos quando os jobs ficarem prontos
const DEMO_VIDEOS: string[] = [];

function DemoCards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      {DEMO_CARDS.map((card) => (
        <div key={card.label} style={{
          background: CARD, borderRadius: 18, overflow: "hidden",
          border: `1px solid rgba(255,255,255,0.07)`,
        }}>
          {/* Label */}
          <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{card.label}</span>
            {card.video
              ? <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}22`, padding: "2px 8px", borderRadius: 20 }}>▶ VÍDEO IA</span>
              : <span style={{ fontSize: 10, color: "#4e5c72", background: "#1a2030", padding: "2px 8px", borderRadius: 20 }}>📸 FOTO IA</span>
            }
          </div>

          {/* Before → After */}
          <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <img src={card.before} alt="antes" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.7)", color: "#888", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, letterSpacing: 1 }}>ANTES</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", padding: "0 6px", flexShrink: 0, fontSize: 16, color: ACCENT }}>→</div>
            <div style={{ flex: 1.4, position: "relative" }}>
              <img src={card.after} alt="depois" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 6, left: 6, background: ACCENT, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, letterSpacing: 1 }}>DEPOIS</span>
            </div>
          </div>
        </div>
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}

function VideoCarousel() {
  const [vidIdx, setVidIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goTo(next: number) {
    if (animating) return;
    setPrevIdx(vidIdx);
    setAnimating(true);
    setTimeout(() => {
      setVidIdx(next);
      setPrevIdx(null);
      setAnimating(false);
    }, 600);
  }

  useEffect(() => {
    timerRef.current = setTimeout(() => goTo((vidIdx + 1) % DEMO_VIDEOS.length), 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [vidIdx]);

  return (
    <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: "#0c1018", border: `1px solid ${ACCENT}30`, boxShadow: `0 0 40px ${ACCENT}20`, aspectRatio: "9/16", maxHeight: 420 }}>
      {DEMO_VIDEOS.map((src, i) => {
        const isActive = i === vidIdx;
        const isPrev = i === prevIdx;
        if (!isActive && !isPrev) return null;
        return (
          <video
            key={src}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              borderRadius: 20,
              animation: isActive && animating
                ? "vidSlideIn 0.6s cubic-bezier(0.4,0,0.2,1) forwards"
                : isPrev && animating
                ? "vidSlideOut 0.6s cubic-bezier(0.4,0,0.2,1) forwards"
                : isActive
                ? "vidFadeIn 0.4s ease forwards"
                : "none",
              zIndex: isActive ? 2 : 1,
            }}
          />
        );
      })}

      {/* Overlay gradiente bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", zIndex: 3, borderRadius: "0 0 20px 20px" }} />

      {/* Dots */}
      <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 4 }}>
        {DEMO_VIDEOS.map((_, i) => (
          <div key={i} onClick={() => goTo(i)} style={{ width: i === vidIdx ? 18 : 6, height: 6, borderRadius: 99, background: i === vidIdx ? "#fff" : "rgba(255,255,255,0.35)", transition: "all 0.35s ease", cursor: "pointer" }} />
        ))}
      </div>

      {/* Badge */}
      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 5, zIndex: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1.5s infinite" }} />
        Vídeo gerado por IA
      </div>

      <style>{`
        @keyframes vidSlideIn {
          from { opacity: 0; transform: scale(1.06) translateX(30px); }
          to   { opacity: 1; transform: scale(1) translateX(0); }
        }
        @keyframes vidSlideOut {
          from { opacity: 1; transform: scale(1) translateX(0); }
          to   { opacity: 0; transform: scale(0.96) translateX(-30px); }
        }
        @keyframes vidFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(1);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [showRegPopup, setShowRegPopup] = useState(false);

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
    advanceScreen();
  }

  function advanceScreen() {
    setAnimating(true);
    setTimeout(() => {
      setScreen((s) => (s < 3 ? (s + 1) as Screen : 3));
      setAnimating(false);
    }, 200);
  }

  async function handleNotifPopup(accept: boolean) {
    setShowNotifPopup(false);
    if (accept && typeof Notification !== "undefined") {
      await Notification.requestPermission();
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");

    // Verifica se já está logado
    const { data: { user: existing } } = await supabase.auth.getUser();
    if (existing) {
      setScreen(3);
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
          setScreen(3);
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
      setScreen(3);
    } else {
      setRegError("Verifique seu e-mail para confirmar o cadastro.");
    }
    setRegLoading(false);
  }

  async function handleCheckoutClick() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShowRegPopup(true);
      return;
    }
    await goToCheckout(session.access_token);
  }

  async function goToCheckout(token: string) {
    setLoadingCheckout(true);
    try {
      const body = selectedPlan === "weekly" ? { plan: "monthly" } : {};
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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

  const step = screen;

  const progress = step / TOTAL_STEPS;

  return (
    <div style={s.root}>
      {/* Progress bar */}
      {(
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Popup cadastro rápido antes do checkout */}
      {showRegPopup && (
        <div style={s.popupOverlay}>
          <div style={{ ...s.popupBox, padding: "28px 24px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
            <div style={s.popupTitle}>Crie sua conta</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20, textAlign: "center" }}>
              É rápido. Depois vamos ao pagamento.
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setRegLoading(true);
              setRegError("");
              const { data, error } = await supabase.auth.signUp({ email: regEmail, password: regPassword, options: { data: { full_name: regName } } });
              if (error) {
                const m = error.message.toLowerCase();
                if (m.includes("already registered") || m.includes("already exists")) {
                  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email: regEmail, password: regPassword });
                  if (loginErr) { setRegError("Senha incorreta."); setRegLoading(false); return; }
                  setShowRegPopup(false);
                  await goToCheckout(loginData.session!.access_token);
                } else {
                  setRegError("Erro ao criar conta. Tente novamente.");
                }
                setRegLoading(false);
                return;
              }
              if (data.session) {
                setShowRegPopup(false);
                await goToCheckout(data.session.access_token);
              } else {
                setRegError("Confirme seu e-mail para continuar.");
              }
              setRegLoading(false);
            }} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="text" placeholder="Seu nome" value={regName} onChange={e => setRegName(e.target.value)} required style={s.regInput} />
              <input type="email" placeholder="seu@email.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} required style={s.regInput} />
              <input type="password" placeholder="Senha (mín. 6 caracteres)" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} style={s.regInput} />
              {regError && <div style={{ fontSize: 12, color: "#f87171", textAlign: "center" }}>{regError}</div>}
              <button type="submit" disabled={regLoading} style={{ ...s.btnYellow, opacity: regLoading ? 0.7 : 1, marginTop: 4 }}>
                {regLoading ? "Aguarde..." : "Continuar para pagamento →"}
              </button>
              <button type="button" style={s.popupBtnGhost} onClick={() => setShowRegPopup(false)}>Cancelar</button>
            </form>
          </div>
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

        {/* TELA 1 — 5 cards Antes/Depois */}
        {screen === 1 && (
          <div style={{ ...s.contentScreen, overflowY: "auto", paddingBottom: 100 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "inline-block", background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: "0.04em", marginBottom: 14 }}>
                IA PARA PRODUTOS
              </div>
              <h1 style={{ ...s.screenTitle, margin: 0 }}>
                Transforme qualquer foto em{" "}
                <span style={{ color: ACCENT }}>imagem profissional</span>
              </h1>
            </div>
            <DemoCards />
            <div style={{ ...s.bottomArea, position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: `linear-gradient(transparent, ${BG} 40%)`, paddingTop: 40, paddingBottom: 20 }}>
              <button style={s.btnYellow} onClick={goNext}>Ver como funciona →</button>
            </div>
          </div>
        )}

        {/* TELA 2 — Ilimitado + 26k usuários */}
        {screen === 2 && (
          <div style={s.contentScreen}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "inline-block", background: "#16c78422", border: "1px solid #16c78444", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: "#16c784", letterSpacing: "0.04em", marginBottom: 14 }}>
                ILIMITADO
              </div>
              <h1 style={{ ...s.screenTitle, margin: 0 }}>
                Mais de{" "}
                <span style={{ color: ACCENT }}>26.000</span>{" "}
                empreendedores já usam
              </h1>
            </div>

            {/* Avatares */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ display: "flex" }}>
                {["#f58529","#dd2a7b","#8134af","#6366f1","#16c784"].map((c, i) => (
                  <div key={i} style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${c}, ${c}99)`, border: "2px solid #07080b", marginLeft: i === 0 ? 0 : -10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    {["👩","👨","👩","👨","👩"][i]}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                <span style={{ color: "#fff", fontWeight: 700 }}>+26.000</span> empreendedores{"\n"}usando todo dia
              </div>
            </div>

            {/* Card ilimitado */}
            <div style={{ background: `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}08)`, border: `1px solid ${ACCENT}30`, borderRadius: 22, padding: "22px 20px", marginBottom: 14 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 6 }}>∞ Ilimitado</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                Crie quantas fotos e vídeos quiser.{"\n"}Sem limite. Sem fila. Sem custo extra.
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              {[
                { num: "+26k", label: "usuários ativos" },
                { num: "∞", label: "fotos e vídeos" },
                { num: "~30s", label: "por imagem" },
                { num: "4.9★", label: "avaliação" },
              ].map((stat) => (
                <div key={stat.label} style={{ background: CARD, borderRadius: 14, padding: "14px 16px", border: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: ACCENT }}>{stat.num}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Quero começar →</button>
            </div>
          </div>
        )}

        {/* TELA 3 — PAGAMENTO */}
        {screen === 3 && (
          <div style={s.paywallScreen}>
            <div style={s.paywallScroll}>
              <h1 style={s.paywallTitle}>
                Fotos e vídeos{" "}
                <span style={{ color: ACCENT }}>ilimitados</span>{" "}
                para vender mais
              </h1>
              <p style={s.paywallSub}>Acesso completo. Sem limite de uso.</p>

              {/* Benefícios */}
              <div style={s.benefitsList}>
                {[
                  "Fotos ilimitadas para seus produtos",
                  "Vídeos ilimitados prontos para Reels e TikTok",
                  "Modelos humanos com IA",
                  "Alta resolução sem marca d'água",
                  "Pronto para Instagram, Shopee e WhatsApp",
                ].map((b) => (
                  <div key={b} style={s.benefitItem}>
                    <span style={s.benefitCheck}>✓</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              {/* Planos */}
              <div style={s.plansArea}>
                {/* Anual */}
                <button
                  style={{ ...s.planCard, ...(selectedPlan === "annual" ? s.planCardSelected : {}), position: "relative", overflow: "visible" }}
                  onClick={() => setSelectedPlan("annual")}
                >
                  <div style={{ position: "absolute", top: -11, right: 14, background: BRAND, color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.06em" }}>
                    MAIS POPULAR
                  </div>
                  <div style={s.planRadio}>
                    <div style={{ ...s.planRadioInner, ...(selectedPlan === "annual" ? s.planRadioActive : {}) }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.planName}>Plano Anual</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>R$348 cobrado uma vez por ano</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textDecoration: "line-through" }}>R$47/sem</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>R$29<span style={{ fontSize: 12, fontWeight: 500 }}>/mês</span></div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>R$0,95<span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>/dia</span></div>
                  </div>
                </button>

                {/* Semanal */}
                <button
                  style={{ ...s.planCard, ...(selectedPlan === "weekly" ? s.planCardSelected : {}) }}
                  onClick={() => setSelectedPlan("weekly")}
                >
                  <div style={s.planRadio}>
                    <div style={{ ...s.planRadioInner, ...(selectedPlan === "weekly" ? s.planRadioActive : {}) }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.planName}>Semanal</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Acesso completo por 7 dias</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>R$47<span style={{ fontSize: 12, fontWeight: 500 }}>/sem</span></div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>R$6,71/dia</div>
                  </div>
                </button>
              </div>

              <div style={s.cancelNote}>↺ Cancele quando quiser</div>
              <div style={{ ...s.conversionLine, marginTop: 8 }}>Uma foto que vende já paga o mês inteiro.</div>
            </div>

            <div style={s.paywallBottom}>
              <button
                style={{ ...s.btnYellow, opacity: loadingCheckout ? 0.7 : 1 }}
                onClick={handleCheckoutClick}
                disabled={loadingCheckout}
              >
                {loadingCheckout ? "Aguarde..." : "Começar agora"}
              </button>
              <button style={s.btnGhost} onClick={skip}>Talvez mais tarde</button>
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
    background: BG,
    color: "#eef2f9",
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
    background: BRAND,
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
    background: CARD,
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
    background: "#0c1018",
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
    boxShadow: `0 0 30px rgba(168,85,247,0.3)`,
    border: `2px solid ${ACCENT}40`,
  },
  productEmoji: { fontSize: 56 },
  beforeLabel: { fontSize: 13, color: "#666", fontWeight: 600 },
  afterLabel: { fontSize: 13, color: ACCENT, fontWeight: 700 },
  afterSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  arrowBetween: { fontSize: 24, color: ACCENT, fontWeight: 700, flexShrink: 0 },

  // Pain
  painCard: {
    display: "flex",
    gap: 12,
  },
  painLeft: { flex: 1 },
  painRight: { flex: 1 },
  painProductBad: {
    background: "#0c1018",
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
    border: `2px solid ${ACCENT}`,
    boxShadow: `0 0 30px rgba(168,85,247,0.2)`,
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
    background: BRAND,
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    borderRadius: 50,
    padding: "10px 28px",
    textAlign: "center",
    letterSpacing: "0.05em",
  },

  // Speed
  speedCard: {
    background: CARD,
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
    background: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  speedBarFill: {
    height: "100%",
    width: "92%",
    background: `linear-gradient(90deg, #ef4444 0%, ${ACCENT} 100%)`,
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
    background: CARD,
    borderRadius: 24,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${ACCENT}30`,
  },
  employeeAvatar: {
    fontSize: 56,
    background: "#0c1018",
    borderRadius: 50,
    width: 80,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `2px solid ${ACCENT}`,
  },
  employeeName: { fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 4 },
  employeeRole: { fontSize: 13, color: ACCENT, fontWeight: 600, marginBottom: 12 },
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
    color: ACCENT,
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
    background: "rgba(168,85,247,0.05)",
    borderRadius: 12,
    border: `1px solid ${ACCENT}20`,
  },
  plansArea: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  planCard: {
    background: CARD,
    border: `1.5px solid ${LINE}`,
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
    borderColor: ACCENT,
    background: "rgba(168,85,247,0.08)",
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
    background: BRAND,
  },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: 700, color: "#fff" },
  planNameRow: { display: "flex", alignItems: "center", gap: 8 },
  planBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: BRAND,
    color: "#fff",
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
    background: BG,
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
    background: CARD,
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
    background: BRAND,
    border: "none",
    borderRadius: 50,
    color: "#eef2f9",
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
    background: CARD,
    border: `1.5px solid ${LINE}`,
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
    background: BRAND,
    border: "none",
    borderRadius: 50,
    color: "#eef2f9",
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
