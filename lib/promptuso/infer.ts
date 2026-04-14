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

// Template de ação curto — estilo do workflow real do Qwen:
// "coloca essa mochila nas costas de uma criança na escola"
// Qwen é multimodal — vê o produto. O prompt só diz O QUE FAZER com ele.
function buildActionPhrase(slot: string, productLabel: string, subject: string, cenario: string): string {
  const prod = productLabel.toLowerCase();
  const cena = cenario ? `, ${cenario.toLowerCase()}` : "";

  const phrases: Record<string, string> = {
    wear_head_top:    `Put this ${prod} on the head of ${subject}${cena}.`,
    wear_head_face:   `Put this ${prod} on the face of ${subject}${cena}.`,
    wear_head_ear:    `Put this ${prod} on the ear of ${subject}${cena}.`,
    wear_neck:        `Put this ${prod} around the neck of ${subject}${cena}.`,
    wear_torso_upper: `Dress ${subject} wearing this ${prod}${cena}.`,
    wear_torso_full:  `Dress ${subject} wearing this ${prod}, full body shot${cena}.`,
    wear_waist_legs:  `Dress ${subject} wearing this ${prod} on their lower body${cena}.`,
    wear_feet:        `Show this ${prod} worn on the feet of ${subject}${cena}.`,
    wear_wrist:       `Put this ${prod} on the wrist of ${subject}${cena}.`,
    wear_finger:      `Put this ${prod} on a finger of ${subject}${cena}.`,
    wear_back:        `Put this ${prod} on the back of ${subject}${cena}.`,
    wear_crossbody:   `Show ${subject} wearing this ${prod} crossbody${cena}.`,
    hold_device:      `Show ${subject} holding this ${prod} naturally in hand${cena}.`,
    hold_bag_hand:    `Show ${subject} holding this ${prod} naturally in one hand${cena}.`,
    hold_tool_safe:   `Show ${subject} holding this ${prod} safely${cena}.`,
    hold_sport_object:`Show ${subject} using this ${prod} in sport context${cena}.`,
    hold_flower:      `Show ${subject} holding this bouquet with both hands at chest level${cena}. The flowers must be in the hands, not on the head.`,
    hold_beverage:    `Show ${subject} holding this ${prod} at chest level${cena}.`,
  };

  return phrases[slot] ?? `Show ${subject} using this ${prod} naturally${cena}.`;
}

export function buildPromptResult(produtoRaw: string, cenarioRaw = "", visionDesc?: string): PromptResult {
  const produto = asciiSafe(produtoRaw, 180);
  const cenario = asciiSafe(cenarioRaw, 220);
  const vision  = visionDesc ? asciiSafe(visionDesc, 300) : null;

  const rawSlot = inferSlot(produto);
  let slot = rawSlot;

  // Fallback se não tem rule para o slot
  if (!loadRule(slot)) {
    if (slot.startsWith("wear_")) slot = "wear_torso_full";
    else if (slot.startsWith("hold_")) slot = "hold_display";
    else if (slot.startsWith("install_")) slot = "install_home_fixture";
    else slot = "scene_tabletop";
  }

  const rule = loadRule(slot)!;
  const combinedContext = `${produto} ${cenario}`.trim();
  const mannequinDetected = detectMannequin(combinedContext);
  const persona = inferPersona(combinedContext, slot);

  // Visão da IA tem prioridade sobre o label de texto
  const productLabel = vision ?? normalizeProductLabel(produto);

  const DISPLAY_ONLY_HOLD = new Set([
    "hold_beauty_product", "hold_pet_product", "hold_food_display", "hold_display",
  ]);
  const refReq = (slot.startsWith("wear_") || slot.startsWith("hold_")) && !DISPLAY_ONLY_HOLD.has(slot);
  const forceHum = refReq || mannequinDetected;

  // ── Positivo: template curto de ação + rules.pos_add ──────────────────────
  // Qwen vê a imagem — o prompt só diz O QUE FAZER com o produto.
  // Template: "Put this [produto] on [persona] [cena]. [rules específicas do slot]"
  const pos: string[] = [];

  if (forceHum) {
    pos.push(buildActionPhrase(slot, productLabel, persona.subject, cenario));
    if (persona.gender === "female") pos.push("Female model only.");
    else if (persona.gender === "male") pos.push("Male model only.");
  } else {
    // Display / scene — sem pessoa
    if (cenario) pos.push(`${productLabel}, ${cenario}.`);
    else pos.push(`${productLabel}.`);
  }

  // Regras específicas do slot (pos_add do rules.ts)
  pos.push(...rule.pos_add);

  // ── Negativo: base simples + rules.neg_add ─────────────────────────────────
  const neg: string[] = [];

  // Base: não mude o produto
  neg.push("Do not change the product design, color, material or shape. Preserve all original details.");

  // Gênero
  if (forceHum) {
    if (persona.gender === "female") neg.push("No men. No male model.");
    else if (persona.gender === "male") neg.push("No women. No female model.");
  }

  // Regras específicas do slot (neg_add do rules.ts)
  neg.push(...rule.neg_add);

  // Qualidade básica
  neg.push("No black borders. No white padding. No watermark. No blurry image. No cartoon. No CGI.");

  if (hasViolence(cenario)) neg.push("No violence. No aggressive action.");

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
