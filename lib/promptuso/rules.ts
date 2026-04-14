export interface Rule {
  pos_add: string[];
  neg_add: string[];
}

// REGRAS DE OURO:
// 1. Nunca usar "if" — Qwen não executa lógica condicional
// 2. Nunca descrever o erro no positivo — mencionar "hand" planta "hand" no modelo
// 3. Negativos = palavras-chave diretas, não frases longas
// 4. Sempre travar enquadramento e posição física exata

export const RULES: Record<string, Rule> = {
  wear_head_top: {
    pos_add: [
      "The product is worn on the top of the head, correct orientation and realistic scale.",
      "Natural fit, centered on the head, realistic proportion relative to the face.",
      "Lifestyle portrait framing, head and shoulders visible.",
    ],
    neg_add: [
      "floating, product on table, product on surface, product on floor, packaging, product alone,",
      "wrong scale, oversized, undersized,",
    ],
  },

  wear_head_face: {
    pos_add: [
      "The product is worn on the face, correct position and realistic scale.",
      "Natural fit on the face, aligned with facial features.",
      "Close-up or portrait framing, face clearly visible.",
    ],
    neg_add: [
      "floating, product on table, product on surface, packaging, product alone,",
      "wrong position, misaligned, wrong scale,",
    ],
  },

  wear_head_ear: {
    pos_add: [
      "Close-up of a woman's ear with the earring naturally attached to the earlobe.",
      "Correct position and scale. Realistic skin texture, soft lighting.",
      "Professional jewelry close-up photography. Only the ear and earring in frame.",
    ],
    neg_add: [
      "hand, fingers, holding, touching, product in hand,",
      "floating earring, earring not on ear, misplaced earring,",
      "full body, face, other body parts in frame,",
    ],
  },

  wear_neck: {
    pos_add: [
      "The product is worn around the neck, centered, correct scale.",
      "Natural drape on the neck, neckline clearly visible.",
      "Portrait or bust framing, neck and décolleté visible.",
    ],
    neg_add: [
      "floating, product on table, product on surface, product in hand, packaging, product alone,",
      "wrong scale, misaligned,",
    ],
  },

  wear_torso_upper: {
    pos_add: [
      "The clothing is actively worn on the upper body, natural fit and realistic fabric drape.",
      "Person visible from at least waist up, wearing the garment naturally.",
      "Realistic fabric texture, correct proportions, lifestyle or studio framing.",
    ],
    neg_add: [
      "hanger, flat lay, product on table, product on floor, plastic bag, garment bag, packaging, product alone,",
      "floating garment, disembodied clothing,",
    ],
  },

  wear_torso_full: {
    pos_add: [
      "The clothing is actively worn on the full body, natural fit and correct fabric drape.",
      "Full body or three-quarter shot, garment visible from shoulders to hem.",
      "Realistic fit, natural pose, professional lifestyle or studio photography.",
    ],
    neg_add: [
      "hanger, flat lay, product on table, product on floor, plastic bag, garment bag, packaging, product alone,",
      "floating garment, disembodied clothing,",
    ],
  },

  wear_waist_legs: {
    pos_add: [
      "The clothing is worn on the lower body, natural fit.",
      "Product clearly visible from waist to knee or ankle.",
      "Lower body framing, correct fabric drape.",
    ],
    neg_add: [
      "hanger, flat lay, product on table, product on floor, packaging, product alone,",
      "floating garment, product on upper body,",
    ],
  },

  wear_feet: {
    pos_add: [
      "Tight close-up from knee to ground. Both shoes worn on feet, filling the frame.",
      "Standing or walking pose. Shoes are the hero of the image.",
      "Realistic shoe texture, correct scale, natural ground contact and shadow.",
    ],
    neg_add: [
      "full body, face, upper body visible,",
      "floating shoes, shoes on table, shoes alone,",
      "wrong scale, mismatched pair,",
    ],
  },

  wear_wrist: {
    pos_add: [
      "The product is worn on the wrist, correctly positioned and sized.",
      "Wrist close-up, product clearly visible, natural skin texture.",
    ],
    neg_add: [
      "floating, product on table, product on surface, packaging, product alone,",
      "wrong scale, misaligned,",
    ],
  },

  wear_finger: {
    pos_add: [
      "The product is worn on a finger, correct orientation and realistic scale.",
      "Hand close-up, product on finger, natural skin texture and lighting.",
    ],
    neg_add: [
      "floating, product on table, product on surface, packaging, product alone,",
      "wrong scale, wrong finger,",
    ],
  },

  wear_back: {
    pos_add: [
      "The backpack is worn on the back, both shoulder straps on the shoulders.",
      "Person facing away from camera or three-quarter view. Correct fit and scale.",
      "Natural standing or walking pose.",
    ],
    neg_add: [
      "product on floor, product on table, product on surface, product on wall, packaging, product alone,",
      "floating, straps hanging loose,",
    ],
  },

  wear_crossbody: {
    pos_add: [
      "The product is worn crossbody, strap crossing the chest or bag on the hip.",
      "Front panel clearly visible, natural pose, casual or active lifestyle.",
    ],
    neg_add: [
      "floating, product on table, product on floor, packaging, product alone,",
      "strap not worn, product not on body,",
    ],
  },

  hold_device: {
    pos_add: [
      "A person holds the device naturally in one hand, screen or front face visible.",
      "Natural relaxed grip, device at comfortable viewing angle.",
      "Lifestyle framing, upper body visible.",
    ],
    neg_add: [
      "product on table, product alone, floating device, packaging,",
      "no person, device without hands,",
    ],
  },

  hold_bag_hand: {
    pos_add: [
      "A person holds the bag naturally in one hand, bag clearly visible and unobstructed.",
      "Natural relaxed standing pose. Bag at side or in front of body.",
      "Realistic product size relative to the hand and body.",
    ],
    neg_add: [
      "product on table, product on floor, product on wall, product alone, floating, packaging,",
      "no person,",
    ],
  },

  hold_tool_safe: {
    pos_add: [
      "A person holds the tool safely in hand, neutral non-threatening pose.",
      "Tool clearly visible and correctly oriented for its intended use.",
    ],
    neg_add: [
      "cutting action, aggressive action, product on table, product alone, packaging,",
      "no person,",
    ],
  },

  hold_food_display: {
    pos_add: [
      "Food product presented on a clean surface or wooden board, styled for photography.",
      "Professional food photography lighting, appetizing presentation.",
      "Clean neutral background, product is the hero.",
    ],
    neg_add: [
      "packaging, floating, cluttered background,",
    ],
  },

  hold_sport_object: {
    pos_add: [
      "A person holds or uses the sport object in correct sport context, active pose.",
      "Realistic environment matching the sport. Dynamic natural movement.",
    ],
    neg_add: [
      "product on table, product alone, floating, packaging,",
      "no person, static unnatural pose,",
    ],
  },

  hold_display: {
    pos_add: [
      "Product displayed on a neutral surface, centered, professional product photography.",
      "Soft even lighting, minimal clean background.",
    ],
    neg_add: [
      "floating, packaging, cluttered background,",
    ],
  },

  hold_flower: {
    pos_add: [
      "A person holds the bouquet with both hands, at chest or waist level, facing the camera.",
      "Bouquet in front of the body, clearly visible and unobstructed.",
      "Elegant natural pose, flowers are the hero of the image, sharp and well-lit.",
    ],
    neg_add: [
      "flower crown, flowers on head, floral headpiece, flowers in hair,",
      "flowers on table, flowers alone, flowers not in hands,",
      "no person, person missing,",
    ],
  },

  hold_beauty_product: {
    pos_add: [
      "Beauty product displayed upright on a clean white or marble surface, front label visible.",
      "Soft diffused studio lighting, luxury cosmetics photography.",
      "Pure white or light neutral background. Product centered and perfectly lit.",
    ],
    neg_add: [
      "floating, cluttered background, packaging box over product,",
    ],
  },

  hold_beverage: {
    pos_add: [
      "A person holds the beverage naturally in one hand at chest level.",
      "Label facing camera, fully visible. Natural casual standing pose.",
      "Clean bright lifestyle environment. Product is the clear focus.",
    ],
    neg_add: [
      "product alone on table, floating, packaging obstructing label,",
      "bar environment, restaurant background, no person,",
    ],
  },

  hold_pet_product: {
    pos_add: [
      "Pet product displayed on a minimal indoor surface, label or main feature facing camera.",
      "Soft natural lighting, clean neutral background. Product centered.",
    ],
    neg_add: [
      "clutter, packaging, floating,",
    ],
  },

  scene_tabletop: {
    pos_add: [
      "Product placed upright on a clean light-colored surface, centered.",
      "Soft studio lighting, neutral or white background. Sharp focus on product.",
      "Product physically resting on surface with correct contact shadow.",
    ],
    neg_add: [
      "floating, packaging, clutter,",
    ],
  },

  scene_home_indoor: {
    pos_add: [
      "Product placed in a realistic indoor home environment, correct scale.",
      "Natural lighting, realistic perspective, product physically grounded.",
    ],
    neg_add: [
      "floating, packaging, wrong scale,",
    ],
  },

  scene_floor: {
    pos_add: [
      "Product placed flat on the floor, correct contact and natural shadow.",
      "Realistic perspective, correct scale relative to the room.",
    ],
    neg_add: [
      "floating, packaging, wrong scale, tilted unrealistically,",
    ],
  },

  scene_wall: {
    pos_add: [
      "Product mounted or fixed to wall in correct position.",
      "Realistic perspective, correct scale, natural shadow on wall.",
    ],
    neg_add: [
      "floating, packaging, wrong scale,",
    ],
  },

  scene_store_shelf: {
    pos_add: [
      "Product placed on a store shelf, facing forward, correct scale.",
    ],
    neg_add: ["floating, wrong scale,"],
  },

  scene_outdoor_ground: {
    pos_add: [
      "Product placed outdoors on the ground, correct contact and natural shadow.",
      "Realistic outdoor lighting, correct scale relative to surroundings.",
    ],
    neg_add: ["floating, packaging, wrong scale,"],
  },

  scene_water_surface: {
    pos_add: [
      "Product floating on water surface, realistic water reflection and contact.",
    ],
    neg_add: ["packaging, wrong scale,"],
  },

  scene_sport_environment: {
    pos_add: [
      "Product placed on the ground in a sport environment, correct context and scale.",
    ],
    neg_add: ["floating, packaging, wrong scale,"],
  },

  scene_vehicle_interior: {
    pos_add: [
      "Product placed in correct vehicle interior position, realistic scale.",
    ],
    neg_add: ["wrong placement, packaging,"],
  },

  install_home_fixture: {
    pos_add: [
      "Product installed in correct home fixture position, realistic integration.",
      "Correct scale, natural lighting, realistic installation.",
    ],
    neg_add: ["wrong placement, floating, packaging,"],
  },

  install_vehicle_fixture: {
    pos_add: [
      "Product installed in correct vehicle position, realistic fit.",
    ],
    neg_add: ["wrong placement, floating, packaging,"],
  },

  install_wall_fixed: {
    pos_add: [
      "Product fixed on wall in correct position, realistic scale and shadow.",
    ],
    neg_add: ["wrong placement, floating, packaging,"],
  },
};
