/*
 * Prøver innspillingen av forelderens stemme.
 *
 * Selve opptaket er stubbet. Skyøkta har ingen lydinngang i det hele tatt, og
 * Chromiums `--use-fake-device-for-media-capture` hjelper ikke — getUserMedia
 * svarer NotFoundError uansett flaggkombinasjon. Det er heller ikke det som
 * er verdt å prøve her: hvordan MediaRecorder oppfører seg i Safari, kan
 * ingen prøve på Linux svare på.
 *
 * Det prøven svarer for, er alt som faktisk er skrevet i denne appen:
 * tilstandene i opptaksskjermen, at opptaket havner i IndexedDB og overlever
 * omlasting, at tellingen i lista stemmer, og — det viktigste — at
 * høyttaleren spiller opptaket på linjene som er lest inn og lar
 * maskinstemmen ta resten.
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
  await new Promise(r => server.listen(8127, r));
  const nettleser = await chromium.launch();
  const kontekst = await nettleser.newContext({ permissions: ['microphone'] });
  const side = await kontekst.newPage();
  const konsollfeil = [];
  side.on('pageerror', e => konsollfeil.push(e.message));

  // Falsk talesyntese, så vi kan se hva maskinstemmen faktisk blir bedt om å
  // lese – og dermed at den IKKE blir bedt om linja vi har spilt inn.
  await side.addInitScript(() => {
    window.__sagt = [];
    window.__spilt = 0;

    // Falsk mikrofon og opptaker. Strømmen må ha getTracks(), for appen
    // slipper mikrofonen igjen når opptaket er ferdig.
    window.__slapptMikrofon = 0;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () => Promise.resolve({
        getTracks: () => [{ stop: () => { window.__slapptMikrofon++; } }]
      })
    });
    window.MediaRecorder = function () {
      this.state = 'inactive';
      this.mimeType = 'audio/webm';
    };
    window.MediaRecorder.prototype.start = function () { this.state = 'recording'; };
    window.MediaRecorder.prototype.stop = function () {
      this.state = 'inactive';
      if (this.ondataavailable) this.ondataavailable({ data: new Blob(['lyd'], { type: 'audio/webm' }) });
      if (this.onstop) this.onstop();
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ name: 'Nora', lang: 'nb-NO', voiceURI: 'nora', localService: true }],
        addEventListener: () => {},
        speak: y => { window.__sagt.push(y.text); setTimeout(() => y.onend && y.onend(), 10); },
        cancel: () => {}
      }
    });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    // Tell avspilte opptak, og la dem "ta slutt" med en gang.
    const ekte = window.Audio;
    window.Audio = function () {
      const a = new ekte();
      const p = a.play.bind(a);
      a.play = function () { window.__spilt++; setTimeout(() => a.onended && a.onended(), 10); return Promise.resolve(); };
      return a;
    };
  });

  await side.goto('http://localhost:8127/', { waitUntil: 'networkidle' });

  await side.click('#knapp-innstillinger');
  sjekk('innspilling tilbys', await side.isVisible('#knapp-innspilling'), true);
  await side.click('#knapp-innspilling');
  await side.waitForSelector('#innspilling:not([hidden])');

  sjekk('lista starter uten opptak',
    await side.textContent('#innspilling-liste .liste-rad .status-merke'), '0/2');

  await side.click('#innspilling-liste .liste-rad');
  await side.waitForSelector('#opptak:not([hidden])');
  sjekk('to linjer å lese inn', await side.$$eval('.opptak-linje', n => n.length), 2);

  // Spill inn den FØRSTE linja, og bare den.
  await side.click('.opptak-linje:nth-child(1) [data-ta="0"]');
  await side.waitForSelector('[data-stopp="0"]');
  await side.waitForTimeout(700);
  await side.click('[data-stopp="0"]');
  await side.waitForSelector('[data-hor="0"]', { timeout: 5000 });

  sjekk('linje 1 har opptak, linje 2 ikke', await side.evaluate(() => ({
    en: !!document.querySelector('[data-hor="0"]'),
    to: !!document.querySelector('[data-hor="1"]'),
    spillInnIgjen: !!document.querySelector('[data-ta="1"]')
  })), { en: true, to: false, spillInnIgjen: true });

  // Mikrofonen må slippes når opptaket er ferdig, ellers blir opptaksmerket
  // stående i statuslinja så lenge siden er åpen.
  sjekk('mikrofonen slippes etterpå',
    await side.evaluate(() => window.__slapptMikrofon), 1);

  // Tilbake til lista: tallet skal ha oppdatert seg.
  await side.click('#opptak [data-tilbake]');
  await side.waitForSelector('#innspilling:not([hidden])');
  sjekk('lista teller opptaket',
    await side.textContent('#innspilling-liste .liste-rad .status-merke'), '1/2');

  // Overlever omlasting? IndexedDB, ikke minne.
  await side.reload({ waitUntil: 'networkidle' });
  await side.click('#knapp-innstillinger');
  await side.click('#knapp-innspilling');
  await side.waitForSelector('#innspilling:not([hidden])');
  sjekk('opptaket overlever omlasting',
    await side.textContent('#innspilling-liste .liste-rad .status-merke'), '1/2');

  // Det som er hele poenget: høyttaleren skal spille opptaket på linje 1 og
  // la maskinstemmen ta linje 2.
  await side.click('#innspilling [data-tilbake]');
  await side.waitForSelector('#garasje:not([hidden])');
  await side.click('#knapp-les');
  await side.waitForSelector('#lesing:not([hidden])');
  await side.waitForTimeout(300);
  await side.click('#knapp-opplesing');
  await side.waitForTimeout(600);

  sjekk('opptak på linje 1, maskinstemme på linje 2', await side.evaluate(() => ({
    spilteOpptak: window.__spilt,
    maskinLeste: window.__sagt.filter(t => t && t.trim())
  })), { spilteOpptak: 1, maskinLeste: ['Motoren våkner med et brøl.'] });

  console.log(konsollfeil.length ? 'KONSOLLFEIL: ' + konsollfeil.join(' | ') : 'ingen feil i konsollen');
  await nettleser.close();
  server.close();
  process.exit(feil || konsollfeil.length ? 1 : 0);
})();
