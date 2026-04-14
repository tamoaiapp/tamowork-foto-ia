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
  const isMaleWord = hasAny(t, ["masculino", "homem", "menino", "boy", "male", "man", "masc", "noivo", "groom"]);
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

export function buildPromptResult(produtoRaw: string, cenarioRaw = ""): PromptResult {
  const produto = asciiSafe(produtoRaw, 180);
  const cenario = asciiSafe(cenarioRaw, 220);

  const rawSlot = inferSlot(produto);
  let slot = rawSlot;

  // Fallback if slot has no rule
  if (!loadRule(slot)) {
    if (slot.startsWith("wear_")) slot = RULES["wear_torso_full"] ? "wear_torso_full" : "scene_tabletop";
    else if (slot.startsWith("hold_")) slot = RULES["hold_display"] ? "hold_display" : "scene_tabletop";
    else if (slot.startsWith("install_")) slot = RULES["install_home_fixture"] ? "install_home_fixture" : "scene_tabletop";
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

  const pos: string[] = [];
  const neg: string[] = [];

  pos.push("Realistic commercial photo.");
  pos.push(`Product: ${productLabel}.`);

  // Ignora bordas, espaços vazios e artefatos de screenshot presentes na imagem de entrada
  pos.push(
    "IGNORE INPUT ARTIFACTS: The input image may contain black borders, white padding, gray borders, screenshot UI elements, watermarks, app interface elements, or empty space around the product. Ignore all of these completely.",
    "Focus exclusively on the actual physical product. Treat any black, white, or gray space surrounding the product as irrelevant background to be replaced.",
    "Do not reproduce black borders, white padding, or any screenshot-style framing in the output image.",
  );
  neg.push(
    "No black borders. No white padding. No gray borders. No screenshot framing. No app interface elements. No empty canvas borders. No letterbox bars. No pillarbox bars.",
    "Do not replicate the background color or framing style of the input image.",
  );

  if (cenario) {
    pos.push(`Scene/context: ${cenario}.`, "Use the scenario only as realistic environment support.", "The product must remain the main focus of the image.", "The background must not dominate the composition.", "Keep the scenario coherent with normal product usage.");
    neg.push("Do not let the background overpower the product.", "Do not make the scenario more important than the product.");
    if (hasViolence(cenario)) {
      neg.push("No violence.", "No threats.", "No aggressive action.", "No injury.", "No crime scene.");
    }
  }

  if (forceHum) {
    pos.push(
      `Subject: ${persona.subject}.`,
      "HUMAN REFERENCE REQUIRED.",
      "The human reference must show realistic scale and size.",
      "Use a real human. Replace any mannequin, bust, head form, dummy, display stand, or clothing hanger with a real human wearing the product.",
      "If the input image shows the product on a hanger, remove the hanger completely and show a real person wearing the product instead.",
      "If the input image shows the product on a mannequin or display, remove it and replace with a real person wearing the product.",
      "If the input image shows the product inside packaging, a box, a card, or a blister pack — remove the packaging completely and show only the product being worn or used by a real person.",
      "If the input image shows the product laid flat (flat lay on a bed, floor, or table), reconstruct it being actively worn by a real person instead.",
      "If the input image shows the product inside a plastic bag or garment bag, remove the bag completely and show the product worn by a real person.",
      "If the input image shows the product hanging on a wall hook, door handle, or chair back, remove it from there and show a real person wearing or holding it instead.",
      "CLEAN BACKGROUND REQUIRED: Remove ALL other objects from the background. Remove all other mannequins, clothing racks, store shelves, display stands, and store elements. Show only the person wearing the product against a clean, neutral, or lifestyle-appropriate background.",
      "If the original image was taken inside a store, showroom, or display window, completely replace the background with a clean studio or elegant lifestyle environment.",
      "Only one person must appear in the final image. Remove any other people, mannequins, or figures visible in the background.",
    );

    // Forçar gênero correto no modelo gerado
    if (persona.gender === "female") {
      pos.push("The model must be a woman. Female model only.");
      neg.push("No men. No male model. No man. No male anatomy. No masculine features. No male body.");
    } else if (persona.gender === "male") {
      pos.push("The model must be a man. Male model only.");
      neg.push("No women. No female model. No woman. No feminine features.");
    }
  }

  const rule = loadRule(slot);
  if (rule?.pos_add) pos.push(...rule.pos_add);
  if (rule?.neg_add) neg.push(...rule.neg_add);

  if (forceHum || refReq) {
    pos.push("If any packaging exists, remove it completely and use only the physical product.");
    neg.push("No packaging visible.");
  }

  if (refReq) {
    pos.push("Human reference is mandatory to define scale.", "The human reference must clearly communicate the real-world size of the product.", "Use a relevant body part as scale reference.", "The product must look realistically sized compared to the human reference.", "Do not exaggerate or miniaturize the scale.");
  } else {
    pos.push("The product must keep realistic size and proportion in the scene.", "Do not exaggerate or miniaturize the scale.");
  }

  if (DISPLAY_ONLY_HOLD.has(slot)) {
    // Display-only holds: remove any hands, product only
    pos.push("If a hand or fingers are present in the input photo, remove them. Keep only the product.");
    neg.push("No hands. No fingers. No person needed — product display only.");
  } else if (!slot.startsWith("hold_")) {
    pos.push("If a hand or fingers are present in the input photo, remove them. Keep only the product.");
    neg.push("No hands. No fingers.");
  } else {
    neg.push("No extra hands. Only one hand.");
  }

  pos.push("Keep the product exactly unchanged from the input image.", "Maintain real-world size and proportion of the product.", "Keep realistic perspective, lighting, and product placement.");
  neg.push("Do not change, redesign, stylize, resize, warp, or distort the product.", "Do not move the product to the wrong body location or wrong usage position.", "No text, logos, watermarks.", "No duplicate product.", "No extra objects distracting from the product.");

  if (forceHum) {
    neg.push(
      "No mannequin. No bust. No head form. No dummy. No display stand. No product on mannequin. No hanger. No clothing rail. No product hanging. No flat lay. No plastic bag. No garment bag. No product on hook. No product alone without person.",
      "No other mannequins in the background. No store display in background. No clothing rack in background. No store shelving in background. No shop window background. No retail environment. No other clothing items visible in background.",
      "No other people in the image. No crowd. No other figures. Only one person wearing the product.",
    );
  }

  neg.push("Do not invent decorations, fantasy elements, costumes, props, or themed add-ons.", "Do not reinterpret the product as a costume or novelty item.", "No floating product.", "No unrealistic glamour effects.");
  if (slot.startsWith("wear_")) {
    neg.push("No product-only photo. No packshot. Do not show the product alone.");
  }

  return {
    positive: asciiSafe(pos.join(" "), 1200),
    negative: asciiSafe(neg.join(" "), 1200),
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
