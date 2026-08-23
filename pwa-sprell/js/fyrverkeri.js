'use strict';

/* Rakettene som går opp når et oppdrag er gjort. Tegnet i et lerret som ligger
   over hele siden og ikke tar imot trykk, så knappene under virker mens det
   spruter. */
window.SprellFyrverkeri = (function () {

  var lerret = null;
  var t = null;
  var deler = [];
  var kjorer = false;
  var forrige = 0;

  var FARGER = ['#ff4d6d', '#ffd23f', '#4ecdc4', '#5aa9e6', '#a06cd5', '#7bc950', '#ff9f1c'];

  function rolig() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function maal() {
    /* Lerretet må ha piksler i skjermens egen tetthet, ellers blir gnistene
       grøtete på telefon. */
    var f = window.devicePixelRatio || 1;
    lerret.width = Math.floor(window.innerWidth * f);
    lerret.height = Math.floor(window.innerHeight * f);
    t.setTransform(f, 0, 0, f, 0, 0);
  }

  function start() {
    if (!lerret) {
      lerret = document.getElementById('fyrverkeri');
      if (!lerret) return false;
      t = lerret.getContext('2d');
      window.addEventListener('resize', maal);
    }
    maal();
    return true;
  }

  function rakett(x) {
    deler.push({
      slag: 'rakett',
      x: x,
      y: window.innerHeight + 10,
      fart: -(window.innerHeight / 900) * (620 + Math.random() * 220),
      mal: window.innerHeight * (0.18 + Math.random() * 0.28),
      farge: FARGER[Math.floor(Math.random() * FARGER.length)]
    });
  }

  function sprett(x, y, farge) {
    var n = rolig() ? 14 : 34;
    for (var i = 0; i < n; i++) {
      var v = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      var f = 90 + Math.random() * 190;
      deler.push({
        slag: 'gnist',
        x: x, y: y,
        vx: Math.cos(v) * f,
        vy: Math.sin(v) * f,
        liv: 1,
        farge: Math.random() < 0.25 ? '#ffffff' : farge
      });
    }
  }

  function steg(naa) {
    var dt = Math.min((naa - forrige) / 1000, 0.05);
    forrige = naa;
    t.clearRect(0, 0, lerret.width, lerret.height);

    for (var i = deler.length - 1; i >= 0; i--) {
      var d = deler[i];
      if (d.slag === 'rakett') {
        d.y += d.fart * dt;
        d.fart += 620 * dt;
        t.fillStyle = d.farge;
        t.fillRect(d.x - 2, d.y, 4, 12);
        if (d.y <= d.mal || d.fart >= 0) {
          sprett(d.x, d.y, d.farge);
          deler.splice(i, 1);
        }
      } else {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 260 * dt;      // tyngdekraft
        d.vx *= 0.985;
        d.liv -= dt * 0.85;
        if (d.liv <= 0) { deler.splice(i, 1); continue; }
        t.globalAlpha = Math.max(d.liv, 0);
        t.fillStyle = d.farge;
        t.beginPath();
        t.arc(d.x, d.y, 3.2, 0, Math.PI * 2);
        t.fill();
        t.globalAlpha = 1;
      }
    }

    if (deler.length) {
      requestAnimationFrame(steg);
    } else {
      /* Ingen løkke som går tom – telefonen skal ikke tegne et tomt lerret
         seksti ganger i sekundet resten av kvelden. */
      kjorer = false;
      t.clearRect(0, 0, lerret.width, lerret.height);
    }
  }

  function fyr() {
    if (!start()) return;
    var n = rolig() ? 1 : 3;
    for (var i = 0; i < n; i++) {
      var x = window.innerWidth * (0.2 + Math.random() * 0.6);
      if (i === 0) rakett(x);
      else setTimeout(function (xx) { return function () { rakett(xx); if (!kjorer) { kjorer = true; forrige = performance.now(); requestAnimationFrame(steg); } }; }(x), 180 * i);
    }
    if (!kjorer) {
      kjorer = true;
      forrige = performance.now();
      requestAnimationFrame(steg);
    }
  }

  return { fyr: fyr };
})();
