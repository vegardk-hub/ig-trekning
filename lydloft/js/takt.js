/*
 * Takten — hvor fort et opptak går (BPM), og hvor slagene ligger.
 *
 * Stilene i verkstedet setter et *mål* for tempoet: samba er 100 slag i
 * minuttet, rock 120. For å komme dit må vi vite hvor opptaket står, og for å
 * legge trommer oppå må vi vite hvor slagene faller, ellers slår trommene
 * mellom tonene barnet spiller.
 *
 * Metoden er den vanlige: finn hvor det skjer noe nytt i lyden (spektral
 * fluks — økningen i energi fra én bit til den neste, bånd for bånd), og se
 * hvilken avstand mellom slag som går igjen (autokorrelasjon). En svak
 * forkjærlighet for 110 BPM avgjør når flere avstander passer like godt.
 *
 * Svaret kan være dobbelt eller halvt av det et menneske ville sagt — det
 * er like sant, bare talt i åttendedeler eller halvnoter. Verkstedet velger
 * selv den oktaven som ligger nærmest stilen, så det gjør ikke noe.
 *
 * `sikkerhet` sier hvor tydelig takten er. En sunget tone eller et barn som
 * prater har ingen, og da skal trommene få stå på egne bein i stedet for å
 * jage en takt som ikke finnes.
 */
'use strict';

