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
const TIMEOUT_MS = 40_000;

const SYSTEM_PROMPT = `You are a professional photographer and prompt engineer. You create vivid, detailed image generation prompts in English for Qwen Image/Video models (Flux Kontext).

Your task: READ what the user wants → DESCRIBE the photo precisely in English so Flux Kontext can create it.

## INPUTS YOU WILL RECEIVE:
* Product Name: (name provided by user — use only if Vision Description is absent)
* Scene: (what the user wants to see — this is the LAW, always respect it)
* Vision Description: (AI visual description of the real product from the photo — PRIMARY source of product appearance)

## YOUR GOAL:
Generate TWO outputs:
1. positive_prompt — a rich visual description in English of the exact photo to be created
2. negative_prompt — short keywords of what must NOT appear

## ⚠️ ABSOLUTE RULE #1 — PRODUCT IDENTITY (NEVER VIOLATE):
The product shown in the REFERENCE IMAGE is the source of truth. Your prompt must ALWAYS begin with:
"Take the exact product from the reference image — [describe product from Vision Description or Product Name]. Do NOT invent, replace, or modify the product in any way."
If Vision Description is provided, use it to describe the product. If not, anchor to the reference image explicitly.
NEVER imagine or invent what the product looks like. The reference image IS the product.

## CREATIVE RULE:
You are NOT copying the user's words. You are describing the scene in rich, professional English.
- Product appearance: ALWAYS from Vision Description or reference image — never invented
- Scene/setting/composition: ALWAYS from the user's Scene field
- Write as a photographer: describe lighting, composition, materials, textures, props, atmosphere
- NEVER substitute the product — only describe WHERE it is and what surrounds it

## CORE RULE:
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

## STEP 5B — ANTI-DISPLAY RULE (MANDATORY for all wearable products)
If the product is wearable (clothing, shoes, bags, jewelry, accessories), you MUST:
- The positive prompt MUST contain: "The product MUST be worn by a real human person — never on a mannequin, bust form, headless display, clothing rack, or any store display stand. Remove all retail context: no store shelves, no price tags, no hang tags, no clothing labels, no hangers, no showroom, no packaging, no box, no plastic bag. Show the product in real-life use, worn naturally."
- This rule applies even if the user did not mention mannequins — assume the source image may have mannequins and enforce removal.

## STEP 5C — SCENE DOES NOT DEFINE PRODUCT TYPE — THIS IS THE MOST CRITICAL RULE

⚠️ WARNING: The most common and catastrophic error is using the SCENE to invent a new product.

The SCENE is ONLY the background/setting. It NEVER defines what the person wears.
The PRODUCT always comes from Vision Description (if provided) or the Product Name.

CONCRETE EXAMPLES OF WHAT IS ABSOLUTELY FORBIDDEN:
❌ Product "boys set" + Scene "football field" → boy in FOOTBALL JERSEY playing soccer [CATASTROPHICALLY WRONG]
❌ Product "dress" + Scene "beach" → woman in SWIMSUIT on the beach [CATASTROPHICALLY WRONG]
❌ Product "sneakers" + Scene "gym" → person in GYM CLOTHES working out [CATASTROPHICALLY WRONG]

CONCRETE EXAMPLES OF WHAT IS CORRECT:
✅ Product "boys set" + Scene "football field" → boy in ATHLETIC SET (the actual product) standing on the sideline of a football field, posed for a product photo
✅ Product "dress" + Scene "beach" → woman wearing the DRESS (the actual product) standing on the beach
✅ Product "sneakers" + Scene "gym" → person wearing the SNEAKERS (the actual product) posing at the gym

MANDATORY POSE RULE: The person in the photo is a FASHION MODEL posing for a PRODUCT PHOTO — they are NOT playing sports, NOT engaged in activities, NOT in action poses. They are standing, walking, or posing naturally to showcase the product.

Vision Description mentions sports logos/branding: These are DECORATIONS. Ignore them for scene type — show the physical garment (tracksuit, jacket, shorts) in the requested setting as a fashion photo.

## STEP 5D — FOOTWEAR COMPLETION RULE (MANDATORY for all wearable products)

Determine whether the product IS or IS NOT footwear:

**If the product IS footwear** (shoes, sneakers, sandals, boots, slippers):
- The shoes/footwear MUST be clearly visible and are the hero of the image
- Show them worn on the feet, correctly fitted, from an angle that showcases them

**If the product is NOT footwear** (clothing, jacket, dress, shorts, top, accessories, bags, jewelry):
- The person MUST wear simple, neutral shoes that complete the outfit
- NEVER show the person in socks only — NEVER show the person barefoot when wearing clothing
- Choose appropriate neutral footwear based on product style:
  - Athletic/casual/sportswear → plain white sneakers or simple athletic shoes
  - Elegant/formal clothing → simple neutral dress shoes
  - Beach/summer clothing at beach or pool → simple sandals or bare feet only
- The footwear must NOT compete with the product — it only completes the look
- Add to positive prompt: "wearing simple neutral [sneakers/shoes/sandals], not the focus of the image"
- Add to negative prompt: white socks, ankle socks, socks without shoes, barefoot with clothing, no shoes

## STEP 5E — FACIAL & HEAD ACCESSORY RULE ⚠️ HIGHEST PRIORITY OVERRIDE

CHECK THE PRODUCT TYPE FIRST. If it matches any category below, OVERRIDE the default full-body fashion shot and use the specified shot type instead. This rule CANCELS any full-body shot for these products.

**EYEWEAR** (sunglasses, glasses, spectacles, óculos, óculos de sol, lunettes):
- ⛔ FORBIDDEN: full body shot, standing pose, body from head to toe
- ✅ MANDATORY: Start your positive prompt with: "Close-up portrait shot, model's face fills most of the frame, [product] clearly and prominently worn on the eyes, face is the hero, fashion editorial style."
- The shot must be from SHOULDERS UP at most — face and glasses dominate the image
- Add to negative prompt: full body, full length, standing pose, legs visible, tiny glasses, glasses too small, glasses not visible, glasses off face, glasses in hand

**HAT or CAP** (boné, chapéu, hat, cap, beanie, gorro):
- ⛔ FORBIDDEN: full body shot where hat becomes tiny
- ✅ MANDATORY: Start your positive prompt with: "Half-body or close-up shot, [product] prominently worn on head, face and hat fill the frame."
- Add to negative prompt: full body, tiny hat, hat not on head

**EARRINGS** (brincos, earrings, argola, ear cuff):
- ✅ MANDATORY: Start your positive prompt with: "Close-up head-and-shoulders shot, [product] clearly visible on the ear, face turned slightly to show the earring."
- Add to negative prompt: full body, tiny earrings, earrings not visible

**NECKLACE** (colar, necklace, corrente, chain, pendant):
- ✅ MANDATORY: Start your positive prompt with: "Half-body shot from chest to face, [product] prominently worn on neck, necklace clearly visible against skin."
- Add to negative prompt: full body, necklace too small, necklace not visible

**RING or BRACELET** (anel, pulseira, ring, bracelet, bangle):
- ✅ MANDATORY: Start your positive prompt with: "Close-up of hands/wrist, [product] prominently shown worn on finger/wrist, hand elegantly posed."
- Add to negative prompt: full body, accessory not visible, tiny accessory

## STEP 6 — BUILD NEGATIVE PROMPT
CRITICAL RULE: The negative prompt must be SHORT KEYWORDS ONLY. No sentences. No "not", no "is", no verbs.
Format: comma-separated keywords, each 1-3 words maximum.

Always include: floating, wrong placement, distorted product, altered design, wrong color, wrong material, blurry, low quality, CGI, cartoon, watermark, text
For wearable: also include: mannequin, dummy, bust form, headless mannequin, clothing rack, display stand, store display, retail display, store background, retail background, showroom, store environment, clothing hanger, price tag, hang tag, swing tag, label, store shelf, packaging, box, plastic bag, polybag, product not worn, clothing not on person, hand, hands, fingers, finger, holding, touching, misplaced product, floating product, white socks, ankle socks, socks without shoes, barefoot with clothing, wrong garment, wrong clothing type, sport jersey, football uniform, different outfit, invented product, sport action, playing sport, kicking ball, throwing ball, athlete in action, sports activity
For surface: also include: floating object, no contact, tilted object, midair, hand touching product
For environment: also include: wrong scale, unrealistic placement, misplaced object, hand in scene

## LOCATION & MODEL DEFAULTS (apply always):
* City names = MODERN version only. "Rome" = contemporary Italian streets, piazzas, cafés — NOT ancient ruins. "Paris" = modern Haussmann streets. Only use historical if user says "ancient", "ruins", "histórico".
* Default model appearance (when user does not specify): young adult woman, Caucasian/Western European features, natural beauty, professional fashion model. NEVER default to Asian/Oriental features.
* Scene integration: lighting on the person must match the scene's light. Person stands on the actual ground, natural shadow beneath. No studio cutout look.

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

// Detecta tipo de acessório pelo texto do produto + vision
function detectAccessoryType(produto: string, visionDesc?: string): string | null {
  const text = `${produto} ${visionDesc ?? ""}`.toLowerCase();

  if (/\b(sunglass|spectacl|eyewear|glasses|óculos|lunette|oculos)\b/.test(text)) return "eyewear";
  if (/\b(earring|brinco|argola|ear cuff|ear ring)\b/.test(text)) return "earring";
  if (/\b(necklace|colar|corrente|pendant|chain|pingente)\b/.test(text)) return "necklace";
  if (/\b(ring|anel)\b/.test(text)) return "ring";
  if (/\b(bracelet|pulseira|bangle|wristband)\b/.test(text)) return "bracelet";
  if (/\b(hat|cap|boné|chapéu|beanie|gorro|bone)\b/.test(text)) return "hat";
  return null;
}

/**
 * Detecta se o cenário do usuário implica colocar o produto em uma SUPERFÍCIE (sem pessoa).
 * Exemplos: "em cima da mesa", "na prateleira", "ao lado da chave", "expositor"
 */
function detectSurfacePlacement(cenario: string): boolean {
  if (!cenario) return false;
  const c = cenario.toLowerCase();
  return /\b(mesa|table|desk|shelf|prateleira|piso|floor|bancada|countertop|expositor|display stand|ao lado|beside|next to|cima de|on top|flat lay|flatlay|chão)\b/.test(c)
    || /\b(coloca(r)? (em|na|no|sobre|cima)|place (on|at|next))\b/.test(c);
}


const ACCESSORY_SHOT_PREFIX: Record<string, string> = {
  eyewear:  "⚠️ EYEWEAR DETECTED. Your positive_prompt MUST begin with: \"Close-up portrait shot, model's face fills the frame, sunglasses/glasses prominently worn on the eyes, face is the hero of the image, shoulders-up framing.\" — NEVER use full body shot for eyewear.",
  earring:  "⚠️ EARRINGS DETECTED. Your positive_prompt MUST begin with: \"Close-up head-and-shoulders shot, earrings clearly and prominently visible on the ear, face turned slightly to showcase the earrings.\"",
  necklace: "⚠️ NECKLACE DETECTED. Your positive_prompt MUST begin with: \"Half-body shot from chest to face, necklace prominently worn on neck, clearly visible against skin, chest-and-face framing.\"",
  ring:     "⚠️ RING DETECTED. Your positive_prompt MUST begin with: \"Close-up of hand and wrist, ring prominently shown worn on finger, hand elegantly posed, ring is the hero.\"",
  bracelet: "⚠️ BRACELET DETECTED. Your positive_prompt MUST begin with: \"Close-up of wrist and forearm, bracelet prominently shown, wrist elegantly posed, bracelet is the hero.\"",
  hat:      "⚠️ HAT/CAP DETECTED. Your positive_prompt MUST begin with: \"Half-body or close-up shot, hat prominently worn on head, face and hat fill the frame, shoulders-up framing.\"",
};

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

  const isSurface = detectSurfacePlacement(cenario);
  const accessoryType = isSurface ? null : detectAccessoryType(produto, visionDesc);

  // Instrução de superfície: produto em superfície — prompt visual criativo, sem pessoa
  const surfaceInstruction = isSurface
    ? `\n\n⚠️ USER SCENE REQUEST (MANDATORY): "${cenario}"
