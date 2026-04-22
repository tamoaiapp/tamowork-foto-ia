/**
 * Meta Conversions API (CAPI) - server-side event tracking
 *
 * Events tracked:
 *   PageView              -> browser Pixel in layout.tsx
 *   ViewContent           -> /planos
 *   InitiateCheckout      -> checkout click on /planos
 *   CompleteRegistration  -> account creation
 *   Lead                  -> first generated photo
 *   Subscribe             -> confirmed PRO payment
 *
 * Important:
 * Meta is best-effort only. It must never block billing, affiliates,
 * onboarding, or any core product flow.
 */

import { createHash } from "crypto";

const PIXEL_ID = process.env.META_PIXEL_ID ?? "1771592497338440";
const ACCESS_TOKEN = process.env.META_PIXEL_TOKEN ?? "";
const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
const META_DISABLE_MS = 60 * 60 * 1000;

let metaDisabledUntil = 0;

export interface CAPIUserData {
  userId?: string;
  email?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
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

function buildUserData(user: CAPIUserData): Record<string, string | string[]> {
  const data: Record<string, string | string[]> = {};
  if (user.userId) data.external_id = user.userId;
  if (user.email) data.em = [sha256(user.email)];
  if (user.phone) data.ph = [sha256(user.phone.replace(/\D/g, ""))];
  if (user.ipAddress) data.client_ip_address = user.ipAddress;
  if (user.userAgent) data.client_user_agent = user.userAgent;
  if (user.fbp) data.fbp = user.fbp;
  if (user.fbc) data.fbc = user.fbc;
  return data;
}

function isMetaAuthError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("error validating access token") ||
    normalized.includes("session has expired") ||
    normalized.includes("invalid oauth access token") ||
    (normalized.includes("access token") && normalized.includes("expired"))
  );
}

function disableMetaTemporarily(reason: string) {
  metaDisabledUntil = Date.now() + META_DISABLE_MS;
  console.warn(`[Meta CAPI] disabled temporarily for ${Math.round(META_DISABLE_MS / 60000)} min: ${reason}`);
}

export function isMetaCapiEnabled() {
  if (!ACCESS_TOKEN) return false;
  if (Date.now() < metaDisabledUntil) return false;
  if (metaDisabledUntil && Date.now() >= metaDisabledUntil) {
    metaDisabledUntil = 0;
  }
  return true;
}

export function queueMetaEvent(task: Promise<void>) {
  void task.catch(() => {});
}

export async function sendCAPIEvent(
  eventName: string,
  user: CAPIUserData,
  custom: CAPICustomData = {},
  sourceUrl = "https://tamowork.com",
  eventId?: string,
): Promise<void> {
  if (!isMetaCapiEnabled()) {
    return;
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId ?? `${eventName}_${Date.now()}`,
        action_source: "website",
        event_source_url: sourceUrl,
        user_data: buildUserData(user),
        custom_data:
          Object.keys(custom).length > 0
            ? {
                ...custom,
                currency: custom.currency ?? "BRL",
              }
            : undefined,
      },
    ],
    access_token: ACCESS_TOKEN,
  };

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    const result = (await res.json()) as {
      events_received?: number;
      error?: { message: string };
    };

    if (result.error) {
      if (isMetaAuthError(result.error.message)) {
        disableMetaTemporarily(result.error.message);
        return;
      }
      console.warn(`[Meta CAPI] ${eventName} error:`, result.error.message);
      return;
    }

    if (!res.ok) {
      const message = `HTTP ${res.status}`;
      if (isMetaAuthError(message)) {
        disableMetaTemporarily(message);
        return;
      }
      console.warn(`[Meta CAPI] ${eventName} error:`, message);
      return;
    }

    console.log(`[Meta CAPI] ${eventName} ok received=${result.events_received} user=${user.userId ?? user.email}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMetaAuthError(message)) {
      disableMetaTemporarily(message);
      return;
    }
    console.warn(`[Meta CAPI] ${eventName} failed:`, message);
  }
}

export const metaEvents = {
  subscribe: (user: CAPIUserData, value: number, currency = "BRL") =>
    sendCAPIEvent("Subscribe", user, { value, currency, predicted_ltv: value * 2 }, "https://tamowork.com/planos"),

  initiateCheckout: (user: CAPIUserData, value: number, currency = "BRL") =>
    sendCAPIEvent("InitiateCheckout", user, { value, currency }, "https://tamowork.com/planos"),

  viewContent: (user: CAPIUserData) =>
    sendCAPIEvent("ViewContent", user, { content_name: "Planos PRO" }, "https://tamowork.com/planos"),

  lead: (user: CAPIUserData) => sendCAPIEvent("Lead", user, {}, "https://tamowork.com"),

  completeRegistration: (user: CAPIUserData) =>
    sendCAPIEvent("CompleteRegistration", user, {}, "https://tamowork.com"),
};
