import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [planRes, jobsRes] = await Promise.all([
    supabase
      .from("user_plans")
      .select("plan, period_end, stripe_subscription_id, mp_subscription_id, created_at")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("image_jobs")
      .select("id, status, output_image_url, input_image_url, created_at, prompt")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    plan: planRes.data ?? null,
    jobs: jobsRes.data ?? [],
  });
}
