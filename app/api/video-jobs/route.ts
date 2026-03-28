import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createVideoJob, ProRequiredError } from "@/lib/video-jobs/create";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from("video_jobs")
    .select()
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { prompt, input_image_url } = await req.json();
  if (!input_image_url) return NextResponse.json({ error: "input_image_url obrigatório" }, { status: 400 });

  try {
    const job = await createVideoJob(user.id, prompt ?? "", input_image_url);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (err) {
    if (err instanceof ProRequiredError) {
      return NextResponse.json({ error: "pro_required" }, { status: 403 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
