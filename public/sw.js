// Service Worker — TamoWork Fotos IA
const CACHE = "tamowork-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Notificação disparada pelo app (postMessage)
self.addEventListener("message", (e) => {
  if (e.data?.type === "NOTIFY_DONE") {
    const title = e.data.title ?? "Sua foto ficou pronta! ✨";
    const body  = e.data.body  ?? "Toque para ver o resultado no TamoWork.";
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "job-done",
      renotify: true,
      data: { url: "/conta" },
    });
  }
});

// Clique na notificação abre o app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/conta")) return client.focus();
      }
      return clients.openWindow("/conta");
    })
  );
});
