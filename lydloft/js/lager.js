/*
 * Opptakene, lagret i nettleseren (IndexedDB).
 *
 * To lagre i stedet for ett: `meta` holder navn, tall og kurver, `lyd` holder
 * samplingene. Lista over opptak leser bare `meta`. Fire minutter i stereo er
 * nesten 100 MB i flyttall, og å hente alt det for å vise ti linjer tekst
 * ville gjort lista treg på telefonen.
 *
 * `localStorage` tar ikke binærdata, og den går fullt lenge før et opptak er
 * ferdig — samme grunn som innspillingene i Monstergiret ligger i IndexedDB.
 */
'use strict';

var LydLager = (function () {

  var NAVN = 'lydloft', VERSJON = 1;
  var apen = null;

  function db() {
    if (apen) return apen;
    apen = new Promise(function (ok, nei) {
      var f = indexedDB.open(NAVN, VERSJON);
      f.onupgradeneeded = function () {
        var d = f.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('lyd')) d.createObjectStore('lyd', { keyPath: 'id' });
      };
      f.onsuccess = function () { ok(f.result); };
      f.onerror = function () { apen = null; nei(f.error); };
    });
    return apen;
  }

  function transaksjon(lagre, modus, gjor) {
    return db().then(function (d) {
      return new Promise(function (ok, nei) {
        var t = d.transaction(lagre, modus);
        var svar;
        t.oncomplete = function () { ok(svar); };
        t.onerror = function () { nei(t.error); };
        t.onabort = function () { nei(t.error || new Error('avbrutt')); };
        gjor(t, function (v) { svar = v; });
      });
    });
  }

  function lagre(meta, lyd) {
    return transaksjon(['meta', 'lyd'], 'readwrite', function (t) {
      t.objectStore('meta').put(meta);
      t.objectStore('lyd').put(lyd);
    });
  }

  function oppdater(meta) {
    return transaksjon(['meta'], 'readwrite', function (t) { t.objectStore('meta').put(meta); });
  }

  function alle() {
    return transaksjon(['meta'], 'readonly', function (t, svar) {
      var f = t.objectStore('meta').getAll();
      f.onsuccess = function () {
        svar(f.result.sort(function (a, b) { return b.dato - a.dato; }));
      };
    });
  }

  function hentLyd(id) {
    return transaksjon(['lyd'], 'readonly', function (t, svar) {
      var f = t.objectStore('lyd').get(id);
      f.onsuccess = function () { svar(f.result || null); };
    });
  }

  function slett(id) {
    return transaksjon(['meta', 'lyd'], 'readwrite', function (t) {
      t.objectStore('meta').delete(id);
      t.objectStore('lyd').delete(id);
    });
  }

  return { lagre: lagre, oppdater: oppdater, alle: alle, hentLyd: hentLyd, slett: slett };
})();
