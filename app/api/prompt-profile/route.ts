import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUserId(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return null;
  const { data } = await getAdmin().auth.getUser(token);
  return data.user?.id ?? null;
}

// GET /api/prompt-profile — retorna perfil + correções do usuário
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const sb = getAdmin();
  const [profileRes, correctionsRes] = await Promise.all([
    sb.from("user_prompt_profiles").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("photo_product_corrections").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ok: true,
    profile: profileRes.data ?? null,
    corrections: correctionsRes.data ?? [],
  });
}

// POST /api/prompt-profile — salva/atualiza perfil de estilo
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { lighting, background, style_pref, extra_context } = body;

  const sb = getAdmin();
  const { error } = await sb.from("user_prompt_profiles").upsert({
    user_id: userId,
    lighting: lighting ?? "",
    background: background ?? "",
    style_pref: style_pref ?? "",
    extra_context: extra_context ?? "",
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT /api/prompt-profile — adiciona correção de produto
export async function PUT(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { product_keywords, anchor_correction, notes, id } = body;

  if (!product_keywords?.length || !anchor_correction) {
    return NextResponse.json({ ok: false, error: "product_keywords e anchor_correction são obrigatórios" }, { status: 400 });
  }

  const sb = getAdmin();

  if (id) {
    // Atualiza correção existente
    const { error } = await sb.from("photo_product_corrections")
      .update({ product_keywords, anchor_correction, notes: notes ?? "", updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", userId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    // Cria nova correção
    const { error } = await sb.from("photo_product_corrections").insert({
      user_id: userId,
      product_keywords,
      anchor_correction,
      notes: notes ?? "",
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/prompt-profile — remove correção de produto
export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: "id obrigatório" }, { status: 400 });

  const { error } = await getAdmin().from("photo_product_corrections")
    .delete().eq("id", id).eq("user_id", userId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
