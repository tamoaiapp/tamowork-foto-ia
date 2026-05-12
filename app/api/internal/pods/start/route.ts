import { NextRequest, NextResponse } from "next/server";
import { resumePod, FOTO_POD_IDS } from "@/lib/runpod/pods";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

// Liga pods de foto (uso manual via x-internal-secret ou cron com Bearer CRON_SECRET)
// Query opcional: ?pod=<id> liga só esse; sem query liga todos os FOTO_POD_IDS
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const internal = req.headers.get("x-internal-secret") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && (!INTERNAL_SECRET || internal !== INTERNAL_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const specific = req.nextUrl.searchParams.get("pod");
  const toStart = specific ? [specific] : FOTO_POD_IDS;
  await Promise.all(toStart.map(id => resumePod(id).catch(() => {})));

  return NextResponse.json({ ok: true, started: toStart });
}
