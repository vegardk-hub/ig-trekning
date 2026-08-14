/*
 * Lydopptakene av forelderens stemme.
 *
 * Ligger i IndexedDB og ikke i localStorage: localStorage tar bare strenger
 * og har en grense rundt fem megabyte, mens dette er lydfiler. Et opptak per
 * linje, nøklet på tekst-id og linjenummer, så en tekst kan være delvis lest
 * inn — linjer uten opptak faller tilbake på den syntetiske stemmen.
 *
 * Alt ligger på enheten. Det finnes ingen backend her, så tømmer man
 * nettleserdata, er opptakene borte.
 */

(function () {
  'use strict';

  var DB = 'monstergiret';
  var BUTIKK = 'opptak';
  var db = null;

  function aapne() {
    return new Promise(function (ok, nei) {
      if (db) { ok(db); return; }
      if (!window.indexedDB) { nei(new Error('ingen indexedDB')); return; }
      var f = indexedDB.open(DB, 1);
      f.onupgradeneeded = function () {
        var d = f.result;
        if (!d.objectStoreNames.contains(BUTIKK)) {
          d.createObjectStore(BUTIKK, { keyPath: 'id' }).createIndex('tekst', 'tekst', { unique: false });
        }
      };
      f.onsuccess = function () { db = f.result; ok(db); };
      f.onerror = function () { nei(f.error); };
    });
  }

  function med(modus, arbeid) {
    return aapne().then(function (d) {
      return new Promise(function (ok, nei) {
        var t = d.transaction(BUTIKK, modus);
        var b = t.objectStore(BUTIKK);
        var svar;
        arbeid(b, function (v) { svar = v; });
        t.oncomplete = function () { ok(svar); };
        t.onerror = function () { nei(t.error); };
      });
    });
  }

  function nokkel(tekstId, linje) { return tekstId + ':' + linje; }

  window.LeseOpptak = {
    // Alle tre må være på plass. Uten MediaRecorder er det ingenting å lagre,
    // og uten getUserMedia ingenting å ta opp.
    stottes: function () {
      return !!(window.indexedDB && window.MediaRecorder &&
                navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },

    lagre: function (tekstId, linje, blob) {
      return med('readwrite', function (b) {
        b.put({ id: nokkel(tekstId, linje), tekst: tekstId, linje: linje, blob: blob, laget: Date.now() });
      });
    },

    slett: function (tekstId, linje) {
      return med('readwrite', function (b) { b.delete(nokkel(tekstId, linje)); });
    },

    slettTekst: function (tekstId, antallLinjer) {
      return med('readwrite', function (b) {
        for (var i = 0; i < antallLinjer; i++) b.delete(nokkel(tekstId, i));
      });
    },

    // Blobene for én tekst, som en tabell på linje-indeks. Hull er null, og
    // det er hullene som avgjør hvilke linjer den syntetiske stemmen tar.
    forTekst: function (tekstId, antallLinjer) {
      return med('readonly', function (b, sett) {
        var ut = new Array(antallLinjer);
        for (var i = 0; i < antallLinjer; i++) ut[i] = null;
        var f = b.index('tekst').openCursor(IDBKeyRange.only(tekstId));
        f.onsuccess = function () {
          var p = f.result;
          if (!p) { sett(ut); return; }
          if (p.value.linje < antallLinjer) ut[p.value.linje] = p.value.blob;
          p.continue();
        };
      });
    },

    // Hvor mange linjer som er lest inn per tekst, til lista.
    tellinger: function () {
      return med('readonly', function (b, sett) {
        var ut = {};
        var f = b.openCursor();
        f.onsuccess = function () {
          var p = f.result;
          if (!p) { sett(ut); return; }
          ut[p.value.tekst] = (ut[p.value.tekst] || 0) + 1;
          p.continue();
        };
      });
    }
  };
})();
