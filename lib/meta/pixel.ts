"use client";

declare global {
  interface Window {
    fbq?: (
      cmd: string,
      event: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}

function fbqTrack(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params ?? {}, eventId ? { eventID: eventId } : {});
  }
}

export async function trackEvent(
  event: "ViewContent" | "InitiateCheckout" | "Lead" | "CompleteRegistration" | "Purchase",
  params?: { value?: number; currency?: string },
  token?: string,
) {
  const eventId = `${event}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  fbqTrack(event, params, eventId);
  fetch("/api/fb-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ event, eventId, ...params }),
  }).catch(() => {});
}
