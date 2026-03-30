import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { COMFY_BASES, uploadImageToComfy, submitWorkflow, criarPrompt } from "@/lib/comfyui/client";
import { qstash } from "@/lib/qstash/client";

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY ?? "";
const BUBBLE_SERVICE_USER_ID = process.env.BUBBLE_SERVICE_USER_ID ?? "";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  return key === BUBBLE_API_KEY && BUBBLE_API_KEY !== "";
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!BUBBLE_SERVICE_USER_ID) {
    return NextResponse.json({ ok: false, error: "BUBBLE_SERVICE_USER_ID não configurado" }, { status: 503 });
  }

  let body: { image_url?: string; produto?: string; uso?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  let { image_url, produto, uso } = body;

  if (!image_url) return NextResponse.json({ ok: false, error: "image_url obrigatório" }, { status: 400 });
  if (!produto)   return NextResponse.json({ ok: false, error: "produto obrigatório" }, { status: 400 });

  image_url = image_url.trim();
  if (image_url.startsWith("//")) image_url = "https:" + image_url;

  // 1. Gerar prompt via promptuso
  let promptPos: string;
  let promptNeg: string;
  try {
    const result = await criarPrompt(produto.trim(), (uso ?? "").trim());
    promptPos = result.positive;
    promptNeg = result.negative ?? "nao mexa no produto";
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Erro no promptuso: ${(err as Error).message}` }, { status: 500 });
  }

  const supabase = createServerClient();

  // 2. Criar job no Supabase para obter o UUID real
  const { data: job, error: insertError } = await supabase
    .from("image_jobs")
    .insert({
      user_id: BUBBLE_SERVICE_USER_ID,
      prompt: produto,
      input_image_url: image_url,
      status: "queued",
    })
    .select()
    .single();

  if (insertError || !job) {
    return NextResponse.json({ ok: false, error: insertError?.message ?? "Erro ao criar job" }, { status: 500 });
  }

  // 3. Upload + submit no ComfyUI usando o UUID real (~2s)
  try {
    const comfyIndex = 0;
    const comfyBase = COMFY_BASES[0];
    const imageName = await uploadImageToComfy(image_url, comfyBase, job.id);
    const promptId = await submitWorkflow(job.id, imageName, promptPos, promptNeg, comfyBase);

    await supabase.from("image_jobs").update({
      status: "submitted",
      external_job_id: `${comfyIndex}:${promptId}`,
      provider: "comfyui-direct",
    }).eq("id", job.id);

    // 4. QStash agenda o check em 45s
    await qstash.publishJSON({
      url: `${process.env.APP_URL}/api/internal/image-jobs/check`,
      delay: 45,
      body: { jobId: job.id },
      headers: { "x-internal-secret": INTERNAL_SECRET },
    }).catch(() => {
      console.error("[bubble/enqueue] QStash falhou");
    });

    return NextResponse.json({ ok: true, job_id: job.id, status: "submitted" }, { status: 201 });

  } catch (err) {
    await supabase.from("image_jobs").update({
      status: "failed",
      error_message: (err as Error).message,
    }).eq("id", job.id);

    return NextResponse.json({ ok: false, error: `Erro no ComfyUI: ${(err as Error).message}` }, { status: 500 });
  }
}
