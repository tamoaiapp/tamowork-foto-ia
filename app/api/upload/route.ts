import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/upload — faz upload da imagem do usuário e retorna URL pública
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Aceita tanto JSON com base64 (iOS Safari) quanto FormData (outros navegadores)
  let buffer: ArrayBuffer;
  let ext = "jpg";
  let contentType = "image/jpeg";

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    let body: { data_url?: string; name?: string };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
    if (!body.data_url) return NextResponse.json({ error: "data_url obrigatório" }, { status: 400 });
    const match = body.data_url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: "data_url inválido" }, { status: 400 });
    contentType = match[1];
    const rawBytes = Buffer.from(match[2], "base64");
    buffer = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength);
    const nameExt = (body.name ?? "").split(".").pop()?.toLowerCase() ?? "";
    ext = ["jpg", "jpeg", "png", "webp"].includes(nameExt) ? nameExt : "jpg";
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Imagem muito grande. Use uma foto menor que 15MB." }, { status: 400 });
    const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    contentType = file.type || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
    buffer = await file.arrayBuffer();
  }

  // Validação de tamanho (15MB)
  if (buffer.byteLength > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem muito grande. Use uma foto menor que 15MB." }, { status: 400 });
  }

  const fileName = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("input-images")
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("[upload] Supabase error:", uploadError.message);
    return NextResponse.json({ error: `Erro ao salvar imagem: ${uploadError.message}` }, { status: 500 });
  }

  const { data } = supabase.storage.from("input-images").getPublicUrl(fileName);

  return NextResponse.json({ url: data.publicUrl });
}
