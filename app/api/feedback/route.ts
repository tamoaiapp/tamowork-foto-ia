import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getToken(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "");
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser(getToken(req));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { job_id, rating, feedback_text, product_name, prompt_slot, input_url, output_url } = body;

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating inválido" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("prompt_feedback").insert({
    user_id: user.id,
    job_id: job_id ?? null,
    rating,
    feedback_text: feedback_text?.trim() ?? null,
    product_name: product_name ?? null,
    prompt_slot: prompt_slot ?? null,
    input_url: input_url ?? null,
    output_url: output_url ?? null,
  });

  if (error) {
    console.error("feedback insert error:", error);
    return NextResponse.json({ error: "Erro ao salvar feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
