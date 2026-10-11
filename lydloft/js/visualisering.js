/*
 * Lysshowet — ti måter å se lyden på mens den spilles.
 *
 * Ti er for mange til å bli stående; de er her for å bli valgt mellom. Hver
 * er en egen grunnform, ikke en fargevariant av en annen: søyler, en bølge,
 * en sol, partikler, en tunnel, fyrverkeri, en fjellkjede, en lavalampe, et
 * spektrogram og et monster som synger. Det er formen man velger, fargene er
 * de samme neonfargene som resten av verkstedet.
 *
 * Alle får de samme tallene hver bilderute (`data`): spekteret i 48 bånd på
 * logaritmisk akse, bølgeformen, lydnivået, bass/mellom/diskant, og `slag` —
 * et sant/usant som blinker når bassen hopper. Slaget er det som gjør at
 * fyrverkeriet smeller og galaksen eksploderer i takt i stedet for tilfeldig.
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

  // Fargeskala for spektrogrammet: mørk lilla → rosa → oransje → gul → hvit.
  // Neonpaletten rundt (rosa ved siden av cyan) gir grelle striper her; en
  // skala som bare går én vei, leses som «svakt til sterkt».
  var SKALA = [[10, 6, 24], [59, 10, 107], [255, 43, 214], [255, 138, 30], [255, 232, 61], [255, 255, 255]];
  function skala(v) {
    var a = Math.max(0, Math.min(0.999, v)) * (SKALA.length - 1), i = Math.floor(a), f = a - i;
    var x = SKALA[i], y = SKALA[i + 1];
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * f) + ',' + Math.round(x[1] + (y[1] - x[1]) * f) + ',' + Math.round(x[2] + (y[2] - x[2]) * f) + ')';
  }

  function blek(g, w, h, a) {
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(10,6,24,' + a + ')';
    g.fillRect(0, 0, w, h);
  }
  function tom(g, w, h) {
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = BUNN;
    g.fillRect(0, 0, w, h);
  }

  /* --------------------------------------------------------------- stilene */

  var STILER = [
    {
      id: 'soyler', navn: 'Neonsøyler',
      start: function () { return { topper: new Float32Array(BAND) }; },
      tegn: function (g, w, h, d, s) {
        tom(g, w, h);
        var n = 32, gap = w * 0.008, bw = (w - gap * (n + 1)) / n, bunn = h * 0.72;
        for (var i = 0; i < n; i++) {
          var v = d.band[Math.floor(i * BAND / n)];
          var bh = Math.max(3, v * bunn * 0.95), x = gap + i * (bw + gap);
          var gr = g.createLinearGradient(0, bunn - bh, 0, bunn);
          gr.addColorStop(0, farge(i / n + d.t * 0.03));
          gr.addColorStop(1, farge(i / n + 0.25 + d.t * 0.03, 0.6));
          g.fillStyle = gr;
          g.shadowColor = farge(i / n + d.t * 0.03);
          g.shadowBlur = 12;
          g.fillRect(x, bunn - bh, bw, bh);
          g.shadowBlur = 0;
          // Speilbildet i «gulvet».
          g.fillStyle = farge(i / n + d.t * 0.03, 0.18);
          g.fillRect(x, bunn + 2, bw, bh * 0.35);
          // Toppene faller sakte, så de rekker å bli sett.
          s.topper[i] = Math.max(v, s.topper[i] - 0.012);
          g.fillStyle = '#fff';
          g.fillRect(x, bunn - s.topper[i] * bunn * 0.95 - 5, bw, 3);
        }
      }
    },
    {
      id: 'bolge', navn: 'Bølgen',
      tegn: function (g, w, h, d) {
        blek(g, w, h, 0.45);
        // Et oscilloskop låser seg på samme sted i svingningen hver gang
        // (der bølgen krysser null på vei opp). Uten det hopper bølgen
        // sideveis hvert bilde og blir en lysende klump.
        var b = d.bolge, n = b.length, start = 0;
        for (var i = 1; i < n / 2; i++) if (b[i - 1] < 0 && b[i] >= 0) { start = i; break; }
        var vis = Math.floor(n / 2), punkter = Math.min(vis, Math.round(w * 1.5));
        var midt = h / 2, forsterk = h * 0.42 * (0.8 + d.bass * 0.6);
        [[0, 1, 3.5, 1], [0.35, -0.55, 1.5, 0.55]].forEach(function (lag) {
          g.beginPath();
          for (var k = 0; k < punkter; k++) {
            var idx = start + Math.floor(k * vis / punkter);
            var x = k / (punkter - 1) * w, y = midt + b[idx] * forsterk * lag[1];
            if (k) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.strokeStyle = farge(d.t * 0.05 + lag[0], lag[3]);
          g.lineWidth = lag[2];
          g.shadowColor = farge(d.t * 0.05 + lag[0]);
          g.shadowBlur = 14;
          g.stroke();
        });
        g.shadowBlur = 0;
      }
    },
    {
      id: 'sol', navn: 'Solen',
      start: function () { return { vri: 0 }; },
      tegn: function (g, w, h, d, s) {
        tom(g, w, h);
        var cx = w / 2, cy = h / 2, r0 = Math.min(w, h) * (0.16 + d.bass * 0.06), maks = Math.min(w, h) * 0.32;
        s.vri += 0.004 + d.nivaa * 0.02;
        var kjerne = g.createRadialGradient(cx, cy, 0, cx, cy, r0 * 1.6);
        kjerne.addColorStop(0, 'rgba(255,255,255,' + (0.5 + d.bass * 0.5) + ')');
        kjerne.addColorStop(0.35, farge(d.t * 0.04, 0.8));
        kjerne.addColorStop(1, 'rgba(10,6,24,0)');
        g.fillStyle = kjerne;
        g.beginPath(); g.arc(cx, cy, r0 * 1.6, 0, 2 * Math.PI); g.fill();
        g.globalCompositeOperation = 'lighter';
        var straaler = 96;
        g.lineCap = 'round';
        for (var i = 0; i < straaler; i++) {
          // Speilet rundt sirkelen, så bassen står på begge sider.
          var b = i < straaler / 2 ? i : straaler - 1 - i;
          var v = d.band[Math.floor(b * BAND / (straaler / 2))];
          var a = s.vri + i / straaler * 2 * Math.PI, l = 4 + v * maks;
          g.strokeStyle = farge(i / straaler + d.t * 0.02);
          g.lineWidth = Math.max(2, Math.min(w, h) * 0.012);
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l));
          g.stroke();
        }
      }
    },
    {
      id: 'galakse', navn: 'Galaksen',
      start: function () { return { p: [] }; },
      tegn: function (g, w, h, d, s) {
        blek(g, w, h, 0.3);
        g.globalCompositeOperation = 'lighter';
        var cx = w / 2, cy = h / 2;
        function lag(antall, fart) {
          for (var i = 0; i < antall && s.p.length < 700; i++) {
            var a = Math.random() * 2 * Math.PI, v = fart * (0.4 + Math.random());
            s.p.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, liv: 1, f: Math.random() * 0.3 + d.t * 0.05, r: 1 + Math.random() * 2.5 });
          }
        }
        lag(Math.round(d.nivaa * 6), 1.5 + d.mid * 3);
        if (d.slag) lag(45, 4 + d.bass * 6);
        var spinn = 0.012 + d.diskant * 0.03;
        s.p = s.p.filter(function (q) {
          // Litt virvel, så det blir en galakse og ikke bare en eksplosjon.
          var dx = q.x - cx, dy = q.y - cy;
          q.vx += -dy * spinn * 0.02; q.vy += dx * spinn * 0.02;
          q.x += q.vx; q.y += q.vy; q.liv -= 0.012;
          if (q.liv <= 0 || q.x < -20 || q.x > w + 20 || q.y < -20 || q.y > h + 20) return false;
          g.fillStyle = farge(q.f, q.liv * 0.7);
          g.beginPath(); g.arc(q.x, q.y, q.r * (0.7 + d.bass * 0.6), 0, 2 * Math.PI); g.fill();
          return true;
        });
      }
    },
    {
      id: 'tunnel', navn: 'Tunnelen',
      start: function () { return { ringer: [], teller: 0, vri: 0 }; },
      tegn: function (g, w, h, d, s) {
        blek(g, w, h, 0.35);
        g.globalCompositeOperation = 'lighter';
        s.teller++;
        s.vri += 0.006 + d.nivaa * 0.02;
        if (d.slag || s.teller % Math.max(6, Math.round(22 - d.nivaa * 30)) === 0) {
          s.ringer.push({ r: 4, f: d.t * 0.07 + s.teller * 0.013, kanter: d.slag ? 6 : 4 + Math.floor(Math.random() * 3), tykk: d.slag ? 5 : 2.5 });
        }
        var cx = w / 2, cy = h / 2, maks = Math.hypot(w, h) / 1.6;
        s.ringer = s.ringer.filter(function (ring) {
          ring.r *= 1.035 + d.nivaa * 0.05;
          if (ring.r > maks) return false;
          var dybde = ring.r / maks;
          g.strokeStyle = farge(ring.f, 0.3 + dybde * 0.7);
          g.lineWidth = ring.tykk * (0.3 + dybde * 2);
          g.beginPath();
          for (var k = 0; k <= ring.kanter; k++) {
            var a = s.vri * (1 + ring.kanter * 0.1) + k / ring.kanter * 2 * Math.PI;
            var x = cx + Math.cos(a) * ring.r, y = cy + Math.sin(a) * ring.r * 0.75;
            if (k) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.stroke();
          return true;
        });
      }
    },
    {
      id: 'fyrverkeri', navn: 'Fyrverkeri',
      start: function () { return { raketter: [], gnister: [], sist: 0 }; },
      tegn: function (g, w, h, d, s) {
        blek(g, w, h, 0.2);
        g.globalCompositeOperation = 'lighter';
        // Uten tydelig takt skytes det likevel opp når det er lyd, bare sjeldnere.
        var nok = d.t - s.sist > Math.max(0.35, 1.6 - d.nivaa * 3);
        if ((d.slag || (nok && d.nivaa > 0.03)) && s.raketter.length < 6) {
          s.sist = d.t;
          s.raketter.push({ x: w * (0.15 + Math.random() * 0.7), y: h, vy: -(h * 0.018 + Math.random() * h * 0.006), f: Math.random(), topp: h * (0.15 + Math.random() * 0.3) });
        }
        s.raketter = s.raketter.filter(function (r) {
          r.y += r.vy; r.vy *= 0.985;
          g.fillStyle = farge(r.f);
          g.fillRect(r.x - 1.5, r.y, 3, 10);
          if (r.y > r.topp && r.vy < -1) return true;
          var antall = 50 + Math.round(d.nivaa * 60);
          for (var i = 0; i < antall; i++) {
            var a = Math.random() * 2 * Math.PI, v = (1 + Math.random() * 3) * (h / 240);
            s.gnister.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, liv: 1, f: r.f + Math.random() * 0.1 });
          }
          return false;
        });
        s.gnister = s.gnister.filter(function (q) {
          q.x += q.vx; q.y += q.vy; q.vy += h / 6000; q.vx *= 0.985; q.liv -= 0.014;
          if (q.liv <= 0) return false;
          g.fillStyle = farge(q.f, q.liv);
          g.fillRect(q.x - 1.2, q.y - 1.2, 2.4, 2.4);
          return true;
        }).slice(-900);
      }
    },
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
      id: 'lava', navn: 'Lavalampen',
      start: function () {
        var b = [];
        for (var i = 0; i < 7; i++) b.push({ fx: 0.13 + i * 0.05, fy: 0.21 + i * 0.037, fase: i * 1.7, f: i / 7 });
        return { blobber: b };
      },
      tegn: function (g, w, h, d, s) {
        tom(g, w, h);
        g.globalCompositeOperation = 'lighter';
        var grupper = [d.bass, d.bass, d.mid, d.mid, d.diskant, d.mid, d.bass];
        s.blobber.forEach(function (b, i) {
          var x = w / 2 + Math.sin(d.t * b.fx + b.fase) * w * 0.33;
          var y = h / 2 + Math.cos(d.t * b.fy + b.fase * 1.3) * h * 0.3;
          var r = Math.min(w, h) * (0.12 + grupper[i] * 0.22);
          var gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, farge(b.f + d.t * 0.02, 0.95));
          gr.addColorStop(0.5, farge(b.f + d.t * 0.02, 0.45));
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill();
        });
      }
    },
    {
      id: 'foss', navn: 'Fossen',
      start: function () { return { lerret: null }; },
      tegn: function (g, w, h, d, s) {
        // Spektrogrammet bor på sitt eget lerret, som flyttes ett steg til
        // venstre per bilde; ellers måtte hele historien tegnes på nytt.
        if (!s.lerret || s.lerret.width !== Math.round(w) || s.lerret.height !== Math.round(h)) {
          s.lerret = document.createElement('canvas');
          s.lerret.width = Math.round(w); s.lerret.height = Math.round(h);
          var t0 = s.lerret.getContext('2d'); t0.fillStyle = BUNN; t0.fillRect(0, 0, w, h);
        }
        var l = s.lerret, lg = l.getContext('2d'), steg = 3;
        lg.drawImage(l, -steg, 0);
        // To rader per bånd, interpolert, så det ikke blir trappetrinn.
        var rader = BAND * 2, rad = h / rader;
        for (var i = 0; i < rader; i++) {
          var a = i / 2, i0 = Math.floor(a), i1 = Math.min(BAND - 1, i0 + 1), f = a - i0;
          var v = Math.pow(d.band[i0] * (1 - f) + d.band[i1] * f, 1.6);
          lg.fillStyle = skala(v);
          lg.fillRect(w - steg, h - (i + 1) * rad, steg, rad + 1);
        }
        tom(g, w, h);
        g.drawImage(l, 0, 0, w, h);
      }
    },
    {
      id: 'monster', navn: 'Monsteret',
      start: function () { return { blunk: 0, hopp: 0, munn: 0 }; },
      tegn: function (g, w, h, d, s) {
        tom(g, w, h);
        if (d.slag) { s.hopp = 1; if (Math.random() < 0.35) s.blunk = 1; }
        s.hopp *= 0.86; s.blunk = Math.max(0, s.blunk - 0.12);
        s.munn += (d.nivaa * 2.2 - s.munn) * 0.35;
        var r = Math.min(w * 0.3, h * 0.38), cx = w / 2, cy = h * 0.54 - s.hopp * h * 0.06;
        var kropp = farge(d.t * 0.03), lys = farge(d.t * 0.03 + 0.4);
        g.shadowColor = kropp; g.shadowBlur = 24;
        // Antennen: ballen gløder med diskanten.
        g.strokeStyle = kropp; g.lineWidth = 4;
        g.beginPath(); g.moveTo(cx, cy - r); g.quadraticCurveTo(cx + r * 0.3, cy - r * 1.35, cx + r * 0.1, cy - r * 1.45); g.stroke();
        g.fillStyle = lys;
        g.beginPath(); g.arc(cx + r * 0.1, cy - r * 1.45, 5 + d.diskant * r * 0.25, 0, 2 * Math.PI); g.fill();
        // Kroppen klemmes litt sammen på slaget.
        g.fillStyle = kropp;
        g.beginPath(); g.ellipse(cx, cy, r * (1 + s.hopp * 0.08), r * (1 - s.hopp * 0.06), 0, 0, 2 * Math.PI); g.fill();
        g.shadowBlur = 0;
        // Øynene.
        [-1, 1].forEach(function (side) {
          var ex = cx + side * r * 0.38, ey = cy - r * 0.25, er = r * 0.22;
          g.fillStyle = '#fff';
          g.beginPath(); g.ellipse(ex, ey, er, er * Math.max(0.08, 1 - s.blunk), 0, 0, 2 * Math.PI); g.fill();
          if (s.blunk < 0.5) {
            g.fillStyle = BUNN;
            g.beginPath(); g.arc(ex + Math.sin(d.t * 1.3) * er * 0.35, ey + Math.cos(d.t * 0.9) * er * 0.2, er * 0.45, 0, 2 * Math.PI); g.fill();
          }
        });
        // Munnen åpner seg med lyden, og bølgeformen synger inni den.
        var mb = r * 0.75, mh = Math.max(4, Math.min(r * 0.55, s.munn * r * 0.7)), my = cy + r * 0.35;
        g.fillStyle = BUNN;
        g.beginPath(); g.ellipse(cx, my, mb / 2, mh / 2, 0, 0, 2 * Math.PI); g.fill();
        g.save();
        g.beginPath(); g.ellipse(cx, my, mb / 2, mh / 2, 0, 0, 2 * Math.PI); g.clip();
        g.strokeStyle = lys; g.lineWidth = 3;
        g.beginPath();
        var n = d.bolge.length;
        for (var i = 0; i < 64; i++) {
          var x = cx - mb / 2 + i / 63 * mb, y = my + d.bolge[Math.floor(i * n / 64)] * mh * 1.2;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
        g.restore();
        // Føttene tramper i takt.
        g.fillStyle = kropp;
        [-1, 1].forEach(function (side) {
          var fot = side * (s.hopp > 0.4 ? 1 : 0) * 6;
          g.beginPath(); g.ellipse(cx + side * r * 0.5, cy + r * 0.98 + fot * (side > 0 ? 1 : -1), r * 0.22, r * 0.1, 0, 0, 2 * Math.PI); g.fill();
        });
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
