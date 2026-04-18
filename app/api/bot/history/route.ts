import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

function getToken(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "");
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

  const [{ data: rawMessages }, { data: onboarding }, { data: plan }] = await Promise.all([
    supabaseAdmin
      .from("bot_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("bot_onboarding")
      .select("business_name, business_type, products, tone, context")
      .eq("user_id", user.id)
      .single(),
    supabaseAdmin
      .from("user_plans")
      .select("bot_active")
      .eq("user_id", user.id)
      .single(),
  ]);

  const hasOnboarding = !!onboarding?.context;
  const messages = hasOnboarding ? (rawMessages ?? []).slice().reverse() : [];

  return NextResponse.json(
    {
      messages,
      hasOnboarding,
      businessName: onboarding?.business_name ?? null,
      businessType: onboarding?.business_type ?? null,
      products: onboarding?.products ?? null,
      tone: onboarding?.tone ?? null,
      context: onboarding?.context ?? null,
      botActive: plan?.bot_active ?? false,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
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
  const role = body?.role === "user" ? "user" : body?.role === "assistant" ? "assistant" : null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!role || !content) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const { data: onboarding } = await supabaseAdmin
    .from("bot_onboarding")
    .select("context")
    .eq("user_id", user.id)
    .single();

  if (!onboarding?.context) {
    return NextResponse.json({ error: "onboarding_required", needsOnboarding: true }, { status: 409 });
  }

  const { data: lastMessage } = await supabaseAdmin
    .from("bot_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMessage?.role === role && lastMessage?.content === content) {
    return NextResponse.json({ success: true, deduped: true });
  }

  await supabaseAdmin.from("bot_messages").insert({
    user_id: user.id,
    role,
    content,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(getToken(req));

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabaseAdmin.from("bot_messages").delete().eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
