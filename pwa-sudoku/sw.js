/*
 * Service worker: appen skal fungere offline.
 *
 * Strategien er nett først, cache som reserve. Cache først ville servert
 * gammel kode i det uendelige etter en oppdatering, siden filnavnene aldri
 * endrer seg. Er nettet borte, svarer vi fra cachen — og for sidenavigasjon
 * faller vi tilbake til index.html.
 *
 * «Nett først» må bety nettet, ikke nettleserens HTTP-cache. GitHub Pages
 * sender Cache-Control: max-age=600, så uten no-store kunne både oppslagene
 * her og forhåndslagringen under få ti minutter gammel kode — og bake den inn
 * i en fersk cache, der den så ble liggende. Derfor no-store begge steder.
 */

const CACHE = 'sudoku-v8';
const FILER = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/core.js',
  './js/solver.js',
  './js/generator.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILER.map(url =>
        fetch(url, { cache: 'no-store' }).then(svar => svar.ok ? c.put(url, svar) : null)
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
    fetch(req, { cache: 'no-store' })
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
