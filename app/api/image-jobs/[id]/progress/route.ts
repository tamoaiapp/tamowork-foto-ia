import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

// Tempo médio em segundos por etapa (ajustado com dados reais)
const AVG_QUEUE_WAIT_PER_JOB = 45;  // ~45s por job na frente
const AVG_PROCESSING_TIME    = 90;  // ~90s para processar uma imagem

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Busca o job atual
  const { data: job, error } = await supabase
    .from("image_jobs")
    .select("id, status, created_at, updated_at, attempts, output_image_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }

  // Se já terminou — dispara push server-side (funciona com app fechado)
  if (job.status === "done") {
    // Dispara em background, não bloqueia a resposta
    sendPushToUser(user.id, "Sua foto está pronta! ✨", "Toque para ver o resultado.", "/").catch(() => {});
    return NextResponse.json({
      status: "done",
      position: 0,
      queueSize: 0,
      estimatedSeconds: 0,
      progress: 100,
      phase: "done",
      output_image_url: job.output_image_url,
    });
  }

  if (job.status === "failed" || job.status === "canceled") {
    return NextResponse.json({
      status: job.status,
      progress: 0,
      phase: job.status,
    });
  }

  // Conta quantos jobs estão na frente (queued criados antes do nosso)
  const { count: queueAhead } = await supabase
    .from("image_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued")
    .lt("created_at", job.created_at);

  // Conta quantos estão sendo processados agora
  const { count: processing } = await supabase
    .from("image_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["submitted", "processing"]);

  const position = (queueAhead ?? 0) + 1;
  const queueSize = position + (processing ?? 0);

  // Calcula progresso e tempo estimado por fase
  let progress = 0;
  let estimatedSeconds = 0;
  let phase: string = job.status;

  if (job.status === "queued") {
    // Fase 1: na fila — progresso de 0 a 20% conforme avança na fila
    // Quanto mais perto de position=1, mais próximo de 20%
    const maxExpectedQueue = Math.max(queueSize, 1);
    progress = Math.round(((maxExpectedQueue - position) / maxExpectedQueue) * 20);
    estimatedSeconds = (position - 1) * AVG_QUEUE_WAIT_PER_JOB + AVG_PROCESSING_TIME;
    phase = "queued";
  } else if (job.status === "submitted") {
    // Fase 2: enviado para ComfyUI — 20-40%
    progress = 30;
    estimatedSeconds = Math.round(AVG_PROCESSING_TIME * 0.8);
    phase = "submitted";
  } else if (job.status === "processing") {
    // Fase 3: processando — 40-90% conforme tentativas aumentam
    const maxAttempts = 40;
    const attemptRatio = Math.min((job.attempts ?? 0) / maxAttempts, 1);
    progress = 40 + Math.round(attemptRatio * 50);
    estimatedSeconds = Math.round(AVG_PROCESSING_TIME * (1 - attemptRatio));
    phase = "processing";
  }

  return NextResponse.json({
    status: job.status,
    position,
    queueSize,
    estimatedSeconds: Math.max(estimatedSeconds, 0),
    progress,
    phase,
    attempts: job.attempts,
  });
}
