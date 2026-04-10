"use client";

import { useState, useRef } from "react";

type VisionState = "idle" | "loading_model" | "analyzing" | "done" | "error";

// Singleton do pipeline — carregado uma vez e reutilizado
let pipelinePromise: Promise<(input: string) => Promise<{ generated_text: string }[]>> | null = null;

async function getPipeline() {
  if (!pipelinePromise) {
    // Import dinâmico para não quebrar o SSR do Next.js
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    pipelinePromise = pipeline(
      "image-to-text",
      // Modelo pequeno (~150MB) — ViT encoder + GPT-2 decoder, ótimo para fotos de produto
      "Xenova/vit-gpt2-image-captioning",
      { dtype: "q8" } // quantizado 8-bit — menor e mais rápido no browser
    ) as Promise<(input: string) => Promise<{ generated_text: string }[]>>;
  }
  return pipelinePromise;
}

export function useProductVision() {
  const [state, setState] = useState<VisionState>("idle");
  const [progress, setProgress] = useState(0); // 0-100 durante download do modelo
  const objectUrlRef = useRef<string | null>(null);

  async function analyzeImage(file: File): Promise<string | null> {
    try {
      // Limpa URL anterior
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const isFirstLoad = !pipelinePromise;
      setState(isFirstLoad ? "loading_model" : "analyzing");

      // Configura callback de progresso apenas no primeiro carregamento
      if (isFirstLoad) {
        const { env } = await import("@huggingface/transformers");
        // @ts-expect-error - API de progresso pode variar por versão
        env.progressCallback = (p: { status: string; progress?: number }) => {
          if (p.status === "progress" && p.progress != null) {
            setProgress(Math.round(p.progress));
          }
        };
      }

      const captioner = await getPipeline();

      setState("analyzing");
      setProgress(0);

      // Cria URL de objeto para o arquivo — a biblioteca aceita URL de imagem
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;

      const result = await captioner(objectUrl);
      const caption = result?.[0]?.generated_text ?? "";

      setState("done");
      return caption || null;
    } catch (err) {
      console.error("[vision] erro:", err);
      setState("error");
      pipelinePromise = null; // reseta para tentar novamente
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
    setProgress(0);
  }

  const isAnalyzing = state === "loading_model" || state === "analyzing";

  return { analyzeImage, state, progress, isAnalyzing, reset };
}
