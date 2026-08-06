const { chromium } = require('playwright');
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

const LIGGENDE = [[568, 320, 'iPhone SE 1'], [667, 375, 'iPhone SE 2'],
                  [844, 390, 'iPhone 14'], [932, 430, 'Pro Max'], [915, 412, 'Pixel']];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  console.log('\n— Liggende er frosset —');
  for (const [w, h, navn] of LIGGENDE) {
    await page.setViewportSize({ width: w, height: h });
    const m = await page.evaluate(() => {
      const d = document.documentElement;
      return {
        overflow: getComputedStyle(d).overflowY,
        kroppFast: getComputedStyle(document.body).position,
        sprett: getComputedStyle(document.body).overscrollBehaviorY,
        kanSkrolle: d.scrollHeight > d.clientHeight
      };
    });
    sjekk(`${navn} ${w}×${h}: dokumentet er låst`,
          m.overflow === 'hidden' && m.kroppFast === 'fixed' && !m.kanSkrolle,
          `overflow ${m.overflow}, body ${m.kroppFast}`);
    sjekk(`${navn} ${w}×${h}: ingen sprett`, m.sprett === 'none', m.sprett);
  }

  console.log('\n— Et drag flytter ingenting —');
  await page.setViewportSize({ width: 844, height: 390 });
  const før = await page.evaluate(() => document.querySelector('.brett').getBoundingClientRect().top);
  await page.mouse.move(422, 200);
  await page.mouse.down();
  for (const y of [180, 140, 100, 60]) await page.mouse.move(422, y);
  await page.mouse.up();
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  const etter = await page.evaluate(() => ({
    brett: document.querySelector('.brett').getBoundingClientRect().top,
    skrollY: window.scrollY
  }));
  sjekk('brettet står der det sto', Math.abs(etter.brett - før) < 1,
        `${før.toFixed(0)} → ${etter.brett.toFixed(0)} px`);
  sjekk('sida har ikke skrollet', etter.skrollY === 0, 'scrollY ' + etter.skrollY);

  console.log('\n— Hele brettet er innenfor skjermen —');
  for (const [w, h, navn] of LIGGENDE) {
    await page.setViewportSize({ width: w, height: h });
    const b = await page.evaluate(() => {
      const r = document.querySelector('.brett').getBoundingClientRect();
      return { topp: r.top, bunn: r.bottom, venstre: r.left, høyre: r.right,
               vh: window.innerHeight, vw: window.innerWidth };
    });
    sjekk(`${navn} ${w}×${h}: brettet er helt synlig`,
          b.topp >= -0.5 && b.bunn <= b.vh + 0.5 && b.venstre >= -0.5 && b.høyre <= b.vw + 0.5,
          `${b.topp.toFixed(0)}–${b.bunn.toFixed(0)} av ${b.vh} px høyde`);
  }

  console.log('\n— Trygt område: brettet gir plass til hakket —');
  // env() lar seg ikke emulere, men brettformelen går via --trygg-loddrett,
  // så vi setter den selv og ser at brettet krymper tilsvarende.
  await page.setViewportSize({ width: 844, height: 390 });
  const uten = await page.evaluate(() => document.querySelector('.brett').getBoundingClientRect().height);
  const med = await page.evaluate(() => {
    document.documentElement.style.setProperty('--trygg-loddrett', '40px');
    return document.querySelector('.brett').getBoundingClientRect().height;
  });
  sjekk('brettet krymper med det trygge området', Math.abs((uten - med) - 40) < 1.5,
        `${uten.toFixed(0)} → ${med.toFixed(0)} px, ventet 40 px mindre`);
  const innenfor = await page.evaluate(() => {
    const r = document.querySelector('.brett').getBoundingClientRect();
    return r.bottom <= window.innerHeight + 0.5;
  });
  sjekk('og holder seg innenfor skjermen', innenfor);
  await page.evaluate(() => document.documentElement.style.removeProperty('--trygg-loddrett'));

  console.log('\n— Like mye luft over og under brettet —');
  await page.setViewportSize({ width: 844, height: 390 });
  for (const inset of ['0px', '21px', '34px']) {
    await page.evaluate(v => document.documentElement.style.setProperty('--trygg-vertikal', v), inset);
    await page.waitForTimeout(80);
    const m = await page.evaluate(() => {
      const r = document.querySelector('.brett').getBoundingClientRect();
      return { over: r.top, under: window.innerHeight - r.bottom, h: r.height };
    });
    sjekk(`hjemindikator ${inset}: lik klaring over og under`,
          Math.abs(m.over - m.under) < 1.5,
          `${m.over.toFixed(0)} px over, ${m.under.toFixed(0)} px under, brett ${m.h.toFixed(0)}`);
    sjekk(`hjemindikator ${inset}: brettet holder seg unna stripa`,
          m.under >= parseFloat(inset) - 0.5,
          `${m.under.toFixed(0)} px under, stripa er ${inset}`);
  }
  await page.evaluate(() => document.documentElement.style.removeProperty('--trygg-vertikal'));

  console.log('\n— «Nytt spill» er nåbar liggende —');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.click('.hoyre .verktoyknapp[data-verktoy="nytt"]');
  const kort = await page.evaluate(() => {
    const k = document.querySelector('#nytt-panel .modal-kort').getBoundingClientRect();
    const a = document.querySelector('#nytt-avbryt').getBoundingClientRect();
    return { h: k.height, topp: k.top, bunn: k.bottom, vh: window.innerHeight,
             avbrytSynlig: a.top >= 0 && a.bottom <= window.innerHeight };
  });
  sjekk('kortet får plass', kort.h <= kort.vh, `${kort.h.toFixed(0)} px i ${kort.vh}`);
  sjekk('toppen er ikke klippet', kort.topp >= -0.5, kort.topp.toFixed(0) + ' px');
  sjekk('«Avbryt» er innenfor skjermen', kort.avbrytSynlig);
  await page.click('#nytt-avbryt');
  sjekk('og den lar seg trykke', await page.$eval('#nytt-panel', e => e.hidden));

  console.log('\n— Stående er låst når det ikke er noe å skrolle til —');
  /*
   * Feilen var ikke sprett, men en ekte overflyt: body polstres med det trygge
   * området, og .app sto på fulle 100dvh inne i den. Differansen ble skroll —
   * noen millimeter å dra i på et brett der ingenting lå under kanten.
   * env() lar seg ikke emulere, så begge går via variabler vi kan sette.
   */
  const tilstand = () => page.evaluate(() => ({
    overflow: getComputedStyle(document.documentElement).overflowY,
    kroppFast: getComputedStyle(document.body).position,
    sprett: getComputedStyle(document.body).overscrollBehaviorY,
    skroll: document.documentElement.scrollHeight - window.innerHeight
  }));
  const settTrygt = (t, b) => page.evaluate(([x, y]) => {
    const d = document.documentElement.style;
    if (x === null) { d.removeProperty('--trygg-topp'); d.removeProperty('--trygg-bunn'); }
    else { d.setProperty('--trygg-topp', x); d.setProperty('--trygg-bunn', y); }
  }, [t, b]);

  for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const [t, b] of [[null, null], ['59px', '34px'], ['47px', '21px']]) {
      await settTrygt(t, b);
      await page.waitForTimeout(60);
      const st = await tilstand();
      const merk = `${w}×${h} hakk ${t || '0'}/${b || '0'}`;
      sjekk(`${merk}: ingenting å skrolle`, st.skroll <= 0, st.skroll + ' px');
      sjekk(`${merk}: dokumentet er låst`,
            st.overflow === 'hidden' && st.kroppFast === 'fixed',
            `overflow ${st.overflow}, body ${st.kroppFast}`);
      sjekk(`${merk}: og spretter ikke`, st.sprett === 'none', st.sprett);
    }
    await settTrygt(null, null);
  }

  console.log('\n— … men slipper opp når et hint eller en melding står framme —');
  /* Låser man uansett, blir hintet klippet vekk i stedet: under brettet er det
     plass til tastaturet og lite annet, og hintboksen alene er 143 px. */
  await page.setViewportSize({ width: 320, height: 568 });
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // gir en melding
  const medMelding = await tilstand();
  sjekk('meldinga låser opp sida',
        medMelding.overflow !== 'hidden' && medMelding.kroppFast !== 'fixed',
        `overflow ${medMelding.overflow}, body ${medMelding.kroppFast}`);
  const nåbar = await page.evaluate(() => {
    const m = document.querySelector('#melding');
    window.scrollTo(0, document.documentElement.scrollHeight);
    const r = m.getBoundingClientRect();
    return r.top >= -1 && r.bottom <= window.innerHeight + 1;
  });
  sjekk('meldinga kan skrolles fram', nåbar);

  await page.click('.venstre .verktoyknapp[data-verktoy="hint"]');
  const bruk = await page.evaluate(() => {
    const k = document.querySelector('#hint-bruk');
    k.scrollIntoView({ block: 'nearest' });
    const r = k.getBoundingClientRect();
    return r.top >= -1 && r.bottom <= window.innerHeight + 1;
  });
  sjekk('«Bruk» i hintet er nåbar', bruk);
  await page.click('#hint-lukk');
  await page.evaluate(() => window.scrollTo(0, 0));
  const igjenLast = await tilstand();
  sjekk('sida låses igjen når hintet lukkes',
        igjenLast.overflow === 'hidden' && igjenLast.kroppFast === 'fixed',
        `overflow ${igjenLast.overflow}, body ${igjenLast.kroppFast}`);

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));
  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
