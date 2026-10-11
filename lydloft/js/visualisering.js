/*
 * Lysshowet — tre fjellkjeder som følger lyden mens den spilles.
 *
 * Alle tre bygger på samme idé: spekteret er en fjellrygg, og ryggene
 * stables bakover i bildet. De skiller seg i hva lagene *er*:
 *
 *   Fjellkjeden  — lagene er tid. Nyeste spekter står fremst, de eldre
 *                  rygger bakover som strektegning (Joy Division-stil).
 *   Neonvidda    — lagene er tid i perspektiv: ryggene ruller mot en sol i
 *                  horisonten, med en dal i midten der veien går (synthwave).
 *   Fjellsjøen   — lagene er frekvens: diskanten er spisse tinder bakerst,
 *                  bassen runde åser fremst, og alt speiles i vannet under.
 *
 * Alle får de samme tallene hver bilderute (`data`): spekteret i 48 bånd på
 * logaritmisk akse, bølgeformen, lydnivået, bass/mellom/diskant, og `slag` —
 * et sant/usant som blinker når bassen hopper.
 *
 * Analysatoren sitter etter hele effektkjeden, så det man ser er det man
 * hører: robotlyd blir en annen fjellkjede enn kirkeklang.
 *
 * Tegningen går bare mens lyden spilles. Canvas på en telefon i 60 bilder i
 * sekundet er den raskeste måten å tømme batteriet på uten at noen ser det.
 */
'use strict';

