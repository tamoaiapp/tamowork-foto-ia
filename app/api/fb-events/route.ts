/**
 * POST /api/fb-events
 *
 * Receives browser events and mirrors them to Meta CAPI.
 * This endpoint is intentionally best-effort only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  isMetaCapiEnabled,
  queueMetaEvent,
  sendCAPIEvent,
  type CAPIUserData,
} from "@/lib/meta/capi";

const ALLOWED_EVENTS = ["ViewContent", "InitiateCheckout", "Lead", "CompleteRegistration"] as const;
type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

export async function POST(req: NextRequest) {
  let body: { event: string; eventId?: string; value?: number; currency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!ALLOWED_EVENTS.includes(body.event as AllowedEvent)) {
    return NextResponse.json({ error: "Event not allowed" }, { status: 400 });
  }

  if (!isMetaCapiEnabled()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let userId: string | undefined;
  let email: string | undefined;

  try {
    const supabase = createServerClient();
    const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
    if (token) {
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id;
      email = user?.email ?? undefined;
    }
  } catch {
    // Auth is optional for this tracking endpoint.
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const ua = req.headers.get("user-agent") ?? undefined;
  const fbp = req.headers.get("x-fbp") ?? undefined;
  const fbc = req.headers.get("x-fbc") ?? undefined;

  const user: CAPIUserData = { userId, email, ipAddress: ip, userAgent: ua, fbp, fbc };

  const sourceUrl =
    body.event === "InitiateCheckout" || body.event === "ViewContent"
      ? "https://tamowork.com/planos"
      : "https://tamowork.com";

  const custom = body.value ? { value: body.value, currency: body.currency ?? "BRL" } : {};

  queueMetaEvent(sendCAPIEvent(body.event, user, custom, sourceUrl, body.eventId));
  return NextResponse.json({ ok: true });
}
