const { chromium } = require('playwright');
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

const AUTO = '.venstre .verktoyknapp[data-verktoy="auto"]';

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

  const merker = () => page.$$eval('.merker i.paa', els => els.length);
  const knapp = () => page.$eval(AUTO, e => ({
    tekst: e.querySelector('.vtekst').textContent,
    symbol: e.querySelector('.vsymbol').textContent,
    trykt: e.getAttribute('aria-pressed')
  }));
  const melding = () => page.$eval('#melding', e => e.hidden ? '' : e.textContent);

  console.log('\n— Trinn 1: Auto fyller ut alt —');
  let k = await knapp();
  sjekk('knappen sier «Auto»', k.tekst === 'Auto', k.symbol + ' ' + k.tekst);
  sjekk('den er markert som på', k.trykt === 'true');
  const alle = await merker();
  sjekk('merkene er fylt ut', alle > 0, alle + ' merker');

  console.log('\n— Trinn 2: manuell, med merkene i behold —');
  await page.click(AUTO);
  k = await knapp();
  sjekk('knappen sier «Manuell»', k.tekst === 'Manuell', k.symbol + ' ' + k.tekst);
  sjekk('den er ikke lenger markert som på', k.trykt === 'false');
  sjekk('merkene står igjen, uendret i antall', await merker() === alle,
        (await merker()) + ' av ' + alle);
  sjekk('forklaringen sier at de er dine', (await melding()).includes('dine'), await melding());

  const tom = await page.$$eval('.celle', els =>
    els.findIndex(e => !e.querySelector('.tall-stor').textContent));
  const førRedigering = await merker();
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
  await page.click(`.celle[data-i="${tom}"]`);
  const finnesAlt = await page.$eval(`.celle[data-i="${tom}"] .merker i:nth-child(1)`,
                                     e => e.classList.contains('paa'));
  await page.click('.venstre .tallknapp[data-d="1"]');
  sjekk('merkene kan redigeres', await merker() === førRedigering + (finnesAlt ? -1 : 1),
        'ett merke ' + (finnesAlt ? 'fjernet' : 'lagt til'));
  await page.click('.venstre .tallknapp[data-d="1"]');            // rygg tilbake
  await page.click('.venstre .verktoyknapp[data-verktoy="blyant"]');

  console.log('\n— Trinn 3: tomt —');
  await page.click(AUTO);
  k = await knapp();
  sjekk('knappen sier «Tomt»', k.tekst === 'Tomt', k.symbol + ' ' + k.tekst);
  sjekk('alle merker er borte', await merker() === 0, (await merker()) + ' igjen');
  sjekk('forklaringen sier at de er tømt', (await melding()).includes('tømt'), await melding());

  console.log('\n— Ringen slutter —');
  await page.click(AUTO);
  k = await knapp();
  sjekk('knappen sier «Auto» igjen', k.tekst === 'Auto', k.symbol + ' ' + k.tekst);
  sjekk('merkene er regnet ut på nytt', await merker() === alle, (await merker()) + ' av ' + alle);
  sjekk('meldingen er borte', (await melding()) === '');

  console.log('\n— Angre går baklengs gjennom trinnene —');
  await page.click(AUTO);                                  // → manuell
  await page.click(AUTO);                                  // → tomt
  sjekk('vi står på tomt', (await knapp()).tekst === 'Tomt');
  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  sjekk('ett angre gir manuell', (await knapp()).tekst === 'Manuell');
  sjekk('merkene er tilbake', await merker() === alle, (await merker()) + ' av ' + alle);
  await page.click('.venstre .verktoyknapp[data-verktoy="angre"]');
  sjekk('to angre gir Auto', (await knapp()).tekst === 'Auto');

  console.log('\n— Trinnet overlever omlasting —');
  await page.click(AUTO);                                  // → manuell
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });
  sjekk('vi står fortsatt på manuell', (await knapp()).tekst === 'Manuell');
  sjekk('merkene er de samme', await merker() === alle, (await merker()) + ' av ' + alle);

  console.log('\n— Nytt spill: «manuell» ville løyet om et tømt brett —');
  await page.click('.venstre .verktoyknapp[data-verktoy="nytt"]');
  await page.click('.nivaaknapp[data-nivaa="lett"]');
  await page.waitForFunction(() => document.querySelector('#jobber').hidden, { timeout: 60000 });
  sjekk('trinnet er flyttet til tomt', (await knapp()).tekst === 'Tomt', (await knapp()).tekst);
  sjekk('brettet er uten merker', await merker() === 0);

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
