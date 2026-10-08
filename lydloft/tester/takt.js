/*
 * Prøver for takt-finneren og trommemaskinen.
 *
 *     node lydloft/tester/takt.js
 *
 * Takt-finneren må gjøre tre ting riktig, og de ryker hver for seg:
 *
 * - **Tempoet**, eller det doble eller halve. Alle tre er sanne svar; verkstedet
 *   velger selv oktaven nærmest stilen. Noe annet — 2/3 eller 4/3 — er feil.
 * - **Fasen.** Trommer i riktig tempo, men en halv takt forskjøvet, er verre enn
 *   ingen trommer. Første slag må treffes på en sekstendedel nær.
 * - **Å si fra når det ikke finnes en takt.** En jevn tone har ingen, og da
 *   skal ikke trommene jage en.
 *
 * Trommemaskinen prøves ved å la takt-finneren lytte på den: rocken på 120
 * må finnes igjen som 120 (eller 60/240). Da vet vi at begge gjør jobben.
 */
'use strict';

var fs = require('fs');
var sti = require('path');
function last(navn, globalt) {
  return new Function(fs.readFileSync(sti.join(__dirname, '..', 'js', navn + '.js'), 'utf8') + '; return ' + globalt + ';')();
}
var LydTakt = last('takt', 'LydTakt');
var LydTrommer = last('trommer', 'LydTrommer');
var LydStrekk = last('strekk', 'LydStrekk');

var feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }

// Riktig, eller riktig i en annen oktav.
function oktavlik(malt, sann, tol) {
  return [0.5, 1, 2].some(function (f) { return Math.abs(malt / (sann * f) - 1) < tol; });
}
function faseAvvik(malt, sann, periode) {
  var d = ((malt - sann) % periode + periode) % periode;
  return Math.min(d, periode - d);
}

function klikkspor(bpm, fs, sek, start, valg) {
  valg = valg || {};
  var x = new Float32Array(Math.round(fs * sek)), periode = 60 / bpm;
  var r = 7;
  for (var t = start, k = 0; t < sek - 0.1; t += periode, k++) {
    var p = Math.round(t * fs), a = k % 4 === 0 ? 0.9 : 0.6;
    for (var i = 0; i < Math.round(0.05 * fs) && p + i < x.length; i++) {
      x[p + i] += a * Math.exp(-i / (0.008 * fs)) * Math.sin(2 * Math.PI * 900 * i / fs);
    }
  }
  if (valg.stoy) for (var j = 0; j < x.length; j++) { r = (r * 16807) % 2147483647; x[j] += (r / 2147483647 - 0.5) * valg.stoy; }
  return x;
}

bolk('Klikkspor');
[[80, 0.37], [100, 0.12], [120, 0.5], [140, 0.05], [174, 0.2]].forEach(function (par) {
  [44100, 48000].forEach(function (fs) {
    var bpm = par[0], start = par[1];
    var t0 = Date.now();
    var svar = LydTakt.finnTempo([klikkspor(bpm, fs, 12, start, { stoy: 0.05 })], fs);
    var ms = Date.now() - t0;
    krev(svar.tydelig, bpm + ' BPM skal være en tydelig takt (' + fs + ')', svar.sikkerhet.toFixed(2));
    krev(oktavlik(svar.bpm, bpm, 0.015), bpm + ' BPM skal måles som ' + bpm + ' (eller oktav) ved ' + fs, svar.bpm && svar.bpm.toFixed(2));
    // Fasen sjekkes mot perioden som ble funnet: et slag hver 120. er også et slag hver 60.
    var periode = 60 / svar.bpm;
    var avvik = faseAvvik(svar.forsteSlag, start, Math.min(periode, 60 / bpm));
    krev(avvik < 0.03, 'første slag skal treffes (' + bpm + ' BPM, start ' + start + ' s)', (avvik * 1000).toFixed(0) + ' ms');
    if (bpm === 120 && fs === 48000) console.log('  12 s analysert på ' + ms + ' ms');
  });
});

