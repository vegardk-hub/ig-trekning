/*
 * Prøver for tidsstrekkingen.
 *
 *     node lydloft/tester/strekk.js
 *
 * Fire ting må holde, og de ryker hver for seg:
 *
 * - **Lengden** blir det den skal. Ellers sklir tempoet fra det glidebryteren sier.
 * - **Tonehøyden** står stille. Det er hele poenget; uten letingen etter beste
 *   skjøt holder frekvensen, men lyden sprekker.
 * - **Ingen hakk.** En ren tone skal ikke få sprang større enn den har selv.
 * - **Slagene blir ikke borte eller doble.** Et klikk hvert halve sekund,
 *   strukket til dobbel lengde, skal gi like mange klikk, ett per sekund.
 */
'use strict';

var fs = require('fs');
var sti = require('path');

var kode = fs.readFileSync(sti.join(__dirname, '..', 'js', 'strekk.js'), 'utf8');
var LydStrekk = new Function(kode + '; return LydStrekk;')();

var feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }

function sinus(f, fs, sek, a) {
  var x = new Float32Array(Math.round(fs * sek));
  for (var i = 0; i < x.length; i++) x[i] = (a || 0.5) * Math.sin(2 * Math.PI * f * i / fs);
  return x;
}
// Frekvens fra nullgjennomganger i midten av signalet.
function frekvens(x, fs) {
  var a = Math.floor(x.length * 0.2), b = Math.floor(x.length * 0.8), forste = -1, siste = -1, antall = 0;
  for (var i = a; i < b; i++) {
    if (x[i - 1] < 0 && x[i] >= 0) {
      var t = i - 1 + (-x[i - 1]) / (x[i] - x[i - 1]);
      if (forste < 0) forste = t;
      siste = t; antall++;
    }
  }
  return (antall - 1) * fs / (siste - forste);
}
function rms(x, a, b) {
  var s = 0;
  for (var i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / (b - a));
}
function maksSprang(x, a, b) {
  var m = 0;
  for (var i = a + 1; i < b; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
  return m;
}

bolk('Lengde og tonehøyde');
[44100, 48000].forEach(function (rate) {
  [0.5, 0.8, 1.25, 2].forEach(function (faktor) {
    var x = sinus(440, rate, 3);
    var t0 = Date.now();
    var y = LydStrekk.strekk([x], rate, faktor)[0];
    var ms = Date.now() - t0;
    krev(y.length === Math.round(x.length * faktor), 'lengden skal bli ' + faktor + ' ganger (' + rate + ')', y.length);
    var f = frekvens(y, rate);
    krev(Math.abs(f - 440) < 1.5, '440 Hz skal forbli 440 Hz ved faktor ' + faktor, f.toFixed(2));
    var r = rms(y, Math.floor(y.length * 0.2), Math.floor(y.length * 0.8));
    krev(Math.abs(20 * Math.log10(r / (0.5 / Math.SQRT2))) < 0.5, 'nivået skal stå (faktor ' + faktor + ')', r.toFixed(4));
    var sprang = maksSprang(y, Math.floor(y.length * 0.1), Math.floor(y.length * 0.9));
    var egen = 0.5 * 2 * Math.PI * 440 / rate;
    krev(sprang < egen * 1.3, 'ingen hakk i skjøtene (faktor ' + faktor + ')', (sprang / egen).toFixed(2));
    if (rate === 48000 && faktor === 2) console.log('  3 s til 6 s på ' + ms + ' ms');
  });
});

bolk('Akkord');
(function () {
  var rate = 48000, a = sinus(220, rate, 3, 0.3), b = sinus(277.18, rate, 3, 0.3), c = sinus(329.63, rate, 3, 0.3);
  var x = new Float32Array(a.length);
  for (var i = 0; i < x.length; i++) x[i] = a[i] + b[i] + c[i];
  var y = LydStrekk.strekk([x, Float32Array.from(x)], rate, 1.5);
  krev(y.length === 2 && y[0].length === Math.round(x.length * 1.5), 'to kanaler inn gir to kanaler ut');
  var ulike = 0;
  for (var j = 0; j < y[0].length; j++) if (y[0][j] !== y[1][j]) ulike++;
  krev(ulike === 0, 'like kanaler skal forbli like – skjøtene er felles', ulike);
  krev(Math.abs(20 * Math.log10(rms(y[0], 30000, 180000) / rms(x, 30000, 120000))) < 1, 'en akkord skal holde nivået');
})();

bolk('Slag');
(function () {
  var rate = 48000, x = new Float32Array(rate * 4);
  for (var s = 0; s < 8; s++) {
    var p = Math.round((0.25 + s * 0.5) * rate);
    for (var i = 0; i < 400; i++) x[p + i] = 0.8 * Math.exp(-i / 60) * Math.sin(i * 0.9);
  }
  var y = LydStrekk.strekk([x], rate, 2)[0];
  // Finn slagene som topper over halv styrke, minst 0,3 s fra hverandre.
  var slag = [];
  for (var j = 0; j < y.length; j++) {
    if (Math.abs(y[j]) > 0.3 && (!slag.length || j - slag[slag.length - 1] > 0.3 * rate)) slag.push(j);
  }
  krev(slag.length === 8, 'åtte slag inn skal gi åtte slag ut', slag.length);
  var avstand = slag.slice(1).map(function (v, k) { return (v - slag[k]) / rate; });
  krev(avstand.every(function (d) { return Math.abs(d - 1) < 0.03; }), 'og ett sekund mellom dem', avstand.map(function (d) { return d.toFixed(3); }).join(' '));
})();

bolk('Uendret');
(function () {
  var x = sinus(1000, 48000, 1);
  var y = LydStrekk.strekk([x], 48000, 1)[0];
  krev(y !== x && y.length === x.length && y[1234] === x[1234], 'faktor 1 gir en kopi, ikke den samme tabellen');
})();

console.log('\n' + (gjort - feil) + ' av ' + gjort + ' krav holdt.');
process.exit(feil ? 1 : 0);
