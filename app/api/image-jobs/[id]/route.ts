import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkImageJob } from "@/lib/image-jobs/check";
import { submitImageJob } from "@/lib/image-jobs/submit";

// GET /api/image-jobs/:id — consulta status de um job
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("image_jobs")
    .select()
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }

  // Aciona submit/check inline — cron roda no deploy antigo, não no prod
  if (data.status === "queued") {
    try {
      await submitImageJob(id);
      const { data: updated } = await supabase
        .from("image_jobs")
        .select()
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (updated) return NextResponse.json(updated);
    } catch {
      // Pod pode estar iniciando — retorna estado atual
    }
  } else if (["submitted", "processing"].includes(data.status)) {
    try {
      await checkImageJob(id);
      const { data: updated } = await supabase
        .from("image_jobs")
        .select()
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (updated) return NextResponse.json(updated);
    } catch {
      // Ignora erros no check — retorna estado atual
    }
  }

  return NextResponse.json(data);
}

// DELETE /api/image-jobs/:id — apaga um job e sua imagem do storage
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const { data: job } = await supabase
    .from("image_jobs")
    .select("output_image_url, input_image_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!job) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Apaga imagem de output do storage se for URL do Supabase
  if (job.output_image_url?.includes("/storage/v1/object/")) {
    const path = job.output_image_url.split("/storage/v1/object/public/")[1];
    if (path) {
      const [bucket, ...rest] = path.split("/");
      await supabase.storage.from(bucket).remove([rest.join("/")]);
    }
  }

  await supabase.from("image_jobs").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
