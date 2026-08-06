const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

const boksAv = i => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);
const radAv = i => Math.floor(i / 9);
const kolAv = i => i % 9;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const erKonflikt = j => page.$eval(`.celle[data-i="${j}"]`, e => e.classList.contains('konflikt'));
  const rødFarge = j => page.$eval(`.celle[data-i="${j}"] .tall-stor`, e => getComputedStyle(e).color);
  const skriv = async (j, d) => { await page.click(`.celle[data-i="${j}"]`); await page.click(`.venstre .tallknapp[data-d="${d}"]`); };

  const brett = await page.$$eval('.celle', els => els.map(e => ({
    gitt: e.classList.contains('gitt'),
    v: e.querySelector('.tall-stor').textContent
  })));
  const fasit = await page.evaluate(() => Array.from(document.querySelectorAll('.celle')).map((_, i) => i));

  console.log('\n— Kollisjon med et gitt tall —');
  // Finn en tom rute som har et gitt tall i samme rad.
  let mål = null, kilde = null, retning = null;
  for (const par of [['rad', radAv], ['kolonne', kolAv], ['boks', boksAv]]) {
    for (let i = 0; i < 81 && !mål; i++) {
      if (brett[i].v) continue;
      const g = fasit.find(j => j !== i && brett[j].gitt && par[1](j) === par[1](i));
      if (g !== undefined) { mål = i; kilde = g; retning = par[0]; }
    }
    if (mål !== null) break;
  }
  const D = Number(brett[kilde].v);
  sjekk('fant tom rute med gitt tall i samme ' + retning, mål !== null,
        `skriver ${D} i ${mål}, kolliderer med ${kilde}`);

  await skriv(mål, D);
  sjekk('ruta merkes som konflikt', await erKonflikt(mål));
  sjekk('det gitte tallet merkes ikke', !(await erKonflikt(kilde)), 'rute ' + kilde);
  const farge = await rødFarge(mål);
  sjekk('tallet er rødt', farge === 'rgb(192, 57, 43)', farge);

  console.log('\n— Retting fjerner merkingen —');
  await page.click('.venstre .verktoyknapp[data-verktoy="slett"]');
  sjekk('merkingen er borte', !(await erKonflikt(mål)));

  console.log('\n— To egne tall som kolliderer —');
  // Søk uttømmende: vi trenger to tomme ruter som deler en enhet, og et tall
  // som ikke står blant naboene til noen av dem — ellers ville det første
  // tallet kollidere med noe annet enn det vi vil måle. Ikke alle brett har en
  // slik kombinasjon i den første ruta man ser på.
  const oppsett = await page.evaluate(() => {
    const v = Array.from(document.querySelectorAll('.celle'))
                   .map(e => Number(e.querySelector('.tall-stor').textContent) || 0);
    const P = window.SudokuCore.PEERS;
    for (let a = 0; a < 81; a++) {
      if (v[a]) continue;
      for (const b of P[a]) {
        if (v[b]) continue;
        const brukt = new Set(P[a].concat(P[b]).map(j => v[j]).filter(Boolean));
        for (let d = 1; d <= 9; d++) if (!brukt.has(d)) return [a, b, d];
      }
    }
    return null;
  });
  sjekk('fant to ruter og et ubrukt tall', oppsett !== null,
        oppsett && `${oppsett[2]} i ${oppsett[0]} og ${oppsett[1]}`);
  const [a, b, D2] = oppsett;

  await skriv(a, D2);
  sjekk('første tall alene er ingen konflikt', !(await erKonflikt(a)));
  await skriv(b, D2);
  sjekk('begge merkes når det andre kommer', (await erKonflikt(a)) && (await erKonflikt(b)));

  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  sjekk('angre løser opp konflikten', !(await erKonflikt(a)));

  console.log('\n— Riktige plasseringer merkes aldri —');
  // Blankt brett: testen over har med vilje lagt igjen gale tall, og da ville
  // en «riktig» plassering kunne kollidere med dem helt legitimt.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const fylt = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('sudoku-v1'));
    return Array.from(document.querySelectorAll('.celle'))
      .map((e, i) => [i, !e.querySelector('.tall-stor').textContent])
      .filter(x => x[1]).slice(0, 10).map(([i]) => [i, d.losning[i]]);
  });
  for (const [i, d] of fylt) await skriv(i, d);

  const merket = [];
  for (const [i] of fylt) if (await erKonflikt(i)) merket.push(i);
  sjekk('ti tall fra løsningen gir null konflikter', merket.length === 0,
        merket.length ? 'merket: ' + merket.join(', ') : '10 av 10 rene');

  console.log('\n— Mørk modus bruker sin egen røde —');
  // Brettet er byttet ut over, så vi finner en ny kollisjon på det som står nå.
  const nyKollisjon = await page.evaluate(() => {
    const v = Array.from(document.querySelectorAll('.celle'))
                   .map(e => Number(e.querySelector('.tall-stor').textContent) || 0);
    for (let i = 0; i < 81; i++) {
      if (v[i]) continue;
      const d = window.SudokuCore.PEERS[i].map(j => v[j]).find(Boolean);
      if (d) return [i, d];
    }
    return null;
  });
  sjekk('fant en rute å kollidere i', nyKollisjon !== null,
        nyKollisjon && `skriver ${nyKollisjon[1]} i ${nyKollisjon[0]}`);

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.tema === 'natt', { timeout: 3000 });
  await skriv(nyKollisjon[0], nyKollisjon[1]);
  sjekk('ruta er i konflikt', await erKonflikt(nyKollisjon[0]));
  const mørk = await rødFarge(nyKollisjon[0]);
  sjekk('rødt er lysere i mørk modus', mørk === 'rgb(240, 138, 124)', mørk);
  await page.emulateMedia({ colorScheme: 'light' });

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: BILDER + '/konflikt.png' });

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
