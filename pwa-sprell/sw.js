/* Nett først, cache som reserve. Appen er liten nok til at et nettkall ikke
   merkes, og barnet skal aldri møte gårsdagens oppdragsbank fordi cachen ble
   liggende.

   Bump CACHE hver gang en av FILES endres – ellers ligger den gamle versjonen
   igjen hos alle som har lagt appen på hjemskjermen. */
const CACHE = 'sprell-v2';
const FILES = [
  './', './index.html', './styles.css',
  './js/oppdrag.js', './js/tale.js', './js/app.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  /* no-store: fetch() i en service worker går gjennom HTTP-cachen, og Pages
     sender max-age=600. Uten dette bakes ti minutter gammel kode inn i en
     fersk cache og blir liggende der. */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILES.map(f =>
        fetch(f, { cache: 'no-store' }).then(r => c.put(f, r))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const kopi = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, kopi)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