var LydTakt = (function () {

  var MIN_BPM = 50, MAKS_BPM = 240, MIDT_BPM = 110;
  var TERSKEL = 0.12;

  function fft(re, im) {
    var n = re.length, i, j, k, t;
    for (i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var v = -2 * Math.PI / len, wr = Math.cos(v), wi = Math.sin(v), h = len >> 1;
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < h; k++) {
          var a = i + k, b = a + h;
          var tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  // Hvor mye nytt som skjer i hver bit på ~12 ms.
  function anslag(kanaler, fs) {
    var n = kanaler[0].length;
    var hopp = Math.round(fs * 0.0116);
    var N = 1;
    while (N < 2 * hopp) N *= 2;
    var vindu = new Float64Array(N);
    for (var i = 0; i < N; i++) vindu[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    var rammer = Math.max(0, Math.floor((n - N) / hopp) + 1);
    var env = new Float64Array(rammer);
    var re = new Float64Array(N), im = new Float64Array(N);
    // 24 bånd fra 60 Hz til 11 kHz, jevnt fordelt i oktaver. Energien i et
    // bånd står stille for en jevn tone; enkeltbinnene gjør det ikke, de
    // vugger med fasen tonen har i vinduet, og den vuggingen er periodisk —
    // en jevn akkord så ut som en tydelig takt.
    var BAND = 24, df = fs / N, grenser = [];
    for (var g = 0; g <= BAND; g++) grenser.push(Math.max(1, Math.round(60 * Math.pow(11000 / 60, g / BAND) / df)));
    var forrige = new Float64Array(BAND).fill(-100), gulv = 1e-9 * N;
    for (var r = 0; r < rammer; r++) {
      var o = r * hopp;
      for (var k = 0; k < N; k++) {
        var s = 0;
        for (var c = 0; c < kanaler.length; c++) s += kanaler[c][o + k];
        re[k] = s * vindu[k]; im[k] = 0;
      }
      fft(re, im);
      var fluks = 0;
      for (var bnd = 0; bnd < BAND; bnd++) {
        var p = 0;
        for (var b = grenser[bnd]; b < Math.max(grenser[bnd] + 1, grenser[bnd + 1]); b++) p += re[b] * re[b] + im[b] * im[b];
        var l = 10 * Math.log10(p + gulv);
        // Under 1 dB er ikke et anslag, bare uro.
        var d = l - forrige[bnd] - 1;
        if (d > 0) fluks += d;
        forrige[bnd] = l;
      }
      env[r] = fluks;
    }
    // Trekk fra et glidende snitt på et halvt sekund, så bare toppene står
    // igjen — ellers korrelerer et høyt parti med seg selv på alle avstander.
    var bredde = Math.max(1, Math.round(0.25 * fs / hopp));
    var ut = new Float64Array(rammer), sum = 0, fra = 0;
    var kum = new Float64Array(rammer + 1);
    for (var q = 0; q < rammer; q++) kum[q + 1] = kum[q] + env[q];
    for (var p = 0; p < rammer; p++) {
      var a0 = Math.max(0, p - bredde), a1 = Math.min(rammer, p + bredde + 1);
      var snitt = (kum[a1] - kum[a0]) / (a1 - a0);
      ut[p] = Math.max(0, env[p] - snitt);
    }
    return { env: ut, fe: fs / hopp, hopp: hopp };
  }

  function finnTempo(kanaler, fs) {
    var a = anslag(kanaler, fs);
    var env = a.env, fe = a.fe, n = env.length;
    var tomt = { bpm: null, sikkerhet: 0, forsteSlag: 0 };
    if (n < fe * 3) return tomt;

    var snitt = 0;
    for (var i = 0; i < n; i++) snitt += env[i];
    snitt /= n;
    var x = new Float64Array(n), e0 = 0;
    for (var j = 0; j < n; j++) { x[j] = env[j] - snitt; e0 += x[j] * x[j]; }
    if (e0 <= 0) return tomt;

    var minLag = Math.floor(60 * fe / MAKS_BPM), maksLag = Math.min(n - 1, Math.ceil(60 * fe / MIN_BPM));
    var acf = new Float64Array(maksLag + 2);
    for (var L = minLag - 1; L <= maksLag + 1; L++) {
      var s = 0;
      for (var k = 0; k + L < n; k++) s += x[k] * x[k + L];
      acf[L] = s / e0 * n / (n - L);   // rett opp for kortere overlapp
    }
    var beste = -1, bestVerdi = -Infinity;
    for (var M = minLag; M <= maksLag; M++) {
      var bpm = 60 * fe / M;
      var prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / MIDT_BPM) / 0.9, 2));
      // Et ekte slag kommer igjen på dobbel avstand også; et tilfeldig
      // sammentreff gjør ikke det.
      var dobbel = 2 * M <= maksLag + 1 ? acf[2 * M] : 0;
      var v = (acf[M] + 0.5 * Math.max(0, dobbel)) * prior;
      if (v > bestVerdi && acf[M] >= acf[M - 1] && acf[M] >= acf[M + 1]) { bestVerdi = v; beste = M; }
    }
    if (beste < 0) return tomt;
    var y0 = acf[beste - 1], y1 = acf[beste], y2 = acf[beste + 1];
    var dl = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
    if (!isFinite(dl) || Math.abs(dl) > 1) dl = 0;
    var grovLag = beste + dl;

    // Fasen og den fine avstanden sammen: hvilken kam treffer flest anslag?
    // Fasen alene på en litt feil avstand driver utover i et langt opptak, og
    // første slag havner mellom to ekte slag.
    var bestFase = 0, bestTreff = -Infinity, lag = grovLag;
    for (var kandidat = grovLag * 0.99; kandidat <= grovLag * 1.01; kandidat += grovLag * 0.001) {
      for (var f = 0; f < kandidat; f += 0.5) {
        var treff = 0;
        for (var t = f; t < n; t += kandidat) treff += env[Math.round(t)] || 0;
        if (treff > bestTreff) { bestTreff = treff; bestFase = f; lag = kandidat; }
      }
    }
    var bpmUt = 60 * fe / lag;
    // Vinduet sentrerer på rammen; anslaget ligger i starten av den.
    var N = 1;
    while (N < 2 * a.hopp) N *= 2;
    var forsteSlag = (bestFase * a.hopp + N / 2) / fs;
    forsteSlag = forsteSlag % (60 / bpmUt);

    return { bpm: bpmUt, sikkerhet: Math.max(0, acf[beste]), forsteSlag: forsteSlag, tydelig: acf[beste] >= TERSKEL };
  }

  // Den av bpm/2, bpm og 2·bpm som ligger nærmest målet — så rock på et
  // stykke målt til 62 BPM blir 124 → 120, ikke en dobling av farten.
  function naermesteOktav(bpm, maal) {
    var beste = bpm, avstand = Infinity;
    [0.5, 1, 2].forEach(function (f) {
      var d = Math.abs(Math.log(maal / (bpm * f)));
      if (d < avstand) { avstand = d; beste = bpm * f; }
    });
    return beste;
  }

  return { finnTempo: finnTempo, naermesteOktav: naermesteOktav, TERSKEL: TERSKEL };
})();
