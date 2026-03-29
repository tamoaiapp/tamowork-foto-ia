import { NextRequest, NextResponse } from "next/server";
import { buildPromptResult } from "@/lib/promptuso/infer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const produtoRaw =
      body?.produto ??
      body?.produto_frase ??
      body?.product ??
      body?.name ??
      "";

    const cenarioRaw =
      body?.cenario ??
      body?.scenario ??
      body?.scene ??
      body?.contexto ??
      "";

    if (!produtoRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing produto/produto_frase/product" },
        { status: 400 }
      );
    }

    const result = buildPromptResult(String(produtoRaw), String(cenarioRaw));

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "tamo-ai-brain-v7-product-scenario",
    info: "POST /api/prompt com { produto_frase, cenario }",
  });
}
