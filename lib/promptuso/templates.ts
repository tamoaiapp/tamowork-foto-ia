/**
 * templates.ts — Templates de prompt por tipo de produto.
 *
 * Cada template eh CURTO, IMPERATIVO e contem apenas o que o Qwen
 * Image Edit precisa. Sem keywords/regex.
 *
 * Substitui o multiagent.ts (que classificava por substring frágil).
 */

import type { ProductType, TargetUser, VisionResult } from "./visionRouter";

export interface PromptInput {
  vision: VisionResult;
  user_product_text: string;   // texto que o usuario digitou pro produto
  scene_text_en: string;       // cenario do usuario, ja traduzido pra ingles
  user_feedback?: string;
}

export interface PromptOutput {
  positive: string;
  negative: string;
  shot_type: string;
  presentation: "worn" | "carried" | "displayed" | "placed";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function humanPhrase(user: TargetUser, age?: number): string {
  if (user === "no_human") return "no person, product only";
  if (user === "child_girl") return age ? `${age}-year-old girl` : "young girl";
  if (user === "child_boy") return age ? `${age}-year-old boy` : "young boy";
  if (user === "adult_female") return "adult woman";
  if (user === "adult_male") return "adult man";
  return "adult person"; // unisex
}

function quality(): string {
  return "Professional commercial photography, sharp focus, natural lighting, realistic textures, 8K detail.";
}

function baseNeg(): string {
  return [
    "blurry, low quality, pixelated, jpeg artifacts, noise, watermark, text, signature, logo overlay",
    "wrong color, wrong shape, wrong material, altered design, redesigned product, different product",
    "mannequin, dummy, bust form, clothing hanger, clothing rack, price tag, hang tag, store shelf, store background, retail display, showroom, packaging, plastic bag",
    "deformed hands, bad anatomy, extra fingers, missing fingers, distorted face",
    "cartoon, CGI, illustration, painting, drawing",
  ].join(", ");
}

// ── TEMPLATES POR TIPO ──────────────────────────────────────────────────────

function clothingTorso({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user, vision.age_years);
  const scene = scene_text_en || "clean professional studio";
  return {
    positive: [
      `Place the EXACT garment shown in the reference image on a real ${human}.`,
      `Preserve every detail of the garment identical to the reference — same color, same print, same fabric, same shape, same neckline, same hem length.`,
      `The garment is worn on the torso, covering the upper body, fully visible from shoulders to hem of the garment.`,
      `The ${human} stands naturally in ${scene}.`,
      `Full-body or mid-body commercial fashion shot.`,
      quality(),
    ].join(" "),
    negative: [
      "garment as wristband, garment as bracelet, garment on wrist, garment on forearm, fabric on arm",
      "tiny garment, miniaturized clothing, garment fragment, partial garment, only print visible",
      "wrong size, oversized, undersized, garment floating, garment not worn",
      baseNeg(),
    ].join(", "),
    shot_type: "full-body or mid-body",
    presentation: "worn",
  };
}

function clothingFull({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user, vision.age_years);
  const scene = scene_text_en || "clean professional studio";
  return {
    positive: [
      `Place the EXACT garment shown in the reference image on a real ${human}.`,
      `Preserve every detail identical to the reference — same color, same print, same fabric, same cut, same length.`,
      `The garment drapes naturally on the body, fully visible from shoulders to hem.`,
      `The ${human} stands in a natural pose in ${scene}.`,
      `Full-body commercial fashion shot showing the entire garment.`,
      quality(),
    ].join(" "),
    negative: [
      "garment fragment, partial dress, cropped fabric, garment on wrist or arm only",
      "wrong length, wrong silhouette, altered cut",
      baseNeg(),
    ].join(", "),
    shot_type: "full-body",
    presentation: "worn",
  };
}

function clothingLower({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user, vision.age_years);
  const scene = scene_text_en || "clean professional studio";
  return {
    positive: [
      `Place the EXACT lower-body garment shown in the reference image on a real ${human}.`,
      `Preserve color, print, fabric, fit, and length identical to the reference.`,
      `The garment is worn on the lower body, fully visible from waist to ankle.`,
      `The ${human} stands naturally in ${scene}.`,
      `Full-body shot with neutral simple top and shoes.`,
      quality(),
    ].join(" "),
    negative: [
      "wrong length, wrong fit, garment as accessory, fabric on arm or head",
      baseNeg(),
    ].join(", "),
    shot_type: "full-body",
    presentation: "worn",
  };
}

function footwear({ vision, scene_text_en }: PromptInput): PromptOutput {
  const scene = scene_text_en || "clean realistic floor surface";
  return {
    positive: [
      `Show the EXACT pair of shoes from the reference image worn on real human feet.`,
      `Preserve every detail of the shoes identical to the reference — same color, same shape, same material, same sole, same laces or details.`,
      `Knee-to-ground framing, shoes are the hero of the shot.`,
      `Realistic ground contact with natural shadow.`,
      `Setting: ${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "floating shoes, wrong foot position, deformed feet, wrong scale, shoes as accessory",
      baseNeg(),
    ].join(", "),
    shot_type: "knee-to-ground",
    presentation: "worn",
  };
}

function jewelryRing({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user);
  const scene = scene_text_en || "soft neutral background";
  return {
    positive: [
      `Show the EXACT ring from the reference image worn on the finger of a real ${human}.`,
      `Preserve every detail of the ring — same metal, same stone, same shape, same engravings.`,
      `Macro close-up of the hand, ring clearly visible on the correct finger.`,
      `${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "deformed fingers, extra fingers, wrong finger placement, floating ring, blurry hand, dirty nails",
      baseNeg(),
    ].join(", "),
    shot_type: "macro hand close-up",
    presentation: "worn",
  };
}

function jewelryNeck({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user);
  const scene = scene_text_en || "elegant soft background";
  return {
    positive: [
      `Show the EXACT necklace from the reference image worn around the neck of a real ${human}.`,
      `Preserve every detail of the necklace — same chain, same pendant, same color.`,
      `Close-up of neckline, necklace clearly visible draped naturally.`,
      `${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "necklace fragmented, broken chain, wrong pendant, necklace not draped, floating",
      baseNeg(),
    ].join(", "),
    shot_type: "neckline close-up",
    presentation: "worn",
  };
}

function jewelryEar({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user);
  const scene = scene_text_en || "soft elegant background";
  return {
    positive: [
      `Show the EXACT earring from the reference image worn on the earlobe of a real ${human}.`,
      `Preserve every detail of the earring — same shape, same color, same material.`,
      `Tight close-up portrait, ear and earring clearly visible.`,
      `${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "earring not on ear, earring on hand, wrong ear placement, deformed ear",
      baseNeg(),
    ].join(", "),
    shot_type: "ear close-up",
    presentation: "worn",
  };
}

function jewelryWrist({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user);
  const scene = scene_text_en || "elegant soft background";
  return {
    positive: [
      `Show the EXACT bracelet or watch from the reference image worn on the wrist of a real ${human}.`,
      `Preserve every detail — same metal, same color, same design.`,
      `Close-up of the wrist, item clearly visible.`,
      `${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "wrong wrist placement, floating bracelet, deformed wrist",
      baseNeg(),
    ].join(", "),
    shot_type: "wrist close-up",
    presentation: "worn",
  };
}

function eyewear({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user);
  const scene = scene_text_en || "natural soft background";
  return {
    positive: [
      `Show the EXACT eyewear from the reference image worn on the face of a real ${human}.`,
      `Preserve every detail of the frames and lenses identical to the reference.`,
      `Close-up portrait, face and glasses fill the frame.`,
      `${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "glasses in hand, glasses on top of head, floating glasses, wrong fit, tiny glasses",
      baseNeg(),
    ].join(", "),
    shot_type: "face portrait",
    presentation: "worn",
  };
}

function hat({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user);
  const scene = scene_text_en || "soft natural background";
  return {
    positive: [
      `Show the EXACT hat or cap from the reference image worn on the head of a real ${human}.`,
      `Preserve every detail of the hat — same shape, same color, same logo or print.`,
      `Half-body or close-up portrait, hat prominently visible on head.`,
      `${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "hat in hand, floating hat, tiny hat, wrong fit",
      baseNeg(),
    ].join(", "),
    shot_type: "half-body or close-up",
    presentation: "worn",
  };
}

function bag({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user, vision.age_years);
  const scene = scene_text_en || "clean lifestyle setting";
  return {
    positive: [
      `Show the EXACT bag from the reference image being carried by a real ${human}.`,
      `Preserve every detail of the bag — same color, same print, same shape, same straps, same hardware, same logo and text.`,
      `Keep the bag AS A BAG — do not convert it into a t-shirt, into a print on clothing, or into any other type of item.`,
      `The bag is carried in a natural fashion pose (over shoulder, crossbody, or on back if backpack).`,
      `${scene}.`,
      `Full-body or mid-body lifestyle commercial shot, bag prominently visible.`,
      quality(),
    ].join(" "),
    negative: [
      "bag converted to t-shirt, bag print on clothing, bag pattern on garment, derived item",
      "bag as wallpaper, bag as background pattern, floating bag, deformed bag",
      "tiny bag, miniature bag, bag worn as bracelet",
      baseNeg(),
    ].join(", "),
    shot_type: "lifestyle fashion shot",
    presentation: "carried",
  };
}

function accessoryHeld({ vision, scene_text_en }: PromptInput): PromptOutput {
  const human = humanPhrase(vision.target_user);
  const scene = scene_text_en || "elegant lifestyle background";
  return {
    positive: [
      `Show the EXACT product from the reference image being held by a real ${human}.`,
      `Preserve every detail — same color, same shape, same label, same brand text.`,
      `Natural hand pose, realistic grip, item clearly visible.`,
      `${scene}.`,
      quality(),
    ].join(" "),
    negative: [
      "item converted to different product, floating item, deformed hand, item not held",
      baseNeg(),
    ].join(", "),
    shot_type: "half-body lifestyle",
    presentation: "carried",
  };
}

function productDisplay({ vision, scene_text_en }: PromptInput): PromptOutput {
  const scene = scene_text_en || "clean premium surface with soft natural light";
  const countPhrase = vision.items_count > 1
    ? `The reference image shows a set of ${vision.items_count} items. ALL ${vision.items_count} items must appear in the final scene, each as its original product type, arranged together as a beautiful product set.`
    : "";
  return {
    positive: [
      `Photograph the EXACT product(s) from the reference image as the hero of a commercial product shot.`,
      countPhrase,
      `Preserve every detail of each item — same color, same print, same shape, same materials.`,
      `Each item appears as its original product type — DO NOT convert any item into a t-shirt, into a print on clothing, or merge prints across items.`,
      `${scene}.`,
      `No person in the scene — product photography only.`,
      `Top-down or 45-degree angle, clean composition, realistic shadow.`,
      quality(),
    ].filter(Boolean).join(" "),
    negative: [
      "person, model, human, body parts, hands, arms",
      "product converted to t-shirt, print copied onto clothing, derived item, missing items from set",
      "cluttered background, distracting props, low resolution",
      baseNeg(),
    ].join(", "),
    shot_type: "product display",
    presentation: "displayed",
  };
}

function food({ vision, scene_text_en }: PromptInput): PromptOutput {
  const scene = scene_text_en || "rustic wooden table with soft natural window light";
  return {
    positive: [
      `Photograph the EXACT food item from the reference image as the hero of a food photography shot.`,
      `Preserve every visible detail — color, texture, garnishes, plating.`,
      `${scene}.`,
      `Top-down or 45-degree angle, appetizing presentation.`,
      quality(),
    ].join(" "),
    negative: [
      "person, hands holding food, unrealistic food, plastic-looking food",
      baseNeg(),
    ].join(", "),
    shot_type: "food photography",
    presentation: "displayed",
  };
}

function furniture({ vision, scene_text_en }: PromptInput): PromptOutput {
  const scene = scene_text_en || "well-designed realistic room";
  return {
    positive: [
      `Place the EXACT furniture/home item from the reference image in a realistic room scene.`,
      `Preserve every detail — same color, same material, same shape, same finish.`,
      `${scene}.`,
      `Tasteful interior design, natural lighting, realistic floor/wall contact.`,
      quality(),
    ].join(" "),
    negative: [
      "floating furniture, wrong scale, unrealistic placement",
      baseNeg(),
    ].join(", "),
    shot_type: "interior shot",
    presentation: "placed",
  };
}

function toy({ vision, scene_text_en }: PromptInput): PromptOutput {
  const scene = scene_text_en || "playful child-themed setting";
  return {
    positive: [
      `Photograph the EXACT toy from the reference image as the hero of a product shot.`,
      `Preserve every detail of the toy.`,
      `${scene}.`,
      `Bright colorful composition, eye-level or slight top-down angle.`,
      quality(),
    ].join(" "),
    negative: [
      "toy converted to clothing or accessory, derived item, missing parts",
      baseNeg(),
    ].join(", "),
    shot_type: "product hero",
    presentation: "displayed",
  };
}

function unknownFallback({ vision, scene_text_en, user_product_text }: PromptInput): PromptOutput {
  const scene = scene_text_en || "clean commercial background";
  const desc = vision.description || user_product_text || "product";
  return {
    positive: [
      `Show the EXACT product from the reference image: ${desc}.`,
      `Preserve every visible detail identical to the reference — color, print, shape, material.`,
      `Keep the product as the same TYPE of item shown in the reference — do not convert into a different category.`,
      `${scene}.`,
      `Commercial product photography.`,
      quality(),
    ].join(" "),
    negative: [
      "product converted to different item, derived item, fragment of product",
      baseNeg(),
    ].join(", "),
    shot_type: "commercial product",
    presentation: "displayed",
  };
}

// ── DISPATCHER ──────────────────────────────────────────────────────────────

export function buildPromptByType(input: PromptInput): PromptOutput {
  const t: ProductType = input.vision.product_type;
  switch (t) {
    case "clothing_torso":  return clothingTorso(input);
    case "clothing_full":   return clothingFull(input);
    case "clothing_lower":  return clothingLower(input);
    case "footwear":        return footwear(input);
    case "jewelry_ring":    return jewelryRing(input);
    case "jewelry_neck":    return jewelryNeck(input);
    case "jewelry_ear":     return jewelryEar(input);
    case "jewelry_wrist":   return jewelryWrist(input);
    case "eyewear":         return eyewear(input);
    case "hat":             return hat(input);
    case "bag":             return bag(input);
    case "accessory_held":  return accessoryHeld(input);
    case "product_display": return productDisplay(input);
    case "food":            return food(input);
    case "furniture":       return furniture(input);
    case "toy":             return toy(input);
    default:                return unknownFallback(input);
  }
}
