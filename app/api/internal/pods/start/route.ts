import { NextRequest, NextResponse } from "next/server";
import { resumePod } from "@/lib/runpod/pods";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

// Cron: liga pod 2 às 8h (BRT) = 11h UTC
// Também aceita x-internal-secret para uso manual
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const internal = req.headers.get("x-internal-secret") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && internal !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pod = req.nextUrl.searchParams.get("pod");
  const pod1 = process.env.POD1_ID ?? "bplqvtp059e2dc";
  const pod2 = process.env.POD2_ID ?? "64u9u09pqlya53";

  const toStart = pod === "1" ? [pod1] : pod === "2" ? [pod2] : [pod1, pod2];
  await Promise.all(toStart.map(id => resumePod(id).catch(() => {})));

  return NextResponse.json({ ok: true, started: toStart });
}
