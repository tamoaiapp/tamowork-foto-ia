import webpush from "web-push";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contato@tamowork.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

export async function sendPushToUser(
  subscriptions: { endpoint: string; p256dh: string; auth: string }[],
  title: string,
  body: string,
  url = "/conta"
) {
  ensureVapid();
  if (!vapidConfigured) return;

  const payload = JSON.stringify({ title, body, url });

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch((err: { statusCode?: number; message?: string }) => {
        if (err.statusCode === 410 || err.statusCode === 404) return;
        console.error("[push] erro ao enviar:", err.message);
      })
    )
  );
}
