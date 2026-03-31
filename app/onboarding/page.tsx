"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const BA_PAIRS = [
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774905957814x838805777189324400/image-5225659771593071006.jpg", after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/53cd979b-6ae5-4083-a1de-b83fd73bc435.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzUzY2Q5NzliLTZhZTUtNDA4My1hMWRlLWI4M2ZkNzNiYzQzNS5qcGciLCJpYXQiOjE3NzQ5MDYxNDgsImV4cCI6MTc3NTUxMDk0OH0.HdV7qQ3LZWHZT3S6d-YsFR-ITXN6sxPxTWDdOhxSF_k" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774905180114x626211159699717100/1000733252.png",            after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/f32b4d0c-f5a8-4786-a1dc-bdfc2e6c53d4.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2YzMmI0ZDBjLWY1YTgtNDc4Ni1hMWRjLWJkZmMyZTZjNTNkNC5qcGciLCJpYXQiOjE3NzQ5MDU3MjgsImV4cCI6MTc3NTUxMDUyOH0.W_v2tcmb0gQ3MEwoTsQ-ONp72OojZ00Jkx9PBhQaY8c" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774904960502x809015720306143000/635767.jpg",               after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/2d800520-ce15-4c2e-87a7-a47118241323.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzJkODAwNTIwLWNlMTUtNGMyZS04N2E3LWE0NzExODI0MTMyMy5qcGciLCJpYXQiOjE3NzQ5MDU0MDMsImV4cCI6MTc3NTUxMDIwM30.in0OxDtu1Ua5eGIBpCecCukWU_lSv05r7xEY2EXYmJc" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774904554729x366067643732088000/1000678841.jpg",           after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/d04dcd95-5e69-4598-bdc9-6902346ca943.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2QwNGRjZDk1LTVlNjktNDU5OC1iZGM5LTY5MDIzNDZjYTk0My5qcGciLCJpYXQiOjE3NzQ5MDQ4MjgsImV4cCI6MTc3NTUwOTYyOH0.HFoUVI-96vCNY9hYKAg3aUiKHyvsuOFQk_u7dxvwtHE" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774904228434x480807660070337040/A02F864D-0FF1-47B3-BE1B-C4E5E4956F40.jpeg", after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/6688e0f3-92c2-4259-bf52-83b70d2a89e8.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzY2ODhlMGYzLTkyYzItNDI1OS1iZjUyLTgzYjcwZDJhODllOC5qcGciLCJpYXQiOjE3NzQ5MDQ0MjksImV4cCI6MTc3NTUwOTIyOX0.a8NisW-0zxdGXp81ZBqlXoI7Fk6ibtwq-pDCiMkZxe0" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774903642221x476199199153923800/IMG_1277.jpeg",            after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/44f1bc7c-ac3a-4f9c-b11f-b55e9bcc4fc3.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzQ0ZjFiYzdjLWFjM2EtNGY5Yy1iMTFmLWI1NWU5YmNjNGZjMy5qcGciLCJpYXQiOjE3NzQ5MDM4MzIsImV4cCI6MTc3NTUwODYzMn0.XtaUpC8xu77dzp_mGx8_sCAixmGVG4lJ36te50WaKoQ" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774903376030x609205702973705500/635662.jpg",               after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/6061dcb7-774c-443b-b8f3-c2c52964933f.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzYwNjFkY2I3LTc3NGMtNDQzYi1iOGYzLWMyYzUyOTY0OTMzZi5qcGciLCJpYXQiOjE3NzQ5MDM3MTAsImV4cCI6MTc3NTUwODUxMH0.dBpySRlPjl_pjIe3j0K3aj018uVkvamhiEqSzOa280E" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774902267384x443968846076211650/635654.jpg",               after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/b31173e3-22bb-4b37-a6a8-cb5335ef845f.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzL2IzMTE3M2UzLTIyYmItNGIzNy1hNmE4LWNiNTMzNWVmODQ1Zi5qcGciLCJpYXQiOjE3NzQ5MDI1NDgsImV4cCI6MTc3NTUwNzM0OH0.xREBBTI03Rco1tzjLLALLC9xSp7_zWY0hrsfBWl6GRE" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774901936285x517994942192998600/1003052097.jpg",           after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/44250a44-2eae-4069-aafe-9e0456570dfd.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzQ0MjUwYTQ0LTJlYWUtNDA2OS1hYWZlLTllMDQ1NjU3MGRmZC5qcGciLCJpYXQiOjE3NzQ5MDIxMjksImV4cCI6MTc3NTUwNjkyOX0.I70h3kWeEw1Emismbbd-ypcYN8ERoEypj6KVmrJ6qf4" },
  { before: "https://1fec56978c6d7da18b6eae078e97428f.cdn.bubble.io/f1774901746173x960644641282296700/634901.jpg",               after: "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/sign/image-jobs/27e549d1-8cf3-408d-8ca6-b6ebd3a4f12a.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lMGI4YzlhZi01NDQ5LTRmMzctYWYxNC1jNmExZjc1MjQ5ZjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS1qb2JzLzI3ZTU0OWQxLThjZjMtNDA4ZC04Y2E2LWI2ZWJkM2E0ZjEyYS5qcGciLCJpYXQiOjE3NzQ5MDIwNDcsImV4cCI6MTc3NTUwNjg0N30.PtCzKjw16ubKpl0gLkUxoTpQwvWjVM7x3blP3Zgiu34" },
];

