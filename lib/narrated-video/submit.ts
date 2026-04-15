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

// Cenários por tipo de produto — escolhidos para combinar com o slot
const SLOT_CENARIOS: Record<string, string[]> = {
  wear_head_ear: [
    "close-up portrait, natural bokeh background, soft light on ear",
    "lifestyle portrait, outdoor sunlight, candid look",
    "indoor portrait, warm soft lighting, editorial style",
    "close-up side profile, sharp focus, natural skin",
  ],
  wear_head_top: [
    "outdoor lifestyle, natural sunlight, park or street background",
    "candid portrait, golden hour, casual look",
    "indoor lifestyle, modern interior, soft natural light",
  ],
  wear_head_face: [
    "outdoor lifestyle, sunny day, candid portrait",
    "beach or pool background, lifestyle photo, bright natural light",
    "indoor portrait, clean background, editorial style",
  ],
  wear_neck: [
    "portrait showing neck and décolleté, soft studio lighting",
    "outdoor lifestyle, natural sunlight, city background",
    "indoor lifestyle, warm light, elegant setting",
  ],
  wear_wrist: [
    "close-up wrist, outdoor natural light, lifestyle shot",
    "indoor portrait, wrist in focus, clean background",
    "lifestyle scene, candid moment, soft natural light",
  ],
  wear_finger: [
    "close-up hand, soft bokeh, natural light",
    "lifestyle portrait, hand in focus, outdoor setting",
    "indoor flat lay style, hand on elegant surface",
  ],
  wear_torso_upper: [
    "outdoor lifestyle, natural sunlight, city street",
    "park or garden, golden hour lighting",
    "indoor lifestyle, modern interior, soft natural light",
    "candid lifestyle moment, shopping area, natural light",
  ],
  wear_torso_full: [
    "outdoor lifestyle, natural sunlight, city street, full body",
    "park or garden, golden hour lighting, full body",
    "indoor lifestyle, modern interior, full body, soft natural light",
    "candid moment, shopping area or cafe, full body",
  ],
  wear_waist_legs: [
    "outdoor lifestyle, city street, lower body framing",
    "park, golden hour, lower body shot",
    "indoor lifestyle, modern floor, lower body framing",
  ],
  wear_feet: [
    "street style, urban pavement, close-up shoes, natural light",
    "outdoor lifestyle, park path, golden hour, shoes in focus",
    "indoor lifestyle, modern floor, close-up footwear",
  ],
  wear_back: [
    "outdoor lifestyle, city street, person from behind",
    "park or campus, natural light, back view",
    "travel setting, outdoor, backpack in use",
  ],
  wear_crossbody: [
    "outdoor lifestyle, city street, natural sunlight",
    "shopping area or cafe, candid lifestyle moment",
    "travel setting, outdoor, bag worn crossbody",
  ],
  hold_bag_hand: [
    "outdoor lifestyle, city street, natural sunlight, bag in hand",
    "shopping mall or boutique, lifestyle moment",
    "park or garden, golden hour, elegant casual look",
    "indoor lifestyle, modern interior, soft light",
  ],
  hold_device: [
    "indoor lifestyle, modern workspace or sofa, natural light",
    "outdoor, park bench or cafe, casual use",
    "home setting, soft warm lighting, device in use",
  ],
  hold_flower: [
    "wedding ceremony, elegant indoor setting, soft light",
    "outdoor garden, romantic natural light, floral close-up",
    "bridal shoot, soft bokeh background, bouquet in focus",
    "nature setting, golden hour, flowers in hands",
  ],
  hold_food_display: [
    "wooden table, natural light, food styling",
    "kitchen countertop, clean background, appetizing presentation",
    "outdoor picnic setting, natural light, food photography",
  ],
  hold_beauty_product: [
    "marble surface, luxury beauty photography, soft diffused light",
    "white or light neutral background, studio lighting, clean minimal",
    "natural setting, soft bokeh, lifestyle beauty photo",
  ],
  hold_beverage: [
    "outdoor lifestyle, cafe or street, natural light, held at chest",
    "indoor lifestyle, kitchen or home, warm lighting",
    "beach or park, sunny day, refreshing lifestyle shot",
  ],
  scene_tabletop: [
    "clean white surface, soft studio lighting, minimal background",
    "marble or wood surface, natural light, lifestyle flat lay",
    "elegant surface, soft light, product photography style",
  ],
  scene_home_indoor: [
    "cozy home setting, natural window light, lifestyle photo",
    "modern interior, minimal decor, soft neutral tones",
    "living room or kitchen, warm lighting, product in context",
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

// ─── Melhoria do roteiro via Ollama ───────────────────────────────────────────

async function improveRoteiro(original: string): Promise<string> {
  if (!OLLAMA_BASE) return original;
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt: `Você é especialista em roteiros de vídeo para redes sociais.
Melhore este roteiro para narração de vídeo de produto (Instagram/TikTok).
Mantenha natural, conversacional e direto. Máximo 100 palavras.
Responda APENAS com o roteiro melhorado, sem explicações ou aspas.

Roteiro: ${original}`,
        stream: false,
        options: { num_predict: 250, temperature: 0.6 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return original;
    const json = await res.json() as { response?: string };
    return json.response?.trim() || original;
  } catch {
    // Ollama indisponível — usa original
    return original;
  }
}

// ─── Submete workflow de variação no ComfyUI ─────────────────────────────────
// Usa a API /prompt diretamente com um workflow de img2img simplificado

async function submitSceneVariation(
  imageName: string,
  promptPos: string,
  promptNeg: string,
  jobId: string,
  sceneIndex: number,
  comfyBase: string
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

    // 5. Submete N variações ao ComfyUI (dinâmico com base na duração do áudio)
    const scenePromptIds: string[] = [];
    for (let i = 0; i < scenesNeeded; i++) {
      const cenario = cenarios[i % cenarios.length];
      const { positive, negative } = buildPromptResult(productText, cenario);
      try {
        const promptId = await submitSceneVariation(imageName, positive, negative, jobId, i, comfyBase);
        scenePromptIds.push(promptId);
      } catch (err) {
        console.error(`[narrated] scene ${i} submit error:`, err);
      }
    }

    if (scenePromptIds.length === 0) {
      throw new Error("Nenhuma cena foi submetida ao ComfyUI");
    }

    await supabase.from("narrated_video_jobs").update({
      status: "generating_scenes",
      roteiro_melhorado: roteiroMelhorado,
      scene_comfy_ids: scenePromptIds,
      scene_comfy_index: 0,
      scenes_needed: scenesNeeded,
      audio_url: audioUrl || null,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`[narrated] job ${jobId} → generating_scenes (${scenePromptIds.length} cenas)`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[narrated] submit error job ${jobId}:`, errMsg);
    await supabase.from("narrated_video_jobs")
      .update({ status: "failed", error_message: errMsg, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }
}
