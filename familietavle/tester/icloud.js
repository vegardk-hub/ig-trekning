/*
 * Hele kjeden mot den simulerte iCloud-familien. Trenger playwright:
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node familietavle/tester/icloud.js
 *
 * Det de andre prøvene tar hver for seg, går her i ett: en lokal server
 * spiller iCloud og sender kalendrene slik Apple gjør (se
 * `simulert-icloud.js`), den ekte synk-jobben henter, beskjærer og krypterer,
 * og tavla dekrypterer og tegner i en nettleser. Det som står på skjermen,
 * sammenlignes med `forventet`.
 *
 * Feiler noe her og ikke i `data.js`, ligger feilen i overgangene – i
 * JSON-en mellom jobben og tavla, i fargene eller i hvordan tavla slår
 * sammen kalendrene.
 */
'use strict';

process.env.TZ = 'Europe/Oslo';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { chromium } = require('playwright');
const Sim = require('./simulert-icloud.js');
const Demo = require('../js/demo.js');

const APP = path.join(__dirname, '..');
const BILDER = process.env.BILDER || '';
const PASSFRASE = 'simulert familie med fire ord';

let feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + JSON.stringify(verdi) + ')' : ''));
}

const TYPER = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json'
};

function server(port, svar) {
  const s = http.createServer(svar);
  return new Promise(r => s.listen(port, () => r(s)));
}

