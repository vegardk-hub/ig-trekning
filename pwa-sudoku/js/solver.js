'use strict';
/*
 * solver.js — logisk løser.
 * Finner neste trekk med menneskelige løseteknikker og forklarer hvorfor.
 * Teknikkene prøves i stigende vanskelighetsgrad, slik at hintet alltid
 * er det enkleste som finnes akkurat nå. Eksponeres som window.SudokuSolver.
 */
(function (global) {

  const C = global.SudokuCore;
  const { UNITS, PEERS, PEER_SETS, ROWS, COLS, POPCOUNT,
          digitsOf, firstDigit, cellName, cellList, unitName, rowOf, colOf, boxOf } = C;

  /* ---------- Hjelpere ---------- */

  /** Alle kombinasjoner av `size` elementer fra `arr`. */
  function combinations(arr, size) {
    const out = [], idx = [];
    (function rec(start) {
      if (idx.length === size) { out.push(idx.map(i => arr[i])); return; }
      for (let i = start; i < arr.length; i++) { idx.push(i); rec(i + 1); idx.pop(); }
    })(0);
    return out;
  }

  function unsolved(state, cells) {
    return cells.filter(i => !state.v[i]);
  }

  /** Cellene i enheten der `d` fortsatt er en mulighet. */
  function spotsFor(state, cells, d) {
    const b = 1 << d, out = [];
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k];
      if (state.v[i] === d) return null;      // tallet er allerede plassert her
      if (!state.v[i] && (state.cand[i] & b)) out.push(i);
    }
    return out;
  }

  function step(o) {
    if (!o.eliminations) o.eliminations = [];
    if (!o.cells) o.cells = [];
    if (!o.unitCells) o.unitCells = [];
    o.targets = o.eliminations.map(e => e.cell);
    return o;
  }

  const listOf = ds => ds.length === 1 ? String(ds[0])
    : ds.slice(0, -1).join(', ') + ' og ' + ds[ds.length - 1];

  // Bestemt form av enhetsnavnene — «kolonne» + «en» blir ikke «kolonneen».
  const BESTEMT = { rad: 'raden', kolonne: 'kolonnen', boks: 'boksen' };

  // Små tall skrives med bokstaver i løpende tekst.
  const ORD = { 2: 'to', 3: 'tre', 4: 'fire' };
  const stor = s => s[0].toUpperCase() + s.slice(1);

  /* ---------- Teknikk 1: naken ener ---------- */

  function nakedSingle(state) {
    for (let i = 0; i < 81; i++) {
      if (state.v[i]) continue;
      if (POPCOUNT[state.cand[i]] !== 1) continue;
      const d = firstDigit(state.cand[i]);
      return step({
        id: 'naked-single', name: 'Naken ener', level: 1,
        cells: [i], digits: [d],
        placement: { cell: i, digit: d },
        short: cellName(i) + ' må være ' + d + '.',
        text: 'Alle andre tall enn ' + d + ' finnes allerede i rad ' + (rowOf(i) + 1) +
              ', kolonne ' + (colOf(i) + 1) + ' eller boks ' + (boxOf(i) + 1) +
              '. Da er ' + d + ' det eneste som er igjen for ' + cellName(i) + '.'
      });
    }
    return null;
  }

  /* ---------- Teknikk 2: skjult ener ---------- */

  function hiddenSingle(state) {
    for (let ui = 0; ui < UNITS.length; ui++) {
      const u = UNITS[ui];
      for (let d = 1; d <= 9; d++) {
        const spots = spotsFor(state, u.cells, d);
        if (!spots || spots.length !== 1) continue;
        const i = spots[0];
        if (POPCOUNT[state.cand[i]] === 1) continue;   // da er det en naken ener
        return step({
          id: 'hidden-single', name: 'Skjult ener', level: 2,
          cells: [i], unitCells: u.cells, digits: [d],
          placement: { cell: i, digit: d },
          short: 'I ' + unitName(u) + ' kan ' + d + ' bare stå i ' + cellName(i) + '.',
          text: 'Hver ' + u.kind + ' må inneholde tallet ' + d + ' én gang. I ' + unitName(u) +
                ' er alle andre celler utelukket, så ' + d + ' må stå i ' + cellName(i) +
                ' selv om cellen også har andre kandidater.'
        });
      }
    }
    return null;
  }

  /* ---------- Teknikk 3: låste kandidater ---------- */

  // Peker: i en boks ligger alle forekomster av d på samme rad/kolonne.
  function pointing(state) {
    for (let b = 0; b < 9; b++) {
      const box = C.BOXES[b];
      for (let d = 1; d <= 9; d++) {
        const spots = spotsFor(state, box, d);
        if (!spots || spots.length < 2 || spots.length > 3) continue;

        for (const axis of [{ get: rowOf, lines: ROWS, navn: 'rad' },
                            { get: colOf, lines: COLS, navn: 'kolonne' }]) {
          const bestemt = BESTEMT[axis.navn];
          const line = axis.get(spots[0]);
          if (!spots.every(i => axis.get(i) === line)) continue;

          const elim = axis.lines[line]
            .filter(i => boxOf(i) !== b && !state.v[i] && (state.cand[i] & (1 << d)))
            .map(cell => ({ cell, digit: d }));
          if (!elim.length) continue;

          return step({
            id: 'pointing', name: 'Låst kandidat (peker)', level: 3,
            cells: spots, unitCells: box, digits: [d], eliminations: elim,
            short: d + ' i boks ' + (b + 1) + ' må stå i ' + axis.navn + ' ' + (line + 1) + '.',
            text: 'I boks ' + (b + 1) + ' er ' + d + ' bare mulig i ' + cellList(spots) +
                  ' — ' + (spots.length === 2 ? 'begge' : 'alle') + ' på samme ' + axis.navn +
                  '. Boksen må ha en ' + d + ', så den havner ' +
                  'et sted på denne ' + bestemt + '. Derfor kan ' + d + ' strykes fra resten av ' +
                  axis.navn + ' ' + (line + 1) + ': ' + cellList(elim.map(e => e.cell)) + '.'
          });
        }
      }
    }
    return null;
  }

  // Krav: i en rad/kolonne ligger alle forekomster av d i samme boks.
  function claiming(state) {
    for (let ui = 0; ui < 18; ui++) {          // bare rader og kolonner
      const u = UNITS[ui];
      for (let d = 1; d <= 9; d++) {
        const spots = spotsFor(state, u.cells, d);
        if (!spots || spots.length < 2 || spots.length > 3) continue;

        const b = boxOf(spots[0]);
        if (!spots.every(i => boxOf(i) === b)) continue;

        const elim = C.BOXES[b]
          .filter(i => !u.cells.includes(i) && !state.v[i] && (state.cand[i] & (1 << d)))
          .map(cell => ({ cell, digit: d }));
        if (!elim.length) continue;

        return step({
          id: 'claiming', name: 'Låst kandidat (krav)', level: 3,
          cells: spots, unitCells: u.cells, digits: [d], eliminations: elim,
          short: d + ' i ' + unitName(u) + ' må stå i boks ' + (b + 1) + '.',
          text: 'I ' + unitName(u) + ' er ' + d + ' bare mulig i ' + cellList(spots) +
                ', og ' + (spots.length === 2 ? 'begge' : 'alle') + ' ligger i boks ' + (b + 1) +
                '. Siden ' + BESTEMT[u.kind] + ' må ha en ' + d +
                ', er den låst til denne boksen, og ' + d + ' kan strykes fra de andre cellene i ' +
                'boks ' + (b + 1) + ': ' + cellList(elim.map(e => e.cell)) + '.'
        });
      }
    }
    return null;
  }

  /* ---------- Teknikk 4/6/8: nakne delmengder ---------- */

  const SUBSET_NAVN = { 2: 'par', 3: 'trippel', 4: 'kvadruppel' };

  function nakedSubset(size, level) {
    return function (state) {
      for (let ui = 0; ui < UNITS.length; ui++) {
        const u = UNITS[ui];
        const open = unsolved(state, u.cells)
          .filter(i => POPCOUNT[state.cand[i]] >= 2 && POPCOUNT[state.cand[i]] <= size);
        if (open.length <= size) continue;

        for (const combo of combinations(open, size)) {
          let mask = 0;
          combo.forEach(i => mask |= state.cand[i]);
          if (POPCOUNT[mask] !== size) continue;

          const digits = digitsOf(mask);
          const elim = [];
          for (const i of unsolved(state, u.cells)) {
            if (combo.includes(i)) continue;
            for (const d of digits) if (state.cand[i] & (1 << d)) elim.push({ cell: i, digit: d });
          }
          if (!elim.length) continue;

          return step({
            id: 'naked-' + size, name: 'Nakent ' + SUBSET_NAVN[size], level,
            cells: combo, unitCells: u.cells, digits, eliminations: elim,
            short: cellList(combo) + ' deler tallene ' + listOf(digits) + '.',
            text: 'I ' + unitName(u) + ' har ' + cellList(combo) + ' til sammen bare ' +
                  'kandidatene ' + listOf(digits) + '. ' + stor(ORD[size]) + ' celler som skal dele ' +
                  ORD[size] + ' tall bruker opp alle sammen, uansett hvilken rekkefølge de ' +
                  'kommer i. Ingen andre celler i ' + BESTEMT[u.kind] + ' kan derfor ha disse tallene.'
          });
        }
      }
      return null;
    };
  }

  /* ---------- Teknikk 5/7: skjulte delmengder ---------- */

  function hiddenSubset(size, level) {
    return function (state) {
      for (let ui = 0; ui < UNITS.length; ui++) {
        const u = UNITS[ui];
        const kandidatTall = [];
        const spotMap = {};
        for (let d = 1; d <= 9; d++) {
          const spots = spotsFor(state, u.cells, d);
          if (spots && spots.length >= 2 && spots.length <= size) {
            kandidatTall.push(d);
            spotMap[d] = spots;
          }
        }
        if (kandidatTall.length < size) continue;

        for (const digits of combinations(kandidatTall, size)) {
          const union = new Set();
          digits.forEach(d => spotMap[d].forEach(i => union.add(i)));
          if (union.size !== size) continue;

          let keep = 0;
          digits.forEach(d => keep |= (1 << d));

          const elim = [];
          union.forEach(i => {
            for (const d of digitsOf(state.cand[i] & ~keep)) elim.push({ cell: i, digit: d });
          });
          if (!elim.length) continue;

          const cells = Array.from(union).sort((a, b) => a - b);
          return step({
            id: 'hidden-' + size, name: 'Skjult ' + SUBSET_NAVN[size], level,
            cells, unitCells: u.cells, digits, eliminations: elim,
            short: 'Tallene ' + listOf(digits) + ' må stå i ' + cellList(cells) + '.',
            text: 'I ' + unitName(u) + ' er tallene ' + listOf(digits) + ' bare mulige i ' +
                  cellList(cells) + '. ' + stor(ORD[size]) + ' tall som må fordeles på nøyaktig ' +
                  ORD[size] + ' celler fyller dem helt opp. Alle andre kandidater i disse ' +
                  'cellene kan derfor strykes.'
          });
        }
      }
      return null;
    };
  }

  /* ---------- Teknikk 9/11: fisk (X-Wing og sverdfisk) ---------- */

  function fish(size, level, navn, id) {
    return function (state) {
      for (let d = 1; d <= 9; d++) {
        for (const dir of [{ base: ROWS, cover: COLS, idx: colOf,
                             baseNavn: 'rader', basePlural: 'radene',
                             coverNavn: 'kolonner', coverPlural: 'kolonnene' },
                           { base: COLS, cover: ROWS, idx: rowOf,
                             baseNavn: 'kolonner', basePlural: 'kolonnene',
                             coverNavn: 'rader', coverPlural: 'radene' }]) {
          const lines = [];
          for (let n = 0; n < 9; n++) {
            const spots = spotsFor(state, dir.base[n], d);
            if (spots && spots.length >= 2 && spots.length <= size) lines.push({ n, spots });
          }
          if (lines.length < size) continue;

          for (const combo of combinations(lines, size)) {
            const cover = new Set();
            combo.forEach(l => l.spots.forEach(i => cover.add(dir.idx(i))));
            if (cover.size !== size) continue;

            const baseCells = [];
            combo.forEach(l => l.spots.forEach(i => baseCells.push(i)));

            const elim = [];
            cover.forEach(c => {
              for (const i of dir.cover[c]) {
                if (state.v[i] || baseCells.includes(i)) continue;
                if (state.cand[i] & (1 << d)) elim.push({ cell: i, digit: d });
              }
            });
            if (!elim.length) continue;

            const baseNr = listOf(combo.map(l => l.n + 1));
            const coverNr = listOf(Array.from(cover).sort((a, b) => a - b).map(n => n + 1));
            return step({
              id, name: navn, level,
              cells: baseCells, digits: [d], eliminations: elim,
              short: navn + ' på ' + d + ' i ' + dir.basePlural + ' ' + baseNr + '.',
              text: 'Se på tallet ' + d + ' i ' + dir.basePlural + ' ' + baseNr + '. I hver av dem ' +
                    'er ' + d + ' begrenset til ' + dir.coverPlural + ' ' + coverNr + '. Disse ' +
                    ORD[size] + ' ' + dir.basePlural + ' trenger til sammen ' + ORD[size] +
                    ' forekomster av ' + d + ', og de får bare plass i de ' + ORD[size] + ' ' +
                    dir.coverPlural + '. Da er ' + dir.coverPlural + ' brukt opp, og ' + d +
                    ' kan strykes ellers i dem: ' + cellList(elim.map(e => e.cell)) + '.'
            });
          }
        }
      }
      return null;
    };
  }

  /* ---------- Teknikk 10: XY-Wing ---------- */

  function xyWing(state) {
    const bi = [];                                  // celler med nøyaktig to kandidater
    for (let i = 0; i < 81; i++) if (!state.v[i] && POPCOUNT[state.cand[i]] === 2) bi.push(i);

    for (const pivot of bi) {
      const wings = PEERS[pivot].filter(i => bi.includes(i));
      for (const [w1, w2] of combinations(wings, 2)) {
        const m1 = state.cand[w1], m2 = state.cand[w2], mp = state.cand[pivot];
        if (m1 === m2) continue;
        if (POPCOUNT[mp | m1 | m2] !== 3) continue;       // til sammen nøyaktig tre tall
        const shared = m1 & m2;
        if (POPCOUNT[shared] !== 1) continue;
        const z = firstDigit(shared);
        if (mp & (1 << z)) continue;                      // z må mangle i pivoten
        if (!(m1 & mp) || !(m2 & mp)) continue;

        const elim = [];
        for (let i = 0; i < 81; i++) {
          if (i === pivot || i === w1 || i === w2 || state.v[i]) continue;
          if (!PEER_SETS[w1].has(i) || !PEER_SETS[w2].has(i)) continue;
          if (state.cand[i] & (1 << z)) elim.push({ cell: i, digit: z });
        }
        if (!elim.length) continue;

        const x = firstDigit(m1 & mp), y = firstDigit(m2 & mp);
        return step({
          id: 'xy-wing', name: 'XY-Wing', level: 10,
          cells: [pivot, w1, w2], digits: digitsOf(mp | m1 | m2), eliminations: elim,
          short: 'XY-Wing med ' + cellName(pivot) + ' som omdreiningspunkt fjerner ' + z + '.',
          text: 'Omdreiningspunktet ' + cellName(pivot) + ' er enten ' + x + ' eller ' + y +
                '. Blir det ' + x + ', må vingen ' + cellName(w1) + ' bli ' + z + '. Blir det ' + y +
                ', må vingen ' + cellName(w2) + ' bli ' + z + '. Uansett havner det en ' + z +
                ' i én av vingene, så alle celler som ser begge vingene kan ikke være ' + z + ': ' +
                cellList(elim.map(e => e.cell)) + '.'
        });
      }
    }
    return null;
  }

  /* ---------- Teknikk 12: XYZ-Wing ---------- */

  /*
   * Som XY-Wing, men omdreiningspunktet har tre kandidater i stedet for to — og
   * er derfor selv med på å tvinge fram tallet. Prisen er at cellene som rammes
   * må se alle tre, ikke bare vingene.
   */
  function xyzWing(state) {
    const bi = [], tri = [];
    for (let i = 0; i < 81; i++) {
      if (state.v[i]) continue;
      const n = POPCOUNT[state.cand[i]];
      if (n === 2) bi.push(i);
      else if (n === 3) tri.push(i);
    }
    const erBi = new Set(bi);

    for (const pivot of tri) {
      const mp = state.cand[pivot];
      const wings = PEERS[pivot].filter(i => erBi.has(i) && (state.cand[i] & ~mp) === 0);
      for (const [w1, w2] of combinations(wings, 2)) {
        const m1 = state.cand[w1], m2 = state.cand[w2];
        if (m1 === m2) continue;
        if ((m1 | m2) !== mp) continue;                   // vingene dekker de tre tallene
        const shared = m1 & m2;
        if (POPCOUNT[shared] !== 1) continue;
        const z = firstDigit(shared);

        const elim = [];
        for (let i = 0; i < 81; i++) {
          if (i === pivot || i === w1 || i === w2 || state.v[i]) continue;
          if (!PEER_SETS[pivot].has(i) || !PEER_SETS[w1].has(i) || !PEER_SETS[w2].has(i)) continue;
          if (state.cand[i] & (1 << z)) elim.push({ cell: i, digit: z });
        }
        if (!elim.length) continue;

        return step({
          id: 'xyz-wing', name: 'XYZ-Wing', level: 12,
          cells: [pivot, w1, w2], digits: digitsOf(mp), eliminations: elim,
          short: 'XYZ-Wing rundt ' + cellName(pivot) + ' fjerner ' + z + '.',
          text: 'De tre cellene ' + cellName(pivot) + ', ' + cellName(w1) + ' og ' + cellName(w2) +
                ' bruker bare tallene ' + listOf(digitsOf(mp)) + ' mellom seg, og ' + z +
                ' står som mulighet i alle tre. Én av dem må bli ' + z +
                ', så en celle som ser alle tre kan ikke være det: ' +
                cellList(elim.map(e => e.cell)) + '.'
        });
      }
    }
    return null;
  }

  /* ---------- Teknikk 13: W-Wing ---------- */

  /*
   * To like tocifrede celler som ikke ser hverandre, bundet sammen av en sterk
   * lenke på det ene tallet. Da må minst én av dem bli det andre tallet — uten
   * at man vet hvilken, som er hele poenget.
   */
  function wWing(state) {
    const bi = [];
    for (let i = 0; i < 81; i++) if (!state.v[i] && POPCOUNT[state.cand[i]] === 2) bi.push(i);

    for (const [a, b] of combinations(bi, 2)) {
      if (state.cand[a] !== state.cand[b]) continue;
      if (PEER_SETS[a].has(b)) continue;
      const ds = digitsOf(state.cand[a]);

      for (const x of ds) {
        const y = ds[0] === x ? ds[1] : ds[0];
        for (const u of UNITS) {
          const spots = spotsFor(state, u.cells, x);
          if (!spots || spots.length !== 2) continue;
          const [p, q] = spots;
          if (p === a || p === b || q === a || q === b) continue;
          // Den ene enden må se den ene cella, den andre enden den andre.
          const rett = PEER_SETS[p].has(a) && PEER_SETS[q].has(b);
          const vendt = PEER_SETS[p].has(b) && PEER_SETS[q].has(a);
          if (!rett && !vendt) continue;

          const elim = [];
          for (let i = 0; i < 81; i++) {
            if (i === a || i === b || state.v[i]) continue;
            if (!PEER_SETS[a].has(i) || !PEER_SETS[b].has(i)) continue;
            if (state.cand[i] & (1 << y)) elim.push({ cell: i, digit: y });
          }
          if (!elim.length) continue;

          return step({
            id: 'w-wing', name: 'W-Wing', level: 13,
            cells: [a, b, p, q], unitCells: u.cells, digits: [x, y], eliminations: elim,
            short: 'W-Wing mellom ' + cellName(a) + ' og ' + cellName(b) + ' fjerner ' + y + '.',
            text: 'Både ' + cellName(a) + ' og ' + cellName(b) + ' er enten ' + x + ' eller ' + y +
                  '. I ' + BESTEMT[u.kind] + ' ' + (u.n + 1) + ' kan ' + x + ' bare stå i ' +
                  cellName(p) + ' eller ' + cellName(q) + ', og de ser hver sin av dem. Blir den ene ' +
                  x + ', tvinges den andre til ' + y + ' — så minst én av dem er ' + y +
                  '. Celler som ser begge kan derfor ikke være ' + y + ': ' +
                  cellList(elim.map(e => e.cell)) + '.'
          });
        }
      }
    }
    return null;
  }

  /* ---------- Teknikk 14: Farging ---------- */

  /*
   * Ett tall om gangen. Der tallet bare kan stå to steder i en enhet, er de to
   * bundet: blir den ene sann, blir den andre usann. Følger man de bindingene
   * gjennom brettet, deler cellene seg i to farger der nøyaktig én farge er den
   * sanne — og det gir to slutninger uten at man vet hvilken farge det er.
   */
  function farging(state) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;

      const nabo = new Map();
      for (const u of UNITS) {
        const spots = spotsFor(state, u.cells, d);
        if (!spots || spots.length !== 2) continue;
        const [p, q] = spots;
        if (!nabo.has(p)) nabo.set(p, []);
        if (!nabo.has(q)) nabo.set(q, []);
        nabo.get(p).push(q);
        nabo.get(q).push(p);
      }

      const farge = new Map();
      for (const start of nabo.keys()) {
        if (farge.has(start)) continue;

        const komponent = [start];
        farge.set(start, 0);
        for (let k = 0; k < komponent.length; k++) {
          const i = komponent[k];
          for (const j of nabo.get(i)) {
            if (farge.has(j)) continue;
            farge.set(j, 1 - farge.get(i));
            komponent.push(j);
          }
        }
        // Under fire celler er det ingen kjede å følge — da sier teknikken
        // ikke mer enn en låst kandidat allerede har sagt.
        if (komponent.length < 4) continue;

        const lag = [komponent.filter(i => farge.get(i) === 0),
                     komponent.filter(i => farge.get(i) === 1)];

        // Samme farge to ganger i én enhet: den fargen kan ikke være den sanne.
        for (let f = 0; f < 2; f++) {
          let par = null;
          for (const [p, q] of combinations(lag[f], 2)) if (PEER_SETS[p].has(q)) { par = [p, q]; break; }
          if (!par) continue;
          const elim = lag[f].filter(i => state.cand[i] & bit).map(i => ({ cell: i, digit: d }));
          if (!elim.length) continue;
          return step({
            id: 'farging', name: 'Farging', level: 14,
            cells: lag[1 - f], digits: [d], eliminations: elim,
            short: 'Farging på ' + d + ': den ene kjeden motsier seg selv.',
            text: 'Følger man ' + d + ' gjennom enhetene der tallet bare kan stå to steder, ' +
                  'deler cellene seg i to lag som veksler. Men ' + cellName(par[0]) + ' og ' +
                  cellName(par[1]) + ' havner i samme lag og ser hverandre — to like tall i samme ' +
                  'enhet. Det laget kan altså ikke være det sanne, og ' + d +
                  ' stryker i hele laget: ' + cellList(elim.map(e => e.cell)) + '.'
          });
        }

        // En celle utenfor kjeden som ser begge lag: uansett hvilket lag som er
        // sant, står tallet et sted den ser.
        const elim = [];
        for (let i = 0; i < 81; i++) {
          if (state.v[i] || farge.has(i) || !(state.cand[i] & bit)) continue;
          if (lag[0].some(p => PEER_SETS[i].has(p)) && lag[1].some(q => PEER_SETS[i].has(q))) {
            elim.push({ cell: i, digit: d });
          }
        }
        if (elim.length) {
          return step({
            id: 'farging', name: 'Farging', level: 14,
            cells: komponent, digits: [d], eliminations: elim,
            short: 'Farging på ' + d + ': cellene ser begge lag.',
            text: 'Følger man ' + d + ' gjennom enhetene der tallet bare kan stå to steder, ' +
                  'deler cellene seg i to lag som veksler, og nøyaktig ett av dem er det sanne. ' +
                  cellList(elim.map(e => e.cell)) + ' ser celler i begge lag — uansett hvilket lag ' +
                  'som vinner, står det en ' + d + ' de ser, så de kan ikke selv være ' + d + '.'
          });
        }
      }
    }
    return null;
  }

  /* ---------- Teknikk 15: Unikt rektangel ---------- */

  /*
   * Bygger på at brettet har nøyaktig én løsning. Fire celler i to rader, to
   * kolonner og to bokser, der tre av dem bare rommer det samme paret, ville
   * gitt to gyldige løsninger om den fjerde også var begrenset til paret —
   * de to tallene lot seg da bytte om. Altså må den fjerde være noe annet.
   */
  function unikRektangel(state) {
    for (let i = 0; i < 81; i++) {
      if (state.v[i] || POPCOUNT[state.cand[i]] !== 2) continue;
      const par = state.cand[i];

      for (let j = 0; j < 81; j++) {
        if (j === i || state.v[j] || state.cand[j] !== par) continue;
        if (rowOf(i) !== rowOf(j)) continue;                  // to i samme rad

        for (let k = 0; k < 81; k++) {
          if (state.v[k] || state.cand[k] !== par) continue;
          if (rowOf(k) === rowOf(i)) continue;
          if (colOf(k) !== colOf(i) && colOf(k) !== colOf(j)) continue;

          const kol4 = colOf(k) === colOf(i) ? colOf(j) : colOf(i);
          const l = rowOf(k) * 9 + kol4;
          if (state.v[l]) continue;
          if ((state.cand[l] & par) !== par) continue;        // må romme begge
          if (state.cand[l] === par) continue;                // da er brettet flertydig

          // Nøyaktig to bokser — ellers er ikke ombyttet garantert lovlig
          const bokser = new Set([boxOf(i), boxOf(j), boxOf(k), boxOf(l)]);
          if (bokser.size !== 2) continue;

          const elim = digitsOf(par).map(d => ({ cell: l, digit: d }));
          return step({
            id: 'unikt-rektangel', name: 'Unikt rektangel', level: 15,
            cells: [i, j, k, l], digits: digitsOf(par), eliminations: elim,
            short: 'Unikt rektangel: ' + cellName(l) + ' kan ikke være ' +
                   listOf(digitsOf(par)) + '.',
            text: 'De fire cellene ' + cellName(i) + ', ' + cellName(j) + ', ' + cellName(k) +
                  ' og ' + cellName(l) + ' står i to rader, to kolonner og to bokser. De tre ' +
                  'første rommer bare ' + listOf(digitsOf(par)) + '. Var ' + cellName(l) +
                  ' også begrenset til de to, kunne tallene byttes om i alle fire uten at noe ' +
                  'ble ulovlig — og brettet ville hatt to løsninger. Et sudoku har én, så ' +
                  cellName(l) + ' må være noe annet: ' + listOf(digitsOf(par)) + ' strykes der.'
          });
        }
      }
    }
    return null;
  }

  /* ---------- Teknikk 16: Tvungen kjede ---------- */

  /*
   * Siste utvei, og den eneste som prøver seg fram: sett et av de to tallene i
   * en tocellet rute og følg enerne så langt de rekker. Ender det i en celle
   * uten kandidater, eller en enhet uten plass til et tall, var antakelsen
   * umulig — og det andre tallet står fast.
   *
   * Ikke gjetting: motsigelsen er et bevis, og kjeden fram til den er
   * forklaringen. Men den er dyr, så den kjøres bare når alt annet er prøvd.
   */
  function tvungenKjede(state) {
    for (let i = 0; i < 81; i++) {
      if (state.v[i] || POPCOUNT[state.cand[i]] !== 2) continue;
      const [d1, d2] = digitsOf(state.cand[i]);

      for (const [anta, folger] of [[d1, d2], [d2, d1]]) {
        const kjede = prov(state, i, anta);
        if (!kjede) continue;
        return step({
          id: 'tvungen-kjede', name: 'Tvungen kjede', level: 16,
          // Sporet kan være tretti celler langt. Bare ruta som får tallet er
          // hovedsaken; de første leddene vises dempet så veien er til å følge.
          cells: [i], unitCells: kjede.spor.slice(0, 12).map(s => s.cell),
          digits: [anta, folger],
          placement: { cell: i, digit: folger },
          short: cellName(i) + ' kan ikke være ' + anta + ', så den må være ' + folger + '.',
          text: cellName(i) + ' er enten ' + anta + ' eller ' + folger + '. Sett at den er ' +
                anta + ': ' + kjede.spor.slice(0, 4).map(s =>
                  'da må ' + cellName(s.cell) + ' bli ' + s.digit).join(', ') +
                (kjede.spor.length > 4 ? ', og så videre' : '') + ' — og til slutt ' +
                kjede.grunn + '. Det går ikke, så ' + cellName(i) + ' er ' + folger + '.'
        });
      }
    }
    return null;
  }

  /** Følger enerne fra en antakelse. Returnerer sporet fram til en motsigelse. */
  function prov(state, celle, digit) {
    const v = Uint8Array.from(state.v);
    const cand = Int16Array.from(state.cand);
    const spor = [];
    const sett = (i, d) => {
      v[i] = d; cand[i] = 0;
      for (const p of PEERS[i]) cand[p] &= ~(1 << d);
    };
    sett(celle, digit);

    for (let runde = 0; runde < 81; runde++) {
      // Motsigelse? En tom celle uten kandidater, eller et tall uten plass.
      for (let i = 0; i < 81; i++) {
        if (!v[i] && cand[i] === 0) {
          return { spor, grunn: 'står ' + cellName(i) + ' igjen uten et eneste tall som passer' };
        }
      }
      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          let plasser = 0, satt = false;
          for (const c of unit.cells) {
            if (v[c] === d) { satt = true; break; }
            if (!v[c] && (cand[c] & (1 << d))) plasser++;
          }
          if (!satt && plasser === 0) {
            // Ubestemt form foran tallet: «rad 4», ikke «raden 4».
            return { spor, grunn: 'har ' + unitName(unit) + ' ingen plass igjen til ' + d };
          }
        }
      }

      // Neste ener
      let fant = false;
      for (let i = 0; i < 81 && !fant; i++) {
        if (!v[i] && POPCOUNT[cand[i]] === 1) {
          const d = firstDigit(cand[i]);
          spor.push({ cell: i, digit: d });
          sett(i, d);
          fant = true;
        }
      }
      if (!fant) {
        for (const unit of UNITS) {
          for (let d = 1; d <= 9 && !fant; d++) {
            const spots = [];
            let satt = false;
            for (const c of unit.cells) {
              if (v[c] === d) { satt = true; break; }
              if (!v[c] && (cand[c] & (1 << d))) spots.push(c);
            }
            if (!satt && spots.length === 1) {
              spor.push({ cell: spots[0], digit: d });
              sett(spots[0], d);
              fant = true;
            }
          }
          if (fant) break;
        }
      }
      if (!fant) return null;      // ingen motsigelse innen rekkevidde
    }
    return null;
  }

  /* ---------- Teknikkrekkefølge ---------- */

  const TECHNIQUES = [
    { level: 1,  run: nakedSingle },
    { level: 2,  run: hiddenSingle },
    { level: 3,  run: pointing },
    { level: 3,  run: claiming },
    { level: 4,  run: nakedSubset(2, 4) },
    { level: 5,  run: hiddenSubset(2, 5) },
    { level: 6,  run: nakedSubset(3, 6) },
    { level: 7,  run: hiddenSubset(3, 7) },
    { level: 8,  run: nakedSubset(4, 8) },
    { level: 9,  run: fish(2, 9, 'X-Wing', 'x-wing') },
    { level: 10, run: xyWing },
    { level: 11, run: fish(3, 11, 'Sverdfisk', 'swordfish') },
    { level: 12, run: xyzWing },
    { level: 13, run: wWing },
    { level: 14, run: farging },
    { level: 15, run: unikRektangel },
    { level: 16, run: tvungenKjede }
  ];

  /* ---------- Tilstand og anvendelse ---------- */

  /** Løsertilstand fra brettet. `elim` er valgfrie kandidater brukeren/hint har strøket. */
  function makeState(values, elim) {
    const cand = C.candidatesFrom(values);
    if (elim) for (let i = 0; i < 81; i++) cand[i] &= ~elim[i];
    return { v: Uint8Array.from(values), cand };
  }

  function applyStep(state, s) {
    for (const e of s.eliminations) state.cand[e.cell] &= ~(1 << e.digit);
    if (s.placement) {
      const { cell, digit } = s.placement;
      state.v[cell] = digit;
      state.cand[cell] = 0;
      for (const p of PEERS[cell]) state.cand[p] &= ~(1 << digit);
    }
  }

  function findStep(state) {
    for (const t of TECHNIQUES) {
      const s = t.run(state);
      if (s) return s;
    }
    return null;
  }

  /* ---------- Gradering ---------- */

  /*
   * Nivågrensene følger hvilke teknikker som faktisk blir *nødvendige*, ikke
   * hvor avanserte de høres ut. Tripler, kvadrupler og X-Wing kan nesten
   * alltid erstattes av noe enklere og dukker sjelden opp som eneste utvei,
   * mens XY-Wing er den vanlige toppteknikken. Derfor deler nivå 6–11 ett
   * bånd, og «vanskelig» er par-teknikkene.
   */
  /*
   * Båndene er satt etter måling, ikke etter hvor avanserte teknikkene høres ut.
   * `tester/maaling.js` skriver ut fordelingen; disse tallene er hentet derfra.
   *
   * Fordelingen er svært skjev. Nakent kvadruppel, X-Wing og sverdfisk blir
   * knapt noen gang den vanskeligste teknikken et brett krever — noe enklere
   * holder nesten alltid — så de kan ikke bære et bånd alene, og deler et med
   * triplene og XY-Wing. W-Wing er derimot tett (6,6 %) og bærer Ekspert.
   */
  /*
   * Over Mester holder det ikke å skille på teknikk. Tvungen kjede topper 25 %
   * av alle dypt utgravde brett — mer enn alle de harde teknikkene til sammen —
   * og ett bånd der ville vært like grovt som å slå sammen Lett og Ekspert.
   * Derfor teller de fire øverste også *hvor mange* kjeder som trengs. Det er
   * det eneste målet på motstand som finnes når ingen skarpere teknikk står
   * igjen. Andelene bak er målt over 400 brett.
   */
  const NIVAAER = [
    { id: 'lett',       navn: 'Lett',       maks: 2 },
    { id: 'middels',    navn: 'Middels',    maks: 3 },
    { id: 'krevende',   navn: 'Krevende',   maks: 4 },
    { id: 'vanskelig',  navn: 'Vanskelig',  maks: 5 },
    { id: 'beinhard',   navn: 'Beinhard',   maks: 11 },
    { id: 'ekspert',    navn: 'Ekspert',    maks: 13 },
    { id: 'mester',     navn: 'Mester',     maks: 14 },                  // farging
    { id: 'stormester', navn: 'Stormester', maks: 15 },                  // unikt rektangel, ~1,3 %
    { id: 'virtuos',    navn: 'Virtuos',    maks: 16, kjeder: 1 },       // ~16,5 %
    { id: 'titan',      navn: 'Titan',      maks: 16, kjeder: 2 },       // ~5,5 %
    { id: 'orakel',     navn: 'Orakel',     maks: 16, kjeder: 3 },       // ~2,3 %
    { id: 'legende',    navn: 'Legende',    maks: 16, kjeder: Infinity } // ~0,8 %
  ];

  const KJEDE = 'Tvungen kjede';

  /** Hvor mange tvungne kjeder trengte løsningen? */
  function kjedetall(brukt) {
    return (brukt && brukt[KJEDE]) || 0;
  }

  /** Båndet en gradering havner i. Tar hele graderingen, ikke bare maks. */
  function nivaaFor(maks, brukt) {
    const n = NIVAAER.find(niv => maks <= niv.maks &&
      (niv.kjeder === undefined || kjedetall(brukt) <= niv.kjeder));
    return n || NIVAAER[NIVAAER.length - 1];
  }

  /**
   * Løser puslespillet med teknikkene over og rapporterer hvor hardt det var.
   * `solved: false` betyr at teknikkene våre ikke rekker helt fram.
   */
  function grade(values) {
    const state = makeState(values, null);
    let maks = 0, maksNavn = '', antall = 0;
    const brukt = {};

    for (;;) {
      let tomme = 0;
      for (let i = 0; i < 81; i++) if (!state.v[i]) tomme++;
      if (tomme === 0) break;

      const s = findStep(state);
      // Utenfor rekkevidde: da er det øverste nivået det nærmeste vi kan si.
      // Indeksen leses fra lista, ikke skrevet som et tall — den sto som
      // NIVAAER[3] fra da det fantes nøyaktig fire nivåer.
      if (!s) return { solved: false, maks, maksNavn, antall, brukt, nivaa: NIVAAER[NIVAAER.length - 1] };

      if (s.level > maks) { maks = s.level; maksNavn = s.name; }
      antall++;
      brukt[s.name] = (brukt[s.name] || 0) + 1;
      applyStep(state, s);
    }
    return { solved: true, maks, maksNavn, antall, brukt, kjeder: kjedetall(brukt),
             nivaa: nivaaFor(maks, brukt) };
  }

  global.SudokuSolver = { TECHNIQUES, NIVAAER, makeState, findStep, applyStep, grade, nivaaFor };

})(window);
