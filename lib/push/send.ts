import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToUser(
  subscriptions: { endpoint: string; p256dh: string; auth: string }[],
  title: string,
  body: string,
  url = "/conta"
) {
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
