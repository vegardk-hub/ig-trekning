const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

const overlapper = (a, b) => !(a.right <= b.left + 0.5 || a.left >= b.right - 0.5 ||
                               a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const bokser = () => page.evaluate(() => {
    const r = s => { const e = document.querySelector(s);
      if (!e || e.hidden) return null;
      const k = e.getBoundingClientRect();
      if (!k.width && !k.height) return null;      // display: none
      return { left: k.left, right: k.right, top: k.top, bottom: k.bottom, w: k.width, h: k.height }; };
    return { hint: r('#hint'), melding: r('#melding'), brett: r('.brett'),
             forklaring: r('.forklaring'),
             tall: r('.venstre .tall'), verktoyH: r('.hoyre .verktoy'),
             verktoyV: r('.venstre .verktoy'),
             vh: window.innerHeight, vw: window.innerWidth };
  });

  console.log('\n— Liggende: ingen verktøy til venstre —');
  let b = await bokser();
  sjekk('venstre panel har ingen verktøyknapper', b.verktoyV === null);
  sjekk('høyre panel har dem', b.verktoyH !== null);
  const antall = await page.$$eval('.verktoyknapp', els =>
    els.filter(e => e.getBoundingClientRect().width > 0).length);
  sjekk('sju synlige verktøy totalt', antall === 7, antall + ' stk');

  console.log('\n— Feltet er tomt til noe skal vises —');
  /* [hidden] slås av en forfatterstil som setter display. Derfor holder det
     ikke å sjekke attributtet — vi må se at boksen ikke tar plass. */
  for (const [w, h, navn] of [[844, 390, 'liggende'], [390, 844, 'stående']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(120);
    const m = await page.evaluate(() => {
      const r = s => { const e = document.querySelector(s);
        return { hidden: e.hidden, display: getComputedStyle(e).display,
                 h: e.getBoundingClientRect().height }; };
      return { hint: r('#hint'), melding: r('#melding') };
    });
    sjekk(`${navn}: hintboksen tar ingen plass ved oppstart`,
          m.hint.h === 0 && m.hint.display === 'none',
          `display ${m.hint.display}, høyde ${m.hint.h.toFixed(0)}`);
    sjekk(`${navn}: meldingsboksen heller ikke`, m.melding.h === 0);
  }

  console.log('\n— ✕ lukker hintet, i begge formater —');
  for (const [w, h, navn, verktoy] of [[844, 390, 'liggende', '.hoyre'], [390, 844, 'stående', '.venstre']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click(`${verktoy} .verktoyknapp[data-verktoy="hint"]`);
    await page.waitForTimeout(120);
    const åpen = await page.$eval('#hint', e => e.getBoundingClientRect().height > 0);
    sjekk(`${navn}: Hint åpner boksen`, åpen);
    await page.click('#hint-lukk');
    await page.waitForTimeout(120);
    const m = await page.evaluate(() => {
      const e = document.querySelector('#hint');
      return { hidden: e.hidden, display: getComputedStyle(e).display,
               h: e.getBoundingClientRect().height };
    });
    sjekk(`${navn}: ✕ lukker den`, m.h === 0 && m.display === 'none',
          `display ${m.display}, høyde ${m.h.toFixed(0)}`);
  }

  console.log('\n— Meldinger havner i samme felt som hintet —');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.click('.hoyre .verktoyknapp[data-verktoy="hint"]');
  await page.waitForTimeout(120);
  const hintBoks = await page.$eval('#hint', e => { const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width }; });
  await page.click('#hint-lukk');
  await page.click('.hoyre .verktoyknapp[data-verktoy="auto"]');   // Auto → Manuell, gir melding
  await page.waitForTimeout(120);
  const meldBoks = await page.$eval('#melding', e => { const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  sjekk('meldinga vises', meldBoks.h > 0);
  sjekk('den står på samme sted som hintet',
        Math.abs(meldBoks.x - hintBoks.x) < 1 && Math.abs(meldBoks.y - hintBoks.y) < 1 &&
        Math.abs(meldBoks.w - hintBoks.w) < 1,
        `melding ${meldBoks.x.toFixed(0)},${meldBoks.y.toFixed(0)} — hint ${hintBoks.x.toFixed(0)},${hintBoks.y.toFixed(0)}`);
  await page.click('.hoyre .verktoyknapp[data-verktoy="auto"]');
  await page.click('.hoyre .verktoyknapp[data-verktoy="auto"]');   // tilbake til Auto, melding vekk

  console.log('\n— Hintet dekker ikke brettet —');
  for (const [w, h, navn] of [[844, 390, 'iPhone 14'], [932, 430, 'Pro Max'],
                              [667, 375, 'iPhone SE 2'], [568, 320, 'iPhone SE 1']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('.hoyre .verktoyknapp[data-verktoy="hint"]');
    await page.click('#hint-mer');                       // «Vis hvor» — det verste tilfellet
    await page.waitForTimeout(150);
    const m = await bokser();
    const merk = `${navn} ${w}×${h}`;
    sjekk(`${merk}: hintet vises`, m.hint !== null);
    sjekk(`${merk}: det overlapper ikke brettet`, !overlapper(m.hint, m.brett),
          `hint ${m.hint.left.toFixed(0)}–${m.hint.right.toFixed(0)}, brett fra ${m.brett.left.toFixed(0)}`);
    // Hintet ligger i en skrollbar boks, så det er boksen som må stå innenfor.
    sjekk(`${merk}: forklaringsfeltet er innenfor skjermen`,
          m.forklaring.top >= -0.5 && m.forklaring.bottom <= m.vh + 0.5 && m.forklaring.left >= -0.5,
          `y ${m.forklaring.top.toFixed(0)}–${m.forklaring.bottom.toFixed(0)} av ${m.vh}`);
    const maaSkrolle = await page.$eval('.forklaring', e => e.scrollHeight > e.clientHeight + 1);
    if (maaSkrolle) console.log(`         (hintet er høyere enn feltet her og må skrolles)`);
    sjekk(`${merk}: det dekker ikke talltastene`, !overlapper(m.hint, m.tall));
    const knapper = await page.evaluate(() => ['#hint-mer', '#hint-bruk', '#hint-lukk']
      .map(s => document.querySelector(s))
      .filter(e => !e.hidden && e.getBoundingClientRect().height > 0)
      .map(e => { const r = e.getBoundingClientRect();
        const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { id: '#' + e.id, treff: t === e || e.contains(t) }; }));
    sjekk(`${merk}: hintknappene lar seg trykke`, knapper.every(k => k.treff),
          knapper.filter(k => !k.treff).map(k => k.id).join(', ') || 'alle tre');
    await page.click('#hint-lukk');
  }

  console.log('\n— Meldinger havner samme sted —');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.click('.hoyre .verktoyknapp[data-verktoy="auto"]');   // gir en melding
  await page.waitForTimeout(150);
  b = await bokser();
  sjekk('meldinga vises', b.melding !== null);
  sjekk('den overlapper ikke brettet', !overlapper(b.melding, b.brett));
  sjekk('den står under talltastene', b.melding.top >= b.tall.bottom - 0.5,
        `melding fra ${b.melding.top.toFixed(0)}, tall til ${b.tall.bottom.toFixed(0)}`);

  console.log('\n— Talltastene står like høyt på begge sider —');
  const linjer = await page.evaluate(() => {
    const v = document.querySelector('.venstre .tall').getBoundingClientRect();
    const h = document.querySelector('.hoyre .tall').getBoundingClientRect();
    return { vt: v.top, ht: h.top, vh: v.height, hh: h.height };
  });
  sjekk('samme topp', Math.abs(linjer.vt - linjer.ht) < 1,
        `${linjer.vt.toFixed(0)} mot ${linjer.ht.toFixed(0)}`);
  sjekk('samme høyde', Math.abs(linjer.vh - linjer.hh) < 1,
        `${linjer.vh.toFixed(0)} mot ${linjer.hh.toFixed(0)}`);

  console.log('\n— Stående er uendret —');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => {
    const brett = document.querySelector('.brett').getBoundingClientRect();
    const m = document.querySelector('#melding').getBoundingClientRect();
    const tall = document.querySelector('.venstre .tall').getBoundingClientRect();
    const verktoy = document.querySelector('.venstre .verktoy');
    return { under: m.top >= brett.bottom - 0.5, over: m.bottom <= tall.top + 0.5,
             bredde: Math.round(m.width), brettbredde: Math.round(brett.width),
             harVerktoy: verktoy.getBoundingClientRect().width > 0,
             skroll: document.documentElement.scrollHeight > window.innerHeight + 1 };
  });
  sjekk('meldinga står under brettet', st.under);
  sjekk('og over talltastene', st.over);
  sjekk('den er like bred som brettet', st.bredde === st.brettbredde,
        `${st.bredde} mot ${st.brettbredde} px`);
  sjekk('verktøyknappene er tilbake stående', st.harVerktoy);

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  const R = BILDER;
  await page.setViewportSize({ width: 844, height: 390 });
  await page.click('.hoyre .verktoyknapp[data-verktoy="hint"]');
  await page.click('#hint-mer');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${R}/hint-liggende.png` });

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
