import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createVideoJob, ProRequiredError, VideoRateLimitError } from "@/lib/video-jobs/create";

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

  let { prompt, input_image_url, format } = await req.json();
  if (!input_image_url) return NextResponse.json({ error: "input_image_url obrigatório" }, { status: 400 });

  // Sanitiza URL: remove protocolo duplo malformado (ex: "https://htpps::https://..." → "https://...")
  input_image_url = String(input_image_url).trim();
  input_image_url = input_image_url.replace(/^https?:\/\/[^/]{1,30}::https?:\/\//i, "https://");
  input_image_url = input_image_url.replace(/^https?:\/\/https?:\/\//i, "https://");
  if (!input_image_url.startsWith("http://") && !input_image_url.startsWith("https://")) {
    input_image_url = "https://" + input_image_url;
  }

  // Checa tamanho da fila global antes de criar
  const { count: queueSize } = await supabase
    .from("video_jobs")
    .select("*", { count: "exact", head: true })
    .in("status", ["queued", "submitted", "submitting", "processing"]);

  if ((queueSize ?? 0) >= 10) {
    return NextResponse.json({ error: "queue_busy" }, { status: 503 });
  }

  try {
    const validFormat = ["story","square","portrait","horizontal"].includes(format) ? format : "story";
    const job = await createVideoJob(user.id, prompt ?? "", input_image_url, validFormat);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (err) {
    if (err instanceof VideoRateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", nextAvailableAt: err.nextAvailableAt.toISOString() },
        { status: 429 }
      );
    }
    if (err instanceof ProRequiredError) {
      return NextResponse.json({ error: "pro_required" }, { status: 403 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
