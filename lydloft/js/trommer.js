/*
 * Trommemaskinen — stilene som noe man hører, ikke bare et tall.
 *
 * Å sette tempoet til 100 BPM gjør ikke et stykke om til samba. Det er
 * surdoen på toer'n, tamborimen og risten fra ganzáen som gjør det. Hver stil
 * er derfor et tempo *og* et mønster, og mønsteret spilles under opptaket.
 *
 * Lydene lages her, sampling for sampling — ingen lydfiler å laste ned eller
 * holde i sync med koden, samme valg som fanfarene i Sprellemaskinen. Det
 * lages én takt (fire slag), og den spilles i sløyfe; da koster fire minutter
 * med trommer ikke mer minne enn to sekunder.
 *
 * Mønstrene er 16 sekstendeler per takt. Et siffer er hvor hardt (1–9), en
 * prikk er pause. `sving` forskyver annenhver sekstendel litt bakover, slik
 * hip hop og samba ligger, i stedet for på et stivt rutenett.
 */
'use strict';

var LydTrommer = (function () {

  var STILER = [
    { id: 'ballade', navn: 'Ballade', bpm: 70, sving: 0, spor: {
      kick: '9.......6.......', rim: '........6.......', hihat: '4.3.4.3.4.3.4.3.', shaker: '..3...3...3...3.' } },
    { id: 'reggae', navn: 'Reggae', bpm: 76, sving: 0.12, spor: {
      kick: '........9.......', rim: '........8.......', hihat: '..6...6...6...6.', shaker: '3.3.3.3.3.3.3.3.' } },
    { id: 'hiphop', navn: 'Hip hop', bpm: 90, sving: 0.16, spor: {
      kick: '9......7..9.....', snare: '....9.......9...', hihat: '6.4.6.4.6.4.6.46' } },
    { id: 'samba', navn: 'Samba', bpm: 100, sving: 0.08, spor: {
      surdo: '5...9...5...9...', tamborim: '9.99.9.99.9.9.9.', agogo: '9..6..9...9.6...', shaker: '7347734773477347' } },
    { id: 'rock', navn: 'Rock', bpm: 120, sving: 0, spor: {
      kick: '9.......9.7.....', snare: '....9.......9...', hihat: '7.5.7.5.7.5.7.5.' } },
    { id: 'disco', navn: 'Disco', bpm: 124, sving: 0, spor: {
      kick: '9...9...9...9...', snare: '....8.......8...', aapen: '..7...7...7...7.', hihat: '3.3.3.3.3.3.3.3.' } },
    { id: 'techno', navn: 'Techno', bpm: 130, sving: 0, spor: {
      kick: '9...9...9...9...', klapp: '....8.......8...', aapen: '..6...6...6...6.', ride: '3333333333333333' } },
    { id: 'dnb', navn: 'Drum & bass', bpm: 174, sving: 0, spor: {
      kick: '9.........8.....', snare: '....9.......9...', hihat: '6.5.6.5.6.5.6.5.' } }
  ];

  function seed(s) {
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ----------------------------------------------------------- lydene */

  // Hver lyd er en funksjon av tid (s) som gir en sampling, og en lengde.
  // Støyen er sådd per lyd, så samme slag låter likt hver gang.
  function lag(fs) {
    function stoy(s, hp) {
      var r = seed(s), forrige = 0, y = 0;
      return function () {
        var x = r() * 2 - 1;
        y = hp * (y + x - forrige);
        forrige = x;
        return y;
      };
    }
    return {
      kick: { lengde: 0.4, lag: function () {
        var fase = 0, klikk = stoy(1, 0.5);
        return function (t) {
          var f = 46 + 120 * Math.exp(-t / 0.03);
          fase += 2 * Math.PI * f / fs;
          return Math.sin(fase) * Math.exp(-t / 0.13) + klikk() * 0.4 * Math.exp(-t / 0.002);
        };
      } },
      snare: { lengde: 0.25, lag: function () {
        var s = stoy(2, 0.85);
        return function (t) {
          return 0.45 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.05) + 0.8 * s() * Math.exp(-t / 0.09);
        };
      } },
      rim: { lengde: 0.08, lag: function () {
        return function (t) {
          return (0.6 * Math.sin(2 * Math.PI * 1700 * t) + 0.5 * Math.sin(2 * Math.PI * 520 * t)) * Math.exp(-t / 0.015);
        };
      } },
      klapp: { lengde: 0.3, lag: function () {
        var s = stoy(3, 0.8);
        return function (t) {
          var e = 0;
          [0, 0.011, 0.022].forEach(function (d) { if (t >= d) e = Math.max(e, Math.exp(-(t - d) / 0.006)); });
          if (t > 0.022) e = Math.max(e, 0.55 * Math.exp(-(t - 0.022) / 0.09));
          return s() * e;
        };
      } },
      hihat: { lengde: 0.08, lag: function () {
        var s = stoy(4, 0.97);
        return function (t) { return 0.7 * s() * Math.exp(-t / 0.022); };
      } },
      aapen: { lengde: 0.35, lag: function () {
        var s = stoy(5, 0.97);
        return function (t) { return 0.55 * s() * Math.exp(-t / 0.13); };
      } },
      ride: { lengde: 0.4, lag: function () {
        var s = stoy(6, 0.95);
        return function (t) {
          var metall = Math.sin(2 * Math.PI * 3150 * t) + Math.sin(2 * Math.PI * 4710 * t) + Math.sin(2 * Math.PI * 5830 * t);
          return (0.25 * s() + 0.12 * metall) * Math.exp(-t / 0.18);
        };
      } },
      shaker: { lengde: 0.09, lag: function () {
        var s = stoy(7, 0.96);
        return function (t) { return 0.5 * s() * Math.min(1, t / 0.012) * Math.exp(-t / 0.03); };
      } },
      surdo: { lengde: 0.6, lag: function () {
        var fase = 0;
        return function (t) {
          fase += 2 * Math.PI * (58 + 14 * Math.exp(-t / 0.05)) / fs;
          return Math.sin(fase) * Math.exp(-t / 0.28);
        };
      } },
      tamborim: { lengde: 0.08, lag: function () {
        var s = stoy(8, 0.7);
        return function (t) { return (0.6 * Math.sin(2 * Math.PI * 610 * t) + 0.35 * s()) * Math.exp(-t / 0.018); };
      } },
      agogo: { lengde: 0.35, lag: function () {
        return function (t, v) {
          // To bjeller: den lyse på de sterke slagene, den dype på de svake.
          var f = v >= 8 ? 880 : 640;
          return 0.4 * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * t)) * Math.exp(-t / 0.12);
        };
      } }
    };
  }

  // Nivå per instrument, så kicken bærer og risten ligger under.
  var NIVAA = { kick: 1, snare: 0.75, rim: 0.5, klapp: 0.7, hihat: 0.35, aapen: 0.35, ride: 0.3,
                shaker: 0.3, surdo: 1, tamborim: 0.45, agogo: 0.45 };

  function finnStil(id) {
    for (var i = 0; i < STILER.length; i++) if (STILER[i].id === id) return STILER[i];
    return null;
  }

  /*
   * Én takt (fire slag) i sløyfe-form: haler som går over taktstreken,
   * legges inn igjen i starten, så sløyfen ikke klikker i skjøten.
   */
  function lagTakt(stilId, bpm, fs) {
    var stil = finnStil(stilId);
    if (!stil) return null;
    var slag = 60 / bpm, takt = 4 * slag;
    var n = Math.round(takt * fs);
    var ut = new Float32Array(n);
    var lyder = lag(fs);
    Object.keys(stil.spor).forEach(function (instr) {
      var monster = stil.spor[instr], lyd = lyder[instr];
      for (var steg = 0; steg < 16; steg++) {
        var tegn = monster[steg];
        if (tegn === '.' || tegn === undefined) continue;
        var v = parseInt(tegn, 10);
        var tid = steg * slag / 4 + (steg % 2 ? stil.sving * slag / 4 : 0);
        var start = Math.round(tid * fs), lengde = Math.round(lyd.lengde * fs);
        var kilde = lyd.lag(), styrke = NIVAA[instr] * v / 9;
        for (var i = 0; i < lengde; i++) {
          ut[(start + i) % n] += styrke * kilde(i / fs, v);
        }
      }
    });
    var topp = 0;
    for (var j = 0; j < n; j++) topp = Math.max(topp, Math.abs(ut[j]));
    if (topp > 0) for (var k = 0; k < n; k++) ut[k] *= 0.8 / topp;
    return ut;
  }

  return { STILER: STILER, finnStil: finnStil, lagTakt: lagTakt };
})();
