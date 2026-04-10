import webpush from "web-push";
import { createServerClient } from "@/lib/supabase/server";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(
    (process.env.VAPID_SUBJECT ?? "mailto:contato@tamowork.com").trim(),
    process.env.VAPID_PUBLIC_KEY.trim(),
    process.env.VAPID_PRIVATE_KEY.trim(),
  );
  vapidConfigured = true;
}

// Envia push para subscriptions já carregadas
export async function sendPushToSubscriptions(
  subscriptions: { endpoint: string; p256dh: string; auth: string }[],
  title: string,
  body: string,
  url = "/"
) {
  ensureVapid();
  if (!vapidConfigured || subscriptions.length === 0) return;

  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch((err: { statusCode?: number; message?: string }) => {
        if (err.statusCode === 410 || err.statusCode === 404) return; // subscription expirada
        console.error("[push] erro:", err.message);
      })
    )
  );
}

// Envia push buscando subscriptions do banco pelo userId
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url = "/"
) {
  try {
    const supabase = createServerClient();
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) return;
    await sendPushToSubscriptions(subs, title, body, url);
  } catch {
    // Push nunca quebra o fluxo principal
  }
}
