const { chromium } = require('playwright');

const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (navn, ok, detalj) => {
  console.log((ok ? '  OK   ' : '  FEIL ') + navn + (detalj ? '  → ' + detalj : ''));
  if (!ok) feil++;
};

const boksAv = i => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);
const radAv = i => Math.floor(i / 9);
const kolAv = i => i % 9;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const konsollfeil = [];
  page.on('console', m => { if (m.type() === 'error') konsollfeil.push(m.text()); });
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const harMerke = (j, d) => page.$eval(`.celle[data-i="${j}"] .merker i:nth-child(${d})`,
                                        e => e.classList.contains('paa'));
  const verdi = j => page.$eval(`.celle[data-i="${j}"] .tall-stor`, e => e.textContent);

  // Auto → Manuell → Tomt: blankt ark er trinn tre, ikke trinn to.
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');

  const tomme = await page.$$eval('.celle', els =>
    els.map((e, i) => [i, !e.querySelector('.tall-stor').textContent]).filter(x => x[1]).map(x => x[0]));

  const D = 6;
  // Vi trenger én rute med tomme naboer i boks, rad og kolonne — og én tom rute
  // som ikke deler noe med den i det hele tatt.
  let mål = null, iBoks, iRad, iKol, iFri;
  for (const t of tomme) {
    const b = tomme.filter(x => x !== t && boksAv(x) === boksAv(t));
    const r = tomme.filter(x => x !== t && radAv(x) === radAv(t) && boksAv(x) !== boksAv(t));
    const k = tomme.filter(x => x !== t && kolAv(x) === kolAv(t) && boksAv(x) !== boksAv(t));
    const f = tomme.filter(x => x !== t && radAv(x) !== radAv(t) && kolAv(x) !== kolAv(t) && boksAv(x) !== boksAv(t));
    if (b.length && r.length && k.length && f.length) { mål = t; iBoks = b[0]; iRad = r[0]; iKol = k[0]; iFri = f[0]; break; }
  }
  sjekk('fant et brukbart oppsett', mål !== null,
        `skriver i ${mål} — boks ${iBoks}, rad ${iRad}, kolonne ${iKol}, urørt ${iFri}`);

  for (const j of [iBoks, iRad, iKol, iFri]) {
    await page.click(`.celle[data-i="${j}"]`);
    await page.click(`.venstre .tallknapp[data-d="${D}"]`);
  }
  await page.click(`.celle[data-i="${iBoks}"]`);
  await page.click('.venstre .tallknapp[data-d="3"]');       // et annet merke som skal overleve

  console.log('\n— Før innsetting —');
  for (const [navn, j] of [['boks', iBoks], ['rad', iRad], ['kolonne', iKol], ['urørt', iFri]]) {
    sjekk(`merket står i ${navn}naboen`, await harMerke(j, D));
  }

  console.log('\n— Tallet settes inn —');
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
  await page.click(`.celle[data-i="${mål}"]`);
  await page.click(`.venstre .tallknapp[data-d="${D}"]`);
  sjekk('tallet står i ruta', (await verdi(mål)) === String(D));

  sjekk('merket i samme boks er strøket', !(await harMerke(iBoks, D)));
  sjekk('merket i samme rad er strøket', !(await harMerke(iRad, D)), 'rute ' + iRad);
  sjekk('merket i samme kolonne er strøket', !(await harMerke(iKol, D)), 'rute ' + iKol);
  sjekk('ruta uten fellesskap står urørt', await harMerke(iFri, D), 'rute ' + iFri);
  sjekk('andre tall i samme rute står igjen', await harMerke(iBoks, 3));

  console.log('\n— Alle tjue naboene —');
  const igjen = [];
  for (const j of Array.from({ length: 81 }, (_, x) => x)) {
    const deler = j !== mål && (radAv(j) === radAv(mål) || kolAv(j) === kolAv(mål) || boksAv(j) === boksAv(mål));
    if (deler && await harMerke(j, D)) igjen.push(j);
  }
  sjekk('ingen nabo har merket igjen', igjen.length === 0, igjen.length ? 'står igjen i ' + igjen.join(', ') : '20 naboer rene');

  console.log('\n— Angre —');
  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  sjekk('tallet er borte', (await verdi(mål)) === '');
  for (const [navn, j] of [['boks', iBoks], ['rad', iRad], ['kolonne', iKol]]) {
    sjekk(`merket i ${navn} er tilbake`, await harMerke(j, D));
  }

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
