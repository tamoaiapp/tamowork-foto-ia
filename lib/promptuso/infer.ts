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

// Frase de uso humano — "[Subject] [usagePhrase]"
// Retorna a frase completa de como a pessoa usa o produto
function getUsagePhrase(slot: string, subject: string): string {
  const s = subject; // "a woman", "a man", "a person", etc.
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  const map: Record<string, string> = {
    wear_head_top:    `${cap} is wearing the product on their head`,
    wear_head_face:   `${cap} is wearing the product on their face`,
    wear_head_ear:    `${cap} is wearing the product on their ear`,
    wear_neck:        `${cap} is wearing the product around their neck`,
    wear_torso_upper: `${cap} is wearing the product on their upper body`,
    wear_torso_full:  `${cap} is wearing the product, full body visible`,
    wear_waist_legs:  `${cap} is wearing the product on their lower body`,
    wear_feet:        `${cap} is wearing the product on their feet`,
    wear_wrist:       `${cap} is wearing the product on their wrist`,
    wear_finger:      `${cap} is wearing the product on a finger`,
    wear_back:        `${cap} is wearing the product as a backpack`,
    wear_crossbody:   `${cap} is wearing the product crossbody`,
    hold_device:      `${cap} is holding the product naturally in hand`,
    hold_bag_hand:    `${cap} is holding the product by the handle`,
    hold_tool_safe:   `${cap} is holding the product safely in hand`,
    hold_sport_object:`${cap} is using the product in a sport context`,
    hold_flower:      `${cap} is holding the bouquet with both hands at chest level, facing camera`,
    hold_beverage:    `${cap} is holding the product at chest level`,
  };
  return (map[slot] ?? `${cap} is using the product naturally`) + " in a natural realistic pose.";
}

export function buildPromptResult(produtoRaw: string, cenarioRaw = "", visionDesc?: string): PromptResult {
  const produto = asciiSafe(produtoRaw, 180);
  const cenario = asciiSafe(cenarioRaw, 220);
  const vision  = visionDesc ? asciiSafe(visionDesc, 300) : null;

  // Slot + persona: sempre baseados no texto original (keywords PT/ES funcionam melhor)
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

  // Descrição do produto para o prompt:
  // - visão da IA (mais precisa, em EN) tem prioridade absoluta
  // - fallback: label normalizado do texto do usuário
  const productLabel = vision ?? normalizeProductLabel(produto);

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

  // ── Prompt estruturado em blocos fixos ────────────────────────────────────
  // Qwen Image Edit é multimodal — vê a imagem E processa o texto.
  const pos: string[] = [];
  const neg: string[] = [];

  // ── CASO ESPECIAL: hold_flower ─────────────────────────────────────────────
  // Qwen img2img com foto de buquê "edita" o que vê → melhora o buquê, não gera pessoa.
  // Solução: prompt orientado à CENA (retrato de pessoa), com buquê como prop de referência.
  if (slot === "hold_flower") {
    const sceneCtx = cenario || (persona.gender === "female" ? "wedding ceremony, church aisle, soft natural light" : "outdoor garden, daylight");
    const subjectDesc = persona.gender === "female" ? "a beautiful bride in a white wedding dress" : persona.gender === "male" ? "a man in formal attire" : "a person";
    const bouquetDesc = productLabel;

    pos.push(
      `Professional wedding portrait photograph.`,
      `${subjectDesc.charAt(0).toUpperCase() + subjectDesc.slice(1)} is holding a bouquet with both hands at chest level.`,
      `The bouquet held in her hands must look exactly like the reference image: ${bouquetDesc}.`,
      `Preserve the exact flowers, colors, shape, ribbon, and all details of the bouquet from the reference photo.`,
      cenario ? `Setting: ${cenario}.` : `Setting: ${sceneCtx}.`,
      `Natural soft light, realistic shadows, professional photography, full portrait or half-body shot.`,
    );
    // Negativos: flower crown primeiro, depois qualidade
    neg.push(
      "flowers on head, flower crown, floral headpiece, hair flowers, bouquet on head,",
      "product alone without person, bouquet floating, no hands, product on table, product on plate,",
      "wrong bouquet design, different flowers, different colors, changed ribbon,",
      "blurry, low resolution, grainy, cartoon, illustration, CGI, plastic look, bad anatomy, extra fingers, malformed hands,",
      "men visible,",
    );

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

  // ── Blocos padrão: [tipo] → [produto] → [preservação] → [uso] → [cena] → [foto] ──

  // Bloco 1 — tipo de imagem
  pos.push("High-quality realistic commercial photo of");

  // Bloco 2 — produto descrito fielmente (visão da IA ou label)
  pos.push(`${productLabel}.`);

  // Bloco 3 — regra de fidelidade (SEMPRE presente)
  pos.push("The product must preserve its exact original design, color, material, proportions, and all visible details from the reference image.");

  // Bloco 4 — uso / posição
  if (forceHum) {
    pos.push(getUsagePhrase(slot, persona.subject));
    if (persona.gender === "female") pos.push("Female model, no men visible.");
    else if (persona.gender === "male") pos.push("Male model, no women visible.");
  } else if (DISPLAY_ONLY_HOLD.has(slot)) {
    pos.push("The product is the hero — clean minimal display on a neutral surface, no hands, no people.");
  } else {
    pos.push("The product is placed in a clean, realistic setting.");
  }

  // Bloco 5 — cena do usuário
  if (cenario) {
    pos.push(`Scene: ${cenario}.`);
    if (hasViolence(cenario)) neg.push("no violence, no threats, no aggressive action, no crime scene,");
  }

  // Bloco 6 — fotografia profissional
  pos.push(
    "Natural realistic textures, professional product photography, authentic proportions, clean composition, realistic shadows.",
    "Ignore any black borders, white padding, or screenshot framing in the input — focus only on the physical product.",
  );

  if (slot === "wear_feet") {
    neg.unshift("no full body shot, no face, no upper body,");
    pos.push("Tight crop from knee to ground. Both shoes clearly visible, filling the frame.");
  }

  if (slot === "wear_head_ear") {
    neg.unshift("no hand holding the earring, no fingers near ear,");
  }

  // ── Negativos de fidelidade ao produto (sempre presentes) ──────────────────
  neg.push(
    "wrong product design, altered shape, different color, different material, changed structure, missing details, duplicated product, distorted proportions, unrealistic texture, warped object, floating object,",
    "random text, watermark, incorrect logo, black border, white padding, screenshot UI,",
  );

  // ── Negativos de qualidade ────────────────────────────────────────────────
  neg.push(
    "blurry image, low resolution, out of focus, grainy, oversaturated, plastic look, CGI look, cartoon, illustration, painting, deformed perspective, bad anatomy,",
  );

  // ── Negativos humanos (quando tem pessoa) ─────────────────────────────────
  if (forceHum) {
    neg.push("extra fingers, malformed hands, broken composition, mannequin, hanger, flat lay, product alone, packaging, retail background, extra people,");
    if (persona.gender === "female") neg.push("men, male model, masculine features, beard,");
    else if (persona.gender === "male") neg.push("women, female model, feminine features,");
  } else if (DISPLAY_ONLY_HOLD.has(slot)) {
    neg.push("hands, fingers, person, packaging, clutter,");
  }

  if (slot.startsWith("wear_")) {
    neg.push("product alone without person wearing it,");
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
