/* Nett først, cache som reserve. Appen er liten nok til at et nettkall ikke
   merkes, og barnet skal aldri møte gårsdagens oppdragsbank fordi cachen ble
   liggende.

   Bump CACHE hver gang en av FILES endres – ellers ligger den gamle versjonen
   igjen hos alle som har lagt appen på hjemskjermen. */
const CACHE = 'sprell-v9';
/* Adressene må ha samme ?v= som i index.html – det er de forespørslene
   nettleseren faktisk sender, og bare de treffer noe i cachen. */
const FILES = [
  './', './index.html', './styles.css?v=9',
  './js/oppdrag.js?v=9', './js/tale.js?v=9', './js/lyd.js?v=9',
  './js/fyrverkeri.js?v=9', './js/app.js?v=9',
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
  /* Også her må HTTP-cachen forbi. Pages sender max-age=600, og uten no-store
     kan et nettkall svare med ti minutter gammel fil – nok til at ny HTML og
     gammel JS havner i samme økt. */
  const ferskt = new Request(e.request, { cache: 'no-store' });
  e.respondWith(
    fetch(ferskt)
      .then(r => {
        const kopi = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, kopi)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
