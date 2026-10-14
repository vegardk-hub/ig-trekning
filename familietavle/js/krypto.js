/*
 * Krypteringen av datafila – samme kode i synk-jobben og i nettleseren.
 *
 * Repoet er offentlig, og datagrenen er det også. Kalenderne på den er
 * derfor kryptert med en passfrase som bare finnes to steder: som hemmelighet
 * i GitHub, og i nettbrettets `localStorage`. Den som finner fila, ser bare
 * støy.
 *
 * PBKDF2 med 250 000 runder gjør hver gjetning dyr. Det koster nettbrettet et
 * kvart sekund hver gang fila har endret seg, og det er en pris verdt å betale
 * for en fil som ligger åpent på nettet. Passfrasen må likevel være lang –
 * fire–fem tilfeldige ord, ikke et kjæledyrnavn.
 *
 * Saltet og IV-en er nye for hver kryptering. Det betyr at fila endrer seg ved
 * hver synk selv om kalendrene ikke har det, og at tavla må dekryptere på
 * nytt. Det motsatte – gjenbruk av IV med samme nøkkel – ville brutt AES-GCM.
 */
'use strict';

var Krypto = (function () {

  var RUNDER = 250000;

  function tilB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function fraB64(tekst) {
    var s = atob(tekst), ut = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) ut[i] = s.charCodeAt(i);
    return ut;
  }

  function nokkel(passfrase, salt, runder) {
    var c = crypto.subtle;
    return c.importKey('raw', new TextEncoder().encode(passfrase), 'PBKDF2', false, ['deriveKey'])
      .then(function (raa) {
        return c.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: runder, hash: 'SHA-256' },
          raa, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function krypter(tekst, passfrase) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return nokkel(passfrase, salt, RUNDER).then(function (n) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, n, new TextEncoder().encode(tekst));
    }).then(function (data) {
      return { v: 1, runder: RUNDER, salt: tilB64(salt), iv: tilB64(iv), data: tilB64(new Uint8Array(data)) };
    });
  }

  // Avviser med en feil om passfrasen er feil – AES-GCM sjekker selv.
  function dekrypter(pakke, passfrase) {
    if (!pakke || pakke.v !== 1) return Promise.reject(new Error('Ukjent filformat'));
    return nokkel(passfrase, fraB64(pakke.salt), pakke.runder).then(function (n) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fraB64(pakke.iv) }, n, fraB64(pakke.data));
    }).then(function (data) {
      return new TextDecoder().decode(data);
    });
  }

  return { krypter: krypter, dekrypter: dekrypter };
})();

if (typeof module !== 'undefined') module.exports = Krypto;
