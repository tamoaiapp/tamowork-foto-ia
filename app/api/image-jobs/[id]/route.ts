import { after, NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkImageJob } from "@/lib/image-jobs/check";
import { submitImageJob } from "@/lib/image-jobs/submit";
import { cancelRunpodJob, RUNPOD_FOTO_ENDPOINT } from "@/lib/comfyui/runpod-client";

export const maxDuration = 300;

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

  const active = ["queued", "submitting", "submitted", "processing"].includes(data.status);
  const now = Date.now();
  if (active && now - new Date(data.created_at).getTime() >= 15 * 60_000) {
    const { data: expired, error: expireError } = await supabase.from("image_jobs")
      .update({ status: "failed", error_message: "A geração excedeu o tempo limite. Tente novamente.", updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).eq("status", data.status)
      .select().maybeSingle();
    if (expireError) return NextResponse.json({ error: "Não foi possível atualizar a geração." }, { status: 503 });
    if (expired) {
      if (data.external_job_id?.startsWith("runpod:")) {
        after(async () => { await cancelRunpodJob(RUNPOD_FOTO_ENDPOINT, data.external_job_id.slice(7)); });
      }
      return NextResponse.json(expired);
    }
  }

  // Uma função pode ter sido interrompida no deploy anterior. O prazo de
  // seis minutos supera maxDuration, evitando retomar um envio ainda vivo.
  if (data.status === "submitting" && now - new Date(data.updated_at ?? data.created_at).getTime() >= 6 * 60_000) {
    const { data: recovered } = await supabase.from("image_jobs")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).eq("status", "submitting")
      .eq("updated_at", data.updated_at).select().maybeSingle();
    if (recovered) Object.assign(data, recovered);
  }

  // Promise.race(8s) encerrava a resposta com visão/download ainda em curso.
  // after() mantém a função viva até terminar, sem bloquear o polling.
  if (["queued", "submitted", "processing"].includes(data.status)) {
    after(async () => {
      try {
        if (data.status === "queued") await submitImageJob(id);
        else await checkImageJob(id);
      } catch (error) { console.error("[photo-poll]", id, error); }
    });
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
