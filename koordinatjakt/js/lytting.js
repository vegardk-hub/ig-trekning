/*
 * Øret – barnet sier ordet i stedet for å skrive det.
 *
 * Én knapp, ett ord, ett forsøk. Det er en annen bruk enn i Monstergiret og
 * Lesestjerna, der mikrofonen står på mens barnet leser en hel tekst, og det
 * gir en annen innstilling:
 *
 * - `continuous = false`. Vi venter ikke på en strøm, vi venter på ett ord.
 *   Gjenkjenneren skal stoppe av seg selv når barnet er ferdig — og skal
 *   ikke startes på nytt i `onend`, som er nødvendig når noen leser og
 *   pauser, men her bare ville latt mikrofonen stå åpen i bakgrunnen.
 * - `maxAlternatives = 5`. Ett ord uten setning rundt seg er det vanskeligste
 *   en gjenkjenner får, for den har ingen sammenheng å gjette ut fra.
 *   Førstevalget er ofte feil mens det riktige ligger som nummer tre. Alle
 *   alternativene prøves mot fasiten, og det er den enkeltendringen som
 *   flytter mest på hvor ofte dette virker.
 * - **Tidsur.** Sier barnet ingenting, fyrer verken `onresult` eller
 *   `onerror` på alle nettlesere. Uten tidsuret blir knappen stående og lyse
 *   for alltid.
 *
 * Gjenkjenningen går over nett i både Chrome og Safari: lyden sendes til en
 * tjener. Uten nett skjer det ingenting, og det er ikke en feil i appen.
 */
'use strict';

var Lytting = (function () {

  var Gjenkjenner = window.SpeechRecognition || window.webkitSpeechRecognition;
  var aktiv = null;

  function stottes() { return !!Gjenkjenner; }

  function stopp() {
    if (!aktiv) return;
    var gj = aktiv;
    aktiv = null;
    try { gj.abort(); } catch (e) { /* allerede ferdig */ }
  }

  /*
   * `opts.paaSvar(kandidater)` – alt gjenkjenneren mente å høre, flatt.
   * `opts.paaFeil(kode)`       – 'ingenting', 'nektet', 'nett' eller 'ukjent'.
   * `opts.paaSlutt()`          – alltid, uansett utfall. Knappen slukkes her.
   */
  function lytt(opts) {
    if (!Gjenkjenner) return false;
    stopp();

    var gj = new Gjenkjenner();
    gj.lang = opts.sprak || 'nb-NO';
    gj.continuous = false;
    gj.interimResults = false;
    gj.maxAlternatives = 5;

    var ferdig = false;
    var tidsur = null;

    function avslutt() {
      if (ferdig) return;
      ferdig = true;
      if (tidsur) clearTimeout(tidsur);
      if (aktiv === gj) aktiv = null;
      if (opts.paaSlutt) opts.paaSlutt();
    }

    gj.onresult = function (e) {
      var ut = [];
      for (var i = 0; i < e.results.length; i++) {
        var res = e.results[i];
        for (var j = 0; j < res.length; j++) {
          var t = res[j] && res[j].transcript;
          if (t && ut.indexOf(t) === -1) ut.push(t);
        }
      }
      if (opts.paaSvar) opts.paaSvar(ut);
      avslutt();
    };

    gj.onerror = function (e) {
      var kode = e && e.error;
      if (opts.paaFeil) {
        opts.paaFeil(
          kode === 'no-speech' ? 'ingenting' :
          kode === 'not-allowed' || kode === 'service-not-allowed' ? 'nektet' :
          kode === 'network' ? 'nett' :
          kode === 'aborted' ? 'avbrutt' : 'ukjent'
        );
      }
      avslutt();
    };

    gj.onend = avslutt;

    try {
      gj.start();
    } catch (e) {
      // Et nytt kall før forrige har sluppet mikrofonen kaster.
      if (opts.paaFeil) opts.paaFeil('ukjent');
      avslutt();
      return false;
    }

    aktiv = gj;
    tidsur = setTimeout(function () {
      if (opts.paaFeil) opts.paaFeil('ingenting');
      stopp();
      avslutt();
    }, opts.tid || 7000);

    return true;
  }

  return { stottes: stottes, lytt: lytt, stopp: stopp };
})();
