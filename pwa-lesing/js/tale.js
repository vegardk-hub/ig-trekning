/*
 * Talegjenkjenning og ordmatching.
 *
 * To ting styrer alt her, og begge kommer av at brukeren er et barn:
 *
 * 1. Matchingen er med vilje rundhåndet. En falsk godkjenning koster
 *    ingenting — barnet leste, og fikk grønt. En falsk avvisning koster
 *    leselysten. Derfor lydforenkling, avstandsmål, sammensatte ord og lov
 *    til å hoppe over ett ord, i stedet for eksakt sammenligning.
 *
 * 2. Grønt tas aldri tilbake. Posisjonen går bare framover. Det er også
 *    grunnen til at vi tør fargelegge på foreløpige resultater: de skrives
 *    om hele tiden, men siden vi bare kan gå framover, blir omskrivningen
 *    aldri synlig som et ord som mistet fargen.
 */

(function () {
  'use strict';

  var Gjenkjenner = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ---------- normalisering ---------- */

  var TALL = {
    '0': 'null', '1': 'en', '2': 'to', '3': 'tre', '4': 'fire', '5': 'fem',
    '6': 'seks', '7': 'sju', '8': 'åtte', '9': 'ni', '10': 'ti', '11': 'elleve',
    '12': 'tolv', '13': 'tretten', '14': 'fjorten', '15': 'femten',
    '16': 'seksten', '17': 'sytten', '18': 'atten', '19': 'nitten',
    '20': 'tjue', '30': 'tretti', '40': 'førti', '50': 'femti', '60': 'seksti',
    '70': 'sytti', '80': 'åtti', '90': 'nitti', '100': 'hundre'
  };

  function normaliser(tekst) {
    var biter = String(tekst).toLowerCase().replace(/[^a-zæøåéèêüöä0-9]+/g, ' ').split(' ');
    var ut = [];
    for (var i = 0; i < biter.length; i++) {
      var o = biter[i];
      if (!o) continue;
      // Tall står som siffer i teksten og kommer som ord fra munnen.
      if (/^\d+$/.test(o) && TALL[o]) { ut.push(TALL[o]); continue; }
      ut.push(o);
    }
    return ut;
  }

  // Skriver ordet om til noe som ligner måten det uttales på. Poenget er ikke
  // å være riktig fonetikk, men å la «kjøre»/«sjøre» og «land»/«lann» falle
  // sammen — gjenkjenneren skriver ofte det den hørte, ikke det som står.
  function forenkle(o) {
    o = o.toLowerCase();
    o = o.replace(/hv/g, 'v');
    o = o.replace(/gj|hj|lj/g, 'j');
    o = o.replace(/skj|sj/g, 'S');
    o = o.replace(/sk([eiyøæ])/g, 'S$1');
    o = o.replace(/kj|tj/g, 'C');
    o = o.replace(/k([iyj])/g, 'C$1');
    o = o.replace(/([ln])d$/, '$1');
    o = o.replace(/(.)\1+/g, '$1');
    return o;
  }

  function avstand(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var rad = [];
    for (var j = 0; j <= n; j++) rad[j] = j;
    for (var i = 1; i <= m; i++) {
      var forrige = rad[0];
      rad[0] = i;
      for (var k = 1; k <= n; k++) {
        var midlertidig = rad[k];
        rad[k] = Math.min(
          rad[k] + 1,
          rad[k - 1] + 1,
          forrige + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1)
        );
        forrige = midlertidig;
      }
    }
    return rad[n];
  }

  // Treffer helt, uten slingringsmonn på avstand. Brukes der vi hopper langt
  // fram i teksten og ikke har råd til å ta feil.
  function streng(a, b) {
    return a === b || forenkle(a) === forenkle(b);
  }

  function lik(a, b) {
    if (a === b) return true;
    var fa = forenkle(a), fb = forenkle(b);
    if (fa === fb) return true;
    var n = Math.max(fa.length, fb.length);
    // Korte ord må treffe helt. Med én bokstavs slingring ville «og» matchet
    // «om», «opp» og «i» om hverandre, og halve teksten hadde blitt grønn av
    // seg selv.
    if (n <= 3) return false;
    var tol = n <= 5 ? 1 : (n <= 8 ? 2 : 3);
    return avstand(fa, fb) <= tol;
  }

  /* ---------- matcher ---------- */

  function lagMatcher(raaOrd) {
    var forventet = raaOrd.map(function (o) {
      var n = normaliser(o);
      return n.length ? n.join('') : '';
    });
    var pos = 0;
    var base = 0;

    function fram(start, tokens) {
      var p = start, i = 0;
      while (i < tokens.length && p < forventet.length) {
        var t = tokens[i];
        var traff = -1, brukt = 1;

        if (lik(t, forventet[p])) {
          traff = p;
        } else if (i + 1 < tokens.length && lik(t + tokens[i + 1], forventet[p])) {
          // «monster truck» fra gjenkjenneren mot «monstertruck» i teksten
          traff = p; brukt = 2;
        } else if (p + 1 < forventet.length && lik(t, forventet[p] + forventet[p + 1])) {
          // motsatt vei: ett gjenkjent ord dekker to ord i teksten
          traff = p + 1;
        } else if (p + 1 < forventet.length && lik(t, forventet[p + 1])) {
          // Ordet foran ble ikke hørt. Barnet leste videre, så vi gjør det òg.
          traff = p + 1;
        } else if (p + 2 < forventet.length && streng(t, forventet[p + 2])) {
          // To ord på rad forsvant. Det skjer, og uten dette blir barnet
          // stående fast midt i en setning det leste helt riktig. To ord er
          // så langt vi hopper, og bare på et ord som treffer helt — med
          // avstandsmål så langt fram ville støy kunne hoppe over halve
          // setningen.
          traff = p + 2;
        }

        if (traff >= 0) { p = traff + 1; i += brukt; }
        else i++;   // ord gjenkjenneren fant på – hopp over det
      }
      return p;
    }

    return {
      posisjon: function () { return pos; },
      ferdig: function () { return pos >= forventet.length; },

      // Et nytt utsagn starter der forrige sluttet. Innenfor utsagnet matcher
      // vi alltid hele teksten på nytt, for foreløpige resultater skrives om
      // — uten dette ville et omskrevet ord blitt talt to ganger.
      nyttUtsagn: function () { base = pos; },

      mat: function (tokens) {
        var ny = fram(base, tokens);
        if (ny > pos) pos = ny;
        return pos;
      },

      // Barnet trykket seg forbi et ord. Da flytter posisjonen med.
      settPosisjon: function (p) { if (p > pos) { pos = p; base = p; } }
    };
  }

  /* ---------- opplesing ---------- */

  var stemme = null;

  function finnStemme() {
    if (!window.speechSynthesis) return null;
    if (stemme) return stemme;
    var alle = window.speechSynthesis.getVoices() || [];
    for (var i = 0; i < alle.length; i++) {
      var l = (alle[i].lang || '').toLowerCase();
      if (l === 'nb-no' || l === 'no-no' || l.indexOf('nb') === 0 || l.indexOf('no') === 0) {
        stemme = alle[i];
        return stemme;
      }
    }
    return null;
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', function () { stemme = null; finnStemme(); });
  }

  var aktivLytter = null;

  function lesOpp(tekst, ferdig) {
    if (!window.speechSynthesis) { if (ferdig) ferdig(); return; }
    // Appen skal ikke høre seg selv lese. Mikrofonen står på pause så lenge
    // stemmen holder på.
    var lytter = aktivLytter;
    if (lytter) lytter.pause();
    window.speechSynthesis.cancel();
    var y = new SpeechSynthesisUtterance(tekst);
    var s = finnStemme();
    if (s) y.voice = s;
    y.lang = 'nb-NO';
    y.rate = 0.85;
    function slutt() {
      if (lytter) lytter.fortsett();
      if (ferdig) ferdig();
    }
    y.onend = slutt;
    y.onerror = slutt;
    window.speechSynthesis.speak(y);
  }

  /* ---------- lytting ---------- */

  function lytt(valg) {
    var matcher = valg.matcher;
    var skalKjore = false;
    var pauset = false;
    var gjeldende = -1;
    var motor = null;
    var dodPaaFeil = false;

    function bygg() {
      var r = new Gjenkjenner();
      r.lang = 'nb-NO';
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 3;

      r.onresult = function (e) {
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (i !== gjeldende) { gjeldende = i; matcher.nyttUtsagn(); }
          var res = e.results[i];
          var fra = matcher.posisjon();
          var best = fra;
          // Alle alternativene prøves, og det som kommer lengst vinner.
          // Gjenkjenneren gjetter ofte riktig på andre forsøk.
          for (var a = 0; a < res.length; a++) {
            matcher.nyttUtsagn();
            var p = matcher.mat(normaliser(res[a].transcript));
            if (p > best) best = p;
          }
          matcher.settPosisjon(best);
          if (best > fra && valg.paaTreff) valg.paaTreff(fra, best);
        }
      };

      r.onerror = function (e) {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          dodPaaFeil = true;
          skalKjore = false;
          if (valg.paaFeil) valg.paaFeil('tillatelse');
        } else if (e.error === 'network') {
          dodPaaFeil = true;
          skalKjore = false;
          if (valg.paaFeil) valg.paaFeil('nett');
        }
      };

      // Safari stopper av seg selv ved stillhet, og et barn som leser, pauser
      // hele tiden. Uten en omstart her ville mikrofonen dødd etter første
      // tenkepause.
      r.onend = function () {
        motor = null;
        if (!skalKjore || pauset) return;
        setTimeout(start, 250);
      };

      return r;
    }

    function start() {
      if (!skalKjore || pauset || motor || dodPaaFeil) return;
      try {
        motor = bygg();
        gjeldende = -1;
        motor.start();
      } catch (f) {
        motor = null;
        setTimeout(function () { if (skalKjore && !pauset) start(); }, 400);
      }
    }

    var styring = {
      i_gang: function () { return skalKjore; },
      begynn: function () {
        if (dodPaaFeil) return;
        skalKjore = true;
        pauset = false;
        aktivLytter = styring;
        start();
      },
      pause: function () {
        pauset = true;
        if (motor) { try { motor.abort(); } catch (f) {} motor = null; }
      },
      fortsett: function () {
        if (!skalKjore || dodPaaFeil) return;
        pauset = false;
        setTimeout(start, 200);
      },
      stopp: function () {
        skalKjore = false;
        pauset = false;
        if (aktivLytter === styring) aktivLytter = null;
        if (motor) { try { motor.abort(); } catch (f) {} motor = null; }
      }
    };

    return styring;
  }

  window.LeseTale = {
    stottes: function () { return !!Gjenkjenner; },
    kanLeseOpp: function () { return !!window.speechSynthesis; },
    normaliser: normaliser,
    forenkle: forenkle,
    lik: lik,
    lagMatcher: lagMatcher,
    lesOpp: lesOpp,
    lytt: lytt
  };
})();
