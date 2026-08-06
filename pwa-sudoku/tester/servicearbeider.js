const { chromium } = require('playwright');
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));

  console.log('\n— Service worker installerer —');
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const aktiv = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return !!r.active;
  });
  sjekk('service worker er aktiv', aktiv);

  const cachet = await page.evaluate(async () => {
    const navn = await caches.keys();
    const c = await caches.open(navn[0]);
    const n = await c.keys();
    return { navn, filer: n.map(r => new URL(r.url).pathname.replace(/.*\//, '')).sort() };
  });
  // Fasiten hentes fra sw.js selv, så testen ikke kan bli hengende igjen på et
  // gammelt versjonsnummer slik den gjorde.
  const ventet = await page.evaluate(async () =>
    ((await (await fetch('sw.js', { cache: 'no-store' })).text()).match(/const CACHE = '([^']+)'/) || [])[1]);

  // Antallet leses også fra sw.js, så en ny fil i FILER ikke gir falsk alarm.
  const ventetAntall = await page.evaluate(async () => {
    const kode = await (await fetch('sw.js', { cache: 'no-store' })).text();
    return (kode.match(/const FILER = \[([\s\S]*?)\]/)[1].match(/'/g).length) / 2;
  });

  sjekk('bare én cache, med navnet fra sw.js', cachet.navn.length === 1 && cachet.navn[0] === ventet,
        `har "${cachet.navn.join(', ')}", sw.js sier "${ventet}"`);
  sjekk('alle filene i FILER er forhåndslagret', cachet.filer.length === ventetAntall,
        cachet.filer.length + ': ' + cachet.filer.join(' '));

  console.log('\n— Forhåndslagret kode er den ferske —');
  const harRyddBoks = await page.evaluate(async () => {
    const c = await caches.open((await caches.keys())[0]);
    const svar = await c.match('./js/app.js');
    return svar ? (await svar.text()).includes('ryddNaboer') : null;
  });
  sjekk('app.js i cachen inneholder ryddNaboer', harRyddBoks === true, String(harRyddBoks));

  console.log('\n— Offline —');
  await ctx.setOffline(true);
  await page.reload();
  const lastet = await page.waitForFunction(
    () => document.querySelectorAll('.celle').length === 81, { timeout: 20000 }
  ).then(() => true).catch(() => false);
  sjekk('appen laster uten nett', lastet);
  if (lastet) {
    const spillbar = await page.evaluate(() => document.querySelectorAll('.venstre .tallknapp').length === 9);
    sjekk('tastaturet er der', spillbar);
  }
  await ctx.setOffline(false);

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
