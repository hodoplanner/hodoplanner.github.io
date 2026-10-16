/* HodoPlanner (app) · fonctionne hors connexion : les fichiers de l'app sont gardés en cache,
   les pages sont d'abord demandées au réseau pour toujours avoir la dernière version. */
/* Pour publier une mise à jour de l'app :
   1. change VERSION ci-dessous,
   2. mets le même numéro et la liste des nouveautés dans version.json.
   À la prochaine ouverture, chaque voyageur verra « Nouvelle version disponible ». */
const VERSION = "2026.10.18-16";
const CACHE = "hodo-app-" + VERSION;
const FILES = [
  "./", "./index.html", "./manifest.webmanifest", "./version.json", "./app.css", "./config.js", "./api.js", "./app.js", "./update.js",
  "../assets/planner.css", "../assets/icons.js", "../assets/pictos.js", "../assets/rules.js",
  "../assets/vendor/leaflet/leaflet.js", "../assets/vendor/leaflet/leaflet.css", "../assets/vendor/supabase/supabase.js",
  "../images/brand/lapin-carte.svg", "../images/brand/lapin-pattes.svg", "../images/brand/lapin-logo.svg",
  "../images/brand/lapin-icone.svg", "../images/brand/lapin-app-192.png", "../images/brand/lapin-app-512.png",
];

self.addEventListener("install", (e) => {
  // Pas de skipWaiting ici : la nouvelle version attend que la personne touche « Mettre à jour ».
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "VERSION" && e.ports[0]) e.ports[0].postMessage(VERSION); // l'app demande quelle version tourne
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("hodo-app-") && k !== CACHE && k !== "hodo-app-tiles").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Tuiles de carte : réseau, puis cache (pour revoir une carte déjà affichée sans réseau)
  if (url.hostname.endsWith("basemaps.cartocdn.com")) {
    e.respondWith(caches.open("hodo-app-tiles").then(async (c) => {
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
      catch (_) { return (await c.match(req)) || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return; // Supabase et le reste : jamais en cache
  // Pages et version.json : réseau d'abord ; autres fichiers : cache d'abord
  if (req.mode === "navigate" || url.pathname.endsWith("/version.json")) {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; }).catch(async () => (await caches.match(req)) || caches.match("./index.html")));
  } else {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
