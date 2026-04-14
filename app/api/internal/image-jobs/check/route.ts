import { NextRequest, NextResponse } from "next/server";
import { checkImageJob } from "@/lib/image-jobs/check";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { jobId } = body;
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatório" }, { status: 400 });
  }

  try {
    await checkImageJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao checar job";
    console.error("[check]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
