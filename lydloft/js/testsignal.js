/*
 * Testsignalet — en fast sekvens som gjør at et opptak kan måles mot en fasit.
 *
 * Et opptak av musikk forteller ikke hva mikrofonen gjorde med lyden, for vi
 * vet ikke hva som kom inn. Spiller vi derimot et kjent signal, er alt som
 * avviker kjeden sin skyld: høyttaleren, rommet, mikrofonen og nettleseren.
 * Og bytter vi bare ett ledd mellom to opptak — samme høyttaler, nettleser mot
 * Taleopptak — står forskjellen igjen alene.
 *
 * Sekvensen er definert i sekunder og hertz, ikke i samplinger. Det er det som
 * lar PC-en spille den på 44,1 kHz mens iPhonen tar opp på 48 kHz: begge regner
 * ut det samme kontinuerlige signalet på sin egen rate.
 *
 *   0,0 –  2,0  stillhet          støygulvet, og brum fra strømnettet
 *   2,0 – 12,0  logaritmisk sveip  frekvensrespons, romklang, forvrengning
 *  12,0 – 15,0  stillhet          etterklangen får dø ut
 *  15,0 – 22,0  1 kHz i sju trinn  er nivået lineært, eller trykker noe til?
 *  22,5 – 28,5  rosa støy         spiser støydempingen vedvarende lyd?
 *
 * Sveipet er ankeret. Det finnes igjen i opptaket med foldning (Farina), og
 * resten av bitene ligger på faste avstander fra det. Ingen klokke må stemme.
 */
'use strict';

var LydTestsignal = (function () {

  var SVEIP = { start: 2.0, varighet: 10.0, f1: 20, f2: 20000, nivaa: 0.5 };
  var TRINN = { start: 15.0, varighet: 0.8, mellom: 0.2, frekvens: 1000,
                dbfs: [-42, -36, -30, -24, -18, -12, -6] };
  var ROSA = { start: 22.5, varighet: 6.0, dbfs: -18 };
  var LENGDE = 29.5;
  var STILLE = { fra: 0.2, til: 1.8 };   // relativt til sekvensens start

  var R = Math.log(SVEIP.f2 / SVEIP.f1);

  // Sveipets verdi ved tid t (sekunder fra sveipets start).
  function sveipVerdi(t) {
    var T = SVEIP.varighet;
    return Math.sin(2 * Math.PI * SVEIP.f1 * T / R * (Math.exp(t * R / T) - 1));
  }

  // Myk inn- og utgang, så sveipet ikke starter med et klikk. Inngangen
  // er lengre fordi den bare koster de laveste hertzene, der telefoner
  // uansett ikke hører noe.
  function sveipKant(t) {
    var inn = 0.03, ut = 0.006, T = SVEIP.varighet;
    if (t < inn) return 0.5 - 0.5 * Math.cos(Math.PI * t / inn);
    if (t > T - ut) return 0.5 - 0.5 * Math.cos(Math.PI * (T - t) / ut);
    return 1;
  }

  function lagSveip(fs) {
    var n = Math.round(SVEIP.varighet * fs);
    var x = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var t = i / fs;
      x[i] = sveipVerdi(t) * sveipKant(t);
    }
    return x;
  }

  // Det inverse filteret: sveipet baklengs, med amplitude som stiger 6 dB per
  // oktav. Et logaritmisk sveip bruker like lang tid per oktav og har derfor
  // mest energi per hertz i bassen; vektingen med f jevner det ut. Foldet med
  // sveipet gir det en puls, så foldet med et opptak gir det impulsresponsen
  // til hele kjeden. Normalisert så en kjede uten tap gir 1 ved 1 kHz.
  var inversLager = {};
  function invers(fs) {
    if (inversLager[fs]) return inversLager[fs];
    var x = lagSveip(fs);
    var n = x.length, T = SVEIP.varighet;
    var inv = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var tOrig = (n - 1 - i) / fs;
      inv[i] = x[n - 1 - i] * Math.exp((tOrig - T) * R / T);   // f / f2
    }
    // Normalisering: mål forsterkningen ved 1 kHz etter foldning med seg selv.
    var p = LydDsp.fold(x, inv);
    var nfft = LydDsp.nesteToerpotens(p.length);
    var re = new Float64Array(nfft), im = new Float64Array(nfft);
    re.set(p);
    LydDsp.fft(re, im, false);
    var bin = Math.round(1000 * nfft / fs);
    var g = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
    for (var j = 0; j < n; j++) inv[j] /= g;
    inversLager[fs] = inv;
    return inv;
  }

  // Seedet tilfeldighet, så den rosa støyen er lik hver gang.
  function seed(s) {
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Rosa støy med Paul Kellets filter. Ikke presis under 20 Hz, men det
  // trengs ikke: støyen brukes til å se om noe demper den over tid.
  function lagRosa(fs, n) {
    var tilf = seed(1770);
    var y = new Float64Array(n);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (var i = 0; i < n; i++) {
      var w = tilf() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      y[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
    var maal = Math.pow(10, ROSA.dbfs / 20);
    var r = LydDsp.rms(y);
    for (var j = 0; j < n; j++) y[j] *= maal / r;
    return y;
  }

  // Hele sekvensen som én kanal, klar til å spilles.
  function lagSekvens(fs) {
    var n = Math.round(LENGDE * fs);
    var x = new Float32Array(n);
    var s = lagSveip(fs), s0 = Math.round(SVEIP.start * fs);
    for (var i = 0; i < s.length; i++) x[s0 + i] = s[i] * SVEIP.nivaa;

    var rampe = Math.round(0.01 * fs);
    TRINN.dbfs.forEach(function (dbfs, k) {
      var a = Math.pow(10, dbfs / 20);
      var start = Math.round((TRINN.start + k * (TRINN.varighet + TRINN.mellom)) * fs);
      var m = Math.round(TRINN.varighet * fs);
      for (var j = 0; j < m; j++) {
        var kant = Math.min(1, j / rampe, (m - 1 - j) / rampe);
        x[start + j] = a * kant * Math.sin(2 * Math.PI * TRINN.frekvens * j / fs);
      }
    });

    var rStart = Math.round(ROSA.start * fs), rN = Math.round(ROSA.varighet * fs);
    var rosa = lagRosa(fs, rN);
    for (var r = 0; r < rN; r++) {
      var k2 = Math.min(1, r / rampe, (rN - 1 - r) / rampe);
      x[rStart + r] = rosa[r] * k2;
    }
    return x;
  }

  return {
    SVEIP: SVEIP,
    TRINN: TRINN,
    ROSA: ROSA,
    STILLE: STILLE,
    LENGDE: LENGDE,
    R: R,
    lagSveip: lagSveip,
    lagRosa: lagRosa,
    invers: invers,
    lagSekvens: lagSekvens
  };
})();
