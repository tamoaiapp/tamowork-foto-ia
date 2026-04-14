/**
 * displayPrompt.ts — Modo "Produto Exposto"
 *
 * Gera prompts literais e diretos para exibição profissional de produtos.
 * O modelo de imagem é literal — sem poesia, sem metáforas.
 * Cada instrução deve ser clara, objetiva e específica.
 *
 * Fluxo:
 *   visionDescription → detectDisplayCategory → buildDisplayPrompt
 */

export type DisplayCategory =
  | "clothing"
  | "jewelry"
  | "perfume"
  | "shoes"
  | "bag"
  | "electronics"
  | "food"
  | "generic";

function lower(s: string) {
  return (s ?? "").toLowerCase();
}

/** Detecta a categoria de produto a partir da descrição da visão */
export function detectDisplayCategory(visionDescription: string): DisplayCategory {
  const t = lower(visionDescription);

  if (/dress|shirt|blouse|pants|skirt|jacket|coat|hoodie|sweater|jeans|shorts|suit|blazer|top|vest|cardigan|legging|romper|jumpsuit|polo|tee|t-shirt|uniform|clothing|garment|apparel|wear|outfit|costume|robe|nightgown|swimsuit|lingerie|underwear|bra|sock|hat|cap|scarf|glove|vestido|camisa|blusa|calça|saia|casaco|roupa|conjunto|moletom|jaqueta|jaqueta|terno|suéter/.test(t)) {
    return "clothing";
  }

  if (/ring|necklace|bracelet|earring|pendant|chain|jewel|brooch|watch|jewelry|jewellery|bangle|anklet|cuff|bijou|anel|colar|brinco|pulseira|corrente|relógio|bijou/.test(t)) {
    return "jewelry";
  }

  if (/perfume|cologne|fragrance|scent|eau de|bottle|spray|parfum|cosmetic|serum|cream|lotion|moisturizer|lipstick|mascara|foundation|blush|makeup|beauty|skincare|shampoo|conditioner|perfume|frasco|colônia|creme|sérum|hidratante|batom|maquiagem/.test(t)) {
    return "perfume";
  }

  if (/shoe|boot|sneaker|sandal|heel|loafer|moccasin|slipper|footwear|oxford|derby|pump|wedge|flat|tênis|sapato|bota|chinelo|sandália|salto|mocassim/.test(t)) {
    return "shoes";
  }

  if (/bag|purse|handbag|backpack|tote|clutch|wallet|pouch|satchel|crossbody|briefcase|luggage|bolsa|mochila|carteira|pochete|maleta|necessaire/.test(t)) {
    return "bag";
  }

  if (/phone|smartphone|laptop|tablet|headphone|speaker|camera|keyboard|mouse|monitor|charger|cable|device|electronics|gadget|celular|fone|notebook/.test(t)) {
    return "electronics";
  }

  if (/food|snack|chocolate|candy|coffee|tea|juice|cookie|cake|bread|fruit|vegetable|sauce|oil|honey|jam|comida|alimento|biscoito|doce|café|suco|bolo|pão/.test(t)) {
    return "food";
  }

  return "generic";
}

interface DisplayPromptResult {
  positive: string;
  negative: string;
}

