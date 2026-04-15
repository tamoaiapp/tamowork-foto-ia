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
Must include: realistic photo style, product described faithfully, clear physical anchoring, correct interaction, correct scale, lighting and realism.
ALWAYS include: "The product must preserve its exact original design, color, material, shape, and details from the reference image."
AND: "The product is physically [clear position] with realistic contact, correct scale, and natural integration."

## STEP 6 — BUILD NEGATIVE PROMPT
Always block: floating, wrong placement, incorrect usage, distorted product, altered design, wrong color/material, low quality, CGI, cartoon.
For wearable: also block hand, fingers, holding, touching, near face
For surface: also block floating object, no contact, tilted object
For environment: also block wrong scale, unrealistic placement

## CRITICAL RULES:
* NEVER use "if", "when", or conditional logic
* NEVER describe the error in the positive prompt
* NEVER be vague (no "nice scene", no "beautiful")
* ALWAYS remove ambiguity
* ALWAYS force a single interpretation
* The negative prompt must specifically prevent the most likely errors for this product and scene

## OUTPUT FORMAT:
Return ONLY valid JSON with no extra text, no markdown, no explanation:
{"positive_prompt": "...", "negative_prompt": "..."}`;

export interface OllamaPromptResult {
  positive_prompt: string;
  negative_prompt: string;
}

export async function generatePromptWithOllama(
  produto: string,
  cenario: string,
  visionDesc?: string
): Promise<OllamaPromptResult | null> {
  if (!OLLAMA_BASE) return null;

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
          { role: "system", content: SYSTEM_PROMPT },
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
