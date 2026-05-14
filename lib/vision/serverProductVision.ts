/**
 * serverProductVision.ts
 *
 * Visão de produto server-side via Ollama (A5000 GPU — sem custo de API).
 *
 * Usa moondream (1.9 GB, ~1s no A40) para identificar o produto com precisão,
 * independente do que o usuário digitou.
 *
 * Fluxo:
 *   input_image_url + user_text → Ollama moondream → product_description (EN)
 *
 * Fallback silencioso: se Ollama estiver offline, retorna null
 * e o submit usa o texto do usuário sem enriquecimento.
 */

const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "moondream";
const VISION_TIMEOUT_MS = 15_000;

/**
 * Extrai a descrição do produto da resposta do modelo.
 * Remove frases genéricas, intro do modelo, markdown, etc.
 */
function cleanVisionResponse(raw: string): string {
  let s = raw.trim();

  // Remove markdown básico
  s = s.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/`/g, "");

  // Remove frases de intro comuns do moondream
  s = s
    .replace(/^(The image (shows|depicts|contains|features|presents)|This is|In (the|this) image,?|I can see|Looking at|The product (is|shown|displayed))[,:]?\s*/i, "")
    .replace(/^(Sure[,!]?|Of course[,!]?|Certainly[,!]?)\s+/i, "");

  // Pega só a primeira frase se for muito longa
  const firstSentence = s.match(/^[^.!?]+[.!?]/);
  if (firstSentence && firstSentence[0].length > 20) {
    s = firstSentence[0].trim();
  }

  // Remove trailing punctuation excess
  s = s.replace(/[.!?]+$/, "").trim();

  return s.length >= 5 ? s : raw.trim();
}

/**
 * Analisa a imagem do produto via Ollama vision e retorna descrição em inglês.
 * Retorna null se Ollama estiver indisponível ou falhar.
 */
export async function getProductVisionDescription(
  imageUrl: string,
  userText?: string
): Promise<string | null> {
  const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "";
  if (!OLLAMA_BASE) return null;

  try {
    // Download da imagem
    const imgRes = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!imgRes.ok) return null;

    const imgBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuf).toString("base64");

    // Prompt focado em produto para e-commerce
    // moondream responde melhor com perguntas diretas
    const hasUserText = userText && userText.trim().length > 2;

    // Pede SEMPRE o tipo do produto explicito no inicio da resposta — isso
    // ajuda o Qwen Image Edit depois a manter a peca como o item certo (ex:
    // mochila NAO virar camiseta, vestido NAO virar bolsa, etc).
    // Tambem pede pra LISTAR todos os itens se forem multiplos (kit/conjunto).
    const prompt = hasUserText
      ? `The user says this product is "${userText.trim()}". Look carefully at the image and answer in this exact format: "ITEM_TYPE: <noun, eg. backpack, t-shirt, dress, sneakers, bracelet>. DESCRIPTION: <one sentence describing the product — color, print/pattern, material, style>. ITEMS_COUNT: <number of distinct products visible, eg. 1 or 3 for a set/kit>." Focus on the product, ignore background and people.`
      : `Look at this image and answer in this exact format: "ITEM_TYPE: <noun, eg. backpack, t-shirt, dress, sneakers, bracelet>. DESCRIPTION: <one sentence describing the product — color, print/pattern, material, style>. ITEMS_COUNT: <number of distinct products visible, eg. 1 or 3 for a set/kit>." Focus on the product, ignore background and people.`;

    // moondream no Ollama requer o formato /api/chat com images no message
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: "user", content: prompt, images: [base64] }],
        stream: false,
        options: {
          num_predict: 120,
          temperature: 0.1,
          num_ctx: 1024, // KV cache pequeno — cabe todo na GPU (A5000 com ~4.7GB livre)
        },
      }),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[vision] Ollama respondeu ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const description = cleanVisionResponse(data.message?.content ?? "");

    if (!description || description.length < 4) return null;

    console.log(`[vision] "${userText ?? "(sem texto)"}" → "${description}"`);
    return description;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    // Não loga timeout como erro — é esperado quando pod estiver carregando
    if (!msg.includes("timeout") && !msg.includes("abort")) {
      console.warn("[vision] erro:", msg);
    }
    return null;
  }
}

/**
 * Mescla o texto do usuário com a descrição da visão.
 */
export function mergeProductTexts(userText: string, visionDescription: string | null): string {
  const u = (userText ?? "").trim();
  const v = (visionDescription ?? "").trim();

  if (!v) return u || "product";
  if (!u) return v;

  const uLower = u.toLowerCase();
  const vLower = v.toLowerCase();
  if (vLower.includes(uLower) || uLower.length <= 3) return v;

  return `${v} (${u})`;
}

/**
 * Extrai o tipo declarado (ITEM_TYPE) e a contagem de itens (ITEMS_COUNT)
 * da resposta estruturada do moondream. Aceita variacoes de formato.
 */
export function parseVisionStructured(visionDesc: string | null): {
  itemType: string | null;
  itemsCount: number | null;
  description: string;
} {
  const v = (visionDesc ?? "").trim();
  if (!v) return { itemType: null, itemsCount: null, description: "" };

  const typeMatch = v.match(/ITEM_TYPE\s*:\s*([^.\n]+?)(?:\.|$|DESCRIPTION)/i);
  const descMatch = v.match(/DESCRIPTION\s*:\s*([^.\n]+(?:\.[^.\n]+)*?)(?:\.\s*ITEMS_COUNT|\.\s*$|$)/i);
  const countMatch = v.match(/ITEMS_COUNT\s*:\s*(\d+)/i);

  const itemType = typeMatch ? typeMatch[1].trim().replace(/\.+$/, "") : null;
  const itemsCount = countMatch ? parseInt(countMatch[1], 10) : null;
  const description = descMatch ? descMatch[1].trim() : v;

  return { itemType, itemsCount, description };
}
