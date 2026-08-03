/*
 * Fargeflasker – grensesnittet.
 *
 * Målgruppen er en femåring, så tre ting styrer valgene her: ingen tidtaking,
 * ingen måte å tape på, og alt kan angres. Trykker man på feil flaske, blir
 * den bare den nye valgte i stedet for å gi et avslag.
 */
'use strict';

(function () {

  var LAGER = 'fargeflasker';

  /* ---------- lyd ---------- */

  // Små toner laget på stedet. Ingen lydfiler å laste ned, og appen virker
  // like godt fra en usb-pinne som fra nett.
  var Lyd = (function () {
    var ctx = null;

    function kontekst() {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { ctx = false; }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx || null;
    }

    function tone(frekvens, forsinkelse, lengde, volum, type, sluttfrekvens) {
      var c = kontekst();
      if (!c || !data.lyd) return;
      var t = c.currentTime + forsinkelse;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(frekvens, t);
      if (sluttfrekvens) osc.frequency.exponentialRampToValueAtTime(sluttfrekvens, t + lengde);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volum, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t); osc.stop(t + lengde + 0.05);
    }

    return {
      plukk: function () { tone(660, 0, 0.09, 0.16, 'triangle'); },
      slipp: function () { tone(420, 0, 0.09, 0.12, 'triangle'); },
      hell:  function () { tone(300, 0, 0.34, 0.14, 'sine', 620); },
      nei:   function () { tone(200, 0, 0.14, 0.12, 'square', 150); },
      ferdig: function () {
        tone(660, 0, 0.12, 0.16, 'triangle');
        tone(880, 0.09, 0.16, 0.16, 'triangle');
      },
      seier: function () {
        [523, 659, 784, 1047].forEach(function (f, i) {
          tone(f, i * 0.13, 0.22, 0.17, 'triangle');
        });
        tone(1319, 0.55, 0.5, 0.15, 'triangle');
      }
    };
  })();

  /* ---------- lagring ---------- */

  var data = { opplaast: 1, sisteNivaa: 1, lyd: true };

  function lastData() {
    try {
      var raa = localStorage.getItem(LAGER);
      if (raa) {
        var d = JSON.parse(raa);
        if (d && typeof d === 'object') {
          data.opplaast = Math.max(1, d.opplaast | 0);
          data.sisteNivaa = Math.max(1, d.sisteNivaa | 0);
          data.lyd = d.lyd !== false;
        }
      }
    } catch (e) { /* privat modus eller file:// – vi klarer oss uten */ }
  }

  function lagreData() {
    try { localStorage.setItem(LAGER, JSON.stringify(data)); } catch (e) { }
  }

  /* ---------- tilstand ---------- */

  var tilstand = {
    nivaa: 1,
    kapasitet: 4,
    flasker: [],
    start: [],
    historikk: [],
    valgt: null,
    laast: false,
    ferdigeFra: []      // hvilke flasker som allerede var komplette – for å feire bare nye
  };

  var brett = document.getElementById('brett');
  var elFlasker = [], elVaeske = [];

  /* ---------- oppsett av nivå ---------- */

  function startNivaa(n) {
    var nivaa = Spill.lagNivaa(n);
    tilstand.nivaa = n;
    tilstand.kapasitet = nivaa.kapasitet;
    tilstand.flasker = Spill.kopi(nivaa.flasker);
    tilstand.start = Spill.kopi(nivaa.flasker);
    tilstand.historikk = [];
    tilstand.valgt = null;
    tilstand.laast = false;
    tilstand.ferdigeFra = [];
    data.sisteNivaa = n;
    lagreData();
    document.getElementById('nivaaTall').textContent = n;
    visTips(n === 1 ? 'Trykk på en flaske, og så på en annen 👆' : '');
    tegn();
  }

  function startPaaNytt() {
    if (tilstand.laast) return;
    tilstand.flasker = Spill.kopi(tilstand.start);
    tilstand.historikk = [];
    tilstand.valgt = null;
    tilstand.ferdigeFra = [];
    Lyd.slipp();
    tegn();
  }

  /* ---------- tegning ---------- */

  var OMRISS =
    '<svg class="omriss" viewBox="0 0 68 160" aria-hidden="true">' +
      '<path class="kant" d="M27 5 h14 v17 c0 8 19 8 19 24 v88 c0 10 -6 15 -16 15 ' +
      'h-20 c-10 0 -16 -5 -16 -15 v-88 c0 -16 19 -16 19 -24 z"/>' +
      '<path class="blank" d="M16 64 c0 -9 4 -13 7 -15 v72 c-4 -2 -7 -7 -7 -13 z"/>' +
    '</svg>';

  // Flaskene fordeles på rader med høyst fem i hver, og radene gjøres like
  // lange. Ti flasker blir 5 + 5, sju blir 4 + 3.
  function radInndeling(antall) {
    var rader = Math.ceil(antall / 5);
    var igjen = antall, ut = [];
    for (var r = 0; r < rader; r++) {
      var n = Math.ceil(igjen / (rader - r));
      ut.push(n);
      igjen -= n;
    }
    return ut;
  }

  // Flaskebredden settes så hele brettet får plass uten rulling – både i
  // bredden og i høyden.
  function settBredde(inndeling) {
    var maks = Math.max.apply(null, inndeling);
    var rader = inndeling.length;
    var mellomrom = Math.min(16, Math.max(6, brett.clientWidth * 0.026));
    var radAvstand = 26;

    var etterBredde = (brett.clientWidth - (maks - 1) * mellomrom - 8) / maks;
    var etterHoyde = (brett.clientHeight - (rader - 1) * radAvstand - 18) / (rader * (160 / 68));
    var bredde = Math.min(etterBredde, etterHoyde, 110);
    bredde = Math.max(30, bredde);
    document.documentElement.style.setProperty('--flaskebredde', bredde.toFixed(1) + 'px');
  }

  function tegn() {
    var flasker = tilstand.flasker;
    var inndeling = radInndeling(flasker.length);
    brett.innerHTML = '';
    settBredde(inndeling);

    elFlasker = [];
    elVaeske = [];
    var enhet = 100 / tilstand.kapasitet;
    var i = 0;

    inndeling.forEach(function (antall) {
      var rad = document.createElement('div');
      rad.className = 'rad';
      for (var k = 0; k < antall; k++) {
        rad.appendChild(lagFlaske(i, flasker[i], enhet));
        i++;
      }
      brett.appendChild(rad);
    });
  }

  function lagFlaske(indeks, innhold, enhet) {
    var el = document.createElement('div');
    el.className = 'flaske';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', beskriv(innhold));
    el.dataset.i = indeks;
    el.innerHTML = OMRISS + '<span class="merke" aria-hidden="true">⭐️</span>';

    var vaeske = document.createElement('div');
    vaeske.className = 'vaeske';
    innhold.forEach(function (farge) {
      vaeske.appendChild(lagDel(farge, enhet));
    });
    el.insertBefore(vaeske, el.firstChild);

    if (tilstand.valgt === indeks) el.classList.add('valgt');
    if (Spill.erKomplett(innhold, tilstand.kapasitet)) el.classList.add('ferdig');

    el.addEventListener('click', function () { klikk(indeks); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); klikk(indeks); }
    });

    elFlasker[indeks] = el;
    elVaeske[indeks] = vaeske;
    return el;
  }

  function lagDel(farge, hoyde) {
    var d = document.createElement('div');
    d.className = 'del';
    d.style.height = hoyde + '%';
    d.style.background = 'linear-gradient(90deg,' + Spill.FARGER[farge].kode + ' 0%,' +
      Spill.FARGER[farge].lys + ' 42%,' + Spill.FARGER[farge].kode + ' 100%)';
    d.dataset.farge = farge;
    return d;
  }

  function beskriv(innhold) {
    if (!innhold.length) return 'Tom flaske';
    var navn = innhold.map(function (f) { return Spill.FARGER[f].navn; });
    return 'Flaske med ' + navn.join(', ') + ' nedenfra';
  }

  /* ---------- trykk ---------- */

  function klikk(i) {
    if (tilstand.laast) return;
    var flasker = tilstand.flasker;

    if (tilstand.valgt === null) {
      if (!flasker[i].length) { rist(i); return; }
      if (Spill.erKomplett(flasker[i], tilstand.kapasitet)) { rist(i); return; }
      tilstand.valgt = i;
      elFlasker[i].classList.add('valgt');
      Lyd.plukk();
      skjulTips();
      return;
    }

    if (tilstand.valgt === i) {
      tilstand.valgt = null;
      elFlasker[i].classList.remove('valgt');
      Lyd.slipp();
      return;
    }

    var fra = tilstand.valgt;
    var antall = Spill.kanHelle(flasker, fra, i, tilstand.kapasitet);
    if (antall > 0) {
      hell(fra, i, antall);
      return;
    }

    // Går ikke: si fra med en liten risting, og la trykket velge den nye
    // flasken i stedet. Da slipper barnet å trykke to ganger.
    rist(i);
    elFlasker[fra].classList.remove('valgt');
    if (flasker[i].length && !Spill.erKomplett(flasker[i], tilstand.kapasitet)) {
      tilstand.valgt = i;
      elFlasker[i].classList.add('valgt');
    } else {
      tilstand.valgt = null;
    }
  }

  function rist(i) {
    var el = elFlasker[i];
    if (!el) return;
    Lyd.nei();
    el.classList.remove('rist');
    void el.offsetWidth;
    el.classList.add('rist');
    setTimeout(function () { el.classList.remove('rist'); }, 340);
  }

  /* ---------- hellingen ---------- */

  function hell(fra, til, antall) {
    tilstand.laast = true;
    tilstand.historikk.push(Spill.kopi(tilstand.flasker));
    tilstand.valgt = null;
    skjulTips();

    var farge = Spill.toppFarge(tilstand.flasker[fra]);
    var nivaaTil = tilstand.flasker[til].length;
    var eFra = elFlasker[fra], eTil = elFlasker[til];
    var rFra = eFra.getBoundingClientRect(), rTil = eTil.getBoundingClientRect();

    // Flasken svinger om munningen (transform-origin i css), så vi kan sikte
    // rett på et punkt like over målflasken.
    var tilVenstre = rFra.left <= rTil.left;
    var vinkel = tilVenstre ? 54 : -54;
    var munnX = rFra.left + rFra.width / 2;
    var munnY = rFra.top + rFra.height * 0.08;
    var maalX = rTil.left + rTil.width / 2;
    var maalY = rTil.top - rTil.height * 0.14;

    eFra.classList.remove('valgt');
    eFra.style.zIndex = '40';
    eFra.style.transition = 'transform .24s cubic-bezier(.4,.1,.3,1)';
    eFra.style.transform = 'translate(' + (maalX - munnX).toFixed(1) + 'px,' +
      (maalY - munnY).toFixed(1) + 'px) rotate(' + vinkel + 'deg)';

    // Overflaten på væsken i målflasken: prosentene er de samme som i css.
    var overflate = rTil.top + rTil.height * (0.919 - 0.619 * nivaaTil / tilstand.kapasitet);

    setTimeout(function () {
      var straale = document.createElement('div');
      straale.className = 'straale';
      straale.style.left = (maalX - 4) + 'px';
      straale.style.top = maalY + 'px';
      straale.style.width = '8px';
      straale.style.height = '0px';
      straale.style.background = Spill.FARGER[farge].kode;
      document.body.appendChild(straale);
      void straale.offsetWidth;
      straale.style.height = Math.max(6, overflate - maalY + 4) + 'px';
      Lyd.hell();

      // Væsken forlater kildeflasken og fyller målflasken samtidig.
      var enhet = 100 / tilstand.kapasitet;
      var deler = elVaeske[fra].children;
      for (var k = 0; k < antall; k++) {
        deler[deler.length - 1 - k].style.height = '0%';
      }
      var nye = [];
      for (var m = 0; m < antall; m++) {
        var d = lagDel(farge, enhet);
        d.style.height = '0%';
        elVaeske[til].appendChild(d);
        nye.push(d);
      }
      void elVaeske[til].offsetWidth;
      nye.forEach(function (d) { d.style.height = enhet + '%'; });

      setTimeout(function () {
        straale.style.height = '0px';
        straale.style.opacity = '0';
        setTimeout(function () { straale.remove(); }, 200);
        eFra.style.transform = '';
        setTimeout(function () {
          eFra.style.zIndex = '';
          eFra.style.transition = '';
          fullfor(fra, til, antall);
        }, 240);
      }, 320);
    }, 250);
  }

  function fullfor(fra, til, antall) {
    var varFerdig = tilstand.flasker.map(function (f) {
      return Spill.erKomplett(f, tilstand.kapasitet);
    });
    Spill.helle(tilstand.flasker, fra, til, antall);
    tegn();

    var blePlutseligFerdig = !varFerdig[til] &&
      Spill.erKomplett(tilstand.flasker[til], tilstand.kapasitet);
    if (blePlutseligFerdig) {
      elFlasker[til].classList.add('nyferdig');
      Lyd.ferdig();
    }

    if (Spill.erFerdig(tilstand.flasker, tilstand.kapasitet)) {
      setTimeout(visSeier, blePlutseligFerdig ? 550 : 250);
    } else {
      tilstand.laast = false;
      oppdaterKnapper();
    }
  }

  function angre() {
    if (tilstand.laast || !tilstand.historikk.length) return;
    tilstand.flasker = tilstand.historikk.pop();
    tilstand.valgt = null;
    Lyd.slipp();
    tegn();
    oppdaterKnapper();
  }

  function oppdaterKnapper() {
    document.getElementById('knappAngre').disabled = tilstand.historikk.length === 0;
  }

  /* ---------- hint ---------- */

  function hint() {
    if (tilstand.laast) return;
    var fasit = Spill.loes(tilstand.flasker, tilstand.kapasitet);
    if (!fasit || !fasit.length) {
      visTips('Det går ikke videre herfra – trykk Angre 🙂');
      return;
    }
    tilstand.valgt = null;
    tegn();
    peker(fasit[0].fra);
    peker(fasit[0].til);
    visTips('Hell fra den ene til den andre 👀');
  }

  function peker(i) {
    var el = elFlasker[i];
    if (!el) return;
    el.classList.add('peker');
    setTimeout(function () { el.classList.remove('peker'); }, 4600);
  }

  /* ---------- tips ---------- */

  var tipsEl = document.getElementById('tips');

  function visTips(tekst) {
    tipsEl.textContent = tekst || '';
    tipsEl.classList.toggle('borte', !tekst);
  }

  function skjulTips() {
    tipsEl.classList.add('borte');
  }

  /* ---------- seier ---------- */

  var seier = document.getElementById('seier');

  function visSeier() {
    if (tilstand.nivaa + 1 > data.opplaast) data.opplaast = tilstand.nivaa + 1;
    lagreData();
    document.getElementById('seierTekst').textContent =
      'Nivå ' + tilstand.nivaa + ' er ferdig. Alle flaskene har sin egen farge!';
    seier.classList.remove('skjult');
    konfetti();
    Lyd.seier();
  }

  function konfetti() {
    var boks = document.getElementById('konfetti');
    boks.innerHTML = '';
    for (var i = 0; i < 55; i++) {
      var b = document.createElement('i');
      b.style.left = (Math.random() * 100) + '%';
      b.style.background = Spill.FARGER[i % Spill.FARGER.length].kode;
      b.style.animationDelay = (Math.random() * 1.1).toFixed(2) + 's';
      b.style.animationDuration = (2 + Math.random() * 1.6).toFixed(2) + 's';
      b.style.transform = 'scale(' + (0.6 + Math.random() * 0.8).toFixed(2) + ')';
      boks.appendChild(b);
    }
  }

  /* ---------- nivåvelger ---------- */

  var velger = document.getElementById('nivaavelger');

  function visVelger() {
    var liste = document.getElementById('nivaaliste');
    liste.innerHTML = '';
    var antall = Math.max(30, data.opplaast + 5);
    for (var n = 1; n <= antall; n++) {
      var b = document.createElement('button');
      b.className = 'nivaaknapp';
      b.textContent = n;
      if (n < data.opplaast) b.classList.add('klart');
      if (n === tilstand.nivaa) b.classList.add('naa');
      if (n > data.opplaast) {
        b.classList.add('laast');
        b.disabled = true;
        b.textContent = '🔒';
      } else {
        (function (m) {
          b.addEventListener('click', function () {
            velger.classList.add('skjult');
            startNivaa(m);
            oppdaterKnapper();
          });
        })(n);
      }
      liste.appendChild(b);
    }
    velger.classList.remove('skjult');

    // Rull fram til nivået som spilles nå – ellers må man lete etter det.
    var naa = liste.querySelector('.naa');
    if (naa) liste.scrollTop = Math.max(0, naa.offsetTop - liste.clientHeight / 2);
  }

  /* ---------- knapper ---------- */

  document.getElementById('knappAngre').addEventListener('click', angre);
  document.getElementById('knappHint').addEventListener('click', hint);
  document.getElementById('knappStartPaaNytt').addEventListener('click', startPaaNytt);
  document.getElementById('knappNivaaer').addEventListener('click', visVelger);
  document.getElementById('knappLukkVelger').addEventListener('click', function () {
    velger.classList.add('skjult');
  });

  document.getElementById('knappNeste').addEventListener('click', function () {
    seier.classList.add('skjult');
    startNivaa(tilstand.nivaa + 1);
    oppdaterKnapper();
  });
  document.getElementById('knappOmIgjen').addEventListener('click', function () {
    seier.classList.add('skjult');
    startNivaa(tilstand.nivaa);
    oppdaterKnapper();
  });

  var knappLyd = document.getElementById('knappLyd');
  function tegnLydknapp() {
    knappLyd.firstElementChild.textContent = data.lyd ? '🔊' : '🔇';
  }
  knappLyd.addEventListener('click', function () {
    data.lyd = !data.lyd;
    lagreData();
    tegnLydknapp();
    if (data.lyd) Lyd.plukk();
  });

  // Skjermen kan snus, og da må flaskene måles på nytt.
  var tidtaker = null;
  window.addEventListener('resize', function () {
    clearTimeout(tidtaker);
    tidtaker = setTimeout(function () { if (!tilstand.laast) tegn(); }, 150);
  });

  /* ---------- i gang ---------- */

  lastData();
  tegnLydknapp();
  startNivaa(data.sisteNivaa);
  oppdaterKnapper();

  /* enkeltfil: start – dette klippes bort i flaskespill.html, som ikke har sw.js */
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  /* enkeltfil: slutt */

})();
