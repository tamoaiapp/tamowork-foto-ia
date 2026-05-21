/**
 * Regras de seleção de LoRA por tipo de produto (espelha agent-zap/lib/pipeline/lora-rules.ts).
 *
 * - Roupa  → LoRA `tamowork_qwen_edit_2511_lora_v1` (treinada produto→pessoa vestindo)
 * - Acessório → LoRA `tamowork_acc_qwen_edit_2511_lora_v1` (joias, óculos, boné, bolsa…)
 * - Acessório tem PRIORIDADE sobre roupa ("relógio infantil" → LoRA de acessório)
 *
 * Pré-requisito: os arquivos .safetensors devem estar baked na imagem do worker
 * (ver tamoaiapp/comfyui-serverless/download_models.sh). Senão o LoraLoader quebra.
 */

import type { ProductType } from "./visionRouter";

export const ROUPA_LORA = process.env.PHOTO_ROUPA_LORA ?? "tamowork_qwen_edit_2511_lora_v1.safetensors";
export const ROUPA_LORA_STRENGTH = Number(process.env.PHOTO_ROUPA_LORA_STRENGTH ?? "1.0");
export const ACESSORIO_LORA = process.env.PHOTO_ACESSORIO_LORA ?? "tamowork_acc_qwen_edit_2511_lora_v1.safetensors";
export const ACESSORIO_LORA_STRENGTH = Number(process.env.PHOTO_ACESSORIO_LORA_STRENGTH ?? "1.0");

// Keywords de vestuário (texto livre PT). Amplo de propósito.
const CLOTHING_KEYWORDS = [
  "roupa", "vestuario", "vestuário", "conjunto", "vestido", "blusa", "camisa", "camiseta",
  "calca", "calça", "short", "bermuda", "saia", "macacao", "macacão", "macaquinho",
  "jaqueta", "casaco", "moletom", "agasalho", "sueter", "suéter", "cardiga", "colete",
  "biquini", "biquíni", "maio", "maiô", "sunga", "praia", "saida de praia", "saída de praia",
  "lingerie", "sutia", "sutiã", "calcinha", "cueca", "pijama", "body", "cropped", "top",
  "infantil", "menino", "menina", "juvenil", "bebe", "bebê", "fantasia", "uniforme",
  "legging", "regata", "tshirt", "t-shirt", "kimono", "kit roupa", "look",
];

// Keywords de acessório (texto livre PT). PRIORIDADE sobre roupa.
const ACCESSORY_KEYWORDS = [
  "acessorio", "acessório", "colar", "gargantilha", "corrente", "pingente", "anel", "aneis", "anéis",
  "brinco", "argola", "pulseira", "bracelete", "berloque", "relogio", "relógio",
  "oculos", "óculos", "cinto", "bolsa", "carteira", "mochila", "necessaire", "nécessaire",
  "bone", "boné", "chapeu", "chapéu", "tiara", "presilha", "lenco", "lenço", "echarpe",
  "joia", "jóia", "joias", "bijuteria", "bijuterias", "luva", "luvas", "meia", "meias",
];

// product_type do visionRouter → categoria de LoRA. Sinal mais confiável que keyword
// quando a visão classificou. footwear fica de fora (LoRA de tênis vem depois).
const ACCESSORY_TYPES: ProductType[] = ["jewelry_ring", "jewelry_neck", "jewelry_ear", "jewelry_wrist", "eyewear", "hat", "bag"];
const CLOTHING_TYPES: ProductType[] = ["clothing_torso", "clothing_full", "clothing_lower"];

function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function matchesAny(text: string | null | undefined, kws: string[]): boolean {
  if (!text) return false;
  const n = norm(text);
  return kws.some((kw) => n.includes(norm(kw)));
}

export interface LoraSelection {
  name: string;
  strength: number;
}

/**
 * Decide a LoRA pelo product_type da visão (prioritário) + texto livre (fallback).
 * Acessório > roupa. Retorna null se nenhuma regra casar (workflow base).
 */
export function selectLora(productType: ProductType | null | undefined, freeText: string | null | undefined): LoraSelection | null {
  // 1. Se a visão classificou, confia no tipo (NAO faz keyword fallback —
  //    evita falso-positivo tipo kit/product_display com "conjunto" virar roupa).
  if (productType) {
    if (ACCESSORY_TYPES.includes(productType)) return { name: ACESSORIO_LORA, strength: ACESSORIO_LORA_STRENGTH };
    if (CLOTHING_TYPES.includes(productType)) return { name: ROUPA_LORA, strength: ROUPA_LORA_STRENGTH };
    return null; // visão diz que não é roupa nem acessório
  }
  // 2. Sem visão: fallback por keyword no texto (acessório tem prioridade)
  if (matchesAny(freeText, ACCESSORY_KEYWORDS)) return { name: ACESSORIO_LORA, strength: ACESSORIO_LORA_STRENGTH };
  if (matchesAny(freeText, CLOTHING_KEYWORDS)) return { name: ROUPA_LORA, strength: ROUPA_LORA_STRENGTH };
  return null;
}
