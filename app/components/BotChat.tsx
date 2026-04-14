"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface OnboardingData {
  business_name: string;
  business_type: string;
  products: string;
  tone: string; // reutilizado para "canal de vendas + desafio"
}

// ── Introdução (exibida antes do step 0, não coletada) ───────────────────────
const TAMO_INTRO = `Eaí! 🦎 Sou o Tamo — seu parceiro de negócios aqui no TamoWork!

Posso te ajudar com legendas pro Instagram, textos de produto, ideias de promoção, dicas de foto e muito mais.

Mas pra dar conselhos que realmente funcionam pro *seu* negócio, preciso te conhecer melhor. São só 4 perguntas rápidas 👇

Qual é o nome da sua loja ou empresa?`;

const ONBOARDING_STEPS: { key: keyof OnboardingData; question: (name?: string) => string; placeholder: string }[] = [
  {
    key: "business_name",
    question: () => TAMO_INTRO,
    placeholder: "Ex: Moda da Cris, Atacado da Ana...",
  },
  {
    key: "business_type",
    question: (name) => `${name ? name + ", o" : "O"}brigado! 🔥\n\nO que você vende? Me conta o carro-chefe — o produto que mais sai.`,
    placeholder: "Ex: Vestidos femininos, cosméticos naturais, calçados infantis...",
  },
  {
    key: "products",
    question: () => `Entendido! Agora me conta: você vende mais por onde?\n\nInstagram, WhatsApp, loja física, Shopee, marketplace...`,
    placeholder: "Ex: Instagram e WhatsApp, mando foto no grupo",
  },
  {
    key: "tone",
    question: () => `Última pergunta — qual é o maior desafio do seu negócio hoje?\n\nIsso me ajuda a focar no que realmente importa pra você.`,
    placeholder: "Ex: Atrair mais clientes, fazer fotos bonitas, escrever legenda...",
  },
];

type WorkState = "sem_trabalho" | "trabalhando" | "terminado";

interface Props {
  workState: WorkState;
  resultReady: boolean;
  onViewResult?: () => void;
  onActivate24h?: () => void;
  botActive: boolean;
  visible: boolean; // false = oculto (sem job ativo)
  navMode?: boolean; // true = chat via nav, ocupa mais espaço
  embedded?: boolean; // true = dentro de outro card, sem header próprio com avatar
}

