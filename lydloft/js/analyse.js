/*
 * Analysen — hva et opptak er, og hva kjeden gjorde med det.
 *
 * To lag:
 *
 * - `grunn` gjelder ethvert opptak, også musikk: lydstyrke, topp, klipping,
 *   støygulv, spektrum og om «stereo» egentlig er mono. Det er tallene nivå 1
 *   skal styres etter senere.
 * - `test` finnes bare når opptaket inneholder testsignalet. Da kan kjeden
 *   måles mot fasit: frekvensrespons, grenser, romklang, forvrengning, og om
 *   nettleseren trykker sammen nivået eller demper vedvarende lyd.
 *
 * Sveipet letes først fram på en nedsamplet kopi. En foldning av et helt
 * opptak i full rate trenger hundrevis av megabyte på en iPhone; den grove
 * letingen gjør det samme med en åttendedel, og den fine foldningen tas bare
 * over vinduet rundt sveipet.
 */
'use strict';

var LydAnalyse = (function () {

  var D = LydDsp, TS = LydTestsignal;
  var MAKS_TESTLENGDE = 75;   // sekunder; lengre opptak letes ikke gjennom

  /* ------------------------------------------------------------- grunn */

  function klipping(kanaler) {
    var maks = 0;
    kanaler.forEach(function (k) {
      for (var i = 0; i < k.length; i++) { var a = Math.abs(k[i]); if (a > maks) maks = a; }
    });
    if (maks < 0.98) return { hendelser: 0, andel: 0 };
    // En klipp er minst tre samplinger på rad helt oppe ved taket.
    var tak = maks - 1e-4, hendelser = 0, berort = 0, total = 0;
    kanaler.forEach(function (k) {
      var lop = 0;
      total += k.length;
      for (var i = 0; i <= k.length; i++) {
        if (i < k.length && Math.abs(k[i]) >= tak) { lop++; continue; }
        if (lop >= 3) { hendelser++; berort += lop; }
        lop = 0;
      }
    });
    return { hendelser: hendelser, andel: berort / total };
  }

  function rammenivaaer(m, fs) {
    var r = Math.round(0.05 * fs), ut = [];
    for (var i = 0; i + r <= m.length; i += r) ut.push(D.dbAmp(D.rms(m, i, i + r)));
    return ut.filter(function (v) { return isFinite(v); }).sort(function (a, b) { return a - b; });
  }

  function persentil(sortert, p) {
    if (!sortert.length) return null;
    return sortert[Math.min(sortert.length - 1, Math.floor(p * sortert.length))];
  }

  function kanalforhold(kanaler) {
    if (kanaler.length < 2) return null;
    var a = kanaler[0], b = kanaler[1];
    var sab = 0, saa = 0, sbb = 0, maksDiff = 0;
    for (var i = 0; i < a.length; i++) {
      sab += a[i] * b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i];
      var d = Math.abs(a[i] - b[i]);
      if (d > maksDiff) maksDiff = d;
    }
    var kor = saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
    return { korrelasjon: kor, identiske: maksDiff < 1e-6, ubalanseDb: D.db(saa / (sbb || 1e-30)) };
  }

  function grunn(kanaler, fs) {
    var m = D.mono(kanaler);
    var topp = 0, sum = 0;
    for (var i = 0; i < m.length; i++) sum += m[i];
    kanaler.forEach(function (k) {
      for (var j = 0; j < k.length; j++) { var a = Math.abs(k[j]); if (a > topp) topp = a; }
    });
    var nivaaer = rammenivaaer(m, fs);
    var spek = D.spektrum(m, fs, 8192);
    var ltas = null, ovre = null, kant = null;
    if (spek) {
      ltas = D.glatt(spek.effekt, spek.df, 20, Math.min(20000, fs * 0.49), 6, 160);
      var ref = -Infinity;
      ltas.f.forEach(function (f, k) {
        if (f >= 200 && f <= 5000 && ltas.db[k] > ref) ref = ltas.db[k];
      });
      for (var k = ltas.f.length - 1; k >= 0; k--) {
        if (ltas.db[k] > ref - 50) { ovre = ltas.f[k]; break; }
      }
      // En bratt kant over 4 kHz er signaturen til en kodek som har kuttet
      // toppen: AAC og MP3 setter et lavpass, mikrofoner ruller av mykt.
      var storst = 0;
      for (var q = 0; q + 8 < ltas.f.length; q++) {
        if (ltas.f[q] < 4000) continue;
        var fall = ltas.db[q] - ltas.db[q + 8];
        if (fall > storst) { storst = fall; kant = ltas.f[q + 4]; }
      }
      if (storst < 25) kant = null;
    }
    return {
      varighet: m.length / fs,
      fs: fs,
      kanaler: kanaler.length,
      toppDb: D.dbAmp(topp),
      sannToppDb: D.dbAmp(D.sannTopp(kanaler)),
      lufs: D.lufs(kanaler, fs),
      dc: sum / (m.length || 1),
      klipping: klipping(kanaler),
      stoygulvDb: persentil(nivaaer, 0.1),
      toppnivaaDb: persentil(nivaaer, 0.95),
      ltas: ltas,
      ovreInnhold: ovre,
      kodekkant: kant,
      kanalforhold: kanalforhold(kanaler)
    };
  }

  /* -------------------------------------------------- finn testsignalet */

  function nedsampel(x, fs, faktor) {
    var y = Float64Array.from(x);
    var grense = 0.4 * fs / faktor;
    for (var s = 0; s < 4; s++) y = D.filtrer(D.biquad('lavpass', fs, grense, 0.7071), y);
    var n = Math.floor(y.length / faktor);
    var ut = new Float64Array(n);
    for (var i = 0; i < n; i++) ut[i] = y[i * faktor];
    return ut;
  }

  // Grov leting: gir samplingen der sveipet starter, eller null.
  function finnSveip(m, fs) {
    var faktor = fs >= 32000 ? 8 : 4;
    var fsd = fs / faktor;
    var md = nedsampel(m, fs, faktor);
    var sd = nedsampel(TS.lagSveip(fs), fs, faktor);
    var n = sd.length, T = TS.SVEIP.varighet;
    if (md.length < n) return null;
    var inv = new Float64Array(n);
    for (var i = 0; i < n; i++) inv[i] = sd[n - 1 - i] * Math.exp(((n - 1 - i) / fsd - T) * TS.R / T);
    var ir = D.fold(md, inv);
    var topp = 0, pos = 0, s2 = 0;
    for (var j = 0; j < ir.length; j++) {
      var a = Math.abs(ir[j]);
      s2 += ir[j] * ir[j];
      if (a > topp) { topp = a; pos = j; }
    }
    var forhold = topp / Math.sqrt(s2 / ir.length);
    if (forhold < 20) return null;
    return (pos - (n - 1)) * faktor;
  }

  /* ------------------------------------------------------ målingene */

  function frekvensrespons(ir, p, fs) {
    var for_ = Math.round(0.002 * fs), lengde = Math.round(0.35 * fs);
    var nfft = D.nesteToerpotens(Math.max(32768, for_ + lengde));
    var re = new Float64Array(nfft), im = new Float64Array(nfft);
    var avtrapp = Math.round(lengde * 0.3);
    for (var i = 0; i < for_ + lengde; i++) {
      var k = p - for_ + i;
      if (k < 0 || k >= ir.length) continue;
      var w = 1;
      if (i < for_) w = 0.5 - 0.5 * Math.cos(Math.PI * i / for_);
      else if (i > for_ + lengde - avtrapp) w = 0.5 + 0.5 * Math.cos(Math.PI * (i - (for_ + lengde - avtrapp)) / avtrapp);
      re[i] = ir[k] * w;
    }
    D.fft(re, im, false);
    var per = new Float64Array(nfft / 2 + 1);
    for (var b = 0; b <= nfft / 2; b++) per[b] = re[b] * re[b] + im[b] * im[b];
    var topp = Math.min(TS.SVEIP.f2, fs * 0.49);
    var kurve = D.glatt(per, fs / nfft, TS.SVEIP.f1, topp, 6, 200);
    // Normaliser til snittet mellom 500 og 2000 Hz.
    var s = 0, n = 0;
    kurve.f.forEach(function (f, k) {
      if (f >= 500 && f <= 2000) { s += Math.pow(10, kurve.db[k] / 10); n++; }
    });
    var ref = D.db(s / n);
    kurve.db = kurve.db.map(function (v) { return v - ref; });
    return { kurve: kurve, per: per, df: fs / nfft, refDb: ref };
  }

  // Går ut fra 1 kHz og stopper der kurva har ligget under -10 dB i tre
  // punkter på rad — én dupp fra rommet skal ikke telle som en grense.
  function grense(kurve, retning) {
    var start = 0;
    while (start < kurve.f.length - 1 && kurve.f[start] < 1000) start++;
    var under = 0;
    for (var k = start; k >= 0 && k < kurve.f.length; k += retning) {
      if (kurve.db[k] < -10) {
        under++;
        if (under === 3) return kurve.f[k - 2 * retning];
      } else under = 0;
    }
    return null;
  }

  function etterklang(ir, p, fs, stoyMs) {
    var blokk = Math.round(0.01 * fs);
    var maks = Math.min(ir.length, p + Math.round(1.5 * fs));
    var slutt = maks;
    for (var b = p + 5 * blokk; b + blokk <= maks; b += blokk) {
      var e = 0;
      for (var i = b; i < b + blokk; i++) e += ir[i] * ir[i];
      if (e / blokk < stoyMs * 2) { slutt = b; break; }
    }
    var n = slutt - p;
    if (n < 10 * blokk) return null;
    var edc = new Float64Array(n), sum = 0;
    for (var j = n - 1; j >= 0; j--) {
      sum += ir[p + j] * ir[p + j] - stoyMs;
      edc[j] = Math.max(sum, 1e-30);
    }
    function tidVed(dbNiva) {
      for (var k = 0; k < n; k++) if (D.db(edc[k] / edc[0]) <= dbNiva) return k / fs;
      return null;
    }
    var t5 = tidVed(-5), t25 = tidVed(-25), t15 = tidVed(-15);
    if (t5 !== null && t25 !== null) return { rt60: 3 * (t25 - t5), metode: 'T20' };
    if (t5 !== null && t15 !== null) return { rt60: 6 * (t15 - t5), metode: 'T10' };
    return null;
  }

  function energi(ir, fra, til) {
    var e = 0;
    for (var i = Math.max(0, fra); i < Math.min(ir.length, til); i++) e += ir[i] * ir[i];
    return e;
  }

  function topptone(x, fs, fra, til, f0) {
    var n = til - fra;
    var nfft = D.nesteToerpotens(n * 8);
    var re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (var i = 0; i < n; i++) re[i] = x[fra + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
    D.fft(re, im, false);
    var df = fs / nfft, beste = 0, bin = 0;
    for (var b = Math.floor(f0 * 0.9 / df); b < Math.ceil(f0 * 1.1 / df); b++) {
      var v = re[b] * re[b] + im[b] * im[b];
      if (v > beste) { beste = v; bin = b; }
    }
    function lm(b) { return Math.log(re[b] * re[b] + im[b] * im[b] + 1e-30); }
    var a = lm(bin - 1), c = lm(bin), d = lm(bin + 1);
    var forskyv = 0.5 * (a - d) / (a - 2 * c + d);
    return (bin + forskyv) * df;
  }

  function brum(m, fs, fra, til) {
    if (til - fra < fs * 0.5) return null;
    var stykke = m.subarray(fra, til);
    var spek = D.spektrum(stykke, fs, D.nesteToerpotens(Math.round(fs / 3)));
    if (!spek) return null;
    function niva(f) {
      var b = Math.round(f / spek.df), v = 0;
      for (var k = b - 1; k <= b + 1; k++) v = Math.max(v, spek.effekt[k]);
      return v;
    }
    var bakgrunn = [];
    for (var b = Math.round(30 / spek.df); b < Math.round(200 / spek.df); b++) bakgrunn.push(spek.effekt[b]);
    bakgrunn.sort(function (x, y) { return x - y; });
    var median = bakgrunn[Math.floor(bakgrunn.length / 2)] || 1e-30;
    var over = Math.max(D.db(niva(50) / median), D.db(niva(100) / median), D.db(niva(150) / median));
    return { overDb: over, finnes: over > 12 };
  }

  // Ratene vi prøver når sveipet ikke passer på den oppgitte. Safari på iOS
  // har en kjent feil der mikrofonen leverer lavere rate enn den sier; da
  // går sveipet for fort eller sakte i tid og finnes aldri. Passer det på en
  // annen rate, vet vi både *at* det er feil og *hva* den egentlige raten er.
  var ANDRE_RATER = [44100, 48000, 24000, 16000, 8000];

  function test(kanaler, fs) {
    var m = D.mono(kanaler);
    var r = testVed(m, fs);
    if (r) return r;
    for (var i = 0; i < ANDRE_RATER.length; i++) {
      if (ANDRE_RATER[i] === fs) continue;
      r = testVed(m, ANDRE_RATER[i]);
      if (r) { r.ekteRate = ANDRE_RATER[i]; r.oppgittRate = fs; return r; }
    }
    return null;
  }

  function testVed(m, fs) {
    if (m.length / fs > MAKS_TESTLENGDE || m.length / fs < TS.SVEIP.varighet) return null;
    var grov = finnSveip(m, fs);
    if (grov === null) return null;

    // Fin foldning i full rate, bare rundt sveipet.
    var inv = TS.invers(fs), N = inv.length;
    var vStart = Math.max(0, grov - Math.round(2.5 * fs));
    var vSlutt = Math.min(m.length, grov + Math.round((TS.SVEIP.varighet + 1.6) * fs));
    var ir = D.fold(m.subarray(vStart, vSlutt), inv);
    var p = 0, topp = 0;
    for (var i = 0; i < ir.length; i++) { var a = Math.abs(ir[i]); if (a > topp) { topp = a; p = i; } }
    var s0 = vStart + p - (N - 1);
    var sekStart = s0 - Math.round(TS.SVEIP.start * fs);

    // Støy i den foldede responsen, mellom pulsen og andreharmoniske.
    var stoyFra = p - Math.round(0.35 * fs), stoyTil = p - Math.round(0.1 * fs);
    var stoyMs = energi(ir, stoyFra, stoyTil) / Math.max(1, stoyTil - stoyFra);

    var fr = frekvensrespons(ir, p, fs);
    var rt = etterklang(ir, p, fs, stoyMs);

    // Harmoniske ligger *før* pulsen, på kjente avstander.
    var lengdeH = Math.round(0.1 * fs), forH = Math.round(0.002 * fs);
    var e1 = energi(ir, p - forH, p + lengdeH);
    var eh = 0;
    [2, 3].forEach(function (k) {
      var d = Math.round(TS.SVEIP.varighet * Math.log(k) / TS.R * fs);
      eh += energi(ir, p - d - forH, p - d + lengdeH) - stoyMs * (lengdeH + forH);
    });
    var forvrengning = eh > stoyMs * (lengdeH + forH) ?
      { prosent: 100 * Math.sqrt(eh / e1), db: D.db(eh / e1) } : null;

    // Støygulv og brum fra stillheten før sveipet.
    var stilleFra = sekStart + Math.round(TS.STILLE.fra * fs);
    var stilleTil = sekStart + Math.round(TS.STILLE.til * fs);
    var harStille = stilleFra >= 0;
    var stoygulv = harStille ? D.dbAmp(D.rms(m, stilleFra, stilleTil)) : null;
    var stoy1k = harStille ? D.dbAmp(D.tonenivaa(m, fs, 1000, stilleFra, stilleTil)) : -120;

    // Nivåtrappen: er sprangene 6 dB, eller blir de mindre når det blir høyt?
    var trinn = TS.TRINN.dbfs.map(function (dbfs, k) {
      var start = sekStart + Math.round((TS.TRINN.start + k * (TS.TRINN.varighet + TS.TRINN.mellom)) * fs);
      var fra = start + Math.round(0.15 * fs), til = start + Math.round(0.65 * fs);
      var maalt = til <= m.length ? D.dbAmp(D.tonenivaa(m, fs, 1000, fra, til)) : null;
      return { dbfs: dbfs, maalt: maalt, fra: fra, til: til,
               gyldig: maalt !== null && maalt > stoy1k + 12 };
    });
    var gyldige = trinn.filter(function (t) { return t.gyldig; });
    var sprang = [];
    for (var g = 1; g < gyldige.length; g++) sprang.push(gyldige[g].maalt - gyldige[g - 1].maalt);
    var ovre = sprang.slice(-3);
    var snittOvre = ovre.length ? ovre.reduce(function (x, y) { return x + y; }, 0) / ovre.length : null;
    var kompresjon = snittOvre === null ? null : {
      sprangDb: sprang,
      snittOvreDb: snittOvre,
      finnes: snittOvre < 4.5
    };
    var frekvens = null;
    if (gyldige.length) {
      var h = gyldige[gyldige.length - 1];
      frekvens = topptone(m, fs, h.fra, h.til, TS.TRINN.frekvens);
    }

    // Rosa støy: nivå over tid, og nivå mot det frekvensresponsen spår.
    var rosaStart = sekStart + Math.round(TS.ROSA.start * fs);
    var rosaN = Math.round(TS.ROSA.varighet * fs);
    var rosa = null;
    if (rosaStart + rosaN <= m.length) {
      var blokk = Math.round(0.5 * fs), kurve = [];
      for (var r = 0; r + blokk <= rosaN; r += blokk) kurve.push(D.dbAmp(D.rms(m, rosaStart + r, rosaStart + r + blokk)));
      var forst = (kurve[1] + kurve[2]) / 2;
      var sist = (kurve[kurve.length - 2] + kurve[kurve.length - 1]) / 2;
      var maaltDb = D.dbAmp(D.rms(m, rosaStart + blokk, rosaStart + rosaN - blokk));
      rosa = { kurve: kurve, endringDb: sist - forst, maaltDb: maaltDb,
               forventetDb: forventetRosa(fs, fr), synkerOverTid: sist - forst < -3 };
      rosa.avvikDb = rosa.maaltDb - rosa.forventetDb;
      rosa.dempes = rosa.avvikDb < -4 || rosa.synkerOverTid;
    }

    return {
      sveipStart: s0 / fs,
      respons: fr.kurve,
      nedreGrense: grense(fr.kurve, -1),
      ovreGrense: grense(fr.kurve, 1),
      etterklang: rt,
      forvrengning: forvrengning,
      stoygulvDb: stoygulv,
      brum: harStille ? brum(m, fs, stilleFra, stilleTil) : null,
      trinn: trinn.map(function (t) { return { dbfs: t.dbfs, maalt: t.maalt, gyldig: t.gyldig }; }),
      kompresjon: kompresjon,
      frekvens1k: frekvens,
      rosa: rosa,
      signalStoyDb: rosa && stoygulv !== null ? rosa.maaltDb - stoygulv : null,
      // Hvor mye av sekvensen opptaket rakk, og om tonene kom gjennom i det
      // hele tatt — en støydemper kan spise en vedvarende tone som om den var
      // vifte-sus.
      dekketS: (m.length - sekStart) / fs,
      tonerBorte: trinn.some(function (t) { return t.maalt !== null; }) && !gyldige.length
    };
  }

  // Hva den rosa støyen *burde* måle, gitt kjedens frekvensrespons. Responsen
  // er absolutt (ikke normalisert) i `per`, skalert med sveipets nivå.
  function forventetRosa(fs, fr) {
    var rosa = TS.lagRosa ? TS.lagRosa(fs, Math.round(4 * fs)) : null;
    if (!rosa) return null;
    var nfft = (fr.per.length - 1) * 2;
    var spek = D.spektrum(rosa, fs, 8192);
    var skala = 1 / (TS.SVEIP.nivaa * TS.SVEIP.nivaa);
    var sum = 0;
    for (var b = 1; b < spek.effekt.length; b++) {
      // Utenfor sveipet brukes kanten: støyen har energi under 20 Hz, og
      // hoppes den over, spår vi 1,6 dB for lite selv for en tapsfri kjede.
      var f = Math.max(TS.SVEIP.f1, Math.min(b * spek.df, TS.SVEIP.f2, fs * 0.49));
      var k = Math.min(fr.per.length - 1, Math.round(f / fr.df));
      sum += spek.effekt[b] * fr.per[k] * skala;
    }
    // Effektspekteret er ensidig og normalisert til A²/2 for en sinus, så
    // summen er middelkvadratet.
    return D.db(sum);
  }

  /* ------------------------------------------------------- funnene */

  function hz(f) {
    if (f === null || f === undefined) return '–';
    return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2).replace('.', ',') + ' kHz' : Math.round(f) + ' Hz';
  }

  // Funn i klartekst, med alvorlighet: 'feil', 'merk' eller 'ok'.
  function funn(a) {
    var g = a.grunn, t = a.test, ut = [];
    if (g.klipping.hendelser > 0) {
      ut.push({ niva: 'feil', tekst: 'Klipping: ' + g.klipping.hendelser + ' steder. Ta opp lenger unna eller lavere.' });
    }
    if (g.sannToppDb > -0.1 && !g.klipping.hendelser) {
      ut.push({ niva: 'merk', tekst: 'Toppene når helt opp til 0 dBFS — lite å gå på.' });
    }
    if (g.kanalforhold && g.kanalforhold.identiske) {
      ut.push({ niva: 'merk', tekst: 'To kanaler, men de er identiske: dette er mono.' });
    }
    // Sveipet slutter ved 20 kHz, og det gir en bratt kant i ethvert opptak
    // av testsignalet. Der er kanten signalets, ikke en kodeks.
    if (g.kodekkant && !(t && g.kodekkant > 15000)) {
      ut.push({ niva: 'merk', tekst: 'Bratt kant ved ' + hz(g.kodekkant) + ' — ser ut som en kodek har kuttet toppen.' });
    }
    if (g.stoygulvDb !== null && g.stoygulvDb < -100 && g.toppDb > -70) {
      ut.push({ niva: 'feil', tekst: 'Stillheten er digitalt null (' + Math.round(g.stoygulvDb) + ' dBFS). En støyport skrur av lyden når det er stille.' });
    }
    if (Math.abs(g.dc) > 0.005) {
      ut.push({ niva: 'merk', tekst: 'Likespenningsforskyvning på ' + g.dc.toFixed(3) + '.' });
    }
    if (!t) return ut;

    if (t.ekteRate) {
      ut.push({ niva: 'feil', tekst: 'Fila sier ' + t.oppgittRate + ' Hz, men lyden går i ' + t.ekteRate + ' Hz. Testsignalet passet først da — alle tall under er regnet på ' + t.ekteRate + ' Hz.' });
    }
    if (t.dekketS < TS.LENGDE - 0.6) {
      ut.push({ niva: 'merk', tekst: 'Opptaket stoppet ' + (TS.LENGDE - t.dekketS).toFixed(1).replace('.', ',') + ' s før testsignalet var ferdig' +
        (t.rosa ? '.' : ' — den rosa støyen mangler, så støydemping og signal/støy kunne ikke måles.') });
    }
    if (t.tonerBorte) {
      ut.push({ niva: 'feil', tekst: 'Ingen av tonene i nivåtrappen kom over støyen. Noe (støydemping?) fjerner vedvarende toner.' });
    }

    ut.push(t.nedreGrense ?
      { niva: t.nedreGrense > 150 ? 'merk' : 'ok', tekst: 'Bassen faller under −10 dB ved ' + hz(t.nedreGrense) + '.' } :
      { niva: 'ok', tekst: 'Bassen holder seg over −10 dB helt ned til 20 Hz.' });
    ut.push(t.ovreGrense ?
      { niva: t.ovreGrense < 12000 ? 'merk' : 'ok', tekst: 'Diskanten faller under −10 dB ved ' + hz(t.ovreGrense) + '.' } :
      { niva: 'ok', tekst: 'Diskanten holder seg over −10 dB helt opp til toppen av sveipet.' });
    if (t.kompresjon) {
      ut.push(t.kompresjon.finnes ?
        { niva: 'feil', tekst: 'Nivået trykkes sammen: de øverste sprangene er ' + t.kompresjon.snittOvreDb.toFixed(1).replace('.', ',') + ' dB i stedet for 6. Noe (AGC eller limiter) styrer nivået.' } :
        { niva: 'ok', tekst: 'Nivået følger signalet lineært — ingen automatisk nivåkontroll.' });
    }
    if (t.rosa) {
      ut.push(t.rosa.dempes ?
        { niva: 'feil', tekst: 'Vedvarende lyd dempes (' + t.rosa.avvikDb.toFixed(1).replace('.', ',') + ' dB mot forventet, ' + t.rosa.endringDb.toFixed(1).replace('.', ',') + ' dB over tid). Støydemping er på.' } :
        { niva: 'ok', tekst: 'Rosa støy slipper gjennom uendret — ingen støydemping.' });
    }
    if (t.frekvens1k && Math.abs(t.frekvens1k - 1000) > 2) {
      ut.push({ niva: 'feil', tekst: '1 kHz måles som ' + t.frekvens1k.toFixed(1).replace('.', ',') + ' Hz. Samplingsraten stemmer ikke med det som står i fila.' });
    }
    if (t.brum && t.brum.finnes) ut.push({ niva: 'merk', tekst: 'Brum fra strømnettet (50 Hz), ' + Math.round(t.brum.overDb) + ' dB over bakgrunnen.' });
    if (t.forvrengning && t.forvrengning.prosent > 3) ut.push({ niva: 'merk', tekst: 'Forvrengning rundt ' + t.forvrengning.prosent.toFixed(1).replace('.', ',') + ' % — høyttaleren eller mikrofonen presses.' });
    if (t.signalStoyDb !== null && t.signalStoyDb < 30) ut.push({ niva: 'merk', tekst: 'Bare ' + Math.round(t.signalStoyDb) + ' dB mellom testsignalet og støyen. Skru opp volumet eller gå nærmere.' });
    if (t.stoygulvDb === null) ut.push({ niva: 'merk', tekst: 'Opptaket startet etter at testsignalet hadde begynt — støygulvet kunne ikke måles.' });
    return ut;
  }

  // `valg.bareGrunn` hopper over letingen etter testsignalet. Verkstedet
  // trenger den ikke, og den koster flere sekunder på et kort opptak.
  function analyser(kanaler, fs, valg) {
    var a = { grunn: grunn(kanaler, fs), test: null };
    if (!(valg && valg.bareGrunn)) {
      try { a.test = test(kanaler, fs); } catch (e) { a.testFeil = String(e && e.message || e); }
    }
    a.funn = funn(a);
    return a;
  }

  return { analyser: analyser, grunn: grunn, test: test, funn: funn, hz: hz };
})();
