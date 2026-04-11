import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getToken(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "");
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser(getToken(req));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("bot_onboarding")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ onboarding: data ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser(getToken(req));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { business_name, business_type, products, tone } = body;

  if (!business_name || !products) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const context = await generateBusinessContext({ business_name, business_type, products, tone });

  await supabaseAdmin.from("bot_onboarding").upsert({
    user_id: user.id,
    business_name,
    business_type: business_type ?? "",
    products,
    tone: tone ?? "",
    context,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, context });
}

async function generateBusinessContext(data: {
  business_name: string;
  business_type: string;
  products: string;
  tone: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return `Empresa: ${data.business_name}. Tipo: ${data.business_type}. Produtos: ${data.products}. Tom: ${data.tone || "profissional e amigável"}.`;
  }

  const prompt = `Com base nas informações abaixo, crie um contexto de negócio COMPACTO (máx 200 palavras) para um assistente de IA que vai ajudar este empreendedor a criar conteúdo e melhorar suas fotos de produto. Seja objetivo: o que vende, para quem, tom e diferenciais.

Nome: ${data.business_name}
Tipo: ${data.business_type}
Produtos: ${data.products}
Tom preferido: ${data.tone || "profissional e amigável"}

Responda APENAS com o contexto em parágrafo, sem títulos.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const json = await res.json();
    return json.content?.[0]?.text ?? `Empresa: ${data.business_name}. Produtos: ${data.products}.`;
  } catch {
    return `Empresa: ${data.business_name}. Produtos: ${data.products}. Tom: ${data.tone || "profissional"}.`;
  }
}
