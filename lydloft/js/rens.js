/*
 * Rens — det som gjør et telefonopptak til noe det er hyggelig å høre på.
 *
 * Opptakene er ikke komprimerte; de er rå samplinger. Det som gjør dem
 * dårlige, er det testbenken målte: lavt nivå (−33 dBFS i toppene uten
 * nettleserens behandling), sus i pausene, et klikk fra knappen i hver ende,
 * tynn bass fra en mikrofon laget for tale, og et barn som spiller sterkt og
 * svakt om hverandre. Kjeden tar dem i den rekkefølgen de må tas:
 *
 *   1. Lavkutt på 35 Hz      — likespenning, håndtering, trafikkdur
 *   2. Klipp endene          — stillheten og knappeklikkene før og etter
 *   3. Støyfjerning          — suset, målt i de stilleste delene
 *   4. Klangretting          — et forsiktig dytt mot vanlig musikkbalanse
 *   5. Kompresjon            — de svake partiene opp mot de sterke
 *   6. Nivå og limiter       — −16 LUFS, toppene under −1 dBTP
 *
 * Hvert trinn er forsiktig med vilje. Støyfjerning som tar alt, gir den
 * kvitrende «undervannslyden» (musikalsk støy); klangretting som retter helt,
 * løfter suset i bånd der instrumentet ikke spiller. Trinn som ikke kan måle
 * det de trenger — støy i et opptak uten pauser — hopper over seg selv.
 *
 * Nivået er −16, ikke −14 som ved lagring: effektene etterpå (bass, ekko,
 * romklang) trenger litt plass før limiteren i kjeden tar i.
 */
'use strict';

