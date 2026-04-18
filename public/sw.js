// Service Worker - TamoWork Fotos IA
const CACHE = "tamowork-v4";

function shouldBypassCache(request) {
  if (request.method !== "GET") return true;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return true;

  const url = new URL(request.url);
  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isDocument = request.mode === "navigate" || request.destination === "document";
  const isApi = url.pathname.startsWith("/api/");
  const isNextAsset = url.pathname.startsWith("/_next/");

  return isLocalHost || isDocument || isApi || isNextAsset;
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (shouldBypassCache(e.request)) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (!res || !res.ok) return res;
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener("push", (e) => {
  let data = {
    title: "Sua foto ficou pronta!",
    body: "Toque para ver o resultado.",
    url: "/",
  };
  try {
    data = { ...data, ...e.data.json() };
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-512.png",
      badge: "/icons/badge-96.png",
      tag: "job-done",
      renotify: true,
      vibrate: [200, 100, 200],
      requireInteraction: false,
      data: { url: data.url },
      actions: [
        { action: "open", title: "Ver resultado" },
        { action: "close", title: "Fechar" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  if (e.action === "close") return;

  const url = e.notification.data?.url ?? "/";
  const notifId = e.notification.data?.notif_id;

  if (notifId) {
    fetch("/api/push/opened?id=" + notifId).catch(() => {});
  }

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