(async () => {
  // iCloud
  const filer = {};
  Sim.kalendere().forEach(k => { filer['/published/2/' + k.navn.toLowerCase()] = k.fil; });
  const icloud = await server(8134, (q, r) => {
    const fil = filer[decodeURIComponent(q.url)];
    if (!fil) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8' });
    r.end(fil);
  });

  // Synk-jobben, slik Actions kjører den.
  console.log('synk-jobben mot simulert iCloud');
  const ut = path.join(os.tmpdir(), 'familietavle-icloud-' + process.pid + '.json');
  const liste = Sim.kalendere().map(k => k.navn + ': webcal://localhost:8134/published/2/' + k.navn.toLowerCase())
    .join('\n').replace(/webcal:/g, 'http:');
  const jobb = await new Promise(r => execFile(process.execPath, [path.join(APP, 'synk', 'synk.js'), ut], {
    env: Object.assign({}, process.env, {
      FAMILIETAVLE_KALENDERE: liste, FAMILIETAVLE_PASSFRASE: PASSFRASE,
      FAMILIETAVLE_NAA: Sim.NAA.toISOString()
    }), timeout: 90000
  }, (e, so) => r({ kode: e ? e.code : 0, ut: so })));
  krev(jobb.kode === 0 && fs.existsSync(ut), 'jobben går gjennom', jobb.ut);
  console.log(jobb.ut.split('\n').filter(l => /hendelser/.test(l)).map(l => '    ' + l).join('\n'));
  const datafil = fs.readFileSync(ut, 'utf8');
  fs.unlinkSync(ut);
  icloud.close();

  // Eierne har valgt bort middag og bursdager i første versjon. Dagen og uka
  // prøves derfor slik de faktisk skal se ut – uten sidekolonnen – og middag
  // og bursdager etterpå, med hele fila. Samme jobb, samme kryptering; bare
  // utvalget av kalendre er forskjellig.
  const Krypto = require('../js/krypto.js');
  const hel = JSON.parse(await Krypto.dekrypter(JSON.parse(datafil), PASSFRASE));
  const forste = Object.assign({}, hel, { kalendere: hel.kalendere.filter(k => k.rolle === 'person' || k.rolle === 'tomming') });
  const versjon1 = JSON.stringify(await Krypto.krypter(JSON.stringify(forste), PASSFRASE));
  let gjeldende = versjon1;

  // Tavla
  console.log('tavla med den simulerte familien');
  const app = await server(8135, (q, r) => {
    const sti = decodeURIComponent(q.url.split('?')[0]);
    const fil = path.join(APP, sti.endsWith('/') ? sti + 'index.html' : sti);
    if (!fil.startsWith(APP) || !fs.existsSync(fil)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPER[path.extname(fil)] || 'application/octet-stream' });
    fs.createReadStream(fil).pipe(r);
  });
  const nett = await chromium.launch();
  const ctx = await nett.newContext({ viewport: { width: 1333, height: 800 }, timezoneId: 'Europe/Oslo', locale: 'nb-NO' });
  const p = await ctx.newPage();
  await p.clock.install({ time: Sim.NAA });
  await p.route('https://api.met.no/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(Demo.vaer(Sim.NAA)) }));
  await p.route('https://raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'text/plain', body: gjeldende }));
  const skriptfeil = [];
  p.on('pageerror', e => skriptfeil.push(e.message));
  await p.goto('http://localhost:8135/');
  await p.evaluate(pf => localStorage.setItem('familietavle.passfrase', pf), PASSFRASE);
  await p.reload();
  await p.waitForSelector('#tavle:not([hidden])', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(500);
  krev(skriptfeil.length === 0, 'ingen skriptfeil', skriptfeil);

  const t = await p.evaluate(() => {
    const linje = l => {
      const k = l.querySelector('.kl').textContent, tittel = l.querySelector('span:last-child').textContent;
      return k === 'hele' ? tittel : tittel + ' ' + k;
    };
    const dager = [...document.querySelectorAll('#neste .dag')].map(d =>
      [...d.querySelectorAll('.linje, .hel')].map(l => l.classList.contains('hel') ? l.textContent : linje(l)));
    const felles = [...document.querySelectorAll('#neste .linje')].find(l => /Kari og Ørjan/.test(l.textContent));
    return {
      idag: Object.fromEntries([...document.querySelectorAll('#idag .personkol')].map(k => [
        k.querySelector('h3').textContent,
        [...k.querySelectorAll('.avtale')].map(li => li.querySelector('.kl').textContent + ' ' + li.querySelector('.hva').textContent)
      ])),
      tomming: document.getElementById('tomming').textContent,
      flere: document.querySelector('#idag .flere') && document.querySelector('#idag .flere').textContent,
      dager,
      felles: felles ? getComputedStyle(felles).borderImageSource : '',
      side: document.getElementById('side').hidden,
      personer: [...document.querySelectorAll('#personer .person')].map(e => e.textContent + ' ' + e.style.getPropertyValue('--farge'))
    };
  });

  const F = Sim.forventet;
  krev(JSON.stringify(t.idag) === JSON.stringify(F.idag), 'i dag, per person', t.idag);
  krev(t.tomming === F.tomming, 'søppel: to dunker samme fredag', t.tomming);
  krev(!t.flere, 'ingenting kappet bort i dag-kortet', t.flere);
  krev(t.dager[0].join(' | ') === F.imorgen.join(' | '), 'i morgen: nattevakta slutter, yoga og tannlege er borte', t.dager[0]);
  krev(t.dager[1].join(' | ') === F.fredag16.join(' | '), 'fredag: felles middag én gang', t.dager[1]);
  krev(/255, 41, 104.*27, 173, 248|#ff2968.*#1badf8/i.test(t.felles), 'felles avtale har Mammas og Pappas farge', t.felles);
  krev(t.dager[4].join(' | ') === F.mandag19.join(' | '), 'mandag: korpset er flyttet bort', t.dager[4]);
  krev(t.dager[5].join(' | ') === F.tirsdag20.join(' | '), 'tirsdag: det flyttede korpset', t.dager[5]);
  krev(t.side === true, 'versjon 1: ingen sidekolonne', t.side);
  krev(t.personer.join() === 'Mamma #ff2968,Pappa #1badf8,Ella #63da38,Theo #cc73e1', 'fargene fra iPhone', t.personer);

  if (BILDER) await p.screenshot({ path: path.join(BILDER, 'tavle-icloud.png') });

  console.log('med middag og bursdager');
  {
    gjeldende = datafil;
    await p.reload();
    await p.waitForTimeout(1500);
    const m = await p.evaluate(() => ({
      side: document.getElementById('side').hidden,
      middag: [...document.querySelectorAll('#middag .hva')].map(e => e.textContent),
      bursdager: [...document.querySelectorAll('#bursdager .hva')].map(e => e.textContent),
      idag: [...document.querySelectorAll('#idag .avtale')].length,
      flere: !!document.querySelector('#idag .flere'),
      // Et ord som brekkes midt i, gir en linje som begynner med en bokstavrest.
      // Mål det: «Foreldremøte» skal stå på én linje.
      ordbrudd: (() => {
        const h = [...document.querySelectorAll('#idag .hva')].find(e => /Foreldremøte/.test(e.textContent));
        if (!h) return 'mangler';
        const r = document.createRange(); r.setStart(h.firstChild, 0); r.setEnd(h.firstChild, 'Foreldremøte'.length);
        return r.getClientRects().length;
      })()
    }));
    krev(m.side === false, 'sidekolonnen kommer når kalendrene finnes');
    krev(m.middag.join() === F.middag.join(), 'middagene, med hull på fredag', m.middag);
    krev(m.bursdager.slice(0, 3).join() === F.bursdager.join(), 'bursdagene med alder', m.bursdager);
    krev(m.idag === 5 && !m.flere, 'dagen får fortsatt plass med sidekolonnen', m);
    krev(m.ordbrudd === 1, '«Foreldremøte» brekkes ikke midt i ordet i en smal kolonne', m.ordbrudd);
    if (BILDER) await p.screenshot({ path: path.join(BILDER, 'tavle-icloud-full.png') });
  }

  // To personer med samme standardfarge får hver sin.
  console.log('lik farge på to kalendre');
  {
    const k = Sim.kalendere();
    const lik = k.map(c => ({ navn: c.navn, fil: Buffer.from(c.fil.toString('latin1').replace(/#63DA38FF/, '#FF2968FF'), 'latin1') }));
    const Kalender = require('../js/kalender.js');
    const { limSammen } = require('../synk/synk.js');
    const Krypto = require('../js/krypto.js');
    const pakke = {
      v: 1, hentet: Sim.NAA.toISOString(), vaer: null,
      kalendere: lik.map(c => ({ navn: c.navn, rolle: c.navn === 'Middag' ? 'middag' : c.navn === 'Bursdager' ? 'bursdager' : c.navn === 'Søppel' ? 'tomming' : 'person',
        ics: Kalender.beskjaer(limSammen(c.fil), new Date(2026, 9, 13)) }))
    };
    const fil2 = JSON.stringify(await Krypto.krypter(JSON.stringify(pakke), PASSFRASE));
    await p.unroute('https://raw.githubusercontent.com/**');
    await p.route('https://raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'text/plain', body: fil2 }));
    await p.reload();
    await p.waitForTimeout(1500);
    const farger = await p.evaluate(() => [...document.querySelectorAll('#personer .person')].map(e => e.style.getPropertyValue('--farge')));
    krev(new Set(farger).size === farger.length && farger[0] === '#ff2968', 'ingen to personer med samme farge', farger);
  }

  await nett.close();
  app.close();
  console.log((feil ? feil + ' av ' : 'Alle ') + gjort + ' krav ' + (feil ? 'FEILET' : 'holdt'));
  process.exit(feil ? 1 : 0);
})();
