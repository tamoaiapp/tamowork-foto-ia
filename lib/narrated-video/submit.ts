/**
 * Narrated Video — Submit
 * 1. Melhora o roteiro via Ollama
 * 2. Faz upload da imagem para o ComfyUI do pod de foto
 * 3. Submete N variações de cena com seeds aleatórios
 * 4. Salva prompt_ids no banco para polling posterior
 */
import { createServerClient } from "@/lib/supabase/server";
import { uploadImageToComfy, COMFY_BASES } from "@/lib/comfyui/client";
import { ensureFotoPodRunning } from "@/lib/runpod/pods";
import { getProductVisionDescription, mergeProductTexts } from "@/lib/vision/serverProductVision";
import { buildPromptResult, inferSlot } from "@/lib/promptuso/infer";
import { type PhotoFormat, PHOTO_DIMS, DEFAULT_FORMAT } from "@/lib/formats";

// Cenários por tipo de produto — visualmente DISTINTOS entre si para variedade real nas cenas
const SLOT_CENARIOS: Record<string, string[]> = {
  wear_head_ear: [
    "upscale restaurant interior, warm candlelight, elegant ambiance, shallow depth of field",
    "city street, outdoor natural daylight, urban buildings in background, lifestyle photography",
    "cozy home living room, soft window light, warm interior decor in background",
    "outdoor garden, golden hour sunlight, lush green bokeh, romantic natural setting",
  ],
  wear_head_top: [
    "city street, outdoor natural sunlight, urban lifestyle, buildings in background",
    "upscale cafe interior, warm lighting, modern decor in background",
    "outdoor park, golden hour, trees and nature in background",
    "indoor gym or sports area, dynamic lighting",
  ],
  wear_head_face: [
    "beach or coastal setting, bright natural light, ocean in background",
    "city rooftop, urban skyline in background, natural daylight",
    "indoor studio, clean white background, editorial style lighting",
    "outdoor park, greenery in background, candid lifestyle",
  ],
  wear_neck: [
    "elegant dinner setting, restaurant interior, warm soft light",
    "outdoor city street, natural sunlight, urban lifestyle",
    "luxury boutique interior, minimal elegant decor in background",
    "garden party setting, outdoor, soft natural light",
  ],
  wear_wrist: [
    "office desk setting, laptop and coffee in background, natural light",
    "outdoor city, natural sunlight, wrist in focus, street in background",
    "elegant restaurant table, soft warm light, lifestyle close-up",
    "home interior, cozy setting, warm natural window light",
  ],
  wear_finger: [
    "elegant table setting, soft candlelight, bokeh background",
    "outdoor natural setting, sunlight, garden or park background",
    "indoor luxury interior, marble surface, refined aesthetic",
    "lifestyle moment, coffee cup in hand, cafe interior",
  ],
  wear_torso_upper: [
    "city street, outdoor natural sunlight, urban architecture in background",
    "upscale cafe or restaurant interior, warm ambient lighting",
    "outdoor park or garden, golden hour, trees in background",
    "indoor modern apartment, minimal decor, soft natural window light",
  ],
  wear_torso_full: [
    "city street, outdoor natural sunlight, urban lifestyle, full body",
    "elegant indoor setting, marble floor, luxury interior, full body",
    "outdoor park, golden hour lighting, lush background, full body",
    "shopping area or boutique entrance, natural light, full body",
  ],
  wear_waist_legs: [
    "outdoor city street, natural daylight, urban background, lower body",
    "indoor modern interior, clean floor, minimal setting, lower body",
    "outdoor park path, golden hour, natural light, lower body framing",
  ],
  wear_feet: [
    "urban pavement, city street, outdoor natural light, close-up footwear",
    "outdoor park path, golden hour, grass and path in background",
    "indoor modern floor, minimal interior, lifestyle footwear shot",
    "cafe or restaurant floor, cozy setting, lifestyle close-up",
  ],
  wear_back: [
    "city street, outdoor, person walking away, urban background",
    "outdoor park or campus, natural light, trees in background",
    "airport or train station, travel lifestyle, modern interior",
  ],
  wear_crossbody: [
    "city street, outdoor natural sunlight, urban lifestyle",
    "boutique or shopping district, upscale area, natural light",
    "travel setting, airport or historic street, lifestyle moment",
    "outdoor cafe terrace, natural light, relaxed lifestyle",
  ],
  hold_bag_hand: [
    "city street, outdoor natural sunlight, urban buildings in background",
    "luxury boutique or shopping mall entrance, elegant setting",
    "outdoor park, golden hour, romantic casual lifestyle look",
    "indoor modern apartment, soft natural light, minimal decor",
  ],
  hold_device: [
    "modern home office, desk setup, natural window light",
    "outdoor cafe terrace, relaxed lifestyle, natural light",
    "cozy sofa at home, warm interior lighting, casual use",
  ],
  hold_flower: [
    "elegant wedding ceremony interior, soft diffused light, floral decor",
    "outdoor garden, romantic natural light, greenery in background",
    "bright modern interior, minimal decor, soft natural window light",
    "outdoor park, golden hour, nature setting, romantic atmosphere",
  ],
  hold_food_display: [
    "rustic wooden table, natural window light, minimalist food styling",
    "modern kitchen countertop, clean marble surface, editorial look",
    "outdoor picnic setting, natural daylight, casual lifestyle",
  ],
  hold_beauty_product: [
    "marble bathroom counter, luxury aesthetic, soft diffused light",
    "clean white studio background, minimal lighting, editorial beauty",
    "natural setting, soft bokeh greenery, lifestyle beauty photo",
  ],
  hold_beverage: [
    "outdoor cafe terrace, natural sunlight, city street in background",
    "cozy home kitchen, warm morning light, lifestyle moment",
    "beach or outdoor park, bright natural light, refreshing lifestyle",
  ],
  scene_tabletop: [
    "clean white marble surface, soft studio lighting, minimal elegant background",
    "rustic wooden table, natural window light, warm lifestyle flat lay",
    "dark slate surface, dramatic side lighting, premium product photography",
  ],
  scene_home_indoor: [
    "bright modern living room, natural window light, minimal decor",
    "cozy warm home interior, evening lamp light, comfortable setting",
    "modern kitchen, clean surfaces, natural daylight from window",
  ],
};

