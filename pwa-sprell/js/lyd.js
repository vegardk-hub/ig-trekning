'use strict';

/* Lydene. Alle er satt sammen av oscillatorer i farta – ingen lydfiler, ingen
   nye avhengigheter, og ingenting å laste ned før første trykk.

   AudioContext må lages inne i et trykk. iOS starter den i «suspended», og en
   kontekst laget når siden lastes, blir aldri vekket – da er appen stum resten
   av økta uten at noe feiler. */
window.SprellLyd = (function () {

  var ctx = null;
  var paa = true;

  function vekk() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* Én tone med myk start og slutt. Uten rampene knepper det i høyttaleren
     hver gang en tone slås av. */
  function tone(frekv, start, lengde, form, styrke) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = form || 'triangle';
    o.frequency.setValueAtTime(frekv, ctx.currentTime + start);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(styrke || 0.16, ctx.currentTime + start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + lengde);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + lengde + 0.02);
  }

  function spill(fn) {
    if (!paa) return;
    if (!vekk()) return;
    fn();
  }

  /* Hvit støy, laget én gang og gjenbrukt. Det er den samme støyen som blir
     både suset fra raketten og smellet – forskjellen ligger i filteret. */
  var stoybuffer = null;
  function stoy() {
    if (stoybuffer) return stoybuffer;
    var lengde = Math.floor(ctx.sampleRate * 1.2);
    stoybuffer = ctx.createBuffer(1, lengde, ctx.sampleRate);
    var d = stoybuffer.getChannelData(0);
    for (var i = 0; i < lengde; i++) d[i] = Math.random() * 2 - 1;
    return stoybuffer;
  }

  /* Filtrert støy: bygger både suset og smellet. `fra` og `til` er hvor
     filteret starter og ender – opp gir et sus som stiger, ned gir et smell
     som dør ut. */
  function stoyskudd(start, lengde, form, fra, til, styrke) {
    var kilde = ctx.createBufferSource();
    kilde.buffer = stoy();
    var filter = ctx.createBiquadFilter();
    filter.type = form;
    filter.Q.value = form === 'bandpass' ? 1.6 : 0.7;
    filter.frequency.setValueAtTime(fra, ctx.currentTime + start);
    filter.frequency.exponentialRampToValueAtTime(til, ctx.currentTime + start + lengde);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(styrke, ctx.currentTime + start + Math.min(0.05, lengde * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + lengde);
    kilde.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    kilde.start(ctx.currentTime + start);
    kilde.stop(ctx.currentTime + start + lengde + 0.02);
  }

  /* Suset mens raketten stiger: støy som klatrer oppover i tonehøyde. Den
     varer omtrent like lenge som raketten bruker på å komme opp. */
  function rakett() {
    spill(function () {
      stoyskudd(0, 0.9, 'bandpass', 380, 2100, 0.07);
    });
  }

  /* Smellet når raketten sprekker: et dypt drønn, et bredt smell som faller
     fort, og litt knitring etterpå. Kalles fra fyrverkeriet i det gnistene
     kommer, så lyd og bilde treffer samtidig. */
  function smell() {
    spill(function () {
      stoyskudd(0, 0.4, 'lowpass', 2600, 220, 0.4);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.32);
      for (var i = 0; i < 3; i++) {
        stoyskudd(0.12 + i * 0.07 + Math.random() * 0.05, 0.1, 'bandpass', 3000 + Math.random() * 2000, 900, 0.06);
      }
    });
  }

  /* Trekket: to raske blipp oppover, som en maskin som spytter ut en lapp. */
  function trekk() {
    spill(function () {
      tone(660, 0, 0.09, 'square', 0.10);
      tone(990, 0.07, 0.12, 'square', 0.10);
    });
  }

  /* Feiringen: en liten fanfare og tre gnister på toppen. */
  function feiring() {
    spill(function () {
      var akkord = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < akkord.length; i++) tone(akkord[i], i * 0.1, 0.3, 'triangle', 0.18);
      for (var j = 0; j < 3; j++) {
        tone(1200 + Math.random() * 900, 0.45 + j * 0.09, 0.2, 'sine', 0.12);
      }
    });
  }

  /* Rampemodus: ned når den slås på, opp når den slås av. Lyden sier hvilken
     vei det gikk, også for den som ikke rekker å lese knappen. */
  function rampe(paaNaa) {
    spill(function () {
      var toner = paaNaa ? [440, 349.23, 261.63] : [261.63, 349.23, 440];
      for (var i = 0; i < toner.length; i++) tone(toner[i], i * 0.08, 0.16, 'sawtooth', 0.10);
    });
  }

  return {
    /* Kalles fra det første trykket, slik at lyden er klar når den trengs. */
    vekk: function () { if (paa) vekk(); },
    settPaa: function (verdi) {
      paa = !!verdi;
      if (!paa && ctx && ctx.state === 'running') ctx.suspend();
    },
    trekk: trekk,
    rakett: rakett,
    smell: smell,
    feiring: feiring,
    rampe: rampe
  };
})();
