/*
 * Eksakt dekning: finner ut om en stilling går opp, og hvordan.
 *
 * Brukes tre steder – til å bygge oppgavebanken (og kreve nøyaktig én
 * løsning), til hintet, og til å si fra så snart brettet er kjørt i grøfta.
 * Derfor ligger den her, uten en eneste piksel, og kan kjøres av `node`.
 *
 * Søket fyller alltid den laveste tomme ruta. Det er det som gjør det raskt:
 * i stedet for å prøve hver brikke overalt, prøves bare de plasseringene som
 * dekker nettopp den ruta, og et hull som ingen brikke kan nå, oppdages med
 * en gang i stedet for etter at ni brikker er lagt.
 *
 * Beskjæringen med flomfyll koster lite og sparer mye: hver tom flekk må ha
 * et antall ruter som er delelig med fem, ellers er stillingen død. Uten den
 * bruker søket mesteparten av tiden i stillinger som aldri kunne gått opp.
 *
 * Fargingen er ikke et valg appen tar. Brettet kan ende med X i hjørnet eller
 * O i hjørnet, og det er den første brikka som legges som avgjør hvilken.
 * Før det må begge prøves.
 */
'use strict';

var Loeser = (function () {

  var RAD = Brikker.RAD, KOL = Brikker.KOL, N = RAD * KOL;
  var ANT = Brikker.alle.length;

  // For hver farging: alle plasseringer, og et oppslag fra rute til de
  // plasseringene som dekker ruta.
  var tabeller = [null, null];

  function tabell(farging) {
    if (tabeller[farging]) return tabeller[farging];
    var perBrikke = Brikker.alle.map(function (b) { return Brikker.plasseringer(b, farging); });
    var perRute = [];
    var i, j, p;
    for (i = 0; i < N; i++) perRute.push([]);
    for (i = 0; i < ANT; i++) {
      for (j = 0; j < perBrikke[i].length; j++) {
        p = perBrikke[i][j];
        p.brikke = i;
        p.nr = j;
        p.ruter.forEach(function (r) { perRute[r].push(p); });
      }
    }
    tabeller[farging] = { perBrikke: perBrikke, perRute: perRute };
    return tabeller[farging];
  }

  function tomtBrett() {
    var b = new Int8Array(N);
    b.fill(-1);
    return b;
  }

  // Hver tom flekk må romme et helt antall brikker.
  var besokt = new Int8Array(N);
  var ko = new Int32Array(N);
  function flekkerGarOpp(brett) {
    besokt.fill(0);
    var i, hode, hale, r, k, nabo, stor;
    for (i = 0; i < N; i++) {
      if (brett[i] !== -1 || besokt[i]) continue;
      hode = 0; hale = 0; ko[hale++] = i; besokt[i] = 1; stor = 0;
      while (hode < hale) {
        var c = ko[hode++];
        stor++;
        r = (c / KOL) | 0; k = c % KOL;
        if (k > 0)       { nabo = c - 1;   if (brett[nabo] === -1 && !besokt[nabo]) { besokt[nabo] = 1; ko[hale++] = nabo; } }
        if (k < KOL - 1) { nabo = c + 1;   if (brett[nabo] === -1 && !besokt[nabo]) { besokt[nabo] = 1; ko[hale++] = nabo; } }
        if (r > 0)       { nabo = c - KOL; if (brett[nabo] === -1 && !besokt[nabo]) { besokt[nabo] = 1; ko[hale++] = nabo; } }
        if (r < RAD - 1) { nabo = c + KOL; if (brett[nabo] === -1 && !besokt[nabo]) { besokt[nabo] = 1; ko[hale++] = nabo; } }
      }
      if (stor % 5 !== 0) return false;
    }
    return true;
  }

  /*
   * start: { brett: Int8Array(50) med -1 for tom, brukt: [bool x 10], farging: 0|1 }
   * Returnerer { losninger: [...], noder: n } der hver løsning er en liste av
   * plasseringer. `maks` stopper søket – 2 er nok for å svare på om en
   * oppgave er entydig.
   */
  function loes(start, maks) {
    var t = tabell(start.farging);
    var brett = Int8Array.from(start.brett);
    var brukt = start.brukt.slice();
    var funnet = [], valgt = [], noder = 0;

    function neste() {
      for (var i = 0; i < N; i++) if (brett[i] === -1) return i;
      return -1;
    }

    function gaa() {
      if (funnet.length >= maks) return;
      var rute = neste();
      if (rute === -1) { funnet.push(valgt.slice()); return; }
      var kandidater = t.perRute[rute], i, j, p, ok;
      for (i = 0; i < kandidater.length; i++) {
        p = kandidater[i];
        if (brukt[p.brikke]) continue;
        ok = true;
        for (j = 0; j < p.ruter.length; j++) if (brett[p.ruter[j]] !== -1) { ok = false; break; }
        if (!ok) continue;
        noder++;
        for (j = 0; j < p.ruter.length; j++) brett[p.ruter[j]] = p.brikke;
        brukt[p.brikke] = true;
        valgt.push(p);
        if (flekkerGarOpp(brett)) gaa();
        valgt.pop();
        brukt[p.brikke] = false;
        for (j = 0; j < p.ruter.length; j++) brett[p.ruter[j]] = -1;
        if (funnet.length >= maks) return;
      }
    }

    gaa();
    return { losninger: funnet, noder: noder };
  }

  function tomStart(farging) {
    return { brett: tomtBrett(), brukt: new Array(ANT).fill(false), farging: farging };
  }

  return {
    RAD: RAD, KOL: KOL, N: N, ANT: ANT,
    tabell: tabell,
    tomtBrett: tomtBrett,
    tomStart: tomStart,
    loes: loes
  };
})();

if (typeof window !== 'undefined') window.Loeser = Loeser;
