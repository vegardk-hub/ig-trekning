/*
 * Prøver for målekjeden — at analysen finner det vi vet er der.
 *
 *     node lydloft/tester/analyse.js
 *
 * Testbenken er bare verdt noe hvis tallene den viser er sanne. Det lar seg
 * ikke sjekke med en mikrofon, for der vet ingen fasiten. Her lager vi derfor
 * «telefonen» selv: testsignalet sendes gjennom en kjede med kjent lavkutt,
 * kjent diskantkutt, kjent romklang og kjent støy, og analysen må finne igjen
 * hvert av dem. Så skrus én ting på om gangen — en kompressor, en støydemper,
 * en feil samplingsrate — og analysen må si fra om akkurat den.
 *
 * Kravene har slingringsmonn der fysikken har det. En -10 dB-grense på en
 * kaskade av to andreordens filtre ligger ikke på knekkfrekvensen, og det skal
 * prøven ikke late som.
 */
'use strict';

var fs = require('fs');
var sti = require('path');

var HER = sti.join(__dirname, '..', 'js');
function les(navn) { return fs.readFileSync(sti.join(HER, navn + '.js'), 'utf8'); }
function last(navn, globalt, argnavn, argverdier) {
  return new Function(argnavn || '', les(navn) + '; return ' + globalt + ';')
    .apply(null, argverdier || []);
}

var LydDsp = last('dsp', 'LydDsp');
var LydTestsignal = last('testsignal', 'LydTestsignal', 'LydDsp', [LydDsp]);
var LydAnalyse = last('analyse', 'LydAnalyse', 'LydDsp,LydTestsignal', [LydDsp, LydTestsignal]);
var D = LydDsp;

var feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }
function naer(a, b, tol) { return a !== null && a !== undefined && Math.abs(a - b) <= tol; }