const DEFAULT_CENARIOS = [
  "outdoor lifestyle, natural sunlight, city street background",
  "indoor lifestyle, modern interior, soft natural light",
  "park or garden, golden hour lighting, vibrant colors",
  "candid lifestyle moment, shopping area, natural light",
];

function getCenariosForSlot(slot: string): string[] {
  return SLOT_CENARIOS[slot] ?? DEFAULT_CENARIOS;
}

const DEFAULT_SCENES = 4;
const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "";
const ASSEMBLY_BASE = process.env.NARRATED_ASSEMBLY_BASE ?? "";

export interface ScenePlan {
  positive: string;
  negative: string;
  cenario: string;
}

// ─── Melhoria do roteiro via Ollama ───────────────────────────────────────────

function normalizeScript(text: string): string {
  const cleaned = text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= 95) return cleaned;
  return `${words.slice(0, 95).join(" ")}...`;
}

function ensurePersuasiveFallback(original: string, improved?: string): string {
  const base = normalizeScript(improved || original);
  const originalWords = normalizeScript(original).split(" ").filter(Boolean).length;
  const improvedWords = base.split(" ").filter(Boolean).length;

  // Se o texto ficou curto demais ou muito parecido com o original, força estrutura persuasiva.
  if (improvedWords >= Math.max(18, Math.floor(originalWords * 0.7))) {
    return base;
  }

  return normalizeScript(
    `Quer ${original.replace(/\.$/, "")}? Vou te mostrar em segundos. ` +
    `Esse produto resolve uma dor real do dia a dia com praticidade e resultado visível. ` +
    `Se fizer sentido pra você, aproveita agora e garante o seu antes de acabar o lote.`
  );
}

async function improveRoteiro(original: string): Promise<string> {
  if (!OLLAMA_BASE) return ensurePersuasiveFallback(original);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt: `Você é copywriter sênior de vídeos curtos para vendas (Instagram/TikTok).
Reescreva o roteiro abaixo para ficar MAIS persuasivo e humano, mantendo o mesmo produto/ideia.
Objetivo: prender atenção nos primeiros 2 segundos, mostrar benefício claro, reduzir objeção e fechar com CTA leve.
Regras:
- Português do Brasil, tom natural e conversacional.
- Sem promessas absurdas, sem clickbait exagerado.
- 45 a 95 palavras.
- Responda APENAS com o texto final, sem título, sem aspas, sem explicações.

Roteiro: ${original}`,
        stream: false,
        options: { num_predict: 280, temperature: 0.75, top_p: 0.9 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return ensurePersuasiveFallback(original);
    const json = await res.json() as { response?: string };
    return ensurePersuasiveFallback(original, json.response?.trim());
  } catch {
    // Ollama indisponível — usa original
    return ensurePersuasiveFallback(original);
  }
}

