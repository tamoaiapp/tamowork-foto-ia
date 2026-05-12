import { NextRequest, NextResponse } from "next/server";
import { stopPod, FOTO_POD_IDS } from "@/lib/runpod/pods";

// Desliga pod especifico via ?pod=<id> ou todos FOTO_POD_IDS sem query
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const internal = req.headers.get("x-internal-secret") ?? "";
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && (!INTERNAL_SECRET || internal !== INTERNAL_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const specific = req.nextUrl.searchParams.get("pod");
  const toStop = specific ? [specific] : FOTO_POD_IDS;
  await Promise.all(toStop.map(id => stopPod(id).catch(() => {})));

  return NextResponse.json({ ok: true, stopped: toStop });
}