var LydVis = (function () {

  var NEON = ['#ff2bd6', '#a259ff', '#3d8bff', '#19f0ff', '#b6ff2e', '#ffe83d', '#ff8a1e', '#ff3d6e'];
  var BUNN = '#0a0618';
  var BAND = 48;

  // Fargen ved en andel 0–1 langs neonpaletten, blandet mellom nabofargene.
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  var RGB = NEON.map(hex);
  function farge(andel, alfa) {
    var a = ((andel % 1) + 1) % 1 * RGB.length, i = Math.floor(a), f = a - i;
    var x = RGB[i], y = RGB[(i + 1) % RGB.length];
    var r = Math.round(x[0] + (y[0] - x[0]) * f), g = Math.round(x[1] + (y[1] - x[1]) * f), b = Math.round(x[2] + (y[2] - x[2]) * f);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (alfa === undefined ? 1 : alfa) + ')';
  }

  function tom(g, w, h) {
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = BUNN;
    g.fillRect(0, 0, w, h);
  }

  /* --------------------------------------------------------------- stilene */

  var STILER = [
    {
      id: 'fjell', navn: 'Fjellkjeden',
      start: function () { return { historikk: [] }; },
      tegn: function (g, w, h, d, s) {
        tom(g, w, h);
        s.historikk.unshift(Float32Array.from(d.band));
        if (s.historikk.length > 26) s.historikk.pop();
        var linjer = s.historikk.length, avstand = h * 0.026;
        // Bakerst først, så de nærmeste dekker over de bakre.
        for (var k = linjer - 1; k >= 0; k--) {
          var b = s.historikk[k], y0 = h * 0.88 - k * avstand, skala = 1 - k * 0.018, venstre = w * (1 - skala) / 2;
          g.beginPath();
          g.moveTo(venstre, y0);
          for (var i = 0; i < BAND; i++) {
            // Toppene samles på midten, som et fjell, ikke en kurve.
            var x = venstre + (i + 0.5) / BAND * w * skala;
            var vekt = Math.sin(Math.PI * (i + 0.5) / BAND);
            var v = b[(i * 7) % BAND] * 0.4 + b[i] * 0.6;
            g.lineTo(x, y0 - v * h * 0.45 * vekt * skala);
          }
          g.lineTo(venstre + w * skala, y0);
          g.closePath();
          g.fillStyle = BUNN;
          g.fill();
          g.strokeStyle = farge(0.5 + k / linjer * 0.6 + d.t * 0.02, 1 - k / linjer * 0.75);
          g.lineWidth = k === 0 ? 2.5 : 1.4;
          g.stroke();
        }
      }
    },
    {
      id: 'vidda', navn: 'Neonvidda',
      start: function () { return { historikk: [], rull: 0, puls: 0 }; },
      tegn: function (g, w, h, d, s) {
        var horisont = h * 0.5;
        s.puls = d.slag ? 1 : s.puls * 0.9;
        // Himmelen: mørk lilla oppe, rosa dis ned mot horisonten.
        var himmel = g.createLinearGradient(0, 0, 0, horisont);
        himmel.addColorStop(0, BUNN);
        himmel.addColorStop(1, '#3b0a5e');
        g.fillStyle = himmel; g.fillRect(0, 0, w, horisont);
        g.fillStyle = BUNN; g.fillRect(0, horisont, w, h - horisont);
        // Sola står i horisonten og vokser litt med bassen. Stripene nederst
        // er det som gjør den til en synthwave-sol og ikke en ball.
        var r = Math.min(w, h) * (0.24 + d.bass * 0.03 + s.puls * 0.02), cy = horisont - r * 0.5;
        var sol = g.createLinearGradient(0, cy - r, 0, cy + r);
        sol.addColorStop(0, '#ffe83d'); sol.addColorStop(0.55, '#ff8a1e'); sol.addColorStop(1, '#ff2bd6');
        g.save();
        g.beginPath(); g.rect(0, 0, w, horisont); g.clip();
        g.shadowColor = '#ff2bd6'; g.shadowBlur = 30 + s.puls * 30;
        g.fillStyle = sol;
        g.beginPath(); g.arc(w / 2, cy, r, 0, 2 * Math.PI); g.fill();
        g.shadowBlur = 0;
        g.fillStyle = '#3b0a5e';
        for (var k = 0; k < 6; k++) {
          var sy = cy + r * (0.05 + k * 0.1), tykk = r * (0.015 + k * 0.014);
          g.fillRect(0, sy, w, tykk);
        }
        g.restore();
        // Gulvet: linjer ut fra forsvinningspunktet. De vannrette er selve
        // ryggene, så de trenger ingen egne streker.
        g.strokeStyle = 'rgba(162,89,255,0.35)'; g.lineWidth = 1;
        for (var v = -10; v <= 10; v++) {
          g.beginPath(); g.moveTo(w / 2, horisont); g.lineTo(w / 2 + v * w * 0.16, h); g.stroke();
        }
        // Ryggene rulles inn ved horisonten og kommer mot betrakteren —
        // motsatt vei av Fjellkjeden, så det ser ut som man kjører innover.
        s.historikk.push(Float32Array.from(d.band));
        if (s.historikk.length > 22) s.historikk.shift();
        var linjer = s.historikk.length;
        for (var k2 = 0; k2 < linjer; k2++) {
          var b = s.historikk[k2];
          // z går fra 1 (fremst) til nær 0 (i horisonten), i perspektiv.
          var z = 1 / (1 + (linjer - 1 - k2) * 0.28);
          var y0 = horisont + (h * 1.02 - horisont) * z, bredde = w * (0.6 + z * 1.2), venstre = (w - bredde) / 2;
          g.beginPath(); g.moveTo(venstre, y0);
          for (var i = 0; i <= BAND; i++) {
            // Speilet om midten: bassen på begge sider ytterst, diskanten inne
            // ved veien. Dalen i midten er der veien går.
            var avMidt = Math.abs(i - BAND / 2) / (BAND / 2);
            var bi = Math.min(BAND - 1, Math.floor((1 - avMidt) * BAND * 0.75));
            var dal = 0.3 + 0.7 * avMidt;
            g.lineTo(venstre + i / BAND * bredde, y0 - b[bi] * h * 0.75 * z * dal);
          }
          g.lineTo(venstre + bredde, y0); g.closePath();
          g.fillStyle = BUNN; g.fill();
          g.strokeStyle = farge(0.38 + z * 0.25 + d.t * 0.01, 0.25 + z * 0.75);
          g.lineWidth = 0.8 + z * 2;
          if (k2 === linjer - 1) { g.shadowColor = '#19f0ff'; g.shadowBlur = 10 + s.puls * 14; }
          g.stroke();
          g.shadowBlur = 0;
        }
      }
    },
    {
      id: 'sjo', navn: 'Fjellsjøen',
      start: function () { return { glatt: new Float32Array(BAND), puls: 0 }; },
      tegn: function (g, w, h, d, s) {
        var horisont = h * 0.6;
        s.puls = d.slag ? 1 : s.puls * 0.88;
        // Fjell beveger seg ikke brått: hvert bånd glir mot målet, raskt opp
        // og sakte ned, så toppene står lenge nok til å bli sett.
        for (var q = 0; q < BAND; q++) {
          var mal = d.band[q], fart = mal > s.glatt[q] ? 0.45 : 0.06;
          s.glatt[q] += (mal - s.glatt[q]) * fart;
        }
        var himmel = g.createLinearGradient(0, 0, 0, horisont);
        himmel.addColorStop(0, BUNN); himmel.addColorStop(1, '#1d0a3a');
        g.fillStyle = himmel; g.fillRect(0, 0, w, horisont);
        // Månen blinker opp på slaget.
        var mr = Math.min(w, h) * 0.07;
        g.shadowColor = '#fff'; g.shadowBlur = 12 + s.puls * 28;
        g.fillStyle = 'rgba(255,240,250,' + (0.75 + s.puls * 0.25) + ')';
        g.beginPath(); g.arc(w * 0.78, h * 0.17, mr, 0, 2 * Math.PI); g.fill();
        g.shadowBlur = 0;

        // Seks lag, bakerst først. Lag 0 er diskanten (spisse tinder), lag 5
        // er bassen (runde åser). Hvert lag tar sin del av spekteret og
        // strekker den over hele bredden.
        var LAG = 6, per = BAND / LAG;
        function rygg(l) {
          var punkter = [], antall = 10 + (LAG - 1 - l) * 6;
          var fot = horisont - (LAG - 1 - l) * h * 0.03, hoyde = h * (0.34 - l * 0.045);
          for (var i = 0; i <= antall; i++) {
            var a = i / antall * (per - 1), i0 = Math.floor(a), f = a - i0;
            var bi = (LAG - 1 - l) * per;
            var v = s.glatt[bi + i0] * (1 - f) + s.glatt[Math.min(BAND - 1, bi + i0 + 1)] * f;
            // En fast grunnform per lag, så fjellet står der også i stillhet.
            var grunn = 0.25 + 0.2 * Math.sin(i * 1.7 + l * 2.3) * Math.sin(i * 0.6 + l);
            punkter.push([i / antall * w, fot - (grunn + v * 0.9) * hoyde]);
          }
          return { p: punkter, fot: fot, rund: l >= 3 };
        }
        function sti(r, speil) {
          // Speilbildet er klemt sammen, slik vann gjør det.
          function y(v) { return speil ? horisont + (horisont - v) * 0.55 : v; }
          g.beginPath(); g.moveTo(0, horisont);
          g.lineTo(r.p[0][0], y(r.p[0][1]));
          for (var i = 1; i < r.p.length; i++) {
            if (r.rund) {
              var mx = (r.p[i - 1][0] + r.p[i][0]) / 2, my = (r.p[i - 1][1] + r.p[i][1]) / 2;
              g.quadraticCurveTo(r.p[i - 1][0], y(r.p[i - 1][1]), mx, y(my));
            } else g.lineTo(r.p[i][0], y(r.p[i][1]));
          }
          g.lineTo(w, y(r.p[r.p.length - 1][1])); g.lineTo(w, horisont); g.closePath();
        }
        var rygger = [];
        for (var l = 0; l < LAG; l++) rygger.push(rygg(l));
        // Vannet først, så fjellet over det.
        g.fillStyle = BUNN; g.fillRect(0, horisont, w, h - horisont);
        [true, false].forEach(function (speil) {
          rygger.forEach(function (r, l) {
            var andel = l / (LAG - 1), tone = 0.95 - andel * 0.55 + d.t * 0.01;
            sti(r, speil);
            var gr = speil ? g.createLinearGradient(0, horisont + h * 0.25, 0, horisont) : g.createLinearGradient(0, horisont - h * 0.45, 0, horisont);
            gr.addColorStop(0, farge(tone, 0.95));
            gr.addColorStop(1, 'rgba(10,6,24,' + (0.55 + andel * 0.4) + ')');
            g.fillStyle = gr; g.fill();
            if (!speil) {
              g.strokeStyle = farge(tone, 1);
              g.lineWidth = 1.2 + andel * 1.3 + s.puls * 1.5;
              g.shadowColor = farge(tone); g.shadowBlur = 6 + s.puls * 16;
              g.stroke();
              g.shadowBlur = 0;
            }
          });
        });
        // Vannflaten: mørkere enn fjellet og brutt av krusninger.
        var vann = g.createLinearGradient(0, horisont, 0, h);
        vann.addColorStop(0, 'rgba(10,6,24,0.15)'); vann.addColorStop(1, 'rgba(10,6,24,0.85)');
        g.fillStyle = vann; g.fillRect(0, horisont, w, h - horisont);
        g.strokeStyle = 'rgba(25,240,255,' + (0.18 + d.diskant * 0.4) + ')'; g.lineWidth = 1;
        for (var k = 0; k < 9; k++) {
          var ky = horisont + 4 + k * k * (h - horisont) / 85, kx = (Math.sin(d.t * 0.7 + k * 1.9) * 0.5 + 0.5) * w * 0.6;
          g.beginPath(); g.moveTo(kx, ky); g.lineTo(kx + w * (0.12 + k * 0.03), ky); g.stroke();
        }
        g.strokeStyle = 'rgba(255,43,214,0.6)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, horisont); g.lineTo(w, horisont); g.stroke();
      }
    }
  ];

  /* ------------------------------------------------------------- data */

  function lagMaaler() {
    var forrigeBass = 0, snitt = 0, sistSlag = -1;
    var frekvens = null, bolge = null, band = new Float32Array(BAND);
    return function (analysator, t) {
      if (!analysator) {
        band.fill(0);
        return { band: band, bolge: bolge || new Float32Array(1024), nivaa: 0, bass: 0, mid: 0, diskant: 0, slag: false, t: t };
      }
      if (!frekvens || frekvens.length !== analysator.frequencyBinCount) {
        frekvens = new Uint8Array(analysator.frequencyBinCount);
        bolge = new Float32Array(analysator.fftSize);
      }
      analysator.getByteFrequencyData(frekvens);
      analysator.getFloatTimeDomainData(bolge);
      var fs = analysator.context.sampleRate, df = fs / analysator.fftSize, n = frekvens.length;
      // 48 bånd fra 40 Hz til 16 kHz på logaritmisk akse: ellers fyller
      // diskanten tre firedeler av bildet og bassen blir én søyle.
      for (var b = 0; b < BAND; b++) {
        var fa = 40 * Math.pow(400, b / BAND), fb = 40 * Math.pow(400, (b + 1) / BAND);
        var a = Math.max(1, Math.floor(fa / df)), z = Math.min(n - 1, Math.max(a, Math.ceil(fb / df)));
        var s = 0;
        for (var k = a; k <= z; k++) s = Math.max(s, frekvens[k]);
        // Litt krumning, så det stille ligger lavt og toppene får plass.
        band[b] = Math.pow(s / 255, 1.4);
      }
      var e = 0;
      for (var i = 0; i < bolge.length; i++) e += bolge[i] * bolge[i];
      var nivaa = Math.min(1, Math.sqrt(e / bolge.length) * 3.2);
      function snittAv(fra, til) { var s2 = 0; for (var q = fra; q < til; q++) s2 += band[q]; return s2 / (til - fra); }
      var bass = snittAv(0, 12), mid = snittAv(12, 32), diskant = snittAv(32, BAND);
      // Slag: bassen hopper klart over sitt eget glidende snitt, og ikke
      // oftere enn hvert 0,22 sekund.
      snitt = snitt * 0.92 + bass * 0.08;
      var slag = bass > snitt * 1.25 + 0.04 && bass > forrigeBass && t - sistSlag > 0.22;
      if (slag) sistSlag = t;
      forrigeBass = bass;
      return { band: band, bolge: bolge, nivaa: nivaa, bass: bass, mid: mid, diskant: diskant, slag: slag, t: t };
    };
  }

  /* ----------------------------------------------------------- lerretet */

  function lag(lerret, hentAnalysator) {
    var g = lerret.getContext('2d');
    var stilNr = 0, tilstand = STILER[0].start ? STILER[0].start() : {};
    var maal = lagMaaler(), ramme = null, w = 0, h = 0;

    function storrelse() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var bw = lerret.clientWidth || 320, bh = lerret.clientHeight || 220;
      if (Math.round(bw * dpr) !== lerret.width || Math.round(bh * dpr) !== lerret.height) {
        lerret.width = Math.round(bw * dpr);
        lerret.height = Math.round(bh * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      w = bw; h = bh;
    }

    function tegnEn(t) {
      storrelse();
      var d = maal(hentAnalysator(), t);
      g.save();
      STILER[stilNr].tegn(g, w, h, d, tilstand);
      g.restore();
      g.globalCompositeOperation = 'source-over';
      g.shadowBlur = 0;
    }

    function lop(ms) {
      tegnEn(ms / 1000);
      ramme = requestAnimationFrame(lop);
    }

    return {
      STILER: STILER,
      start: function () { if (!ramme) ramme = requestAnimationFrame(lop); },
      stopp: function () { if (ramme) cancelAnimationFrame(ramme); ramme = null; },
      gaar: function () { return !!ramme; },
      settStil: function (nr) {
        stilNr = ((nr % STILER.length) + STILER.length) % STILER.length;
        tilstand = STILER[stilNr].start ? STILER[stilNr].start() : {};
        tegnEn(performance.now() / 1000);
      },
      stil: function () { return stilNr; },
      tegnEn: function () { tegnEn(performance.now() / 1000); }
    };
  }

  return { STILER: STILER, lag: lag };
})();
