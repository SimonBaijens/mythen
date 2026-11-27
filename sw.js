// Netwerk eerst (zodat een nieuw verhaal meteen zichtbaar is), met de cache als terugval voor offline lezen.
const CACHE = "mythen-v3";
const SCHIL = ["./", "index.html", "styles.css?v=3", "app.js?v=3", "verhaal.css", "manifest.webmanifest", "data/verhalen.json", "data/figuren.json", "data/pantheons.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SCHIL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const kopie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopie)); return r; })
      .catch(() => caches.match(e.request))
  );
});
