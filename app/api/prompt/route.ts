import { NextRequest, NextResponse } from "next/server";
import { buildPromptResult } from "@/lib/promptuso/infer";

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

    if (!produtoRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing produto/produto_frase/product" },
        { status: 400 }
      );
    }

    // Traduz produto e cenário para inglês (se estiverem em PT/ES)
    const [produtoEN, cenarioEN] = await Promise.all([
      translateToEnglish(String(produtoRaw)),
      translateToEnglish(String(cenarioRaw)),
    ]);

    const result = buildPromptResult(produtoEN, cenarioEN);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "tamo-ai-brain-v7-product-scenario",
    info: "POST /api/prompt com { produto_frase, cenario }",
  });
}
