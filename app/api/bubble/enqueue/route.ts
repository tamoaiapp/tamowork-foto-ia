import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY ?? "";
const BUBBLE_SERVICE_USER_ID = process.env.BUBBLE_SERVICE_USER_ID ?? "";

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
  else if (!image_url.startsWith("http://") && !image_url.startsWith("https://")) image_url = "https://" + image_url;

  const supabase = createServerClient();

  // Criar job — o cron de 1 minuto vai processar automaticamente
  const prompt = uso ? `${produto.trim()} | cenário: ${uso.trim()}` : produto.trim();

  const { data: job, error: insertError } = await supabase
    .from("image_jobs")
    .insert({
      user_id: BUBBLE_SERVICE_USER_ID,
      prompt,
      input_image_url: image_url,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !job) {
    return NextResponse.json({ ok: false, error: insertError?.message ?? "Erro ao criar job" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, job_id: job.id, status: "queued" }, { status: 201 });
}
