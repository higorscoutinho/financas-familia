/* =========================================================
   sw.js — Service Worker
   Permite instalar o app (PWA) e funcionar offline com cache
   dos arquivos estáticos. Os dados financeiros continuam
   sendo sincronizados com o Google Sheets quando há internet.
   ========================================================= */

const CACHE_NAME = "financas-familia-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/utils.js",
  "./js/charts.js",
  "./js/api.js",
  "./js/store.js",
  "./js/actions.js",
  "./js/modals.js",
  "./js/pages.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Nunca cacheia chamadas ao Google Apps Script (sempre precisam ser "ao vivo")
  if (event.request.url.includes("script.google.com")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
            return res;
          })
          .catch(() => caches.match("./index.html"))
      );
    })
  );
});
