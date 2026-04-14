import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// POST /api/internal/push
// Body: { userId, title, body, url? }
// OU:   { userIds: string[], title, body, url? }  — batch
export async function POST(req: NextRequest) {
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";
  if (!INTERNAL_SECRET || req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    (process.env.VAPID_SUBJECT ?? "mailto:contato@tamowork.com").trim(),
    (process.env.VAPID_PUBLIC_KEY ?? "").trim(),
    (process.env.VAPID_PRIVATE_KEY ?? "").trim(),
  );

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { userId, userIds, title, body, url, notif_id } = await req.json();
  const ids: string[] = userIds ?? (userId ? [userId] : []);

  if (!ids.length || !title || !body) {
    return NextResponse.json({ error: "userId/userIds, title e body obrigatórios" }, { status: 400 });
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", ids);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "nenhuma subscription encontrada" });
  }

  const payload = JSON.stringify({ title, body, url: url ?? "/", notif_id });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(async (err) => {
        // Subscription expirada — remove do banco
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return NextResponse.json({ ok: true, sent, failed });
}
