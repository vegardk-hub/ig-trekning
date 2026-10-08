/*
 * Effektkjeden — det som gir et opptak ny karakter.
 *
 * Kjeden bygges av Web Audio-noder og fungerer likt i en vanlig lydkontekst
 * (det du hører mens du skrur) og i en `OfflineAudioContext` (det som lagres).
 * Det er hele grunnen til at den ligger her og ikke i verkstedet: bygges
 * forhåndslyttingen og eksporten hver for seg, glir de fra hverandre, og den
 * lagrede versjonen låter ikke som det du valgte.
 *
 *   kilde → lavkutt → bass → mellomtone → diskant → toppkutt
 *         → forvrengning → lo-fi → robot → chorus (+ knitring)
 *         → tørr + ekko + romklang → volum → limiter → ut
 *
 * Kutt-filtrene er dobbelt opp (24 dB per oktav). Med bare ett blir telefon-
 * og radiolyden for snill: et andreordens filter slipper gjennom for mye
 * bass til at det høres ut som en liten høyttaler.
 *
 * Tempo, tonehøyde og baklengs er ikke her. De endrer selve lyden før den
 * spilles, og gjøres i `strekk.js`.
 */
'use strict';

var LydEffekter = (function () {

  var STANDARD = {
    bass: 0, mellom: 0, diskant: 0, lavkutt: 20, toppkutt: 20000, volum: 0,
    tempo: 1, halvtoner: 0, baklengs: false,
    romklang: 0, romstorrelse: 1.8, ekko: 0, ekkotid: 0.35,
    forvrengning: 0, chorus: 0, chorusfart: 1.2, lofi: 0, knitring: 0, robot: 0,
    // Stil og trommer: hvilket mønster, takten trommene følger (BPM i
    // opptaket før tempoendringen) og hvor høyt. Brukes av verkstedet, ikke
    // av kjeden her.
    stil: 'ingen', slagBpm: 0, trommer: 0.6
  };

  // Karakterene er utgangspunkter, ikke låste valg: de setter glidebryterne,
  // og alt kan skrus videre derfra.
  var KARAKTERER = [
    { id: 'ingen', navn: 'Vanlig', verdier: {} },
    { id: 'bassboost', navn: 'Mer bass', verdier: { bass: 10, diskant: 3 } },
    { id: 'radio', navn: 'Gammel radio', verdier: { lavkutt: 300, toppkutt: 4500, mellom: 4, forvrengning: 0.25, knitring: 0.15 } },
    { id: 'telefon', navn: 'Telefon', verdier: { lavkutt: 400, toppkutt: 3400, mellom: 6, forvrengning: 0.15 } },
    { id: 'kassett', navn: 'Kassett', verdier: { toppkutt: 9000, bass: 3, chorus: 0.25, chorusfart: 0.6, knitring: 0.2, forvrengning: 0.1 } },
    { id: 'vinyl', navn: 'Vinyl', verdier: { toppkutt: 12000, bass: 2, knitring: 0.6, chorus: 0.08, chorusfart: 0.5 } },
    { id: 'kirke', navn: 'Kirke', verdier: { romklang: 0.85, romstorrelse: 4.5, diskant: -3 } },
    { id: 'sal', navn: 'Konsertsal', verdier: { romklang: 0.5, romstorrelse: 2.2 } },
    { id: 'undervann', navn: 'Under vann', verdier: { toppkutt: 600, bass: 6, chorus: 0.6, chorusfart: 0.3, romklang: 0.3 } },
    { id: 'robot', navn: 'Robot', verdier: { robot: 0.8, toppkutt: 8000, ekko: 0.2, ekkotid: 0.08 } },
    { id: 'romskip', navn: 'Romskip', verdier: { chorus: 0.7, chorusfart: 2.5, ekko: 0.4, ekkotid: 0.38, romklang: 0.4, romstorrelse: 3 } },
    { id: 'gitar', navn: 'Elgitar', verdier: { forvrengning: 0.7, lavkutt: 90, toppkutt: 6000, mellom: 5, romklang: 0.15 } },
    { id: '8bit', navn: '8-bit', verdier: { lofi: 0.75, toppkutt: 7000 } },
    { id: 'naborom', navn: 'Naborommet', verdier: { toppkutt: 1200, romklang: 0.4, volum: -6 } }
  ];

  var FART = [
    { id: 'normal', navn: 'Vanlig fart', verdier: { tempo: 1, halvtoner: 0 } },
    { id: 'ekorn', navn: 'Ekorn', verdier: { tempo: 1.15, halvtoner: 7 } },
    { id: 'troll', navn: 'Troll', verdier: { tempo: 0.9, halvtoner: -7 } },
    { id: 'sakte', navn: 'Sakte film', verdier: { tempo: 0.6, halvtoner: 0 } },
    { id: 'kjapp', navn: 'Kjapp', verdier: { tempo: 1.4, halvtoner: 0 } }
  ];

  /* ---------------------------------------------------------- byggesteiner */

  function forvrengningskurve(mengde) {
    if (mengde <= 0) return null;
    var n = 4096, kurve = new Float32Array(n), k = 1 + mengde * 30, norm = Math.tanh(k);
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1;
      kurve[i] = Math.tanh(k * x) / norm;
    }
    return kurve;
  }

  // Trappetrinn: færre nivåer gir den grove lyden fra gamle spillkonsoller.
  function lofikurve(mengde) {
    if (mengde <= 0) return null;
    var bits = 16 - mengde * 12, nivaa = Math.pow(2, bits - 1);
    var n = 65536, kurve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1;
      kurve[i] = Math.round(x * nivaa) / nivaa;
    }
    return kurve;
  }

  function seed(s) {
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Romklang: støy som dør ut og blir mørkere jo lenger den varer, slik
  // diskanten dør først i et ekte rom. Energien er satt til 1, så mengden
  // på glidebryteren betyr det samme uansett størrelse.
  function romrespons(ctx, sek) {
    var fs = ctx.sampleRate, n = Math.round(sek * fs), forsinkelse = Math.round(0.012 * fs);
    var buf = ctx.createBuffer(2, n + forsinkelse, fs);
    var r = seed(42);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), lp = 0, energi = 0;
      for (var i = 0; i < n; i++) {
        var t = i / fs;
        var demp = Math.exp(-6.9 * t / sek);
        var glatt = Math.min(0.95, 0.15 + 0.8 * t / sek);     // mørkere utover
        lp = glatt * lp + (1 - glatt) * (r() * 2 - 1);
        var v = lp * demp;
        d[forsinkelse + i] = v;
        energi += v * v;
      }
      var skala = 1 / Math.sqrt(energi || 1);
      for (var j = 0; j < d.length; j++) d[j] *= skala;
    }
    return buf;
  }

  // Sus og knitring fra en plate eller et bånd, i en sløyfe på fire sekunder.
  function knitrebuffer(ctx) {
    var fs = ctx.sampleRate, n = 4 * fs, buf = ctx.createBuffer(2, n, fs), r = seed(7);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), lp = 0;
      for (var i = 0; i < n; i++) {
        lp = 0.6 * lp + 0.4 * (r() * 2 - 1);
        d[i] = lp * 0.08;
      }
      var klikk = 4 * 7;
      for (var k = 0; k < klikk; k++) {
        var p = Math.floor(r() * (n - 200)), a = (0.3 + r() * 0.7) * (r() < 0.5 ? -1 : 1);
        for (var j = 0; j < 120; j++) d[p + j] += a * Math.exp(-j / 18);
      }
    }
    return buf;
  }

  /* ----------------------------------------------------------------- kjeden */

  // Bygger kjeden i `ctx` og kobler den til `ut`. Gir { inngang, sett, riv }.
  function bygg(ctx, ut, verdier) {
    var v = {};
    Object.keys(STANDARD).forEach(function (k) { v[k] = verdier && verdier[k] !== undefined ? verdier[k] : STANDARD[k]; });

    function filter(type, f, q, g) {
      var b = ctx.createBiquadFilter();
      b.type = type; b.frequency.value = f;
      if (q !== undefined) b.Q.value = q;
      if (g !== undefined) b.gain.value = g;
      return b;
    }
    function forsterk(g) { var n = ctx.createGain(); n.gain.value = g; return n; }

    var inngang = forsterk(1);
    var hp1 = filter('highpass', v.lavkutt, 0.7071), hp2 = filter('highpass', v.lavkutt, 0.7071);
    var bass = filter('lowshelf', 120, undefined, v.bass);
    var mellom = filter('peaking', 1000, 0.8, v.mellom);
    var diskant = filter('highshelf', 5000, undefined, v.diskant);
    var lp1 = filter('lowpass', v.toppkutt, 0.7071), lp2 = filter('lowpass', v.toppkutt, 0.7071);

    var drivInn = forsterk(1), driv = ctx.createWaveShaper(), drivUt = forsterk(1);
    driv.oversample = '4x';
    var lofi = ctx.createWaveShaper();

    // Ringmodulasjon: forsterkningen svinger med 55 Hz, og tonen får metallklang.
    var robotTorr = forsterk(1), robotVaat = forsterk(0), ring = forsterk(0);
    var robotOsc = ctx.createOscillator();
    robotOsc.frequency.value = 55;
    robotOsc.connect(ring.gain);

    // Chorus: to forsinkelser som vugger litt i tid, lagt oppå originalen.
    var chorusSum = forsterk(1), chorusVaat = forsterk(0);
    var lfo = ctx.createOscillator(), lfo2 = ctx.createOscillator();
    var dybde = forsterk(0), dybde2 = forsterk(0);
    var d1 = ctx.createDelay(0.1), d2 = ctx.createDelay(0.1);
    d1.delayTime.value = 0.012; d2.delayTime.value = 0.017;
    lfo.connect(dybde); dybde.connect(d1.delayTime);
    lfo2.connect(dybde2); dybde2.connect(d2.delayTime);

    var knitreKilde = ctx.createBufferSource(), knitreNivaa = forsterk(0);
    knitreKilde.buffer = knitrebuffer(ctx);
    knitreKilde.loop = true;

    var torr = forsterk(1);
    var ekkoSend = forsterk(0), ekko = ctx.createDelay(2.5), tilbake = forsterk(0.45), ekkoFarge = filter('lowpass', 3000, 0.7071);
    var romSend = forsterk(0), rom = ctx.createConvolver();
    rom.normalize = false;
    var master = forsterk(1);
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;

    inngang.connect(hp1); hp1.connect(hp2); hp2.connect(bass); bass.connect(mellom);
    mellom.connect(diskant); diskant.connect(lp1); lp1.connect(lp2);
    lp2.connect(drivInn); drivInn.connect(driv); driv.connect(drivUt);
    drivUt.connect(lofi);
    lofi.connect(robotTorr); lofi.connect(ring); ring.connect(robotVaat);
    robotTorr.connect(chorusSum); robotVaat.connect(chorusSum);
    chorusSum.connect(torr);
    chorusSum.connect(d1); chorusSum.connect(d2);
    d1.connect(chorusVaat); d2.connect(chorusVaat); chorusVaat.connect(torr);
    knitreKilde.connect(knitreNivaa); knitreNivaa.connect(torr);
    torr.connect(master);
    torr.connect(ekkoSend); ekkoSend.connect(ekko); ekko.connect(ekkoFarge);
    ekkoFarge.connect(tilbake); tilbake.connect(ekko); ekkoFarge.connect(master);
    torr.connect(romSend); romSend.connect(rom); rom.connect(master);
    master.connect(limiter); limiter.connect(ut);

    robotOsc.start(); lfo.start(); lfo2.start(); knitreKilde.start();

    var romLaget = null;
    function glid(param, verdi) {
      // Glidende overgang, så en glidebryter ikke gir knepp mens lyden går.
      param.setTargetAtTime(verdi, ctx.currentTime, 0.02);
    }

    function sett(navn, verdi) {
      v[navn] = verdi;
      switch (navn) {
        case 'bass': glid(bass.gain, verdi); break;
        case 'mellom': glid(mellom.gain, verdi); break;
        case 'diskant': glid(diskant.gain, verdi); break;
        case 'lavkutt': glid(hp1.frequency, verdi); glid(hp2.frequency, verdi); break;
        case 'toppkutt': glid(lp1.frequency, verdi); glid(lp2.frequency, verdi); break;
        case 'volum': glid(master.gain, Math.pow(10, verdi / 20)); break;
        case 'forvrengning':
          driv.curve = forvrengningskurve(verdi);
          // Mer driv gir høyere nivå; kompenser grovt så volumet står.
          glid(drivUt.gain, 1 / (1 + verdi * 1.5));
          break;
        case 'lofi': lofi.curve = lofikurve(verdi); break;
        case 'robot': glid(robotTorr.gain, 1 - verdi); glid(robotVaat.gain, verdi * 1.4); break;
        case 'chorus':
          glid(chorusVaat.gain, verdi * 0.7);
          glid(dybde.gain, verdi * 0.004); glid(dybde2.gain, verdi * 0.005);
          break;
        case 'chorusfart': glid(lfo.frequency, verdi); glid(lfo2.frequency, verdi * 1.27); break;
        case 'knitring': glid(knitreNivaa.gain, verdi * 1.5); break;
        case 'ekko': glid(ekkoSend.gain, verdi * 0.8); break;
        case 'ekkotid': glid(ekko.delayTime, verdi); break;
        case 'romklang': glid(romSend.gain, verdi * 0.9); break;
        case 'romstorrelse':
          if (romLaget !== verdi) { rom.buffer = romrespons(ctx, verdi); romLaget = verdi; }
          break;
      }
    }

    Object.keys(v).forEach(function (k) { sett(k, v[k]); });
    // Første gang skal verdiene stå med en gang, ikke gli fra null.
    [bass.gain, mellom.gain, diskant.gain].forEach(function (p, i) {
      p.cancelScheduledValues(0); p.value = [v.bass, v.mellom, v.diskant][i];
    });
    [[hp1, v.lavkutt], [hp2, v.lavkutt], [lp1, v.toppkutt], [lp2, v.toppkutt]].forEach(function (par) {
      par[0].frequency.cancelScheduledValues(0); par[0].frequency.value = par[1];
    });
    [[master.gain, Math.pow(10, v.volum / 20)], [robotTorr.gain, 1 - v.robot], [robotVaat.gain, v.robot * 1.4],
     [chorusVaat.gain, v.chorus * 0.7], [dybde.gain, v.chorus * 0.004], [dybde2.gain, v.chorus * 0.005],
     [knitreNivaa.gain, v.knitring * 1.5], [ekkoSend.gain, v.ekko * 0.8], [ekko.delayTime, v.ekkotid],
     [romSend.gain, v.romklang * 0.9], [drivUt.gain, 1 / (1 + v.forvrengning * 1.5)],
     [lfo.frequency, v.chorusfart], [lfo2.frequency, v.chorusfart * 1.27]].forEach(function (par) {
      par[0].cancelScheduledValues(0); par[0].value = par[1];
    });

    function riv() {
      [robotOsc, lfo, lfo2, knitreKilde].forEach(function (k) { try { k.stop(); } catch (e) { /* allerede stoppet */ } });
      try { limiter.disconnect(); } catch (e) { /* allerede koblet fra */ }
    }

    return { inngang: inngang, sett: sett, riv: riv, verdier: v };
  }

  // Hvor lenge lyden ringer etter at kilden er ferdig.
  function hale(v) {
    var t = 0.1;
    if (v.romklang > 0) t = Math.max(t, v.romstorrelse + 0.1);
    if (v.ekko > 0) t = Math.max(t, v.ekkotid * Math.log(0.001) / Math.log(0.45));
    return Math.min(t, 8);
  }

  return {
    STANDARD: STANDARD,
    KARAKTERER: KARAKTERER,
    FART: FART,
    bygg: bygg,
    hale: hale
  };
})();
