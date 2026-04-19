import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// POST /api/voice-sample
// Body: audio blob (audio/webm ou audio/wav)
// Retorna: { url: string }
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "audio/webm";
  const ext = contentType.includes("wav") ? "wav" : contentType.includes("mp4") ? "m4a" : "webm";
  const fileName = `voice_${user.id}_${Date.now()}.${ext}`;

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength < 1000) {
    return NextResponse.json({ error: "Áudio muito curto" }, { status: 400 });
  }
  if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Áudio muito grande (máx 10MB)" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error: uploadErr } = await admin.storage
    .from("voice-samples")
    .upload(fileName, Buffer.from(arrayBuffer), {
      contentType,
      upsert: true,
    });

  if (uploadErr) {
    console.error("[voice-sample] upload error:", uploadErr.message);
    return NextResponse.json({ error: "Falha no upload do áudio" }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("voice-samples").getPublicUrl(fileName);
  return NextResponse.json({ url: urlData.publicUrl });
}
