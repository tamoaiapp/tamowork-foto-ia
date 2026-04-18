"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  tone: string; // canal principal + desafio atual
}

const ONBOARDING_INTRO = `Oi! Sou o Tamo, seu parceiro de negocio aqui no TamoWork.

Antes de liberar o chat completo, preciso fechar 4 respostas rapidas sobre o seu negocio.

Vamos pela ordem certa.

1/4. Qual e o nome do seu negocio ou marca?`;

const ONBOARDING_STEPS: { key: keyof OnboardingData; question: (name?: string) => string; placeholder: string }[] = [
  {
    key: "business_name",
    question: () => ONBOARDING_INTRO,
    placeholder: "Ex: Loja da Cris, Bela Bolsas, Casa das Pratas...",
  },
  {
    key: "business_type",
    question: (name) => `Perfeito${name ? `, ${name}` : ""}.

2/4. Em que nicho voce atua?

Me explica o tipo do negocio de forma simples.`,
    placeholder: "Ex: moda feminina, semijoias, cosmeticos, decoracao...",
  },
  {
    key: "products",
    question: () => `Boa.

3/4. Quais produtos mais saem ou quais voce mais quer vender agora?`,
    placeholder: "Ex: vestidos longos, conjuntos, bolsas, kits de skincare...",
  },
  {
    key: "tone",
    question: () => `Ultima.

4/4. Hoje voce vende mais por onde e qual e o maior desafio do negocio?

Pode responder tudo na mesma frase.`,
    placeholder: "Ex: vendo pelo Instagram e WhatsApp; meu maior desafio e gerar mais pedidos",
  },
];

type WorkState = "sem_trabalho" | "trabalhando" | "terminado";

export interface ActiveJobInfo {
  type: "photo" | "video" | "narrated" | "long_video";
  productName?: string;
  status: string;
  progress: number;
  onCancel?: () => void;
}

interface Props {
  workState: WorkState;
  onActivate24h?: () => void;
  botActive: boolean;
  visible: boolean;
  navMode?: boolean;
  embedded?: boolean;
  triggerMessage?: string;
  activeJobs?: ActiveJobInfo[];
}

