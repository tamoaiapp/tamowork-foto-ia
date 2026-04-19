/**
 * Narrated Video — Check / State Machine
 *
 * Estados:
 *   queued            → submitNarratedVideoJob() → generating_scenes
 *   generating_scenes → polling ComfyUI → assembling
 *   assembling        → polling assembly server → done | failed
 */
import { createServerClient } from "@/lib/supabase/server";
import { getComfyHistory, uploadImageToComfy, COMFY_BASES } from "@/lib/comfyui/client";
import { submitSceneVariation, type ScenePlan } from "@/lib/narrated-video/submit";
import { type PhotoFormat } from "@/lib/formats";

const ASSEMBLY_BASE = process.env.NARRATED_ASSEMBLY_BASE ?? "";

// ─── Chama o servidor de montagem no pod de vídeo ────────────────────────────

async function startAssembly(
  jobId: string,
  sceneUrls: string[],
  text: string,
  voice?: string,
  audioUrl?: string,
  voiceSampleUrl?: string,
): Promise<void> {
  if (!ASSEMBLY_BASE) throw new Error("NARRATED_ASSEMBLY_BASE não configurado");

  const res = await fetch(`${ASSEMBLY_BASE}/assemble`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      scenes: sceneUrls,
      text,
      voice: voice ?? "feminino",
      voice_sample_url: voiceSampleUrl ?? undefined,
      audio_url: audioUrl ?? "",
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Assembly server HTTP ${res.status}`);
  const data = await res.json() as { started?: boolean; error?: string };
  if (!data.started) throw new Error(data.error ?? "Assembly não iniciou");
}

async function pollAssemblyStatus(
  jobId: string
): Promise<{ status: "processing" | "done" | "failed" | "unknown"; video_url?: string; error?: string }> {
  if (!ASSEMBLY_BASE) return { status: "unknown" };

  try {
    const res = await fetch(`${ASSEMBLY_BASE}/status/${jobId}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { status: "unknown" };
    return await res.json();
  } catch {
    return { status: "unknown" };
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const MAX_SCENE_ATTEMPTS = 80; // ~80 min máximo gerando cenas

export async function checkNarratedVideoJob(jobId: string): Promise<void> {
  const supabase = createServerClient();

  const { data: job } = await supabase
    .from("narrated_video_jobs")
    .select()
    .eq("id", jobId)
    .single();

  if (!job) return;
  if (["done", "failed", "canceled"].includes(job.status)) return;

  // ── Estado: gerando cenas no ComfyUI (cadeia sequencial) ─────────────────
  if (job.status === "generating_scenes") {
    const comfyBase = COMFY_BASES[job.scene_comfy_index ?? 0] ?? COMFY_BASES[0];
    const promptIds: string[] = job.scene_comfy_ids ?? [];
    const chainIdx: number = job.scene_chain_idx ?? 0;
    const scenesNeeded: number = job.scenes_needed ?? 4;
    const scenePlans: ScenePlan[] = (job.scene_plans as ScenePlan[]) ?? [];
    const builtUrls: string[] = (job.scene_built_urls as string[]) ?? [];

    if (!comfyBase || promptIds.length === 0) {
      await supabase.from("narrated_video_jobs")
        .update({ status: "failed", error_message: "Configuração inválida: sem prompt IDs" })
        .eq("id", jobId);
      return;
    }

    const newAttempts = (job.attempts ?? 0) + 1;
    await supabase.from("narrated_video_jobs")
      .update({ attempts: newAttempts, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    if (newAttempts >= MAX_SCENE_ATTEMPTS) {
      await supabase.from("narrated_video_jobs")
        .update({ status: "failed", error_message: "Timeout ao gerar cenas" })
        .eq("id", jobId);
      return;
    }

    // Verifica apenas a cena atual da cadeia
    const currentPromptId = promptIds[chainIdx];
    if (!currentPromptId) {
      await supabase.from("narrated_video_jobs")
        .update({ status: "failed", error_message: `Prompt ID ausente para cena ${chainIdx}` })
        .eq("id", jobId);
      return;
    }

    let result: { status: string; outputUrl?: string | null };
    try {
      result = await getComfyHistory(currentPromptId, comfyBase);
    } catch {
      console.log(`[narrated] job ${jobId} cena ${chainIdx} — erro ao checar ComfyUI, aguardando`);
      return;
    }

    if (result.status === "failed") {
      console.warn(`[narrated] cena ${chainIdx} falhou — abortando job`);
      await supabase.from("narrated_video_jobs")
        .update({ status: "failed", error_message: `Cena ${chainIdx} falhou no ComfyUI` })
        .eq("id", jobId);
      return;
    }

    if (result.status !== "done" || !result.outputUrl) {
      // Ainda processando — aguarda próximo ciclo
      console.log(`[narrated] job ${jobId} aguardando cena ${chainIdx}/${scenesNeeded - 1}`);
      return;
    }

    // Cena atual concluída — acumula a URL
    const newBuiltUrls = [...builtUrls, result.outputUrl];
    const nextIdx = chainIdx + 1;

    console.log(`[narrated] job ${jobId} cena ${chainIdx} pronta (${newBuiltUrls.length}/${scenesNeeded})`);

    if (nextIdx < scenesNeeded && scenePlans[nextIdx]) {
      // Ainda há cenas — submete a próxima usando o output desta como input (cadeia)
      try {
        const chainImageName = await uploadImageToComfy(
          result.outputUrl,
          comfyBase,
          `narr_chain_${jobId.replace(/-/g, "").slice(0, 8)}_s${nextIdx}`
        );
        const { positive, negative } = scenePlans[nextIdx];
        const jobFormat = (job.format as PhotoFormat) ?? "story";
        const nextPromptId = await submitSceneVariation(
          chainImageName, positive, negative, jobId, nextIdx, comfyBase, jobFormat
        );

        await supabase.from("narrated_video_jobs").update({
          scene_comfy_ids: [...promptIds, nextPromptId],
          scene_chain_idx: nextIdx,
          scene_built_urls: newBuiltUrls,
          attempts: 0, // reset timeout counter para a nova cena
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);

        console.log(`[narrated] job ${jobId} → cena ${nextIdx} submetida (cadeia)`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[narrated] erro ao submeter cena ${nextIdx} em cadeia:`, errMsg);
        await supabase.from("narrated_video_jobs")
          .update({ status: "failed", error_message: `Erro na cadeia cena ${nextIdx}: ${errMsg}` })
          .eq("id", jobId);
      }
      return;
    }

    // Todas as cenas prontas → inicia montagem
    const allSceneUrls = newBuiltUrls;
    console.log(`[narrated] job ${jobId} → ${allSceneUrls.length} cenas prontas, iniciando montagem`);

    await supabase.from("narrated_video_jobs")
      .update({
        status: "assembling",
        scene_urls: allSceneUrls,
        scene_built_urls: allSceneUrls,
        attempts: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    try {
      await startAssembly(jobId, allSceneUrls, job.roteiro_melhorado || job.roteiro, job.voice, job.audio_url ?? undefined, job.voice_sample_url ?? undefined);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[narrated] assembly start error job ${jobId}:`, errMsg);
      await supabase.from("narrated_video_jobs")
        .update({ status: "failed", error_message: `Erro ao iniciar montagem: ${errMsg}` })
        .eq("id", jobId);
    }
    return;
  }

  // ── Estado: montando vídeo no pod ─────────────────────────────────────────
  if (job.status === "assembling") {
    const newAttempts = (job.attempts ?? 0) + 1;
    await supabase.from("narrated_video_jobs")
      .update({ attempts: newAttempts, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    if (newAttempts >= 30) {
      await supabase.from("narrated_video_jobs")
        .update({ status: "failed", error_message: "Timeout na montagem do vídeo" })
        .eq("id", jobId);
      return;
    }

    const result = await pollAssemblyStatus(jobId);

    if (result.status === "done" && result.video_url) {
      await supabase.from("narrated_video_jobs")
        .update({
          status: "done",
          output_video_url: result.video_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      console.log(`[narrated] job ${jobId} → done! ${result.video_url}`);
    } else if (result.status === "failed") {
      await supabase.from("narrated_video_jobs")
        .update({
          status: "failed",
          error_message: result.error ?? "Falha na montagem do vídeo",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    } else {
      console.log(`[narrated] job ${jobId} ainda montando... (tentativa ${newAttempts})`);
    }
  }
}
