import { NextRequest, NextResponse } from "next/server";
import { submitImageJob } from "@/lib/image-jobs/submit";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function POST(req: NextRequest) {
  if (!INTERNAL_SECRET) {
    console.error("[submit] INTERNAL_SECRET não configurado no ambiente");
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 503 });
  }
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { jobId } = body;
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatório" }, { status: 400 });
  }

  try {
    await submitImageJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao submeter job";
    console.error("[submit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
