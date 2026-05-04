/**
 * serverProductVision.ts
 *
 * Analisa a imagem do produto e retorna descrição em inglês.
 *
 * Ordem de tentativa:
 *   1. Claude Haiku (Anthropic API) — sempre disponível se ANTHROPIC_API_KEY set
 *   2. Ollama moondream (pod local) — fallback se OLLAMA_BASE set
 *   3. null — usa texto digitado pelo usuário
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "";
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "moondream";
const VISION_TIMEOUT_MS = 20_000;

/**
 * Remove frases genéricas de intro do modelo, markdown, etc.
 */
function cleanVisionResponse(raw: string): string {
  let s = raw.trim();

  s = s.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/`/g, "");

  s = s
    .replace(/^(The image (shows|depicts|contains|features|presents)|This is|In (the|this) image,?|I can see|Looking at|The product (is|shown|displayed))[,:]?\s*/i, "")
    .replace(/^(Sure[,!]?|Of course[,!]?|Certainly[,!]?)\s+/i, "");

  const firstSentence = s.match(/^[^.!?]+[.!?]/);
  if (firstSentence && firstSentence[0].length > 20) {
    s = firstSentence[0].trim();
  }

  s = s.replace(/[.!?]+$/, "").trim();

  return s.length >= 5 ? s : raw.trim();
}

/**
 * Visão via Claude Haiku (Anthropic API).
 * Envia a imagem em base64 e retorna descrição do produto em inglês.
 */
async function getVisionViaClaude(
  imageUrl: string,
  userText?: string
): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;

  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imgRes.ok) return null;

    const imgBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuf).toString("base64");

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
      contentType.includes("png") ? "image/png"
      : contentType.includes("webp") ? "image/webp"
      : contentType.includes("gif") ? "image/gif"
      : "image/jpeg";

    const hasUserText = userText && userText.trim().length > 2;
    const prompt = hasUserText
      ? `The user says this product is "${userText.trim()}". Confirm or correct this and describe the product accurately in one sentence: what type of product, color, material or texture, and style. Focus only on the product, ignore background and people.`
      : `Describe this product in one sentence for e-commerce: what type of product, color, material or texture, and style. Focus only on the product, ignore background, people, and props.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[vision:claude] status ${res.status}`);
      return null;
    }

    const data = await res.json() as { content?: { type: string; text?: string }[] };
    const description = cleanVisionResponse(data.content?.[0]?.text ?? "");
    if (!description || description.length < 4) return null;

    console.log(`[vision:claude] "${userText ?? "(sem texto)"}" → "${description}"`);
    return description;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (!msg.includes("timeout") && !msg.includes("abort")) {
      console.warn("[vision:claude] erro:", msg);
    }
    return null;
  }
}

/**
 * Visão via Ollama moondream (pod local).
 */
async function getVisionViaOllama(
  imageUrl: string,
  userText?: string
): Promise<string | null> {
  if (!OLLAMA_BASE) return null;

  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imgRes.ok) return null;

    const imgBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuf).toString("base64");

    const hasUserText = userText && userText.trim().length > 2;
    const prompt = hasUserText
      ? `The user says this product is "${userText.trim()}". Confirm or correct this and describe the product accurately in one sentence: what type of product, color, material or texture, and style. Focus only on the product, ignore background and people.`
      : `Describe this product in one sentence for e-commerce: what type of product, color, material or texture, and style. Focus only on the product, ignore background, people, and props.`;

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: "user", content: prompt, images: [base64] }],
        stream: false,
        options: { num_predict: 120, temperature: 0.1, num_ctx: 1024 },
      }),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[vision:ollama] status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const description = cleanVisionResponse(data.message?.content ?? "");
    if (!description || description.length < 4) return null;

    console.log(`[vision:ollama] "${userText ?? "(sem texto)"}" → "${description}"`);
    return description;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (!msg.includes("timeout") && !msg.includes("abort")) {
      console.warn("[vision:ollama] erro:", msg);
    }
    return null;
  }
}

/**
 * Analisa a imagem do produto via IA e retorna descrição em inglês.
 * Tenta Claude primeiro, depois Ollama, retorna null se ambos falharem.
 */
export async function getProductVisionDescription(
  imageUrl: string,
  userText?: string
): Promise<string | null> {
  // 1. Claude (Anthropic API) — primário
  const claudeResult = await getVisionViaClaude(imageUrl, userText);
  if (claudeResult) return claudeResult;

  // 2. Ollama moondream — fallback local
  const ollamaResult = await getVisionViaOllama(imageUrl, userText);
  if (ollamaResult) return ollamaResult;

  return null;
}

/**
 * Mescla o texto do usuário com a descrição da visão.
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

  if (!v) return u || "product";
  if (!u) return v;

  const uLower = u.toLowerCase();
  const vLower = v.toLowerCase();
  if (vLower.includes(uLower) || uLower.length <= 3) return v;

  return `${v} (${u})`;
}
