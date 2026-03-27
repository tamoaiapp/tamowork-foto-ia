import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createImageJob } from "@/lib/image-jobs/create";

// GET /api/image-jobs — lista jobs do usuário autenticado
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("image_jobs")
    .select()
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
  const { prompt, input_image_url } = body;

  if (!prompt || !input_image_url) {
    return NextResponse.json({ error: "prompt e input_image_url são obrigatórios" }, { status: 400 });
  }

  try {
    const job = await createImageJob(user.id, prompt, input_image_url);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
