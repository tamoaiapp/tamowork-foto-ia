import { NextRequest, NextResponse } from "next/server";
import { submitVideoJob } from "@/lib/video-jobs/submit";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function POST(req: NextRequest) {
  if (!INTERNAL_SECRET) {
    console.error("[video-submit] INTERNAL_SECRET não configurado no ambiente");
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 503 });
  }
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { jobId } = await req.json().catch(() => ({ jobId: null }));
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatório" }, { status: 400 });
  }
  try {
    await submitVideoJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao submeter vídeo job";
    console.error("[video-submit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
