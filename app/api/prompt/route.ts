import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPromptResult, inferSlot } from "@/lib/promptuso/infer";
import { generatePromptWithOllama } from "@/lib/promptuso/ollamaPrompt";
import { getUserContext } from "@/lib/promptuso/userContext";

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

/** Cena padrão por tipo de slot — usada quando o usuário não enviou cenário */
function autoScene(slot: string): string {
  const scenes: Record<string, string> = {
    wear_head_top:    "lifestyle portrait, natural outdoor lighting",
    wear_head_face:   "lifestyle portrait, soft neutral background",
    wear_head_ear:    "close-up portrait, soft bokeh background",
    wear_neck:        "lifestyle portrait, soft neutral background",
    wear_torso_upper: "lifestyle environment, natural light",
    wear_torso_full:  "lifestyle environment, natural light, full body shot",
    wear_waist_legs:  "lifestyle environment, street or studio",
    wear_feet:        "walking or street scene, ground-level shot",
    wear_wrist:       "close-up lifestyle, neutral background",
    wear_finger:      "close-up of hand, elegant neutral background",
    wear_back:        "lifestyle environment, person facing away or to the side",
    wear_crossbody:   "lifestyle street environment",
    hold_device:      "modern lifestyle setting, person using device naturally",
    hold_bag_hand:    "lifestyle scene, street or cafe",
    hold_tool_safe:   "workshop or home environment, tool in use",
    hold_food_display:"clean kitchen or cafe countertop",
    hold_sport_object:"sports environment, outdoors",
    hold_beauty_product: "premium vanity or bathroom counter, elegant lighting",
    hold_beverage:    "lifestyle setting, product held naturally",
    hold_flower:      "natural light, outdoor or indoor lifestyle",
    scene_tabletop:   "clean commercial tabletop, neutral background",
    scene_home_indoor:"modern living room or home interior",
    scene_floor:      "modern living room floor, clean environment",
    scene_wall:       "clean interior wall, modern home",
    scene_outdoor_ground: "outdoor natural environment, daylight",
    scene_water_surface:  "pool or beach, bright daylight",
    scene_sport_environment: "sports ground or gym, dynamic environment",
    scene_store_shelf:"retail store shelf, clean display",
    install_home_fixture:    "modern bathroom or home interior",
    install_vehicle_fixture: "clean car dashboard or engine bay",
    install_wall_fixed:      "clean interior wall, modern home",
  };
  return scenes[slot] ?? "clean commercial background, professional studio lighting";
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

    const cenarioEN = cenarioRaw_translated || autoScene(inferSlot(produtoEN));

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

    // Tenta gerar via Ollama (qwen2.5:7b local no A40) — se falhar usa regras
    const ollamaResult = await generatePromptWithOllama(produtoEN, cenarioEN, visionDesc, userContext);

    if (ollamaResult) {
      console.log("[prompt] gerado via Ollama qwen2.5:7b");
      return NextResponse.json({
        ok: true,
        positive: ollamaResult.positive_prompt,
        negative: ollamaResult.negative_prompt,
        source: "ollama",
      });
    }

    // Fallback: regras determinísticas locais
    console.log("[prompt] fallback para regras locais (Ollama offline)");
    const result = buildPromptResult(produtoEN, cenarioEN, visionDesc);

    return NextResponse.json({ ok: true, ...result, source: "rules" });
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