// ─── Submete workflow de variação no ComfyUI ─────────────────────────────────
// Usa a API /prompt diretamente com um workflow de img2img simplificado

export async function submitSceneVariation(
  imageName: string,
  promptPos: string,
  promptNeg: string,
  jobId: string,
  sceneIndex: number,
  comfyBase: string,
  format: PhotoFormat = DEFAULT_FORMAT,
): Promise<string> {
  // Deep clone do template de foto existente mas com seed aleatório
  // Importa o template dinamicamente para não criar dependência circular
  const { default: templateJson } = await import("@/lib/comfyui/prompt_template.json");
  const workflow = JSON.parse(JSON.stringify(templateJson)) as Record<string, unknown>;

  const seed = Math.floor(Math.random() * 999_999_999);
  const prefix = `narr_${jobId.replace(/-/g, "").slice(0, 8)}_s${sceneIndex}`;

  (workflow["11"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["1"] as { inputs: { prompt: string } }).inputs.prompt =
    `${promptPos}\n#job:${prefix}\n`;
  (workflow["39"] as { inputs: { prompt: string } }).inputs.prompt = promptNeg;
  (workflow["166"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = prefix;
  (workflow["167"] as { inputs: { seed: number } }).inputs.seed = seed;
  // Aplica formato: injeta ImageScale (168) antes do FluxKontextImageScale (160)
  const { w, h } = PHOTO_DIMS[format];
  (workflow as Record<string, unknown>)["168"] = {
    class_type: "ImageScale",
    inputs: { image: ["11", 0], width: w, height: h, upscale_method: "lanczos", crop: "center" },
  };
  (workflow["160"] as { inputs: { image: unknown } }).inputs.image = ["168", 0];

  const res = await fetch(`${comfyBase}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`ComfyUI submit error: ${res.status}`);
  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function submitNarratedVideoJob(jobId: string): Promise<void> {
  const supabase = createServerClient();

  // Lock atômico: queued → submitting
  const { data: locked } = await supabase
    .from("narrated_video_jobs")
    .update({ status: "submitting", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued")
    .select()
    .single();

  if (!locked) return; // Outro processo já pegou

  const job = locked;
  const comfyBase = COMFY_BASES[0];
  if (!comfyBase) {
    await supabase.from("narrated_video_jobs")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return;
  }

  // Verifica se pod de foto está online
  const podReady = await ensureFotoPodRunning(comfyBase);
  if (!podReady) {
    // Pod iniciando — volta para queued, cron tenta novamente
    await supabase.from("narrated_video_jobs")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return;
  }

  try {
    // 1. Gera áudio TTS + calcula quantas cenas precisam (áudio salvo no Supabase para reuso)
    let scenesNeeded = DEFAULT_SCENES;
    let audioUrl = "";
    if (ASSEMBLY_BASE) {
      try {
        const prepRes = await fetch(`${ASSEMBLY_BASE}/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: job.roteiro,
            voice: job.voice ?? "feminino",
            supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
            supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
            job_id: jobId,
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (prepRes.ok) {
          const prep = await prepRes.json() as { duration_seconds: number; scenes_needed: number; audio_url?: string };
          scenesNeeded = prep.scenes_needed;
          audioUrl = prep.audio_url ?? "";
          console.log(`[narrated] áudio=${prep.duration_seconds}s → ${scenesNeeded} cenas | audio_url=${audioUrl ? "ok" : "none"}`);
        }
      } catch (err) {
        console.warn("[narrated] /prepare falhou, usando", DEFAULT_SCENES, "cenas:", err);
      }
    }

    // 2. Se scene_source = 'existing', pula ComfyUI e inicia montagem diretamente
    if (job.scene_source === "existing" && (job.scene_urls ?? []).length >= 2) {
      const roteiroMelhorado = await improveRoteiro(job.roteiro);
      await supabase.from("narrated_video_jobs").update({
        status: "assembling",
        roteiro_melhorado: roteiroMelhorado,
        scenes_needed: scenesNeeded,
        audio_url: audioUrl || null,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      // Inicia montagem imediatamente (sem passar pelo ComfyUI)
      if (ASSEMBLY_BASE) {
        try {
          const assemblyRes = await fetch(`${ASSEMBLY_BASE}/assemble`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: jobId,
              scenes: job.scene_urls,
              audio_url: audioUrl || undefined,
              text: roteiroMelhorado || job.roteiro,
              voice: job.voice ?? "feminino",
              supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
              supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
            }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!assemblyRes.ok) console.error(`[narrated] assembly start error: ${assemblyRes.status}`);
        } catch (err) {
          console.error("[narrated] existing assembly start error:", err);
        }
      }
      return;
    }

    // 3. Melhora roteiro em paralelo com upload da imagem
    const [roteiroMelhorado, imageName] = await Promise.all([
      improveRoteiro(job.roteiro),
      uploadImageToComfy(job.input_image_url, comfyBase, `narr_${jobId.replace(/-/g, "").slice(0, 12)}`),
    ]);

    // 4. Visão do produto → identifica tipo e escolhe cenários compatíveis
    // Usamos apenas a visão para identificar o produto — o roteiro é texto de marketing
    // e pode conter frases que confundem inferSlot/inferPersona ("dia das mães", "presente", etc.)
    const visionDesc = await getProductVisionDescription(job.input_image_url);
    // Fallback offline: extrai apenas o trecho do produto antes de preço/promoção no roteiro
    const roteiroHint = job.roteiro.replace(/\b(por|r\$|apenas|só|entrega|frete|disponível|unidade|parcelo|chama|compra|presente).*/i, "").trim().slice(0, 60);
    const productText = visionDesc ?? roteiroHint ?? "product";
    const slot = inferSlot(productText);
    const cenarios = getCenariosForSlot(slot);
    console.log(`[narrated] produto="${productText.slice(0, 60)}" → slot=${slot} | ${cenarios.length} cenários disponíveis`);

    // 5. Pré-computa os planos de todas as cenas (prompts positivo + negativo)
    //    Cenas 1+ recebem um prefixo de cadeia para instruir o modelo a manter o produto
    const jobFormat = (job.format as PhotoFormat) ?? DEFAULT_FORMAT;
    const scenePlans: ScenePlan[] = [];
    for (let i = 0; i < scenesNeeded; i++) {
      const cenario = cenarios[i % cenarios.length];
      const { positive, negative } = buildPromptResult(productText, cenario);
      // Cenas encadeadas (i > 0): o input já é a cena anterior com o produto correto
      // → reforça "mantenha o produto, mude só o cenário"
      const chainPositive = i === 0
        ? positive
        : `Maintain the exact same product as shown in this reference image, unchanged in every detail, same design, same material, same color. Only change the background and environment to a new scene: ${cenario}. ${positive}`;
      scenePlans.push({ positive: chainPositive, negative, cenario });
    }

    // 6. Submete APENAS a cena 0 agora — as demais serão submetidas em cadeia pelo check.ts
    const { positive: p0, negative: n0 } = scenePlans[0];
    let scene0Id: string;
    try {
      scene0Id = await submitSceneVariation(imageName, p0, n0, jobId, 0, comfyBase, jobFormat);
    } catch (err) {
      throw new Error(`Erro ao submeter cena 0: ${err}`);
    }

    await supabase.from("narrated_video_jobs").update({
      status: "generating_scenes",
      roteiro_melhorado: roteiroMelhorado,
      scene_comfy_ids: [scene0Id],
      scene_comfy_index: 0,
      scene_chain_idx: 0,
      scene_plans: scenePlans,
      scene_built_urls: [],
      scenes_needed: scenesNeeded,
      audio_url: audioUrl || null,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`[narrated] job ${jobId} → generating_scenes (cadeia de ${scenesNeeded} cenas, cena 0 submetida)`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[narrated] submit error job ${jobId}:`, errMsg);
    await supabase.from("narrated_video_jobs")
      .update({ status: "failed", error_message: errMsg, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }
}
