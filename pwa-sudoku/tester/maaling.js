/*
 * Måler hvor tett brettene ligger på hvert teknikknivå.
 *
 * Ikke en prøve — et måleverktøy. Vanskelighetsgradene i `NIVAAER` og
 * `OMRAADER` er satt etter fordelingen den skriver ut, ikke etter hvor
 * avanserte teknikkene høres ut. Kjør den på nytt hvis teknikklista endres:
 *
 *   node pwa-sudoku/tester/maaling.js [antall]
 *
 * Den graver som generatoren gjør (asymmetrisk, altså dypest mulig) og
 * rapporterer hvilken teknikk som ble den vanskeligste hvert brett krevde.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Modulene henger seg på `window`. Node har ingen, så vi lager en.
global.window = global;
for (const f of ['core.js', 'solver.js']) {
  new Function(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))();
}
const C = global.SudokuCore;
const S = global.SudokuSolver;

const NAVN = {
  0: '(ingen — ferdig utfylt)', 1: 'Naken ener', 2: 'Skjult ener',
  3: 'Låst kandidat', 4: 'Nakent par', 5: 'Skjult par', 6: 'Nakent trippel',
  7: 'Skjult trippel', 8: 'Nakent kvadruppel', 9: 'X-Wing', 10: 'XY-Wing',
  11: 'Sverdfisk', 12: 'XYZ-Wing', 13: 'W-Wing', 14: 'Farging'
};

function grav(solution, symmetrisk) {
  const puzzle = solution.slice();
  for (const i of C.shuffled(Array.from({ length: 81 }, (_, k) => k), Math.random)) {
    if (!puzzle[i]) continue;
    const j = symmetrisk ? 80 - i : i;
    const a = puzzle[i], b = puzzle[j];
    puzzle[i] = 0; puzzle[j] = 0;
    if (C.countSolutions(puzzle, 2) !== 1) { puzzle[i] = a; puzzle[j] = b; }
  }
  return puzzle;
}

const antall = Number(process.argv[2]) || 400;
const tell = {};
let utenfor = 0, ledetraader = 0;
const start = Date.now();

for (let n = 0; n < antall; n++) {
  const losning = C.randomSolution(Math.random);
  if (!losning) continue;
  const brett = grav(losning, false);
  ledetraader += brett.filter(x => x).length;
  const g = S.grade(brett);
  if (!g.solved) { utenfor++; continue; }
  tell[g.maks] = (tell[g.maks] || 0) + 1;
}

const løst = antall - utenfor;
console.log(`\n${antall} brett, gravd asymmetrisk, på ${((Date.now() - start) / 1000).toFixed(0)}s`);
console.log(`Snitt ledetråder: ${(ledetraader / antall).toFixed(1)}\n`);
console.log('nivå  teknikk                     brett   andel   kumulativ');
console.log('─'.repeat(62));

let sum = 0;
for (const k of Object.keys(tell).map(Number).sort((a, b) => a - b)) {
  sum += tell[k];
  const andel = (tell[k] / antall * 100).toFixed(1).padStart(5);
  const kum = (sum / antall * 100).toFixed(1).padStart(5);
  console.log(`${String(k).padStart(4)}  ${(NAVN[k] || '?').padEnd(26)} ${String(tell[k]).padStart(5)}  ${andel}%  ${kum}%`);
}
console.log('─'.repeat(62));
console.log(`  —   utenfor teknikkene        ${String(utenfor).padStart(5)}  ` +
            `${(utenfor / antall * 100).toFixed(1).padStart(5)}%  100.0%`);
console.log(`\nLøsbare med dagens teknikker: ${løst} av ${antall}\n`);
