import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  claimAffiliateReferral,
  getAffiliateSetupMessage,
  isAffiliateSchemaMissingError,
} from "@/lib/affiliates/server";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { code?: string; visitorId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.code) {
    return NextResponse.json({ error: "code é obrigatório" }, { status: 400 });
  }

  try {
    const referral = await claimAffiliateReferral({
      code: body.code,
      visitorId: body.visitorId ?? null,
      userId: user.id,
      userEmail: user.email ?? null,
    });

    return NextResponse.json({ ok: true, referral });
  } catch (err) {
    if (isAffiliateSchemaMissingError(err)) {
      return NextResponse.json({ error: getAffiliateSetupMessage() }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao vincular afiliado" },
      { status: 500 }
    );
  }
}
