/*
 * Lysshowet — Fjellsjøen, en fjellkjede som følger lyden mens den spilles.
 *
 * Eieren valgte den av ti forslag og tre fjellvarianter. Lagene er frekvens:
 * diskanten er spisse tinder bakerst, bassen runde åser fremst, og alt
 * speiles i vannet under.
 *
 * Første utgave sto stille: fjellene hadde faste x-posisjoner, og bare
 * høyden pustet. Det som gjør den levende nå, er at hver del følger sin del
 * av lyden:
 *
 *   - Lagene glir sidelengs med parallakse, som utsikt fra en båt. Farten
 *     følger lydnivået, så stille musikk er en rolig fjord.
 *   - Hvert lag puster med energien i sitt eget frekvensområde.
 *   - Et slag sender en bølge ut over de fremste åsene.
 *   - Nordlyset bølger med mellomtonene, stjernene glitrer med diskanten.
 *   - Speilbildet er en ekte kopi av bildet over, brutt opp av krusninger
 *     som blir sterkere med bassen.
 *
 * Alle tallene kommer fra måleren hver bilderute (`data`): spekteret i 48
 * bånd på logaritmisk akse, bølgeformen, lydnivået, bass/mellom/diskant, og
 * `slag` — et sant/usant som blinker når bassen hopper.
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

  // Seks lag, bakerst først. Lag 0 er diskanten, lag 5 bassen.
  var LAG = 6, PER = BAND / LAG;

  // Terrenget er en sum av sinuser med skjeve frekvenser, så det aldri
  // gjentar seg innenfor det man ser. Bakerst er det «ryggete» (1 − |sin|),
  // som gir spisse tinder; fremst er det myke åser.
  function terreng(l, x) {
    var f = 2.1 + (LAG - 1 - l) * 1.3, a = l * 1.91;
    var spiss = 1 - l / (LAG - 1);
    var rygg = 1 - Math.abs(Math.sin(x * f + a));
    var myk = 0.5 + 0.5 * Math.sin(x * f * 0.8 + a);
    var grov = 0.5 + 0.5 * Math.sin(x * f * 0.37 + a * 2.3);
    var fin = 0.5 + 0.5 * Math.sin(x * f * 2.9 + a * 0.7);
    var t = (rygg * spiss + myk * (1 - spiss)) * 0.5 + grov * 0.35 + fin * 0.15 * spiss;
    // Krummet bakerst, så tindene står opp av en lav fot i stedet for å bli en jevn kam.
    return Math.pow(t, 1 + spiss) * (1 + spiss * 0.8);
  }

  var STILER = [
    {
      id: 'sjo', navn: 'Fjellsjøen',
      start: function () {
        // Faste stjerner (sådd, så himmelen er den samme hver gang).
        var fro = 7, stjerner = [];
        function tilfeldig() { fro = (fro * 16807) % 2147483647; return fro / 2147483647; }
        for (var i = 0; i < 70; i++) stjerner.push({ x: tilfeldig(), y: tilfeldig(), r: 0.5 + tilfeldig() * 1.2, fase: tilfeldig() * 6.3, fart: 1 + tilfeldig() * 3 });
        return { glatt: new Float32Array(BAND), energi: new Float32Array(LAG), puls: 0, x: 0, fart: 0.05, sist: null, bolger: [], stjerner: stjerner };
      },
      tegn: function (g, w, h, d, s) {
        var horisont = h * 0.6;
        var dt = s.sist === null ? 1 / 60 : Math.max(0, Math.min(0.05, d.t - s.sist));
        s.sist = d.t;
        s.puls = d.slag ? 1 : s.puls * 0.88;

        // Båndene glir raskt opp og litt saktere ned: fjellet skal reagere
        // med en gang, men ikke flimre.
        for (var q = 0; q < BAND; q++) {
          var mal = d.band[q];
          s.glatt[q] += (mal - s.glatt[q]) * (mal > s.glatt[q] ? 0.5 : 0.14);
        }
        for (var l0 = 0; l0 < LAG; l0++) {
          var sum = 0, bi0 = (LAG - 1 - l0) * PER;
          for (var k0 = 0; k0 < PER; k0++) sum += d.band[bi0 + k0];
          s.energi[l0] += (sum / PER - s.energi[l0]) * 0.2;
        }
        // Farten følger lydnivået, med et lite dytt på slaget.
        s.fart += (0.04 + d.nivaa * 0.45 + s.puls * 0.15 - s.fart) * 0.05;
        s.x += s.fart * dt;
        if (d.slag) s.bolger.push({ c: 0.2 + Math.random() * 0.6, alder: 0, styrke: 0.6 + d.bass });
        s.bolger = s.bolger.filter(function (b) { b.alder += dt; return b.alder < 1.4; }).slice(-6);

        // Himmel.
        var himmel = g.createLinearGradient(0, 0, 0, horisont);
        himmel.addColorStop(0, BUNN); himmel.addColorStop(1, '#1d0a3a');
        g.fillStyle = himmel; g.fillRect(0, 0, w, horisont);

        // Stjernene glitrer med diskanten.
        s.stjerner.forEach(function (st) {
          var a = (0.25 + 0.75 * Math.abs(Math.sin(d.t * st.fart + st.fase))) * (0.35 + d.diskant * 1.3);
          g.fillStyle = 'rgba(255,255,255,' + Math.min(1, a) + ')';
          g.fillRect(st.x * w, st.y * horisont * 0.7, st.r, st.r);
        });

        // Nordlyset: to bånd som bølger sakte og blir høyere med mellomtonene.
        g.globalCompositeOperation = 'lighter';
        g.lineCap = 'round';
        for (var n = 0; n < 2; n++) {
          var basis = h * (0.16 + n * 0.1), hoydeN = h * (0.06 + d.mid * 0.3);
          for (var x = 0; x <= w; x += 2) {
            var y = basis + Math.sin(x * 0.009 + d.t * (0.5 + n * 0.3) + n * 2) * h * 0.05 + Math.sin(x * 0.023 - d.t * 1.1) * h * 0.015;
            var lengde = hoydeN * (0.55 + 0.45 * Math.sin(x * 0.031 + d.t * 1.7 + n));
            var tone = 0.42 + n * 0.12 + Math.sin(x * 0.004 + d.t * 0.2) * 0.08;
            g.strokeStyle = farge(tone, 0.05 + d.mid * 0.12);
            g.lineWidth = 2;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - lengde); g.stroke();
            g.strokeStyle = farge(tone, 0.08 + d.mid * 0.2);
            g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - lengde * 0.35); g.stroke();
          }
        }
        g.globalCompositeOperation = 'source-over';

        // Månen blinker opp på slaget.
        var mx = w * 0.8, my = h * 0.13, mr = Math.min(w, h) * 0.06;
        g.shadowColor = '#fff'; g.shadowBlur = 12 + s.puls * 28;
        g.fillStyle = 'rgba(255,240,250,' + (0.75 + s.puls * 0.25) + ')';
        g.beginPath(); g.arc(mx, my, mr, 0, 2 * Math.PI); g.fill();
        g.shadowBlur = 0;

        // Fjellagene. Hvert lag glir med sin egen parallakse, puster med sin
        // egen energi, og har spekteret sitt strukket over bredden.
        for (var l = 0; l < LAG; l++) {
          var andel = l / (LAG - 1);
          var parallakse = 0.12 + andel * 0.9;
          var fot = horisont - (LAG - 1 - l) * h * 0.03, hoyde = h * (0.4 - l * 0.045);
          var pust = 0.45 + s.energi[l] * 1.4;
          var antall = 40 + (LAG - 1 - l) * 8, bi = (LAG - 1 - l) * PER;
          var punkter = [];
          for (var i = 0; i <= antall; i++) {
            var u = i / antall;
            var a = u * (PER - 1), i0 = Math.floor(a), f = a - i0;
            var v = s.glatt[bi + i0] * (1 - f) + s.glatt[Math.min(BAND - 1, bi + i0 + 1)] * f;
            var bolge = 0;
            if (l >= 3) {
              // Slagbølgen går utover fra der den startet, i begge retninger.
              s.bolger.forEach(function (b) {
                var r = b.alder * 0.7, avstand = Math.min(Math.abs(u - (b.c - r)), Math.abs(u - (b.c + r)));
                bolge += b.styrke * (1 - b.alder / 1.4) * Math.exp(-avstand * avstand / 0.004);
              });
              bolge *= 0.25 + (l - 3) * 0.12;
            }
            var hv = terreng(l, u * 1.6 + s.x * parallakse) * pust * 0.75 + v * 0.7 + bolge;
            punkter.push([u * w, fot - hv * hoyde]);
          }
          var tone = 0.95 - andel * 0.55 + d.t * 0.015;
          g.beginPath(); g.moveTo(0, horisont); g.lineTo(punkter[0][0], punkter[0][1]);
          for (var p = 1; p < punkter.length; p++) {
            if (l >= 3) {
              var px = (punkter[p - 1][0] + punkter[p][0]) / 2, py = (punkter[p - 1][1] + punkter[p][1]) / 2;
              g.quadraticCurveTo(punkter[p - 1][0], punkter[p - 1][1], px, py);
            } else g.lineTo(punkter[p][0], punkter[p][1]);
          }
          g.lineTo(w, punkter[punkter.length - 1][1]); g.lineTo(w, horisont); g.closePath();
          var gr = g.createLinearGradient(0, horisont - h * 0.45, 0, horisont);
          gr.addColorStop(0, farge(tone, 0.95));
          gr.addColorStop(1, 'rgba(10,6,24,' + (0.55 + andel * 0.4) + ')');
          g.fillStyle = gr; g.fill();
          g.strokeStyle = farge(tone, 1);
          g.lineWidth = 1.2 + andel * 1.3 + s.puls * 1.5;
          g.shadowColor = farge(tone); g.shadowBlur = 6 + s.puls * 16;
          g.stroke();
          g.shadowBlur = 0;
        }

        // Speilbildet er en kopi av bildet over horisonten, stripe for stripe,
        // forskjøvet sidelengs av krusninger. En tegnet speilvending i stedet
        // ville sett ut som glass.
        var dpr = g.canvas.width / w, klem = 0.6, steg = 2;
        g.fillStyle = BUNN; g.fillRect(0, horisont, w, h - horisont);
        for (var yv = horisont; yv < h; yv += steg) {
          var dybde = (yv - horisont) / (h - horisont);
          var kilde = horisont - (yv - horisont) / klem;
          if (kilde < 0) break;
          var dx = Math.sin(yv * 0.18 - d.t * 3.2) * (0.6 + dybde * 6) * (0.4 + d.bass * 1.6)
                 + Math.sin(yv * 0.05 + d.t * 1.3) * dybde * 3;
          g.drawImage(g.canvas, 0, Math.max(0, (kilde - steg / klem) * dpr), g.canvas.width, steg / klem * dpr, dx, yv, w, steg + 0.5);
        }
        var vann = g.createLinearGradient(0, horisont, 0, h);
        vann.addColorStop(0, 'rgba(10,6,24,0.3)'); vann.addColorStop(1, 'rgba(10,6,24,0.85)');
        g.fillStyle = vann; g.fillRect(0, horisont, w, h - horisont);
        // Månegata: korte glimt rett under månen, som flimrer.
        g.globalCompositeOperation = 'lighter';
        for (var m = 0; m < 14; m++) {
          var gy = horisont + 3 + m * m * (h - horisont) / 210;
          var glimt = 0.5 + 0.5 * Math.sin(d.t * 5 + m * 2.3);
          var bredde = mr * (0.4 + m * 0.12) * (0.5 + glimt);
          g.fillStyle = 'rgba(255,240,250,' + (0.1 + glimt * 0.25 + s.puls * 0.2) + ')';
          g.fillRect(mx - bredde / 2 + Math.sin(d.t * 2 + m) * 3, gy, bredde, 1.5);
        }
        g.globalCompositeOperation = 'source-over';
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
