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

const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "";
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

    const prompt = hasUserText
      ? `The user says this product is "${userText.trim()}". Confirm or correct this and describe the product accurately in one sentence: what type of product, color, material or texture, and style. Focus only on the product, ignore background and people.`
      : `Describe this product in one sentence for e-commerce: what type of product, color, material or texture, and style. Focus only on the product, ignore background, people, and props.`;

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
 * Resultado: prompt mais rico para o buildPromptResult.
 *
 * Exemplos:
 *   user: "vestdo" + vision: "blue floral midi dress" → "blue floral midi dress"
 *   user: "calça jeans" + vision: "dark blue slim fit jeans" → "dark blue slim fit jeans (calça jeans)"
 *   user: "" + vision: "white leather sneakers" → "white leather sneakers"
 *   user: "tênis" + vision: null → "tênis" (fallback para texto do usuário)
 */
export function mergeProductTexts(userText: string, visionDescription: string | null): string {
  const u = (userText ?? "").trim();
  const v = (visionDescription ?? "").trim();

  if (!v) return u || "product"; // sem visão → usa o do usuário ou fallback
  if (!u) return v;              // sem texto do usuário → usa visão pura

  // Se o texto do usuário está contido na visão (confirmado), usa visão
  const uLower = u.toLowerCase();
  const vLower = v.toLowerCase();
  if (vLower.includes(uLower) || uLower.length <= 3) return v;

  // Se são bem diferentes, anota o texto original como hint de contexto
  // para o buildPromptResult não perder inferências de categoria PT/ES
  return `${v} (${u})`;
}