/** Constrói prompt literal e direto para exibição de produto em loja */
export function buildDisplayPrompt(
  productDescription: string,
  category: DisplayCategory
): DisplayPromptResult {
  const prod = productDescription.trim() || "the product";

  switch (category) {
    case "clothing":
      return {
        positive: [
          `A headless white retail mannequin wearing ${prod}.`,
          `The mannequin stands upright on a clean white circular platform.`,
          `Pure white seamless background. No people. No faces. No heads on mannequin.`,
          `The garment is perfectly fitted, smooth, and wrinkle-free on the mannequin.`,
          `Premium boutique store display lighting: soft overhead spotlights, no harsh shadows.`,
          `Full body shot showing the complete garment from top to bottom.`,
          `Editorial fashion retail display, professional commercial photography.`,
          `The product is the only item in the scene.`,
        ].join(" "),
        negative: [
          "human face, head, hair, hands, skin, person wearing clothes,",
          "mannequin head, face on mannequin,",
          "clothing on hanger, flat lay, product on floor,",
          "multiple mannequins, busy background, store clutter, rack, shelf,",
          "blurry, low quality, watermark, text, logo.",
        ].join(" "),
      };

    case "jewelry":
      return {
        positive: [
          `${prod} displayed on a black velvet jewelry display stand.`,
          `The product is placed at the center of the frame, perfectly lit.`,
          `Dark or pure black background. Dramatic jewelry store spotlight from directly above.`,
          `The light creates a subtle golden reflection on the velvet surface.`,
          `Luxury jewelry boutique display style. Close-up product photography.`,
          `Every detail of the product is sharp and visible.`,
          `The product is the only item in the image.`,
        ].join(" "),
        negative: [
          "person, hand, finger, skin, body part,",
          "messy background, multiple items, other jewelry,",
          "blurry, low quality, watermark, text, logo.",
        ].join(" "),
      };

    case "perfume":
      return {
        positive: [
          `${prod} standing upright on a white marble flat surface.`,
          `One product only, perfectly centered, front-facing label visible.`,
          `Pure white or very light gray background.`,
          `Soft studio lighting from above and both sides, creating subtle reflections on the marble.`,
          `Luxury beauty retail display. Premium cosmetics store aesthetic.`,
          `The product is clean, perfectly positioned, with no fingerprints or smudges visible.`,
          `Commercial product photography, razor-sharp focus on the product.`,
        ].join(" "),
        negative: [
          "person, hand, finger, skin,",
          "multiple products, cluttered background, busy scene,",
          "blurry, reflections hiding label, watermark, text, logo.",
        ].join(" "),
      };

    case "shoes":
      return {
        positive: [
          `${prod} displayed on a white minimalist cylindrical pedestal, positioned at a 3/4 angle.`,
          `Pure white seamless background. No people. No feet.`,
          `One shoe displayed clearly showing the complete design from heel to toe.`,
          `Professional footwear retail photography lighting: soft overhead light, subtle shadow beneath.`,
          `Premium shoe store display style. Editorial footwear photography.`,
          `The product is the only item in the scene, centered on the pedestal.`,
        ].join(" "),
        negative: [
          "person, foot, leg, skin, body part,",
          "pair of shoes (show only one shoe),",
          "busy background, floor display, multiple products,",
          "blurry, low quality, watermark, text, logo.",
        ].join(" "),
      };

    case "bag":
      return {
        positive: [
          `${prod} placed upright and open on a clear acrylic display stand.`,
          `Pure white seamless background. No people. No hands holding the bag.`,
          `The bag stands on its own, structured and perfectly shaped.`,
          `Professional retail lighting: soft key light from the left, subtle fill from the right.`,
          `Premium fashion accessory store display. Luxury boutique aesthetic.`,
          `All details of the bag are visible: hardware, stitching, logo if present.`,
          `Commercial product photography, the product is the only item in the scene.`,
        ].join(" "),
        negative: [
          "person, hand, finger, skin, body part holding bag,",
          "bag hanging on hook, flat lay bag, collapsed bag,",
          "multiple bags, busy background, clutter,",
          "blurry, low quality, watermark, text, logo.",
        ].join(" "),
      };

    case "electronics":
      return {
        positive: [
          `${prod} displayed on a minimalist dark matte surface.`,
          `Pure black or very dark gray background. Premium tech product display.`,
          `Dramatic side lighting creating a crisp product silhouette.`,
          `The product is centered and perfectly positioned, showing the main face/screen.`,
          `Apple Store display aesthetic. Premium electronics retail style.`,
          `Clean, modern, minimalist. The product is the only item in the scene.`,
        ].join(" "),
        negative: [
          "person, hand, finger, skin,",
          "messy desk, cables, clutter, other devices,",
          "blurry, low quality, watermark, text overlaid, logo added by editor.",
        ].join(" "),
      };

    case "food":
      return {
        positive: [
          `${prod} displayed on a rustic wooden tray on a clean white marble surface.`,
          `Natural soft light from the left side, warm and inviting atmosphere.`,
          `Minimal styling: one or two complementary natural props (herbs, cloth napkin).`,
          `Food photography style: slightly top-down angle (45 degrees), product centered.`,
          `Premium artisanal food store display aesthetic.`,
          `The product is the hero of the image, sharp and appetizing.`,
        ].join(" "),
        negative: [
          "person, hand, finger, skin,",
          "too many props, cluttered composition, messy styling,",
          "blurry, unappetizing, dark image, watermark, text, logo.",
        ].join(" "),
      };

    case "generic":
    default:
      return {
        positive: [
          `${prod} displayed on a premium white rectangular display platform/pedestal.`,
          `Pure white seamless background. Professional studio environment.`,
          `The product is centered, upright, and perfectly positioned on the stand.`,
          `Soft studio lighting from above, subtle shadow beneath the product.`,
          `Premium retail display quality. The product is the only item in the scene.`,
          `Commercial product photography, sharp focus, no distractions.`,
        ].join(" "),
        negative: [
          "person, hand, finger, skin, body part,",
          "multiple products, busy background, shelf, rack, clutter,",
          "blurry, low quality, watermark, text, logo.",
        ].join(" "),
      };
  }
}
