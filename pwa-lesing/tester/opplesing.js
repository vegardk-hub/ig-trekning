/*
 * Opplesingen kan ikke prøves med ekte tale i skyøkta – der finnes ingen
 * stemmer, så speak() er ferdig før den har begynt. Her byttes
 * speechSynthesis ut med en falsk som lar oss gå én linje om gangen.
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
  await new Promise(r => server.listen(8124, r));
  const nettleser = await chromium.launch();
  const side = await nettleser.newPage({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
  const konsollfeil = [];
  side.on('pageerror', e => konsollfeil.push(e.message));

  // Falsk talesyntese: holder på utsagnet til vi selv sier at det er ferdig.
  await side.addInitScript(() => {
    window.__ko = [];
    // speechSynthesis er en getter på Window. Vanlig tilordning feiler stille,
    // og da kjører prøven mot den ekte som ikke har stemmer i skyøkta.
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ lang: 'nb-NO', name: 'Falsk' }],
        addEventListener: () => {},
        speak: y => { window.__ko.push(y); },
        cancel: () => { window.__ko.length = 0; }
      }
    });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });

  await side.goto('http://localhost:8124/', { waitUntil: 'networkidle' });
  await side.click('#knapp-les');
  await side.waitForSelector('#lesing:not([hidden])');

  await side.click('#knapp-opplesing');
  sjekk('første linje lyser', await side.evaluate(() => ({
    lyser: [...document.querySelectorAll('.linje')].map(p => p.classList.contains('leses')),
    sagt: window.__ko.map(y => y.text),
    knapp: document.getElementById('knapp-opplesing').classList.contains('paa')
  })), { lyser: [true, false], sagt: ['Ildkulen står midt i hallen.'], knapp: true });

  // Første linje ferdig -> andre skal lyse.
  await side.evaluate(() => window.__ko[0].onend());
  sjekk('andre linje lyser', await side.evaluate(() => ({
    lyser: [...document.querySelectorAll('.linje')].map(p => p.classList.contains('leses')),
    sagt: window.__ko.length
  })), { lyser: [false, true], sagt: 2 });

  sjekk('opplesing farger ingenting grønt',
    await side.$$eval('#lese-tekst .ord.lest', n => n.length), 0);

  // Siste linje ferdig -> alt slukker, knappen av.
  await side.evaluate(() => window.__ko[1].onend());
  sjekk('ferdig: ingen linje lyser', await side.evaluate(() => ({
    lyser: [...document.querySelectorAll('.linje')].filter(p => p.classList.contains('leses')).length,
    knapp: document.getElementById('knapp-opplesing').classList.contains('paa'),
    status: document.getElementById('lese-status').textContent
  })), { lyser: 0, knapp: false, status: 'Nå kan du lese den selv.' });

  // Trykk to ganger: andre trykk skal stoppe, ikke la neste linje starte.
  await side.click('#knapp-opplesing');
  await side.click('#knapp-opplesing');
  sjekk('stopp midtveis slukker alt', await side.evaluate(() => ({
    lyser: [...document.querySelectorAll('.linje')].filter(p => p.classList.contains('leses')).length,
    knapp: document.getElementById('knapp-opplesing').classList.contains('paa')
  })), { lyser: 0, knapp: false });

  // Å forlate skjermen midt i opplesingen skal ikke la den løpe videre.
  await side.click('#knapp-opplesing');
  await side.click('#lesing [data-tilbake]');
  sjekk('tilbake stopper opplesingen',
    await side.evaluate(() => window.__ko.length), 0);

  console.log(konsollfeil.length ? 'KONSOLLFEIL: ' + konsollfeil.join(' | ') : 'ingen feil i konsollen');
  await nettleser.close();
  server.close();
  process.exit(feil || konsollfeil.length ? 1 : 0);
})();
