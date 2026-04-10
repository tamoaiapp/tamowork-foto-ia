// Service Worker — TamoWork Fotos IA
const CACHE = "tamowork-v3";

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

// Push notification
self.addEventListener("push", (e) => {
  let data = {
    title: "Sua foto ficou pronta! ✨",
    body: "Toque para ver o resultado.",
    url: "/",
  };
  try {
    data = { ...data, ...e.data.json() };
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      // Ícone da notificação — aparece no drawer de notificações
      icon: "/icons/icon-512.png",
      // Badge — ícone pequeno na barra de status do Android
      badge: "/icons/badge-96.svg",
      tag: "job-done",
      renotify: true,
      // Vibração: padrão nativo Android
      vibrate: [200, 100, 200],
      // Mantém a notificação até o usuário interagir
      requireInteraction: false,
      data: { url: data.url },
      // Ações rápidas na notificação
      actions: [
        { action: "open", title: "Ver resultado" },
        { action: "close", title: "Fechar" },
      ],
    })
  );
});

// Clique na notificação — abre o app na página certa
self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  if (e.action === "close") return;

  const url = e.notification.data?.url ?? "/";

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        // Se o app já está aberto, foca nele
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Senão, abre uma nova janela
        return clients.openWindow(url);
      })
  );
});
