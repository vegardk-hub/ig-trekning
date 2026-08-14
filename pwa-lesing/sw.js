/*
 * Service worker: appen skal starte og virke uten nett.
 *
 * Nett først, cache som reserve – filnavnene endrer seg aldri, så cache
 * først ville servert gammel kode i det uendelige etter en oppdatering.
 *
 * Merk at selve talegjenkjenningen krever nett i de fleste nettlesere. Det er
 * greit: uten nett virker fortsatt lesingen med trykk, brikkene, garasjen og
 * opplesingen av enkeltord, og det er hele appen minus mikrofonen.
 */

const CACHE = 'monstergiret-v4';
const FILER = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/tekster.js',
  './js/trucker.js',
  './js/opptak.js',
  './js/tale.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// fetch() i en service worker går gjennom HTTP-cachen, og Pages sender
// max-age=600. Uten no-store her bakes ti minutter gammel kode inn i en
// fersk cache og blir liggende der.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILER.map(f =>
        fetch(f, { cache: 'no-store' })
          .then(svar => svar.ok ? c.put(f, svar) : null)
          .catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
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
