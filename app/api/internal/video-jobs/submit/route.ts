import { NextRequest, NextResponse } from "next/server";
import { submitVideoJob } from "@/lib/video-jobs/submit";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "tamowork-internal-2026";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { jobId } = await req.json();
  await submitVideoJob(jobId);
  return NextResponse.json({ ok: true });
}
