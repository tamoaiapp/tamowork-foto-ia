import { createServerClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { criarPrompt, startGeneration } from "@/lib/comfyui/client";
import { checkImageJob } from "@/lib/image-jobs/check";

const isLocalhost = (process.env.APP_URL ?? "").includes("localhost");

export async function submitImageJob(jobId: string) {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from("image_jobs")
    .select()
    .eq("id", jobId)
    .eq("status", "queued")
    .single();

  if (error || !job) throw new Error("Job não encontrado ou não está na fila");

  // Extrair produto e cenario do campo prompt (formato: "produto | cenário: cenario")
  const [produto_frase, cenarioPart] = (job.prompt ?? "").split(" | cenário: ");
  const cenario = cenarioPart ?? "";

  // Serviço 1 — clouda recebe produto + cenario e gera os prompts
  const promptResult = await criarPrompt(produto_frase.trim(), cenario.trim());

  // Serviço 2 — promptuso enfileira a geração com imagem + prompts
  const run = await startGeneration(
    job.input_image_url,
    promptResult.positive,
    promptResult.negative
  );

  // Salvar external_job_id no banco, mudar status para submitted
  await supabase
    .from("image_jobs")
    .update({
      status: "submitted",
      external_job_id: run.job_id,
      provider: "comfyui",
    })
    .eq("id", jobId);

  const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

  if (isLocalhost) {
    // Em localhost: QStash não alcança localhost, chama check diretamente após 45s
    setTimeout(() => checkImageJob(jobId).catch(console.error), 45_000);
  } else {
    // Em produção: QStash agenda o check com delay e header secreto
    await qstash.publishJSON({
      url: `${process.env.APP_URL}/api/internal/image-jobs/check`,
      delay: 45,
      body: { jobId },
      headers: { "x-internal-secret": INTERNAL_SECRET },
    });
  }
}
