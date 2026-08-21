/* Huset: rommet han eier, og det foerste han ser naar han logger seg paa.
 *
 * Huset er grunnen til at han leser. Vegards ord om myntene: «noe han bryr seg
 * om naar han kan kjoepe noe for det og putte inn i rommene sine». Derfor er
 * dette startskjermen, ikke en premie paa slutten — han skal se rommet sitt
 * foerst, og gaa ut derfra for aa tjene til det.
 *
 * Scenen er klikkbar, ikke gaabar. Doera foerer ut i verden, boka paa bordet
 * viser hvor mye han har lest. Ingenting her kan gjoeres galt.
 *
 * Alt er tegnet med streker og flater inntil videre. Kenney-moeblene kommer i
 * steg 6, og da byttes brikkene ut én for én uten at sloeyfa roeres.
 */
(function (global) {
  "use strict";

  var $ = function (v) { return document.querySelector(v); };

  // Figurvalget kommer i steg 7. Inntil da bestemmer `figur` bare fargen, og
  // en spiller uten valg faar den foerste.
  var FIGURER = [
    { klaer: "#3d6fb4", bukse: "#2b3d5c", haar: "#4a3524" },
    { klaer: "#2f7d4f", bukse: "#2b4330", haar: "#7a4a1e" },
    { klaer: "#b04a3d", bukse: "#4a2b26", haar: "#2c2118" },
    { klaer: "#6a4b9c", bukse: "#38305c", haar: "#c8933f" }
  ];

  var UKEDAGER = ["sø", "ma", "ti", "on", "to", "fr", "lø"];

  var paaUt = null;      // settes av app.js: ut i verden

  function lag(klasse, tag) {
    var d = document.createElement(tag || "div");
    if (klasse) d.className = klasse;
    return d;
  }

  function figurSvg(f) {
    return '<svg viewBox="0 0 40 76" aria-hidden="true">' +
      '<ellipse cx="20" cy="73" rx="13" ry="3" fill="rgba(0,0,0,.18)"/>' +
      '<rect x="13" y="52" width="6" height="19" rx="3" fill="' + f.bukse + '"/>' +
      '<rect x="21" y="52" width="6" height="19" rx="3" fill="' + f.bukse + '"/>' +
      '<rect x="10" y="26" width="20" height="28" rx="7" fill="' + f.klaer + '"/>' +
      '<rect x="4" y="29" width="6" height="19" rx="3" fill="' + f.klaer + '"/>' +
      '<rect x="30" y="29" width="6" height="19" rx="3" fill="' + f.klaer + '"/>' +
      '<circle cx="20" cy="15" r="11" fill="#f0c8a0"/>' +
      '<path d="M9 13a11 11 0 0 1 22 0c0-6-4-9-11-9S9 7 9 13z" fill="' + f.haar + '"/>' +
      '<circle cx="16" cy="16" r="1.6" fill="#3a2c22"/>' +
      '<circle cx="24" cy="16" r="1.6" fill="#3a2c22"/>' +
      '<path d="M16.5 20.5a5 5 0 0 0 7 0" fill="none" stroke="#3a2c22" ' +
      'stroke-width="1.5" stroke-linecap="round"/>' +
      "</svg>";
  }

  /* ---------- Rommet ---------- */

  function tegn() {
    var s = Lagring.aktiv();
    if (!s) return;

    var rom = $("#rom");
    rom.textContent = "";

    rom.append(lag("vegg"), lag("gulv"), lag("list"));

    // Vinduet er der for at rommet skal ha en utside. Stjernene bak ruta er et
    // nikk til stjernetaarnet han liker best.
    var vindu = lag("vindu");
    vindu.innerHTML = '<i class="stjerne1"></i><i class="stjerne2"></i><i class="stjerne3"></i>' +
                      '<span class="sprosse"></span>';
    rom.append(vindu);

    var doer = lag("doer", "button");
    doer.type = "button";
    doer.title = "Gå ut og les";
    doer.innerHTML = '<span class="haandtak"></span><span class="skilt">Ut</span>';
    doer.onclick = function () { if (paaUt) paaUt(); };
    rom.append(doer);

    // Boka paa bordet. Den er hele statistikken, og den ligger med vilje inne i
    // rommet i stedet for i en meny: han skal snuble over den.
    var bord = lag("bord", "button");
    bord.type = "button";
    bord.id = "bordet";
    bord.title = "Se i boka";
    bord.innerHTML = '<span class="boka"></span><span class="plate"></span>' +
                     '<span class="bein v"></span><span class="bein h"></span>';
    bord.onclick = apneBoka;
    rom.append(bord);

    var f = FIGURER[(s.figur || 0) % FIGURER.length];
    var figur = lag("figur");
    figur.innerHTML = figurSvg(f);
    rom.append(figur);

    var boble = lag("levelboble");
    boble.innerHTML = '<b>lvl ' + Spill.level(s) + "</b><span>" + s.mynter + " \u25c9</span>";
    rom.append(boble);

    $("#husnavn").textContent = "Hjemme hos " + s.navn;

    var neste = Spill.tilNesteBok(s);
    $("#hushint").textContent = neste
      ? (neste.mangler
          ? neste.mangler + " ord igjen til bok nummer " + neste.nr + "."
          : "Bok nummer " + neste.nr + " er klar!")
      : "";
  }

  /* ---------- Boka paa bordet ---------- */

  function sisteDager(s, n) {
    var ut = [];
    var naa = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(naa.getFullYear(), naa.getMonth(), naa.getDate() - i);
      var noekkel = d.getFullYear() + "-" +
                    String(d.getMonth() + 1).padStart(2, "0") + "-" +
                    String(d.getDate()).padStart(2, "0");
      ut.push({ dag: UKEDAGER[d.getDay()], ord: s.dager[noekkel] || 0 });
    }
    return ut;
  }

  function tall(merke, verdi) {
    var d = lag("tall");
    d.innerHTML = "<b>" + verdi + "</b><span>" + merke + "</span>";
    return d;
  }

  function apneBoka() {
    var st = Spill.statistikk();
    if (!st) return;

    $("#bokaTittel").textContent = st.navn + " sin lesebok";

    var boks = $("#bokaTall");
    boks.textContent = "";
    boks.append(
      tall("ord lest", st.ord),
      tall(st.setninger === 1 ? "stjerne" : "stjerner", st.setninger),
      tall(st.tekster === 1 ? "tekst" : "tekster", st.tekster),
      tall(st.boker === 1 ? "bok" : "bøker", st.boker),
      tall("level", st.level),
      tall("mynter", st.mynter)
    );

    // Dager han har lest, ikke dager paa rad. En rekke som kan brytes er en
    // maate aa tape paa, og det finnes ikke her.
    var uke = sisteDager(Lagring.aktiv(), 7);
    var mest = Math.max.apply(null, uke.map(function (d) { return d.ord; })) || 1;
    var graf = $("#bokaUke");
    graf.textContent = "";
    uke.forEach(function (d) {
      var s = lag("dag");
      var stolpe = lag("stolpe");
      var fyll = lag("", "i");
      fyll.style.height = Math.round(100 * d.ord / mest) + "%";
      if (!d.ord) fyll.classList.add("tom");
      stolpe.append(fyll);
      var merke = lag("merke");
      merke.textContent = d.dag;
      s.append(stolpe, merke);
      s.title = d.ord + " ord";
      graf.append(s);
    });

    var linjer = [st.dager + (st.dager === 1 ? " dag" : " dager") + " med lesing"];
    if (st.tilNesteBok && st.tilNesteBok.mangler) {
      linjer.push(st.tilNesteBok.mangler + " ord igjen til bok nummer " + st.tilNesteBok.nr);
    }
    if (st.gjenlesinger) {
      linjer.push(st.gjenlesinger +
                  (st.gjenlesinger === 1 ? " tekst" : " tekster") + " lest om igjen");
    }
    $("#bokaBunn").textContent = linjer.join(" \u00b7 ");

    // Boka legges over rommet, ikke under det. Han aapner den bare herfra, saa
    // veien tilbake er alltid den samme.
    $("#hus").hidden = true;
    $("#boka").hidden = false;
  }

  $("#lukkBoka").onclick = function () {
    $("#boka").hidden = true;
    $("#hus").hidden = false;
  };

  global.Hus = {
    tegn: tegn,
    apneBoka: apneBoka,
    naarUt: function (fn) { paaUt = fn; }
  };
})(window);
