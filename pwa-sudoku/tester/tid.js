/*
 * tid: klokka teller, stopper når fana legges bort, overlever en omlasting —
 * og det løste brettet havner i statistikken nøyaktig én gang.
 *
 * Den siste er grunnen til at prøven finnes. En teller som føres på nytt ved
 * hver omlasting, eller hver gang man angrer og skriver tallet inn igjen, ser
 * riktig ut i det øyeblikket den skrives og er ubrukelig en uke senere.
 */
const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

const sek = t => {
  const d = t.split(':').map(Number);
  return d.length === 3 ? d[0] * 3600 + d[1] * 60 + d[2] : d[0] * 60 + d[1];
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  const klar = () => page.waitForFunction(
    () => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });
  await klar();

  const tid = () => page.$eval('#meta-tid', e => e.textContent);
  const stat = () => page.evaluate(() => JSON.parse(localStorage.getItem('sudoku-stat-v1') || 'null'));

  console.log('\n— Klokka går —');
  sjekk('starter på 0:00 eller like etter', sek(await tid()) <= 1, await tid());
  await page.waitForTimeout(2100);
  const etter2 = await tid();
  sjekk('har talt etter to sekunder', sek(etter2) >= 2, etter2);

  console.log('\n— Og stopper når fana legges bort —');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const vedSkjul = await tid();
  await page.waitForTimeout(2100);
  sjekk('står stille mens fana er skjult', (await tid()) === vedSkjul, `${vedSkjul} → ${await tid()}`);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1600);
  sjekk('går igjen når man er tilbake', sek(await tid()) > sek(vedSkjul), `${vedSkjul} → ${await tid()}`);

  console.log('\n— Tiden overlever en omlasting —');
  const forOmlasting = sek(await tid());
  await page.reload();
  await klar();
  const etterOmlasting = sek(await tid());
  sjekk('den fortsetter der den slapp', etterOmlasting >= forOmlasting,
        `${forOmlasting}s før, ${etterOmlasting}s etter`);
  sjekk('og begynner ikke forfra', etterOmlasting >= 3, etterOmlasting + 's');

  console.log('\n— Et løst brett føres én gang —');
  // Løses med appens eget hint: trykk «Hint», så «Bruk», til brettet er fullt.
  for (let n = 0; n < 90; n++) {
    if (await page.$eval('#ferdig', e => !e.hidden)) break;
    await page.click('.venstre .verktoyknapp[data-verktoy="hint"]');
    if (await page.$eval('#hint', e => e.hidden)) break;      // løseren ga seg
    await page.click('#hint-bruk');
  }
  sjekk('brettet ble løst', await page.$eval('#ferdig', e => !e.hidden));

  const s1 = await stat();
  sjekk('statistikken har ett løst brett', s1 && s1.middels && s1.middels.lost === 1,
        JSON.stringify(s1 && s1.middels));
  sjekk('med en tid som er ført', s1 && s1.middels.beste > 0, String(s1 && s1.middels.beste));
  sjekk('«Løst!» viser tiden', /^\d+:\d\d$/.test(await page.$eval('#ferdig-tid', e => e.textContent)),
        await page.$eval('#ferdig-tid', e => e.textContent));
  sjekk('det første brettet gir ingen rekordskryt',
        await page.$eval('#ferdig-rekord', e => e.hidden), 'det finnes ikke noe å slå ennå');

  const stoppet = await tid();
  await page.waitForTimeout(1600);
  sjekk('klokka står etter at brettet er løst', (await tid()) === stoppet, `${stoppet} → ${await tid()}`);

  // Kjernen: en omlasting av et løst brett skal ikke telle det på nytt.
  await page.reload();
  await klar();
  const s2 = await stat();
  sjekk('omlasting teller det ikke på nytt', s2.middels.lost === 1, s2.middels.lost + ' løste');

  console.log('\n— Statistikkpanelet —');
  await page.click('.venstre .verktoyknapp[data-verktoy="nytt"]');
  await page.click('#nytt-stat');
  sjekk('panelet åpner fra «Nytt spill»', await page.$eval('#stat-panel', e => !e.hidden));
  const rader = await page.$$eval('#statliste > *', e => e.length);
  sjekk('lista har hode og fire nivåer', rader === 20, rader + ' ruter, ventet 20');
  const middelsrad = await page.$$eval('#statliste .stattall', e => e.slice(3, 6).map(x => x.textContent));
  sjekk('middels står med ett løst brett', middelsrad[0] === '1', middelsrad.join(' / '));

  console.log('\n— «Nullstill» krever to trykk —');
  await page.click('#stat-null');
  sjekk('første trykk spør i stedet for å slette', (await stat()).middels.lost === 1,
        await page.$eval('#stat-null', e => e.textContent));
  await page.click('#stat-null');
  sjekk('andre trykk sletter', (await stat()) === null);
  sjekk('og knappen er avvæpnet igjen',
        (await page.$eval('#stat-null', e => e.textContent)) === 'Nullstill');

  await page.click('#stat-lukk');
  sjekk('«Lukk» lukker', await page.$eval('#stat-panel', e => e.hidden));

  console.log('\n— Plass på skjermen —');
  for (const [w, h, navn] of [[320, 568, 'iPhone SE 1'], [360, 640, 'liten Android'], [390, 844, 'iPhone 14']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('#nytt-stat');
    const k = await page.evaluate(() => {
      const e = document.querySelector('#stat-panel .modal-kort').getBoundingClientRect();
      return { topp: e.top, bunn: e.bottom, vh: window.innerHeight };
    });
    sjekk(`${navn} ${w}×${h}: hele kortet er synlig`, k.topp >= -0.5 && k.bunn <= k.vh + 0.5,
          `${k.topp.toFixed(0)}–${k.bunn.toFixed(0)} av ${k.vh}`);
    await page.click('#stat-x');
  }

  // «Nytt spill» fikk en knapp til. Den skulle dele rad med «Avbryt», ikke
  // legge seg under den og gjøre kortet høyere.
  await page.setViewportSize({ width: 320, height: 568 });
  const nytt = await page.evaluate(() => {
    const e = document.querySelector('#nytt-panel .modal-kort').getBoundingClientRect();
    const s = document.querySelector('#nytt-stat').getBoundingClientRect();
    const a = document.querySelector('#nytt-avbryt').getBoundingClientRect();
    return { topp: e.top, bunn: e.bottom, vh: window.innerHeight, sammeRad: Math.abs(s.top - a.top) < 1 };
  });
  sjekk('«Nytt spill» får fortsatt plass på 320×568',
        nytt.topp >= -0.5 && nytt.bunn <= nytt.vh + 0.5,
        `${nytt.topp.toFixed(0)}–${nytt.bunn.toFixed(0)} av ${nytt.vh}`);
  sjekk('«Statistikk» og «Avbryt» står på samme rad', nytt.sammeRad);
  await page.click('#nytt-avbryt');

  console.log('\n— Liggende: tiden er ikke klippet bort —');
  // .sidetopp har fast høyde og overflow: hidden. En for lav høyde koster ikke
  // layout, den koster den nederste linja — uten at noe annet mål oppdager det.
  await page.setViewportSize({ width: 568, height: 320 });
  const l = await page.evaluate(() => {
    const t = document.querySelector('#side-tid').getBoundingClientRect();
    const boks = document.querySelector('.hoyre .sidetopp').getBoundingClientRect();
    return { tekst: document.querySelector('#side-tid').textContent,
             bunn: t.bottom, grense: boks.bottom, h: t.height };
  });
  sjekk('tiden vises liggende', /\d+:\d\d/.test(l.tekst), l.tekst);
  sjekk('og står helt innenfor sidetoppen', l.bunn <= l.grense + 0.5,
        `linja slutter ${l.bunn.toFixed(0)}, boksen ${l.grense.toFixed(0)}`);
  await page.screenshot({ path: BILDER + '/tid-liggende.png' });

  console.log('\n— Verktøylinja er fortsatt åtte knapper —');
  // Statistikken skulle nås uten en niende knapp: rutenettet er fire brede, og
  // en niende ville gitt tre rader med én foreldreløs.
  const knapper = await page.$$eval('.venstre .verktoyknapp', e => e.length);
  sjekk('åtte knapper', knapper === 8, knapper + ' knapper');

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
