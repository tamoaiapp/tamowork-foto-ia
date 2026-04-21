import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

function getToken(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "");
}

const SYSTEM_BASE = `Voce e o Tamo, assistente do TamoWork.

O QUE E O TAMOWORK (leia com atencao — nunca invente outra definicao):
O TamoWork e um app web que transforma fotos comuns de produtos em fotos profissionais usando IA.
O usuario tira uma foto qualquer do produto dele (roupa, bijuteria, calçado, etc.), faz upload no app,
e em segundos o TamoWork gera uma foto profissional com fundo limpo, cenario bonito e ate video animado.
E usado por lojistas, revendedoras e empreendedores para vender mais no Instagram e WhatsApp sem precisar
de fotografo, estudio ou edicao manual. Nada de automatizar tarefas administrativas ou gestao de fluxo
de trabalho — isso nao e o TamoWork. O TamoWork e sobre FOTOS e VIDEOS DE PRODUTO.

Personalidade:
- Fale como um amigo proximo que entende de negocio, marketing e vendas online.
- Use linguagem natural, brasileira e direta.
- Seja positivo sem parecer robo corporativo.
- Voce entende de fotos de produto, Instagram, promocao, precificacao e venda online.

Regras de resposta:
- Seja direto ao ponto.
- Maximo de 3 paragrafos, a menos que a pessoa peca mais detalhes.
- Quando sugerir legenda ou texto, entregue pronto para usar.
- Nunca responda em JSON, YAML, XML ou formato tecnico.
- Responda sempre em portugues do Brasil.
- Nunca invente metricas ou dados que voce nao sabe.
- Se faltar contexto do negocio, pergunte antes de dar conselho generico.`;

function stripCodeFences(text: string): string {
  return text.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "").trim();
}

function looksLikeStructuredPayload(text: string): boolean {
  const trimmed = stripCodeFences(text.trim());
  if (!trimmed) return false;

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return true;
  }

  const structuredMarkers = [
    '"branding_elements"',
    '"aspect_ratio"',
    '"font_size"',
    '"position"',
    '"headline"',
    '"tagline"',
    '"cta"',
    '"logo"',
    '"width"',
    '"height"',
    '": {',
    '": [',
  ];

  const markerHits = structuredMarkers.filter((marker) => trimmed.includes(marker)).length;
  const quoteCount = (trimmed.match(/"/g) ?? []).length;
  const braceCount = (trimmed.match(/[{}[\]]/g) ?? []).length;

  return markerHits >= 2 || (quoteCount >= 8 && braceCount >= 4);
}

function normalizeAssistantReply(text: string): string {
  const cleaned = stripCodeFences(text).trim();
  if (!cleaned) {
    return "Nao consegui responder agora. Me manda de novo em uma frase curta que eu te ajudo.";
  }

  if (looksLikeStructuredPayload(cleaned)) {
    return "Montei uma resposta tecnica aqui por engano. Me pergunta de novo que eu respondo em texto normal.";
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(getToken(req));

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const { data: onboardingData } = await supabaseAdmin
    .from("bot_onboarding")
    .select("context")
    .eq("user_id", user.id)
    .single();

  const businessContext = onboardingData?.context ?? null;
  if (!businessContext) {
    return NextResponse.json(
      {
        error: "onboarding_required",
        needsOnboarding: true,
      },
      { status: 409 }
    );
  }

  const [memoryRes, historyRes] = await Promise.all([
    supabaseAdmin.from("bot_memory").select("summary").eq("user_id", user.id).single(),
    supabaseAdmin
      .from("bot_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const memory = memoryRes.data?.summary ?? "";
  const recentMessages = (historyRes.data ?? []).reverse();

  let systemPrompt = SYSTEM_BASE;
  systemPrompt += `\n\nCONTEXTO DO NEGOCIO DO USUARIO (use isso para criar legendas, ofertas e textos PARA O NEGOCIO DELE, nao sobre o TamoWork):\n${businessContext}`;
  if (memory) {
    systemPrompt += `\n\nMEMORIA ACUMULADA:\n${memory}`;
  }

  await supabaseAdmin.from("bot_messages").insert({
    user_id: user.id,
    role: "user",
    content: message,
  });

  const reply = await callOllama(systemPrompt, recentMessages, message);

  await supabaseAdmin.from("bot_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: reply,
  });

  return NextResponse.json({ reply, needsOnboarding: false });
}

async function callOllama(
  systemPrompt: string,
  history: { role: string; content: string }[],
  newMessage: string
) {
  const ollamaBase = process.env.OLLAMA_BASE;
  if (!ollamaBase) {
    return "Assistente temporariamente indisponivel. Tente novamente em instantes.";
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    })),
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

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }

    const json = await res.json();
    return normalizeAssistantReply(json.message?.content ?? "");
  } catch {
    return "Erro de conexao com o assistente. Tente novamente em instantes.";
  }
}
