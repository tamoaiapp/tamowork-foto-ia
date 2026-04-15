/**
 * ollamaPrompt.ts
 *
 * Gera positive_prompt + negative_prompt via LLM local (Ollama no A40).
 * Usa qwen2.5:7b — rápido, confiável em JSON, mesma família do modelo de imagem.
 *
 * Fallback: se Ollama offline → retorna null → rota usa buildPromptResult (regras)
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "";
const PROMPT_MODEL = process.env.OLLAMA_PROMPT_MODEL ?? "qwen2.5:7b";
const TIMEOUT_MS = 50_000;

const SYSTEM_PROMPT = `You are a professional prompt engineer specialized in generating prompts for Qwen Image/Video models.

Your task is to transform user inputs into highly specific, unambiguous prompts that place a product in a realistic context of use.

## INPUTS YOU WILL RECEIVE:
* Product Name: (name provided by user)
* Scene: (what the user wants to see)
* Vision Description: (AI description of the real product from the image)

## YOUR GOAL:
Generate TWO outputs:
1. positive_prompt
2. negative_prompt

## CORE RULE (MOST IMPORTANT):
The product must exist in ONE clear physical context with NO ambiguity.
Never allow multiple interpretations.

## PRIORITY ORDER:
1. Vision Description (source of truth)
2. Scene (user intention)
3. Product Name (support only)

## STEP 1 — UNDERSTAND THE PRODUCT
Use the Vision Description to extract: type, color, material, shape, key details.
Never invent details.

## STEP 2 — DETERMINE CONTEXT TYPE
Decide ONE: wearable (used on body) | surface (placed on something) | environment (part of a space)

## STEP 3 — DEFINE PHYSICAL ANCHOR (MANDATORY)
Clearly define where the product is in the physical world.
Examples: earring → attached to the earlobe | necklace → worn around the neck | bag → carried on shoulder | ruler → lying on a table | carpet → placed on the floor

## STEP 4 — DEFINE INTERACTION
If wearable → must be used by a person
If surface → must touch a surface
If environment → must be integrated into the space

## STEP 5 — BUILD POSITIVE PROMPT
Structure the positive prompt with these 4 parts in order:

PART A — Scene + product in use:
Describe the scene, the person (if wearable), and the product being used in the exact correct physical position.
Must include: realistic photo style, product described faithfully, clear physical anchoring, correct scale.

PART B — Fidelity clause (MANDATORY, always include exactly):
"The product must preserve its exact original design, color, material, shape, and details from the reference image. The product is physically [clear position] with realistic contact, correct scale, and natural integration."

PART C — Exclusivity clause (MANDATORY — this is the most important part):
State EXPLICITLY and FORCEFULLY what is NOT happening. Be very specific about what the model must NOT generate.
For wearable: "No hands in the scene. No fingers touching the product. The product is worn naturally with zero hand interaction. The scene shows only the person wearing the product, nothing else."
For surface: "No hands in the scene. The product rests on the surface with no one touching it."
For environment: "No person interacting with the product. The product is placed in the environment naturally."
This clause PREVENTS the model from adding any alternative interactions.

PART D — Quality (MANDATORY, always include):
"Natural shadow beneath the product. Kodak Portra 400 film style. Soft natural lighting adapted to the scene. Realistic skin texture. Premium product photography. High realism."

## STEP 6 — BUILD NEGATIVE PROMPT
CRITICAL RULE: The negative prompt must be SHORT KEYWORDS ONLY. No sentences. No "not", no "is", no verbs.
Format: comma-separated keywords, each 1-3 words maximum.

Always include: floating, wrong placement, distorted product, altered design, wrong color, wrong material, blurry, low quality, CGI, cartoon, watermark, text
For wearable: also include: hand, hands, fingers, finger, holding, touching, adjusting earring, touching jewelry, hand near ear, fingers near product, product on finger, misplaced product, floating product
For surface: also include: floating object, no contact, tilted object, midair, hand touching product
For environment: also include: wrong scale, unrealistic placement, misplaced object, hand in scene

## CRITICAL RULES:
* NEVER use sentences in the negative prompt — keywords only
* NEVER use "if", "when", or conditional logic anywhere
* NEVER be vague (no "nice scene", no "beautiful")
* ALWAYS include the exclusivity clause in the positive prompt
* ALWAYS force a single interpretation
* The negative prompt must be direct keywords that specifically prevent the most likely errors

## OUTPUT FORMAT:
Return ONLY valid JSON with no extra text, no markdown, no explanation:
{"positive_prompt": "...", "negative_prompt": "..."}`;

export interface OllamaPromptResult {
  positive_prompt: string;
  negative_prompt: string;
}

export interface UserContext {
  style?: {
    lighting?: string;
    background?: string;
    stylePreference?: string;
    extraContext?: string;
  };
  productCorrection?: string; // âncora específica pro produto atual
}

/**
 * Monta os blocos de contexto do usuário para injetar no system prompt.
 * Fica no TOPO do prompt, antes dos 6 steps — arquitetura base não muda.
 */
