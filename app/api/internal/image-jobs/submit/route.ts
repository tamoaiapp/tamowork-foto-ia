import { Receiver } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";
import { submitImageJob } from "@/lib/image-jobs/submit";

export async function POST(req: NextRequest) {
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";

  const isValid = await receiver.verify({ signature, body }).catch(() => false);
  if (!isValid) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const { jobId } = JSON.parse(body);
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
