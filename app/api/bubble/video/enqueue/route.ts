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

  let body: { image_url?: string; prompt_pos?: string; prompt_neg?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  let { image_url, prompt_pos, prompt_neg } = body;

  if (!image_url) return NextResponse.json({ ok: false, error: "image_url obrigatório" }, { status: 400 });

  // Normaliza URL — aceita com ou sem https://
  image_url = image_url.trim();
  if (image_url.startsWith("//")) image_url = "https:" + image_url;
  else if (!image_url.startsWith("http://") && !image_url.startsWith("https://")) image_url = "https://" + image_url;

  const supabase = createServerClient();

  const { data: job, error: insertError } = await supabase
    .from("video_jobs")
    .insert({
      user_id: BUBBLE_SERVICE_USER_ID,
      prompt: prompt_pos?.trim() ?? "",
      prompt_neg: prompt_neg?.trim() ?? null,
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