export default function BotChat({ workState, resultReady, onViewResult, onActivate24h, botActive, visible, navMode = false, embedded = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasOnboarding, setHasOnboarding] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [localBotActive, setLocalBotActive] = useState(botActive);

  // Onboarding
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultReadyNotifiedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // Carrega histórico ao montar
  useEffect(() => {
    if (!visible) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadHistory() {
    setInitialLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/bot/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setHasOnboarding(data.hasOnboarding ?? false);
      setBusinessName(data.businessName ?? null);
      setLocalBotActive(data.botActive ?? false);
      scrollToBottom();
    } finally {
      setInitialLoading(false);
    }
  }

  // Scroll ao receber novas mensagens
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Auto-mensagem no chat quando foto fica pronta
  useEffect(() => {
    if (!resultReady) {
      resultReadyNotifiedRef.current = false;
      return;
    }
    if (initialLoading || resultReadyNotifiedRef.current) return;
    resultReadyNotifiedRef.current = true;
    setMessages(prev => [...prev, {
      role: "assistant" as const,
      content: "🦎 *Ficou incrível!* Terminei sua foto aqui.\n\nClica aí embaixo pra ver como ficou!",
    }]);
  }, [resultReady, initialLoading]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    const optimistic: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, optimistic]);
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexão. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboardingStep(answer: string) {
    const step = ONBOARDING_STEPS[onboardingStep];
    const updated = { ...onboardingData, [step.key]: answer };
    setOnboardingData(updated);

    // Adiciona a resposta do usuário no chat
    setMessages((prev) => [...prev, { role: "user", content: answer }]);

    const isLast = onboardingStep === ONBOARDING_STEPS.length - 1;

    if (!isLast) {
      const next = ONBOARDING_STEPS[onboardingStep + 1];
      setOnboardingStep((s) => s + 1);
      // Resposta do bot com próxima pergunta
      setTimeout(() => {
        // Passa o nome do negócio para personalizar a pergunta
        const bname = (updated as Partial<OnboardingData>).business_name ?? businessName ?? undefined;
        setMessages((prev) => [...prev, { role: "assistant", content: next.question(bname) }]);
      }, 300);
    } else {
      // Último passo — salva onboarding
      setOnboardingLoading(true);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Perfeito! Deixa eu processar isso... ✨" },
      ]);
      try {
        const token = await getToken();
        const res = await fetch("/api/bot/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(updated),
        });
        const data = await res.json();
        if (data.success) {
          setHasOnboarding(true);
          setBusinessName((updated as OnboardingData).business_name);
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Arrasou, ${(updated as OnboardingData).business_name}! 🦎🔥 Agora conheço seu negócio.\n\nPode me chamar pra qualquer coisa — legenda, promoção, texto de produto, dicas de foto... Tô aqui. O que precisa primeiro?`,
              },
            ]);
          }, 600);
        }
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao salvar. Tente novamente." }]);
      } finally {
        setOnboardingLoading(false);
      }
    }
  }

  async function handleActivate() {
    try {
      const token = await getToken();
      await fetch("/api/bot/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: true }),
      });
      setLocalBotActive(true);
      onActivate24h?.();
    } catch { /* silencioso */ }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const isOnboarding = !hasOnboarding;
  const currentStep = ONBOARDING_STEPS[onboardingStep];

  if (!visible) return null;

  return (
    <div style={{ ...s.root, ...(navMode ? { flex: 1 } : {}), ...(embedded ? { marginTop: 0, borderRadius: 0, border: "none", boxShadow: "none", borderTop: "1px solid rgba(255,255,255,0.06)" } : {}) }}>
      <style>{`
        @keyframes botTyping {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes botPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(168,85,247,0); }
        }
        @keyframes botSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes resultPulse {
          0% { box-shadow: 0 0 0 0 rgba(168,85,247,0.6), 0 4px 20px rgba(168,85,247,0.3); transform: scale(1); }
          60% { box-shadow: 0 0 0 12px rgba(168,85,247,0), 0 4px 20px rgba(168,85,247,0.3); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(168,85,247,0), 0 4px 20px rgba(168,85,247,0.3); transform: scale(1); }
        }
        .bot-msg { animation: botSlideUp 0.2s ease; }
        .bot-input:focus { outline: none; border-color: rgba(168,85,247,0.5) !important; box-shadow: 0 0 0 3px rgba(168,85,247,0.12); }
        .bot-send:hover { background: rgba(168,85,247,0.35) !important; }
        .bot-activate:hover { opacity: 0.85; }
        .result-btn { animation: resultPulse 2s ease-in-out infinite; }
      `}</style>

      {/* Header — sem avatar quando embedded (já tem mascot acima) */}
      <div style={s.header}>
        {!embedded && (
          <img
            src="/tamo/idle.png"
            alt="Tamo"
            style={{ width: 40, height: 40, objectFit: "contain", objectPosition: "bottom", flexShrink: 0 }}
          />
        )}
        <div>
          <div style={s.headerTitle}>
            Tamo{businessName ? ` · ${businessName}` : ""}
          </div>
          <div style={s.headerSub}>
            {isOnboarding
              ? `Passo ${onboardingStep + 1} de ${ONBOARDING_STEPS.length}`
              : workState === "trabalhando"
              ? "Converse enquanto sua foto é criada ✨"
              : "Seu parceiro de negócios"}
          </div>
        </div>
      </div>

      {/* Área de mensagens */}
      <div style={{ ...s.messages, ...(navMode ? { flex: 1, maxHeight: "none" } : {}) }} id="bot-messages-area">
        {initialLoading ? (
          <div style={s.loadingWrap}>
            <TypingDots />
          </div>
        ) : (
          <>
            {/* Mensagem inicial de onboarding */}
            {isOnboarding && messages.length === 0 && (
              <BotMessage content={ONBOARDING_STEPS[0].question()} />
            )}

            {messages.map((m, i) => (
              m.role === "assistant"
                ? <BotMessage key={i} content={m.content} />
                : <UserMessage key={i} content={m.content} />
            ))}

            {loading && (
              <div style={{ ...s.botBubble, paddingTop: 12, paddingBottom: 12 }}>
                <TypingDots />
              </div>
            )}
          </>
        )}
        {/* Botão Ver Resultado — aparece no chat quando foto fica pronta */}
        {resultReady && onViewResult && (
          <div style={{ padding: "4px 0 8px" }}>
            <button onClick={onViewResult} className="result-btn" style={s.resultBtn}>
              ✨ Ver Resultado
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões rápidas (quando tem onboarding e não está loading) */}
      {hasOnboarding && !loading && messages.length > 0 && messages.length < 3 && (
        <div style={s.suggestions}>
          {["✍️ Escreve uma legenda", "💡 Ideias de promoção", "📸 Dicas de foto"].map((s2) => (
            <button key={s2} onClick={() => handleSend(s2)} style={s.suggestionBtn}>
              {s2}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={s.inputRow}>
        <input
          ref={inputRef}
          className="bot-input"
          style={s.input}
          placeholder={
            isOnboarding
              ? currentStep.placeholder
              : "Pergunte qualquer coisa..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || onboardingLoading}
          autoComplete="off"
        />
        <button
          className="bot-send"
          style={{
            ...s.sendBtn,
            opacity: (!input.trim() || loading) ? 0.4 : 1,
          }}
          onClick={() => {
            if (isOnboarding && input.trim()) {
              handleOnboardingStep(input.trim());
              setInput("");
            } else {
              handleSend();
            }
          }}
          disabled={!input.trim() || loading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (/^\*[^*\n]+\*$/.test(part)) {
      return <strong key={i} style={{ fontWeight: 700, color: "#eef2f9" }}>{part.slice(1, -1)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function BotMessage({ content }: { content: string }) {
  return (
    <div className="bot-msg" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
      <img
        src="/tamo/receiving.png"
        alt="Tamo"
        style={{ width: 28, height: 28, objectFit: "contain", objectPosition: "bottom", flexShrink: 0, marginTop: 2 }}
      />
      <div style={{
        background: "#151d2a",
        border: "1px solid rgba(168,85,247,0.12)",
        borderRadius: "4px 16px 16px 16px",
        padding: "10px 14px",
        fontSize: 13.5, color: "#dde4f0", lineHeight: 1.55,
        maxWidth: "85%", whiteSpace: "pre-line",
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
      }}>
        {parseBold(content)}
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="bot-msg" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(168,85,247,0.35))",
        border: "1px solid rgba(168,85,247,0.25)",
        borderRadius: "16px 4px 16px 16px",
        padding: "10px 14px",
        fontSize: 13.5, color: "#eef2f9", lineHeight: 1.55,
        maxWidth: "82%", whiteSpace: "pre-line",
      }}>
        {content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "rgba(168,85,247,0.7)",
          animation: `botTyping 1.2s ease-in-out infinite`,
          animationDelay: `${delay}s`,
        }} />
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    background: "#0c1018",
    border: "1px solid rgba(168,85,247,0.15)",
    borderRadius: 20,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    marginTop: 12,
    boxShadow: "0 0 40px rgba(99,102,241,0.08), 0 2px 20px rgba(0,0,0,0.3)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    background: "linear-gradient(90deg, rgba(99,102,241,0.06), transparent)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    flexShrink: 0,
    animation: "botPulse 3s ease-in-out infinite",
    boxShadow: "0 0 12px rgba(168,85,247,0.3)",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#eef2f9",
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: 11,
    color: "#8394b0",
    marginTop: 1,
  },
  resultBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
    border: "none",
    borderRadius: 12,
    padding: "13px 0",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
  },
  messages: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "14px 14px 8px",
    minHeight: 220,
    maxHeight: 340,
    scrollBehavior: "smooth" as const,
  },
  loadingWrap: {
    display: "flex",
    justifyContent: "center",
    padding: "24px 0",
  },
  botBubble: {
    display: "inline-flex",
    background: "#151d2a",
    border: "1px solid rgba(168,85,247,0.12)",
    borderRadius: "4px 16px 16px 16px",
    padding: "8px 14px",
    marginBottom: 10,
  },
  suggestions: {
    display: "flex",
    gap: 6,
    padding: "0 14px 10px",
    flexWrap: "wrap" as const,
  },
  suggestionBtn: {
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 20,
    padding: "6px 12px",
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap" as const,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    padding: "10px 12px 12px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    background: "rgba(0,0,0,0.2)",
  },
  input: {
    flex: 1,
    background: "#111820",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "10px 14px",
    color: "#eef2f9",
    fontSize: 13.5,
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "rgba(168,85,247,0.15)",
    border: "1px solid rgba(168,85,247,0.3)",
    color: "#c4b5fd",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.15s",
  },
};
