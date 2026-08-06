/*
 * Service worker: spillet skal virke offline, også i bilen og på hytta.
 *
 * Nett først, cache som reserve – filnavnene endrer seg aldri, så cache
 * først ville servert gammel kode i det uendelige etter en oppdatering.
 */

const CACHE = 'fargeflasker-v2';
const FILER = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/spill.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(navn => Promise.all(navn.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then(svar => {
        if (svar.ok) {
          const kopi = svar.clone();
          caches.open(CACHE).then(c => c.put(req, kopi));
        }
        return svar;
      })
      .catch(() => caches.match(req).then(traff => {
        if (traff) return traff;
        return req.mode === 'navigate' ? caches.match('./index.html') : Response.error();
      }))
  );
});