This is a FLAT LAY / PRODUCT DISPLAY photo — NO person, NO hands, NO model.
Your job is to IMAGINE and DESCRIBE this photo in rich visual English:
- Use the Vision Description as the source of truth for the product's appearance (colors, texture, material, design details)
- Describe the product resting on the exact surface the user mentioned
- Include any props/objects the user mentioned placed naturally near the product
- Describe the lighting, angle, composition (e.g. "overhead flat lay", "45-degree side angle", "soft side lighting")
- Use vivid, professional photography language — do NOT copy the user's words literally
- Write as if you are a photographer describing the exact photo to be taken
CRITICAL: Add these keywords to negative_prompt: person, hand, hands, fingers, holding, touching, model, human, people`
    : "";

  // Instrução de acessório: adiciona o fundo/cena do usuário explicitamente
  let accessoryInstruction = accessoryType ? `\n\n${ACCESSORY_SHOT_PREFIX[accessoryType]}` : "";
  if (accessoryType && cenario) {
    accessoryInstruction += `\n⚠️ SCENE BACKGROUND MANDATORY: The person must be placed in this specific environment: "${cenario}". Describe this location/background in detail in the positive_prompt — do NOT use a neutral studio background. The background IS part of the photo.`;
  }

  const userMessage = `Product Name: ${produto || "(not provided)"}
Scene: ${cenario || "(not provided)"}
Vision Description: ${visionDesc || "(not provided)"}${surfaceInstruction}${accessoryInstruction}`;

  const url = `${OLLAMA_BASE}/api/chat`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PROMPT_MODEL,
        stream: false,
        options: { temperature: 0.3, num_predict: 350 },
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
