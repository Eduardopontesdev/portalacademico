// Service worker único do portal: ao instalar o portal, baixa também todos os módulos
// (lista vinda de modulos.js) para tudo funcionar sem internet.
importScripts("modulos.js");
const CACHE = "portal-v3";
const MODS = self.FF_MODULOS || [];
const CORE = ["./", "./index.html", "./license.js", "./modulos.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];
const ASSETS = CORE.concat(...MODS.map(m =>
  [m.pasta + "/index.html", m.pasta + "/manifest.json", m.pasta + "/icon-192.png", m.pasta + "/icon-512.png"]
    .concat(m.arquivos || []).map(f => "./" + f)
));

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(u => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (pega atualizações quando online); sem internet (ou rede lenta), usa o cache.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith("/acessos.json")) return;          // a lista de acessos é sempre buscada na rede
  e.respondWith(
    Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000))
    ]).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
    )
  );
});
