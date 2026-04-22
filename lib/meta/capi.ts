/**
 * Meta Conversions API (CAPI) — Server-side event tracking
 *
 * Eventos rastreados:
 *   PageView          → automático via Pixel browser (layout.tsx)
 *   ViewContent       → /planos page
 *   InitiateCheckout  → clique em "Assinar" no /planos
 *   CompleteRegistration → criação de conta
 *   Lead              → primeira foto gerada
 *   Subscribe         → pagamento PRO confirmado (Stripe + MercadoPago)
 */

import { createHash } from "crypto";

const PIXEL_ID = process.env.META_PIXEL_ID ?? "1771592497338440";
const ACCESS_TOKEN = process.env.META_PIXEL_TOKEN ?? "";
const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

export interface CAPIUserData {
  userId?: string;
  email?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
  fbp?: string;  // _fbp cookie
  fbc?: string;  // _fbc cookie (fb click id)
}

export interface CAPICustomData {
  value?: number;
  currency?: string;
  content_name?: string;
  predicted_ltv?: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function buildUserData(u: CAPIUserData): Record<string, string | string[]> {
  const data: Record<string, string | string[]> = {};
  if (u.userId) data.external_id = u.userId;
  if (u.email) data.em = [sha256(u.email)];
  if (u.phone) data.ph = [sha256(u.phone.replace(/\D/g, ""))];
  if (u.ipAddress) data.client_ip_address = u.ipAddress;
  if (u.userAgent) data.client_user_agent = u.userAgent;
  if (u.fbp) data.fbp = u.fbp;
  if (u.fbc) data.fbc = u.fbc;
  return data;
}

export async function sendCAPIEvent(
  eventName: string,
  user: CAPIUserData,
  custom: CAPICustomData = {},
  sourceUrl = "https://tamowork.com",
  eventId?: string,
): Promise<void> {
  if (!ACCESS_TOKEN) {
    console.warn("[Meta CAPI] META_PIXEL_TOKEN não configurado — evento ignorado");
    return;
  }

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId ?? `${eventName}_${Date.now()}`,
      action_source: "website",
      event_source_url: sourceUrl,
      user_data: buildUserData(user),
      custom_data: Object.keys(custom).length > 0 ? {
        ...custom,
        currency: custom.currency ?? "BRL",
      } : undefined,
    }],
    access_token: ACCESS_TOKEN,
  };

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await res.json() as { events_received?: number; error?: { message: string } };
    if (result.error) {
      console.warn(`[Meta CAPI] ${eventName} erro:`, result.error.message);
    } else {
      console.log(`[Meta CAPI] ${eventName} ✓ received=${result.events_received} user=${user.userId ?? user.email}`);
    }
  } catch (e) {
    console.warn(`[Meta CAPI] ${eventName} falhou:`, (e as Error).message);
  }
}

// ─── Helpers específicos por evento ─────────────────────────────────────────

export const metaEvents = {
  subscribe: (user: CAPIUserData, value: number, currency = "BRL") =>
    sendCAPIEvent("Subscribe", user, { value, currency, predicted_ltv: value * 2 }, "https://tamowork.com/planos"),

  initiateCheckout: (user: CAPIUserData, value: number, currency = "BRL") =>
    sendCAPIEvent("InitiateCheckout", user, { value, currency }, "https://tamowork.com/planos"),

  viewContent: (user: CAPIUserData) =>
    sendCAPIEvent("ViewContent", user, { content_name: "Planos PRO" }, "https://tamowork.com/planos"),

  lead: (user: CAPIUserData) =>
    sendCAPIEvent("Lead", user, {}, "https://tamowork.com"),

  completeRegistration: (user: CAPIUserData) =>
    sendCAPIEvent("CompleteRegistration", user, {}, "https://tamowork.com"),
};