// Seedet støy, så prøven gir samme svar hver gang.
function tilfeldig(s) {
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    var t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

/*
 * Telefonen: forsinkelse, høypass, lavpass, rom, nivå og støy.
 * `valg` skrur av og på enkeltledd.
 */
function telefon(fs, valg) {
  valg = valg || {};
  var x = Float64Array.from(LydTestsignal.lagSekvens(fs));
  var hp = valg.hp === undefined ? 200 : valg.hp;
  var lp = valg.lp === undefined ? 12000 : valg.lp;
  if (hp) for (var s = 0; s < 2; s++) x = D.filtrer(D.biquad('hoypass', fs, hp, 0.7071), x);
  if (lp) for (var t = 0; t < 2; t++) x = D.filtrer(D.biquad('lavpass', fs, lp, 0.7071), x);

  if (valg.rt60) {
    // Eksponentielt døende støy som romrespons, med direktelyden først.
    var r = tilfeldig(7), n = Math.round(valg.rt60 * 1.2 * fs);
    var h = new Float64Array(n);
    h[0] = 1;
    var forfall = 6.9078 / (valg.rt60 * fs);
    for (var i = 1; i < n; i++) h[i] = 0.08 * gauss(r) * Math.exp(-forfall * i);
    x = D.fold(x, h).slice(0, x.length);
  }

  if (valg.kompressor) x = kompressor(x, fs, -30, 4);
  if (valg.stoydemper) x = stoydemper(x, fs);

  var forsink = Math.round((valg.forsinkelse === undefined ? 0.7 : valg.forsinkelse) * fs);
  var ut = new Float32Array(x.length + forsink + Math.round(0.5 * fs));
  var nivaa = valg.nivaa || 0.5;
  for (var j = 0; j < x.length; j++) ut[j + forsink] = x[j] * nivaa;

  var stoy = Math.pow(10, (valg.stoyDb === undefined ? -70 : valg.stoyDb) / 20);
  var rs = tilfeldig(11);
  for (var k = 0; k < ut.length; k++) ut[k] += stoy * gauss(rs);
  if (valg.brum) {
    for (var b = 0; b < ut.length; b++) {
      var tt = b / fs;
      ut[b] += valg.brum * (Math.sin(2 * Math.PI * 50 * tt) + 0.5 * Math.sin(2 * Math.PI * 100 * tt));
    }
  }
  if (valg.klipp) for (var c = 0; c < ut.length; c++) ut[c] = Math.max(-valg.klipp, Math.min(valg.klipp, ut[c]));
  return ut;
}

// Enkel kompressor med følger: det AGC-en i en telefonsamtale gjør.
function kompressor(x, fs, terskelDb, ratio) {
  var y = new Float64Array(x.length);
  var inn = Math.exp(-1 / (0.005 * fs)), ut = Math.exp(-1 / (0.1 * fs));
  var env = 0;
  for (var i = 0; i < x.length; i++) {
    var a = Math.abs(x[i]);
    env = a > env ? inn * env + (1 - inn) * a : ut * env + (1 - ut) * a;
    var lvl = D.dbAmp(env + 1e-12);
    var over = Math.max(0, lvl - terskelDb);
    y[i] = x[i] * Math.pow(10, -over * (1 - 1 / ratio) / 20);
  }
  return y;
}

// Støydemperen kjenner igjen vedvarende bredbåndslyd og trekker den ned
// i løpet av et halvt sekund. Den rører ikke tonene.
function stoydemper(x, fs) {
  var TS = LydTestsignal;
  var a = Math.round(TS.ROSA.start * fs), n = Math.round(TS.ROSA.varighet * fs);
  var y = Float64Array.from(x);
  for (var i = 0; i < n; i++) {
    var g = Math.max(0.25, 1 - 0.75 * (i / (0.6 * fs)));
    y[a + i] *= g;
  }
  return y;
}

/* ------------------------------------------------------------------ */

bolk('Lydstyrke og topp');
(function () {
  [48000, 44100].forEach(function (rate) {
    var n = rate * 10, x = new Float32Array(n);
    for (var i = 0; i < n; i++) x[i] = 0.1 * Math.sin(2 * Math.PI * 1000 * i / rate);
    var l = D.lufs([x], rate);
    krev(naer(l, -23.01, 0.15), '1 kHz på 0,1 i én kanal skal gi -23,0 LUFS ved ' + rate, l.toFixed(2));
  });
  var r = tilfeldig(3), st = new Float32Array(48000 * 5);
  for (var s = 0; s < st.length; s++) st[s] = 0.00001 * gauss(r);
  krev(D.lufs([st], 48000) === -Infinity, 'nesten stillhet skal portes bort');

  // En sinus på fs/4 med 45 graders fase treffer aldri toppen i samplene.
  var y = new Float32Array(4800);
  for (var j = 0; j < y.length; j++) y[j] = Math.sin(Math.PI / 2 * j + Math.PI / 4);
  var tp = D.dbAmp(D.sannTopp([y]));
  krev(tp > -0.6, 'sann topp skal finne toppen mellom samplingene', tp.toFixed(2));
  krev(D.dbAmp(0.7072) < -2.9, 'og samplingstoppen ligger 3 dB under');
})();

bolk('WAV');
(function () {
  var a = new Float32Array(1000), b = new Float32Array(1000);
  for (var i = 0; i < 1000; i++) { a[i] = Math.sin(i / 7) * 0.9; b[i] = -a[i] * 0.5; }
  var buf = D.lagWav([a, b], 44100);
  var tilbake = D.lesWav(buf);
  krev(tilbake && tilbake.fs === 44100 && tilbake.kanaler.length === 2, 'WAV skal leses tilbake med rate og kanaler');
  var maks = 0;
  for (var j = 0; j < 1000; j++) maks = Math.max(maks, Math.abs(tilbake.kanaler[0][j] - a[j]), Math.abs(tilbake.kanaler[1][j] - b[j]));
  krev(maks < 2e-7, '24 bit skal gi feil under 2e-7', maks);
  krev(D.lesWav(new ArrayBuffer(20)) === null, 'en fil som ikke er WAV gir null');
})();

bolk('Grunnanalyse');
(function () {
  var rate = 48000, n = rate * 3;
  var x = new Float32Array(n);
  for (var i = 0; i < n; i++) x[i] = 1.4 * Math.sin(2 * Math.PI * 220 * i / rate);
  var klippet = Float32Array.from(x, function (v) { return Math.max(-1, Math.min(1, v)); });
  var g = LydAnalyse.grunn([klippet], rate);
  krev(g.klipping.hendelser > 100, 'klippet sinus skal gi mange klipp', g.klipping.hendelser);
  var ren = Float32Array.from(x, function (v) { return v * 0.6; });
  krev(LydAnalyse.grunn([ren], rate).klipping.hendelser === 0, 'ren sinus skal ikke gi klipp');
  var g2 = LydAnalyse.grunn([ren, Float32Array.from(ren)], rate);
  krev(g2.kanalforhold && g2.kanalforhold.identiske, 'to like kanaler skal kalles mono');
  krev(LydAnalyse.funn({ grunn: g2, test: null }).some(function (f) { return /mono/.test(f.tekst); }),
       'og det skal stå i funnene');

  // Bredbåndsstøy kuttet bratt ved 16 kHz, slik AAC gjør.
  var r = tilfeldig(5), st = new Float64Array(rate * 4);
  for (var s = 0; s < st.length; s++) st[s] = 0.1 * gauss(r);
  for (var k = 0; k < 6; k++) st = D.filtrer(D.biquad('lavpass', rate, 16000, 0.7071), st);
  var g3 = LydAnalyse.grunn([Float32Array.from(st)], rate);
  krev(g3.kodekkant && g3.kodekkant > 14000 && g3.kodekkant < 19000, 'bratt kant ved 16 kHz skal finnes', g3.kodekkant);
  krev(LydAnalyse.test([Float32Array.from(st)], rate) === null, 'støy er ikke et testsignal');
})();

bolk('Testsignalet gjennom en kjent telefon');
var normal;
(function () {
  [48000, 44100].forEach(function (rate) {
    var t0 = Date.now();
    var a = LydAnalyse.analyser([telefon(rate, { rt60: 0.4 })], rate);
    var t = a.test;
    krev(t, 'testsignalet skal finnes ved ' + rate);
    if (!t) return;
    if (rate === 48000) normal = a;
    console.log('  ' + rate + ' Hz: nedre ' + Math.round(t.nedreGrense) + ' Hz, øvre ' + Math.round(t.ovreGrense) +
                ' Hz, RT60 ' + (t.etterklang && t.etterklang.rt60.toFixed(2)) + ' s, støy ' + t.stoygulvDb.toFixed(1) +
                ' dBFS, 1 kHz = ' + t.frekvens1k.toFixed(2) + ' Hz, rosa avvik ' + t.rosa.avvikDb.toFixed(1) +
                ' dB  (' + (Date.now() - t0) + ' ms)');
    // Filtrene forsinker pulsen et par millisekunder; mer enn fem er en feil.
    krev(naer(t.sveipStart, 0.7 + 2.0, 0.005), 'sveipet skal stå 2,7 s inn', t.sveipStart);
    // Rommet her er svært klangfullt (etterklangen 9 dB over direktelyden),
    // og det farger kurva tilfeldig med et par dB. Den stramme prøven av
    // grensene står i neste bolk, uten rom.
    krev(t.nedreGrense > 120 && t.nedreGrense < 220, 'lavkutt på 200 Hz i rom skal gi grense 120–220 Hz', t.nedreGrense);
    krev(t.ovreGrense > 11000 && t.ovreGrense < 16000, 'diskantkutt på 12 kHz i rom skal gi grense 11–16 kHz', t.ovreGrense);
    krev(t.etterklang && t.etterklang.rt60 > 0.28 && t.etterklang.rt60 < 0.55, 'RT60 0,4 s skal måles innenfor 0,28–0,55', t.etterklang && t.etterklang.rt60);
    krev(naer(t.stoygulvDb, -70, 1.5), 'støygulvet er -70 dBFS', t.stoygulvDb);
    krev(naer(t.frekvens1k, 1000, 0.3), '1 kHz skal måles som 1 kHz', t.frekvens1k);
    krev(t.kompresjon && !t.kompresjon.finnes, 'ingen kompresjon i en lineær kjede', t.kompresjon && t.kompresjon.snittOvreDb);
    krev(t.rosa && !t.rosa.dempes, 'ingen støydemping i en lineær kjede', t.rosa && t.rosa.avvikDb);
    krev(t.rosa && Math.abs(t.rosa.avvikDb) < 2.5, 'rosa støy skal ligge nær det responsen spår', t.rosa && t.rosa.avvikDb);
    krev(!t.forvrengning || t.forvrengning.prosent < 1, 'en lineær kjede har ingen forvrengning', t.forvrengning && t.forvrengning.prosent);
    krev(t.trinn.filter(function (x) { return x.gyldig; }).length === 7, 'alle sju trinnene skal stå over støyen');
  });
})();

bolk('Kjeder med feil i');
(function () {
  var rate = 48000;

  // To andreordens Butterworth på 200 Hz gir -10 dB ved 165 Hz. Lavpasset
  // på 12 kHz gir teoretisk 14,6 kHz, men bilineærtransformen gjør det
  // brattere nær Nyquist, så det digitale filteret når -10 dB tidligere.
  var tort = LydAnalyse.analyser([telefon(rate, {})], rate).test;
  krev(tort && tort.nedreGrense > 150 && tort.nedreGrense < 175, 'uten rom skal lavkuttet måles til 150–175 Hz', tort && tort.nedreGrense);
  krev(tort && tort.ovreGrense > 13000 && tort.ovreGrense < 15000, 'og diskantkuttet til 13–15 kHz', tort && tort.ovreGrense);

  var flat = LydAnalyse.analyser([telefon(rate, { hp: 0, lp: 0 })], rate).test;
  krev(flat && flat.nedreGrense === null || (flat && flat.nedreGrense < 30), 'en flat kjede skal holde helt ned', flat && flat.nedreGrense);
  krev(flat && (flat.ovreGrense === null || flat.ovreGrense > 18000), 'og helt opp', flat && flat.ovreGrense);

  var k = LydAnalyse.analyser([telefon(rate, { kompressor: true })], rate);
  krev(k.test && k.test.kompresjon.finnes, 'kompressoren skal avsløres', k.test && k.test.kompresjon.snittOvreDb);
  krev(k.funn.some(function (f) { return f.niva === 'feil' && /trykkes sammen/.test(f.tekst); }), 'og stå som feil i funnene');

  var s = LydAnalyse.analyser([telefon(rate, { stoydemper: true })], rate);
  krev(s.test && s.test.rosa.dempes, 'støydemperen skal avsløres', s.test && s.test.rosa.avvikDb);
  krev(s.test && !s.test.kompresjon.finnes, 'uten å skylde på nivåtrappen');

  var b = LydAnalyse.analyser([telefon(rate, { brum: 0.003 })], rate).test;
  krev(b && b.brum && b.brum.finnes, 'brum på 50 Hz skal finnes', b && b.brum && b.brum.overDb);
  krev(normal && normal.test.brum && !normal.test.brum.finnes, 'og ikke der det ikke er brum');

  var sen = LydAnalyse.analyser([telefon(rate, { forsinkelse: -1 })], rate);
  // Negativ forsinkelse betyr at opptaket startet etter sekvensen.
  krev(sen.test && sen.test.stoygulvDb === null, 'et sent startet opptak har ikke noe støygulv å måle');

  var hoy = LydAnalyse.analyser([telefon(rate, { nivaa: 2.2, klipp: 1 })], rate);
  krev(hoy.grunn.klipping.hendelser > 0, 'klipping skal finnes i et overstyrt opptak');
  krev(hoy.test && hoy.test.forvrengning && hoy.test.forvrengning.prosent > 1, 'og gi forvrengning', hoy.test && hoy.test.forvrengning);

  // Fila sier 48 kHz, men lyden er tatt opp i 44,1. Sveipet passer ikke i
  // tid, så analysen må prøve andre rater og si hvilken som er den ekte.
  var lest = LydAnalyse.analyser([telefon(44100, {})], 48000);
  krev(lest.test && lest.test.ekteRate === 44100, 'feil samplingsrate skal avsløres og den ekte finnes', lest.test && lest.test.ekteRate);
  krev(lest.test && lest.test.nedreGrense > 150 && lest.test.nedreGrense < 175, 'og grensene regnes på den ekte raten', lest.test && lest.test.nedreGrense);
  krev(lest.funn.some(function (f) { return f.niva === 'feil' && /44100 Hz/.test(f.tekst); }), 'og det står som feil i funnene');

  // WebKit-feilen: mikrofonen leverer 16 kHz og kaller det 48.
  var ios = LydAnalyse.analyser([telefon(16000, { lp: 0 })], 48000);
  krev(ios.test && ios.test.ekteRate === 16000, '16 kHz kalt 48 kHz skal avsløres', ios.test && ios.test.ekteRate);
  krev(normal && !normal.test.ekteRate, 'og en riktig rate skal ikke flagges');

  // Stoppet før den rosa støyen — slik opptaket fra Safari i første runde.
  var hel = telefon(rate, {});
  var kort = LydAnalyse.analyser([hel.subarray(0, Math.round(26.8 * rate))], rate);
  krev(kort.test && kort.test.rosa === null, 'et avkortet opptak har ingen rosa støy');
  krev(kort.funn.some(function (f) { return /stoppet .* før testsignalet/.test(f.tekst); }), 'og det skal si fra om at det stoppet for tidlig');
  krev(!normal.funn.some(function (f) { return /stoppet .* før/.test(f.tekst); }), 'men ikke når hele signalet er med');

  // En støyport gir digital stillhet mellom lydene.
  var port = LydAnalyse.analyser([telefon(rate, { stoyDb: -130 })], rate);
  krev(port.funn.some(function (f) { return /digitalt null/.test(f.tekst); }), 'digital stillhet skal kalles en støyport', port.grunn.stoygulvDb);
  krev(!normal.funn.some(function (f) { return /digitalt null/.test(f.tekst); }), 'men ikke vanlig romstøy');

  // En støydemper som spiser vedvarende toner.
  var utenToner = telefon(rate, {});
  var t0 = Math.round((0.7 + LydTestsignal.TRINN.start) * rate), t1 = Math.round((0.7 + LydTestsignal.ROSA.start - 0.4) * rate);
  for (var q = t0; q < t1; q++) utenToner[q] = (q % 7 - 3) * 1e-4;   // bare romstøy igjen
  var borte = LydAnalyse.analyser([utenToner], rate);
  krev(borte.test && borte.test.tonerBorte, 'toner som forsvinner skal oppdages');
  krev(borte.funn.some(function (f) { return /tonene i nivåtrappen/.test(f.tekst); }), 'og stå i funnene');
})();

bolk('Stereoopptak');
(function () {
  var rate = 48000;
  var v = telefon(rate, {}), h = Float32Array.from(v, function (x) { return x * 0.8; });
  var a = LydAnalyse.analyser([v, h], rate);
  krev(a.test, 'testsignalet skal finnes i et stereoopptak');
  krev(a.grunn.kanalforhold && naer(a.grunn.kanalforhold.ubalanseDb, 1.94, 0.1), 'ubalansen mellom kanalene skal måles', a.grunn.kanalforhold && a.grunn.kanalforhold.ubalanseDb);
})();

console.log('\n' + (gjort - feil) + ' av ' + gjort + ' krav holdt.');
process.exit(feil ? 1 : 0);
