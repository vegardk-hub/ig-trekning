/*
 * Prøver for testbenken i en ekte nettleser.
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node lydloft/tester/benk.js
 *
 * **Mikrofonen er stubbet, og det skal den være.** Skyøkta har ingen
 * lydinngang, og `--use-fake-device-for-media-capture` hjelper ikke — samme
 * lærdom som i Monstergiret og Koordinatjakt. Stubben gir i stedet en ekte
 * MediaStream fra en egen lydkontekst, så alt etter `getUserMedia` er den
 * virkelige veien: AudioWorklet-opptakeren, MediaRecorder, dekodingen,
 * analysetråden, IndexedDB og tegningen.
 *
 * Det som *ikke* kan prøves her, er hva en iPhone gjør med lyden. Det er
 * nettopp det testbenken finnes for å måle.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8741);
const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function server() {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const fil = path.join(ROT, path.normalize(p));
    if (!fil.startsWith(ROT)) { res.writeHead(403).end(); return; }
    fs.readFile(fil, (feil, data) => {
      if (feil) { res.writeHead(404).end('finnes ikke'); return; }
      res.writeHead(200, {
        'Content-Type': TYPER[path.extname(fil)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
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

// Modulene i Node, for å lage en «telefonfil» med kjent fasit.
function last(navn, globalt, argnavn, argverdier) {
  const kode = fs.readFileSync(path.join(ROT, 'lydloft', 'js', navn + '.js'), 'utf8');
  return new Function(argnavn || '', kode + '; return ' + globalt + ';').apply(null, argverdier || []);
}
const LydDsp = last('dsp', 'LydDsp');
const LydTestsignal = last('testsignal', 'LydTestsignal', 'LydDsp', [LydDsp]);

function telefonfil() {
  const fs_ = 44100;
  let x = Float64Array.from(LydTestsignal.lagSekvens(fs_));
  for (let i = 0; i < 2; i++) x = LydDsp.filtrer(LydDsp.biquad('hoypass', fs_, 200, 0.7071), x);
  for (let i = 0; i < 2; i++) x = LydDsp.filtrer(LydDsp.biquad('lavpass', fs_, 12000, 0.7071), x);
  const ut = new Float32Array(x.length + fs_);
  for (let i = 0; i < x.length; i++) ut[i + Math.round(0.4 * fs_)] = x[i] * 0.5;
  let s = 99;
  for (let i = 0; i < ut.length; i++) { s = (s * 16807) % 2147483647; ut[i] += (s / 2147483647 - 0.5) * 0.0006; }
  return Buffer.from(LydDsp.lagWav([ut], fs_));
}

// Mikrofonen: en ekte strøm fra en egen lydkontekst.
function stubb() {
  window.__mik = { kilde: 'tone', begrensninger: [] };
  navigator.mediaDevices.getUserMedia = async function (c) {
    window.__mik.begrensninger.push(c);
    const ctx = new AudioContext();
    await ctx.resume();
    const mal = ctx.createMediaStreamDestination();
    if (window.__mik.kilde === 'test') {
      const x = LydTestsignal.lagSekvens(ctx.sampleRate);
      const buf = ctx.createBuffer(1, x.length, ctx.sampleRate);
      buf.getChannelData(0).set(x);
      const k = ctx.createBufferSource();
      k.buffer = buf;
      k.connect(mal);
      k.start(ctx.currentTime + 0.3);
    } else {
      const o = ctx.createOscillator();
      o.frequency.value = 1000;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      o.connect(g); g.connect(mal);
      o.start();
    }
    return mal.stream;
  };
}

async function antallOpptak(side) { return side.locator('#liste li').count(); }

async function ventPaaNytt(side, for_, ms) {
  await side.waitForFunction(n => document.querySelectorAll('#liste li').length > n, for_, { timeout: ms || 30000 });
}

(async () => {
  const s = await server();
  const nett = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const side = await nett.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const konsoll = [];
  side.on('pageerror', e => konsoll.push('pageerror: ' + e.message));
  side.on('console', m => { if (m.type() === 'error') konsoll.push(m.text()); });
  await side.addInitScript(stubb);
  await side.goto(`http://127.0.0.1:${PORT}/lydloft/`);

  try {
    bolk('Oppstart');
    krev(await side.locator('#tomt').isVisible(), 'en tom benk sier at det ikke finnes opptak');
    krev(await side.locator('#ikkeStotte').isHidden(), 'localhost regnes som trygt, så mikrofonen er tilgjengelig');
    const bredde = await side.evaluate(() => document.documentElement.scrollWidth);
    krev(bredde <= 390, 'ingen vannrett rulling på en telefon', bredde);

    bolk('Rått opptak');
    await side.click('#opptak');
    await side.waitForSelector('#opptak.aktiv');
    await side.waitForTimeout(2500);
    const maaler = await side.$eval('#maalerfyll', e => parseFloat(e.style.width));
    krev(maaler > 50, 'nivåmåleren skal stå høyt for en tone på −12 dBFS', maaler);
    await side.click('#opptak');
    await ventPaaNytt(side, 0);
    const beg = await side.evaluate(() => window.__mik.begrensninger[0].audio);
    krev(beg.echoCancellation === false && beg.noiseSuppression === false && beg.autoGainControl === false,
      'nettleserens lydbehandling skal be om å slås av', beg);
    const raa = await side.evaluate(async () => {
      const l = await LydLager.alle();
      const m = l[0];
      const lyd = await LydLager.hentLyd(m.id);
      const k = lyd.kanaler[0];
      return {
        kilde: m.kilde, fs: m.fs, sek: k.length / m.fs,
        tone: LydDsp.tonenivaa(k, m.fs, 1000, m.fs * 0.5, m.fs * 1.5),
        lufs: m.analyse.grunn.lufs, test: m.analyse.test
      };
    });
    krev(raa.kilde === 'raa', 'opptaket skal være merket rå', raa.kilde);
    krev(raa.sek > 2 && raa.sek < 3.5, 'opptaket skal vare rundt 2,5 sekunder', raa.sek);
    krev(Math.abs(raa.tone - 0.25) < 0.02, 'tonen skal komme gjennom med samme nivå (0,25)', raa.tone);
    krev(raa.test === null, 'en tone er ikke testsignalet');
    krev(await side.locator('#detalj').isVisible(), 'detaljene skal vises etter opptaket');
    krev((await side.locator('#detalj .tall').innerText()).includes('LUFS'), 'detaljene viser lydstyrken');

    bolk('MediaRecorder');
    await side.selectOption('#kilde', 'media-beste');
    let n = await antallOpptak(side);
    await side.click('#opptak');
    await side.waitForSelector('#opptak.aktiv');
    await side.waitForTimeout(2200);
    await side.click('#opptak');
    await ventPaaNytt(side, n);
    const media = await side.evaluate(async () => {
      const m = (await LydLager.alle())[0];
      const lyd = await LydLager.hentLyd(m.id);
      return { kilde: m.kilde, format: m.info.format, dekodet: m.info.dekodet, sek: m.varighet,
               harOriginal: !!lyd.original,
               tone: LydDsp.tonenivaa(lyd.kanaler[0], m.fs, 1000, m.fs * 0.5, m.fs * 1.5) };
    });
    console.log('  format: ' + media.format + ', dekodet med ' + media.dekodet);
    krev(media.kilde === 'media-beste', 'opptaket skal være merket MediaRecorder', media.kilde);
    krev(media.harOriginal, 'originalfila skal tas vare på');
    krev(media.sek > 1.5, 'og dekodes til lyd', media.sek);
    krev(Math.abs(media.tone - 0.25) < 0.04, 'tonen skal overleve kodingen', media.tone);
    krev(await side.locator('#detalj button', { hasText: 'Last ned original' }).count() === 1,
      'et MediaRecorder-opptak har en original å laste ned');

    bolk('Opplastet fil fra en «telefon» med kjent fasit');
    n = await antallOpptak(side);
    await side.setInputFiles('#fil', { name: 'telefon.wav', mimeType: 'audio/wav', buffer: telefonfil() });
    await ventPaaNytt(side, n);
    const fil = await side.evaluate(async () => (await LydLager.alle())[0]);
    krev(fil.kilde === 'fil' && fil.fs === 44100, 'WAV leses i sin egen rate, ikke kontekstens', fil.fs);
    krev(fil.analyse.test, 'testsignalet skal finnes i fila');
    if (fil.analyse.test) {
      const t = fil.analyse.test;
      krev(t.nedreGrense > 150 && t.nedreGrense < 175, 'lavkuttet på 200 Hz skal måles', t.nedreGrense);
      krev(t.ovreGrense > 12500 && t.ovreGrense < 15000, 'diskantkuttet på 12 kHz skal måles', t.ovreGrense);
      krev(!t.kompresjon.finnes && !t.rosa.dempes, 'en lineær kjede er lineær');
    }
    krev(!fil.analyse.funn.some(f => /kodek/.test(f.tekst)), 'slutten av sveipet skal ikke tas for en kodek',
      fil.analyse.funn.map(f => f.tekst));
    krev(await side.locator('#detalj canvas').count() === 4, 'bølge, respons, trapp og spektrum skal tegnes',
      await side.locator('#detalj canvas').count());
    const rapport = await side.$eval('#detalj textarea.rapport', e => e.value);
    krev(/Testsignal: nedre 1\d\d Hz/.test(rapport), 'rapporten skal ha grensene i klartekst', rapport.split('\n').find(l => /Testsignal/.test(l)));
    await side.screenshot({ path: path.join(require('os').tmpdir(), 'lydloft-detalj.png'), fullPage: true });

    bolk('Sammenligning');
    const bokser = side.locator('#liste li input[type=checkbox]');
    await bokser.nth(0).check();
    krev(await side.locator('#sammenlign').isDisabled(), 'ett valgt opptak er ikke nok til å sammenligne');
    await bokser.nth(2).check();
    await side.click('#sammenlign');
    await side.waitForSelector('#sammenligning:not([hidden]) table');
    const kolonner = await side.locator('#sammenligning thead th').count();
    krev(kolonner === 3, 'tabellen skal ha en kolonne per opptak pluss etiketter', kolonner);
    krev((await side.locator('#sammenligning').innerText()).includes('lik lydstyrke'), 'A/B-avspillingen er på lik lydstyrke');

    bolk('Spill testsignal og ta opp her');
    await side.selectOption('#kilde', 'raa');
    await side.evaluate(() => { window.__mik.kilde = 'test'; });
    n = await antallOpptak(side);
    await side.click('#testHer');
    await ventPaaNytt(side, n, 60000);
    const her = await side.evaluate(async () => (await LydLager.alle())[0]);
    krev(her.varighet > 29 && her.varighet < 34, 'opptaket skal stoppe av seg selv like etter signalet', her.varighet);
    krev(her.analyse.test, 'testsignalet skal finnes i et opptak fra nettleseren');
    if (her.analyse.test) {
      const t = her.analyse.test;
      krev(t.nedreGrense === null || t.nedreGrense < 30, 'en tapsfri kjede holder helt ned', t.nedreGrense);
      krev(t.ovreGrense === null || t.ovreGrense > 18000, 'og helt opp', t.ovreGrense);
      krev(Math.abs(t.frekvens1k - 1000) < 0.5, '1 kHz er 1 kHz', t.frekvens1k);
      krev(!t.kompresjon.finnes && !t.rosa.dempes, 'ingen behandling i en stubbet strøm');
    }
    await side.screenshot({ path: path.join(require('os').tmpdir(), 'lydloft-liste.png'), fullPage: false });

    bolk('Konsollen');
    krev(konsoll.length === 0, 'ingen feil i konsollen', konsoll);
  } finally {
    await nett.close();
    s.close();
  }

  console.log('\n' + (gjort - feil) + ' av ' + gjort + ' krav holdt.');
  process.exit(feil ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
