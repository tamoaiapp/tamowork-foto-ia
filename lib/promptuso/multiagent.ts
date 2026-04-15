/**
 * multiagent.ts — CLOUD MASTER V2
 * Motor multiagente de geração de prompts comerciais para Qwen Image/Video.
 *
 * Arquitetura:
 *   INPUT → classifyUsageMode (Router) → resolveUsageAgent
 *        → autoScene (Scene Planner) → buildIdentityBlock (Identity Lock)
 *        → buildPrompt (Prompt Builder) → reviewPromptAndImage (Super Revisor)
 *        → interpretFeedback (Feedback Engine)
 */

// ── Utils ───────────────────────────────────────────────────────────────────

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function joinText(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ").trim();
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function asciiSafe(s: string, maxLen = 1200): string {
  let t = String(s || "");
  try { t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch {}
  t = t.replace(/[""„‟]/g, '"').replace(/[''‛‚]/g, "'").replace(/[‐-‒–—―]/g, "-").replace(/[`´]/g, "");
  t = t.replace(/[^\x20-\x7E]/g, "").trim().replace(/\s+/g, " ");
  return t.length > maxLen ? t.slice(0, maxLen).trim() : t;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type UsageMode =
  | "wearable_use"
  | "handheld_use"
  | "placed_environment"
  | "active_usage"
  | "surface_display_use";

export type UsageAgent =
  | "fashion_wearable_agent"
  | "fashion_kids_wearable_agent"
  | "jewelry_ear_agent"
  | "jewelry_neck_agent"
  | "jewelry_hand_agent"
  | "footwear_agent"
  | "bag_agent"
  | "handheld_use_agent"
  | "placed_environment_agent"
  | "active_usage_agent"
  | "surface_display_use_agent";

export interface ProductContext {
  raw_text: string;
  normalized_text: string;
  target_user: string;
  gender_presentation: string;
  climate_hint: string;
  usage_context: string;
  has_human_block: boolean;
  wants_handheld: boolean;
  product_family: string;
  product_subtype: string;
}

export interface PromptV2Result {
  positive_prompt: string;
  negative_prompt: string;
  meta: {
    mode: UsageMode;
    agent: UsageAgent;
    target_user: string;
    usage_context: string;
    climate_hint: string;
    scene_source: "user" | "auto";
    shot_type: string;
    physical_anchor: string;
  };
}

export interface ReviewResult {
  approved: boolean;
  issues: string[];
  allowed_changes: string[];
  locked: string[];
  fixes: {
    positive_additions: string[];
    negative_additions: string[];
  };
}

export interface FeedbackResult {
  issue_types: string[];
  allowed_changes: string[];
  locked_elements: string[];
  extra_positive_notes: string[];
  extra_negative_terms: string[];
}

// ── CAMADA 1 — Product Parser ───────────────────────────────────────────────

export function parseProductContext({
  product_name,
  vision_description,
}: {
  product_name?: string;
  vision_description?: string;
}): ProductContext {
  const raw = joinText(product_name, vision_description);
  const text = normalizeText(raw);

  const context: ProductContext = {
    raw_text: raw,
    normalized_text: text,
    target_user: "unknown",
    gender_presentation: "unknown",
    climate_hint: "unknown",
    usage_context: "unknown",
    has_human_block: false,
    wants_handheld: false,
    product_family: "generic",
    product_subtype: "generic",
  };

  if (containsAny(text, ["infantil", "kids", "kid", "baby", "bebe", "bebe", "toddler", "juvenil"])) {
    context.target_user = "child";
  } else if (containsAny(text, ["plus size", "curvy"])) {
    context.target_user = "adult";
    context.usage_context = "plus_size_fashion";
  } else {
    context.target_user = "adult";
  }

  if (containsAny(text, ["feminina", "feminino", "female", "woman", "mulher", "noiva", "bride"])) {
    context.gender_presentation = "female";
  } else if (containsAny(text, ["masculina", "masculino", "male", "man", "homem", "noivo", "groom"])) {
    context.gender_presentation = "male";
  } else if (containsAny(text, ["unissex", "unisex"])) {
    context.gender_presentation = "unisex";
  }

  if (containsAny(text, [
    "sem modelo", "sem humano", "without model", "no model", "no human",
    "so o produto", "so a sandalia", "sem pe de modelo", "produto sozinho",
  ])) {
    context.has_human_block = true;
  }

  if (containsAny(text, [
    "segurando na mao", "segurando na mao", "held in hand", "holding", "segurar na mao",
  ])) {
    context.wants_handheld = true;
  }

  if (containsAny(text, ["inverno", "winter", "cold", "frio", "neve"])) {
    context.climate_hint = "cold";
  } else if (containsAny(text, ["summer", "verao", "verao", "quente", "beach", "praia"])) {
    context.climate_hint = "warm";
  }

  if (containsAny(text, ["futebol", "football", "soccer", "esportivo", "sport", "treino", "corrida", "running"])) {
    context.usage_context = "sports";
  } else if (containsAny(text, ["casa", "home", "living room", "sala", "cozinha", "kitchen"])) {
    context.usage_context = "home";
  } else if (containsAny(text, ["luxo", "luxury", "premium", "elegante", "elegant", "casamento", "wedding", "festa", "party"])) {
    context.usage_context = "premium";
  } else if (containsAny(text, ["barbearia", "barber", "barbershop", "salao", "salon"])) {
    context.usage_context = "barber";
  }

  return context;
}

// ── CAMADA 2 — Router ───────────────────────────────────────────────────────

export function classifyUsageMode({
  product_name,
  vision_description,
}: {
  product_name?: string;
  vision_description?: string;
}): UsageMode {
  const text = normalizeText(joinText(product_name, vision_description));

  if (containsAny(text, [
    "camisa", "camiseta", "vestido", "calca", "calca", "jaqueta", "conjunto",
    "roupa", "moletom", "uniforme", "hoodie", "tracksuit", "brinco", "colar",
    "pulseira", "anel", "oculos", "oculos", "tenis", "tenis", "sapato",
    "sandalia", "sandalia", "bota", "chuteira", "bolsa", "mochila", "relogio",
    "relogio", "luva", "meias", "colete", "blazer", "blusa", "regata",
    "cropped", "saia", "legging", "pochete", "crossbody", "bone", "chapeu",
    "tiara", "headband", "munhequeira", "pulseira", "alianca", "bermuda",
  ])) return "wearable_use";

  if (containsAny(text, [
    "buque", "buque", "bouquet", "flor", "flores", "ramo", "perfume",
    "cosmetic", "cosmetico", "cosmetico", "ferramenta pequena", "gift item",
    "caneta", "pincel", "escova", "tesoura", "faca", "utensilio pequeno",
    "celular", "smartphone", "tablet", "camera", "controle",
  ])) return "handheld_use";

  if (containsAny(text, [
    "vassoura", "rodo", "esfregao", "esfregao", "panela", "frigideira",
    "ferramenta", "utensilio", "utensilio", "limpeza", "cleaning",
    "broom", "mop", "tool", "martelo", "chave de fenda", "furadeira",
    "aspirador", "maquina de lavar", "eletrodomestico",
  ])) return "active_usage";

  if (containsAny(text, [
    "tapete", "escada", "cadeira", "sofa", "sofa", "quadro", "luminaria",
    "luminaria", "mesa", "rack", "armario", "armario", "espelho",
    "ladder", "carpet", "furniture", "sofá", "prateleira", "organizador",
    "cama", "colchao", "colchao", "edredom", "almofada",
  ])) return "placed_environment";

  return "surface_display_use";
}

export function resolveUsageAgent(mode: UsageMode, parsed: ProductContext): UsageAgent {
  const text = parsed.normalized_text;

  if (mode === "wearable_use") {
    if (parsed.target_user === "child") return "fashion_kids_wearable_agent";
    if (containsAny(text, ["brinco", "argola", "earring", "piercing"])) return "jewelry_ear_agent";
    if (containsAny(text, ["colar", "corrente", "gargantilha", "choker", "necklace"])) return "jewelry_neck_agent";
    if (containsAny(text, ["pulseira", "anel", "alianca", "relogio", "relogio", "smartwatch", "bracelet", "ring", "watch"])) return "jewelry_hand_agent";
    if (containsAny(text, ["tenis", "tenis", "sapato", "sandalia", "sandalia", "bota", "chuteira", "chinelo", "sapatilha", "shoe", "sneaker", "boot"])) return "footwear_agent";
    if (containsAny(text, ["bolsa", "mochila", "pochete", "crossbody", "bag", "backpack"])) return "bag_agent";
    return "fashion_wearable_agent";
  }

  if (mode === "handheld_use") return "handheld_use_agent";
  if (mode === "placed_environment") return "placed_environment_agent";
  if (mode === "active_usage") return "active_usage_agent";
  return "surface_display_use_agent";
}

// ── CAMADA 3 — Scene Planner ─────────────────────────────────────────────────

export function autoSceneV2(mode: UsageMode, parsed: ProductContext): string {
  const text = parsed.normalized_text;

  if (mode === "wearable_use") {
    if (parsed.target_user === "child" && parsed.usage_context === "sports") {
      if (parsed.climate_hint === "cold") {
        return "professional kids sportswear campaign in a cool outdoor football-related setting, such as a winter football field or a cold urban sports street";
      }
      return "professional kids sportswear campaign in an outdoor football or sports lifestyle setting";
    }

    if (parsed.usage_context === "premium") {
      return "elegant premium fashion setting with sophisticated lighting, luxury background";
    }

    if (containsAny(text, ["brinco", "argola", "colar", "corrente", "pulseira", "anel", "alianca"])) {
      return "premium close-up commercial setting with refined background and elegant natural lighting";
    }

    if (containsAny(text, ["tenis", "tenis", "sapato", "sandalia", "sandalia", "bota", "chuteira"])) {
      if (parsed.usage_context === "sports") return "outdoor sports environment, dynamic action scene with realistic ground contact";
      return "commercial lifestyle usage scene with realistic walking or standing context";
    }

    if (containsAny(text, ["bolsa", "mochila", "pochete"])) {
      return "commercial lifestyle fashion scene in a refined urban or indoor premium environment";
    }

    if (parsed.usage_context === "sports") return "outdoor sports lifestyle environment, natural light, active context";
    if (parsed.climate_hint === "warm") return "bright outdoor lifestyle scene, warm natural light, summer environment";
    if (parsed.climate_hint === "cold") return "cozy indoor or cold outdoor lifestyle scene, natural winter tones";

    return "professional lifestyle environment with natural commercial lighting";
  }

  if (mode === "handheld_use") {
    if (containsAny(text, ["buque", "buque", "bouquet", "flor", "flores"])) {
      if (parsed.usage_context === "premium") return "elegant romantic wedding or event commercial scene";
      return "elegant romantic commercial scene with natural elegant lighting";
    }
    if (containsAny(text, ["perfume", "fragrance", "cologne"])) {
      return "premium vanity or elegant surface scene with refined lighting, luxury feel";
    }
    if (containsAny(text, ["celular", "smartphone", "tablet", "camera"])) {
      return "modern lifestyle setting, person using device naturally in a clean environment";
    }
    return "natural hand-held usage scene in a refined commercial context";
  }

  if (mode === "placed_environment") {
    if (containsAny(text, ["tapete", "carpet", "rug"])) {
      return "beautiful well-composed living room or bedroom environment with realistic decor styling";
    }
    if (containsAny(text, ["escada", "ladder"])) {
      return "realistic architectural or utility environment where the ladder naturally belongs, such as a garage, backyard, or home maintenance setting";
    }
    if (containsAny(text, ["sofa", "sofa", "cadeira", "poltrona"])) {
      return "well-designed modern living room with natural lighting and tasteful decor";
    }
    if (containsAny(text, ["quadro", "espelho"])) {
      return "clean interior wall in a modern home with natural lighting";
    }
    if (containsAny(text, ["cama", "colchao", "edredom", "almofada"])) {
      return "cozy well-designed bedroom with soft natural lighting and tasteful decor";
    }
    return "well-designed realistic environment where the product naturally belongs";
  }

  if (mode === "active_usage") {
    if (containsAny(text, ["vassoura", "rodo", "esfregao", "broom", "mop"])) {
      return "clean domestic interior scene showing realistic home cleaning usage";
    }
    if (containsAny(text, ["panela", "frigideira"])) {
      return "realistic kitchen scene showing natural usage in a cooking environment";
    }
    if (containsAny(text, ["martelo", "chave de fenda", "furadeira", "tool"])) {
      return "realistic workshop or home maintenance scene showing the tool being used correctly";
    }
    return "realistic action scene showing the product being used correctly in its natural environment";
  }

  // surface_display_use
  if (containsAny(text, ["perfume", "fragrance", "cologne", "eau de"])) {
    return "premium vanity or elegant bathroom counter scene with refined lighting";
  }
  if (containsAny(text, ["regua", "regua", "caneta", "lapis", "lapis", "caderno", "notebook"])) {
    return "clean study desk or office desk surface scene with realistic contact and soft natural light";
  }
  if (containsAny(text, ["suplemento", "whey", "vitamina", "remedio", "medicine"])) {
    return "clean premium surface with subtle professional lighting, health lifestyle context";
  }
  if (parsed.usage_context === "barber") {
    return "barbershop counter or professional styling station with atmospheric lighting";
  }

  return "clean realistic commercial surface context with proper lighting";
}

// ── CAMADA 4 — Identity Lock ─────────────────────────────────────────────────

export function buildIdentityBlock(): string {
  return [
    "The product must remain visually identical to the reference image.",
    "Do not change color, shape, material, texture, proportions, logo, or design.",
    "Do not redesign, simplify, reinterpret, or replace the product.",
    "All unique details, textures, shapes, and design elements must match the reference exactly.",
  ].join(" ");
}

// ── Physical Anchor ──────────────────────────────────────────────────────────

export function resolvePhysicalAnchor(mode: UsageMode, agent: UsageAgent, parsed: ProductContext): string {
  const text = parsed.normalized_text;

  if (mode === "wearable_use") {
    if (agent === "jewelry_ear_agent") return "firmly attached to the earlobe, correct position and scale";
    if (agent === "jewelry_neck_agent") return "worn naturally around the neck, correct drape and scale";
    if (agent === "jewelry_hand_agent") {
      if (containsAny(text, ["pulseira", "relogio", "relogio", "watch", "bracelet", "munhequeira"])) return "worn naturally on the wrist";
      return "worn naturally on the finger, correct size and position";
    }
    if (agent === "footwear_agent") return "worn naturally on the feet, correct orientation and realistic ground contact";
    if (agent === "bag_agent") {
      if (containsAny(text, ["mochila", "backpack"])) return "worn naturally on the back or carried in a realistic usage pose";
      if (containsAny(text, ["pochete", "crossbody", "tiracolo"])) return "worn crossbody in a natural lifestyle pose";
      return "carried naturally on the shoulder or in a realistic fashion pose";
    }
    if (agent === "fashion_kids_wearable_agent") return "worn correctly on a child's body with realistic proportions and natural pose";
    return "worn naturally on the body with correct position and realistic proportions";
  }

  if (mode === "handheld_use") {
    if (containsAny(text, ["buque", "buque", "bouquet", "flor", "flores"])) {
      return "held naturally with one or both hands at chest level in a realistic elegant pose";
    }
    if (containsAny(text, ["celular", "smartphone", "tablet"])) {
      return "held naturally in one hand with realistic grip and correct scale";
    }
    return "held naturally in hand with realistic contact and correct scale";
  }

  if (mode === "placed_environment") {
    if (containsAny(text, ["tapete", "carpet", "rug"])) return "placed flat on the floor with realistic contact and correct scale";
    if (containsAny(text, ["escada", "ladder"])) return "positioned naturally in the environment with realistic ground contact and correct orientation";
    if (containsAny(text, ["quadro", "espelho"])) return "mounted correctly on the wall at realistic height";
    if (containsAny(text, ["sofa", "sofa", "cadeira"])) return "positioned naturally in the room with realistic floor contact";
    return "integrated naturally into the environment with realistic contact, correct scale, and correct orientation";
  }

  if (mode === "active_usage") {
    return "being used naturally in a realistic functional position with proper contact and correct interaction";
  }

  return "placed naturally on a realistic surface with correct perspective, grounding shadow, and contact";
}

// ── Shot Type ────────────────────────────────────────────────────────────────

export function inferShotType(agent: UsageAgent, mode: UsageMode): string {
  if (agent === "jewelry_ear_agent") return "tight close-up portrait, ear clearly visible";
  if (agent === "jewelry_neck_agent") return "close-up or mid close-up portrait";
  if (agent === "jewelry_hand_agent") return "close-up of hand or wrist, clean background";
  if (agent === "fashion_kids_wearable_agent") return "full-body professional campaign shot";
  if (agent === "fashion_wearable_agent") return "full-body or mid-body commercial lifestyle shot";
  if (agent === "footwear_agent") return "commercial footwear shot, knee-to-ground or full lifestyle pose";
  if (agent === "bag_agent") return "commercial lifestyle fashion shot, product prominently visible";
  if (mode === "placed_environment") return "realistic room or environment view with product as focal point";
  if (mode === "surface_display_use") return "clean contextual close-up commercial shot";
  if (mode === "active_usage") return "realistic action shot showing natural product usage";
  return "realistic commercial lifestyle shot";
}

// ── Negative blocks ──────────────────────────────────────────────────────────

function baseNegativeTerms(): string[] {
  return [
    "floating", "duplicate product", "multiple instances",
    "packaging", "barcode", "label", "product card",
    "altered design", "wrong color", "wrong shape", "wrong material",
    "wrong proportions", "wrong position",
    "blurry", "low quality", "CGI", "cartoon", "watermark", "text",
    "mannequin on product", "display stand",
  ];
}

function agentNegativeTerms(agent: UsageAgent): string[] {
  switch (agent) {
    case "jewelry_ear_agent":
      return ["hand", "fingers", "holding", "touching", "earring not on ear", "floating earring", "wrong ear placement"];
    case "jewelry_neck_agent":
      return ["holding necklace", "floating necklace", "necklace not worn", "wrong necklace position"];
    case "jewelry_hand_agent":
      return ["deformed fingers", "bad hands", "wrong finger placement", "wrong wrist placement", "extra fingers"];
    case "footwear_agent":
      return ["floating shoes", "shoes not worn", "wrong foot position", "deformed feet", "wrong scale shoes"];
    case "bag_agent":
      return ["floating bag", "wrong straps", "extra pockets not in original", "altered hardware", "bag not worn"];
    case "fashion_kids_wearable_agent":
      return ["adult model", "adult proportions", "mannequin", "store background", "retail scene", "wrong age"];
    case "fashion_wearable_agent":
      return ["mannequin", "flat clothing", "floating clothing", "clothing not worn", "wrong body proportions"];
    case "handheld_use_agent":
      return ["floating object", "wrong hand pose", "deformed hands", "object not held", "extra hands"];
    case "placed_environment_agent":
      return ["floating object", "wrong scale", "unrealistic placement", "bad perspective", "no ground contact"];
    case "active_usage_agent":
      return ["incorrect usage", "no contact", "product displayed instead of used", "unrealistic action"];
    case "surface_display_use_agent":
    default:
      return ["floating object", "no surface contact", "bad perspective", "product in mid-air"];
  }
}

// ── CAMADA 5 — Prompt Builder ────────────────────────────────────────────────

export function buildPromptV2({
  product_name,
  scene_request,
  vision_description,
  mode,
  agent,
  parsed,
  extra_positive_notes = [],
  extra_negative_terms = [],
}: {
  product_name: string;
  scene_request?: string;
  vision_description?: string;
  mode: UsageMode;
  agent: UsageAgent;
  parsed: ProductContext;
  extra_positive_notes?: string[];
  extra_negative_terms?: string[];
}): PromptV2Result {
  const scene = scene_request?.trim() || autoSceneV2(mode, parsed);
  const physicalAnchor = resolvePhysicalAnchor(mode, agent, parsed);
  const shotType = inferShotType(agent, mode);

  // Bloco humano — presença de modelo adaptada ao contexto
  let humanBlock: string;
  if (parsed.has_human_block) {
    humanBlock = "Do not show any person, model, or human body. Product only.";
  } else if (mode === "wearable_use") {
    const genderStr = parsed.gender_presentation === "female" ? "female"
      : parsed.gender_presentation === "male" ? "male" : "";
    const sizeStr = parsed.usage_context === "plus_size_fashion" ? "plus-size " : "";
    const ageStr = parsed.target_user === "child" ? "child" : `${genderStr} ${sizeStr}person`.trim();
    humanBlock = `A ${ageStr} is present to show the product worn naturally with correct body proportions.`;
  } else if (mode === "handheld_use") {
    humanBlock = "A person may be present only as needed to hold the product naturally in realistic use.";
  } else if (mode === "active_usage") {
    humanBlock = "A person may be present only as needed to demonstrate realistic active usage.";
  } else {
    humanBlock = "No unnecessary person should appear in the scene. Product is the sole focus.";
  }

  const qualityBlock = [
    "High-quality realistic commercial photo.",
    "Realistic lighting, natural shadows, correct scale, authentic textures, and natural integration.",
    "The product appears only once and only in its intended usage form.",
  ].join(" ");

  const pos = [
    qualityBlock,
    `Product: ${vision_description || product_name || "product"}.`,
    buildIdentityBlock(),
    `Physical placement: the product is ${physicalAnchor}.`,
    `Scene: ${scene}.`,
    `Framing: ${shotType}.`,
    humanBlock,
    ...extra_positive_notes,
  ].filter(Boolean).join(" ");

  const neg = uniq([
    ...baseNegativeTerms(),
    ...agentNegativeTerms(agent),
    ...extra_negative_terms,
  ]).join(", ");

  return {
    positive_prompt: asciiSafe(pos),
    negative_prompt: asciiSafe(neg),
    meta: {
      mode,
      agent,
      target_user: parsed.target_user,
      usage_context: parsed.usage_context,
      climate_hint: parsed.climate_hint,
      scene_source: scene_request?.trim() ? "user" : "auto",
      shot_type: shotType,
      physical_anchor: physicalAnchor,
    },
  };
}

// ── CAMADA 6 — Super Agente Revisor ─────────────────────────────────────────

export function reviewPromptAndImage({
  user_feedback = "",
}: {
  product_name?: string;
  vision_description?: string;
  positive_prompt?: string;
  negative_prompt?: string;
  user_feedback?: string;
}): ReviewResult {
  const feedback = interpretFeedback(user_feedback);
  const approved = feedback.issue_types.length === 0;

  return {
    approved,
    issues: feedback.issue_types,
    allowed_changes: feedback.allowed_changes,
    locked: ["product_identity", "product_color", "product_shape", "product_design"],
    fixes: {
      positive_additions: feedback.extra_positive_notes,
      negative_additions: feedback.extra_negative_terms,
    },
  };
}

// ── CAMADA 7 — Feedback Engine ───────────────────────────────────────────────

export function interpretFeedback(user_feedback = ""): FeedbackResult {
  const text = normalizeText(user_feedback);

  const result: FeedbackResult = {
    issue_types: [],
    allowed_changes: [],
    locked_elements: ["product_identity"],
    extra_positive_notes: [],
    extra_negative_terms: [],
  };

  if (!text) return result;

  if (containsAny(text, [
    "fundo ruim", "cenario ruim", "cenario feio", "ambiente ruim", "mais profissional",
    "background bad", "scene bad", "fundo feio", "cenário ruim", "fundo errado",
  ])) {
    result.issue_types.push("scene_quality");
    result.allowed_changes.push("scene", "lighting", "style");
    result.extra_positive_notes.push("Use a more refined, professional, and commercially appealing environment.");
    result.extra_negative_terms.push("bad background", "ugly background", "poor scene quality");
  }

  if (containsAny(text, [
    "muito grande", "muito pequeno", "escala errada", "wrong scale",
    "oversized", "too small", "proporcao errada", "nao parece real",
  ])) {
    result.issue_types.push("scale");
    result.allowed_changes.push("scale", "framing");
    result.extra_positive_notes.push("Ensure correct realistic scale relative to the environment or human body.");
    result.extra_negative_terms.push("wrong scale", "oversized", "too small", "unrealistic proportions");
  }

  if (containsAny(text, [
    "nao ficou igual", "mudou a cor", "mudou o logo", "produto alterado",
    "not same product", "wrong product", "different product", "mudou o produto",
    "cor errada", "design errado", "nao e o mesmo",
  ])) {
    result.issue_types.push("identity_error");
    result.allowed_changes.push("identity_strength");
    result.extra_positive_notes.push("Exact visual match to the reference product. No redesign, no variation, no reinterpretation.");
    result.extra_negative_terms.push("different product", "altered design", "wrong logo", "wrong color", "reinterpreted product");
  }

  if (containsAny(text, [
    "flutuando", "torto", "posicao errada", "wrong position", "floating",
    "na posicao errada", "posicao incorreta", "mal posicionado",
  ])) {
    result.issue_types.push("position");
    result.allowed_changes.push("position", "interaction");
    result.extra_positive_notes.push("Reinforce correct physical placement, realistic contact with surface or body, natural shadow.");
    result.extra_negative_terms.push("floating", "wrong position", "incorrect placement", "no ground contact");
  }

  if (containsAny(text, [
    "parece ia", "muito fake", "artificial", "cgi", "not realistic",
    "parece computador", "parece falso", "nao parece foto", "muito digital",
  ])) {
    result.issue_types.push("realism");
    result.allowed_changes.push("lighting", "style", "textures");
    result.extra_positive_notes.push("Increase realism: authentic textures, natural cinematic lighting, real commercial photographic quality.");
    result.extra_negative_terms.push("cgi look", "fake lighting", "artificial textures", "synthetic feel", "digital art style");
  }

  if (containsAny(text, [
    "pessoa errada", "modelo errado", "pessoa nao era pra aparecer",
    "sem pessoa", "sem modelo", "so o produto",
  ])) {
    result.issue_types.push("unwanted_human");
    result.allowed_changes.push("human_presence");
    result.extra_positive_notes.push("Do not show any person, model, or human body. Product only.");
    result.extra_negative_terms.push("person", "model", "human body", "hands", "feet in frame");
  }

  result.issue_types = uniq(result.issue_types);
  result.allowed_changes = uniq(result.allowed_changes);
  result.extra_positive_notes = uniq(result.extra_positive_notes);
  result.extra_negative_terms = uniq(result.extra_negative_terms);

  return result;
}

// ── Entry point — geração completa ───────────────────────────────────────────

export function generatePromptV2({
  product_name,
  scene_request,
  vision_description,
  user_feedback,
}: {
  product_name?: string;
  scene_request?: string;
  vision_description?: string;
  user_feedback?: string;
}): PromptV2Result & { review?: ReviewResult } {
  const parsed = parseProductContext({ product_name, vision_description });
  const mode = classifyUsageMode({ product_name, vision_description });
  const agent = resolveUsageAgent(mode, parsed);

  let extra_positive_notes: string[] = [];
  let extra_negative_terms: string[] = [];
  let review: ReviewResult | undefined;

  if (user_feedback?.trim()) {
    const feedback = interpretFeedback(user_feedback);
    extra_positive_notes = feedback.extra_positive_notes;
    extra_negative_terms = feedback.extra_negative_terms;
    review = {
      approved: feedback.issue_types.length === 0,
      issues: feedback.issue_types,
      allowed_changes: feedback.allowed_changes,
      locked: ["product_identity"],
      fixes: {
        positive_additions: feedback.extra_positive_notes,
        negative_additions: feedback.extra_negative_terms,
      },
    };
  }

  const result = buildPromptV2({
    product_name: product_name || vision_description || "product",
    scene_request,
    vision_description,
    mode,
    agent,
    parsed,
    extra_positive_notes,
    extra_negative_terms,
  });

  return { ...result, ...(review ? { review } : {}) };
}
