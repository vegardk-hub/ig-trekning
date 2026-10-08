/*
 * Tidsstrekking — endre tempo uten å endre tonehøyden (WSOLA).
 *
 * Å spille fortere er lett, men da blir alt lysere, som en kassett på feil
 * hastighet. WSOLA klipper i stedet lyden i overlappende biter på 46 ms og
 * legger dem tettere eller glissere. Hver ny bit flyttes noen millisekunder
 * fram eller tilbake til den passer best i svingningene til den forrige —
 * uten den letingen blir hver skjøt et lite hakk, og en tone høres ut som en
 * summende motor.
 *
 * Tonehøyde lages av dette pluss avspillingsfart: strekk med p/t og spill med
 * fart p, så blir tonehøyden p og tempoet t. Verkstedet gjør det, ikke denne
 * fila.
 *
 * Letingen gjøres på en kopi nedsamplet fire ganger og finjusteres i full
 * rate. Ellers tar fire minutter musikk et halvt minutt på en telefon.
 */
'use strict';

var LydStrekk = (function () {

  function mono(kanaler) {
    if (kanaler.length === 1) return kanaler[0];
    var n = kanaler[0].length, m = new Float32Array(n);
    for (var c = 0; c < kanaler.length; c++) {
      var k = kanaler[c];
      for (var i = 0; i < n; i++) m[i] += k[i];
    }
    return m;
  }

  // Grovt lavpass og hver fjerde sampling. Nok til å finne skjøten.
  function nedsampel(x) {
    var n = Math.floor(x.length / 4), y = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var j = i * 4;
      y[i] = (x[j] + x[j + 1] + x[j + 2] + x[j + 3]) * 0.25;
    }
    return y;
  }

  // Beste plassering i [fra, til] for en bit som skal ligne `mal` (lengde L).
  // Normalisert korrelasjon, så letingen ikke bare drar mot de høyeste partiene.
  function finnBeste(x, mal, malStart, L, fra, til, steg) {
    var beste = fra, bestVerdi = -Infinity;
    for (var p = fra; p <= til; p += steg) {
      var kryss = 0, energi = 1e-12;
      for (var i = 0; i < L; i++) {
        var v = x[p + i];
        kryss += v * mal[malStart + i];
        energi += v * v;
      }
      var verdi = kryss / Math.sqrt(energi);
      if (verdi > bestVerdi) { bestVerdi = verdi; beste = p; }
    }
    return beste;
  }

  /*
   * kanaler: [Float32Array], faktor: ny lengde / gammel lengde.
   * Gir nye kanaler med lengde round(n * faktor).
   */
  function strekk(kanaler, fs, faktor) {
    var n = kanaler[0].length;
    if (Math.abs(faktor - 1) < 1e-4) return kanaler.map(function (k) { return Float32Array.from(k); });

    var N = 2 * Math.round(0.023 * fs);          // bitlengde, ~46 ms
    var Hs = N / 2;                              // hopp i utgangen
    var Ha = Hs / faktor;                        // hopp i inngangen
    var tol = Math.round(0.012 * fs);            // hvor langt en bit kan flyttes
    var nUt = Math.round(n * faktor);

    // Polstring, så vinduene aldri går utenfor.
    var pol = N + tol + 8;
    var inn = kanaler.map(function (k) {
      var p = new Float32Array(n + 2 * pol);
      p.set(k, pol);
      return p;
    });
    var m = mono(inn);
    var md = nedsampel(m);

    var vindu = new Float32Array(N);
    for (var i = 0; i < N; i++) vindu[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);

    var ut = kanaler.map(function () { return new Float32Array(nUt + N); });
    var vsum = new Float32Array(nUt + N);

    var forrige = pol;   // startposisjonen til forrige bit i `inn`
    for (var k = 0; k * Hs < nUt; k++) {
      var nominell = pol + Math.round(k * Ha);
      var p = nominell;
      if (k > 0) {
        // Malen er det som *naturlig* ville fulgt etter forrige bit.
        var naturlig = forrige + Hs;
        var fra = Math.max(0, nominell - tol), til = Math.min(m.length - N - 1, nominell + tol);
        var L = Math.floor(Hs / 4);
        var grov = finnBeste(md, md, Math.floor(naturlig / 4), L,
          Math.floor(fra / 4), Math.floor(til / 4), 1) * 4;
        p = finnBeste(m, m, naturlig, Math.min(Hs, 512),
          Math.max(fra, grov - 4), Math.min(til, grov + 4), 1);
      }
      var o = k * Hs;
      for (var c = 0; c < inn.length; c++) {
        var kilde = inn[c], mal = ut[c];
        for (var j = 0; j < N; j++) mal[o + j] += kilde[p + j] * vindu[j];
      }
      for (var q = 0; q < N; q++) vsum[o + q] += vindu[q];
      forrige = p;
    }

    return ut.map(function (u) {
      var r = new Float32Array(nUt);
      for (var i = 0; i < nUt; i++) r[i] = vsum[i] > 1e-3 ? u[i] / vsum[i] : 0;
      return r;
    });
  }

  return { strekk: strekk };
})();