export default function BotChat({
  workState,
  visible,
  navMode = false,
  embedded = false,
  triggerMessage,
  activeJobs = [],
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasOnboarding, setHasOnboarding] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [products, setProducts] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [businessContext, setBusinessContext] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyLoadedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    if (!visible || historyLoadedRef.current) return;
    void loadHistory();
  }, [visible]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const isOnboarding = !hasOnboarding;
  const currentStep = ONBOARDING_STEPS[Math.min(onboardingStep, ONBOARDING_STEPS.length - 1)];
  const inputDisabled = initialLoading || loading || onboardingLoading;

  const memoryItems = [
    businessName ? `Loja: ${businessName}` : null,
    businessType ? `Nicho: ${businessType}` : null,
    products ? `Produtos: ${products}` : null,
    tone ? `Canal e desafio: ${tone}` : null,
  ].filter(Boolean) as string[];

  const contextualActions = isOnboarding
    ? []
    : [
        workState === "trabalhando" ? "Gerar legenda" : null,
        workState === "trabalhando" ? "Criar oferta" : null,
        workState === "trabalhando" ? "Texto para WhatsApp" : null,
        workState === "terminado" ? "Legenda para essa foto" : null,
        workState === "terminado" ? "Criar promocao" : null,
        workState === "terminado" ? "Hashtags" : null,
        workState === "sem_trabalho" ? "Ideias de promocao" : null,
        workState === "sem_trabalho" ? "Dicas de foto" : null,
        workState === "sem_trabalho" ? "Escrever legenda" : null,
      ].filter(Boolean) as string[];

  const statusHint = isOnboarding
    ? activeJobs.length > 0
      ? "Sua criacao pode continuar rodando, mas o chat completo so libera depois que eu terminar esse onboarding."
      : "Assim que eu terminar essas 4 respostas, libero o chat completo para legenda, oferta, texto e estrategia."
    : triggerMessage?.trim() ||
      (workState === "trabalhando"
        ? "Enquanto a criacao roda, eu posso adiantar legenda, oferta e texto de venda."
        : workState === "terminado"
        ? "Sua criacao ja ficou pronta. Se quiser, eu transformo isso em legenda, oferta ou texto de venda."
        : null);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed.session?.access_token ?? "";
  }

  function resetOnboardingFlow(initialMessage?: string) {
    setHasOnboarding(false);
    setBusinessName(null);
    setBusinessType(null);
    setProducts(null);
    setTone(null);
    setBusinessContext(null);
    setOnboardingStep(0);
    setOnboardingData({});
    setMessages(initialMessage ? [{ role: "assistant", content: initialMessage }] : []);
  }

  async function loadHistory() {
    setInitialLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/bot/history", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const onboardingDone = !!data.hasOnboarding;

      setHasOnboarding(onboardingDone);
      setBusinessName(data.businessName ?? null);
      setBusinessType(data.businessType ?? null);
      setProducts(data.products ?? null);
      setTone(data.tone ?? null);
      setBusinessContext(data.context ?? null);
      setOnboardingStep(0);
      setOnboardingData({});
      setMessages(onboardingDone ? (data.messages ?? []) : []);
      historyLoadedRef.current = true;
      scrollToBottom();
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      if (!res.ok && data?.needsOnboarding) {
        resetOnboardingFlow();
        return;
      }

      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexao. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboardingStep(answer: string) {
    const cleanAnswer = answer.trim();
    if (!cleanAnswer || onboardingLoading || !currentStep) return;

    const step = ONBOARDING_STEPS[onboardingStep];
    const updated = { ...onboardingData, [step.key]: cleanAnswer };
    setOnboardingData(updated);
    setMessages((prev) => [...prev, { role: "user", content: cleanAnswer }]);

    const isLastStep = onboardingStep === ONBOARDING_STEPS.length - 1;

    if (!isLastStep) {
      const next = ONBOARDING_STEPS[onboardingStep + 1];
      setOnboardingStep((prev) => prev + 1);
      setTimeout(() => {
        const nextName = (updated as Partial<OnboardingData>).business_name ?? businessName ?? undefined;
        setMessages((prev) => [...prev, { role: "assistant", content: next.question(nextName) }]);
      }, 250);
      return;
    }

    setOnboardingLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "Perfeito. Estou salvando o contexto do seu negocio." }]);

    try {
      const token = await getToken();
      const res = await fetch("/api/bot/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updated),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessages((prev) => [...prev, { role: "assistant", content: data?.error ?? "Nao consegui salvar agora. Tente de novo." }]);
        return;
      }

      setHasOnboarding(true);
      setBusinessName((updated as OnboardingData).business_name);
      setBusinessType((updated as OnboardingData).business_type);
      setProducts((updated as OnboardingData).products);
      setTone((updated as OnboardingData).tone);
      setBusinessContext(data.context ?? null);

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              `Fechado, ${(updated as OnboardingData).business_name}.\n\n` +
              "Agora sim o chat completo esta liberado. Daqui pra frente eu posso te ajudar com legenda, promocao, texto de produto, oferta, anuncios e estrategia.\n\n" +
              "O que voce quer resolver primeiro?",
          },
        ]);
      }, 350);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao salvar. Tente novamente." }]);
    } finally {
      setOnboardingLoading(false);
    }
  }

  function handleSubmitCurrentInput() {
    if (!input.trim()) return;

    if (isOnboarding) {
      void handleOnboardingStep(input);
      setInput("");
      return;
    }

    void handleSend();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitCurrentInput();
    }
  }

  if (!visible) return null;

  return (
    <div
      style={{
        ...s.root,
        ...(navMode ? { flex: 1 } : {}),
        ...(embedded ? { marginTop: 0, borderRadius: 0, border: "none", boxShadow: "none", borderTop: "1px solid rgba(255,255,255,0.06)" } : {}),
      }}
    >
      <style>{`
        @keyframes botTyping {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes botSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bot-msg { animation: botSlideUp 0.2s ease; }
        .bot-input:focus {
          outline: none;
          border-color: rgba(168,85,247,0.5) !important;
          box-shadow: 0 0 0 3px rgba(168,85,247,0.12);
        }
        .bot-send:hover { background: rgba(168,85,247,0.35) !important; }
      `}</style>

      <div style={s.header}>
        {!embedded && (
          <img
            src="/tamo/idle.png"
            alt="Tamo"
            style={{ width: 40, height: 40, objectFit: "contain", objectPosition: "bottom", flexShrink: 0 }}
          />
        )}
        <div>
          <div style={s.headerTitle}>Tamo{businessName ? ` · ${businessName}` : ""}</div>
          <div style={s.headerSub}>
            {isOnboarding
              ? `Onboarding ${Math.min(onboardingStep + 1, ONBOARDING_STEPS.length)} de ${ONBOARDING_STEPS.length}`
              : activeJobs.length > 0
              ? `${activeJobs.length} criacao${activeJobs.length > 1 ? "oes" : ""} em andamento`
              : workState === "trabalhando"
              ? "Converse enquanto sua foto e criada"
              : "Seu parceiro de negocio"}
          </div>
        </div>
      </div>

      {hasOnboarding && memoryItems.length > 0 && (
        <div style={s.memoryWrap}>
          <div style={s.memoryLabel}>Contexto salvo</div>
          <div style={s.memoryList}>
            {memoryItems.map((item) => (
              <span key={item} style={s.memoryPill}>
                {item}
              </span>
            ))}
          </div>
          {businessContext && <div style={s.memoryContext}>{businessContext}</div>}
        </div>
      )}

      {activeJobs.length > 0 && (
        <div style={{ padding: "10px 14px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {activeJobs.map((job, index) => (
            <JobStatusCard key={`${job.type}-${job.productName ?? "job"}-${index}`} job={job} />
          ))}
        </div>
      )}

      {(statusHint || contextualActions.length > 0) && (
        <div style={s.contextPanel}>
          {statusHint && <div style={s.contextHint}>{statusHint}</div>}
          {!isOnboarding && contextualActions.length > 0 && (
            <div style={s.contextActions}>
              {contextualActions.map((action) => (
                <button key={action} onClick={() => void handleSend(action)} style={s.contextBtn}>
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ ...s.messages, ...(navMode ? { flex: 1, maxHeight: "none" } : {}) }}>
        {initialLoading ? (
          <div style={s.loadingWrap}>
            <TypingDots />
          </div>
        ) : (
          <>
            {isOnboarding && messages.length === 0 && <BotMessage content={ONBOARDING_STEPS[0].question()} />}

            {messages.map((message, index) =>
              message.role === "assistant" ? (
                <BotMessage key={`a-${index}`} content={message.content} />
              ) : (
                <UserMessage key={`u-${index}`} content={message.content} />
              )
            )}

            {(loading || onboardingLoading) && (
              <div style={{ ...s.botBubble, paddingTop: 12, paddingBottom: 12 }}>
                <TypingDots />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={s.inputRow}>
        <input
          ref={inputRef}
          className="bot-input"
          style={s.input}
          placeholder={
            initialLoading
              ? "Carregando..."
              : isOnboarding
              ? currentStep.placeholder
              : "Pergunte qualquer coisa..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={inputDisabled}
          autoComplete="off"
        />
        <button
          className="bot-send"
          style={{ ...s.sendBtn, opacity: !input.trim() || inputDisabled ? 0.4 : 1 }}
          onClick={handleSubmitCurrentInput}
          disabled={!input.trim() || inputDisabled}
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
  return parts.map((part, index) => {
    if (/^\*[^*\n]+\*$/.test(part)) {
      return (
        <strong key={index} style={{ fontWeight: 700, color: "#eef2f9" }}>
          {part.slice(1, -1)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
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
      <div
        style={{
          background: "#151d2a",
          border: "1px solid rgba(168,85,247,0.12)",
          borderRadius: "4px 16px 16px 16px",
          padding: "10px 14px",
          fontSize: 13.5,
          color: "#dde4f0",
          lineHeight: 1.55,
          maxWidth: "85%",
          whiteSpace: "pre-line",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        {parseBold(content)}
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="bot-msg" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(168,85,247,0.35))",
          border: "1px solid rgba(168,85,247,0.25)",
          borderRadius: "16px 4px 16px 16px",
          padding: "10px 14px",
          fontSize: 13.5,
          color: "#eef2f9",
          lineHeight: 1.55,
          maxWidth: "82%",
          whiteSpace: "pre-line",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function JobStatusCard({ job }: { job: ActiveJobInfo }) {
  const icons: Record<string, string> = {
    photo: "Foto",
    video: "Video",
    narrated: "Narrado",
    long_video: "Longo",
  };
  const statusLabels: Record<string, string> = {
    queued: "Na fila",
    submitted: "Enviando",
    processing: "Processando",
    done: "Pronto",
    failed: "Falhou",
  };

  const isDone = job.status === "done";
  const isFailed = job.status === "failed";
  const barColor = isDone
    ? "#16c784"
    : isFailed
    ? "#ef4444"
    : job.progress > 80
    ? "linear-gradient(90deg, #6366f1, #22c55e)"
    : "linear-gradient(90deg, #6366f1, #a855f7)";

  return (
    <div
      style={{
        background: "#111820",
        border: `1px solid ${isDone ? "rgba(22,199,132,0.3)" : isFailed ? "rgba(239,68,68,0.3)" : "rgba(168,85,247,0.15)"}`,
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isDone || isFailed ? 0 : 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#dde4f0", lineHeight: 1.2 }}>
              {job.productName ? job.productName : icons[job.type] ?? "Criacao"}
            </div>
            <div style={{ fontSize: 11, color: isDone ? "#16c784" : isFailed ? "#ef4444" : "#8394b0", marginTop: 1 }}>
              {statusLabels[job.status] ?? job.status}
            </div>
          </div>
        </div>
        {!isDone && !isFailed && <span style={{ fontSize: 11, fontWeight: 700, color: "#a855f7" }}>{Math.round(job.progress)}%</span>}
        {isDone && <span style={{ fontSize: 11, color: "#16c784", fontWeight: 700 }}>OK</span>}
        {isFailed && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>ERRO</span>}
      </div>

      {!isDone && !isFailed && (
        <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${job.progress}%`,
              background: barColor,
              borderRadius: 4,
              transition: "width 0.6s ease",
            }}
          />
        </div>
      )}

      {job.onCancel && !isDone && !isFailed && (
        <button
          onClick={job.onCancel}
          style={{
            marginTop: 7,
            background: "transparent",
            border: "none",
            color: "#4e5c72",
            fontSize: 11,
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Cancelar
        </button>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 0.2, 0.4].map((delay, index) => (
        <div
          key={index}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "rgba(168,85,247,0.7)",
            animation: "botTyping 1.2s ease-in-out infinite",
            animationDelay: `${delay}s`,
          }}
        />
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
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 14px 8px",
    minHeight: 220,
    maxHeight: 340,
    scrollBehavior: "smooth",
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
  memoryWrap: {
    padding: "12px 14px 0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  memoryLabel: {
    fontSize: 11,
    color: "#6f7f99",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  memoryList: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  memoryPill: {
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.18)",
    color: "#c7d2fe",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11.5,
    fontWeight: 600,
  },
  memoryContext: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "10px 12px",
    color: "#8ea0bb",
    fontSize: 12,
    lineHeight: 1.55,
  },
  contextPanel: {
    padding: "12px 14px 0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  contextHint: {
    fontSize: 12,
    color: "#9fb0ca",
    lineHeight: 1.5,
  },
  contextActions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  contextBtn: {
    background: "rgba(168,85,247,0.1)",
    border: "1px solid rgba(168,85,247,0.22)",
    borderRadius: 20,
    padding: "7px 12px",
    color: "#ddd6fe",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap",
  },
};
