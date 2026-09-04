/*
 * Sådd tilfeldighet.
 *
 * Brettene må kunne lages på nytt. Et ark som er skrevet ut, mistet og
 * skrevet ut igjen, skal vise nøyaktig samme bilde – ellers stemmer ikke
 * svarene barnet allerede har skrevet ned. Derfor er brettnummeret såkornet,
 * og `Math.random()` finnes ikke i generatoren i det hele tatt.
 *
 * Samme lærdom som nivåene i Fargeflasker: kjenner barnet igjen brett 7, må
 * brett 7 se likt ut neste gang.
 */
'use strict';

var Tilfeldig = (function () {

  /* mulberry32 – kort, rask og god nok. Den viktige egenskapen er ikke
     statistisk kvalitet, men at den er heldeterministisk fra ett heltall. */
  function lag(sad) {
    var a = sad >>> 0;
    function neste() {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      tall: neste,
      // Heltall i [0, n)
      heltall: function (n) { return Math.floor(neste() * n); },
      // Heltall i [lav, hoy], begge med
      mellom: function (lav, hoy) { return lav + Math.floor(neste() * (hoy - lav + 1)); },
      velg: function (liste) { return liste[Math.floor(neste() * liste.length)]; },
      /* Stokker en kopi. Generatoren plukker uten tilbakelegging fra stokkede
         lister – to like dyr på samme brett gjør fasiten tvetydig. */
      stokk: function (liste) {
        var ut = liste.slice();
        for (var i = ut.length - 1; i > 0; i--) {
          var j = Math.floor(neste() * (i + 1));
          var b = ut[i]; ut[i] = ut[j]; ut[j] = b;
        }
        return ut;
      },
      sjanse: function (p) { return neste() < p; }
    };
  }

  /* Temanavnet må inn i såkornet: ellers gir «dyrehage 7» og «by 7» samme
     utlegging, og de to arkene ser mistenkelig like ut ved siden av hverandre. */
  function sad(tema, brett) {
    var h = 2166136261;
    var s = tema + '#' + brett;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  return { lag: lag, sad: sad };
})();
