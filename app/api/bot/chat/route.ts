import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getToken(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "");
}

const SYSTEM_BASE = `Você é o assistente pessoal de negócios do TamoWork. Você ajuda empreendedores a vender mais, criar melhores fotos de produto, escrever legendas, pensar em promoções e melhorar sua presença online.

Regras:
- Seja direto, amigável e prático. Sem enrolação.
- Respostas curtas (máx 3 parágrafos) a menos que o usuário peça mais detalhes.
- Foque sempre no negócio do usuário — use o contexto que você tem sobre ele.
- Se não souber algo específico do negócio, pergunte.
- Nunca invente dados ou métricas.
- Quando sugerir uma legenda ou texto, forneça versões prontas para copiar.`;

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser(getToken(req));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { message } = body;
  if (!message?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  // Carrega onboarding + memória em paralelo
  const [onboardingRes, memoryRes, historyRes] = await Promise.all([
    supabaseAdmin.from("bot_onboarding").select("context").eq("user_id", user.id).single(),
    supabaseAdmin.from("bot_memory").select("summary").eq("user_id", user.id).single(),
    supabaseAdmin
      .from("bot_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const businessContext = onboardingRes.data?.context ?? null;
  const memory = memoryRes.data?.summary ?? "";
  const recentMessages = (historyRes.data ?? []).reverse();

  // Monta system prompt
  let systemPrompt = SYSTEM_BASE;
  if (businessContext) {
    systemPrompt += `\n\nCONTEXTO DO NEGÓCIO:\n${businessContext}`;
  }
  if (memory) {
    systemPrompt += `\n\nMEMÓRIA ACUMULADA (aprendizados das conversas anteriores):\n${memory}`;
  }

  // Salva mensagem do usuário
  await supabaseAdmin.from("bot_messages").insert({
    user_id: user.id,
    role: "user",
    content: message.trim(),
  });

  // Chama Ollama (RunPod A40)
  const reply = await callOllama(systemPrompt, recentMessages, message.trim());

  // Salva resposta do assistente
  await supabaseAdmin.from("bot_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: reply,
  });

  return NextResponse.json({ reply, needsOnboarding: !businessContext });
}

async function callOllama(
  systemPrompt: string,
  history: { role: string; content: string }[],
  newMessage: string
) {
  const ollamaBase = process.env.OLLAMA_BASE;
  if (!ollamaBase) return "Assistente temporariamente indisponível. Tente novamente em instantes.";

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: newMessage },
  ];

  try {
    const res = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages,
        stream: false,
        options: { num_predict: 600, temperature: 0.7 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = await res.json();
    return json.message?.content ?? "Não consegui responder agora. Tente novamente.";
  } catch {
    return "Erro de conexão com o assistente. Tente novamente em instantes.";
  }
}
