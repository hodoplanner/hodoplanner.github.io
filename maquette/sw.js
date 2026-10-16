/* HodoPlanner (maquette) · fonctionne hors connexion : les fichiers de l'app sont gardés en cache,
   les pages sont d'abord demandées au réseau pour toujours avoir la dernière version. */
const CACHE = "hodo-maquette-v3";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "../assets/planner.css", "../assets/icons.js", "../assets/rules.js",
  "../assets/vendor/leaflet/leaflet.js", "../assets/vendor/leaflet/leaflet.css",
  "../images/brand/lapin-carte.svg", "../images/brand/lapin-pattes.svg", "../images/brand/lapin-logo.svg",
  "../images/brand/lapin-icone.svg", "../images/brand/lapin-app-192.png", "../images/brand/lapin-app-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Tuiles de carte : réseau, puis cache (pour revoir une carte déjà affichée sans réseau)
  if (url.hostname.endsWith("basemaps.cartocdn.com")) {
    e.respondWith(caches.open(CACHE + "-tiles").then(async (c) => {
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
      catch (_) { return (await c.match(req)) || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Pages : réseau d'abord ; fichiers : cache d'abord
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match("./index.html")));
  } else {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