var LydRens = (function () {

  var D = LydDsp;

  var STANDARD = { stoyfjerning: 0.7, jevning: 0.5, klangretting: 0.5 };
  var MAAL_LUFS = -16;

  /* ---------------------------------------------------------------- hjelp */

  function dbAmp(a) { return a > 0 ? 20 * Math.log10(a) : -200; }

  function rammenivaa(m, fs, ms) {
    var r = Math.max(1, Math.round(fs * ms / 1000)), n = Math.floor(m.length / r);
    var ut = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var s = 0;
      for (var k = i * r; k < (i + 1) * r; k++) s += m[k] * m[k];
      ut[i] = dbAmp(Math.sqrt(s / r));
    }
    return { db: ut, r: r };
  }

  function persentil(arr, p) {
    var s = Array.prototype.slice.call(arr).sort(function (a, b) { return a - b; });
    return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
  }

  // Flere biquads etter hverandre i én løkke, uten mellomtabeller.
  function kaskade(filtre, x) {
    var m = filtre.length, y = new Float64Array(x.length);
    var b0 = [], b1 = [], b2 = [], a1 = [], a2 = [];
    filtre.forEach(function (f) { b0.push(f.b[0]); b1.push(f.b[1]); b2.push(f.b[2]); a1.push(f.a[1]); a2.push(f.a[2]); });
    var s1 = new Float64Array(m), s2 = new Float64Array(m);
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      for (var k = 0; k < m; k++) {
        // Transponert direkte form II: to tilstander per filter.
        var u = b0[k] * v + s1[k];
        s1[k] = b1[k] * v - a1[k] * u + s2[k];
        s2[k] = b2[k] * v - a2[k] * u;
        v = u;
      }
      y[i] = v;
    }
    return y;
  }

  // FFT med ferdig utregnede vinkler og bitreversering for én lengde. Den
  // generelle i dsp.js regner vinklene på nytt hver gang, og rensen kaller den
  // over hundre tusen ganger for fire minutter musikk.
  function lagFft(N) {
    var rev = new Uint32Array(N), bits = Math.log2(N);
    for (var i = 0; i < N; i++) {
      var r = 0;
      for (var b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
      rev[i] = r;
    }
    var cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
    for (var k = 0; k < N / 2; k++) { cos[k] = Math.cos(2 * Math.PI * k / N); sin[k] = Math.sin(2 * Math.PI * k / N); }
    return function (re, im, invers) {
      var t;
      for (var i = 0; i < N; i++) {
        var j = rev[i];
        if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      var fortegn = invers ? 1 : -1;
      for (var len = 2; len <= N; len <<= 1) {
        var halv = len >> 1, steg = N / len;
        for (var s = 0; s < N; s += len) {
          for (var k = 0; k < halv; k++) {
            var wr = cos[k * steg], wi = fortegn * sin[k * steg];
            var a = s + k, b = a + halv;
            var tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          }
        }
      }
      if (invers) for (var q = 0; q < N; q++) { re[q] /= N; im[q] /= N; }
    };
  }

  function mono(kanaler) {
    var n = kanaler[0].length, m = new Float64Array(n);
    kanaler.forEach(function (k) { for (var i = 0; i < n; i++) m[i] += k[i]; });
    for (var j = 0; j < n; j++) m[j] /= kanaler.length;
    return m;
  }

  /* -------------------------------------------------------- 2. klipp endene */

  // Musikken starter der det første sammenhengende partiet på minst 80 ms
  // begynner. Et klikk fra knappen er kortere, og blir derfor liggende utenfor.
  function finnEnder(m, fs) {
    var rn = rammenivaa(m, fs, 10), db = rn.db, r = rn.r, n = db.length;
    if (n < 30) return null;
    var gulv = persentil(db, 0.1), topp = persentil(db, 0.99);
    var terskel = Math.max(gulv + 15, topp - 45);
    var aktiv = Array.prototype.map.call(db, function (v) { return v > terskel; });
    var RUN = 8, forst = -1, sist = -1;
    for (var i = 0; i + RUN <= n && forst < 0; i++) {
      var ok = true;
      for (var k = i; k < i + RUN; k++) if (!aktiv[k]) { ok = false; break; }
      if (ok) forst = i;
    }
    for (var j = n - 1; j - RUN + 1 >= 0 && sist < 0; j--) {
      var ok2 = true;
      for (var q = j - RUN + 1; q <= j; q++) if (!aktiv[q]) { ok2 = false; break; }
      if (ok2) sist = j;
    }
    if (forst < 0 || sist < forst) return null;
    var fra = Math.max(0, forst * r - Math.round(0.12 * fs));
    var til = Math.min(m.length, (sist + 1) * r + Math.round(0.3 * fs));
    // Et isolert smell i marginene er knappen, ikke musikken.
    for (var a = Math.floor(fra / r); a < forst; a++) if (db[a] > terskel + 6) fra = (a + 2) * r;
    for (var b = sist + 1; b < Math.min(n, Math.ceil(til / r)); b++) {
      if (db[b] > terskel + 6) { til = Math.max((sist + 1) * r, (b - 1) * r); break; }
    }
    if (til - fra < 0.5 * fs) return null;
    return { fra: fra, til: til };
  }

  /* ------------------------------------------------------- 3. støyfjerning */

  /*
   * Spektral subtraksjon med et gulv. Støyen måles i de stilleste rammene;
   * er det for liten forskjell mellom dem og resten (et opptak uten pauser),
   * vet vi ikke hva som er sus og hva som er en svak tone, og da lar vi være.
   * Forsterkningen åpner straks og lukker sakte: det er det som holder
   * anslagene skarpe og hindrer kvitringen fra gevinster som blafrer.
   */
  function stoyfjern(kanaler, fs, styrke) {
    var n = kanaler[0].length;
    // 50 % overlapp: sqrt-Hann inn og ut summerer da til nøyaktig 1, og det
    // er halvparten så mange rammer som med 75 % — den største enkeltbesparingen.
    var N = 2048, hopp = 1024;
    if (n < N * 4 || styrke <= 0) return null;
    var vindu = new Float64Array(N);
    for (var i = 0; i < N; i++) vindu[i] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    var m = mono(kanaler);
    var rammer = Math.floor((n - N) / hopp) + 1;

    // Energi per ramme, for å finne de stilleste.
    var energi = new Float64Array(rammer);
    for (var f = 0; f < rammer; f++) {
      var s = 0, o = f * hopp;
      for (var k = 0; k < N; k++) { var v = m[o + k] * vindu[k]; s += v * v; }
      energi[f] = s;
    }
    var e5 = persentil(energi, 0.05), median = persentil(energi, 0.5);
    if (e5 <= 0 || median / e5 < 10) return null;       // under 10 dB kontrast
    var stille = [];
    for (var g = 0; g < rammer; g++) if (energi[g] <= e5 * 2) stille.push(g);
    if (stille.length < 5) return null;

    var B = N / 2 + 1, re = new Float64Array(N), im = new Float64Array(N);
    var fft = lagFft(N);
    var stoy = new Float64Array(B);
    stille.forEach(function (f) {
      for (var k = 0; k < N; k++) { re[k] = m[f * hopp + k] * vindu[k]; im[k] = 0; }
      fft(re, im, false);
      for (var b = 0; b < B; b++) stoy[b] += re[b] * re[b] + im[b] * im[b];
    });
    for (var b0 = 0; b0 < B; b0++) stoy[b0] /= stille.length;

    var alfa = 1 + 2 * styrke;
    var gulvDb = 6 + 12 * styrke, gulv = Math.pow(10, -gulvDb / 20);
    var forrige = new Float64Array(B).fill(1), gevinst = new Float64Array(B), glatt = new Float64Array(B);
    var ut = kanaler.map(function () { return new Float64Array(n); });
    var venstre = kanaler[0], hoyre = kanaler[kanaler.length - 1], to = kanaler.length > 1;

    /*
     * Venstre kanal som realdel og høyre som imaginærdel: én FFT gir begge
     * spektrene. Summen av kanalene (det gevinsten regnes ut fra) er X + Y,
     * og den kan leses rett ut av det pakkede spekteret. Gevinsten er reell
     * og lik for k og N−k, så den kan ganges rett inn i det pakkede
     * spekteret, og én invers FFT gir begge kanalene tilbake.
     */
    for (var r = 0; r < rammer; r++) {
      var start = r * hopp;
      for (var q = 0; q < N; q++) {
        re[q] = venstre[start + q] * vindu[q];
        im[q] = to ? hoyre[start + q] * vindu[q] : 0;
      }
      fft(re, im, false);
      for (var b1 = 0; b1 < B; b1++) {
        var nk = (N - b1) % N;
        // X = (Z[k] + conj Z[N−k]) / 2, Y = (Z[k] − conj Z[N−k]) / 2i
        var xr = (re[b1] + re[nk]) / 2, xi = (im[b1] - im[nk]) / 2;
        var yr = (im[b1] + im[nk]) / 2, yi = -(re[b1] - re[nk]) / 2;
        var mr = to ? (xr + yr) / 2 : xr, mi = to ? (xi + yi) / 2 : xi;
        var p = mr * mr + mi * mi + 1e-20;
        gevinst[b1] = Math.max(gulv, 1 - alfa * stoy[b1] / p);
      }
      for (var b2 = 0; b2 < B; b2++) {
        var gs = (gevinst[Math.max(0, b2 - 1)] + 2 * gevinst[b2] + gevinst[Math.min(B - 1, b2 + 1)]) / 4;
        glatt[b2] = gs >= forrige[b2] ? gs : forrige[b2] * 0.42 + gs * 0.58;   // ~0,05 s per ramme
        forrige[b2] = glatt[b2];
      }
      for (var b3 = 0; b3 < B; b3++) {
        re[b3] *= glatt[b3]; im[b3] *= glatt[b3];
        if (b3 > 0 && b3 < N / 2) { re[N - b3] *= glatt[b3]; im[N - b3] *= glatt[b3]; }
      }
      fft(re, im, true);
      var y0 = ut[0], y1 = ut[ut.length - 1];
      for (var u = 0; u < N; u++) {
        var w = vindu[u];
        y0[start + u] += re[u] * w;
        if (to) y1[start + u] += im[u] * w;
      }
    }
    // Endene som ikke dekkes av fire rammer, tas fra originalen.
    var dekket = (rammer - 1) * hopp + N;
    for (var c2 = 0; c2 < kanaler.length; c2++) {
      for (var a1 = 0; a1 < N - hopp; a1++) {
        var vekt = a1 / (N - hopp);
        ut[c2][a1] = ut[c2][a1] * vekt + kanaler[c2][a1] * (1 - vekt);
      }
      for (var a2 = dekket - N + hopp; a2 < n; a2++) {
        if (a2 >= dekket) { ut[c2][a2] = kanaler[c2][a2]; continue; }
        var w = (dekket - a2) / (N - hopp);
        ut[c2][a2] = ut[c2][a2] * w + kanaler[c2][a2] * (1 - w);
      }
    }
    var stoyRms = 0;
    for (var bb = 0; bb < B; bb++) stoyRms += stoy[bb];
    // Ensidig effekt fra et sqrt-Hann-vindu summerer til σ² · N² / 4.
    return { kanaler: ut, stoyDb: 10 * Math.log10(4 * stoyRms / (N * N) + 1e-20), dempingDb: gulvDb, stoy: stoy, N: N };
  }

  /* ------------------------------------------------------- 4. klangretting */

  // Oktavbånd og et grovt mål for hvordan musikk pleier å fordele seg, i dB
  // mot 1 kHz. Bare et dytt i den retningen — et barn som spiller blokkfløyte
  // skal ikke høres ut som et band.
  var BAND = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  var MAAL = { 63: -2, 125: 1, 250: 2, 500: 2, 1000: 0, 2000: -3, 4000: -6, 8000: -10, 16000: -17 };

  function klangretting(kanaler, fs, styrke, stoySpek) {
    if (styrke <= 0) return null;
    var m = mono(kanaler);
    // Et langt opptak trenger ikke hvert sekund for å vise klangbalansen:
    // 60 jevnt fordelte biter på ett sekund er nok, og ti ganger raskere.
    if (m.length > 90 * fs) {
      var bit = fs, antall = 60, utvalg = new Float64Array(bit * antall);
      for (var a = 0; a < antall; a++) {
        var fra = Math.floor(a * (m.length - bit) / (antall - 1));
        utvalg.set(m.subarray(fra, fra + bit), a * bit);
      }
      m = utvalg;
    }
    var spek = D.spektrum(m, fs, 8192);
    if (!spek) return null;
    function bandniva(per, df, fc, skala) {
      var a = Math.max(1, Math.floor(fc / Math.SQRT2 / df)), b = Math.min(per.length - 1, Math.ceil(fc * Math.SQRT2 / df));
      var s = 0;
      for (var k = a; k <= b; k++) s += per[k];
      return 10 * Math.log10(s * (skala || 1) + 1e-30);
    }
    var bruk = BAND.filter(function (fc) { return fc * Math.SQRT2 < fs / 2; });
    var niva = {}, stoyNiva = {};
    bruk.forEach(function (fc) {
      niva[fc] = bandniva(spek.effekt, spek.df, fc);
      // Støyspekteret fra støyfjerningen er i rå FFT-effekt; skaler det til
      // samme mål som Welch-spekteret (A²/2 per sinus).
      if (stoySpek) stoyNiva[fc] = bandniva(stoySpek.stoy, fs / stoySpek.N, fc, 4 / (stoySpek.N * stoySpek.N));
    });
    var ref = niva[1000];
    var faktor = 0.8 * styrke, ret = {};
    bruk.forEach(function (fc) {
      var r = (MAAL[fc] - (niva[fc] - ref)) * faktor;
      r = Math.max(-4, Math.min(5, r));
      // Løft aldri et bånd der det bare er sus.
      var snr = stoySpek ? niva[fc] - stoyNiva[fc] : 40;
      if (r > 0 && snr < 15) r = 0;
      ret[fc] = r;
    });
    var glatt = {};
    bruk.forEach(function (fc, i) {
      var a = ret[bruk[Math.max(0, i - 1)]], b = ret[fc], c = ret[bruk[Math.min(bruk.length - 1, i + 1)]];
      glatt[fc] = 0.25 * a + 0.5 * b + 0.25 * c;
    });
    var filtre = bruk.map(function (fc, i) {
      if (i === 0) return D.biquad('lavhylle', fs, 90, 0.7071, glatt[fc]);
      if (i === bruk.length - 1 && fc >= 8000) return D.biquad('hoyhylle', fs, fc / 1.45, 0.7071, glatt[fc]);
      return D.biquad('topp', fs, fc, 1.2, glatt[fc]);
    });
    // Bånd som knapt rettes, hoppes over: hvert filter er en gjennomgang til.
    var brukte = filtre.filter(function (f, i) { return Math.abs(glatt[bruk[i]]) >= 0.3; });
    var ut = brukte.length ? kanaler.map(function (k) { return kaskade(brukte, k); }) : kanaler;
    return { kanaler: ut, gevinst: glatt };
  }

  /* ------------------------------------------------------- 5. kompresjon */

  function komprimer(kanaler, fs, styrke) {
    if (styrke <= 0) return null;
    var n = kanaler[0].length, m = mono(kanaler);
    var rn = rammenivaa(m, fs, 50);
    var aktive = Array.prototype.filter.call(rn.db, function (v) { return v > -80; });
    if (aktive.length < 4) return null;
    var terskel = persentil(aktive, 0.6), ratio = 1 + 3 * styrke, kne = 6;
    var inn = Math.exp(-1 / (0.01 * fs)), ut = Math.exp(-1 / (0.15 * fs));
    // Logaritme og potens per sampling er det som koster; detektoren går per
    // sampling, men forsterkningen regnes ut hver 16. og interpoleres.
    var TETT = 16, punkter = Math.ceil(n / TETT) + 1;
    var gPunkt = new Float64Array(punkter), env = 0, sum = 0;
    for (var i = 0; i < n; i++) {
      var p = m[i] * m[i];
      env = p > env ? inn * env + (1 - inn) * p : ut * env + (1 - ut) * p;
      if (i % TETT) continue;
      var lvl = 10 * Math.log10(env + 1e-20), over = lvl - terskel, gr;
      if (over <= -kne / 2) gr = 0;
      else if (over >= kne / 2) gr = over * (1 - 1 / ratio);
      else gr = (1 - 1 / ratio) * Math.pow(over + kne / 2, 2) / (2 * kne);
      gPunkt[i / TETT] = Math.pow(10, -gr / 20);
      sum += gr;
    }
    gPunkt[punkter - 1] = gPunkt[punkter - 2];
    // 5 ms framsyn: forsterkningen senkes før anslaget, ikke midt i det.
    var L = Math.round(0.005 * fs);
    var g = new Float64Array(n);
    for (var j = 0; j < n; j++) {
      var t = Math.min(n - 1, j + L) / TETT, a0 = Math.floor(t), f = t - a0;
      g[j] = gPunkt[a0] * (1 - f) + gPunkt[Math.min(punkter - 1, a0 + 1)] * f;
    }
    sum = sum / (n / TETT) * n;
    var resultat = kanaler.map(function (k) {
      var y = new Float64Array(n);
      for (var q = 0; q < n; q++) y[q] = k[q] * g[q];
      return y;
    });
    return { kanaler: resultat, snittDb: sum / n, ratio: ratio };
  }

  /* ------------------------------------------------ 6. nivå og limiter */

  // Limiter med framsyn: det som kreves for at hver sampling skal holde seg
  // under taket, tas minimum av over ±L og glattes med et vindu like bredt —
  // da er forsterkningen nede i tide, og den går ned uten et knepp.
  function begrens(kanaler, fs, takDb) {
    var n = kanaler[0].length, tak = Math.pow(10, takDb / 20);
    var L = Math.max(1, Math.round(0.003 * fs));
    var krav = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var a = 0;
      for (var c = 0; c < kanaler.length; c++) a = Math.max(a, Math.abs(kanaler[c][i]));
      krav[i] = a > tak ? tak / a : 1;
    }
    // Glidende minimum med en kø, så det går i lineær tid.
    var mini = new Float64Array(n), ko = [], hode = 0;
    for (var j = 0; j < n + L; j++) {
      if (j < n) {
        while (ko.length > hode && krav[ko[ko.length - 1]] >= krav[j]) ko.pop();
        ko.push(j);
      }
      var midt = j - L;
      if (midt >= 0) {
        while (ko[hode] < midt - L) hode++;
        mini[midt] = krav[ko[hode]];
      }
    }
    var kum = new Float64Array(n + 1);
    for (var q = 0; q < n; q++) kum[q + 1] = kum[q] + mini[q];
    var slipp = 1 - Math.exp(-1 / (0.08 * fs)), g = 1, minst = 1;
    var ut = kanaler.map(function () { return new Float64Array(n); });
    for (var k = 0; k < n; k++) {
      var a0 = Math.max(0, k - L), a1 = Math.min(n, k + L + 1);
      var maal = (kum[a1] - kum[a0]) / (a1 - a0);
      g = maal < g ? maal : g + (maal - g) * slipp;
      if (g < minst) minst = g;
      for (var c2 = 0; c2 < kanaler.length; c2++) ut[c2][k] = kanaler[c2][k] * g;
    }
    return { kanaler: ut, mestDb: -dbAmp(minst) };
  }

  /* ---------------------------------------------------------------- kjeden */

  function rens(kanaler, fs, valg) {
    var v = {};
    Object.keys(STANDARD).forEach(function (k) { v[k] = valg && valg[k] !== undefined ? valg[k] : STANDARD[k]; });
    var rapport = { lufsFor: D.lufs(kanaler, fs) };

    // 1. Lavkutt
    var hp = D.biquad('hoypass', fs, 35, 0.7071);
    var x = kanaler.map(function (k) { return kaskade([hp, hp], k); });

    // 2. Endene
    var ender = finnEnder(mono(x), fs);
    rapport.trimFra = 0; rapport.trimmet = 0;
    if (ender) {
      var n0 = x[0].length;
      x = x.map(function (k) { return k.slice(ender.fra, ender.til); });
      rapport.trimFra = ender.fra / fs;
      rapport.trimmet = (n0 - (ender.til - ender.fra)) / fs;
    }
    var inn = Math.round(0.01 * fs), ut = Math.round(0.04 * fs), n = x[0].length;
    x.forEach(function (k) {
      for (var i = 0; i < Math.min(inn, n); i++) k[i] *= i / inn;
      for (var j = 0; j < Math.min(ut, n); j++) k[n - 1 - j] *= j / ut;
    });

    // 3. Støy
    var s = stoyfjern(x, fs, v.stoyfjerning);
    if (s) { x = s.kanaler; rapport.stoy = { nivaaDb: s.stoyDb, dempingDb: s.dempingDb }; }

    // 4. Klang
    var k = klangretting(x, fs, v.klangretting, s);
    if (k) { x = k.kanaler; rapport.klang = k.gevinst; }

    // 5. Kompresjon
    var c = komprimer(x, fs, v.jevning);
    if (c) { x = c.kanaler; rapport.kompresjonDb = c.snittDb; }

    // 6. Nivå og topper. Nivået settes først, limiteren tar toppene etterpå,
    // og en siste sjekk av sann topp fanger det som smatt mellom samplingene.
    var lufs = D.lufs(x, fs);
    if (isFinite(lufs)) {
      var g = Math.pow(10, Math.min(30, MAAL_LUFS - lufs) / 20);
      x = x.map(function (kk) { var y = new Float64Array(kk.length); for (var i = 0; i < kk.length; i++) y[i] = kk[i] * g; return y; });
    }
    var b = begrens(x, fs, -1.5);
    x = b.kanaler;
    rapport.limiterDb = b.mestDb;
    var tp = dbAmp(D.sannTopp(x));
    if (tp > -1) {
      var ned = Math.pow(10, (-1 - tp) / 20);
      x.forEach(function (kk) { for (var i = 0; i < kk.length; i++) kk[i] *= ned; });
    }
    var resultat = x.map(function (kk) { return Float32Array.from(kk); });
    rapport.lufsEtter = D.lufs(resultat, fs);
    rapport.varighet = resultat[0].length / fs;
    return { kanaler: resultat, rapport: rapport };
  }

  return { rens: rens, STANDARD: STANDARD, MAAL_LUFS: MAAL_LUFS, finnEnder: finnEnder };
})();
