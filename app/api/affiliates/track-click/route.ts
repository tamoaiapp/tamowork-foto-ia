import { NextRequest, NextResponse } from "next/server";
import {
  getAffiliateSetupMessage,
  isAffiliateSchemaMissingError,
  recordAffiliateClick,
} from "@/lib/affiliates/server";

export async function POST(req: NextRequest) {
  let body: { code?: string; visitorId?: string; landingPath?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.code || !body.visitorId) {
    return NextResponse.json({ error: "code e visitorId são obrigatórios" }, { status: 400 });
  }

  try {
    const affiliate = await recordAffiliateClick({
      code: body.code,
      visitorId: body.visitorId,
      landingPath: body.landingPath ?? null,
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    if (!affiliate) {
      return NextResponse.json({ error: "Afiliado não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, affiliateCode: affiliate.code });
  } catch (err) {
    if (isAffiliateSchemaMissingError(err)) {
      return NextResponse.json({ error: getAffiliateSetupMessage() }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao registrar clique" },
      { status: 500 }
    );
  }
}
