/*
 * teknikker: ingen løseteknikk får stryke en kandidat som er den rette.
 *
 * Dette er prøven som gjør at en ny teknikk kan slippes inn i solver.js. En
 * teknikk som resonnerer galt, ser helt riktig ut i grensesnittet — den skriver
 * en pen forklaring og fjerner et tall som skulle stått der. Brettet blir
 * uløselig flere trekk senere, langt fra der feilen ble gjort.
 *
 * Derfor kjøres løseren mot fasiten: hvert eneste steg måles mot den kjente
 * løsningen, både det som plasseres og det som strykes.
 *
 * Kjøres uten nettleser — teknikkene er ren regning.
 */
'use strict';

const fs = require('fs');
const path = require('path');

global.window = global;
for (const f of ['core.js', 'solver.js']) {
  new Function(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))();
}
const C = global.SudokuCore;
const S = global.SudokuSolver;

let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

function grav(losning, symmetrisk) {
  const brett = losning.slice();
  for (const i of C.shuffled(Array.from({ length: 81 }, (_, k) => k), Math.random)) {
    if (!brett[i]) continue;
    const j = symmetrisk ? 80 - i : i;
    const a = brett[i], b = brett[j];
    brett[i] = 0; brett[j] = 0;
    if (C.countSolutions(brett, 2) !== 1) { brett[i] = a; brett[j] = b; }
  }
  return brett;
}

// 250 rekker til at alle teknikkene blir brukt flere ganger, og holder prøven
// under ti sekunder. Kjør den med et større tall når solver.js er endret.
const ANTALL = Number(process.argv[2]) || 250;

console.log('\n— Hvert steg måles mot fasiten —');

const brukt = {};
let steg = 0, brett = 0;
const syndere = [];

for (let n = 0; n < ANTALL; n++) {
  const losning = C.randomSolution(Math.random);
  if (!losning) continue;
  const oppgave = grav(losning, false);
  brett++;

  const st = S.makeState(oppgave, null);
  for (let vakt = 0; vakt < 200; vakt++) {
    let tomme = 0;
    for (let i = 0; i < 81; i++) if (!st.v[i]) tomme++;
    if (tomme === 0) break;

    const s = S.findStep(st);
    if (!s) break;
    steg++;
    brukt[s.name] = (brukt[s.name] || 0) + 1;

    // Plasseringen må være tallet som faktisk hører hjemme der.
    if (s.placement && losning[s.placement.cell] !== s.placement.digit) {
      syndere.push(`${s.name}: satte ${s.placement.digit} i ${C.cellName(s.placement.cell)}, fasit ${losning[s.placement.cell]}`);
      break;
    }
    // Og ingen strykning får ramme tallet som hører hjemme der.
    let galt = false;
    for (const e of s.eliminations) {
      if (losning[e.cell] === e.digit) {
        syndere.push(`${s.name}: strøk ${e.digit} i ${C.cellName(e.cell)}, som er fasiten der`);
        galt = true;
        break;
      }
    }
    if (galt) break;

    S.applyStep(st, s);
  }
}

sjekk(`${steg} steg over ${brett} brett strøk aldri det rette tallet`,
      syndere.length === 0, syndere.slice(0, 5).join(' | '));

console.log('\n— Alle teknikkene er nådd —');
// En teknikk som aldri kjøres, er heller aldri prøvd — da sier det grønne over
// ingenting om den. Derfor listes det som faktisk ble brukt.
for (const k of Object.keys(brukt).sort()) console.log(`  ${k.padEnd(24)} ${brukt[k]}`);

const NYE = ['XYZ-Wing', 'W-Wing', 'Farging'];
sjekk('de nye teknikkene ble faktisk brukt', NYE.every(v => brukt[v] > 0),
      NYE.map(v => `${v}: ${brukt[v] || 0}`).join(', '));

console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
process.exit(feil ? 1 : 0);
