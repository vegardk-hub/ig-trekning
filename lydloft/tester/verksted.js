/*
 * Prøver for verkstedet i en ekte nettleser.
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node lydloft/tester/verksted.js
 *
 * Det som prøves, er den *lagrede* lyden, ikke glidebryterne. Lydfila har
 * tre toner med like nivå — 100 Hz, 1 kHz og 8 kHz — og hver innstilling må
 * flytte dem dit den sier: bass løfter 100 Hz, telefon kutter begge ender,
 * sakte film gjør stykket lengre uten å endre 1 kHz, ekorn flytter 1 kHz opp
 * sju halvtoner. En glidebryter som ser riktig ut og ikke gjør noe, ryker her.
 *
 * Ingen mikrofon trengs: lyden lastes opp som fil.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8742);
const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function server() {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const fil = path.join(ROT, path.normalize(p));
    if (!fil.startsWith(ROT)) { res.writeHead(403).end(); return; }
    fs.readFile(fil, (feil, data) => {
      if (feil) { res.writeHead(404).end('finnes ikke'); return; }
      res.writeHead(200, { 'Content-Type': TYPER[path.extname(fil)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise(ok => s.listen(PORT, '127.0.0.1', () => ok(s)));
}

let feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + JSON.stringify(verdi) + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }

const LydDsp = new Function(fs.readFileSync(path.join(ROT, 'lydloft', 'js', 'dsp.js'), 'utf8') + '; return LydDsp;')();

function treToner() {
  const fs_ = 48000, n = fs_ * 4, x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / fs_;
    const kant = Math.min(1, t / 0.05, (4 - t) / 0.05);
    x[i] = kant * 0.15 * (Math.sin(2 * Math.PI * 100 * t) + Math.sin(2 * Math.PI * 1000 * t) + Math.sin(2 * Math.PI * 8000 * t));
  }
  return Buffer.from(LydDsp.lagWav([x], fs_));
}

// Lager versjonen og måler tonene i den, relativt til 1 kHz.
async function maal(side) {
  return side.evaluate(async () => {
    const r = await LydVerksted.render();
    const k = r.kanaler[0], fs = r.fs;
    const fra = Math.round(0.5 * fs), til = Math.round(1.5 * fs);
    const niva = f => 20 * Math.log10(LydDsp.tonenivaa(k, fs, f, fra, til) + 1e-12);
    const ref = niva(1000);
    let topp = 0;
    r.kanaler.forEach(c => { for (let i = 0; i < c.length; i++) topp = Math.max(topp, Math.abs(c[i])); });
    // Lengden der det fortsatt er lyd (over −60 dBFS), uten halen av stillhet.
    let slutt = k.length - 1;
    while (slutt > 0 && Math.abs(k[slutt]) < 0.001) slutt--;
    return {
      lav: niva(100) - ref, hoy: niva(8000) - ref, ref,
      kHz1498: niva(1498.3) - ref, kHz1000: ref,
      lengde: k.length / fs, lydLengde: slutt / fs,
      lufs: LydDsp.lufs(r.kanaler, fs), topp: 20 * Math.log10(topp),
      nan: r.kanaler.some(c => c.some(v => !isFinite(v)))
    };
  });
}

async function settGlider(side, navn, verdi) {
  await side.evaluate(([n, v]) => {
    const inp = document.getElementById('g-' + n);
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, [navn, verdi]);
}

async function ventPaaLyd(side) {
  await side.waitForFunction(() => document.getElementById('strekkstatus').textContent === '', null, { timeout: 30000 });
  await side.waitForTimeout(400);
}

(async () => {
  const s = await server();
  const nett = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const side = await nett.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const konsoll = [];
  side.on('pageerror', e => konsoll.push('pageerror: ' + e.message));
  side.on('console', m => { if (m.type() === 'error') konsoll.push(m.text()); });
  await side.goto(`http://127.0.0.1:${PORT}/lydloft/`);

  try {
    bolk('Oppstart og opplasting');
    krev(await side.locator('#verksted').isHidden(), 'verkstedet er skjult til en lyd er valgt');
    await side.setInputFiles('#fil', { name: 'tre-toner.wav', mimeType: 'audio/wav', buffer: treToner() });
    await side.waitForSelector('#verksted:not([hidden])', { timeout: 30000 });
    await ventPaaLyd(side);
    krev((await side.textContent('#lyder .lydflis[aria-pressed="true"]')).includes('tre-toner'), 'fila skal ligge i Mine lyder og være valgt');
    krev(await side.locator('#spiller').isVisible(), 'spillerlinja skal komme fram når en lyd er valgt');
    krev(await side.locator('#egne').isHidden(), 'egne innstillinger er lukket til de bes om');
    const fliser = await side.$$eval('#karakterer .flis', bs => bs.map(b => ({ svg: !!b.querySelector('svg'), tekst: b.textContent })));
    krev(fliser.length === 14 && fliser.every(f => f.svg && f.tekst.length > 1), 'hver karakter har bilde og navn', fliser.length);
    krev(await side.$$eval('#fart .flis', bs => bs.length) === 6, 'fem farter og baklengs');
    await side.screenshot({ path: path.join(require('os').tmpdir(), 'lydloft-forside.png'), fullPage: true });
    await side.click('#egneKnapp');
    krev(await side.locator('#g-bass').isVisible(), 'knappen skal vise glidebryterne');
    krev(await side.getAttribute('#egneKnapp', 'aria-expanded') === 'true', 'og si at panelet er åpent');
    krev((await side.$eval('#versjonsnavn', e => e.value)) === 'tre-toner – kopi', 'navnet foreslås fra kilden', await side.$eval('#versjonsnavn', e => e.value));
    const bredde = await side.evaluate(() => document.documentElement.scrollWidth);
    krev(bredde <= 390, 'ingen vannrett rulling på en telefon', bredde);

    bolk('Uten endringer');
    const null_ = await maal(side);
    krev(Math.abs(null_.lav) < 1 && Math.abs(null_.hoy) < 1, 'tonene skal stå likt når ingenting er skrudd', [null_.lav, null_.hoy]);
    krev(Math.abs(null_.lydLengde - 4) < 0.1, 'lengden skal stå', null_.lydLengde);
    krev(Math.abs(null_.lufs + 14) < 0.3 || null_.topp > -1.2, 'versjonen skal ligge på −14 LUFS eller stoppes av toppen', [null_.lufs, null_.topp]);
    krev(null_.topp <= -0.9, 'toppen skal aldri over −1 dB', null_.topp);

    bolk('Tone');
    await settGlider(side, 'bass', 12);
    const bass = await maal(side);
    krev(bass.lav > 7, '+12 dB bass skal løfte 100 Hz kraftig', bass.lav);
    krev(Math.abs(bass.hoy) < 1, 'og la diskanten være', bass.hoy);
    await settGlider(side, 'bass', 0);
    await settGlider(side, 'diskant', -12);
    const disk = await maal(side);
    krev(disk.hoy < -9, '−12 dB diskant skal senke 8 kHz', disk.hoy);
    krev((await side.$eval('#versjonsnavn', e => e.value)).includes('egen miks'), 'en egen innstilling gir et eget navn');

    bolk('Karakterer');
    await side.click('.valgbrikke[data-id="telefon"]');
    const tlf = await maal(side);
    krev(tlf.lav < -25 && tlf.hoy < -20, 'telefon skal kutte både bass og diskant', [tlf.lav, tlf.hoy]);
    krev(await side.$eval('.valgbrikke[data-id="telefon"]', e => e.getAttribute('aria-pressed')) === 'true', 'den valgte karakteren skal vises som valgt');
    krev((await side.$eval('#g-diskant', e => e.value)) === '0', 'en karakter starter fra null – diskanten fra før skal bort');
    krev((await side.$eval('#versjonsnavn', e => e.value)) === 'tre-toner – Telefon', 'navnet følger karakteren', await side.$eval('#versjonsnavn', e => e.value));
    const alle = await side.$$eval('#karakterer .valgbrikke', bs => bs.map(b => b.dataset.id));
    for (const id of alle) {
      await side.click(`.valgbrikke[data-id="${id}"]`);
      const m = await maal(side);
      krev(!m.nan && m.topp <= -0.9 && isFinite(m.lufs), 'karakteren ' + id + ' skal gi gyldig lyd uten klipping', [m.topp, m.lufs]);
    }
    await side.click('.valgbrikke[data-id="ingen"]');

    bolk('Tempo og tonehøyde');
    await side.click('.valgbrikke[data-id="sakte"]');
    await ventPaaLyd(side);
    const sakte = await maal(side);
    krev(Math.abs(sakte.lydLengde - 4 / 0.6) < 0.15, 'sakte film (60 %) skal gjøre 4 s til 6,7 s', sakte.lydLengde);
    krev(Math.abs(sakte.lav) < 1.5 && Math.abs(sakte.hoy) < 1.5, 'uten at tonene flytter seg', [sakte.lav, sakte.hoy]);
    await side.click('.valgbrikke[data-id="ekorn"]');
    await ventPaaLyd(side);
    const ekorn = await maal(side);
    krev(Math.abs(ekorn.lydLengde - 4 / 1.15) < 0.15, 'ekorn (115 %) skal korte ned lengden', ekorn.lydLengde);
    krev(ekorn.kHz1498 > 10, 'sju halvtoner opp skal flytte 1 kHz til 1,5 kHz', ekorn.kHz1498);
    await side.click('.valgbrikke[data-id="normal"]');
    await ventPaaLyd(side);
    await side.click('#baklengs');
    krev(await side.getAttribute('#baklengs', 'aria-pressed') === 'true', 'baklengs-flisen skal lyse når den er på');
    await ventPaaLyd(side);
    const bak = await maal(side);
    krev(Math.abs(bak.lydLengde - 4) < 0.1 && !bak.nan, 'baklengs skal gi samme lengde', bak.lydLengde);
    await side.click('#baklengs');
    await ventPaaLyd(side);

    bolk('Avspilling');
    await side.click('#spill');
    await side.waitForTimeout(700);
    krev((await side.textContent('#spill')).includes('Pause'), 'spill-knappen skal bli til pause');
    const pos = await side.$eval('#posisjon', e => Number(e.value));
    krev(pos > 0, 'posisjonen skal gå framover mens det spiller', pos);
    await settGlider(side, 'romklang', 0.6);
    await side.click('#for');
    await side.waitForTimeout(300);
    krev(await side.getAttribute('#for', 'aria-pressed') === 'true' && await side.getAttribute('#etter', 'aria-pressed') === 'false', 'Før skal bytte til originalen');
    krev((await side.textContent('#spill')).includes('Pause'), 'og lyden skal fortsette');
    await side.click('#etter');
    await side.click('#spill');
    krev((await side.textContent('#spill')).includes('Spill'), 'pause skal stoppe');

    // iOS: en annen app tar lyden, og konteksten blir stående. Her lukkes den
    // helt — det strengeste tilfellet — og et nytt trykk må bygge kjeden og
    // bufferne på nytt i en frisk kontekst og spille.
    await side.evaluate(() => LydOpptak.lydkontekst().suspend());
    await side.click('#spill');
    await side.waitForTimeout(600);
    krev(await side.evaluate(() => LydOpptak.lydkontekst().state) === 'running', 'en stoppet kontekst skal vekkes av spill');
    await side.click('#spill');
    await side.evaluate(() => LydOpptak.lydkontekst().close());
    await side.click('#spill');
    await side.waitForTimeout(800);
    const etter = await side.evaluate(() => ({ state: LydOpptak.lydkontekst().state }));
    krev(etter.state === 'running', 'en lukket kontekst skal erstattes av en ny', etter);
    const p0 = await side.$eval('#posisjon', e => Number(e.value));
    await side.waitForTimeout(600);
    krev(await side.$eval('#posisjon', e => Number(e.value)) !== p0, 'og lyden skal gå i den nye');
    krev(!(await side.textContent('#strekkstatus')).includes('iOS'), 'uten melding om at iOS holder lyden');
    await side.click('#spill');

    bolk('Lagre');
    await side.click('.valgbrikke[data-id="kirke"]');
    await side.click('#lagre');
    await side.waitForFunction(() => /Mine lyder/.test(document.getElementById('lagrestatus').textContent), null, { timeout: 30000 });
    const lagret = await side.evaluate(async () => (await LydLager.alle())[0]);
    krev(lagret.kilde === 'versjon' && lagret.navn === 'tre-toner – Kirke', 'versjonen skal ligge i biblioteket med navnet', [lagret.kilde, lagret.navn]);
    krev(lagret.info.oppskrift && lagret.info.oppskrift.romklang === 0.85, 'oppskriften skal lagres med', lagret.info.oppskrift);
    krev(lagret.varighet > 4 + 3, 'kirka skal ringe ut etter at lyden er ferdig', lagret.varighet);
    krev(lagret.analyse && lagret.analyse.grunn && Math.abs(lagret.analyse.grunn.lufs + 14) < 0.5, 'og være målt til −14 LUFS', lagret.analyse && lagret.analyse.grunn && lagret.analyse.grunn.lufs);
    const valg = await side.$$eval('#lyder .lydflis', os => os.map(o => o.textContent));
    krev(valg.some(t => /Kirke.*ny versjon/.test(t)), 'og vises i Mine lyder', valg);
    krev(await side.locator('#toast').isVisible(), 'en melding skal si at den er lagret');
    await side.screenshot({ path: path.join(require('os').tmpdir(), 'lydloft-verksted.png'), fullPage: true });

    bolk('Testbenken tåler versjonene');
    await side.goto(`http://127.0.0.1:${PORT}/lydloft/testbenk.html`);
    await side.waitForSelector('#liste li');
    krev((await side.locator('#liste li').first().innerText()).includes('Ny versjon fra verkstedet'), 'testbenken viser versjonen med riktig navn på kilden');

    bolk('Konsollen');
    krev(konsoll.length === 0, 'ingen feil i konsollen', konsoll);
  } finally {
    await nett.close();
    s.close();
  }
  console.log('\n' + (gjort - feil) + ' av ' + gjort + ' krav holdt.');
  process.exit(feil ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
