/*
 * Lager appikonene til Regnbuespillet: hjerte, stjerne og måne i et brett på
 * 2×2, med den fjerde ruta valgt — slik brettet ser ut når barnet har trykket
 * på en rute og skal finne symbolet som mangler.
 *
 * Symbolene hentes fra js/symboler.js og tegnes av Chromium, så ikonet viser
 * nøyaktig de samme tegningene som brettet. Pillow finnes ikke i skyøkta, og
 * playwright trengs allerede av prøvene, så det kommer ingen ny avhengighet.
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node pwa-regnbue/lag_ikon.js
 *
 * Lager du ikonene på nytt, bump CACHE i sw.js — to av dem ligger i FILER.
 */
'use strict';

const path = require('path');
const { chromium } = require('playwright');

const HER = __dirname;

// Samme farger som i styles.css, så ikonet og brettet er av samme stoff.
const FARGER = {
  bg: '#fdf8ef',          // --bg
  flate: '#ffffff',       // --flate
  ramme: '#cfc6b5',       // --ramme
  rammeTykk: '#6b5e4a',   // --ramme-tykk
  valgt: '#ffe9b0',       // --valgt
  valgtKant: '#e8a21c'    // --valgt-kant
};

/*
 * Brettets andel av ikonet. De vanlige fyller det meste av flata. Det
 * maskerbare må holde seg innenfor sirkelen Android klipper til, 80 % av sida,
 * og et kvadrat med disse hjørnene når 0,58 før hjørnet stikker ut av den.
 */
const IKONER = [
  ['icon-192.png', 192, 0.82],
  ['icon-512.png', 512, 0.82],
  ['apple-touch-icon.png', 180, 0.82],
  ['icon-maskable-512.png', 512, 0.58]
];

/** Tegner ikonet i siden, der RegnbueSymboler finnes. Mål i et rom på 100×100. */
function tegnIkon({ andel, px, F }) {
  const S = window.RegnbueSymboler;
  const side = 100 * andel, o = (100 - side) / 2, c = side / 2;
  const r = side * 0.10, ramme = side * 0.032, linje = side * 0.016;
  const luft = c * 0.08, w = c - 2 * luft;
  const symbol = (d, x, y) =>
    S.svg(d).replace('<svg ', `<svg x="${x + luft}" y="${y + luft}" width="${w}" height="${w}" `);

  // Den valgte ruta har brettets runde hjørne nede til høyre, og en kant
  // som holder seg klar av både midtstreken og rammen.
  const ned = o + side, k = side * 0.03;
  const inn = k / 2 + linje / 2, ut = k / 2 + ramme / 2;
  const valgt =
    `<path d="M${o + c} ${o + c} H${ned} V${ned - r} A${r} ${r} 0 0 1 ${ned - r} ${ned} H${o + c} Z" fill="${F.valgt}"/>` +
    `<rect x="${o + c + inn}" y="${o + c + inn}" width="${c - inn - ut}" height="${c - inn - ut}" ` +
    `rx="${r * 0.55}" fill="none" stroke="${F.valgtKant}" stroke-width="${k}"/>`;

  document.body.innerHTML =
    `<svg viewBox="0 0 100 100" width="${px}" height="${px}" style="display:block">` +
    `<rect width="100" height="100" fill="${F.bg}"/>` +
    `<rect x="${o}" y="${o}" width="${side}" height="${side}" rx="${r}" fill="${F.flate}"/>` +
    valgt +
    `<path d="M50 ${o} V${ned} M${o} 50 H${ned}" stroke="${F.ramme}" stroke-width="${linje}"/>` +
    `<rect x="${o}" y="${o}" width="${side}" height="${side}" rx="${r}" fill="none" ` +
    `stroke="${F.rammeTykk}" stroke-width="${ramme}"/>` +
    symbol(1, o, o) + symbol(2, o + c, o) + symbol(3, o, o + c) +
    '</svg>';

  // Hvert symbol sentreres etter sin egen tegning, ikke etter boksen. Månen
  // står til venstre i boksen sin, med hornene mot høyre, og ville ellers
  // sett ut som den hadde sklidd ut av ruta.
  for (const g of document.querySelectorAll('svg.symbol > g')) {
    const b = g.getBBox();
    g.setAttribute('transform', `translate(${50 - b.x - b.width / 2} ${50 - b.y - b.height / 2})`);
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!DOCTYPE html><html><body style="margin:0"></body></html>');
  await page.addScriptTag({ path: path.join(HER, 'js', 'symboler.js') });

  for (const [fil, px, andel] of IKONER) {
    await page.setViewportSize({ width: px, height: px });
    await page.evaluate(tegnIkon, { andel, px, F: FARGER });
    await page.screenshot({ path: path.join(HER, fil), clip: { x: 0, y: 0, width: px, height: px } });
    console.log('skrev', fil);
  }

  await browser.close();
})();