bolk('Uten takt');
(function () {
  var fs = 48000, n = fs * 8, x = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var t = i / fs;
    x[i] = 0.2 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.2 * t) + Math.sin(2 * Math.PI * 329.6 * t));
  }
  var svar = LydTakt.finnTempo([x], fs);
  krev(!svar.tydelig, 'en jevn akkord har ingen tydelig takt', svar.sikkerhet.toFixed(3));
  var stille = LydTakt.finnTempo([new Float32Array(fs * 6)], fs);
  krev(!stille.tydelig && stille.bpm === null, 'stillhet har ingen takt');
  var kort = LydTakt.finnTempo([klikkspor(120, fs, 1.5, 0.1)], fs);
  krev(!kort.tydelig, 'halvannet sekund er for kort til å si noe');
})();

bolk('Trommemaskinen');
LydTrommer.STILER.forEach(function (stil) {
  var fs = 48000;
  var takt = LydTrommer.lagTakt(stil.id, stil.bpm, fs);
  krev(takt.length === Math.round(4 * 60 / stil.bpm * fs), stil.navn + ': én takt er fire slag lang', takt.length);
  var topp = 0, nan = false;
  for (var i = 0; i < takt.length; i++) { topp = Math.max(topp, Math.abs(takt[i])); if (!isFinite(takt[i])) nan = true; }
  krev(!nan && Math.abs(topp - 0.8) < 1e-6, stil.navn + ': gyldig lyd, toppen på 0,8', topp);
  // Seks takter i sløyfe skal høres som stilens tempo.
  var lang = new Float32Array(takt.length * 6);
  for (var k = 0; k < 6; k++) lang.set(takt, k * takt.length);
  var svar = LydTakt.finnTempo([lang], fs);
  krev(svar.tydelig && oktavlik(svar.bpm, stil.bpm, 0.02), stil.navn + ' skal høres som ' + stil.bpm + ' BPM', svar.bpm && svar.bpm.toFixed(1));
});

bolk('Sløyfeskjøten');
(function () {
  // En hale som går over taktstreken, legges inn igjen i starten. Da skal
  // overgangen fra slutt til start ikke ha et sprang større enn inni takten.
  var takt = LydTrommer.lagTakt('samba', 100, 48000);
  var inni = 0;
  for (var i = 1; i < takt.length; i++) inni = Math.max(inni, Math.abs(takt[i] - takt[i - 1]));
  var skjot = Math.abs(takt[0] - takt[takt.length - 1]);
  krev(skjot <= inni, 'skjøten i sløyfa skal ikke klikke', skjot.toFixed(3) + ' mot ' + inni.toFixed(3));
})();

bolk('Etter tidsstrekking');
(function () {
  // Verkstedet strekker lyden og regner om trommetempoet med samme faktor.
  // Det holder bare hvis det strukne sporet faktisk går i det nye tempoet.
  var fs = 48000, x = klikkspor(100, fs, 10, 0.3);
  var y = LydStrekk.strekk([x], fs, 100 / 120)[0];
  var svar = LydTakt.finnTempo([y], fs);
  krev(oktavlik(svar.bpm, 120, 0.02), '100 BPM strukket til 120 skal måles som 120', svar.bpm && svar.bpm.toFixed(1));
  krev(faseAvvik(svar.forsteSlag, 0.3 * 100 / 120, 0.5) < 0.04, 'og første slag flytter seg med', svar.forsteSlag.toFixed(3));
})();

bolk('Nærmeste oktav');
krev(LydTakt.naermesteOktav(62, 120) === 124, '62 BPM mot rock (120) skal tolkes som 124');
krev(LydTakt.naermesteOktav(200, 90) === 100, '200 BPM mot hip hop (90) skal tolkes som 100');
krev(LydTakt.naermesteOktav(110, 100) === 110, '110 mot samba (100) står');

console.log('\n' + (gjort - feil) + ' av ' + gjort + ' krav holdt.');
process.exit(feil ? 1 : 0);
