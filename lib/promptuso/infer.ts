import { RULES, type Rule } from "./rules";

function asciiSafe(s = "", maxLen = 900): string {
  let t = String(s || "");
  try { t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch {}
  t = t
    .replace(/[""„‟]/g, '"')
    .replace(/[''‛‚]/g, "'")
    .replace(/[‐-‒–—―]/g, "-")
    .replace(/[`´]/g, "");
  t = t.replace(/[^\x20-\x7E]/g, "").trim().replace(/\s+/g, " ");
  if (t.length > maxLen) t = t.slice(0, maxLen).trim();
  return t;
}

function lower(s = ""): string {
  return asciiSafe(s, 500).toLowerCase();
}

function hasAny(text: string, arr: string[]): boolean {
  return arr.some((k) => text.includes(k));
}

// Word-boundary match — prevents "anel" matching "panelas", "cap" matching "capa", etc.
function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
}

function hasAnyWord(text: string, arr: string[]): boolean {
  return arr.some((w) => hasWord(text, w));
}

const ALL_SLOTS = Object.keys(RULES);

function loadRule(slot: string): Rule | null {
  return RULES[slot] ?? null;
}

function looksLikeFullBodyClothing(t: string): boolean {
  return (
    hasAny(t, [
      "vestido", "dress", "macacao", "macaquinho", "jardineira", "jumpsuit",
      "overall", "romper", "onesie", "pijama", "pijaminha", "pajama", "pyjama",
      "sleepwear", "roupa de dormir", "camisola", "nightgown", "baby doll",
      "babydoll", "conjunto pijama", "sleep set", "swimsuit", "maiô", "maio",
      "fantasia", "fantasia infantil", "sunga", "roupa de banho", "roupao", "robe",
    ]) || hasAnyWord(t, ["body"])
  );
}

function looksLikeUpperClothing(t: string): boolean {
  return (
    hasAny(t, [
      "camiseta", "camisa", "blusa", "regata", "cropped", "jaqueta", "moletom",
      "blazer", "colete", "cardigan", "sueter", "casaco", "t-shirt", "shirt",
      "hoodie", "sweatshirt", "polo", "uniforme", "kimono", "camisa social",
      "camisa polo", "bata", "suspensorio",
    ]) || hasAnyWord(t, ["top"])
  );
}

function looksLikeLowerClothing(t: string): boolean {
  return hasAny(t, [
    "calca", "bermuda", "shorts", "short", "saia", "legging", "pants", "jeans",
    "jogger", "moletom calca", "trouser", "cueca boxer", "calcao", "short saia",
    "saia shorts", "saia-calca", "segunda pele calca", "cinto", "belt",
    "joelheira", "cotoveleira", "caneleira", "knee pad", "knee brace", "elbow pad",
  ]);
}

function looksLikeFeetClothing(t: string): boolean {
  return hasAny(t, [
    "tenis", "sapato", "chinelo", "sandalia", "bota", "shoe", "shoes", "sneaker",
    "boot", "boots", "sandal", "sandals", "meia", "meias", "sock", "socks",
    "meiao", "pantufa", "slipper",
    // "tennis" = tradução de "tênis" (calçado) pelo MyMemory
    "tennis shoe", "tennis sneaker", "men's tennis", "women's tennis",
  ]);
}

function looksLikeSetClothing(t: string): boolean {
  return hasAny(t, [
    "conjunto", "conjuntinho", "conjunto de roupa", "conjunto infantil",
    "conjunto feminino", "conjunto masculino", "kit roupa", "kit de roupa",
    "look completo", "outfit set", "set de roupa",
  ]);
}

export function inferSlot(produtoText: string): string {
  const t = lower(produtoText);

  // Early checks to prevent false matches
  if (hasAny(t, ["luva", "glove", "gloves"])) return "wear_wrist";
  if (hasAny(t, ["conjunto de panelas", "kit de panelas", "jogo de panelas", "conjunto de talheres", "jogo de talheres", "jogo de cama", "jogo de banho"])) return "scene_home_indoor";

  if (hasAny(t, ["lampada", "farol", "headlight", "h1", "h3", "h4", "h7", "h8", "h11", "hb3", "hb4", "xenon", "automotivo", "carro", "moto", "vehicle"])) return "install_vehicle_fixture";
  if (hasAny(t, ["torneira", "chuveiro", "ducha", "tomada", "interruptor", "luminaria", "lampada de teto", "piso", "azulejo", "registro", "valvula", "encanamento", "fixture", "plumbing"])) return "install_home_fixture";
  if (hasAny(t, ["suporte", "gancho", "prateleira", "porta toalha", "porta papel", "wall mount", "wall bracket", "fixacao"])) return "install_wall_fixed";

  if (hasAny(t, ["celular", "smartphone", "iphone", "android", "tablet", "controle", "joystick", "gamepad", "camera", "gopro", "notebook", "laptop", "computador"])) return "hold_device";

  if (hasAny(t, ["viseira", "visor", "bone", "chapeu", "touca", "tiara", "arquinho", "headband", "hat", "gorro", "beanie"]) || hasAnyWord(t, ["cap"])) return "wear_head_top";
  if (hasAny(t, ["oculos", "glasses", "sunglasses", "mascara", "mask", "face shield"]) || hasAnyWord(t, ["face"])) return "wear_head_face";
  if (hasAny(t, ["brinco", "earring", "argola", "piercing", "in-ear", "in ear", "earbud", "fone intra", "fone de ouvido intra"])) return "wear_head_ear";
  if (hasAny(t, ["corrente", "gargantilha", "choker", "lenco", "scarf", "gravata"]) || hasAnyWord(t, ["colar", "tie"])) return "wear_neck";
  if (hasAny(t, ["pulseira", "bracelet", "relogio", "watch", "smartwatch", "munhequeira", "wristband"])) return "wear_wrist";
  if (hasAnyWord(t, ["anel", "ring"]) || hasAny(t, ["alianca"])) return "wear_finger";

  if (hasAny(t, ["mochila", "backpack"])) return "wear_back";
  if (hasAny(t, ["bolsa transversal", "crossbody", "tiracolo", "a tiracolo", "pochete transversal", "pochete", "fanny pack", "hip bag"])) return "wear_crossbody";

  if (hasAny(t, ["biquini", "bikini", "lingerie", "sutia", "calcinha", "cueca", "cueca boxer", "roupa intima", "underwear", "undergarment", "sunga", "roupa de banho", "swimwear"])) return "wear_torso_full";
  if (looksLikeFullBodyClothing(t)) return "wear_torso_full";
  if (looksLikeSetClothing(t)) return "wear_torso_full";

  if (hasAny(t, ["faca", "knife", "tesoura", "scissors", "canivete", "navalha", "lamina", "estilete", "box cutter", "martelo", "hammer", "chave de fenda", "chave inglesa", "wrench", "alicate", "pliers", "ferramenta"])) return "hold_tool_safe";
  if (looksLikeUpperClothing(t)) return "wear_torso_upper";
  if (looksLikeLowerClothing(t)) return "wear_waist_legs";
  if (looksLikeFeetClothing(t)) return "wear_feet";

  if (hasAny(t, ["bolsa", "handbag", "sacola", "bolsa de mao", "carteira"])) return "hold_bag_hand";
  if (hasAny(t, ["bolo", "torta", "doce", "brigadeiro", "salgado", "pizza", "hamburguer", "hamburger", "food", "snack"])) return "hold_food_display";
  if (hasAny(t, ["bola", "ball", "halter", "dumbbell", "peso", "raquete", "racket", "bodyboard", "skate", "patins"])) return "hold_sport_object";

  if (hasAny(t, ["boia", "inflavel", "piscina", "pool", "water", "aquatico", "aquatic"])) return "scene_water_surface";
  if (hasAny(t, ["campo", "quadra", "soccer", "football", "basketball", "sport", "treino", "training"])) return "scene_sport_environment";
  if (hasAny(t, ["painel", "volante", "vehicle interior", "interior do carro"])) return "scene_vehicle_interior";
  if (hasAny(t, ["quadro", "espelho", "parede", "wall art"])) return "scene_wall";
  if (hasAny(t, ["tapete", "carpet", "rug", "chao", "floor"])) return "scene_floor";
  if (hasAny(t, ["expositor", "shelf", "store", "loja", "gondola"])) return "scene_store_shelf";
  if (hasAny(t, [
    "porta retrato", "porta-retrato", "decoracao", "enfeite", "vaso", "abajur",
    "organizador", "vela", "difusor", "aromatizador", "porta-velas", "incenso",
    "jogo de cama", "lencol", "fronha", "edredom", "colcha", "manta",
    "capa de almofada", "almofada", "travesseiro", "toalha", "toalha de banho",
    "toalha de rosto", "roupao de banho", "panela", "frigideira", "wok",
    "cacarola", "utensilio de cozinha", "conjunto de panelas", "kit de panelas",
    "forma de assar", "assadeira", "faca de cozinha", "talheres",
    "conjunto de talheres", "porta objetos", "caixa organizadora",
  ])) return "scene_home_indoor";
  if (hasAny(t, ["jardim", "grama", "outdoor", "externo", "quintal", "rua"])) return "scene_outdoor_ground";

  // ── Flores e buquês — detectar ANTES do fallback para evitar que o modelo
  // coloque flores na cabeça da pessoa (viés "bride = flower crown")
  if (
    hasAny(t, [
      "buque", "bouquet", "ramalhete", "arranjo floral", "arranjo de flores",
      "floral arrangement", "flores do campo", "wildflowers",
      "astromelia", "alstroemeria", "girassol", "sunflower",
      "orquidea", "orchid", "margarida", "daisy", "lirio", "lily",
      "tulipa", "tulip", "peonia", "peony", "lavanda", "lavender",
      "rosas", "roses", "flower bouquet", "bridal bouquet", "wedding bouquet",
      "flores secas", "dried flowers", "flores artificiais", "artificial flowers",
      "flores de noiva", "bridal flowers", "flores de casamento",
    ]) ||
    hasAnyWord(t, ["flor", "flores", "flower", "flowers", "floral"])
  ) return "hold_flower";

  // ── Beleza, cosméticos e perfumes
  if (
    hasAny(t, [
      "perfume", "fragrance", "cologne", "eau de parfum", "eau de toilette",
      "creme", "cream", "locao", "lotion", "serum", "tonico", "tonic",
      "hidratante", "moisturizer", "protetor solar", "sunscreen", "spf",
      "maquiagem", "makeup", "batom", "lipstick", "esmalte", "nail polish",
      "sombra olhos", "eye shadow", "delineador", "eyeliner", "rimel",
      "blush", "contour", "highlighter", "base maquiagem", "foundation",
      "sabonete liquido", "body wash", "gel de banho", "shower gel",
      "shampoo", "condicionador", "conditioner", "mascara capilar",
      "oleo capilar", "hair oil", "leave-in", "queratina",
      "creme facial", "face cream", "toner", "micellar",
    ])
  ) return "hold_beauty_product";

  // ── Bebidas
  if (
    hasAny(t, [
      "bebida", "drink", "beverage",
      "suco", "juice", "néctar", "nectar",
      "refrigerante", "soda", "energetico", "energy drink",
      "vinho", "wine", "espumante", "sparkling wine", "champagne",
      "cerveja", "beer", "chopp", "ale", "lager",
      "whisky", "whiskey", "bourbon", "rum", "vodka", "gin", "tequila",
      "cachaça", "cachaca", "licor", "liqueur",
      "agua de coco", "coconut water",
      "cápsula de café", "capsula de cafe", "coffee capsule", "coffee pod",
      "garrafa", "bottle", "lata de", "can of",
    ])
  ) return "hold_beverage";

  // ── Produtos pet
  if (
    hasAny(t, [
      "coleira", "collar", "guia de cachorro", "leash", "pet", "cachorro", "gato",
      "racao", "dog food", "cat food", "petisco", "pet treat", "brinquedo pet",
      "cama pet", "caixa de areia", "arranhador", "bebedouro pet", "comedouro pet",
    ])
  ) return "hold_pet_product";

  // ── Suplementos, vitaminas, medicamentos (exibição de embalagem)
  if (
    hasAny(t, [
      "suplemento", "supplement", "whey", "creatina", "creatine", "proteina", "protein",
      "vitamina", "vitamin", "omega", "colageno", "collagen", "prebiotico", "probiotico",
      "termogenico", "thermogenic", "bcaa", "aminoacido", "amino acid",
      "remedio", "medicine", "medicamento", "comprimido", "tablet", "capsula medicamento",
    ])
  ) return "hold_beauty_product"; // mesmo estilo de exibição — frasco/embalagem upright

  return "scene_tabletop";
}

export interface Persona {
  subject: string;
  age: string;
  gender: string;
}

// Produtos inerentemente femininos — sempre geram modelo feminino independente do texto
const INHERENTLY_FEMALE_SLOTS = new Set([
  "wear_torso_full",  // vestido, macacao, lingerie, biquini, camisola
  "wear_waist_legs",  // saia
]);
const INHERENTLY_FEMALE_WORDS = [
  "vestido", "dress", "saia", "skirt", "lingerie", "biquini", "bikini",
  "sutia", "calcinha", "camisola", "nightgown", "baby doll", "babydoll",
  "conjunto feminino", "blusa feminina", "regata feminina", "cropped feminino",
  "maio", "maiô", "swimsuit feminino", "short feminino", "noiva", "bride",
  "dama de honra", "bridesmaid", "debutante",
];
const INHERENTLY_MALE_WORDS = [
  "sunga", "cueca", "cueca boxer", "terno masculino", "gravata masculina",
  "noivo", "groom",
];

export function inferPersona(text: string, slot?: string): Persona {
  const t = lower(text);
  const isBaby = hasAny(t, ["bebe", "beb", "baby", "newborn", "recem nascido", "recem-nascido", "recem nascida", "recem-nascida", "nenem", "onesie", "romper"]);
  const isChild = hasAny(t, ["infantil", "crianca", "criancas", "child", "children", "kid", "kids", "menino", "menina"]);
  const isTeen = hasAny(t, ["teen", "adolescente", "jovem", "juvenil", "teenager"]);

  // Palavras explícitas de gênero no texto
  const isMaleWord = hasAny(t, ["masculino", "homem", "menino", "boy", "male", "man", "men", "masc", "noivo", "groom"]);
  const isFemaleWord = hasAny(t, ["feminino", "mulher", "menina", "girl", "female", "woman", "fem", "noiva", "bride", "dama"]);
  const unisex = hasAny(t, ["unissex", "unisex"]);

  // Gênero inerente ao produto (mais forte que palavras no texto quando sem conflito explícito)
  const isInherentlyFemale = hasAny(t, INHERENTLY_FEMALE_WORDS) ||
    (slot !== undefined && INHERENTLY_FEMALE_SLOTS.has(slot) && !isMaleWord);
  const isInherentlyMale = hasAny(t, INHERENTLY_MALE_WORDS) && !isFemaleWord;

  let age = "adult";
  if (isBaby) age = "baby";
  else if (isChild) age = "child";
  else if (isTeen) age = "teen";

  let gender = "unisex";
  if (unisex && !isFemaleWord && !isMaleWord) gender = "unisex";
  else if (isMaleWord && !isFemaleWord && !isInherentlyFemale) gender = "male";
  else if (isFemaleWord && !isMaleWord) gender = "female";
  else if (isInherentlyFemale && !isMaleWord) gender = "female";
  else if (isInherentlyMale && !isFemaleWord) gender = "male";

  let subject = "a person";
  if (age === "baby") subject = "a baby";
  else if (age === "child") subject = gender === "male" ? "a boy" : gender === "female" ? "a girl" : "a child";
  else if (age === "teen") subject = gender === "male" ? "a teenage boy" : gender === "female" ? "a teenage girl" : "a teenager";
  else subject = gender === "male" ? "a man" : gender === "female" ? "a woman" : "a person";

  return { subject, age, gender };
}

function normalizeProductLabel(produtoText: string): string {
  const t = asciiSafe(produtoText, 140);
  const tl = lower(t);
  const removeWords = ["masculino","feminino","unissex","infantil","crianca","criancas","bebe","beb","adulto","adulta","adult","kids","kid","child","children","baby","homem","mulher","menino","menina","tamanho","tam","size","numero","num","cor","color","original","premium","novo","nova","new","kit","combo","look","outfit"];
  let cleaned = tl;
  for (const w of removeWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, "g"), " ");
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  const label = asciiSafe(cleaned, 80);
  return label.length >= 3 ? label : asciiSafe(produtoText, 80) || "the product";
}

function detectMannequin(text: string): boolean {
  const t = lower(text);
  return hasAny(t, ["manequim", "mannequin", "busto", "bust", "cabeca", "headform", "head form", "dummy", "display", "expositor", "suporte de exposicao"]);
}

function hasViolence(text: string): boolean {
  const t = lower(text);
  return hasAny(t, ["arma", "weapon", "violencia", "violence", "crime", "sangue", "blood", "agressivo", "aggressive", "assassino", "killer", "terror", "fight", "briga", "attack"]);
}

export interface PromptResult {
  positive: string;
  negative: string;
  produto: string;
  cenario: string;
  usage_anchor: string;
  meta: {
    raw_inferred_slot: string;
    final_slot: string;
    reference_required: boolean;
    force_human: boolean;
    mannequin_detected: boolean;
    subject: string;
    age: string;
    gender: string;
    product_label: string;
  };
}

// How the product is used/shown — tells Qwen WHERE and HOW to place it
function getUsageVerb(slot: string): string {
  const verbs: Record<string, string> = {
    wear_head_top:    "worn on the head of",
    wear_head_face:   "worn on the face of",
    wear_head_ear:    "worn on the ear of",
    wear_neck:        "worn around the neck of",
    wear_torso_upper: "worn on the upper body of",
    wear_torso_full:  "worn on the full body of",
    wear_waist_legs:  "worn on the lower body of",
    wear_feet:        "worn on the feet of",
    wear_wrist:       "worn on the wrist of",
    wear_finger:      "worn on a finger of",
    wear_back:        "worn on the back of",
    wear_crossbody:   "worn crossbody by",
    hold_device:      "held naturally in hand by",
    hold_bag_hand:    "held in one hand by",
    hold_tool_safe:   "held safely in hand by",
    hold_sport_object:"used in sport context by",
    hold_flower:      "held at chest level by",
    hold_beverage:    "held at chest level by",
  };
  return verbs[slot] ?? "used naturally by";
}

export function buildPromptResult(produtoRaw: string, cenarioRaw = ""): PromptResult {
  const produto = asciiSafe(produtoRaw, 180);
  const cenario = asciiSafe(cenarioRaw, 220);

  const rawSlot = inferSlot(produto);
  let slot = rawSlot;

  // Fallback if slot has no rule
  if (!loadRule(slot)) {
    if (slot.startsWith("wear_")) slot = "wear_torso_full";
    else if (slot.startsWith("hold_")) slot = "hold_display";
    else if (slot.startsWith("install_")) slot = "install_home_fixture";
    else slot = "scene_tabletop";
  }

  const combinedContext = `${produto} ${cenario}`.trim();
  const mannequinDetected = detectMannequin(combinedContext);
  const persona = inferPersona(combinedContext, slot);
  const productLabel = normalizeProductLabel(produto);

  // Slots hold_* que SÃO exibição de produto — não precisam de humano
  const DISPLAY_ONLY_HOLD = new Set([
    "hold_beauty_product",
    "hold_pet_product",
    "hold_food_display",
    "hold_display",
  ]);
  const refReq =
    (slot.startsWith("wear_") || slot.startsWith("hold_")) &&
    !DISPLAY_ONLY_HOLD.has(slot);
  const forceHum = refReq || mannequinDetected;

  // ── Short, vision-aware prompts ──────────────────────────────────────────
  // Qwen already SEES the input image via TextEncodeQwenImageEditPlus.
  // We tell it WHAT to produce, not HOW to interpret every possible input state.
  // The model handles the "if it's on a hanger... if it's flat..." part itself.
  const pos: string[] = [];
  const neg: string[] = [];

  // 1. Core task
  pos.push(`Transform this ${productLabel} into a professional catalog photo.`);

  // 2. How to show it — usage context
  if (forceHum) {
    const verb = getUsageVerb(slot);
    pos.push(`Show it ${verb} ${persona.subject} in a natural realistic pose.`);
    if (persona.gender === "female") pos.push("Female model only.");
    else if (persona.gender === "male") pos.push("Male model only.");
  } else if (DISPLAY_ONLY_HOLD.has(slot)) {
    pos.push("Display the product on a clean minimal surface, product only, no hands.");
  } else {
    pos.push("Place the product in a clean, realistic setting.");
  }

  // 3. Scene context from user
  if (cenario) {
    pos.push(`Setting: ${cenario}.`);
    if (hasViolence(cenario)) neg.push("No violence, no threats, no aggressive action, no crime scene.");
  }

  // 4. Preservation + quality
  pos.push(
    "Preserve exact colors, textures, and design from the input photo.",
    "Professional studio lighting, clean neutral background.",
    "Ignore black borders, white padding, or screenshot framing present in the input — focus only on the physical product.",
  );

  // 5. Negativos críticos por slot — ficam PRIMEIRO para nunca serem truncados
  if (slot === "hold_flower") {
    // Negativos críticos PRIMEIRO — evitam que Qwen coloque flores na cabeça (viés noiva = flower crown)
    neg.unshift(
      "Do NOT place flowers on the person's head. No flower crown. No floral headpiece. No hair flowers.",
      "The bouquet must be held in hands at chest level, NOT on the head or hair.",
    );
    pos.push("The person is holding the bouquet with both hands at chest level, facing the camera.");
  }

  if (slot === "wear_feet") {
    neg.push("No full body shot. No face visible. No upper body. Crop tightly from knee down only.");
    pos.push("Tight crop from knee to ground. Both shoes clearly visible, filling the frame.");
  }

  if (slot === "wear_head_ear") {
    neg.push("No hand holding the earring. No fingers in frame.");
  }

  // 6. Negativos gerais
  neg.push("No black borders, no white padding, no screenshot UI, no watermarks.");
  neg.push("No product redesign, no extra objects, no text overlay, no duplicate product, no floating product.");

  if (forceHum) {
    neg.push("No mannequin, no hanger, no flat lay, no product alone, no packaging, no retail background, no extra people.");
    if (persona.gender === "female") neg.push("No men, no male model, no masculine features, no beard.");
    else if (persona.gender === "male") neg.push("No women, no female model, no feminine features.");
  } else if (DISPLAY_ONLY_HOLD.has(slot)) {
    neg.push("No hands, no person, no packaging, no clutter.");
  } else {
    neg.push("No hands, no fingers.");
  }

  if (slot.startsWith("wear_")) {
    neg.push("Do not show the product alone without a person wearing it.");
  }

  return {
    positive: asciiSafe(pos.join(" "), 900),
    negative: asciiSafe(neg.join(" "), 700),
    produto,
    cenario,
    usage_anchor: slot,
    meta: {
      raw_inferred_slot: rawSlot,
      final_slot: slot,
      reference_required: refReq,
      force_human: forceHum,
      mannequin_detected: mannequinDetected,
      subject: persona.subject,
      age: persona.age,
      gender: persona.gender,
      product_label: productLabel,
    },
  };
}

export { ALL_SLOTS };
