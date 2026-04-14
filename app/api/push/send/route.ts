import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  webpush.setVapidDetails(
    (process.env.VAPID_SUBJECT ?? "mailto:contato@tamowork.com").trim(),
    (process.env.VAPID_PUBLIC_KEY ?? "").trim(),
    (process.env.VAPID_PRIVATE_KEY ?? "").trim(),
  );
  const supabase = createServerClient();
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { title, body, url } = await req.json();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) return NextResponse.json({ ok: false, message: "no subscriptions" });

  const payload = JSON.stringify({ title, body, url: url ?? "/" });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );

  const sent = results.filter(r => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent });
}
