const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const konsollfeil = [];
  p.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${process.env.PORT || 8123}/index.html`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  // Velg en rute med et tall i, så vi også får testet at «like tall» overlever.
  const medTall = await p.$$eval('.celle', els =>
    els.findIndex(e => e.querySelector('.tall-stor').textContent));
  await p.click(`.celle[data-i="${medTall}"]`);

  const k = await p.$$eval('.celle', els => ({
    naboer: els.filter(e => e.classList.contains('naboer')).length,
    valgt: els.filter(e => e.classList.contains('valgt')).length,
    likt: els.filter(e => e.classList.contains('likt')).length
  }));
  sjekk('ingen rute får «naboer» lenger', k.naboer === 0, k.naboer + ' ruter');
  sjekk('den valgte ruta er fortsatt markert', k.valgt === 1);
  sjekk('like tall lyser fortsatt opp', k.likt > 0, k.likt + ' ruter');

  // Hver farget rute skal ha en grunn: valgt, samme tall, eller samme merke.
  // Er det flater uten en av de klassene, har en vask sneket seg inn igjen.
  await p.waitForTimeout(250);                 // .celle toner bakgrunnen over .12s
  const uforklarte = await p.$$eval('.celle', els => els.filter(e => {
    const gjennomsiktig = getComputedStyle(e).backgroundColor === 'rgba(0, 0, 0, 0)';
    const merket = e.classList.contains('valgt') || e.classList.contains('likt') ||
                   e.className.includes('hint-');
    return !gjennomsiktig && !merket;
  }).length);
  sjekk('ingen rute er farget uten grunn', uforklarte === 0, uforklarte + ' ruter');

  sjekk('--naboer finnes ikke lenger i noe tema', await p.evaluate(async () => {
    const css = await (await fetch('styles.css', { cache: 'no-store' })).text();
    return !css.includes('--naboer');
  }));

  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));
  await p.screenshot({ path: BILDER + '/uten-naboer.png' });
  await b.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
