/**
 * visionRouter.ts — Pipeline novo baseado em visão LLM estruturada.
 *
 * Substitui o classificador por keywords/regex (multiagent.ts) que é
 * frágil (caso "wearing" -> "ring"). Aqui pedimos pro modelo VER a
 * imagem e responder JSON com tipo, contagem de itens, publico-alvo e
 * modo de apresentacao ideal.
 *
 * O JSON resultante alimenta templates curtos e imperativos em
 * templates.ts, que substituem o multiagent.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "";
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "moondream";
const TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL ?? "qwen2.5:7b";
const VISION_TIMEOUT_MS = 18_000;
const TEXT_TIMEOUT_MS = 12_000;

export type ProductType =
  | "clothing_torso"        // camiseta, blusa, cropped, regata, jaqueta
  | "clothing_full"         // vestido, macacao, robe, pijama
  | "clothing_lower"        // calca, short, saia, legging
  | "footwear"              // tenis, sapato, sandalia, bota
  | "jewelry_ring"          // anel, alianca
  | "jewelry_neck"          // colar, gargantilha
  | "jewelry_ear"           // brinco, argola
  | "jewelry_wrist"         // pulseira, relogio
  | "eyewear"               // oculos
  | "hat"                   // bone, chapeu
  | "bag"                   // mochila, bolsa, pochete
  | "accessory_held"        // perfume, cosmetico, flores
  | "product_display"       // kit/conjunto, lancheira+estojo, decoracao
  | "food"                  // comida, bolo, prato
  | "furniture"             // movel, tapete, quadro
  | "toy"                   // brinquedo
  | "unknown";

export type TargetUser = "adult_female" | "adult_male" | "child_girl" | "child_boy" | "unisex" | "no_human";

export interface VisionResult {
  product_type: ProductType;
  description: string;        // descricao curta em ingles (1 frase)
  items_count: number;        // 1 = produto unico; 2+ = kit/conjunto
  target_user: TargetUser;    // quem usa
  age_years?: number;         // se for crianca, idade aproximada
  scene_en?: string;          // cena enriquecida em ingles (do user)
}

/**
 * UMA chamada moondream que retorna classificacao + descricao + cena
 * em ingles enriquecida (se user passou cena). Evita 2 chamadas Ollama
 * (que forcariam swap de modelo na VRAM).
 */
export async function classifyVision(imageUrl: string, userText: string, userScene?: string): Promise<VisionResult | null> {
  if (!OLLAMA_BASE) return null;
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imgRes.ok) return null;
    const imgBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuf).toString("base64");

    const userHint = userText && userText.trim().length > 1 ? `User: ${userText.trim()}. ` : "";
    const sceneHint = userScene && userScene.trim().length > 1 ? `Scene wanted: ${userScene.trim()}. ` : "";
    // Prompt CURTO pra caber no Ollama do pod (VRAM apertada com ComfyUI).
    const prompt = `${userHint}${sceneHint}Output exactly these 6 lines:
TYPE: <clothing_torso|clothing_full|clothing_lower|footwear|jewelry_ring|jewelry_neck|jewelry_ear|jewelry_wrist|eyewear|hat|bag|accessory_held|product_display|food|furniture|toy>
DESCRIPTION: <product in English, one line>
COUNT: <number>
USER: <adult_female|adult_male|child_girl|child_boy|unisex|no_human>
AGE: <number or empty>
SCENE: <scene in English, one line>`;

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: "user", content: prompt, images: [base64] }],
        stream: false,
        options: { num_predict: 180, temperature: 0.2, num_ctx: 1024 },
        keep_alive: "10m",
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = (data.message?.content ?? "").trim();
    return parseVisionResult(raw);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (!msg.includes("timeout") && !msg.includes("abort")) {
      console.warn("[visionRouter] erro:", msg);
    }
    return null;
  }
}

const VALID_TYPES: ProductType[] = [
  "clothing_torso", "clothing_full", "clothing_lower", "footwear",
  "jewelry_ring", "jewelry_neck", "jewelry_ear", "jewelry_wrist",
  "eyewear", "hat", "bag", "accessory_held", "product_display",
  "food", "furniture", "toy",
];

const VALID_USERS: TargetUser[] = [
  "adult_female", "adult_male", "child_girl", "child_boy", "unisex", "no_human",
];

/**
 * Pede pro LLM (Qwen text) enriquecer a cena que o usuario digitou.
 * Traduz PT->EN se necessario, adiciona detalhes visuais (iluminacao,
 * mood, ambiente) mantendo o que o usuario pediu como ancora.
 * Fallback: retorna o texto original se LLM falhar.
 */
export async function enrichScene(
  userScene: string,
  vision: { product_type: ProductType; description: string; target_user: TargetUser }
): Promise<string> {
  const raw = (userScene ?? "").trim();
  if (!raw) return "";
  if (!OLLAMA_BASE) return raw;

  const system = `You write short cinematic photography scene descriptions in English.
Given a user request (in any language) and the product context, output ONE concise sentence
that describes the scene with visual detail (lighting, atmosphere, environment).
Do NOT describe the product itself or the person/model — only the scene/environment.
Keep faithful to the user request. Output ONLY the sentence, no quotes, no preamble.`;
  const user = `Product: ${vision.description} (type: ${vision.product_type}).
Audience: ${vision.target_user}.
User scene request: "${raw}".`;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,
        options: { num_predict: 120, temperature: 0.4, num_ctx: 1024 },
      }),
      signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
    });
    if (!res.ok) return raw;
    const data = (await res.json()) as { message?: { content?: string } };
    let out = (data.message?.content ?? "").trim();
    // Limpa aspas, prefixos, etc
    out = out.replace(/^["'`]+|["'`]+$/g, "").replace(/^scene:\s*/i, "").trim();
    if (out.length < 6) return raw;
    return out;
  } catch {
    return raw;
  }
}

export function parseVisionResult(raw: string): VisionResult | null {
  if (!raw) return null;
  const get = (key: string) => {
    const m = raw.match(new RegExp(`^\\s*${key}\\s*:\\s*([^\\n]+)`, "im"));
    return m ? m[1].trim() : "";
  };

  const typeRaw = get("TYPE").toLowerCase().replace(/[^a-z_]/g, "");
  const product_type = (VALID_TYPES as string[]).includes(typeRaw) ? (typeRaw as ProductType) : "unknown";

  const description = get("DESCRIPTION") || "product";
  const countStr = get("COUNT").match(/\d+/)?.[0];
  const items_count = countStr ? Math.max(1, parseInt(countStr, 10)) : 1;

  const userRaw = get("USER").toLowerCase().replace(/[^a-z_]/g, "");
  const target_user = (VALID_USERS as string[]).includes(userRaw) ? (userRaw as TargetUser) : "unisex";

  const ageStr = get("AGE").match(/\d+/)?.[0];
  const age_years = ageStr ? parseInt(ageStr, 10) : undefined;

  const sceneRaw = get("SCENE");
  const scene_en = sceneRaw && sceneRaw.length > 4 ? sceneRaw.replace(/^["'`]+|["'`]+$/g, "").trim() : undefined;

  if (product_type === "unknown" && description === "product") return null;
  return { product_type, description, items_count, target_user, age_years, scene_en };
}
