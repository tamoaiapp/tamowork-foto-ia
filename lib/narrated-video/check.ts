/**
 * Narrated Video — Check / State Machine
 *
 * Estados:
 *   queued            → submitNarratedVideoJob() → generating_scenes
 *   generating_scenes → polling ComfyUI → assembling
 *   assembling        → polling assembly server → done | failed
 */
import { createServerClient } from "@/lib/supabase/server";
import { getComfyHistory, COMFY_BASES } from "@/lib/comfyui/client";

const ASSEMBLY_BASE = process.env.NARRATED_ASSEMBLY_BASE ?? "";

// ─── Chama o servidor de montagem no pod de vídeo ────────────────────────────

async function startAssembly(
  jobId: string,
  sceneUrls: string[],
  text: string,
  voice?: string
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
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    }),
    signal: AbortSignal.timeout(10_000), // Responde rápido (só inicia background)
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

  // ── Estado: gerando cenas no ComfyUI ──────────────────────────────────────
  if (job.status === "generating_scenes") {
    const comfyBase = COMFY_BASES[job.scene_comfy_index ?? 0] ?? COMFY_BASES[0];
    const promptIds: string[] = job.scene_comfy_ids ?? [];

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

    // Verifica cada cena
    const sceneUrls: string[] = [];
    let allSettled = true;

    for (const promptId of promptIds) {
      try {
        const result = await getComfyHistory(promptId, comfyBase);
        if (result.status === "done" && result.outputUrl) {
          sceneUrls.push(result.outputUrl);
        } else if (result.status === "failed") {
          // Cena falhou — ignora e continua com as outras
          console.warn(`[narrated] cena ${promptId} falhou — ignorando`);
        } else {
          // Ainda processando
          allSettled = false;
          break; // Não precisa checar as próximas agora
        }
      } catch {
        allSettled = false;
        break;
      }
    }

    if (!allSettled || sceneUrls.length < 2) {
      console.log(`[narrated] job ${jobId} aguardando cenas (${sceneUrls.length}/${promptIds.length})`);
      return; // Cron verifica no próximo ciclo
    }

    // Todas as cenas prontas → inicia montagem
    console.log(`[narrated] job ${jobId} → ${sceneUrls.length} cenas prontas, iniciando montagem`);

    await supabase.from("narrated_video_jobs")
      .update({
        status: "assembling",
        scene_urls: sceneUrls,
        attempts: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    try {
      await startAssembly(jobId, sceneUrls, job.roteiro_melhorado || job.roteiro, job.voice);
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
