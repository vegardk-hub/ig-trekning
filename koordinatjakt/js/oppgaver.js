/*
 * Oppgavelista og fasiten.
 *
 * Oppgavene er i tilfeldig rekkefølge med vilje. Sorterte koordinater – A2,
 * C4, D4, F7 – lar barnet lese arket kolonnevis og gjette seg framover uten
 * å bruke tallaksen i det hele tatt. Stokket rekkefølge tvinger et ekte
 * oppslag per linje.
 *
 * Fasiten er ikke lagret noe sted: den er `ord` på det funnet oppgaven peker
 * på. Kan brettet lages på nytt fra brettnummeret, kan fasiten det også.
 */
'use strict';

var Oppgaver = (function () {

  function lag(scene, antall) {
    /* Eget såkorn fra samme brett: bytter man antall oppgaver, skal bildet
       stå helt stille. Ville oppgavene trukket fra scenens egen strøm, ville
       12 og 16 oppgaver gitt to forskjellige bilder. */
    var rng = Tilfeldig.lag(Tilfeldig.sad(scene.tema + ':oppgaver', scene.brett));
    var valgte = rng.stokk(scene.funn).slice(0, Math.min(antall, scene.funn.length));
    return valgte.map(function (f, i) {
      /* `brikke` følger med fordi skrivemodus trenger de alternative ordene
         («fjøs» for en låve), og de henger på brikken, ikke på fasiten. */
      return {
        nr: i + 1, rute: f.rute, ord: f.ord, brikke: f.brikke,
        alternativer: Brikker.alternativer(f.brikke), x: f.x, y: f.y
      };
    });
  }

  return { lag: lag };
})();
