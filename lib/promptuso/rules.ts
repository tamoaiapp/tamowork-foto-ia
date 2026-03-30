export interface Rule {
  pos_add: string[];
  neg_add: string[];
}

export const RULES: Record<string, Rule> = {
  wear_head_top: {
    pos_add: ["Product is worn on the head of a real person, correct orientation, realistic scale."],
    neg_add: ["No product on table.", "No product on surface.", "No floating.", "No packaging.", "Do not show product alone without a person wearing it."],
  },
  wear_head_face: {
    pos_add: ["Product is worn on the face of a real person in correct usage position."],
    neg_add: ["No product on table.", "No product on surface.", "No floating.", "No packaging.", "Do not show product alone without a person wearing it."],
  },
  wear_head_ear: {
    pos_add: [
      "Product is worn on the ear of a real person, correctly positioned.",
      "If the input shows the product held in a hand or fingers, remove the hand completely and show the earring worn on a real person's ear instead.",
      "Show the earring naturally attached to the earlobe, correct scale.",
    ],
    neg_add: [
      "No product on table.", "No product on surface.", "No floating.", "No packaging.",
      "No hand holding the earring.", "No fingers.", "No hand in frame.",
      "Do not show product alone without a person wearing it.",
    ],
  },
  wear_neck: {
    pos_add: ["Product is worn around the neck of a real person, centered, realistic size."],
    neg_add: ["No product on table.", "No product on surface.", "No floating.", "No packaging.", "Do not show product alone without a person wearing it."],
  },
  wear_torso_upper: {
    pos_add: [
      "The clothing is actively worn on the upper body of a real person.",
      "Show the garment on a person — not on a hanger, not on a table, not floating.",
      "The person must be visible from at least waist up, wearing the product naturally.",
      "Realistic fit, natural pose, correct fabric drape.",
    ],
    neg_add: [
      "No product on table.", "No product on surface.", "No product on hanger.",
      "No floating garment.", "No packaging.", "No disembodied clothing.",
      "Do not show the product alone without a person wearing it.",
    ],
  },
  wear_torso_full: {
    pos_add: [
      "The clothing is actively worn on the full body of a real person.",
      "Show the complete outfit on a person — not on a hanger, not on a table, not floating.",
      "Full body shot preferred — show the garment from shoulders to hem.",
      "Realistic fit, natural pose, correct fabric drape.",
    ],
    neg_add: [
      "No product on table.", "No product on surface.", "No product on hanger.",
      "No floating garment.", "No packaging.", "No disembodied clothing.",
      "Do not show the product alone without a person wearing it.",
    ],
  },
  wear_waist_legs: {
    pos_add: [
      "The clothing is actively worn on the lower body of a real person.",
      "Show the garment on a person — not on a hanger, not on a table, not floating.",
      "The product must be clearly visible from waist to knee or ankle as appropriate.",
    ],
    neg_add: [
      "No product on table.", "No product on surface.", "No product on hanger.",
      "No floating garment.", "No packaging.", "No disembodied clothing.",
      "Do not show the product alone without a person wearing it.",
      "Do not place the product on the upper body.",
    ],
  },
  wear_feet: {
    pos_add: ["Product is worn on the feet of a real person, correct orientation and realistic scale."],
    neg_add: ["No product on table.", "No product on surface.", "No floating.", "No packaging.", "Do not show product alone without a person wearing it."],
  },
  wear_wrist: {
    pos_add: [
      "Product is worn on the wrist of a real person, correctly positioned and sized.",
      "If the input shows the product held in a hand or placed on a surface, remove that and show it worn on a real person's wrist instead.",
    ],
    neg_add: [
      "No product on table.", "No product on surface.", "No floating.", "No packaging.",
      "No extra hand holding the product.", "Do not show product alone without a person wearing it.",
    ],
  },
  wear_finger: {
    pos_add: [
      "Product is worn on a finger of a real person, correct orientation and realistic scale.",
      "If the input shows the product held by another hand or placed loose, remove that and show it worn on a real person's finger instead.",
    ],
    neg_add: [
      "No product on table.", "No product on surface.", "No floating.", "No packaging.",
      "No extra hand holding the product.", "Do not show product alone without a person wearing it.",
    ],
  },
  wear_back: {
    pos_add: ["Product is worn on the back of a real person, person facing away from camera."],
    neg_add: ["No product on table.", "No product on surface.", "No floating.", "No packaging.", "Do not show product alone without a person wearing it."],
  },
  wear_crossbody: {
    pos_add: [
      "Product is worn crossbody or around the waist on a real person.",
      "The strap crosses the chest or the bag sits on the hip.",
      "Show the full product clearly — front panel must be visible.",
      "Realistic natural pose, casual or active.",
    ],
    neg_add: [
      "No hand holding the product up artificially.",
      "No packaging.",
      "No floating product.",
      "Do not place the product on a table or floor.",
    ],
  },
  hold_device: {
    pos_add: [
      "A real person holds the device naturally in hand, in correct usage position.",
      "The device screen or front face must be clearly visible.",
      "Natural relaxed pose, realistic grip.",
    ],
    neg_add: [
      "No product on table.", "No product alone.", "No floating device.",
      "No packaging.", "Do not show device without a person holding it.",
    ],
  },
  hold_bag_hand: {
    pos_add: [
      "A real person holds the bag naturally in one hand.",
      "The bag must be clearly visible and unobstructed.",
      "Natural relaxed standing pose.",
      "Realistic product size relative to the hand and body.",
    ],
    neg_add: [
      "No mannequin.", "No dummy.", "No packaging.",
      "No product on table.", "No product alone.", "No floating bag.",
      "Do not show bag without a person holding it.",
    ],
  },
  hold_tool_safe: {
    pos_add: [
      "A real person holds the tool safely in hand, neutral non-threatening pose.",
      "Tool is clearly visible and correctly oriented for its intended use.",
    ],
    neg_add: [
      "No cutting action.", "No aggressive action.", "No product on table.",
      "No product alone.", "No packaging.", "Do not show tool without a person holding it.",
    ],
  },
  hold_food_display: {
    pos_add: [
      "Food product presented on a clean surface or wooden board, styled for photography.",
      "Professional food photography lighting, appetizing presentation.",
      "No person needed — focus entirely on the food product.",
    ],
    neg_add: ["No packaging.", "No floating.", "No hand in frame.", "No cluttered background."],
  },
  hold_sport_object: {
    pos_add: [
      "A real person holds or uses the sport object naturally in correct sport context.",
      "Active or ready pose appropriate to the sport.",
      "Realistic environment matching the sport.",
    ],
    neg_add: [
      "No product on table.", "No product alone.", "No floating.",
      "No packaging.", "Do not show sport object without a person using it.",
    ],
  },
  hold_display: {
    pos_add: [
      "Product displayed cleanly on a neutral surface, centered, professional product photography.",
      "Soft even lighting, minimal background.",
    ],
    neg_add: ["No hand visible.", "No packaging.", "No cluttered background.", "No floating."],
  },
  scene_tabletop: {
    pos_add: ["Product placed on a clean indoor table surface."],
    neg_add: ["No hand visible.", "No packaging."],
  },
  scene_home_indoor: {
    pos_add: ["Product placed indoors in a realistic home environment."],
    neg_add: ["No packaging."],
  },
  scene_floor: {
    pos_add: ["Product placed on floor in natural environment."],
    neg_add: ["No floating.", "No hand visible."],
  },
  scene_wall: {
    pos_add: ["Product fixed to wall in correct position."],
    neg_add: ["No hand visible.", "No packaging."],
  },
  scene_store_shelf: {
    pos_add: ["Product placed on store shelf."],
    neg_add: ["No hand."],
  },
  scene_outdoor_ground: {
    pos_add: ["Product placed outdoors on ground."],
    neg_add: ["No floating."],
  },
  scene_water_surface: {
    pos_add: ["Product floating on water surface."],
    neg_add: ["No hand visible.", "No packaging."],
  },
  scene_sport_environment: {
    pos_add: ["Product placed on ground in sport environment."],
    neg_add: ["No hand visible.", "No packaging."],
  },
  scene_vehicle_interior: {
    pos_add: ["Product placed in correct vehicle interior position."],
    neg_add: ["No wrong placement.", "No packaging."],
  },
  install_home_fixture: {
    pos_add: ["Product installed in correct home fixture position."],
    neg_add: ["No wrong placement."],
  },
  install_vehicle_fixture: {
    pos_add: ["Product installed in correct vehicle position."],
    neg_add: ["No wrong placement.", "No packaging."],
  },
  install_wall_fixed: {
    pos_add: ["Product fixed on wall correctly."],
    neg_add: ["No wrong placement."],
  },
};
