import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createImageJob, RateLimitError } from "@/lib/image-jobs/create";
import { getUserPlan } from "@/lib/plans";

// GET /api/image-jobs — lista jobs + plano do usuário autenticado
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [jobsResult, plan] = await Promise.all([
    supabase
      .from("image_jobs")
      .select()
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getUserPlan(user.id),
  ]);

  if (jobsResult.error) return NextResponse.json({ error: jobsResult.error.message }, { status: 500 });
  return NextResponse.json({ jobs: jobsResult.data, plan });
}

// POST /api/image-jobs — cria novo job
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { prompt, input_image_url, format, bonus_retry } = body;

  // prompt pode ser vazio — nesse caso a visão lê a imagem automaticamente
  if (!input_image_url) {
    return NextResponse.json({ error: "input_image_url é obrigatória" }, { status: 400 });
  }

  // Valida URL da imagem — rejeita URLs malformadas (ex: "https://https:")
  try {
    const parsed = new URL(input_image_url);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return NextResponse.json({ error: "input_image_url inválida" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "input_image_url inválida" }, { status: 400 });
  }

  try {
    const validFormat = ["story","square","portrait","horizontal"].includes(format) ? format : "story";
    const job = await createImageJob(user.id, prompt, input_image_url, validFormat, !!bonus_retry);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", nextAvailableAt: err.nextAvailableAt.toISOString() },
        { status: 429 }
      );
    }
    const message = err instanceof Error ? err.message : "Erro ao criar job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
