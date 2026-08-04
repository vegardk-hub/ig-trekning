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

  /* prove: de tre fargene som vises i prøvelappen — flate, skrevne tall og
     blyantmerker. De to siste er med vilje fra hver sin side av fargesirkelen. */
  const TEMAER = [
    { id: 'papir',  navn: 'Papir',  om: 'Varmt og dempet — standarden',
      prove: ['#f2efe7', '#1f62aa', '#9a5f2b'] },
    { id: 'dag',    navn: 'Dag',    om: 'Maks kontrast, for sterkt dagslys',
      prove: ['#ffffff', '#0a4ea8', '#8a4a08'] },
    { id: 'kveld',  navn: 'Kveld',  om: 'Mørkt og varmt, uten det blå',
      prove: ['#1e1a15', '#f0a94f', '#86b87f'] },
    { id: 'natt',   navn: 'Natt',   om: 'Mørkt og kjølig',
      prove: ['#171a1f', '#6cb2f0', '#d9a05f'] },
    { id: 'system', navn: 'Følg systemet', om: 'Følger lys/mørk-innstillingen på enheten',
      prove: ['#f2efe7', '#1f62aa', '#171a1f'] }
  ];

  const BAKGRUNN = {
    papir: '#f2efe7',
    dag:   '#ffffff',
    natt:  '#171a1f',
    kveld: '#1e1a15'
  };

  /* «Sollys» het temaet før det ble hetende «Dag». Uten dette ville alle som
     hadde valgt det, falt tilbake til systemets innstilling ved neste oppstart. */
  const GAMLE_NAVN = { sollys: 'dag' };

  // Må holdes i en variabel: matchMedia() gir et nytt objekt hver gang, og en
  // lytter på et objekt ingen holder fast i kan bli ryddet bort under føttene.
  const mørkt = global.matchMedia('(prefers-color-scheme: dark)');

  function lagret() {
    let id;
    try { id = localStorage.getItem(LAGER); } catch (e) { /* privat modus */ }
    return GAMLE_NAVN[id] || id || 'system';
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
