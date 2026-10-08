/*
 * Lager appikonene av ikon.svg.
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node lydloft/lag_ikon.js
 *
 * SVG-en er kilden; PNG-ene er generert og skal ikke redigeres for hånd.
 * Safari på iPhone bruker ikke SVG til hjemskjermen, bare
 * `apple-touch-icon` i PNG. Gløden er et SVG-filter, så PNG-ene tegnes i
 * nettleseren — Pillow finnes ikke i skyøkta, og en egen rasterisering ville
 * mistet gløden.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HER = __dirname;
const STORRELSER = [[180, 'ikon-180.png'], [192, 'ikon-192.png'], [512, 'ikon-512.png'], [32, 'ikon-32.png']];

(async () => {
  const svg = fs.readFileSync(path.join(HER, 'ikon.svg'), 'utf8');
  const nett = await chromium.launch();
  for (const [str, navn] of STORRELSER) {
    const side = await nett.newPage({ viewport: { width: str, height: str }, deviceScaleFactor: 1 });
    await side.setContent('<html><body style="margin:0;background:#0a0618">' +
      svg.replace('<svg ', `<svg width="${str}" height="${str}" `) + '</body></html>');
    await side.screenshot({ path: path.join(HER, navn), clip: { x: 0, y: 0, width: str, height: str } });
    await side.close();
    console.log('skrev ' + navn);
  }
  await nett.close();
})().catch(e => { console.error(e); process.exit(1); });
