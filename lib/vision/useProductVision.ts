"use client";

import { useState, useRef } from "react";

type VisionState = "idle" | "loading_model" | "analyzing" | "done" | "error";

// Singleton do pipeline — carregado uma vez e reutilizado
let pipelinePromise: Promise<(input: string) => Promise<{ generated_text: string }[]>> | null = null;

async function getPipeline() {
  if (!pipelinePromise) {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    pipelinePromise = pipeline(
      "image-to-text",
      "Xenova/vit-gpt2-image-captioning",
      { dtype: "q8" }
    ) as Promise<(input: string) => Promise<{ generated_text: string }[]>>;
  }
  return pipelinePromise;
}

/**
 * Remove descrições de pessoa e cena — mantém apenas o produto.
 * Ex: "a woman wearing red floral shorts in a store" → "red floral shorts"
 */
function extractProduct(raw: string): string {
  let s = raw.trim();

  // Remove "a/an/the [person] [verb] " no início
  s = s.replace(
    /^(a |an |the )?(woman|man|person|model|girl|boy|lady|gentleman|figure|mannequin|display)\s+(is\s+)?(wearing|holding|carrying|using|with|in|dressed in|showing|featuring|displaying)\s+/i,
    ""
  );

  // Remove cena no final: "standing in a store", "in front of a wall", etc.
  s = s.replace(
    /\s+(standing|sitting|posing|walking|leaning|lying)\s+(in|on|at|near|by|next to|in front of|inside|outside|against)\s+.+$/i,
    ""
  );
  s = s.replace(
    /,?\s+(in|on|at|near|inside|outside|in front of)\s+(a |an |the )?(store|shop|mall|market|showroom|studio|room|street|background|display|window|shelf|rack).+$/i,
    ""
  );
  s = s.replace(/,?\s+with\s+(a |an |the )?(background|wall|shelf|rack|store|display).+$/i, "");

  // Remove partícula inicial solta
  s = s.replace(/^(a |an |the )/i, "");

  s = s.trim();

  // Fallback: se ficou curto demais ou vazio, usa o original sem o prefixo de pessoa
  if (s.length < 4) {
    const fallback = raw.replace(/^(a |an |the )?(woman|man|person|model|girl|boy|mannequin)\s+/i, "").trim();
    return fallback || raw;
  }

  return s;
}

export function useProductVision() {
  const [state, setState] = useState<VisionState>("idle");
  const objectUrlRef = useRef<string | null>(null);

  async function analyzeImage(file: File): Promise<string | null> {
    try {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const isFirstLoad = !pipelinePromise;
      setState(isFirstLoad ? "loading_model" : "analyzing");

      const captioner = await getPipeline();
      setState("analyzing");

      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;

      const result = await captioner(objectUrl);
      const raw = result?.[0]?.generated_text ?? "";
      const product = raw ? extractProduct(raw) : null;

      setState("done");
      return product || null;
    } catch (err) {
      console.error("[vision] erro:", err);
      setState("error");
      pipelinePromise = null;
      return null;
    } finally {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }
  }

  function reset() {
    setState("idle");
  }

  const isAnalyzing = state === "loading_model" || state === "analyzing";

  return { analyzeImage, state, isAnalyzing, reset };
}
