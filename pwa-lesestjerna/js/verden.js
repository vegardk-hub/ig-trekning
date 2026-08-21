/* Verden: skjermen der han velger hva han vil lese om.
 *
 * Dette er forloeperen til det haandtegnede kartet. Foreloepig ett kort per
 * emne, men rollen er den samme: velge et sted, faa en tekst derfra. Kommer
 * det et nytt emne i tekster.json, dukker kortet opp av seg selv.
 *
 * Merkene er tegnet her i stedet for aa vaere bilder. De skal byttes ut med
 * Kenney-grafikk i steg 6, og inntil da er en strek som skalerer bedre enn en
 * plassholder-firkant.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  var FARGER = {
    skog: "#2f7d4f",
    fjell: "#5b7a99",
    hav: "#1f6f8b",
    by: "#a8652f",
    stjerne: "#4b3f8f"
  };
  var RESERVE = "#6b727a";

  /* Strekene er hvite paa farget bunn, saa de holder seg lesbare uansett emne. */
  var MERKER = {
    skog: '<path d="M12 2 L19 12 H15 L21 21 H3 L9 12 H5 Z"/>',
    fjell: '<path d="M2 20 L9 6 L13 13 L16 9 L22 20 Z"/>',
    hav: '<path d="M2 9c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 4 0 4 0" ' +
         'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    by: '<path d="M4 21V9l5-4 5 4v12z"/><path d="M16 21V12h4v9z"/>',
    stjerne: '<circle cx="12" cy="12" r="4.6"/>' +
             '<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1' +
             'M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" ' +
             'fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>'
  };

  var paaValgt = null;   // settes av app.js

  function merke(emneId, farge) {
    var d = document.createElement("div");
    d.className = "merke";
    d.style.background = farge;
    d.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                  (MERKER[emneId] || '<circle cx="12" cy="12" r="7"/>') + "</svg>";
    return d;
  }

  function kort(e) {
    var farge = FARGER[e.id] || RESERVE;

    var k = document.createElement("button");
    k.className = "emne";
    k.type = "button";
    k.dataset.emne = e.id;

    var tekst = document.createElement("div");
    tekst.className = "innhold";

    var navn = document.createElement("div");
    navn.className = "navn";
    navn.textContent = e.navn;

    var under = document.createElement("div");
    under.className = "under";
    under.textContent = e.under || "";

    var stolpe = document.createElement("div");
    stolpe.className = "stolpe";
    var fyll = document.createElement("i");
    fyll.style.width = (e.antall ? Math.round(100 * e.lest / e.antall) : 0) + "%";
    fyll.style.background = farge;
    stolpe.append(fyll);

    var teller = document.createElement("div");
    teller.className = "teller";
    // Naar alt er lest skal det ikke se ut som emnet er brukt opp. Han kan lese
    // om igjen sa mye han vil — det gir bare ikke mynter en gang til.
    teller.textContent = e.antall === 0
      ? "Ingen tekster her ennå"
      : e.lest >= e.antall
        ? "Alt lest \u2014 les gjerne om igjen"
        : e.lest + " av " + e.antall + " lest";

    tekst.append(navn, under, stolpe, teller);
    k.append(merke(e.id, farge), tekst);

    k.disabled = e.antall === 0;
    k.onclick = function () { if (paaValgt) paaValgt(e.id); };
    return k;
  }

  function tegn() {
    var boks = $("#emnekort");
    boks.textContent = "";
    Bank.emner().forEach(function (e) { boks.append(kort(e)); });

    // Feil i tekstbanken skjules ikke. Vegard er den eneste som kan rette dem,
    // og han ser dem bare om de staar paa skjermen.
    var feil = Bank.feil();
    $("#bankfeil").textContent = feil.length
      ? "Noe er galt i tekstbanken: " + feil.join(" ")
      : "";
  }

  global.Verden = {
    tegn: tegn,
    naarValgt: function (fn) { paaValgt = fn; }
  };
})(window);
