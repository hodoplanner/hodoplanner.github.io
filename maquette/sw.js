// L'ancienne démo n'existe plus : ce service worker efface ses fichiers, se retire et ouvre la vraie app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("hodo-maquette-")) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(new URL("../app/", self.registration.scope).href);
  })());
});
