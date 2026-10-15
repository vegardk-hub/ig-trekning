/*
 * Prøver for selve tavla i en nettleser. Trenger playwright:
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node familietavle/tester/tavle.js
 *
 * Starter en statisk server selv. Været fra api.met.no og datafila fra
 * raw.githubusercontent.com fanges opp og besvares lokalt – skyøkta når ingen
 * av dem, og en prøve som avhenger av dagens vær, sier ingenting.
 *
 * Det som måles:
 * - Ingenting stikker ut av skjermen på nettbrettet (10,6", liggende), og
 *   heller ikke på en mindre og en større skjerm. Tavla skal leses på avstand
 *   uten at noen ruller.
 * - Dagens avtaler står i riktig kolonne, og søppel i bunnlinja.
 * - Ukeplanen gir skolehendelser i barnets kolonne og en leksefane der
 *   avkrysningen huskes og fanen lukker seg selv.
 * - En kryptert datafil åpnes med riktig passfrase, og feil passfrase gir en
 *   melding i stedet for en tom tavle.
 * - Om natta dempes skjermen, og et trykk lyser den opp.
 */
'use strict';

// Samme sone som nettleseren under, ellers er «13:05» to forskjellige tidspunkt.
process.env.TZ = 'Europe/Oslo';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const Krypto = require('../js/krypto.js');
const Demo = require('../js/demo.js');

const APP = path.join(__dirname, '..');
const PORT = 8131;
const BILDER = process.env.BILDER || '';

const TYPER = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json'
};

let feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + JSON.stringify(verdi) + ')' : ''));
}

