/*
 * Tidsstrekkingen i en egen tråd.
 *
 * Fire minutter musikk tar noen sekunder å strekke på en telefon. I
 * hovedtråden ville avspillingen og glidebryterne hakket så lenge; her går
 * de videre, og den nye lyden byttes inn når den er klar.
 */
'use strict';

importScripts('strekk.js?v=3');

self.onmessage = function (e) {
  var d = e.data;
  try {
    var kanaler = d.kanaler;
    if (d.baklengs) kanaler = kanaler.map(function (k) { return Float32Array.from(k).reverse(); });
    var ut = LydStrekk.strekk(kanaler, d.fs, d.faktor);
    self.postMessage({ id: d.id, kanaler: ut }, ut.map(function (k) { return k.buffer; }));
  } catch (feil) {
    self.postMessage({ id: d.id, feil: String(feil && feil.message || feil) });
  }
};
