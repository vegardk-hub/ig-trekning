/*
 * Prøver for skrivemodus – feltene barnet svarer i på iPaden.
 *
 * Starter sin egen server og trenger bare playwright:
 *
 *     NODE_PATH=/opt/node22/lib/node_modules node koordinatjakt/tester/skriving.js
 *
 * `tester/svar.js` svarer for om et ord er riktig. Denne svarer for det
 * feltet gjør med svaret, og det er en annen slags feil. Den som allerede har
 * kostet: andre hjelpetrykk låste det barnet nettopp hadde skrevet feil, i
 * stedet for å skrive inn ordet – oppgaven ble «riktig» med «blåbærsyltetøy»
 * i feltet og fasiten stående i lyst ved siden av.
 *
 * Kravene her er de som avgjør om arket kan brukes uten en voksen ved siden:
 * at et eksakt svar låser seg av seg selv, at en skrivefeil ikke låser seg
 * halvveis, at et galt svar sier fra uten å rope, at hjelpen hjelper, og at
 * tolv løste oppgaver overlever at iPaden låser seg.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8731);
const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
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

(async () => {
  const s = await server();
  const nettleser = await chromium.launch();
  // iPad i liggende stilling – der to-kolonneoppsettet slår inn.
  const side = await nettleser.newPage({ viewportSize: { width: 1024, height: 768 } });
  const adresse = n => 'http://localhost:' + PORT + '/koordinatjakt/#' + n;
  const felt = i => side.locator('#oppgaver li').nth(i).locator('.svarfelt');
  const hjelp = i => side.locator('#oppgaver li').nth(i).locator('.hjelp');
  const retting = i => side.locator('#oppgaver li').nth(i).locator('.retting');

  await side.goto(adresse('dyrehage/3/12'));
  await side.evaluate(() => localStorage.clear());
  await side.reload();
  await side.waitForTimeout(250);

  const fasit = await side.evaluate(() =>
    Oppgaver.lag(Scene.lag('dyrehage', 3), 12).map(o => o.ord));

  bolk('Feltene på iPaden');
  const attributter = await felt(0).evaluate(e => ({
    autocorrect: e.getAttribute('autocorrect'),
    autocapitalize: e.getAttribute('autocapitalize'),
    stavekontroll: e.getAttribute('spellcheck'),
    enter: e.getAttribute('enterkeyhint'),
    skrift: parseFloat(getComputedStyle(e).fontSize)
  }));
  krev(attributter.autocorrect === 'off', 'iOS retter ellers ordet mens barnet skriver');
  krev(attributter.autocapitalize === 'none', 'hvert svar ville fått stor forbokstav');
  krev(attributter.stavekontroll === 'false', 'stavekontroll skal være av');
  krev(attributter.enter === 'next', 'Enter-tasten skal si «neste»');
  krev(attributter.skrift >= 16, 'under 16 px zoomer Safari inn og kartet forsvinner', attributter.skrift);

  bolk('Eksakt svar låser seg selv');
  await felt(0).fill(fasit[0]);
  await side.waitForTimeout(120);
  krev(await felt(0).evaluate(e => e.classList.contains('riktig')), 'skal bli grønt uten Enter');
  krev(await felt(0).evaluate(e => e.readOnly), 'skal låses');
  krev(await retting(0).textContent() === '', 'riktig skrivemåte trenger ingen retting');
  krev((await side.locator('#fremdrift').textContent()).includes('1 av 12'), 'fremdriften skal telle');

  bolk('Skrivefeil låser ikke mens det skrives');
  // Ikke oppgave 0 – den er alt løst over.
  const langt = fasit.findIndex((o, i) => i > 0 && o.length >= 6);
  krev(langt > 0, 'brettet må ha et ord på minst seks bokstaver å prøve med');
  const medFeil = fasit[langt].slice(0, -1);
  await felt(langt).fill(medFeil);
  await side.waitForTimeout(120);
  krev(!(await felt(langt).evaluate(e => e.classList.contains('riktig'))),
    '«' + medFeil + '» skal ikke låse feltet halvveis');
  await felt(langt).press('Enter');
  await side.waitForTimeout(120);
  krev(await felt(langt).evaluate(e => e.classList.contains('riktig')),
    '«' + medFeil + '» skal godtas når barnet sier seg ferdig');
  krev(await retting(langt).textContent() === fasit[langt],
    'riktig skrivemåte skal stå ved siden av', await retting(langt).textContent());

  bolk('Galt svar sier fra uten å rope');
  const galt = fasit.findIndex((o, i) => i !== 0 && i !== langt);
  await felt(galt).fill('blåbærsyltetøy');
  await felt(galt).press('Enter');
  await side.waitForTimeout(120);
  krev(await felt(galt).evaluate(e => e.classList.contains('bom')), 'feltet skal merkes');
  krev(!(await felt(galt).evaluate(e => e.classList.contains('riktig'))), 'og ikke godtas');
  const beskjed = await side.locator('#beskjed').textContent();
  krev(beskjed.length > 0, 'det skal stå noe');
  krev(!/feil|galt|dumt/i.test(beskjed), 'men ingenting som sier at barnet tok feil: ' + beskjed);
  /* Rammen skal være rolig, ikke rød. Rødt er den ene fargen som gjør et
     manglende svar om til en dom, og ingen app i dette repoet bruker den. */
  const ramme = await felt(galt).evaluate(e => getComputedStyle(e).borderColor);
  const rgb = (ramme.match(/\d+/g) || []).map(Number);
  krev(rgb.length >= 3 && !(rgb[0] > 170 && rgb[1] < 110 && rgb[2] < 110),
    'rammen på et svar som ikke stemte skal ikke være rød', ramme);

  bolk('Hjelpen hjelper, i to trinn');
  await hjelp(galt).click();
  await side.waitForTimeout(120);
  const plass = await felt(galt).getAttribute('placeholder');
  krev(!!plass && plass.charAt(0) === fasit[galt].charAt(0), 'første trinn gir første bokstav', plass);
  krev(!(await felt(galt).evaluate(e => e.classList.contains('riktig'))), 'første trinn er ikke et svar');
  await hjelp(galt).click();
  await side.waitForTimeout(120);
  krev(await felt(galt).inputValue() === fasit[galt],
    'andre trinn skriver inn ordet, ikke det som sto der fra før', await felt(galt).inputValue());
  krev(await retting(galt).textContent() === '', 'og da er det ingenting å rette');
  krev(await felt(galt).evaluate(e => e.classList.contains('riktig')), 'og oppgaven er løst');

  bolk('Ferdig når alt er løst');
  for (let i = 0; i < 12; i++) {
    if (await felt(i).evaluate(e => e.readOnly)) continue;
    await felt(i).fill(fasit[i]);
    await side.waitForTimeout(60);
  }
  await side.waitForTimeout(150);
  krev(await side.locator('#ferdigkort').isVisible(), 'ferdigkortet skal vises');
  krev((await side.locator('#fremdrift').textContent()).includes('12 av 12'), 'fremdriften skal være full');

  bolk('Svarene overlever en omlasting');
  await side.reload();
  await side.waitForTimeout(350);
  krev(await side.locator('#oppgaver .svarfelt.riktig').count() === 12,
    'alle tolv skal ligge igjen', await side.locator('#oppgaver .svarfelt.riktig').count());

  bolk('Et annet brett starter tomt');
  await side.locator('#neste').click();
  await side.waitForTimeout(250);
  krev(await side.locator('#oppgaver .svarfelt.riktig').count() === 0, 'nytt brett, blanke felter');

  bolk('Bildet står ved siden av svarene på iPad');
  const side_om_side = await side.evaluate(() => {
    const b = document.getElementById('bilde').getBoundingClientRect();
    const o = document.getElementById('oppgaver').getBoundingClientRect();
    return o.left >= b.right - 2;
  });
  krev(side_om_side, 'med svarene under kartet forsvinner kartet når tastaturet kommer opp');

  await nettleser.close();
  s.close();
  console.log('\n' + (feil ? feil + ' feil av ' + gjort + ' krav' : 'Alt i orden – ' + gjort + ' krav'));
  process.exit(feil ? 1 : 0);
})();