const server = http.createServer((req, res) => {
  const sti = decodeURIComponent(req.url.split('?')[0]);
  const fil = path.join(APP, sti.endsWith('/') ? sti + 'index.html' : sti);
  if (!fil.startsWith(APP) || !fs.existsSync(fil)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPER[path.extname(fil)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(fil).pipe(res);
});

// Onsdag 14. oktober 2026, 13:05 – midt på dagen, med noe forbi og noe igjen.
const NAA = new Date(2026, 9, 14, 13, 5);

async function side(nett, viewport, tid, sti, datafil) {
  const ctx = await nett.newContext({ viewport, timezoneId: 'Europe/Oslo', locale: 'nb-NO' });
  const p = await ctx.newPage();
  await p.clock.install({ time: tid });
  await p.route('https://api.met.no/**', r => r.fulfill({
    contentType: 'application/json', body: JSON.stringify(Demo.vaer(tid))
  }));
  await p.route('https://raw.githubusercontent.com/**', r => datafil
    ? r.fulfill({ contentType: 'application/json', body: datafil })
    : r.fulfill({ status: 404, body: '' }));
  const feilmeldinger = [];
  p.on('pageerror', e => feilmeldinger.push(e.message));
  await p.goto('http://localhost:' + PORT + '/' + sti);
  await p.waitForTimeout(600);
  return { p, ctx, feilmeldinger };
}

// Elementer i tavla som går utenfor skjermen eller utenfor kortet de står i.
function utenfor(p) {
  return p.evaluate(() => {
    const ut = [];
    const W = innerWidth, H = innerHeight;
    document.querySelectorAll('#tavle *').forEach(e => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.right > W + 0.5 || r.bottom > H + 0.5 || r.left < -0.5 || r.top < -0.5) {
        ut.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.right) + '×' + Math.round(r.bottom));
      }
    });
    // Kortene klipper innholdet sitt – det som klippes bort, er tapt for leseren.
    document.querySelectorAll('.kort').forEach(k => {
      if (k.scrollHeight > k.clientHeight + 1) ut.push('klippet: ' + k.querySelector('h2').textContent);
    });
    return ut;
  });
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const nett = await chromium.launch();

  console.log('skjermer: ingenting utenfor, ingenting klippet');
  for (const [navn, vp] of [['Redmi Pad', { width: 1333, height: 800 }],
                            ['liten', { width: 1024, height: 640 }],
                            ['stor', { width: 1920, height: 1080 }],
                            ['stående', { width: 768, height: 1280 }]]) {
    const { p, ctx, feilmeldinger } = await side(nett, vp, NAA, '?demo');
    krev(feilmeldinger.length === 0, navn + ': ingen skriptfeil', feilmeldinger);
    const ut = await utenfor(p);
    krev(ut.length === 0, navn + ': ingenting utenfor skjermen', ut.slice(0, 5));
    if (BILDER) await p.screenshot({ path: path.join(BILDER, 'tavle-' + navn.replace(/\s/g, '') + '.png') });
    await ctx.close();
  }

  console.log('innhold: dagen står der den skal');
  {
    const { p, ctx } = await side(nett, { width: 1280, height: 768 }, NAA, '?demo');
    const t = await p.evaluate(() => ({
      tid: document.getElementById('tid').textContent,
      dato: document.getElementById('dato').textContent,
      idag: document.getElementById('idag').innerText,
      heldag: [...document.querySelectorAll('#idag .merke')].map(e => e.textContent).join(),
      kolonner: [...document.querySelectorAll('#idag .personkol h3')].map(e => e.textContent),
      tomming: (() => { const e = document.getElementById('tomming'); return { tekst: e.textContent, snart: e.classList.contains('snart'), synlig: !e.hidden }; })(),
      forbi: [...document.querySelectorAll('#idag .forbi .hva')].map(e => e.textContent),
      side: document.getElementById('side').hidden,
      vaer: document.querySelector('.vaer-temp') && document.querySelector('.vaer-temp').textContent,
      neste: [...document.querySelectorAll('#neste .dag h3')].map(e => e.textContent),
      natt: document.getElementById('natt').hidden
    }));
    krev(t.tid === '13:05', 'klokka', t.tid);
    krev(t.dato === 'onsdag 14. oktober · uke 42', 'dato og ukenummer', t.dato);
    krev(/Foreldremøte/.test(t.idag) && /Fotballtrening/.test(t.idag), 'dagens avtaler', t.idag);
    krev(/Hjemmekontor/.test(t.heldag), 'heldagshendelse som merke', t.heldag);
    krev(t.kolonner.join() === 'Mamma,Pappa,Ella,Theo', 'én kolonne per person', t.kolonner);
    krev(t.tomming.synlig && t.tomming.tekst === 'Søppel i morgen: Restavfall og matavfall' && t.tomming.snart,
      'søppel i morgen, uthevet', t.tomming);
    krev(t.forbi.length === 0, 'ingenting forbi kl. 13:05 – svømming er 14:30', t.forbi);
    krev(t.side === true, 'eksempelet er versjon 1: ingen middag eller bursdager', t.side);
    krev(!!t.vaer, 'været vises', t.vaer);
    krev(t.neste.length === 6 && /^I morgen/.test(t.neste[0]), 'seks dager framover', t.neste);
    krev(t.natt === true, 'ikke dempet midt på dagen');
    await ctx.close();
  }

  console.log('ukeplan og lekser');
  {
    const { p, ctx, feilmeldinger } = await side(nett, { width: 1333, height: 800 }, NAA, '?demo');
    const ella = await p.evaluate(() => {
      const kol = [...document.querySelectorAll('#idag .personkol')].find(k => k.querySelector('h3').textContent === 'Ella');
      return {
        knapp: kol.querySelector('.leksemerke') && kol.querySelector('.leksemerke').textContent,
        avtaler: [...kol.querySelectorAll('.avtale')].map(a => a.textContent)
      };
    });
    krev(ella.knapp === 'Lekser 0 av 1', 'Ellas kolonne viser dagens lekser', ella.knapp);
    krev(ella.avtaler.some(a => /18:00\s*Foreldremøte/.test(a)), 'foreldremøtet fra ukeplanen står i Ellas kolonne', ella.avtaler);
    const neste = await p.evaluate(() => document.getElementById('neste').innerText);
    krev(/Skolejogg/.test(neste), 'skolejoggen fredag står i uka', neste);
    krev(await p.isVisible('#lekserKnapp'), 'Lekser-knappen i bunnlinja');

    await p.click('#lekserKnapp');
    const fane = await p.evaluate(() => ({
      synlig: !document.getElementById('lekser').hidden,
      tittel: document.getElementById('lekserTittel').textContent,
      dager: [...document.querySelectorAll('.leksedag h3')].map(e => e.textContent),
      idag: document.querySelector('.leksedag.idag h3') && document.querySelector('.leksedag.idag h3').textContent,
      uke: [...document.querySelectorAll('.ukerad .lekse')].map(e => e.textContent),
      status: document.getElementById('lekserStatus').textContent
    }));
    krev(fane.synlig && fane.tittel === 'Lekser uke 42', 'leksefanen åpner', fane);
    krev(fane.dager.join() === 'Mandag 12.,Tirsdag 13.,Onsdag 14.,Torsdag 15.,Fredag 16.', 'fem dager', fane.dager);
    krev(fane.idag === 'Onsdag 14.', 'dagen i dag er markert', fane.idag);
    krev(fane.uke.length === 2, 'ukeleksene øverst', fane.uke);
    krev(fane.status === '0 av 1 i dag', 'status for i dag', fane.status);
    const ut = await p.evaluate(() => {
      const ut = [];
      document.querySelectorAll('#lekser *').forEach(e => {
        const r = e.getBoundingClientRect();
        if (r.width && (r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) ut.push(e.className);
      });
      return ut;
    });
    krev(ut.length === 0, 'leksefanen får plass på nettbrettet', ut.slice(0, 5));
    if (BILDER) await p.screenshot({ path: path.join(BILDER, 'lekser.png') });

    await p.click('.leksedag.idag .lekse');
    const etter = await p.evaluate(() => ({
      gjort: document.querySelector('.leksedag.idag .lekse').classList.contains('gjort'),
      status: document.getElementById('lekserStatus').textContent
    }));
    krev(etter.gjort && etter.status === 'Alt gjort i dag!', 'avkrysning og «Alt gjort i dag!»', etter);
    if (BILDER) await p.screenshot({ path: path.join(BILDER, 'lekser-gjort.png') });

    // Et trykk til angrer – et barn som traff feil, skal kunne rette det.
    await p.click('.ukerad .lekse');
    await p.click('.ukerad .lekse');
    krev(!(await p.evaluate(() => document.querySelector('.ukerad .lekse').classList.contains('gjort'))), 'et nytt trykk angrer');

    await p.reload();
    await p.waitForTimeout(600);
    const husket = await p.evaluate(() => {
      const kol = [...document.querySelectorAll('#idag .personkol')].find(k => k.querySelector('h3').textContent === 'Ella');
      return kol.querySelector('.leksemerke').textContent;
    });
    krev(husket === 'Lekser gjort', 'avkrysningen huskes etter omlasting', husket);

    await p.click('#lekserKnapp');
    await p.clock.runFor(4 * 60000);
    krev(await p.evaluate(() => document.getElementById('lekser').hidden), 'fanen lukker seg selv etter noen minutter');
    krev(feilmeldinger.length === 0, 'ingen skriptfeil', feilmeldinger);
    await ctx.close();
  }

  console.log('natt: dempes, og et trykk lyser opp');
  {
    const { p, ctx } = await side(nett, { width: 1280, height: 768 }, new Date(2026, 9, 14, 23, 30), '?demo');
    krev(await p.evaluate(() => !document.getElementById('natt').hidden), 'dempet kl. 23:30');
    await p.mouse.click(400, 400);
    krev(await p.evaluate(() => document.getElementById('natt').hidden), 'lyser opp ved trykk');
    const forbi = await p.evaluate(() => document.querySelectorAll('#idag .forbi').length);
    krev(forbi >= 3, 'dagens avtaler er gråe om kvelden', forbi);
    await ctx.close();
  }

  console.log('kryptert datafil: riktig og feil passfrase');
  {
    const pakke = Demo.pakke(NAA);
    // Uten Theo, og uten middag, bursdager og søppel – slik eierne starter.
    pakke.kalendere = pakke.kalendere.filter(k => k.navn !== 'Theo' && k.rolle === 'person');
    const fil = JSON.stringify(await Krypto.krypter(JSON.stringify(pakke), 'riktig hest batteri stift'));

    let { p, ctx } = await side(nett, { width: 1280, height: 768 }, NAA, '', fil);
    krev(await p.isVisible('#oppsett'), 'spør etter passfrase første gang');
    await p.fill('#passfrase', 'feil passfrase');
    await p.click('#oppsettSkjema button[type=submit]');
    await p.waitForTimeout(1500);
    const melding = await p.textContent('#oppsettMelding');
    krev(/stemmer ikke/.test(melding), 'feil passfrase gir melding', melding);

    await p.fill('#passfrase', 'riktig hest batteri stift');
    await p.click('#oppsettSkjema button[type=submit]');
    await p.waitForSelector('#tavle:not([hidden])', { timeout: 5000 }).catch(() => {});
    const personer = await p.evaluate(() => document.getElementById('personer').innerText);
    krev(/Mamma/.test(personer) && !/Theo/.test(personer), 'viser kalendrene fra fila', personer);
    const uten = await p.evaluate(() => ({
      side: document.getElementById('side').hidden,
      tomming: document.getElementById('tomming').hidden,
      kolonner: document.querySelectorAll('#idag .personkol').length
    }));
    krev(uten.side && uten.tomming, 'uten middag, bursdager og søppel: ingen sidekolonne, ingen søppellinje', uten);
    krev(uten.kolonner === 3, 'tre personer, tre kolonner', uten.kolonner);
    const status = await p.textContent('#status');
    krev(/Kalender hentet 13:05/.test(status), 'bunnlinja sier når fila ble hentet', status);

    // ⋯ åpner skjemaet, og tavla tegner seg ikke over det igjen.
    await p.click('#meny');
    await p.clock.runFor(25000);
    krev(await p.isVisible('#oppsett') && !(await p.isVisible('#tavle')), '⋯ viser skjemaet, og det blir stående');

    // Passfrasen huskes: en ny innlasting går rett til tavla.
    await p.reload();
    await p.waitForTimeout(1500);
    krev(await p.isVisible('#tavle'), 'husker passfrasen');
    await ctx.close();

    // Gammel fil: bunnlinja sier fra.
    ({ p, ctx } = await side(nett, { width: 1280, height: 768 }, new Date(NAA.getTime() + 5 * 3600000), '', fil));
    await p.evaluate(() => localStorage.setItem('familietavle.passfrase', 'riktig hest batteri stift'));
    await p.reload();
    await p.waitForTimeout(1500);
    const gammel = await p.evaluate(() => {
      const s = document.getElementById('status');
      return { tekst: s.textContent, gammel: s.classList.contains('gammel') };
    });
    krev(gammel.gammel && /for 5 t siden/.test(gammel.tekst), 'gammel fil varsles', gammel);
    await ctx.close();
  }

  console.log('ingen datafil ennå');
  {
    const { p, ctx } = await side(nett, { width: 1280, height: 768 }, NAA, '');
    await p.evaluate(() => localStorage.setItem('familietavle.passfrase', 'x'));
    await p.reload();
    await p.waitForTimeout(800);
    const melding = await p.textContent('#oppsettMelding');
    krev(/Fant ingen datafil/.test(melding), 'sier fra om manglende datafil', melding);
    await ctx.close();
  }

  await nett.close();
  server.close();
  console.log((feil ? feil + ' av ' : 'Alle ') + gjort + ' krav ' + (feil ? 'FEILET' : 'holdt'));
  process.exit(feil ? 1 : 0);
})();
