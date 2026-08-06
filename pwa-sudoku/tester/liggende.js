const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

const SKJERMER = [
  [568, 320, 'iPhone SE 1'],
  [667, 375, 'iPhone SE 2'],
  [844, 390, 'iPhone 14'],
  [932, 430, 'Pro Max'],
  [915, 412, 'Pixel']
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const boks = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, synlig: r.width > 0 && r.height > 0 }; });

  console.log('\n— Begge sider er der, og de er like —');
  const sider = await page.$$eval('.side', els => els.map(e => ({
    tall: e.querySelectorAll('.tallknapp').length,
    verktoy: e.querySelectorAll('.verktoyknapp').length,
    synlig: e.getBoundingClientRect().width > 0
  })));
  sjekk('to sidepaneler', sider.length === 2);
  sjekk('begge synlige i liggende', sider.every(s => s.synlig));
  sjekk('ni tall på hver side', sider.every(s => s.tall === 9), sider.map(s => s.tall).join(' og '));
  sjekk('åtte verktøy i DOM-en på hver side', sider.every(s => s.verktoy === 8),
        sider.map(s => s.verktoy).join(' og '));
  const synlige = await page.$$eval('.verktoyknapp',
    els => els.filter(e => e.getBoundingClientRect().width > 0).length);
  sjekk('men bare høyre sett er synlig liggende', synlige === 7, synlige + ' synlige');

  const v = await boks('.venstre'), h = await boks('.hoyre'), b = await boks('.brett');
  sjekk('venstre panel står til venstre for brettet', v.x + v.w <= b.x + 1);
  sjekk('høyre panel står til høyre for brettet', h.x >= b.x + b.w - 1);
  sjekk('sidene er like brede', Math.abs(v.w - h.w) < 1, `${v.w.toFixed(0)} og ${h.w.toFixed(0)} px`);

  console.log('\n— Tittel til venstre, teller til høyre —');
  sjekk('den stående toppen er skjult', !(await boks('.topp')).synlig);
  const st = await boks('.venstre .sidetopp');
  sjekk('appnavnet står oppe til venstre', st.synlig && st.x < b.x);
  const sh = await boks('.hoyre .sidetopp');
  sjekk('nivå og teller står oppe til høyre', sh.synlig && sh.x >= b.x + b.w - 1,
        `topp fra ${sh.x.toFixed(0)}, brett til ${(b.x + b.w).toFixed(0)}`);
  sjekk('de to toppene er like høye', Math.abs(st.h - sh.h) < 0.5,
        `${st.h.toFixed(0)} og ${sh.h.toFixed(0)} px`);
  const meta = await page.evaluate(() => ({
    nivaa: document.querySelector('#side-nivaa').textContent,
    igjen: document.querySelector('#side-igjen').textContent
  }));
  sjekk('nivået står der', /\S/.test(meta.nivaa), meta.nivaa);
  sjekk('telleren viser antall', /^\d+ igjen$|^Fullt$/.test(meta.igjen), meta.igjen);

  console.log('\n— Knappene fra begge sider virker —');
  const tom = await page.$$eval('.celle', els =>
    els.findIndex(e => !e.querySelector('.tall-stor').textContent));
  // Tallknappene er delt etter side i liggende — det dekkes i tastatur.js.
  // Her holder det å se at høyre side skriver, og at verktøyene er felles.
  await page.click(`.celle[data-i="${tom}"]`);
  await page.click('.hoyre .tallknapp[data-d="5"]');
  sjekk('høyre tallknapp skriver',
        (await page.$eval(`.celle[data-i="${tom}"] .tall-stor`, e => e.textContent)) === '5');
  await page.click('.hoyre .tallknapp[data-d="5"]');
  sjekk('samme knapp visker ut igjen',
        (await page.$eval(`.celle[data-i="${tom}"] .tall-stor`, e => e.textContent)) === '');

  // Liggende finnes verktøyene bare til høyre — venstre panel er gitt til
  // forklaringene. Tilstanden deles fortsatt av begge settene i DOM-en.
  await page.click('.hoyre .verktoyknapp[data-verktoy="fyll"]');
  const begge = await page.$$eval('.verktoyknapp[data-verktoy="fyll"]', els =>
    els.map(e => e.getAttribute('aria-pressed')));
  sjekk('Fyll slår på begge settene', begge.every(x => x === 'true'), begge.join(', '));
  await page.click('.hoyre .verktoyknapp[data-verktoy="fyll"]');
  sjekk('og av igjen på begge',
        (await page.$$eval('.verktoyknapp[data-verktoy="fyll"]', els =>
          els.every(e => e.getAttribute('aria-pressed') === 'false'))));

  await page.click('.hoyre .verktoyknapp[data-verktoy="auto"]');
  const sperret = await page.$$eval('.verktoyknapp[data-verktoy="angre"]', els => els.map(e => e.disabled));
  sjekk('Angre låses opp på begge sider', sperret.every(x => x === false), sperret.join(', '));
  await page.click('.hoyre .verktoyknapp[data-verktoy="angre"]');

  console.log('\n— Hint tar plassen der venstre verktøy ellers sto —');
  await page.click('.hoyre .verktoyknapp[data-verktoy="hint"]');
  const hint = await boks('#hint');
  sjekk('hintet vises', hint.synlig);
  sjekk('det står ved siden av brettet, ikke oppå det',
        hint.x + hint.w <= b.x + 1,
        `hint til ${(hint.x + hint.w).toFixed(0)}, brett fra ${b.x.toFixed(0)}`);
  await page.click('#hint-lukk');

  console.log('\n— Plass og størrelser på hver skjerm —');
  for (const [w, hh, navn] of SKJERMER) {
    await page.setViewportSize({ width: w, height: hh });
    const m = await page.evaluate(() => {
      const r = s => { const e = document.querySelector(s); const k = e.getBoundingClientRect();
        return { w: k.width, h: k.height }; };
      return {
        brett: r('.brett'), side: r('.venstre'), tall: r('.venstre .tallknapp'),
        verktoy: r('.hoyre .verktoyknapp'),
        vannrett: document.documentElement.scrollWidth > window.innerWidth,
        loddrett: document.documentElement.scrollHeight > window.innerHeight + 1,
        sprekk: Array.from(document.querySelectorAll('.vtekst'))
                     .some(t => t.scrollWidth > Math.ceil(t.parentElement.clientWidth))
      };
    });
    // Teksten i toppen skal vokse med spalta, men aldri renne ut av den.
    const t = await page.evaluate(() => {
      const els = ['.sidetittel', '.side-nivaa', '.side-igjen'].map(s => document.querySelector(s));
      return els.map(e => ({
        navn: e.className,
        px: parseFloat(getComputedStyle(e).fontSize),
        // display: none gir et nullrektangel, og da består alle grensene under
        // uten at et menneske ser noe som helst. Derfor måles bredden også.
        synlig: e.getBoundingClientRect().width > 1,
        sprekk: e.getBoundingClientRect().right >
                e.parentElement.getBoundingClientRect().right + 0.5 ||
                e.scrollWidth > Math.ceil(e.clientWidth) + 1,
        under: e.getBoundingClientRect().bottom >
               e.closest('.sidetopp').getBoundingClientRect().bottom + 0.5
      }));
    });
    // Knappen for fargeoppsett står i flyten nå — den skal faktisk kunne treffes.
    const knapp = await page.evaluate(() => {
      const r = document.querySelector('#btn-tema').getBoundingClientRect();
      const truffet = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { w: r.width, h: r.height, treff: !!truffet && !!truffet.closest('#btn-tema'),
               fikk: truffet ? truffet.className || truffet.id : 'ingen' };
    });
    const merk = `${navn} ${w}×${hh}`;
    sjekk(`${merk}: toppteksten er synlig`, t.every(x => x.synlig),
          t.filter(x => !x.synlig).map(x => x.navn).join(', ') || 'alle tre');
    sjekk(`${merk}: toppteksten holder seg i spalta`, t.every(x => !x.sprekk && !x.under),
          t.map(x => `${x.navn} ${x.px.toFixed(1)}px`).join(', '));
    sjekk(`${merk}: appnavnet er stort nok`, t[0].px >= 12,
          t[0].px.toFixed(1) + ' px');
    sjekk(`${merk}: ◐ lar seg trykke`, knapp.treff && knapp.w >= 28 && knapp.h >= 28,
          `${knapp.w.toFixed(0)}×${knapp.h.toFixed(0)} px, traff ${knapp.fikk}`);
    sjekk(`${merk}: ingen skroll`, !m.vannrett && !m.loddrett,
          (m.vannrett ? 'vannrett ' : '') + (m.loddrett ? 'loddrett' : ''));
    sjekk(`${merk}: brettet bruker høyden`, m.brett.h >= hh * 0.9,
          `${m.brett.h.toFixed(0)} px av ${hh}`);
    sjekk(`${merk}: tallknappene er til å treffe`, m.tall.w >= 30 && m.tall.h >= 30,
          `${m.tall.w.toFixed(0)}×${m.tall.h.toFixed(0)} px`);
    sjekk(`${merk}: verktøyetikettene får plass`, !m.sprekk,
          `verktøy ${m.verktoy.w.toFixed(0)}×${m.verktoy.h.toFixed(0)} px`);
  }

  console.log('\n— Stående er urørt —');
  await page.setViewportSize({ width: 390, height: 844 });
  const p = await page.evaluate(() => {
    const b = document.querySelector('.brett').getBoundingClientRect();
    const t = document.querySelector('.topp').getBoundingClientRect();
    const hoyre = document.querySelector('.hoyre').getBoundingClientRect();
    const tall = document.querySelector('.venstre .tall');
    return {
      tittelOver: t.bottom <= b.top + 1 && t.height > 0,
      hoyreSkjult: hoyre.width === 0,
      kolonner: getComputedStyle(tall).gridTemplateColumns.split(' ').length,
      verktoyKolonner: getComputedStyle(document.querySelector('.venstre .verktoy'))
                        .gridTemplateColumns.split(' ').length,
      skroll: document.documentElement.scrollHeight > window.innerHeight + 1
    };
  });
  sjekk('tittelen står over brettet igjen', p.tittelOver);
  sjekk('det andre settet er skjult', p.hoyreSkjult);
  sjekk('tallene står på én rad', p.kolonner === 9, p.kolonner + ' kolonner');
  sjekk('verktøyene står fire og fire', p.verktoyKolonner === 4, p.verktoyKolonner + ' kolonner');
  sjekk('ingen skroll', !p.skroll);

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  const R = BILDER;
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${R}/liggende.png` });

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
