/*
 * nivaaer: treffer generatoren båndet den blir bedt om — på alle tolv nivåene?
 *
 * Dette er prøven som holder vanskelighetsgradene ærlige. Går et bånd tomt,
 * bruker generatoren opp forsøkene sine og leverer «det nærmeste den har» i
 * stedet: et brett som er lettere enn bestilt, uten at noe sier fra. Et nivå
 * kan altså se ut til å virke mens det i praksis gir deg forrige nivå.
 *
 * Fordelingen er svært skjev — se tester/maaling.js — så et bånd som ser
 * rimelig ut på papiret kan være nesten tomt. Målingen er den eneste måten å
 * vite det på.
 *
 * Kjøres uten nettleser:  node pwa-sudoku/tester/nivaaer.js [per nivå]
 */
'use strict';

const fs = require('fs');
const path = require('path');

global.window = global;
for (const f of ['core.js', 'solver.js', 'generator.js']) {
  new Function(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))();
}
const S = global.SudokuSolver;
const G = global.SudokuGenerator;

let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

// Speiler OMRAADER i generator.js. Står med vilje her også: en prøve som leser
// fasiten sin fra koden den prøver, godtar enhver endring i den.
const BAAND = {
  lett:       { min: 0,  maks: 2 },
  middels:    { min: 3,  maks: 3 },
  krevende:   { min: 4,  maks: 4 },
  vanskelig:  { min: 5,  maks: 5 },
  beinhard:   { min: 6,  maks: 11 },
  ekspert:    { min: 12, maks: 13 },
  mester:     { min: 14, maks: 14 },
  stormester: { min: 15, maks: 15 },
  // De fire øverste deler nivå 16 og skilles på hvor mange tvungne kjeder som
  // trengs. Uten det målet ville de vært fire navn på det samme båndet.
  virtuos:    { min: 16, maks: 16, kjederMin: 1, kjederMaks: 1 },
  titan:      { min: 16, maks: 16, kjederMin: 2, kjederMaks: 2 },
  orakel:     { min: 16, maks: 16, kjederMin: 3, kjederMaks: 3 },
  legende:    { min: 16, maks: 16, kjederMin: 4, kjederMaks: Infinity }
};

const PER = Number(process.argv[2]) || 4;

(async () => {
  console.log(`\n— ${PER} brett per nivå —\n`);
  console.log('nivå        treff   tid/brett   nivåer som kom ut');
  console.log('─'.repeat(64));

  const bom = [];

  for (const [id, baand] of Object.entries(BAAND)) {
    const maksene = [], grader = [];
    const start = Date.now();
    for (let n = 0; n < PER; n++) {
      const r = await G.generate(id);
      const g = S.grade(r.puzzle);
      grader.push(g);
      maksene.push(g.solved ? g.maks + (baand.kjederMaks !== undefined
        ? '/' + (g.kjeder || 0) : '') : 99);
    }
    const tid = (Date.now() - start) / PER;
    const traff = grader.filter(g => g.solved && g.maks >= baand.min && g.maks <= baand.maks &&
      (baand.kjederMin === undefined ||
       ((g.kjeder || 0) >= baand.kjederMin && (g.kjeder || 0) <= baand.kjederMaks))).length;
    if (traff < PER) bom.push(`${id}: ${traff}/${PER}, fikk ${maksene.join(',')}`);
    console.log(`${id.padEnd(11)} ${String(traff + '/' + PER).padEnd(7)} ` +
                `${(tid.toFixed(0) + 'ms').padEnd(11)} ${maksene.join(', ')}`);
  }

  console.log('─'.repeat(64));
  console.log('');
  sjekk('hvert nivå leverte brett i sitt eget bånd', bom.length === 0, bom.join(' | '));

  // Nivåene må dessuten være strengt stigende, ellers er to av dem samme nivå
  // med ulikt navn.
  /*
   * Strengt stigende, men langs to akser: teknikknivået først, og der det er
   * likt, kjedetallet. De fire øverste deler nivå 16, så maks alene ville sagt
   * at fire av dem er det samme båndet.
   */
  const trapp = S.NIVAAER.map(n => [n.maks, n.kjeder === undefined ? -1 : n.kjeder]);
  const stiger = trapp.every((v, i) => i === 0 ||
    v[0] > trapp[i - 1][0] || (v[0] === trapp[i - 1][0] && v[1] > trapp[i - 1][1]));
  sjekk('NIVAAER stiger strengt', stiger,
        trapp.map(([m, k]) => m + (k < 0 ? '' : '/' + k)).join(' < '));

  // Og hvert bånd i generatoren må svare til nøyaktig ett nivå i løseren.
  const fraSolver = S.NIVAAER.map(n => n.id).join(',');
  const fraBaand = Object.keys(BAAND).join(',');
  sjekk('løseren og generatoren kjenner de samme nivåene', fraSolver === fraBaand,
        `${fraSolver}  vs  ${fraBaand}`);

  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
