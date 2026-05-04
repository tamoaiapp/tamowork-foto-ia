import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePromptWithOllama } from "@/lib/promptuso/ollamaPrompt";
import { getUserContext } from "@/lib/promptuso/userContext";
import { generatePromptV2 } from "@/lib/promptuso/multiagent";

export const maxDuration = 60;

/**
 * Traduz texto para inglês via MyMemory (gratuito, sem API key).
 * Usa autodetect de idioma — funciona com PT, ES, e qualquer outro.
 * Se o texto já estiver em inglês ou a chamada falhar, retorna o original.
 */
async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim().length < 3) return text;

  // Heurística rápida: se não tem letras fora do ASCII básico e não tem
  // palavras claramente PT/ES, provavelmente já é inglês — pula a chamada
  const looksLikeEnglish =
    !/[àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ]/i.test(text) &&
    !/\b(vestido|camiseta|calça|camisa|blusa|sapato|bolsa|rua|cidade|cenário|fundo|branco|preto|vermelho|azul|verde|amarelo|estilo|elegante|simples|moderno|feminino|masculino|conjunto|roupa|moda|loja|mercado|produto|vestir|usar|foto|imagem|cenario|ropa|vestido|camisa|zapato|bolso|calle|ciudad|fondo|blanco|negro|rojo|azul|verde|amarillo|estilo|elegante|simple|moderno|tienda|producto|usar|foto|imagen)\b/i.test(text);

  if (looksLikeEnglish) return text;

  try {
    const encoded = encodeURIComponent(text.slice(0, 400));
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encoded}&langpair=autodetect|en`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return text;
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText ?? "";
    // MyMemory retorna "PLEASE SELECT TWO DISTINCT LANGUAGES" se já for inglês
    if (!translated || translated.startsWith("PLEASE SELECT")) return text;
    return translated;
  } catch {
    return text; // timeout ou erro de rede — usa o original
  }
}


async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return null;
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await sb.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const produtoRaw =
      body?.produto ??
      body?.produto_frase ??
      body?.product ??
      body?.name ??
      "";

    const cenarioRaw =
      body?.cenario ??
      body?.scenario ??
      body?.scene ??
      body?.contexto ??
      "";

    // vision_desc: leitura visual da foto feita por IA (Moondream) — já em inglês
    // Quando presente, é a fonte primária de verdade sobre o produto no prompt
    const visionDescRaw: string = body?.vision_desc ?? body?.vision ?? "";

    // user_feedback: feedback textual do usuário sobre a foto anterior (para refine)
    const userFeedbackRaw: string = body?.user_feedback ?? body?.feedback ?? "";

    if (!produtoRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing produto/produto_frase/product" },
        { status: 400 }
      );
    }

    // Traduz produto e cenário para inglês (se estiverem em PT/ES)
    // Se cenário vazio, gera cena padrão baseada no tipo de produto (autoScene)
    const [produtoEN, cenarioRaw_translated] = await Promise.all([
      translateToEnglish(String(produtoRaw)),
      cenarioRaw ? translateToEnglish(String(cenarioRaw)) : Promise.resolve(""),
    ]);

    const cenarioEN = cenarioRaw_translated || "";

    const visionDesc = visionDescRaw ? String(visionDescRaw).trim() : undefined;

    // Busca contexto personalizado do usuário (estilo + correções de produto)
    const userId = await getUserId(req);
    const userContext = userId
      ? await getUserContext(userId, produtoEN, cenarioEN).catch(() => undefined)
      : undefined;

    if (userContext?.productCorrection) {
      console.log("[prompt] correção de âncora aplicada:", userContext.productCorrection.slice(0, 60));
    }
    if (userContext?.style) {
      console.log("[prompt] estilo do usuário aplicado:", JSON.stringify(userContext.style).slice(0, 80));
    }

    // Testa conectividade com Ollama antes de chamar generatePromptWithOllama
    const ollamaBase = process.env.OLLAMA_BASE ?? "";
    let ollamaConnError: string | null = null;
    if (ollamaBase) {
      try {
        const pingRes = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(5000) });
        console.log("[prompt] ollama ping:", pingRes.status);
      } catch (pe) {
        ollamaConnError = String((pe as Error).message);
        console.warn("[prompt] ollama ping falhou:", ollamaConnError);
      }
    }

    // Tenta gerar via Ollama (qwen2.5:7b local no A40) — se falhar usa regras
    let ollamaError: string | null = null;
    let ollamaResult = null;
    try {
      ollamaResult = await generatePromptWithOllama(produtoEN, cenarioEN, visionDesc, userContext);
    } catch (err) {
      ollamaError = String((err as Error)?.message ?? err);
      console.warn("[prompt] ollama exception:", ollamaError);
    }

    if (ollamaResult) {
      console.log("[prompt] gerado via Ollama qwen2.5:7b");
      return NextResponse.json({
        ok: true,
        positive: ollamaResult.positive_prompt,
        negative: ollamaResult.negative_prompt,
        source: "ollama",
      });
    }

    // Fallback: motor multiagente V2 (Ollama offline)
    console.log("[prompt] fallback para motor multiagente V2 (Ollama offline). ollama_error:", ollamaError ?? "null returned");
    const v2 = generatePromptV2({
      product_name: produtoEN,
      scene_request: cenarioEN || undefined,
      vision_description: visionDesc,
      user_feedback: userFeedbackRaw || undefined,
    });

    return NextResponse.json({
      ok: true,
      positive: v2.positive_prompt,
      negative: v2.negative_prompt,
      meta: v2.meta,
      source: "multiagent_v2",
      _debug_ollama: ollamaError ?? "returned_null",
      _debug_conn: ollamaConnError ?? "ping_ok",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const ollamaBase = process.env.OLLAMA_BASE ?? "";
  return NextResponse.json({
    ok: true,
    service: "tamo-ai-brain-v7-product-scenario",
    info: "POST /api/prompt com { produto_frase, cenario }",
    ollama_configured: !!ollamaBase,
    ollama_host: ollamaBase ? ollamaBase.replace(/^https?:\/\//, "").split("/")[0] : null,
  });
}
