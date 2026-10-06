// Push for the team schedule, imported by the service worker: shows
// what the server sends, and opens the page it names on a tap.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Norless", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).pathname === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});

// Slides from files: offline, a page comes from what the device kept
// for offline (src/client/app/offline-store.ts), at the 4K size it kept, whatever size
// was asked for.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith("/api/slide-pages/")) return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches
        .match(url.pathname.replace(/\/\d+$/, "/3840"), {
          cacheName: "norless-offline",
        })
        .then((kept) => kept || Response.error()),
    ),
  );
});
