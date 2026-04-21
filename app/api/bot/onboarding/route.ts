import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

function getToken(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "");
}

function cleanValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(getToken(req));

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin.from("bot_onboarding").select("*").eq("user_id", user.id).single();
  return NextResponse.json({ onboarding: data ?? null });
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(getToken(req));

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const business_name = cleanValue(body?.business_name);
  const business_type = cleanValue(body?.business_type);
  const products = cleanValue(body?.products);
  const tone = cleanValue(body?.tone);

  if (!business_name || !business_type || !products || !tone) {
    return NextResponse.json({ error: "Responda as 4 perguntas do onboarding para continuar." }, { status: 400 });
  }

  const context = await generateBusinessContext({
    business_name,
    business_type,
    products,
    tone,
  });

  await supabaseAdmin.from("bot_onboarding").upsert({
    user_id: user.id,
    business_name,
    business_type,
    products,
    tone,
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
  const ollamaBase = process.env.OLLAMA_BASE;

  if (!ollamaBase) {
    return (
      `Empresa: ${data.business_name}. ` +
      `Nicho: ${data.business_type}. ` +
      `Produtos principais: ${data.products}. ` +
      `Canal e desafio atual: ${data.tone}.`
    );
  }

  const prompt = `Escreva um resumo do NEGOCIO DO USUARIO em um unico paragrafo curto.
IMPORTANTE: escreva sobre o NEGOCIO DO USUARIO, nao sobre o TamoWork.
Inclua: o que o usuario vende, o nicho, os produtos principais, onde vende e o desafio comercial.

Nome do negocio do usuario: ${data.business_name}
Nicho do usuario: ${data.business_type}
Produtos principais do usuario: ${data.products}
Canal e desafio do usuario: ${data.tone}

Responda apenas com o resumo do negocio do usuario, em portugues.`;

  try {
    const res = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { num_predict: 260, temperature: 0.4 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }

    const json = await res.json();
    return (
      cleanValue(json.message?.content) ||
      `Empresa: ${data.business_name}. Nicho: ${data.business_type}. Produtos principais: ${data.products}. Canal e desafio atual: ${data.tone}.`
    );
  } catch {
    return `Empresa: ${data.business_name}. Nicho: ${data.business_type}. Produtos principais: ${data.products}. Canal e desafio atual: ${data.tone}.`;
  }
}
