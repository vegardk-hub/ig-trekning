'use strict';
/*
 * tema.js — fargeoppsett.
 *
 * Lastes fra <head> og setter temaet før første maling. Ligger det i app.js,
 * som lastes nederst, rekker standardfargene å blinke til først.
 *
 * Selve palettene bor i styles.css, én blokk per tema. Her ligger bare listen
 * over hva som finnes, og bakgrunnsfargene — som også brukes til
 * <meta name="theme-color">, så statuslinja på telefonen følger med.
 *
 * Eksponeres som window.SudokuTema.
 */
(function (global) {

  const LAGER = 'sudoku-tema';

  /* prove: de to fargene som vises i prøvelappen — flate og skrift. */
  const TEMAER = [
    { id: 'system', navn: 'Følg systemet', om: 'Følger lys/mørk-innstillingen på enheten',
      prove: ['#f2efe7', '#171a1f'] },
    { id: 'papir',  navn: 'Papir',  om: 'Varmt og dempet — standarden',
      prove: ['#f2efe7', '#2f6fb3'] },
    { id: 'sollys', navn: 'Sollys', om: 'Maks kontrast, for sterkt dagslys',
      prove: ['#ffffff', '#0a4ea8'] },
    { id: 'natt',   navn: 'Natt',   om: 'Mørkt og kjølig',
      prove: ['#171a1f', '#74b3f0'] },
    { id: 'kveld',  navn: 'Kveld',  om: 'Mørkt og varmt, uten det blå',
      prove: ['#1e1a15', '#efa964'] }
  ];

  const BAKGRUNN = {
    papir:  '#f2efe7',
    sollys: '#ffffff',
    natt:   '#171a1f',
    kveld:  '#1e1a15'
  };

  // Må holdes i en variabel: matchMedia() gir et nytt objekt hver gang, og en
  // lytter på et objekt ingen holder fast i kan bli ryddet bort under føttene.
  const mørkt = global.matchMedia('(prefers-color-scheme: dark)');

  function lagret() {
    try { return localStorage.getItem(LAGER) || 'system'; } catch (e) { return 'system'; }
  }

  /** «system» slås opp mot systeminnstillingen; et ekte tema er seg selv. */
  function faktisk(id) {
    if (BAKGRUNN[id]) return id;
    return mørkt.matches ? 'natt' : 'papir';
  }

  function bruk(id) {
    const t = faktisk(id);
    document.documentElement.dataset.tema = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = BAKGRUNN[t];
  }

  function velg(id) {
    try { localStorage.setItem(LAGER, id); } catch (e) { /* privat modus — gjelder økta */ }
    bruk(id);
  }

  bruk(lagret());

  // Skifter systemet mens «Følg systemet» står valgt, skal appen skifte med.
  mørkt.addEventListener('change', () => { if (lagret() === 'system') bruk('system'); });

  global.SudokuTema = { TEMAER, lagret, velg };

})(window);
