/*
 * Analysen i en egen tråd.
 *
 * Foldningen av testsignalet og spekteret av et opptak på fire minutter tar
 * noen sekunder på en telefon. I hovedtråden fryser det knappene og nivå-
 * måleren så lenge; her går siden videre mens tallene regnes ut.
 *
 * De tre modulene er de samme som prøvene laster i Node, og de legger seg på
 * det globale objektet her akkurat som på `window`.
 */
'use strict';

importScripts('dsp.js?v=1', 'testsignal.js?v=1', 'analyse.js?v=1');

self.onmessage = function (e) {
  var d = e.data;
  try {
    var a = LydAnalyse.analyser(d.kanaler, d.fs);
    self.postMessage({ id: d.id, analyse: a });
  } catch (feil) {
    self.postMessage({ id: d.id, feil: String(feil && feil.message || feil) });
  }
};
