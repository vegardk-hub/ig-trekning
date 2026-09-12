/*
 * Prøver for innlesing – barnet sier ordet i stedet for å skrive det.
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node koordinatjakt/tester/lytting.js
 *
 * **Gjenkjenneren er stubbet, og det skal den være.** Skyøkta har ingen
 * lydinngang, og `--use-fake-device-for-media-capture` hjelper ikke — samme
 * lærdom som innspillingsprøven i Monstergiret. Det som kan prøves her, er
 * alt som ligger mellom gjenkjenneren og barnet: at mikrofonen settes opp
 * riktig, at et treff skriver inn fasiten og ikke det gjenkjenneren fikk til,
 * og framfor alt at et bom fra mikrofonen aldri behandles som et galt svar.
 *
 * Det siste er kravet som er lettest å ødelegge ved et uhell, for skriveveien
 * gjør det motsatte: der *skal* et svar som ikke stemte, si fra. Forskjellen
 * er hvor usikkerheten ligger. Det barnet skrev, står det nøyaktig hva er.
 * Det mikrofonen hørte, er en gjetning om en barnestemme.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8732);
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
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }

// Stubben. Legges inn før appen lastes, så `Lytting` finner den.
function stubb() {
  window.__tale = { startet: 0, avbrutt: 0, siste: null, oppsett: null };
  window.SpeechRecognition = function () {
    const meg = this;
    this.lang = '';
    this.continuous = null;
    this.interimResults = null;
    this.maxAlternatives = 0;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.start = function () {
      window.__tale.startet++;
      window.__tale.siste = meg;
      window.__tale.oppsett = {
        lang: meg.lang,
        continuous: meg.continuous,
        interimResults: meg.interimResults,
        maxAlternatives: meg.maxAlternatives
      };
    };
    this.stop = function () {};
    this.abort = function () { window.__tale.avbrutt++; };
  };
  window.__horte = function (ord) {
    window.__tale.siste.onresult({ results: [ord.map(t => ({ transcript: t }))] });
  };
  window.__lyttefeil = function (kode) { window.__tale.siste.onerror({ error: kode }); };
}

(async () => {
  const s = await server();
  const nettleser = await chromium.launch();
  const adresse = '#dyrehage/3/12';
  const url = n => 'http://localhost:' + PORT + '/koordinatjakt/' + n;

  const side = await nettleser.newPage({ viewportSize: { width: 1024, height: 768 } });
  await side.addInitScript(stubb);
  await side.goto(url(adresse));
  await side.evaluate(() => localStorage.clear());
  await side.reload();
  await side.waitForTimeout(250);

  const fasit = await side.evaluate(() =>
    Oppgaver.lag(Scene.lag('dyrehage', 3), 12).map(o => o.ord));
  const rad = i => side.locator('#oppgaver li').nth(i);
  const felt = i => rad(i).locator('.svarfelt');
  const mik = i => rad(i).locator('.mikrofon');

  bolk('Mikrofonen settes opp for ett ord, ikke for en strøm');
  krev(await mik(0).isVisible(), 'knappen skal finnes når nettleseren kan høre');
  await mik(0).click();
  await side.waitForTimeout(100);
  const oppsett = await side.evaluate(() => window.__tale.oppsett);
  krev(oppsett.lang === 'nb-NO', 'språket skal være norsk', oppsett.lang);
  krev(oppsett.continuous === false, 'vi venter på ett ord, ikke på en strøm');
  krev(oppsett.maxAlternatives === 5,
    'alle alternativene prøves – det riktige ligger ofte ikke først', oppsett.maxAlternatives);
  krev(await mik(0).getAttribute('aria-pressed') === 'true', 'knappen skal vise at den lytter');
  krev(await rad(0).evaluate(e => e.classList.contains('lytter')), 'raden skal lyse mens den lytter');

  bolk('Et treff skriver inn fasiten, ikke det gjenkjenneren fikk til');
  await side.evaluate(o => window.__horte([o]), fasit[0]);
  await side.waitForTimeout(120);
  krev(await felt(0).inputValue() === fasit[0], 'feltet skal få ordet', await felt(0).inputValue());
  krev(await felt(0).evaluate(e => e.classList.contains('riktig')), 'og bli grønt');
  krev(await mik(0).isHidden(), 'mikrofonen skal bort når oppgaven er løst');
  krev(await rad(0).locator('.retting').textContent() === '', 'ingen retting på et talt svar');

  const langt = fasit.findIndex((o, i) => i > 0 && o.length >= 6);
  krev(langt > 0, 'brettet må ha et langt nok ord å prøve med');
  await mik(langt).click();
  await side.evaluate(o => window.__horte([o.slice(0, -1)]), fasit[langt]);
  await side.waitForTimeout(120);
  krev(await felt(langt).inputValue() === fasit[langt],
    'hørte gjenkjenneren «' + fasit[langt].slice(0, -1) + '», skal feltet likevel vise ' +
    fasit[langt], await felt(langt).inputValue());

  bolk('Et bom fra mikrofonen er aldri et galt svar');
  const bom = fasit.findIndex((o, i) => i !== 0 && i !== langt);
  await mik(bom).click();
  await side.evaluate(() => window.__horte(['grevling', 'revling']));
  await side.waitForTimeout(120);
  krev(!(await felt(bom).evaluate(e => e.classList.contains('bom'))),
    'feltet skal IKKE merkes – gjenkjenneren bommet, ikke barnet');
  krev(!(await felt(bom).evaluate(e => e.classList.contains('riktig'))), 'og ikke godtas');
  const beskjed = await side.locator('#beskjed').textContent();
  krev(beskjed.indexOf('grevling') >= 0, 'beskjeden skal si hva den hørte', beskjed);
  krev(!/feil|galt/i.test(beskjed), 'og ikke si at barnet tok feil', beskjed);
  krev(!(await rad(bom).evaluate(e => e.classList.contains('lytter'))), 'lyttingen skal slås av');

  bolk('Feil fra gjenkjenneren forklares');
  await mik(bom).click();
  await side.evaluate(() => window.__lyttefeil('not-allowed'));
  await side.waitForTimeout(120);
  krev(/[Mm]ikrofonen/.test(await side.locator('#beskjed').textContent()),
    'avslått mikrofon skal sies rett ut', await side.locator('#beskjed').textContent());
  await mik(bom).click();
  await side.evaluate(() => window.__lyttefeil('no-speech'));
  await side.waitForTimeout(120);
  krev(/hørte ingenting/.test(await side.locator('#beskjed').textContent()),
    'stillhet skal forklares', await side.locator('#beskjed').textContent());

  bolk('Andre trykk slår mikrofonen av');
  const foer = await side.evaluate(() => window.__tale.startet);
  await mik(bom).click();
  await side.waitForTimeout(80);
  await mik(bom).click();
  await side.waitForTimeout(80);
  krev(await side.evaluate(() => window.__tale.startet) === foer + 1, 'bare én ny start');
  krev(!(await rad(bom).evaluate(e => e.classList.contains('lytter'))), 'lyttingen skal være av');

  bolk('Nytt brett stopper mikrofonen');
  await mik(bom).click();
  await side.waitForTimeout(80);
  const avbruttFoer = await side.evaluate(() => window.__tale.avbrutt);
  await side.locator('#neste').click();
  await side.waitForTimeout(200);
  krev(await side.evaluate(() => window.__tale.avbrutt) > avbruttFoer,
    'gjenkjenneren skal slippe mikrofonen når brettet byttes');

  bolk('Uten talegjenkjenning forsvinner knappene');
  const uten = await nettleser.newPage({ viewportSize: { width: 1024, height: 768 } });
  await uten.addInitScript(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });
  await uten.goto(url(adresse));
  await uten.waitForTimeout(300);
  krev(await uten.locator('#oppgaver .mikrofon').first().isHidden(),
    'ingen mikrofonknapper');
  krev(await uten.locator('#lyttemerknad').isVisible(),
    'og en merknad som sier hvorfor');
  krev(await uten.locator('#oppgaver .svarfelt').first().isEditable(),
    'skriving skal virke som før');

  await nettleser.close();
  s.close();
  console.log('\n' + (feil ? feil + ' feil av ' + gjort + ' krav' : 'Alt i orden – ' + gjort + ' krav'));
  process.exit(feil ? 1 : 0);
})();
