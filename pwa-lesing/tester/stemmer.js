/*
 * Prøver stemmevelgeren med en falsk stemmeliste.
 *
 * Det som skal holde: velgeren viser nøyaktig det systemet melder om. Hele
 * grunnen til at skjermen finnes, er å svare på om iOS' personlige stemme er
 * tilgjengelig for nettsider — da må lista ikke filtrere bort noe i det
 * stille. En personlig stemme kan være merket med en annen språkkode enn
 * nb-NO, så «vis alle»-avkryssingen må få fram alt.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
               '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((rq, rs) => {
  let p = rq.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(ROT, p);
  if (!f.startsWith(ROT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); rs.end(); return; }
  rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  rs.end(fs.readFileSync(f));
});

let feil = 0;
function sjekk(navn, faktisk, ventet) {
  const ok = JSON.stringify(faktisk) === JSON.stringify(ventet);
  if (!ok) feil++;
  console.log((ok ? 'OK   ' : 'FEIL ') + navn + '  ->  ' + JSON.stringify(faktisk) +
              (ok ? '' : ' (ventet ' + JSON.stringify(ventet) + ')'));
}

(async () => {
  await new Promise(r => server.listen(8125, r));
  const nettleser = await chromium.launch();
  const side = await nettleser.newPage({ viewport: { width: 820, height: 1180 } });
  const konsollfeil = [];
  side.on('pageerror', e => konsollfeil.push(e.message));

  await side.addInitScript(() => {
    window.__sagt = [];
    const stemmer = [
      { name: 'Nora', lang: 'nb-NO', voiceURI: 'nora', localService: true },
      { name: 'Henrik', lang: 'nb-NO', voiceURI: 'henrik', localService: true },
      { name: 'Daniel', lang: 'en-GB', voiceURI: 'daniel', localService: true },
      // Slik en personlig stemme kan tenkes å se ut om Safari slipper den ut.
      { name: 'Pappa', lang: 'en-US', voiceURI: 'personlig-pappa', localService: true }
    ];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => stemmer,
        addEventListener: () => {},
        speak: y => { window.__sagt.push({ tekst: y.text, stemme: y.voice && y.voice.voiceURI, lang: y.lang, rate: y.rate }); },
        cancel: () => {}
      }
    });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });

  await side.goto('http://localhost:8125/', { waitUntil: 'networkidle' });
  await side.click('#knapp-innstillinger');
  await side.waitForSelector('#innstillinger:not([hidden])');

  sjekk('bare norske som standard', await side.$$eval('#valg-stemme option', n => n.map(o => o.textContent)),
    ['Nora (nb-NO)', 'Henrik (nb-NO)']);

  sjekk('fasiten teller alt systemet melder',
    await side.textContent('#stemme-fasit'),
    'Safari melder om 4 stemmer på denne enheten, 2 av dem norske. Kryss av over for å se hele lista — er den personlige stemmen din tilgjengelig for nettsider, dukker den opp der, og da kan du velge den.');

  // «Vis alle» må få fram stemmer med andre språkkoder – det er der en
  // personlig stemme ville dukket opp.
  await side.check('#valg-alle');
  sjekk('vis alle tar med de andre språkene',
    await side.$$eval('#valg-stemme option', n => n.map(o => o.textContent)),
    ['Nora (nb-NO)', 'Henrik (nb-NO)', 'Daniel (en-GB)', 'Pappa (en-US)']);

  // Velges en stemme med annen språkkode, må utsagnet følge stemmen og ikke
  // tvinges tilbake til nb-NO.
  await side.selectOption('#valg-stemme', 'personlig-pappa');
  sjekk('valgt stemme brukes, med sin egen språkkode',
    await side.evaluate(() => {
      const s = window.__sagt[window.__sagt.length - 1];
      return { stemme: s.stemme, lang: s.lang };
    }), { stemme: 'personlig-pappa', lang: 'en-US' });

  sjekk('valget lagres',
    await side.evaluate(() => JSON.parse(localStorage.getItem('lesing-v1')).stemme), 'personlig-pappa');

  // Valget må overleve omlasting, og ikke filtreres bort selv om det ikke er
  // norsk.
  await side.evaluate(() => document.getElementById('valg-alle').click());
  await side.reload({ waitUntil: 'networkidle' });
  await side.click('#knapp-innstillinger');
  sjekk('valgt stemme overlever omlasting og filter',
    await side.evaluate(() => document.getElementById('valg-stemme').value), 'personlig-pappa');

  // Lesefarten skal slå gjennom på opplesingen.
  await side.evaluate(() => {
    const s = document.getElementById('valg-fart');
    s.value = '0.6';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  sjekk('lesefart brukes', await side.evaluate(() => window.__sagt[window.__sagt.length - 1].rate), 0.6);
  sjekk('lesefart lagres',
    await side.evaluate(() => JSON.parse(localStorage.getItem('lesing-v1')).fart), 0.6);

  console.log(konsollfeil.length ? 'KONSOLLFEIL: ' + konsollfeil.join(' | ') : 'ingen feil i konsollen');
  await nettleser.close();
  server.close();
  process.exit(feil || konsollfeil.length ? 1 : 0);
})();
