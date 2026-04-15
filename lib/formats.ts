/**
 * Formatos de saída suportados — foto e vídeo.
 * Usados pelo seletor de formato na UI e pelos workflows do ComfyUI.
 */

export type PhotoFormat = "story" | "square" | "portrait" | "horizontal";

export const FORMAT_LABELS: Record<PhotoFormat, { label: string; ratio: string }> = {
  story:      { label: "Story",      ratio: "9:16" },
  square:     { label: "Quadrado",   ratio: "1:1"  },
  portrait:   { label: "Retrato",    ratio: "4:5"  },
  horizontal: { label: "Horizontal", ratio: "16:9" },
};

export const ALL_FORMATS: PhotoFormat[] = ["story", "square", "portrait", "horizontal"];

/**
 * Dimensões para foto (Flux Kontext Qwen).
 * Valores otimizados para o modelo — múltiplos de 64.
 */
export const PHOTO_DIMS: Record<PhotoFormat, { w: number; h: number }> = {
  story:      { w: 768,  h: 1344 },
  square:     { w: 1024, h: 1024 },
  portrait:   { w: 864,  h: 1080 },
  horizontal: { w: 1344, h: 768  },
};

/**
 * Dimensões para vídeo (Wan I2V).
 * Mantidas pequenas para geração em tempo razoável (~3-5 min).
 */
export const VIDEO_DIMS: Record<PhotoFormat, { w: number; h: number }> = {
  story:      { w: 480, h: 832 },
  square:     { w: 512, h: 512 },
  portrait:   { w: 480, h: 608 },
  horizontal: { w: 832, h: 480 },
};

export const DEFAULT_FORMAT: PhotoFormat = "story";
