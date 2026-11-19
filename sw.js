// Este arquivo só existe para aposentar o service worker antigo deste módulo.
// Agora o portal inteiro é controlado por ../sw.js.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(self.registration.unregister());
});
