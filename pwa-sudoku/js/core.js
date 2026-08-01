'use strict';
/*
 * core.js — kjernemodell for Sudoku.
 * Rutenett og enheter, kandidatregning, brute force-løser og puslespillgenerator.
 * Eksponeres som window.SudokuCore.
 */
(function (global) {

  /* ---------- Rutenett og enheter ---------- */

  const ALL = 0x3FE;                       // bit 1..9 satt, bit 0 ubrukt
  const rowOf = i => (i / 9) | 0;
  const colOf = i => i % 9;
  const boxOf = i => ((i / 27) | 0) * 3 + (((i % 9) / 3) | 0);

  const ROWS = [], COLS = [], BOXES = [];
  for (let n = 0; n < 9; n++) { ROWS.push([]); COLS.push([]); BOXES.push([]); }
  for (let i = 0; i < 81; i++) {
    ROWS[rowOf(i)].push(i);
    COLS[colOf(i)].push(i);
    BOXES[boxOf(i)].push(i);
  }

  const UNITS = [];
  ROWS.forEach((cells, n) => UNITS.push({ kind: 'rad', n, cells }));
  COLS.forEach((cells, n) => UNITS.push({ kind: 'kolonne', n, cells }));
  BOXES.forEach((cells, n) => UNITS.push({ kind: 'boks', n, cells }));

  const PEERS = [];      // de 20 cellene som deler enhet med cellen
  for (let i = 0; i < 81; i++) {
    const set = new Set();
    UNITS.forEach(u => {
      if (u.cells.indexOf(i) === -1) return;
      u.cells.forEach(j => { if (j !== i) set.add(j); });
    });
    PEERS.push(Array.from(set));
  }
  const PEER_SETS = PEERS.map(p => new Set(p));

  /* ---------- Bitmaske-hjelpere ---------- */

  const POPCOUNT = new Uint8Array(1024);
  for (let m = 1; m < 1024; m++) POPCOUNT[m] = POPCOUNT[m >> 1] + (m & 1);

  function digitsOf(mask) {
    const out = [];
    for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d);
    return out;
  }
  function firstDigit(mask) {
    for (let d = 1; d <= 9; d++) if (mask & (1 << d)) return d;
    return 0;
  }

  function cellName(i) { return 'R' + (rowOf(i) + 1) + 'K' + (colOf(i) + 1); }

  /** «R1K1, R2K4 og R5K9» — oppramsing i brettrekkefølge med «og» til slutt. */
  function cellList(cells) {
    const navn = cells.slice().sort((a, b) => a - b).map(cellName);
    if (navn.length < 2) return navn.join('');
    return navn.slice(0, -1).join(', ') + ' og ' + navn[navn.length - 1];
  }
  function unitName(u) { return u.kind + ' ' + (u.n + 1); }

  /* ---------- Kandidater ---------- */

  /** Grunnkandidater utledet direkte av tallene på brettet. */
  function candidatesFrom(values) {
    const cand = new Int16Array(81);
    for (let i = 0; i < 81; i++) {
      if (values[i]) continue;
      let m = ALL;
      const peers = PEERS[i];
      for (let k = 0; k < peers.length; k++) {
        const d = values[peers[k]];
        if (d) m &= ~(1 << d);
      }
      cand[i] = m;
    }
    return cand;
  }

  /* ---------- Brute force-løser med propagering ---------- */

  function emptyState() {
    const st = { v: new Uint8Array(81), cand: new Int16Array(81) };
    st.cand.fill(ALL);
    return st;
  }

  function cloneState(st) {
    return { v: st.v.slice(), cand: st.cand.slice() };
  }

  function eliminate(st, i, d) {
    const b = 1 << d;
    if (!(st.cand[i] & b)) return true;
    st.cand[i] &= ~b;
    return st.v[i] !== 0 || st.cand[i] !== 0;
  }

  function assign(st, i, d) {
    if (!(st.cand[i] & (1 << d))) return false;
    st.v[i] = d;
    st.cand[i] = 1 << d;
    const peers = PEERS[i];
    for (let k = 0; k < peers.length; k++) {
      if (!eliminate(st, peers[k], d)) return false;
    }
    return true;
  }

  function stateFrom(values) {
    const st = emptyState();
    for (let i = 0; i < 81; i++) {
      const d = values[i];
      if (d && !assign(st, i, d)) return null;
    }
    return st;
  }

  /** Kjører nakne og skjulte enere til fikspunkt. Returnerer false ved motsigelse. */
  function propagate(st) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < 81; i++) {
        if (st.v[i]) continue;
        const c = st.cand[i];
        if (c === 0) return false;
        if (POPCOUNT[c] === 1) {
          if (!assign(st, i, firstDigit(c))) return false;
          changed = true;
        }
      }
      for (let ui = 0; ui < UNITS.length; ui++) {
        const cells = UNITS[ui].cells;
        for (let d = 1; d <= 9; d++) {
          const b = 1 << d;
          let count = 0, spot = -1, placed = false;
          for (let k = 0; k < 9; k++) {
            const i = cells[k];
            if (st.v[i] === d) { placed = true; break; }
            if (st.v[i] === 0 && (st.cand[i] & b)) { count++; spot = i; }
          }
          if (placed) continue;
          if (count === 0) return false;
          if (count === 1) {
            if (!assign(st, spot, d)) return false;
            changed = true;
          }
        }
      }
    }
    return true;
  }

  function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** Dybdesøk med MRV. Samler inntil `limit` løsninger i `out`. */
  function search(st, limit, out, rng) {
    if (!propagate(st)) return 0;

    let best = -1, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (st.v[i]) continue;
      const n = POPCOUNT[st.cand[i]];
      if (n < bestCount) { bestCount = n; best = i; if (n === 2) break; }
    }
    if (best === -1) { out.push(st.v.slice()); return 1; }

    let order = digitsOf(st.cand[best]);
    if (rng) order = shuffled(order, rng);

    let found = 0;
    for (let k = 0; k < order.length; k++) {
      const next = cloneState(st);
      if (!assign(next, best, order[k])) continue;
      found += search(next, limit - found, out, rng);
      if (found >= limit) break;
    }
    return found;
  }

  /** Antall løsninger, talt opp til `limit`. */
  function countSolutions(values, limit) {
    const st = stateFrom(values);
    if (!st) return 0;
    return search(st, limit || 2, [], null);
  }

  function randomSolution(rng) {
    const out = [];
    search(emptyState(), 1, out, rng);
    return out[0] || null;
  }

  global.SudokuCore = {
    UNITS, PEERS, PEER_SETS, ROWS, COLS, BOXES,
    POPCOUNT, digitsOf, firstDigit,
    rowOf, colOf, boxOf, cellName, cellList, unitName,
    candidatesFrom, countSolutions, randomSolution, shuffled
  };

})(window);
