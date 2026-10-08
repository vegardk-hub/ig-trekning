/*
 * Opptakeren som kjører i lydtråden — rå samplinger, ingen koding.
 *
 * MediaRecorder koder alltid til noe (Opus, AAC), og det som kommer ut er
 * ikke det mikrofonen leverte. Her kopieres hver blokk på 128 samplinger
 * slik den er, og sendes til hovedtråden i biter på 4096. Større biter gir
 * færre meldinger; mindre gir et nivåmåler som henger mindre etter.
 *
 * Fila må være en egen modul fordi `audioWorklet.addModule` krever en URL.
 * Den er derfor ikke en IIFE som resten — den har ingenting å legge på
 * `window`, og lydtråden har ingen `window`.
 */
'use strict';

class Opptaker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bit = 4096;
    this.kanaler = null;
    this.fylt = 0;
    this.topp = 0;
    this.aktiv = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stopp') {
        this.send();
        this.aktiv = false;
        this.port.postMessage({ ferdig: true });
      }
    };
  }

  send() {
    if (!this.kanaler || !this.fylt) return;
    const ut = this.kanaler.map((k) => k.slice(0, this.fylt));
    this.port.postMessage({ kanaler: ut, topp: this.topp }, ut.map((k) => k.buffer));
    this.kanaler = this.kanaler.map(() => new Float32Array(this.bit));
    this.fylt = 0;
    this.topp = 0;
  }

  process(inputs) {
    if (!this.aktiv) return false;
    const inn = inputs[0];
    // Uten kanaler har strømmen ikke levert noe ennå; det er ikke stillhet.
    if (!inn || !inn.length) return true;
    if (!this.kanaler || this.kanaler.length !== inn.length) {
      this.send();
      this.kanaler = inn.map(() => new Float32Array(this.bit));
      this.fylt = 0;
    }
    const n = inn[0].length;
    let i = 0;
    while (i < n) {
      const plass = Math.min(n - i, this.bit - this.fylt);
      for (let c = 0; c < inn.length; c++) {
        const kilde = inn[c];
        const mal = this.kanaler[c];
        for (let j = 0; j < plass; j++) {
          const v = kilde[i + j];
          mal[this.fylt + j] = v;
          const a = v < 0 ? -v : v;
          if (a > this.topp) this.topp = a;
        }
      }
      this.fylt += plass;
      i += plass;
      if (this.fylt === this.bit) this.send();
    }
    return true;
  }
}

registerProcessor('lydloft-opptaker', Opptaker);
