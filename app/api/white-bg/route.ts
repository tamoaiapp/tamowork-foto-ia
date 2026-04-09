import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createImageJob, RateLimitError } from "@/lib/image-jobs/create";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { input_image_url, output_image_url, prompt } = body;
  if (!input_image_url) {
    return NextResponse.json({ error: "input_image_url obrigatório" }, { status: 400 });
  }

  try {
    // Registra o job (verifica rate limit)
    let job;
    try {
      job = await createImageJob(user.id, prompt ?? "fundo branco", input_image_url);
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json(
          { error: "rate_limited", nextAvailableAt: err.nextAvailableAt.toISOString() },
          { status: 429 }
        );
      }
      throw err;
    }

    // output_image_url já processado pelo browser — apenas marca como done
    const resultUrl = output_image_url as string;

    await supabase
      .from("image_jobs")
      .update({
        status: "done",
        output_image_url: resultUrl,
        mode: "fundo_branco",
      })
      .eq("id", job.id);

    return NextResponse.json({
      jobId: job.id,
      status: "done",
      output_image_url: resultUrl,
    });

  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", nextAvailableAt: err.nextAvailableAt.toISOString() },
        { status: 429 }
      );
    }
    console.error("[white-bg] erro:", err);
    return NextResponse.json({ error: "Erro ao processar imagem" }, { status: 500 });
  }
}
