const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });

const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (navn, ok, detalj) => {
  console.log((ok ? '  OK   ' : '  FEIL ') + navn + (detalj ? '  → ' + detalj : ''));
  if (!ok) feil++;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const konsollfeil = [];
  page.on('console', m => { if (m.type() === 'error') konsollfeil.push(m.text()); });
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.waitForFunction(() => {
    const t = document.querySelector('#meta-igjen').textContent;
    return t && t !== '–';
  }, { timeout: 60000 });

  const tomme = () => page.$$eval('.celle', els =>
    els.map((e, i) => ({ i, tom: !e.querySelector('.tall-stor').textContent, gitt: e.classList.contains('gitt') }))
       .filter(c => c.tom).map(c => c.i));
  const verdi = i => page.$eval(`.celle[data-i="${i}"] .tall-stor`, e => e.textContent);

  console.log('\n— Fyllmodus: fire ruter med fire trykk —');

  await page.click('.venstre .verktoyknapp[data-verktoy="fyll"]');
  sjekk('Fyll slår seg på', await page.getAttribute('.venstre .verktoyknapp[data-verktoy="fyll"]', 'aria-pressed') === 'true');
  sjekk('forklaring vises', !(await page.isHidden('#melding')),
        (await page.textContent('#melding')).slice(0, 60));

  await page.click('.venstre .tallknapp[data-d="1"]');
  sjekk('tallet 1 markeres som aktivt',
        await page.$eval('.venstre .tallknapp[data-d="1"]', e => e.classList.contains('aktiv')));

  const mål = (await tomme()).slice(0, 4);
  sjekk('fant fire tomme ruter', mål.length === 4, 'ruter ' + mål.join(', '));

  for (const i of mål) await page.click(`.celle[data-i="${i}"]`);

  const satt = [];
  for (const i of mål) satt.push(await verdi(i));
  sjekk('fire trykk ga fire ettall', satt.every(v => v === '1'), 'fikk [' + satt.join(', ') + ']');

  console.log('\n— Angre er per innsetting —');
  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  sjekk('ett angre fjerner ett tall',
        (await verdi(mål[3])) === '' && (await verdi(mål[2])) === '1');
  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  const etterAngre = [];
  for (const i of mål) etterAngre.push(await verdi(i));
  sjekk('fire angre tømmer alle fire', etterAngre.every(v => v === ''), '[' + etterAngre.join(', ') + ']');

  console.log('\n— Gitte ruter er fredet —');
  const gitt = await page.$$eval('.celle.gitt', els => els.map(e => Number(e.dataset.i)));
  const gv = await verdi(gitt[0]);
  await page.click(`.celle[data-i="${gitt[0]}"]`);
  sjekk('trykk på gitt rute endrer ingenting', (await verdi(gitt[0])) === gv, 'sto ' + gv);
  sjekk('gitt rute blir likevel markert',
        await page.$eval(`.celle[data-i="${gitt[0]}"]`, e => e.classList.contains('valgt')));

  console.log('\n— Samme tall igjen slår av —');
  await page.click('.venstre .tallknapp[data-d="1"]');
  sjekk('tallet slås av',
        !(await page.$eval('.venstre .tallknapp[data-d="1"]', e => e.classList.contains('aktiv'))));
  const før = await verdi(mål[0]);
  await page.click(`.celle[data-i="${mål[0]}"]`);
  sjekk('uten aktivt tall skriver celletrykk ingenting', (await verdi(mål[0])) === før);

  console.log('\n— Viske ut: samme tall oppå seg selv —');
  await page.click('.venstre .tallknapp[data-d="1"]');
  await page.click(`.celle[data-i="${mål[0]}"]`);
  sjekk('første trykk setter inn', (await verdi(mål[0])) === '1');
  await page.click(`.celle[data-i="${mål[0]}"]`);
  sjekk('andre trykk visker ut', (await verdi(mål[0])) === '');

  /*
   * «Blyant» skal gjelde tallet du alt har plukket ut, ikke bare det neste.
   * Feilen var at aktivtBlyant ble satt idet tallet ble valgt og så ble
   * stående: du slo av blyanten for å sette inn et stort tall, knappen sa av,
   * og trykkene la fortsatt igjen små tall.
   */
  console.log('\n— «Blyant» slår om det valgte tallet, stående —');
  const merker = i => page.$$eval(`.celle[data-i="${i}"] .merker i`,
    els => els.filter(e => e.className.includes('paa')).map(e => e.textContent).join(''));

  // Merkene må være mine å skrive i: «Auto» sperrer blyanten.
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');
  sjekk('Auto står på «Manuell»',
        (await page.textContent('.venstre .verktoyknapp[data-verktoy="auto"] .vtekst')) === 'Manuell');

  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
  await page.click('.venstre .tallknapp[data-d="4"]');
  const bm = (await tomme()).slice(0, 2);
  await page.click(`.celle[data-i="${bm[0]}"]`);
  sjekk('med blyant på blir 4 et merke',
        (await merker(bm[0])).includes('4') && (await verdi(bm[0])) === '',
        `merker «${await merker(bm[0])}», stort «${await verdi(bm[0])}»`);

  // Kjernen: slå av blyanten uten å velge tallet på nytt.
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
  sjekk('«Blyant» melder seg av',
        await page.getAttribute('.venstre .verktoyknapp[data-verktoy="blyant"]', 'aria-pressed') === 'false');
  await page.click(`.celle[data-i="${bm[1]}"]`);
  sjekk('samme 4-er blir nå et stort tall', (await verdi(bm[1])) === '4',
        `stort «${await verdi(bm[1])}», merker «${await merker(bm[1])}»`);

  // Og den andre veien. Ikke ruta som alt har et 4-merke: der ville trykket
  // skrudd merket av igjen, og prøven målt det motsatte av det den tror.
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
  const bm2 = (await tomme()).filter(i => i !== bm[0])[0];
  await page.click(`.celle[data-i="${bm2}"]`);
  sjekk('blyant på igjen gir merke av samme tall',
        (await merker(bm2)).includes('4') && (await verdi(bm2)) === '',
        `merker «${await merker(bm2)}», stort «${await verdi(bm2)}»`);

  // Rydd opp: blyant av og merkene tilbake til automatiske.
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');
  sjekk('Auto er tilbake',
        (await page.textContent('.venstre .verktoyknapp[data-verktoy="auto"] .vtekst')) === 'Auto');

  console.log('\n— Rute først virker som før —');
  await page.click('.venstre .verktoyknapp[data-verktoy="fyll"]');
  sjekk('Fyll slås av', await page.getAttribute('.venstre .verktoyknapp[data-verktoy="fyll"]', 'aria-pressed') === 'false');
  const r = (await tomme())[0];
  await page.click(`.celle[data-i="${r}"]`);
  await page.click('.venstre .tallknapp[data-d="5"]');
  sjekk('velg rute → trykk tall skriver 5', (await verdi(r)) === '5');
  await page.click('.venstre .tallknapp[data-d="5"]');
  sjekk('samme tall igjen visker ut', (await verdi(r)) === '');

  console.log('\n— Tastatur —');
  await page.click('.venstre .verktoyknapp[data-verktoy="fyll"]');
  await page.keyboard.press('3');
  sjekk('tastetrykk velger aktivt tall i fyllmodus',
        await page.$eval('.venstre .tallknapp[data-d="3"]', e => e.classList.contains('aktiv')));
  const r2 = (await tomme())[0];
  await page.click(`.celle[data-i="${r2}"]`);
  sjekk('celletrykk setter inn 3', (await verdi(r2)) === '3');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const valgt = await page.$eval('.celle.valgt', e => Number(e.dataset.i));
  const vv = await verdi(valgt);
  sjekk('Enter fyller valgt rute', vv === '3' || (await page.$eval(`.celle[data-i="${valgt}"]`, e => e.classList.contains('gitt'))),
        'rute ' + valgt + ' = "' + vv + '"');

  console.log('\n— Modus overlever omlasting —');
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');                       // slå Auto av
  const fyllFør = await page.getAttribute('.venstre .verktoyknapp[data-verktoy="fyll"]', 'aria-pressed');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });
  sjekk('Fyll står som før omlasting',
        await page.getAttribute('.venstre .verktoyknapp[data-verktoy="fyll"]', 'aria-pressed') === fyllFør, 'var ' + fyllFør);
  sjekk('Auto-knappen viser at den er av',
        await page.getAttribute('.venstre .verktoyknapp[data-verktoy="auto"]', 'aria-pressed') === 'false');
  // Auto går i ring på tre trinn; klikk resten av veien tilbake, så vi måler
  // layouten uten en melding stående (den tar 62 px og skroller en 320x568).
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');
  await page.click('.venstre .verktoyknapp[data-verktoy="auto"]');

  console.log('\n— Verktøylinja med åtte knapper —');
  const skjermer = [
    [320, 568, 'iPhone SE 1'], [360, 640, 'liten Android'], [375, 667, 'iPhone SE 2'],
    [390, 844, 'iPhone 14'], [430, 932, 'iPhone Pro Max'], [412, 915, 'Pixel'],
    [480, 800, 'terskel'], [768, 1024, 'nettbrett'], [1280, 900, 'skrivebord']
  ];
  for (const [w, h, navn] of skjermer) {
    await page.setViewportSize({ width: w, height: h });
    const m = await page.$$eval('.venstre .verktoyknapp', els => els.map(e => {
      const t = e.querySelector('.vtekst');
      return { tekst: t.textContent, sprekk: t.scrollWidth > Math.ceil(e.clientWidth), bredde: e.clientWidth };
    }));
    const dårlige = m.filter(x => x.sprekk).map(x => x.tekst);
    const skroll = await page.evaluate(() => ({
      vannrett: document.documentElement.scrollWidth > window.innerWidth,
      loddrett: document.documentElement.scrollHeight > window.innerHeight + 1
    }));
    // Versjonsmerket ligger utenfor flyten og kan derfor legge seg oppå
    // verktøylinja uten at noe annet mål oppdager det.
    const merke = await page.evaluate(() => {
      const v = document.querySelector('#versjon').getBoundingClientRect();
      const t = document.querySelector('.venstre .verktoy').getBoundingClientRect();
      return { over: v.top < t.bottom - 0.5, topp: v.top, bunn: t.bottom };
    });
    const merk = `${navn} ${w}×${h}`;
    sjekk(merk + ': versjonsmerket ligger klar av knappene', !merke.over,
          `merket fra ${merke.topp.toFixed(0)}, knappene til ${merke.bunn.toFixed(0)}`);
    sjekk(merk + ': etikettene får plass', dårlige.length === 0,
          'knapp ' + m[0].bredde.toFixed(0) + 'px' + (dårlige.length ? ', sprekker: ' + dårlige.join(', ') : ''));
    sjekk(merk + ': ingen skroll', !skroll.vannrett && !skroll.loddrett,
          (skroll.vannrett ? 'vannrett ' : '') + (skroll.loddrett ? 'loddrett' : ''));
  }

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: BILDER + '/fyllmodus.png' });

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
