/*
 * Prøver for rensen av opptak.
 *
 *     node lydloft/tester/rens.js
 *
 * Opptaket her er laget for å ha alt som gjør et ekte telefonopptak dårlig:
 * stillhet og et knappeklikk i hver ende, sus, likespenning, dur fra en vifte,
 * lavt nivå, og toner som spilles sterkt og svakt om hverandre. Hvert trinn må
 * fjerne sitt — og like viktig, det må la musikken være. Støyfjerning som tar
 * tonene med seg, eller et klipp som kutter første tone, er verre enn ingenting.
 */
'use strict';

var fs = require('fs');
var sti = require('path');
function last(navn, globalt, argnavn, args) {
  return new Function(argnavn || '', fs.readFileSync(sti.join(__dirname, '..', 'js', navn + '.js'), 'utf8') + '; return ' + globalt + ';').apply(null, args || []);
}
var LydDsp = last('dsp', 'LydDsp');
var LydRens = last('rens', 'LydRens', 'LydDsp', [LydDsp]);
var D = LydDsp;

var feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }
function tilfeldig(s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

// Toner: [start, lengde, frekvens, nivå]. Annenhver sterk og svak.
var TONER = [[1.2, 0.9, 440, 0.25], [2.4, 0.9, 523, 0.04], [3.6, 0.9, 659, 0.25], [4.8, 0.9, 587, 0.04], [6.0, 0.9, 494, 0.25]];
var MUSIKK_FRA = 1.2, MUSIKK_TIL = 6.9;

function opptak(fs, valg) {
  valg = valg || {};
  var n = Math.round(fs * 8), x = new Float64Array(n), r = tilfeldig(5);
  TONER.forEach(function (t) {
    var a = Math.round(t[0] * fs), m = Math.round(t[1] * fs);
    for (var i = 0; i < m; i++) {
      var tt = i / fs, env = Math.min(1, tt / 0.01) * Math.exp(-tt / 0.6);
      x[a + i] += t[3] * env * (Math.sin(2 * Math.PI * t[2] * tt) + 0.4 * Math.sin(4 * Math.PI * t[2] * tt) + 0.2 * Math.sin(6 * Math.PI * t[2] * tt));
    }
  });
  var stoy = valg.stoy === undefined ? 0.004 : valg.stoy;
  for (var j = 0; j < n; j++) {
    x[j] += stoy * gauss(r);
    if (valg.dur !== false) x[j] += 0.02 * Math.sin(2 * Math.PI * 18 * j / fs) + 0.01;
  }
  if (valg.klikk !== false) {
    [0.08, 7.6].forEach(function (t) {
      var a = Math.round(t * fs);
      for (var i = 0; i < Math.round(0.015 * fs); i++) x[a + i] += 0.5 * Math.exp(-i / (0.002 * fs)) * (r() * 2 - 1);
    });
  }
  return Float32Array.from(x);
}
function rms(x, a, b) { var s = 0; for (var i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); }
function db(v) { return 20 * Math.log10(v + 1e-12); }

bolk('Hele kjeden på et dårlig opptak');
[48000, 44100].forEach(function (fsr) {
  var x = opptak(fsr);
  var t0 = Date.now();
  var r = LydRens.rens([x, Float32Array.from(x)], fsr);
  var ms = Date.now() - t0;
  var y = r.kanaler[0], rap = r.rapport, n = y.length;
  console.log('  ' + fsr + ' Hz: ' + ms + ' ms for 8 s stereo · klippet ' + rap.trimmet.toFixed(2) + ' s · støy ' +
    (rap.stoy ? rap.stoy.nivaaDb.toFixed(1) + ' dBFS, demping ' + rap.stoy.dempingDb.toFixed(1) : '–') +
    ' · kompresjon ' + (rap.kompresjonDb || 0).toFixed(1) + ' dB · ' + rap.lufsFor.toFixed(1) + ' → ' + rap.lufsEtter.toFixed(1) + ' LUFS');

  krev(rap.trimmet > 1.2, 'stillheten og klikkene i endene skal klippes bort (' + fsr + ')', rap.trimmet.toFixed(2));
  krev(rap.trimFra > 0.15 && rap.trimFra < MUSIKK_FRA, 'klippet skal starte etter klikket og før første tone', rap.trimFra.toFixed(3));
  krev(rap.trimFra + n / fsr > MUSIKK_TIL - 0.4, 'siste tone skal være med', (rap.trimFra + n / fsr).toFixed(2));
  // Første tone må være med fra anslaget: nivået like etter skal være høyt.
  var forsteTone = Math.round((MUSIKK_FRA - rap.trimFra) * fsr);
  krev(db(rms(y, forsteTone, forsteTone + Math.round(0.05 * fsr))) > -30, 'anslaget på første tone skal ikke kuttes');
  // Klikket ved 0,08 s er borte: ingenting i starten er høyere enn tonen.
  var start = rms(y, 0, Math.round(0.05 * fsr));
  krev(db(start) < -40, 'ingen knappeklikk i starten', db(start).toFixed(1));

  krev(Math.abs(rap.lufsEtter - LydRens.MAAL_LUFS) < 1, 'nivået skal bli −16 LUFS', rap.lufsEtter.toFixed(2));
  var tp = db(D.sannTopp(r.kanaler));
  krev(tp <= -0.95, 'toppene skal holde seg under −1 dBTP', tp.toFixed(2));
  krev(r.kanaler.every(function (k) { return k.every(isFinite); }), 'ingen ugyldige samplinger');

  // Likespenning og dur på 18 Hz.
  var snitt = 0; for (var i = 0; i < n; i++) snitt += y[i]; snitt /= n;
  krev(Math.abs(snitt) < 1e-3, 'likespenningen skal bort', snitt.toExponential(1));
  var dur = D.tonenivaa(y, fsr, 18, 0, n), tone = D.tonenivaa(y, fsr, 440, forsteTone, forsteTone + Math.round(0.5 * fsr));
  krev(db(dur) - db(tone) < -40, 'duren på 18 Hz skal ligge 40 dB under tonene', (db(dur) - db(tone)).toFixed(1));

  // Støyen i pausen mellom tonene, mot tonene selv, før og etter.
  var pauseFor = [Math.round(2.15 * fsr), Math.round(2.35 * fsr)];
  var xr = Float64Array.from(x);
  var hp = D.biquad('hoypass', fsr, 35, 0.7071); xr = D.filtrer(hp, D.filtrer(hp, xr));
  var snrFor = db(D.tonenivaa(xr, fsr, 440, 1.2 * fsr, 1.7 * fsr)) - db(rms(xr, pauseFor[0], pauseFor[1]));
  var off = Math.round(rap.trimFra * fsr);
  var snrEtter = db(D.tonenivaa(y, fsr, 440, 1.2 * fsr - off, 1.7 * fsr - off)) - db(rms(y, pauseFor[0] - off, pauseFor[1] - off));
  // Hele kjeden løfter også pausene litt — det er det kompresjon gjør — så
  // her kreves bare en netto forbedring. Støyfjerningen alene prøves under.
  krev(snrEtter - snrFor > 3, 'hele kjeden skal gi mindre sus mot tonene enn før', (snrEtter - snrFor).toFixed(1));
  var bareStoy = LydRens.rens([x], fsr, { jevning: 0, klangretting: 0 });
  var z = bareStoy.kanaler[0], offZ = Math.round(bareStoy.rapport.trimFra * fsr);
  var snrStoy = db(D.tonenivaa(z, fsr, 440, 1.2 * fsr - offZ, 1.7 * fsr - offZ)) - db(rms(z, pauseFor[0] - offZ, pauseFor[1] - offZ));
  krev(snrStoy - snrFor > 10, 'støyfjerningen alene skal dempe suset minst 10 dB', (snrStoy - snrFor).toFixed(1));

  // Sterk og svak tone: kompresjonen skal minske forskjellen.
  function toneDb(sig, t, f, forskyv) { return db(D.tonenivaa(sig, fsr, f, (t + 0.05) * fsr - forskyv, (t + 0.5) * fsr - forskyv)); }
  var forFor = toneDb(xr, 1.2, 440, 0) - toneDb(xr, 2.4, 523, 0);
  var forEtter = toneDb(y, 1.2, 440, off) - toneDb(y, 2.4, 523, off);
  krev(forFor - forEtter > 3, 'forskjellen mellom sterk og svak tone skal minke', forFor.toFixed(1) + ' → ' + forEtter.toFixed(1));
  krev(forEtter > 3, 'men ikke forsvinne — dynamikken skal fortsatt høres', forEtter.toFixed(1));
});

bolk('Et rent opptak skal ikke ødelegges');
(function () {
  var fsr = 48000, x = opptak(fsr, { stoy: 0.00002, dur: false, klikk: false });
  var r = LydRens.rens([x], fsr, { jevning: 0, klangretting: 0 });
  var y = r.kanaler[0], off = Math.round(r.rapport.trimFra * fsr);
  // Uten kompresjon og klang skal tonene stå i samme forhold som før.
  function toneDb(sig, t, f, forskyv) { return db(D.tonenivaa(sig, fsr, f, (t + 0.05) * fsr - forskyv, (t + 0.5) * fsr - forskyv)); }
  var for_ = toneDb(x, 1.2, 440, 0) - toneDb(x, 2.4, 523, 0);
  var etter = toneDb(y, 1.2, 440, off) - toneDb(y, 2.4, 523, off);
  krev(Math.abs(for_ - etter) < 1, 'en svak tone skal ikke spises av støyfjerningen', for_.toFixed(1) + ' → ' + etter.toFixed(1));
})();

bolk('Uten pauser');
(function () {
  // Et stykke uten et eneste stille sted: da vet vi ikke hva som er sus.
  var fsr = 48000, n = fsr * 6, x = new Float32Array(n), r = tilfeldig(9);
  for (var i = 0; i < n; i++) x[i] = 0.2 * Math.sin(2 * Math.PI * 330 * i / fsr) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * i / fsr)) + 0.01 * gauss(r);
  var res = LydRens.rens([x], fsr);
  krev(!res.rapport.stoy, 'støyfjerningen skal stå over når det ikke finnes pauser');
  krev(res.rapport.trimmet < 0.1, 'og ingenting skal klippes', res.rapport.trimmet);
})();

