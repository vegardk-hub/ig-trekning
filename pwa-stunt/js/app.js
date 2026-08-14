/*
 * Stuntgarasjen: skjermene, butikken og lagringen.
 *
 * Fem skjermer, én om gangen: garasje, verksted, deler, løype, resultat.
 * All tilstand ligger i ett objekt som lagres i localStorage, og hele
 * grensesnittet tegnes på nytt fra det. Med så få skjermer er det både
 * kortere og tryggere enn å flytte enkeltverdier inn og ut av DOM-en.
 *
 * Pengene er én pott, slik eieren ba om. Det som hindrer at pynt straffer
 * seg, er at designdelene gir stilbonus på alt man tjener i løypa – en
 * glitterlakk konkurrerer altså ikke med motoren, den betaler for seg selv
 * over noen turer.
 */
'use strict';

(function () {

  var NOKKEL = 'stuntgarasjen';
  var STARTPENGER = 250;

  var stat = last();
  var lope = Lope.bygg(Kjoring.G);
  var lop = null;          // aktiv kjøring
  var bilbilde = null;      // karosseri + hjul som bilder, til løypa
  var aktivKategori = 'form';

  var e = {};
  ['skjermGarasje', 'skjermVerksted', 'skjermDeler', 'skjermLop', 'skjermResultat',
   'garasjeBil', 'garasjePenger', 'garasjeStil', 'garasjeBeste',
   'verkstedBil', 'verkstedPenger', 'kategorier', 'valgene', 'stilLinje',
   'delerPenger', 'delerListe',
   'lerret', 'hudPenger', 'hudFart', 'framdrift', 'hudHint', 'knappGass', 'knappBrems',
   'resultatSum', 'resultatDetaljer', 'resultatBil', 'resultatRekord',
   'kjopTittel', 'kjopTekst', 'kjopJa', 'kjopNei', 'kjopKort'
  ].forEach(function (id) { e[id] = document.getElementById(id); });

  /* ---------- lagring ---------- */

  function last() {
    var s = { penger: STARTPENGER, eid: {}, valgt: Bil.standard(), oppg: { motor: 0, gir: 0, dekk: 0 }, beste: 0, turer: 0 };
    try {
      var lagret = JSON.parse(localStorage.getItem(NOKKEL));
      if (lagret && typeof lagret === 'object') {
        s.penger = typeof lagret.penger === 'number' ? lagret.penger : s.penger;
        s.eid = lagret.eid || {};
        s.beste = lagret.beste || 0;
        s.turer = lagret.turer || 0;
        if (lagret.valgt) for (var k in s.valgt) if (lagret.valgt[k]) s.valgt[k] = lagret.valgt[k];
        if (lagret.oppg) for (var o in s.oppg) if (typeof lagret.oppg[o] === 'number') s.oppg[o] = lagret.oppg[o];
      }
    } catch (f) { /* ødelagt lagring skal ikke stoppe spillet */ }

    // Gratisdelene eier man alltid, ellers kan man stå med en bil man ikke
    // har lov til å bruke etter en oppdatering av katalogen.
    Bil.KATEGORIER.forEach(function (kat) {
      if (!s.eid[kat.id]) s.eid[kat.id] = [];
      kat.liste.forEach(function (del) {
        if (del.pris === 0 && s.eid[kat.id].indexOf(del.id) < 0) s.eid[kat.id].push(del.id);
      });
    });
    return s;
  }

  function lagre() {
    try { localStorage.setItem(NOKKEL, JSON.stringify(stat)); } catch (f) { /* full disk */ }
  }

  function eier(kat, id) { return stat.eid[kat].indexOf(id) >= 0; }

  /* ---------- skjermbytte ---------- */

  var SKJERMER = ['skjermGarasje', 'skjermVerksted', 'skjermDeler', 'skjermLop', 'skjermResultat'];

  function vis(navn) {
    SKJERMER.forEach(function (s) { e[s].hidden = (s !== navn); });
    if (navn === 'skjermGarasje') tegnGarasje();
    if (navn === 'skjermVerksted') tegnVerksted();
    if (navn === 'skjermDeler') tegnDeler();
  }

  function penger() { return '$' + stat.penger; }

  /* ---------- garasje ---------- */

  function tegnGarasje() {
    e.garasjeBil.innerHTML = Bil.svg(stat.valgt, 'g', 'bilbilde');
    e.garasjePenger.textContent = penger();
    var b = Bil.bonus(stat.valgt);
    e.garasjeStil.textContent = '×' + b.toFixed(2);
    e.garasjeBeste.textContent = stat.beste ? '$' + stat.beste : '–';
  }

  /* ---------- verksted ---------- */

  function tegnVerksted() {
    e.verkstedBil.innerHTML = Bil.svg(stat.valgt, 'v', 'bilbilde');
    e.verkstedPenger.textContent = penger();

    e.kategorier.innerHTML = '';
    Bil.KATEGORIER.forEach(function (kat) {
      var k = document.createElement('button');
      k.className = 'fane' + (kat.id === aktivKategori ? ' valgt' : '');
      k.innerHTML = '<span class="fanetegn" aria-hidden="true">' + kat.tegn + '</span>' +
                    '<span class="fanenavn">' + kat.navn + '</span>';
      k.setAttribute('aria-pressed', kat.id === aktivKategori ? 'true' : 'false');
      k.onclick = function () { aktivKategori = kat.id; tegnVerksted(); };
      e.kategorier.appendChild(k);
    });

    var kat = null;
    Bil.KATEGORIER.forEach(function (k) { if (k.id === aktivKategori) kat = k; });

    e.valgene.innerHTML = '';
    kat.liste.forEach(function (del) {
      var har = eier(kat.id, del.id);
      var valgt = stat.valgt[kat.id] === del.id;
      var raad = stat.penger >= del.pris;

      var k = document.createElement('button');
      k.className = 'valg' + (valgt ? ' valgt' : '') + (!har && !raad ? ' dyr' : '');
      k.setAttribute('aria-pressed', valgt ? 'true' : 'false');

      var merke;
      if (kat.id === 'lakk') {
        merke = '<span class="lakkprikk" style="background:' +
          (del.regnbue ? 'linear-gradient(120deg,#ff4d6d,#ffb01f,#4ad991,#3aa8ff,#a05cff)' : del.farge) +
          '"></span>';
      } else if (kat.id === 'hjul') {
        merke = '<span class="hjulprove">' + Bil.miniHjul(del) + '</span>';
      } else {
        merke = '<span class="valgtegn" aria-hidden="true">' + (del.tegn || kat.tegn) + '</span>';
      }

      var under = har
        ? (valgt ? '<span class="paa">På bilen</span>' : '<span class="eid">Eier</span>')
        : '<span class="pris">$' + del.pris + '</span>';

      k.innerHTML = merke + '<span class="valgnavn">' + del.navn + '</span>' + under +
                    (del.stil ? '<span class="stilmerke">+' + del.stil + ' stil</span>' : '<span class="stilmerke"></span>');

      k.onclick = function () { velgDel(kat, del); };
      e.valgene.appendChild(k);
    });

    var b = Bil.bonus(stat.valgt);
    e.stilLinje.innerHTML = 'Stil <strong>' + Bil.stil(stat.valgt) + '</strong> gir <strong class="gronn">×' +
      b.toFixed(2) + '</strong> på alt du tjener i løypa';
  }

  function velgDel(kat, del) {
    if (eier(kat.id, del.id)) {
      stat.valgt[kat.id] = del.id;
      lagre();
      tegnVerksted();
      return;
    }
    if (stat.penger < del.pris) {
      rist(e.verkstedPenger);
      return;
    }
    spor('Kjøpe ' + del.navn + '?', 'Det koster $' + del.pris + '. Du har ' + penger() + '.', function () {
      stat.penger -= del.pris;
      stat.eid[kat.id].push(del.id);
      stat.valgt[kat.id] = del.id;
      lagre();
      tegnVerksted();
    });
  }

  /* ---------- deler (oppgraderinger) ---------- */

  function tegnDeler() {
    e.delerPenger.textContent = penger();
    e.delerListe.innerHTML = '';

    Kjoring.OPPGRADERINGER.forEach(function (o) {
      var niva = stat.oppg[o.id];
      var maks = o.data.priser.length - 1;
      var rad = document.createElement('div');
      rad.className = 'delrad';

      var pipper = '';
      for (var i = 1; i <= maks; i++) {
        pipper += '<span class="pip' + (i <= niva ? ' fylt' : '') + '"></span>';
      }

      var knapp = niva >= maks
        ? '<span class="fullt">Fullt utbygd</span>'
        : '<button class="kjopknapp" data-id="' + o.id + '">$' + o.data.priser[niva + 1] + '</button>';

      rad.innerHTML =
        '<span class="deltegn" aria-hidden="true">' + o.data.tegn + '</span>' +
        '<span class="delnavn">' + o.data.navn + '<small>' + o.data.hva + '</small></span>' +
        '<span class="pipper">' + pipper + '</span>' + knapp;

      e.delerListe.appendChild(rad);
    });

    Array.prototype.forEach.call(e.delerListe.querySelectorAll('.kjopknapp'), function (k) {
      k.onclick = function () { kjopOppgradering(k.getAttribute('data-id')); };
    });
  }

  function kjopOppgradering(id) {
    var o = null;
    Kjoring.OPPGRADERINGER.forEach(function (x) { if (x.id === id) o = x; });
    var niva = stat.oppg[id], neste = niva + 1;
    if (neste >= o.data.priser.length) return;
    var pris = o.data.priser[neste];
    if (stat.penger < pris) { rist(e.delerPenger); return; }

    spor('Oppgradere ' + o.data.navn.toLowerCase() + '?',
         o.data.hva + ' blir bedre. Det koster $' + pris + '. Du har ' + penger() + '.',
         function () {
           stat.penger -= pris;
           stat.oppg[id] = neste;
           lagre();
           tegnDeler();
         });
  }

  /* ---------- kjøp-dialog ---------- */

  var kjopSvar = null;

  function spor(tittel, tekst, ja) {
    e.kjopTittel.textContent = tittel;
    e.kjopTekst.textContent = tekst;
    kjopSvar = ja;
    e.kjopKort.hidden = false;
    e.kjopJa.focus();
  }

  e.kjopJa.onclick = function () {
    e.kjopKort.hidden = true;
    if (kjopSvar) kjopSvar();
    kjopSvar = null;
  };
  e.kjopNei.onclick = function () { e.kjopKort.hidden = true; kjopSvar = null; };

  function rist(el) {
    el.classList.remove('rister');
    void el.offsetWidth;   // tvinger fram en ny animasjon
    el.classList.add('rister');
  }

  /* ---------- løypa ---------- */

  function passLerret() {
    var d = window.devicePixelRatio || 1;
    var r = e.lerret.getBoundingClientRect();
    e.lerret.width = Math.round(r.width * d);
    e.lerret.height = Math.round(r.height * d);
  }

  function startLop() {
    vis('skjermLop');
    passLerret();

    Bil.tegninger(stat.valgt, function (bilder) {
      bilbilde = bilder;
      lope = Lope.bygg(Kjoring.G);
      lop = Kjoring.lag(e.lerret, lope, bilder, stat.oppg, Bil.bonus(stat.valgt));
      lop.start(ferdigLop);
      oppdaterHud();
    });
  }

  function oppdaterHud() {
    if (!lop) return;
    var t = lop.tilstand();
    e.hudPenger.textContent = '$' + t.penger;
    e.hudFart.textContent = t.fart + ' km/t';
    e.framdrift.style.width = (t.andel * 100).toFixed(1) + '%';
    e.hudHint.hidden = !t.staar;
    if (!e.skjermLop.hidden) requestAnimationFrame(oppdaterHud);
  }

  function ferdigLop(res) {
    stat.penger += res.penger;
    stat.turer++;
    if (res.penger > stat.beste) stat.beste = res.penger;
    lagre();

    e.resultatSum.textContent = '$' + res.penger;
    e.resultatBil.innerHTML = Bil.svg(stat.valgt, 'r', 'bilbilde');
    e.resultatRekord.textContent = res.penger >= stat.beste ? 'Ny rekord! 🏆' : 'Rekord: $' + stat.beste;

    var b = Bil.bonus(stat.valgt);
    e.resultatDetaljer.innerHTML =
      linje('🟢', res.mynter + ' mynter') +
      linje('🔁', res.looper + (res.looper === 1 ? ' loop' : ' looper')) +
      linje('🛫', res.hopp + (res.hopp === 1 ? ' hopp' : ' hopp') +
                 (res.lengsteHopp ? ', lengste ' + res.lengsteHopp : '')) +
      linje('✨', 'Stilbonus ×' + b.toFixed(2));

    // Litt pause, så det siste dollartegnet rekker å bli sett.
    setTimeout(function () { vis('skjermResultat'); }, 700);
  }

  function linje(tegn, tekst) {
    return '<div class="detaljlinje"><span aria-hidden="true">' + tegn + '</span> ' + tekst + '</div>';
  }

  function avbryt() {
    if (lop) { lop.stopp(); lop = null; }
    vis('skjermGarasje');
  }

  /* ---------- knapper ---------- */

  function hold(knapp, hva) {
    function ned(ev) { ev.preventDefault(); if (lop) lop.sett(hva, true); knapp.classList.add('trykket'); }
    function opp() { if (lop) lop.sett(hva, false); knapp.classList.remove('trykket'); }
    knapp.addEventListener('pointerdown', ned);
    knapp.addEventListener('pointerup', opp);
    knapp.addEventListener('pointercancel', opp);
    knapp.addEventListener('pointerleave', opp);
  }

  hold(e.knappGass, 'gass');
  hold(e.knappBrems, 'brems');

  // Tastatur er bare til utprøving på maskin – telefonen er hovedsaken.
  window.addEventListener('keydown', function (ev) {
    if (!lop) return;
    if (ev.key === 'ArrowRight' || ev.key === ' ') lop.sett('gass', true);
    if (ev.key === 'ArrowLeft') lop.sett('brems', true);
  });
  window.addEventListener('keyup', function (ev) {
    if (!lop) return;
    if (ev.key === 'ArrowRight' || ev.key === ' ') lop.sett('gass', false);
    if (ev.key === 'ArrowLeft') lop.sett('brems', false);
  });

  document.getElementById('knappVerksted').onclick = function () { vis('skjermVerksted'); };
  document.getElementById('knappDeler').onclick = function () { vis('skjermDeler'); };
  document.getElementById('knappKjor').onclick = startLop;
  document.getElementById('knappTilbakeVerksted').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappTilbakeDeler').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappAvbryt').onclick = avbryt;
  document.getElementById('knappIgjen').onclick = startLop;
  document.getElementById('knappGarasje').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappTilDeler').onclick = function () { vis('skjermDeler'); };

  window.addEventListener('resize', function () {
    if (!e.skjermLop.hidden) { passLerret(); if (lop) lop.tegnEn(); }
  });

  vis('skjermGarasje');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline er en bonus, ikke et krav */ });
    });
  }
})();
