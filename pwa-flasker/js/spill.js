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

  // En ferdigsortert flaske renner ned i vulkanen og står igjen tom. Det er
  // hele vrien i spillet: plassen kommer tilbake, så et brett som ser umulig
  // trangt ut, løsner så snart den første fargen er i havn.
  //
  // Returnerer hva som ble tappet, slik at grensesnittet kan animere det.
  function tapp(flasker, kapasitet) {
    var tappet = [];
    for (var i = 0; i < flasker.length; i++) {
      if (erKomplett(flasker[i], kapasitet)) {
        tappet.push({ flaske: i, farge: flasker[i][0] });
        flasker[i] = [];
      }
    }
    return tappet;
  }

  // Fordi hver ferdig farge forsvinner ned i vulkanen, er brettet løst
  // nøyaktig når alle flaskene står tomme.
  function erFerdig(flasker) {
    for (var i = 0; i < flasker.length; i++) {
      if (flasker[i].length) return false;
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
      if (!a.length) continue;
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
          // Å fylle en flaske helt tapper den ned i vulkanen og gir plassen
          // tilbake. Det er nesten alltid rett trekk, så det veier tyngst.
          if (b.length + antall === kapasitet) poeng += 90;
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
      if (erFerdig(st)) return true;
      if (++teller > grense) return false;
      var k = nokkel(st);
      if (sett[k]) return false;
      sett[k] = 1;

      var trekk = trekkListe(st, kapasitet);
      for (var i = 0; i < trekk.length; i++) {
        var t = trekk[i];
        var ny = kopi(st);
        helle(ny, t.fra, t.til, t.antall);
        tapp(ny, kapasitet);      // tappingen er automatisk, altså del av trekket
        sti.push(t);
        if (sok(ny)) return true;
        sti.pop();
      }
      return false;
    }

    var start = kopi(flasker);
    tapp(start, kapasitet);
    return sok(start) ? sti.slice() : null;
  }

  /* ---------- nivåene ---------- */

  // Kurven er satt etter at femåringen gikk lei: den gamle brukte tjue nivåer
  // på å komme til fem farger. Nå er den der på nivå sju.
  //
  // Den harde skruen er den siste tomme flasken, ikke fargene. Med to tomme
  // kan man prøve seg fram nesten fritt; med én må hvert trekk peke mot en
  // farge som blir ferdig, for det er tappingen som gir plassen tilbake.
  // Under én tom flaske finnes det ingen lovlige trekk i det hele tatt.
  function nivaaOppsett(n) {
    var t;
    if (n <= 2)       t = { farger: 3,  kapasitet: 3, tomme: 2 };
    else if (n <= 4)  t = { farger: 4,  kapasitet: 3, tomme: 2 };
    else if (n <= 6)  t = { farger: 4,  kapasitet: 4, tomme: 2 };
    else if (n <= 9)  t = { farger: 5,  kapasitet: 4, tomme: 2 };
    else if (n <= 12) t = { farger: 6,  kapasitet: 4, tomme: 2 };
    else if (n <= 16) t = { farger: 6,  kapasitet: 4, tomme: 1 };
    else if (n <= 20) t = { farger: 7,  kapasitet: 4, tomme: 1 };
    else if (n <= 25) t = { farger: 8,  kapasitet: 4, tomme: 1 };
    else if (n <= 31) t = { farger: 9,  kapasitet: 4, tomme: 1 };
    else if (n <= 38) t = { farger: 10, kapasitet: 4, tomme: 1 };
    else              t = { farger: 10, kapasitet: 5, tomme: 1 };
    return t;
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

      // En flaske som alt er ensfarget, renner ned i vulkanen før barnet har
      // rukket å ta i den. Det ser ut som en feil, så vi deler heller på nytt.
      var gratis = false;
      for (var g = 0; g < flasker.length; g++) {
        if (erKomplett(flasker[g], o.kapasitet)) { gratis = true; break; }
      }
      if (gratis) continue;

      var fasit = loes(flasker, o.kapasitet);
      if (!fasit) continue;
      var svar = {
        flasker: flasker, kapasitet: o.kapasitet, farger: o.farger, fasit: fasit
      };
      // Krev litt substans, men ta til takke med hva vi har om det drar ut.
      if (fasit.length >= o.farger + 2) return svar;
      if (!reserve) reserve = svar;
    }

    return reserve ||
      { flasker: [[0, 1, 0], [1, 0, 1], []], kapasitet: 3, farger: 2, fasit: null };
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
    tapp: tapp,
    erFerdig: erFerdig,
    loes: loes,
    nivaaOppsett: nivaaOppsett,
    lagNivaa: lagNivaa
  };
})();
