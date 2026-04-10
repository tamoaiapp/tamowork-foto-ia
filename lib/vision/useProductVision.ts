"use client";

import { useState, useRef } from "react";

export type VisionState = "idle" | "loading_model" | "analyzing" | "done" | "error";

let pipelineInstance: ((input: string) => Promise<{ generated_text: string }[]>) | null = null;
let loading = false;

async function getPipeline() {
  if (pipelineInstance) return pipelineInstance;
  if (loading) {
    // Aguarda se já está carregando
    await new Promise<void>((res) => {
      const iv = setInterval(() => { if (!loading) { clearInterval(iv); res(); } }, 200);
    });
    return pipelineInstance!;
  }

  loading = true;
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const p = await pipeline(
      "image-to-text",
      "Xenova/vit-gpt2-image-captioning"
      // sem dtype — usa o padrão fp32 que funciona em todos os browsers
    ) as (input: string) => Promise<{ generated_text: string }[]>;

    pipelineInstance = p;
    return p;
  } finally {
    loading = false;
  }
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

  // Remove cena no final
  s = s.replace(
    /[,.]?\s+(standing|sitting|posing|walking|leaning|lying)\s+(in|on|at|near|by|next to|in front of|inside|outside|against)\s+.+$/i,
    ""
  );
  s = s.replace(
    /[,.]?\s+(in|on|at|near|inside|outside|in front of)\s+(a |an |the )?(store|shop|mall|market|showroom|studio|room|street|background|display|window|shelf|rack|wall).+$/i,
    ""
  );
  s = s.replace(/[,.]?\s+with\s+(a |an |the )?(background|wall|shelf|rack|store|display).+$/i, "");

  // Remove artigo inicial
  s = s.replace(/^(a |an |the )/i, "").trim();

  // Se ficou curto demais, retorna o original sem o sujeito
  if (s.length < 4) {
    return raw
      .replace(/^(a |an |the )?(woman|man|person|model|girl|boy|mannequin)\s+/i, "")
      .replace(/^(a |an |the )/i, "")
      .trim() || raw;
  }

  return s;
}

export function useProductVision() {
  const [state, setState] = useState<VisionState>("idle");
  const [rawCaption, setRawCaption] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  async function analyzeImage(file: File): Promise<string | null> {
    try {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const isFirstLoad = !pipelineInstance;
      setState(isFirstLoad ? "loading_model" : "analyzing");
      setRawCaption(null);

      const captioner = await getPipeline();
      setState("analyzing");

      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;

      const result = await captioner(objectUrl);
      const raw = result?.[0]?.generated_text ?? "";

      console.log("[vision] caption bruto:", raw);
      setRawCaption(raw);

      const product = raw ? extractProduct(raw) : null;
      console.log("[vision] produto extraído:", product);

      setState("done");
      // Retorna produto extraído, ou o caption bruto se a extração falhar
      return product || raw || null;
    } catch (err) {
      console.error("[vision] erro:", err);
      setState("error");
      pipelineInstance = null;
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
    setRawCaption(null);
  }

  const isAnalyzing = state === "loading_model" || state === "analyzing";

  return { analyzeImage, state, isAnalyzing, rawCaption, reset };
}
