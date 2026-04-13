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
  (workflow["39"] as { inputs: { prompt: string } }).inputs.prompt =
    "blurry, low quality, text, watermark, distorted";
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
    // 1. Descobre quantas cenas precisam com base na duração do áudio (via /prepare)
    let scenesNeeded = DEFAULT_SCENES;
    if (ASSEMBLY_BASE) {
      try {
        const prepRes = await fetch(`${ASSEMBLY_BASE}/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: job.roteiro, voice: job.voice ?? "feminino" }),
          signal: AbortSignal.timeout(30_000),
        });
        if (prepRes.ok) {
          const prep = await prepRes.json() as { duration_seconds: number; scenes_needed: number };
          scenesNeeded = prep.scenes_needed;
          console.log(`[narrated] áudio=${prep.duration_seconds}s → ${scenesNeeded} cenas`);
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

    // 4. Gera prompt profissional para fotos de produto
    const keywords = job.roteiro.split(/\s+/).slice(0, 10).join(" ");
    const promptPos = `professional product photography, clean studio lighting, sharp focus, high quality commercial photo, ${keywords}, white or neutral background`;

    // 5. Submete N variações ao ComfyUI (dinâmico com base na duração do áudio)
    const scenePromptIds: string[] = [];
    for (let i = 0; i < scenesNeeded; i++) {
      try {
        const promptId = await submitSceneVariation(imageName, promptPos, jobId, i, comfyBase);
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
