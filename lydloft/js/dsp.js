/*
 * Signalbehandlingen testbenken står på: FFT, filtre, lydstyrke og WAV.
 *
 * Alt her er rene funksjoner uten nettleser, og det er med vilje — da kan
 * `tester/analyse.js` kjøre hele målekjeden i Node på et sekund, mot signaler
 * der fasiten er kjent. En måling som bare lar seg sjekke med en mikrofon i
 * et rom, lar seg ikke sjekke i det hele tatt.
 *
 * Lydstyrken følger ITU-R BS.1770-4. K-filteret er utledet fra de analoge
 * polene på samme måte som pyloudnorm, ikke hentet fra 48 kHz-tabellen i
 * standarden: Safari på iPhone kan levere 44,1 kHz, og tabellkoeffisientene
 * gir feil kurve på en annen samplingsrate.
 */
'use strict';

var LydDsp = (function () {

  /* ------------------------------------------------------------- FFT */

  function nesteToerpotens(n) {
    var p = 1;
    while (p < n) p *= 2;
    return p;
  }

  // Iterativ radix-2, på stedet. `re` og `im` må ha lengde 2^k.
  function fft(re, im, invers) {
    var n = re.length;
    var i, j, k, t;
    for (i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var vinkel = (invers ? 2 : -2) * Math.PI / len;
      var wr = Math.cos(vinkel), wi = Math.sin(vinkel);
      var halv = len >> 1;
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < halv; k++) {
          var a = i + k, b = a + halv;
          var tr = re[b] * cr - im[b] * ci;
          var ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
          t = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = t;
        }
      }
    }
    if (invers) {
      for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
  }

  // Lineær foldning via FFT. Lengden på svaret er a.length + b.length - 1.
  function fold(a, b) {
    var lengde = a.length + b.length - 1;
    var n = nesteToerpotens(lengde);
    var ar = new Float64Array(n), ai = new Float64Array(n);
    var br = new Float64Array(n), bi = new Float64Array(n);
    ar.set(a); br.set(b);
    fft(ar, ai, false);
    fft(br, bi, false);
    for (var i = 0; i < n; i++) {
      var r = ar[i] * br[i] - ai[i] * bi[i];
      var im = ar[i] * bi[i] + ai[i] * br[i];
      ar[i] = r; ai[i] = im;
    }
    fft(ar, ai, true);
    return ar.subarray(0, lengde);
  }

  /* --------------------------------------------------------- filtre */

  // Biquad etter RBJ-kokeboka. Gir { b: [b0,b1,b2], a: [1,a1,a2] }.
  function biquad(type, fs, f0, q, dbGain) {
    var w0 = 2 * Math.PI * f0 / fs;
    var cos = Math.cos(w0), sin = Math.sin(w0);
    var alpha = sin / (2 * q);
    var A = Math.pow(10, (dbGain || 0) / 40);
    var b0, b1, b2, a0, a1, a2;
    if (type === 'hoypass') {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (type === 'lavpass') {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (type === 'bandpass') {
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (type === 'topp') {
      b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
    } else if (type === 'hoyhylle') {
      var r = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cos + r);
      b1 = -2 * A * ((A - 1) + (A + 1) * cos);
      b2 = A * ((A + 1) + (A - 1) * cos - r);
      a0 = (A + 1) - (A - 1) * cos + r;
      a1 = 2 * ((A - 1) - (A + 1) * cos);
      a2 = (A + 1) - (A - 1) * cos - r;
    } else if (type === 'lavhylle') {
      var s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cos + s);
      b1 = 2 * A * ((A - 1) - (A + 1) * cos);
      b2 = A * ((A + 1) - (A - 1) * cos - s);
      a0 = (A + 1) + (A - 1) * cos + s;
      a1 = -2 * ((A - 1) + (A + 1) * cos);
      a2 = (A + 1) + (A - 1) * cos - s;
    } else {
      throw new Error('ukjent filtertype: ' + type);
    }
    return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] };
  }

  // Kjører et filter over et signal og gir et nytt (Float64Array).
  function filtrer(f, x) {
    var y = new Float64Array(x.length);
    var b0 = f.b[0], b1 = f.b[1], b2 = f.b[2], a1 = f.a[1], a2 = f.a[2];
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      var u = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = u;
      y[i] = u;
    }
    return y;
  }

  /* ------------------------------------------------------ nivå og dB */

  function db(effekt) { return effekt > 0 ? 10 * Math.log10(effekt) : -Infinity; }
  function dbAmp(a) { return a > 0 ? 20 * Math.log10(a) : -Infinity; }

  function rms(x, fra, til) {
    fra = Math.max(0, fra || 0);
    til = Math.min(x.length, til === undefined ? x.length : til);
    if (til <= fra) return 0;
    var s = 0;
    for (var i = fra; i < til; i++) s += x[i] * x[i];
    return Math.sqrt(s / (til - fra));
  }

  // Blander kanalene til én, med snitt — ikke sum, så nivået står i ro.
  function mono(kanaler) {
    if (kanaler.length === 1) return kanaler[0];
    var n = kanaler[0].length;
    var m = new Float32Array(n);
    for (var c = 0; c < kanaler.length; c++) {
      var k = kanaler[c];
      for (var i = 0; i < n; i++) m[i] += k[i];
    }
    for (var j = 0; j < n; j++) m[j] /= kanaler.length;
    return m;
  }

  // Amplitude for én frekvens over et utsnitt (Goertzel med Hann-vindu).
  // Står seg mot støy der en ren RMS ville målt støyen med.
  function tonenivaa(x, fs, f, fra, til) {
    fra = Math.max(0, Math.round(fra));
    til = Math.min(x.length, Math.round(til));
    var n = til - fra;
    if (n < 16) return 0;
    var w = 2 * Math.PI * f / fs;
    var re = 0, im = 0, vsum = 0;
    for (var i = 0; i < n; i++) {
      var v = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
      vsum += v;
      var s = x[fra + i] * v;
      re += s * Math.cos(w * i);
      im -= s * Math.sin(w * i);
    }
    return 2 * Math.sqrt(re * re + im * im) / vsum;
  }

  /* ------------------------------------------------------- lydstyrke */

  // K-filteret i BS.1770: en hylle som etterligner hodet, og et høypass.
  // Konstantene er Brecht De Mans utledning, og de hører til *hans* formel,
  // ikke RBJ-hylla over — med RBJ blir forsterkningen ved 1 kHz 0,44 dB i
  // stedet for 0,69, og hver måling havner et kvart dB for lavt.
  function kFilter(fs) {
    var K = Math.tan(Math.PI * 1681.9744509555319 / fs);
    var Q = 0.7071752369554193;
    var Vh = Math.pow(10, 3.99984385397 / 20);
    var Vb = Math.pow(Vh, 0.4996667741545416);
    var a0 = 1 + K / Q + K * K;
    var hylle = {
      b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0],
      a: [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    };
    var K2 = Math.tan(Math.PI * 38.13547087613982 / fs);
    var Q2 = 0.5003270373253953;
    var a02 = 1 + K2 / Q2 + K2 * K2;
    var hoypass = {
      b: [1, -2, 1],
      a: [1, 2 * (K2 * K2 - 1) / a02, (1 - K2 / Q2 + K2 * K2) / a02]
    };
    return [hylle, hoypass];
  }

  // Integrert lydstyrke i LUFS. Gir -Infinity for stillhet.
  function lufs(kanaler, fs) {
    var blokk = Math.round(0.4 * fs);
    var steg = Math.round(0.1 * fs);
    var n = kanaler[0].length;
    if (n < blokk) return -Infinity;
    var vektet = kanaler.map(function (k) {
      var f = kFilter(fs);
      return filtrer(f[1], filtrer(f[0], k));
    });
    // Kumulative kvadratsummer gjør hver blokk til to oppslag.
    var kum = vektet.map(function (v) {
      var c = new Float64Array(v.length + 1);
      for (var i = 0; i < v.length; i++) c[i + 1] = c[i] + v[i] * v[i];
      return c;
    });
    var z = [];
    for (var start = 0; start + blokk <= n; start += steg) {
      var sum = 0;
      for (var c = 0; c < kum.length; c++) sum += (kum[c][start + blokk] - kum[c][start]) / blokk;
      z.push(sum);
    }
    function lk(v) { return -0.691 + db(v); }
    var over = z.filter(function (v) { return lk(v) > -70; });
    if (!over.length) return -Infinity;
    var snitt = over.reduce(function (a, b) { return a + b; }, 0) / over.length;
    var grense = lk(snitt) - 10;
    var inne = over.filter(function (v) { return lk(v) > grense; });
    if (!inne.length) return -Infinity;
    return lk(inne.reduce(function (a, b) { return a + b; }, 0) / inne.length);
  }

  // Sann topp med firedobbel oversampling. En fil som topper på 0 dBFS i
  // samplene, kan gå over mellom dem — og klippe når den kodes til AAC.
  var TP_FASER = (function () {
    var taps = 12, faser = [];
    for (var p = 0; p < 4; p++) {
      var h = [];
      for (var t = 0; t < taps; t++) {
        var x = (t - taps / 2 + 1) - p / 4;
        var sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        var vindu = 0.5 + 0.5 * Math.cos(Math.PI * x / (taps / 2 + 1));
        h.push(sinc * vindu);
      }
      faser.push(h);
    }
    return faser;
  })();

  function sannTopp(kanaler) {
    var topp = 0;
    for (var c = 0; c < kanaler.length; c++) {
      var x = kanaler[c];
      for (var i = 0; i < x.length; i++) {
        var a = Math.abs(x[i]);
        if (a > topp) topp = a;
      }
      // Bare samplene i nærheten av en høy topp trenger interpolering.
      var terskel = topp * 0.5;
      for (var j = 6; j < x.length - 6; j++) {
        if (Math.abs(x[j]) < terskel && Math.abs(x[j + 1]) < terskel) continue;
        for (var p = 1; p < 4; p++) {
          var h = TP_FASER[p], s = 0;
          for (var t = 0; t < 12; t++) s += h[t] * x[j - 5 + t];
          var v = Math.abs(s);
          if (v > topp) topp = v;
        }
      }
    }
    return topp;
  }

  /* --------------------------------------------------------- spektrum */

  // Langtids gjennomsnittlig effektspektrum (Welch, Hann, 50 % overlapp).
  // Gir effekt per bin, normalisert så en sinus med amplitude A gir A²/2
  // summert over toppen.
  function spektrum(x, fs, nfft) {
    nfft = nfft || 8192;
    var hop = nfft / 2;
    var vindu = new Float64Array(nfft), wsum = 0;
    for (var i = 0; i < nfft; i++) {
      vindu[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / nfft);
      wsum += vindu[i] * vindu[i];
    }
    var effekt = new Float64Array(nfft / 2 + 1);
    var antall = 0;
    var re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (var start = 0; start + nfft <= x.length; start += hop) {
      for (var k = 0; k < nfft; k++) { re[k] = x[start + k] * vindu[k]; im[k] = 0; }
      fft(re, im, false);
      for (var b = 0; b <= nfft / 2; b++) effekt[b] += re[b] * re[b] + im[b] * im[b];
      antall++;
    }
    if (!antall) return null;
    var skala = 2 / (antall * wsum * nfft);
    for (var m = 0; m <= nfft / 2; m++) effekt[m] *= skala;
    return { effekt: effekt, df: fs / nfft, fs: fs };
  }

  // Glatter et spektrum til brøkdels oktav og gir punkter på en logaritmisk
  // akse. `per` er effekt per bin (fra `spektrum`) eller |H|² per bin.
  function glatt(per, df, fra, til, brok, punkter) {
    var ut = { f: [], db: [] };
    var lo = Math.log(fra), hi = Math.log(til);
    var halv = Math.pow(2, 1 / (2 * brok));
    for (var i = 0; i < punkter; i++) {
      var f = Math.exp(lo + (hi - lo) * i / (punkter - 1));
      var a = Math.max(1, Math.floor(f / halv / df));
      var b = Math.min(per.length - 1, Math.ceil(f * halv / df));
      var s = 0, n = 0;
      for (var k = a; k <= b; k++) { s += per[k]; n++; }
      ut.f.push(f);
      ut.db.push(n ? db(s / n) : -Infinity);
    }
    return ut;
  }

  /* ------------------------------------------------------------- WAV */

  // 24 bit heltall: 144 dB dynamikk er mer enn nok, og i motsetning til
  // flyttall spilles det av overalt, også i Filer på iPhone.
  function lagWav(kanaler, fs) {
    var nk = kanaler.length, n = kanaler[0].length;
    var bytes = 3;
    var data = n * nk * bytes;
    var buf = new ArrayBuffer(44 + data);
    var v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + data, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, nk, true); v.setUint32(24, fs, true);
    v.setUint32(28, fs * nk * bytes, true); v.setUint16(32, nk * bytes, true);
    v.setUint16(34, 24, true);
    str(36, 'data'); v.setUint32(40, data, true);
    var o = 44;
    for (var i = 0; i < n; i++) {
      for (var c = 0; c < nk; c++) {
        var s = Math.max(-1, Math.min(1, kanaler[c][i]));
        var heltall = Math.round(s < 0 ? s * 8388608 : s * 8388607);
        v.setUint8(o, heltall & 255);
        v.setUint8(o + 1, (heltall >> 8) & 255);
        v.setUint8(o + 2, (heltall >> 16) & 255);
        o += 3;
      }
    }
    return buf;
  }

  // Leser PCM 16/24/32 og flyttall 32. Gir null for alt annet, så kalleren
  // kan falle tilbake på nettleserens dekoder. Vi leser WAV selv fordi
  // `decodeAudioData` omsampler til lydkontekstens rate, og da ville en fil
  // tatt opp i 44,1 kHz se ut som 48 kHz i målingene.
  function lesWav(buf) {
    var v = new DataView(buf);
    function str(o, n) {
      var s = '';
      for (var i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(o + i));
      return s;
    }
    if (buf.byteLength < 12 || str(0, 4) !== 'RIFF' || str(8, 4) !== 'WAVE') return null;
    var o = 12, fmt = null;
    while (o + 8 <= buf.byteLength) {
      var id = str(o, 4), stor = v.getUint32(o + 4, true);
      if (id === 'fmt ') {
        var format = v.getUint16(o + 8, true);
        if (format === 0xFFFE && stor >= 26) format = v.getUint16(o + 32, true);
        fmt = {
          format: format,
          kanaler: v.getUint16(o + 10, true),
          fs: v.getUint32(o + 12, true),
          bits: v.getUint16(o + 22, true)
        };
      } else if (id === 'data' && fmt) {
        var bpsamp = fmt.bits / 8;
        var lengde = Math.min(stor, buf.byteLength - o - 8);
        var n = Math.floor(lengde / (bpsamp * fmt.kanaler));
        var ut = [];
        for (var c = 0; c < fmt.kanaler; c++) ut.push(new Float32Array(n));
        var p = o + 8;
        for (var i = 0; i < n; i++) {
          for (var k = 0; k < fmt.kanaler; k++) {
            var s;
            if (fmt.format === 3 && fmt.bits === 32) s = v.getFloat32(p, true);
            else if (fmt.format === 1 && fmt.bits === 16) s = v.getInt16(p, true) / 32768;
            else if (fmt.format === 1 && fmt.bits === 24) {
              var h = v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getUint8(p + 2) << 16);
              if (h & 0x800000) h -= 0x1000000;
              s = h / 8388608;
            } else if (fmt.format === 1 && fmt.bits === 32) s = v.getInt32(p, true) / 2147483648;
            else return null;
            ut[k][i] = s;
            p += bpsamp;
          }
        }
        return { kanaler: ut, fs: fmt.fs, bits: fmt.bits, flyttall: fmt.format === 3 };
      }
      o += 8 + stor + (stor & 1);
    }
    return null;
  }

  return {
    nesteToerpotens: nesteToerpotens,
    fft: fft,
    fold: fold,
    biquad: biquad,
    filtrer: filtrer,
    db: db,
    dbAmp: dbAmp,
    rms: rms,
    mono: mono,
    tonenivaa: tonenivaa,
    lufs: lufs,
    sannTopp: sannTopp,
    spektrum: spektrum,
    glatt: glatt,
    lagWav: lagWav,
    lesWav: lesWav
  };
})();
