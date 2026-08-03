/*
 * Spillogikken til Fargeflasker – rene funksjoner, ingen DOM.
 *
 * En flaske er en liste med fargenumre der indeks 0 er bunnen. Et nivå er
 * løst når hver flaske enten er tom eller full av én farge.
 *
 * Nivåene lages ved å stokke fargene tilfeldig og deretter la løseren
 * sjekke at det faktisk går an. Alternativet – å stokke "baklengs" fra et
 * ferdig brett – gir ofte nivåer som løser seg selv, og et barn som aldri
 * møter motstand kjeder seg like fort som et barn som står fast.
 */
'use strict';

var Spill = (function () {

  /* Fargene er valgt for å være lette å skille fra hverandre, også for et
     barn som ennå ikke kan navnene på dem. */
  var FARGER = [
    { navn: 'rød',     kode: '#f4483c', lys: '#ff7b70' },
    { navn: 'blå',     kode: '#2f74e8', lys: '#6ea3ff' },
    { navn: 'gul',     kode: '#ffc61a', lys: '#ffe07a' },
    { navn: 'grønn',   kode: '#33bf4c', lys: '#79e58c' },
    { navn: 'lilla',   kode: '#9b5de5', lys: '#c39bff' },
    { navn: 'oransje', kode: '#ff8c2b', lys: '#ffb877' },
    { navn: 'rosa',    kode: '#ff7ec4', lys: '#ffb2dc' },
    { navn: 'turkis',  kode: '#1fcfd4', lys: '#7ceef1' },
    { navn: 'lime',    kode: '#b9e01f', lys: '#dcf277' },
    { navn: 'brun',    kode: '#a9714b', lys: '#cd9d7c' }
  ];

  /* ---------- småting ---------- */

  // Mulberry32: liten og god nok tilfeldighetsgenerator. Poenget med å ha
  // en egen er at nivå 7 skal se likt ut hver gang – et barn liker å kjenne
  // igjen brettet det holdt på med i går.
  function lagTilfeldig(fro) {
    var a = fro >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stokk(liste, tilfeldig) {
    for (var i = liste.length - 1; i > 0; i--) {
      var j = Math.floor(tilfeldig() * (i + 1));
      var m = liste[i]; liste[i] = liste[j]; liste[j] = m;
    }
    return liste;
  }

  function kopi(flasker) {
    return flasker.map(function (f) { return f.slice(); });
  }

  function toppFarge(flaske) {
    return flaske.length ? flaske[flaske.length - 1] : -1;
  }

  // Hvor mange enheter av samme farge ligger øverst?
  function toppAntall(flaske) {
    if (!flaske.length) return 0;
    var farge = flaske[flaske.length - 1], n = 1;
    for (var i = flaske.length - 2; i >= 0 && flaske[i] === farge; i--) n++;
    return n;
  }

  function ensfarget(flaske) {
    for (var i = 1; i < flaske.length; i++) if (flaske[i] !== flaske[0]) return false;
    return flaske.length > 0;
  }

  function erKomplett(flaske, kapasitet) {
    return flaske.length === kapasitet && ensfarget(flaske);
  }

  /* ---------- reglene ---------- */

  // Returnerer hvor mange enheter som kan helles fra -> til, eller 0.
  function kanHelle(flasker, fra, til, kapasitet) {
    if (fra === til) return 0;
    var a = flasker[fra], b = flasker[til];
    if (!a.length || b.length >= kapasitet) return 0;
    if (b.length && toppFarge(b) !== toppFarge(a)) return 0;
    return Math.min(toppAntall(a), kapasitet - b.length);
  }

  function helle(flasker, fra, til, antall) {
    for (var i = 0; i < antall; i++) flasker[til].push(flasker[fra].pop());
  }

  function erFerdig(flasker, kapasitet) {
    for (var i = 0; i < flasker.length; i++) {
      var f = flasker[i];
      if (f.length !== 0 && !erKomplett(f, kapasitet)) return false;
    }
    return true;
  }

  /* ---------- løser ---------- */

  // To brett er det samme brettet om flaskene bare står i en annen
  // rekkefølge, så nøkkelen sorteres før den havner i "sett".
  function nokkel(flasker) {
    return flasker.map(function (f) { return f.join(','); }).sort().join('|');
  }

  // Kandidattrekk, best først. Rekkefølgen er det som gjør dybdesøket raskt
  // nok til å brukes både til nivågenerering og til hint.
  function trekkListe(flasker, kapasitet) {
    var trekk = [];
    for (var fra = 0; fra < flasker.length; fra++) {
      var a = flasker[fra];
      if (!a.length || erKomplett(a, kapasitet)) continue;
      for (var til = 0; til < flasker.length; til++) {
        var antall = kanHelle(flasker, fra, til, kapasitet);
        if (!antall) continue;
        var b = flasker[til];
        // Å flytte hele innholdet av en ensfarget flaske til en tom flaske
        // endrer ingenting – bare hvilken flaske fargen står i.
        if (!b.length && ensfarget(a)) continue;

        var poeng = 0;
        if (b.length) {
          poeng += 40;                                          // fyller på riktig farge
          if (b.length + antall === kapasitet) poeng += 60;      // gjør flasken ferdig
        }
        if (antall === a.length) poeng += 15;                    // tømmer kilden
        poeng += antall;
        trekk.push({ fra: fra, til: til, antall: antall, poeng: poeng });
      }
    }
    trekk.sort(function (x, y) { return y.poeng - x.poeng; });
    return trekk;
  }

  // Dybdesøk med besøkt-mengde. Returnerer en liste med trekk, eller null
  // om brettet ikke lar seg løse innenfor grensen.
  function loes(flasker, kapasitet, grense) {
    grense = grense || 80000;
    var sett = {}, sti = [], teller = 0;

    function sok(st) {
      if (erFerdig(st, kapasitet)) return true;
      if (++teller > grense) return false;
      var k = nokkel(st);
      if (sett[k]) return false;
      sett[k] = 1;

      var trekk = trekkListe(st, kapasitet);
      for (var i = 0; i < trekk.length; i++) {
        var t = trekk[i];
        var ny = kopi(st);
        helle(ny, t.fra, t.til, t.antall);
        sti.push(t);
        if (sok(ny)) return true;
        sti.pop();
      }
      return false;
    }

    return sok(kopi(flasker)) ? sti.slice() : null;
  }

  /* ---------- nivåene ---------- */

  // Vanskegraden vokser med antall farger, ikke ved å ta bort de tomme
  // flaskene. To tomme flasker hele veien gir rom for å prøve seg fram,
  // og det er akkurat det en femåring trenger.
  function nivaaOppsett(n) {
    var farger;
    if (n <= 2) farger = 2;
    else if (n <= 5) farger = 3;
    else if (n <= 9) farger = 4;
    else if (n <= 13) farger = 5;
    else if (n <= 17) farger = 6;
    else if (n <= 22) farger = 7;
    else if (n <= 28) farger = 8;
    else if (n <= 35) farger = 9;
    else farger = 10;
    // Små flasker de første nivåene: tre lag er lettere å holde styr på.
    return { farger: farger, kapasitet: n <= 6 ? 3 : 4, tomme: 2 };
  }

  function lagNivaa(n) {
    var o = nivaaOppsett(n);
    var tilfeldig = lagTilfeldig(n * 7919 + 13);
    var reserve = null;

    for (var forsok = 0; forsok < 400; forsok++) {
      var enheter = [];
      for (var f = 0; f < o.farger; f++) {
        for (var i = 0; i < o.kapasitet; i++) enheter.push(f);
      }
      stokk(enheter, tilfeldig);

      var flasker = [];
      for (var b = 0; b < o.farger; b++) {
        flasker.push(enheter.slice(b * o.kapasitet, (b + 1) * o.kapasitet));
      }
      for (var t = 0; t < o.tomme; t++) flasker.push([]);
      if (erFerdig(flasker, o.kapasitet)) continue;

      var fasit = loes(flasker, o.kapasitet);
      if (!fasit) continue;
      // Krev litt substans, men ta til takke med hva vi har om det drar ut.
      if (fasit.length >= o.farger + 1) {
        return { flasker: flasker, kapasitet: o.kapasitet, fasit: fasit };
      }
      if (!reserve) reserve = { flasker: flasker, kapasitet: o.kapasitet, fasit: fasit };
    }

    return reserve || { flasker: [[0, 0, 0], [0], []], kapasitet: 3, fasit: null };
  }

  return {
    FARGER: FARGER,
    kopi: kopi,
    toppFarge: toppFarge,
    toppAntall: toppAntall,
    ensfarget: ensfarget,
    erKomplett: erKomplett,
    kanHelle: kanHelle,
    helle: helle,
    erFerdig: erFerdig,
    loes: loes,
    nivaaOppsett: nivaaOppsett,
    lagNivaa: lagNivaa
  };
})();
