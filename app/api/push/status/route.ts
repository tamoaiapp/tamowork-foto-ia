import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// PATCH /api/push/status
// Body: { status: 'enabled' | 'denied' | 'skipped' }
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { status } = await req.json();
  if (!["enabled", "denied", "skipped"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  await supabase.from("user_plans").upsert(
    {
      user_id: user.id,
      push_status: status,
      push_prompt_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return NextResponse.json({ ok: true });
}
