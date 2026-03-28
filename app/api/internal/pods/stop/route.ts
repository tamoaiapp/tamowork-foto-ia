import { NextRequest, NextResponse } from "next/server";
import { stopPod } from "@/lib/runpod/pods";

// Cron: desliga pod 2 às 20h (BRT) = 23h UTC
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pod2 = process.env.POD2_ID ?? "64u9u09pqlya53";
  await stopPod(pod2);

  return NextResponse.json({ ok: true, stopped: pod2 });
}