bolk('Klangretting');
(function () {
  // Et opptak med bassen kuttet, slik telefonmikrofonen gjør: rettingen skal
  // løfte bassen litt, men aldri mer enn taket på 5 dB.
  var fsr = 48000, n = fsr * 6, x = new Float64Array(n), r = tilfeldig(3);
  for (var i = 0; i < n; i++) x[i] = 0.1 * gauss(r);
  for (var p = 0; p < 2; p++) x = D.filtrer(D.biquad('hoypass', fsr, 300, 0.7071), x);
  // Pauser, så støyen kan måles.
  for (var j = 0; j < n; j++) if ((j / fsr) % 1.5 > 1.2) x[j] *= 0.002;
  var res = LydRens.rens([Float32Array.from(x)], fsr, { jevning: 0 });
  var k = res.rapport.klang;
  krev(k && k[125] > 1, '125 Hz skal løftes når bassen mangler', k && k[125].toFixed(1));
  krev(k && Object.keys(k).every(function (f) { return k[f] <= 5 && k[f] >= -4; }), 'og ingen retting skal gå forbi grensene');
})();

bolk('Fire minutter');
(function () {
  var fsr = 48000, n = fsr * 240, x = new Float32Array(n), r = tilfeldig(11);
  for (var i = 0; i < n; i++) x[i] = (i / fsr) % 2 < 1.5 ? 0.2 * Math.sin(2 * Math.PI * 440 * i / fsr) : 0.002 * gauss(r);
  var t0 = Date.now();
  var res = LydRens.rens([x, x], fsr);
  var ms = Date.now() - t0;
  console.log('  4 min stereo på ' + (ms / 1000).toFixed(1) + ' s');
  krev(ms < 60000, 'fire minutter stereo skal renses på under ett minutt her', ms);
  krev(Math.abs(res.rapport.lufsEtter + 16) < 1, 'og ende på −16 LUFS', res.rapport.lufsEtter.toFixed(2));
})();

console.log('\n' + (gjort - feil) + ' av ' + gjort + ' krav holdt.');
process.exit(feil ? 1 : 0);