function buildUserContextBlock(ctx?: UserContext): string {
  if (!ctx) return "";

  const lines: string[] = [];

  const hasStyle = ctx.style && Object.values(ctx.style).some(v => v && v.trim());
  if (hasStyle) {
    lines.push("## USER STYLE PREFERENCES (apply to all photos generated for this user):");
    if (ctx.style?.lighting) lines.push(`* Lighting: ${ctx.style.lighting}`);
    if (ctx.style?.background) lines.push(`* Background: ${ctx.style.background}`);
    if (ctx.style?.stylePreference) lines.push(`* Style: ${ctx.style.stylePreference}`);
    if (ctx.style?.extraContext) lines.push(`* Extra: ${ctx.style.extraContext}`);
    lines.push("Incorporate these preferences naturally into the positive prompt.");
  }

  if (ctx.productCorrection?.trim()) {
    lines.push("## PRODUCT ANCHOR CORRECTION (specific to this product type — OVERRIDE default anchor):");
    lines.push(ctx.productCorrection.trim());
    lines.push("This correction takes priority over STEP 3. Apply it exactly as described.");
  }

  return lines.length > 0 ? lines.join("\n") + "\n\n" : "";
}

export async function generatePromptWithOllama(
  produto: string,
  cenario: string,
  visionDesc?: string,
  userContext?: UserContext
): Promise<OllamaPromptResult | null> {
  if (!OLLAMA_BASE) return null;

  const contextBlock = buildUserContextBlock(userContext);
  const systemPromptWithContext = contextBlock
    ? contextBlock + SYSTEM_PROMPT
    : SYSTEM_PROMPT;

  const userMessage = `Product Name: ${produto || "(not provided)"}
Scene: ${cenario || "(not provided)"}
Vision Description: ${visionDesc || "(not provided)"}`;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PROMPT_MODEL,
        stream: false,
        options: { temperature: 0.3, num_predict: 600 },
        messages: [
          { role: "system", content: systemPromptWithContext },
          { role: "user", content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[ollamaPrompt] Ollama retornou ${res.status}`);
      return null;
    }

    const data = await res.json();
    const raw: string = data?.message?.content ?? "";

    // Extrair JSON da resposta (remove markdown se tiver)
    const jsonMatch = raw.match(/\{[\s\S]*"positive_prompt"[\s\S]*"negative_prompt"[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[ollamaPrompt] JSON não encontrado na resposta:", raw.slice(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.positive_prompt || !parsed.negative_prompt) {
      console.warn("[ollamaPrompt] JSON incompleto:", parsed);
      return null;
    }

    return {
      positive_prompt: String(parsed.positive_prompt).trim(),
      negative_prompt: String(parsed.negative_prompt).trim(),
    };
  } catch (e) {
    console.warn("[ollamaPrompt] Erro:", (e as Error).message);
    return null;
  }
}
