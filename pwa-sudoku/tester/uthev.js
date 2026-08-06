const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  // Velg en rute med et tall i, og les av hva brettet gjør.
  const bilde = () => page.evaluate(() => {
    const celler = Array.from(document.querySelectorAll('.celle'));
    const valgt = celler.findIndex(e => e.classList.contains('valgt'));
    const d = valgt >= 0 ? Number(celler[valgt].querySelector('.tall-stor').textContent) : 0;
    return {
      tall: d,
      likt: celler.filter(e => e.classList.contains('likt') &&
        e.querySelector('.tall-stor').textContent).length,
      likteMerker: celler.filter(e => e.classList.contains('likt') &&
        !e.querySelector('.tall-stor').textContent).length,
      uthevedeMerker: document.querySelectorAll('.merker i.uthevet.paa').length,
      // Fasit rett fra brettet
      fasitTall: celler.filter((e, i) => i !== valgt &&
        Number(e.querySelector('.tall-stor').textContent) === d).length,
      fasitMerker: celler.filter(e => {
        const m = e.querySelectorAll('.merker i')[d - 1];
        return m && m.classList.contains('paa');
      }).length
    };
  });

  // Tallet må stå minst to steder, ellers finnes det ingen annen tall-rute å
  // sammenlikne flata med, og testen blir tilfeldig avhengig av brettet.
  const medTall = await page.$$eval('.celle', els => {
    const v = els.map(e => e.querySelector('.tall-stor').textContent);
    return v.findIndex((x, i) => x && v.some((y, j) => j !== i && y === x));
  });
  sjekk('fant et tall som står flere steder', medTall >= 0, 'rute ' + medTall);
  await page.click(`.celle[data-i="${medTall}"]`);
  const b = await bilde();

  console.log('\n— Trykk på et tall lyser opp begge slag —');
  sjekk('en rute med tall er valgt', b.tall > 0, 'tallet ' + b.tall);
  sjekk('alle like store tall er markert', b.likt === b.fasitTall,
        `${b.likt} markert, ${b.fasitTall} finnes`);
  sjekk('ruter med samme blyantmerke er markert', b.likteMerker === b.fasitMerker && b.likteMerker > 0,
        `${b.likteMerker} markert, ${b.fasitMerker} finnes`);
  sjekk('selve merket er uthevet, ikke bare ruta', b.uthevedeMerker === b.fasitMerker,
        b.uthevedeMerker + ' merker');

  console.log('\n— Samme flate på begge, forskjellen ligger i innholdet —');
  await page.waitForTimeout(250);           // .celle toner bakgrunnen over .12s
  const farger = await page.evaluate(() => {
    const celler = Array.from(document.querySelectorAll('.celle.likt'));
    const medTall = celler.find(e => e.querySelector('.tall-stor').textContent);
    const medMerke = celler.find(e => !e.querySelector('.tall-stor').textContent);
    const e = document.querySelector('.merker i.uthevet.paa');
    const a = document.querySelector('.merker i.paa:not(.uthevet)');
    return {
      tallflate: medTall && getComputedStyle(medTall).backgroundColor,
      merkeflate: medMerke && getComputedStyle(medMerke).backgroundColor,
      vekt: [e && getComputedStyle(e).fontWeight, a && getComputedStyle(a).fontWeight]
    };
  });
  sjekk('tall-ruter og merke-ruter har samme flate', farger.tallflate === farger.merkeflate,
        `${farger.tallflate} mot ${farger.merkeflate}`);
  sjekk('uthevet merke er feitere enn de andre', Number(farger.vekt[0]) > Number(farger.vekt[1]),
        farger.vekt.join(' mot '));

  console.log('\n— Tom rute lyser ingenting opp —');
  const tom = await page.$$eval('.celle', els =>
    els.findIndex(e => !e.querySelector('.tall-stor').textContent));
  await page.click(`.celle[data-i="${tom}"]`);
  const t = await bilde();
  sjekk('ingen ruter markert', t.likt === 0 && t.likteMerker === 0,
        `${t.likt} tall, ${t.likteMerker} merker`);
  sjekk('ingen merker uthevet', t.uthevedeMerker === 0);

  console.log('\n— Virker også i fyllmodus —');
  await page.click('.venstre .verktoyknapp[data-verktoy="fyll"]');
  await page.click('.venstre .tallknapp[data-d="4"]');
  const f = await page.evaluate(() => ({
    likt: document.querySelectorAll('.celle.likt').length,
    merker: Array.from(document.querySelectorAll('.celle.likt')).filter(e => !e.querySelector('.tall-stor').textContent).length,
    uthevet: document.querySelectorAll('.merker i.uthevet.paa').length
  }));
  sjekk('det armede tallet lyser opp begge slag', f.likt > 0 && f.merker > 0,
        `${f.likt} tall, ${f.merker} merkeruter`);
  sjekk('merkene er uthevet', f.uthevet === f.merker, f.uthevet + ' merker');
  await page.click('.venstre .verktoyknapp[data-verktoy="fyll"]');

  console.log('\n— Hint vinner over uthevingen —');
  await page.click('.venstre .verktoyknapp[data-verktoy="hint"]');
  await page.click('#hint-mer');
  const kroner = await page.evaluate(() => ({
    vekk: document.querySelectorAll('.merker i.hint-vekk').length,
    dobbelt: document.querySelectorAll('.merker i.uthevet.hint-vekk, .merker i.uthevet.hint-tall').length
  }));
  sjekk('ingen merker har både hint- og uthevingsklasse', kroner.dobbelt === 0,
        kroner.dobbelt + ' doble');
  await page.click('#hint-lukk');

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await page.click(`.celle[data-i="${medTall}"]`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: BILDER + '/uthev.png' });
  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
