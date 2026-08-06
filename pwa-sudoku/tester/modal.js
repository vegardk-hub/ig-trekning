const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
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

  await page.goto(URL);
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });
  await page.evaluate(() => navigator.serviceWorker.ready);

  const synlig = sel => page.$eval(sel, e => !e.hidden);
  // Trykk i det mørke feltet, godt utenfor kortet.
  const trykkUtenfor = async sel => {
    const b = await page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; });
    await page.mouse.click(b.x + b.w / 2, b.y + 12);
  };

  console.log('\n— «Nytt spill» —');
  await page.click('.venstre .verktoyknapp[data-verktoy="nytt"]');
  sjekk('panelet åpner', await synlig('#nytt-panel'));
  await page.click('.modal-kort h2');                       // trykk inne i kortet
  sjekk('trykk inne i kortet lukker ikke', await synlig('#nytt-panel'));
  await trykkUtenfor('#nytt-panel');
  sjekk('trykk utenfor lukker', !(await synlig('#nytt-panel')));

  console.log('\n— «Løst!» —');
  await page.evaluate(() => { document.querySelector('#ferdig').hidden = false; });
  sjekk('dialogen er åpen', await synlig('#ferdig'));
  await page.click('#ferdig .modal-kort h2');
  sjekk('trykk inne i kortet lukker ikke', await synlig('#ferdig'));
  await trykkUtenfor('#ferdig');
  sjekk('trykk utenfor lukker', !(await synlig('#ferdig')));

  console.log('\n— «Lager puslespill» skal ikke kunne lukkes —');
  await page.evaluate(() => { document.querySelector('#jobber').hidden = false; });
  await trykkUtenfor('#jobber');
  sjekk('står fortsatt åpen', await synlig('#jobber'), 'en generering skal ikke avbrytes av et bomtrykk');
  await page.evaluate(() => { document.querySelector('#jobber').hidden = true; });

  console.log('\n— Versjonsmerket —');
  const vist = await page.$eval('#versjon', e => ({ skjult: e.hidden, tekst: e.textContent }));
  const cache = await page.evaluate(() => caches.keys());
  sjekk('merket vises', !vist.skjult);
  sjekk('det stemmer med cachen', 'sudoku-' + vist.tekst === cache[0], `viser "${vist.tekst}", cache er "${cache[0]}"`);

  console.log('\n— Layout tåler den ekstra linja —');
  for (const [w, h, navn] of [[320, 568, 'iPhone SE 1'], [360, 640, 'liten Android'], [390, 844, 'iPhone 14']]) {
    await page.setViewportSize({ width: w, height: h });
    const skroll = await page.evaluate(() => ({
      v: document.documentElement.scrollWidth > window.innerWidth,
      l: document.documentElement.scrollHeight > window.innerHeight + 1
    }));
    sjekk(`${navn} ${w}×${h}: ingen skroll`, !skroll.v && !skroll.l,
          (skroll.v ? 'vannrett ' : '') + (skroll.l ? 'loddrett' : ''));
  }

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: BILDER + '/versjon.png' });

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
