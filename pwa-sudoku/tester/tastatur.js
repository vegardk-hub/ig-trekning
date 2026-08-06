const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const verdi = j => page.$eval(`.celle[data-i="${j}"] .tall-stor`, e => e.textContent);
  const merke = (j, d) => page.$eval(`.celle[data-i="${j}"] .merker i:nth-child(${d})`,
                                     e => e.classList.contains('paa'));
  const tomRute = () => page.$$eval('.celle', els =>
    els.findIndex(e => !e.querySelector('.tall-stor').textContent));

  console.log('\n— Liggende: høyre skriver tall, venstre fører blyant —');
  sjekk('«Blyant» er borte i liggende',
        await page.$eval('.hoyre .verktoyknapp[data-verktoy="blyant"]',
                         e => getComputedStyle(e).display) === 'none');
  const synligeVerktoy = await page.$$eval('.hoyre .verktoyknapp',
    els => els.filter(e => e.getBoundingClientRect().width > 0).length);
  sjekk('sju verktøy står igjen', synligeVerktoy === 7, synligeVerktoy + ' stk');
  const venstreVerktoy = await page.$$eval('.venstre .verktoyknapp',
    els => els.filter(e => e.getBoundingClientRect().width > 0).length);
  sjekk('venstre panel har ingen — plassen er forklaringenes', venstreVerktoy === 0,
        venstreVerktoy + ' stk');

  await page.click('.hoyre .verktoyknapp[data-verktoy="auto"]');   // Auto av, ellers er blyanten sperret
  await page.click('.hoyre .verktoyknapp[data-verktoy="auto"]');
  const r = await tomRute();
  await page.click(`.celle[data-i="${r}"]`);
  await page.click('.hoyre .tallknapp[data-d="7"]');
  sjekk('høyre side setter inn tallet', (await verdi(r)) === '7');
  await page.click('.hoyre .tallknapp[data-d="7"]');                 // visk ut igjen
  sjekk('samme knapp visker ut', (await verdi(r)) === '');

  await page.click('.venstre .tallknapp[data-d="4"]');
  sjekk('venstre side fører blyantmerke', await merke(r, 4));
  sjekk('og setter ikke noe tall', (await verdi(r)) === '');
  await page.click('.venstre .tallknapp[data-d="4"]');
  sjekk('samme knapp fjerner merket', !(await merke(r, 4)));

  console.log('\n— Venstre tast ser ut som et blyantmerke —');
  const stil = await page.evaluate(() => {
    const v = getComputedStyle(document.querySelector('.venstre .tallknapp'));
    const h = getComputedStyle(document.querySelector('.hoyre .tallknapp'));
    const rot = getComputedStyle(document.documentElement);
    const les = n => { const d = document.createElement('div'); d.style.color = rot.getPropertyValue(n).trim();
      document.body.appendChild(d); const u = getComputedStyle(d).color; d.remove(); return u; };
    return { v: v.color, h: h.color, vStr: parseFloat(v.fontSize), hStr: parseFloat(h.fontSize),
             merke: les('--merke'), skrevet: les('--skrevet') };
  });
  sjekk('venstre har merkefargen', stil.v === stil.merke, stil.v);
  sjekk('høyre har tallfargen', stil.h === stil.skrevet, stil.h);
  sjekk('venstre siffer er mindre enn høyre', stil.vStr < stil.hStr,
        `${stil.vStr.toFixed(0)} px mot ${stil.hStr.toFixed(0)} px`);

  console.log('\n— Fyllmodus husker hvilken side tallet kom fra —');
  await page.click('.hoyre .verktoyknapp[data-verktoy="fyll"]');
  await page.click('.venstre .tallknapp[data-d="5"]');
  const lyser = await page.$$eval('.tallknapp[data-d="5"]',
    els => els.map(e => e.classList.contains('aktiv')));
  sjekk('bare venstre 5-er lyser', lyser[0] === true && lyser[1] === false, lyser.join(', '));
  const r2 = await tomRute();
  await page.click(`.celle[data-i="${r2}"]`);
  sjekk('trykket ble et blyantmerke', await merke(r2, 5) && (await verdi(r2)) === '');

  await page.click('.hoyre .tallknapp[data-d="5"]');
  const lyser2 = await page.$$eval('.tallknapp[data-d="5"]',
    els => els.map(e => e.classList.contains('aktiv')));
  sjekk('nå lyser bare høyre 5-er', lyser2[0] === false && lyser2[1] === true, lyser2.join(', '));
  await page.click(`.celle[data-i="${r2}"]`);
  sjekk('trykket ble et tall', (await verdi(r2)) === '5');
  await page.click('.hoyre .verktoyknapp[data-verktoy="fyll"]');

  console.log('\n— Teller på tallknappene —');
  const teller = await page.$$eval('.hoyre .tallknapp', els =>
    els.map(e => e.querySelector('.igjen').textContent));
  sjekk('alle ni har en teller', teller.every(t => t !== ''), teller.join(' '));
  const fasit = await page.evaluate(() => {
    const v = Array.from(document.querySelectorAll('.celle'))
                   .map(e => Number(e.querySelector('.tall-stor').textContent) || 0);
    return [1,2,3,4,5,6,7,8,9].map(d => String(9 - v.filter(x => x === d).length));
  });
  sjekk('tallene stemmer med brettet', teller.join(',') === fasit.join(','),
        `viser ${teller.join(' ')}, skal være ${fasit.join(' ')}`);
  const venstreTeller = await page.$eval('.venstre .tallknapp .igjen', e => getComputedStyle(e).display);
  sjekk('blyantsiden har ingen teller', venstreTeller === 'none');

  console.log('\n— Luft mellom tall og kommandoer —');
  for (const [w, h, navn] of [[844, 390, 'liggende'], [390, 844, 'stående']]) {
    await page.setViewportSize({ width: w, height: h });
    const glipe = await page.evaluate(() => {
      // Måles i den sida som faktisk viser verktøy: venstre stående, høyre liggende.
      const side = Array.from(document.querySelectorAll('.side'))
        .find(s => s.querySelector('.verktoy').getBoundingClientRect().height > 0);
      const t = side.querySelector('.tall').getBoundingClientRect();
      const v = side.querySelector('.verktoy').getBoundingClientRect();
      return v.top - t.bottom;
    });
    sjekk(`${navn}: glipa er tydelig`, glipe >= 12, glipe.toFixed(0) + ' px');
    const skroll = await page.evaluate(() => ({
      v: document.documentElement.scrollWidth > window.innerWidth,
      l: document.documentElement.scrollHeight > window.innerHeight + 1
    }));
    sjekk(`${navn}: ingen skroll`, !skroll.v && !skroll.l);
  }

  console.log('\n— Stående er uendret: én tast, «Blyant» styrer —');
  await page.setViewportSize({ width: 390, height: 844 });
  sjekk('«Blyant» er synlig igjen',
        await page.$eval('.venstre .verktoyknapp[data-verktoy="blyant"]',
                         e => getComputedStyle(e).display) !== 'none');
  const r3 = await tomRute();
  await page.click(`.celle[data-i="${r3}"]`);
  await page.click('.venstre .tallknapp[data-d="3"]');
  sjekk('venstre tast skriver tall i stående', (await verdi(r3)) === '3',
        'her skal siden ikke bety noe');
  await page.click('.venstre .tallknapp[data-d="3"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
  await page.click('.venstre .tallknapp[data-d="3"]');
  sjekk('med «Blyant» på blir det merke', await merke(r3, 3));

  for (const [w, h] of [[320, 568], [568, 320], [667, 375]]) {
    await page.setViewportSize({ width: w, height: h });
    const s = await page.evaluate(() => ({
      v: document.documentElement.scrollWidth > window.innerWidth,
      l: document.documentElement.scrollHeight > window.innerHeight + 1
    }));
    sjekk(`${w}×${h}: ingen skroll`, !s.v && !s.l);
  }

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  const R = BILDER;
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${R}/tastatur-liggende.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${R}/tastatur-staaende.png` });

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
