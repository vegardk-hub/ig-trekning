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
    feiring: feiring,
    rampe: rampe
  };
})();
