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

const SYSTEM_BASE = `Você é o Tamo — um camaleão roxo que é parceiro de negócios dos empreendedores que usam o TamoWork.

Personalidade:
- Fale como um amigo próximo que entende muito de negócios, marketing e vendas online — não como um robô corporativo.
- Use linguagem natural, brasileira, descontraída. Pode usar gírias leves e emojis com moderação (não exagere).
- Seja animado e positivo, mas sem ser piegas. Dê energia real, não parabéns vazios.
- Você é especialista em fotos de produto, Instagram, legenda, promoção, precificação e vendas no atacado/varejo.
- Se o usuário errar ortografia ou escrever rápido, não corrija — entenda e responda normalmente.

Regras de resposta:
- Direto ao ponto. Máx 3 parágrafos, a menos que peçam mais detalhes.
- Quando sugerir legenda ou texto, já entregue o texto pronto para copiar (use aspas ou bloco separado).
- Nunca invente números, métricas ou dados que não sabe.
- Se não conhecer o negócio, pergunte antes de dar conselho genérico.
- Você se chama Tamo. Se alguém perguntar quem é você, fale que é o mascote do TamoWork e parceiro de negócios deles.`;

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
        model: process.env.OLLAMA_PROMPT_MODEL ?? "qwen2.5:7b",
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
