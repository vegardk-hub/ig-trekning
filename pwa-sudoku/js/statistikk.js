'use strict';
/*
 * statistikk.js — hvor mange brett som er løst på hvert nivå, og hvor fort.
 *
 * Egen lagringsnøkkel, ikke sammen med brettet: brettet skrives over hver gang
 * du starter et nytt spill, og statistikken er nettopp det som skal overleve
 * det. Modulen kjenner bare tall og lagring — hvordan de vises, er app.js sitt.
 */
(function () {

  const LAGER = 'sudoku-stat-v1';
  const NIVAAER = ['lett', 'middels', 'vanskelig', 'ekspert'];

  const tom = () => ({ lost: 0, beste: 0, sum: 0 });

  /**
   * Leser statistikken, alltid med alle fire nivåene til stede — da slipper de
   * som viser den å sjekke om et nivå finnes ennå.
   */
  function hent() {
    const ut = {};
    NIVAAER.forEach(n => { ut[n] = tom(); });
    try {
      const d = JSON.parse(localStorage.getItem(LAGER));
      if (d) NIVAAER.forEach(n => {
        const r = d[n];
        if (!r) return;
        /* Tallene vaskes på vei inn. En NaN herfra ville forplantet seg til
           snittet og blitt liggende i lagringen for godt, uten at noe klaget. */
        const tall = x => { const v = Number(x); return v > 0 && isFinite(v) ? v : 0; };
        ut[n] = { lost: Math.floor(tall(r.lost)), beste: tall(r.beste), sum: tall(r.sum) };
      });
    } catch (e) { /* privat modus e.l. — vis tomt heller enn å feile */ }
    return ut;
  }

  function skriv(alt) {
    try { localStorage.setItem(LAGER, JSON.stringify(alt)); } catch (e) { /* som over */ }
  }

  /**
   * Fører et løst brett, og svarer om tiden er den beste på nivået.
   *
   * Det aller første brettet på et nivå er teknisk sett en rekord, men å si
   * «ny rekord!» om noe det ikke finnes noe å slå på, er hult. Derfor kreves
   * det at det står et resultat fra før.
   */
  function registrer(nivaa, ms) {
    if (NIVAAER.indexOf(nivaa) < 0 || !(ms > 0)) return false;
    const alt = hent();
    const r = alt[nivaa];
    const forbedret = r.beste === 0 || ms < r.beste;
    const rekord = forbedret && r.lost > 0;
    r.lost += 1;
    r.sum += ms;
    if (forbedret) r.beste = ms;
    skriv(alt);
    return rekord;
  }

  function nullstill() {
    try { localStorage.removeItem(LAGER); } catch (e) { /* som over */ }
  }

  window.SudokuStatistikk = { LAGER, NIVAAER, hent, registrer, nullstill };

})();
