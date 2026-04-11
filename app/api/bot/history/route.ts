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

  const { data: messages } = await supabaseAdmin
    .from("bot_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100);

  const { data: onboarding } = await supabaseAdmin
    .from("bot_onboarding")
    .select("business_name, context")
    .eq("user_id", user.id)
    .single();

  const { data: plan } = await supabaseAdmin
    .from("user_plans")
    .select("bot_active")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    messages: messages ?? [],
    hasOnboarding: !!onboarding?.context,
    businessName: onboarding?.business_name ?? null,
    botActive: plan?.bot_active ?? false,
  });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser(getToken(req));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabaseAdmin.from("bot_messages").delete().eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