type Screen = 1 | 2 | 3 | "register" | "paywall";
type Plan = "weekly" | "annual";

const BRAND = "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)";
const ACCENT = "#a855f7";
const BG = "#07080b";
const CARD = "#111820";
const LINE = "rgba(255,255,255,0.07)";
const TOTAL_STEPS = 5; // telas 1-3 + registro + paywall

const DEMO_VIDEO_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/image-jobs/demo-video.mp4";

function BaCarousel() {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setIdx(i => (i + 1) % BA_PAIRS.length), 2800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [idx]);

  const pair = BA_PAIRS[idx];

  return (
    <div style={{ width: "100%", position: "relative", marginBottom: 4 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
        {/* Antes */}
        <div style={{ flex: 1, position: "relative" }}>
          <img
            key={`b-${idx}`}
            src={pair.before}
            alt="antes"
            style={{
              width: "100%", aspectRatio: "0.85", objectFit: "cover",
              borderRadius: 16, border: "1px solid #1e2230",
              animation: "baFadeIn 0.4s ease",
            }}
          />
          <span style={{
            position: "absolute", bottom: 8, left: 8,
            background: "rgba(0,0,0,0.72)", color: "#888",
            fontSize: 11, fontWeight: 700, padding: "3px 8px",
            borderRadius: 6, letterSpacing: 1,
          }}>ANTES</span>
        </div>

        {/* Seta */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, fontSize: 20, color: ACCENT }}>→</div>

        {/* Depois */}
        <div style={{ flex: 1, position: "relative" }}>
          <img
            key={`a-${idx}`}
            src={pair.after}
            alt="depois"
            style={{
              width: "100%", aspectRatio: "0.85", objectFit: "cover",
              borderRadius: 16, border: `2px solid ${ACCENT}60`,
              boxShadow: `0 0 20px ${ACCENT}30`,
              animation: "baFadeIn 0.4s ease",
            }}
          />
          <span style={{
            position: "absolute", bottom: 8, left: 8,
            background: ACCENT, color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "3px 8px",
            borderRadius: 6, letterSpacing: 1,
          }}>DEPOIS</span>
        </div>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 10 }}>
        {BA_PAIRS.map((_, i) => (
          <div
            key={i}
            onClick={() => setIdx(i)}
            style={{
              width: i === idx ? 16 : 6, height: 6,
              borderRadius: 99,
              background: i === idx ? ACCENT : "#2a3050",
              transition: "all 0.3s",
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes baFadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
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
        if (s === 3) return "register";
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

        {/* TELA 1 — Antes/Depois */}
        {screen === 1 && (
          <div style={s.contentScreen}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "inline-block", background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: "0.04em", marginBottom: 14 }}>
                IA PARA PRODUTOS
              </div>
              <h1 style={{ ...s.screenTitle, margin: 0 }}>
                Transforme a foto do seu produto em{" "}
                <span style={{ color: ACCENT }}>imagem profissional</span>
              </h1>
            </div>
            <BaCarousel />
            <p style={{ ...s.screenSub, marginTop: 12, fontSize: 14 }}>
              Qualquer foto vira conteúdo pronto para vender.{"\n"}Sem estúdio. Sem fotógrafo.
            </p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Ver como funciona</button>
            </div>
          </div>
        )}

        {/* TELA 2 — Vídeo */}
        {screen === 2 && (
          <div style={s.contentScreen}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "inline-block", background: "#16c78422", border: "1px solid #16c78444", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: "#16c784", letterSpacing: "0.04em", marginBottom: 14 }}>
                FOTO + VÍDEO COM IA
              </div>
              <h1 style={{ ...s.screenTitle, margin: 0 }}>
                Gera fotos{" "}
                <span style={{ color: ACCENT }}>e vídeos</span>{" "}
                do seu produto
              </h1>
            </div>
            <div style={s.imageArea}>
              <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: "#0c1018", border: `1px solid ${ACCENT}30`, boxShadow: `0 0 40px ${ACCENT}20` }}>
                <video
                  src={DEMO_VIDEO_URL}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: "100%", display: "block", borderRadius: 20 }}
                />
                <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                  Vídeo gerado por IA
                </div>
              </div>
            </div>
            <p style={{ ...s.screenSub, marginTop: 12, fontSize: 14 }}>
              Pronto para Reels, TikTok e Stories.{"\n"}Gerado automaticamente em segundos.
            </p>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Próximo</button>
            </div>
          </div>
        )}

        {/* TELA 3 — Social proof + ilimitado */}
        {screen === 3 && (
          <div style={s.contentScreen}>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ ...s.screenTitle, margin: 0 }}>
                Mais de{" "}
                <span style={{ color: ACCENT }}>26.000</span>{" "}
                empreendedores já usam
              </h1>
            </div>
            <div style={s.imageArea}>
              {/* Avatares simulados */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <div style={{ display: "flex" }}>
                  {["#f58529","#dd2a7b","#8134af","#6366f1","#16c784"].map((c, i) => (
                    <div key={i} style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${c}, ${c}99)`, border: "2px solid #07080b", marginLeft: i === 0 ? 0 : -10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                      {["👩","👨","👩","👨","👩"][i]}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>
                  <span style={{ color: "#fff", fontWeight: 700 }}>+26.000</span> empreendedores{"\n"}usando todo dia
                </div>
              </div>

              {/* Card ilimitado */}
              <div style={{ background: `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}08)`, border: `1px solid ${ACCENT}30`, borderRadius: 20, padding: 20, marginBottom: 14 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 4 }}>∞ Ilimitado</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
                  Crie quantas fotos e vídeos quiser.{"\n"}Sem limite. Sem fila. Sem custo extra.
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { num: "+26k", label: "usuários ativos" },
                  { num: "∞", label: "fotos e vídeos" },
                  { num: "~30s", label: "por imagem" },
                  { num: "4.9★", label: "avaliação" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: CARD, borderRadius: 14, padding: "14px 16px", border: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT }}>{stat.num}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={s.bottomArea}>
              <button style={s.btnYellow} onClick={goNext}>Quero começar</button>
            </div>
          </div>
        )}

        {/* TELA REGISTRO */}
        {screen === "register" && (
          <div style={s.contentScreen}>
            <h1 style={{ ...s.screenTitle, color: "#fff" }}>
              Crie sua conta{"\n"}
              <span style={{ color: ACCENT }}>gratuita</span>
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
                Fotos e vídeos{" "}
                <span style={{ color: ACCENT }}>ilimitados</span>{" "}
                para vender mais
              </h1>
              <p style={s.paywallSub}>
                Acesso completo. Cancele quando quiser.
              </p>

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
                {/* Anual — destaque */}
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
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>R$228 cobrado uma vez por ano</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textDecoration: "line-through" }}>R$39/sem</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>R$19<span style={{ fontSize: 12, fontWeight: 500 }}>/mês</span></div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>R$0,63<span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>/dia</span></div>
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
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>R$39<span style={{ fontSize: 12, fontWeight: 500 }}>/sem</span></div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>R$5,57/dia</div>
                  </div>
                </button>
              </div>

              <div style={s.cancelNote}>↺ Cancele quando quiser</div>
              <div style={{ ...s.conversionLine, marginTop: 8 }}>
                Uma foto que vende já paga o mês inteiro.
              </div>
            </div>

            <div style={s.paywallBottom}>
              <button
                style={{ ...s.btnYellow, opacity: loadingCheckout ? 0.7 : 1 }}
                onClick={handleCheckout}
                disabled={loadingCheckout}
              >
                {loadingCheckout ? "Aguarde..." : "Começar agora"}
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
