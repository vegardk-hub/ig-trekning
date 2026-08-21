/*
 * Appen: skjermene, puslespillet, lyden og selve leseøkta.
 *
 * Regelen som styrer alle valgene her: appen kan bekrefte, aldri avvise.
 * Ord blir grønne og blir det for godt. Ingenting blir rødt, ingenting
 * telles feil, og et barn som står fast, kommer alltid videre — trykk på
 * ordet, så leses det opp, og trykk en gang til, så er det grønt. Et ord som
 * ble grønt av et trykk, ser nøyaktig ut som et ord som ble grønt av
 * stemmen. Det er med vilje: talegjenkjenning tar feil ofte nok til at den
 * forskjellen ville blitt en skammekrok.
 */

(function () {
  'use strict';

  var T = window.LeseTekster;
  var TR = window.LeseTrucker;
  var Tale = window.LeseTale;

  var PER_TRUCK = T.PER_TRUCK;

  /* ---------- lyd ---------- */

  // Toner lages på stedet. Ingen lydfiler å laste ned, og appen virker
  // offline uansett hva som skjer med nettet.
  var Lyd = (function () {
    var ctx = null;

    function c() {
      if (!data.lyd) return null;
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (f) { return null; }
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(frekvens, start, lengde, styrke, form) {
      var a = c();
      if (!a) return;
      var o = a.createOscillator(), g = a.createGain();
      o.type = form || 'triangle';
      o.frequency.value = frekvens;
      var t = a.currentTime + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(styrke, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + lengde + 0.05);
    }

    return {
      // Vekk lydkortet på et ekte trykk. iOS gir ingen lyd før det har skjedd.
      vekk: function () { c(); },

      linje: function () {
        tone(660, 0, 0.16, 0.16);
        tone(880, 0.09, 0.2, 0.14);
      },

      ferdig: function () {
        [523, 659, 784, 1047].forEach(function (f, i) {
          tone(f, i * 0.11, 0.34, 0.18);
        });
      },

      // Egen, større fanfare når hele trucken er ferdig. Den skal høres
      // forskjellig fra en vanlig brikke, ellers mister det siste steget alt.
      truck: function () {
        [523, 659, 784, 1047, 1319].forEach(function (f, i) {
          tone(f, i * 0.1, 0.5, 0.2);
        });
        tone(262, 0.5, 0.9, 0.22, 'sawtooth');
      },

      // Motorbrøl: to lave sagtenner som sklir i tonehøyde.
      brum: function () {
        var a = c();
        if (!a) return;
        var t = a.currentTime;
        [52, 78].forEach(function (f, i) {
          var o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter();
          o.type = 'sawtooth';
          lp.type = 'lowpass';
          lp.frequency.value = 900;
          o.frequency.setValueAtTime(f, t);
          o.frequency.linearRampToValueAtTime(f * 2.6, t + 0.35);
          o.frequency.linearRampToValueAtTime(f * 1.2, t + 1.1);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.13 - i * 0.04, t + 0.08);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
          o.connect(lp); lp.connect(g); g.connect(a.destination);
          o.start(t); o.stop(t + 1.4);
        });
      }
    };
  })();

  /* ---------- lagring ---------- */

  var NOKKEL = 'lesing-v1';
  var data = { fullforte: [], lyd: true, store: false, stemme: null, fart: 0.8, alleStemmer: false };

  function last() {
    try {
      var r = localStorage.getItem(NOKKEL);
      if (!r) return;
      var d = JSON.parse(r);
      if (d && Array.isArray(d.fullforte)) data.fullforte = d.fullforte;
      if (d) data.lyd = d.lyd !== false;
      if (d) data.store = d.store === true;
      if (d && typeof d.stemme === 'string') data.stemme = d.stemme;
      if (d && typeof d.fart === 'number') data.fart = d.fart;
      if (d) data.alleStemmer = d.alleStemmer === true;
    } catch (f) {}
  }

  function lagre() {
    try { localStorage.setItem(NOKKEL, JSON.stringify(data)); } catch (f) {}
  }

  /* ---------- utledet stand ---------- */

  // Alt regnes ut av lista over fullførte tekster. Ingenting lagres dobbelt,
  // så det finnes ingen måte for brikketallet og lesehistorikken å komme i
  // utakt med hverandre.
  function antallLest() { return data.fullforte.length; }
  function erLest(id) { return data.fullforte.indexOf(id) >= 0; }

  function nesteIndeks() {
    for (var i = 0; i < T.tekster.length; i++) {
      if (!erLest(T.tekster[i].id)) return i;
    }
    return -1;
  }

  function byggTruck() { return Math.floor(antallLest() / PER_TRUCK); }
  function byggBrikker() { return antallLest() % PER_TRUCK; }

  /* ---------- puslespillet ---------- */

  // Brikkene dukker opp i tilfeldig rekkefølge, ikke fra venstre mot høyre.
  // Det er «hvilken truck er det?» som drar barnet til neste tekst, og et
  // bilde som avdekkes ovenfra og ned røper alt på brikke to.
  // Rekkefølgen er sådd med trucknummeret, så den er den samme hver gang.
  function saaTilfeldig(fro) {
    var s = (fro * 2654435761) % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function brikkerekkefolge(truckIndeks) {
    var r = saaTilfeldig(truckIndeks + 7), a = [0, 1, 2, 3, 4, 5];
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var m = a[i]; a[i] = a[j]; a[j] = m;
    }
    return a;
  }

  function lokkFor(pos) {
    var kolonne = pos % 3, rad = Math.floor(pos / 3);
    var b = 400 / 3, h = 260 / 2;
    return '<rect class="lokk" data-pos="' + pos + '" x="' + (kolonne * b).toFixed(2) +
           '" y="' + (rad * h) + '" width="' + b.toFixed(2) + '" height="' + h + '" rx="6"/>';
  }

  function svgTruck(truckIndeks, antallBrikker, valg) {
    valg = valg || {};
    var ferdig = antallBrikker >= PER_TRUCK;
    var s = '<svg viewBox="' + TR.VISNING + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
            (ferdig ? TR.navn(truckIndeks) : 'Truck under bygging') + '">';
    s += TR.tegn(truckIndeks, { silhuett: !!valg.silhuett });
    if (!ferdig) {
      var orden = brikkerekkefolge(truckIndeks);
      for (var i = antallBrikker; i < PER_TRUCK; i++) s += lokkFor(orden[i]);
    }
    return s + '</svg>';
  }

  /* ---------- skjermer ---------- */

  var skjermer = ['garasje', 'tekstliste', 'lesing', 'innspilling', 'opptak'];

  function vis(navn) {
    skjermer.forEach(function (n) {
      document.getElementById(n).hidden = (n !== navn);
    });
  }

  function e(id) { return document.getElementById(id); }

  /* ---------- garasjen ---------- */

  function tegnGarasje() {
    var truck = byggTruck();
    var brikker = byggBrikker();
    var alleFerdige = truck >= TR.antall;

    var navnFelt = e('bygg-navn');
    var rute = e('rute-bygg');
    var teller = e('bygg-teller');

    if (alleFerdige) {
      navnFelt.textContent = 'Hele samlingen er din';
      rute.innerHTML = svgTruck(TR.antall - 1, PER_TRUCK);
      teller.textContent = 'Alle ' + TR.antall + ' truckene står i garasjen.';
    } else {
      // Navnet holdes skjult til halve trucken er framme. Gjettingen er
      // halve gleden, og et navn øverst røper svaret med én gang.
      navnFelt.textContent = brikker >= 3 ? TR.navn(truck) : 'Hvilken truck blir det?';
      rute.innerHTML = svgTruck(truck, brikker);
      teller.textContent = brikker + ' av ' + PER_TRUCK + ' brikker';
    }

    var liste = e('samling-liste');
    liste.innerHTML = '';
    for (var i = 0; i < truck && i < TR.antall; i++) {
      var kort = document.createElement('button');
      kort.type = 'button';
      kort.className = 'samling-kort';
      kort.dataset.truck = String(i);
      kort.innerHTML = svgTruck(i, PER_TRUCK) + '<span>' + TR.navn(i) + '</span>';
      liste.appendChild(kort);
    }
    e('samling-tom').hidden = truck > 0;

    e('knapp-les').textContent = alleFerdige ? 'Les en tekst om igjen' : 'Les og hent en brikke';
  }

  /* ---------- tekstlista ---------- */

  function tegnListe() {
    var boks = e('liste-innhold');
    boks.innerHTML = '';
    var neste = nesteIndeks();

    T.tekster.forEach(function (tekst, i) {
      if (i % PER_TRUCK === 0) {
        var t = document.createElement('p');
        t.className = 'liste-gruppe';
        var truckIdx = T.truckFor(i);
        // Navnet på en truck barnet ikke har fått ennå, er ikke lista sin sak
        // å røpe.
        t.textContent = truckIdx < byggTruck() ? TR.navn(truckIdx) : 'Truck ' + (truckIdx + 1);
        boks.appendChild(t);
      }

      var lest = erLest(tekst.id);
      var apen = lest || i === neste;
      var rad = document.createElement('button');
      rad.type = 'button';
      rad.className = 'liste-rad' + (lest ? ' klar' : '') + (apen ? '' : ' laast');
      rad.disabled = !apen;
      rad.dataset.tekst = tekst.id;
      rad.innerHTML = '<span class="merke">' + (lest ? '✓' : (apen ? '▸' : '·')) + '</span>' +
                      '<span>' + tekst.tittel + '</span>';
      boks.appendChild(rad);
    });
  }

  /* ---------- leseøkta ---------- */

  var okt = null;

  function startLesing(tekstId) {
    var tekst = T.finn(tekstId);
    if (!tekst) return;

    stoppOkt();

    var ordListe = T.ord(tekst);
    okt = {
      tekst: tekst,
      ord: ordListe,
      spenn: [],
      lest: [],
      linjeFeiret: [],
      hjulpet: -1,
      matcher: Tale.lagMatcher(ordListe.map(function (o) { return o.rå; })),
      lytter: null,
      linjeElementer: [],
      opplesing: null,
      opptak: []
    };

    // Opptakene hentes i bakgrunnen. Rekker de det ikke før høyttaleren
    // trykkes, leser maskinstemmen den gangen – bedre enn å la barnet vente.
    var denne = okt;
    if (Opptak.stottes()) {
      Opptak.forTekst(tekst.id, tekst.linjer.length).then(function (b) {
        if (okt === denne) okt.opptak = b;
      }, function () {});
    }

    e('lese-tittel').textContent = tekst.tittel;
    e('lese-teller').textContent = (T.indeksFor(tekstId) + 1) + '/' + T.tekster.length;

    var flate = e('lese-tekst');
    flate.innerHTML = '';
    var linjer = [];
    tekst.linjer.forEach(function () {
      var p = document.createElement('p');
      p.className = 'linje';
      flate.appendChild(p);
      linjer.push(p);
    });
    okt.linjeElementer = linjer;

    ordListe.forEach(function (o, i) {
      var s = document.createElement('span');
      s.className = 'ord';
      s.textContent = o.rå;
      s.dataset.i = String(i);
      linjer[o.linje].appendChild(s);
      linjer[o.linje].appendChild(document.createTextNode(' '));
      okt.spenn.push(s);
      okt.lest.push(false);
    });
    tekst.linjer.forEach(function () { okt.linjeFeiret.push(false); });

    settStatus(Tale.stottes()
      ? 'Trykk på mikrofonen og les høyt.'
      : 'Mikrofonen virker ikke her. Trykk på ordene for å lese teksten.', false);
    e('knapp-mikrofon').hidden = !Tale.stottes();
    e('knapp-mikrofon').classList.remove('lytter');
    e('knapp-opplesing').hidden = !Tale.kanLeseOpp();
    e('knapp-opplesing').classList.remove('paa');
    settStore(data.store);
    merkNaa();
    vis('lesing');
  }

  /* ---------- store bokstaver ---------- */

  // Blokkbokstaver kommer fra CSS, ikke fra teksten. Skrev vi om selve ordene,
  // ville både matchingen og opplesingen fått versaler å jobbe med, og en
  // stemme som får «ILDKULEN» kan finne på å stave det bokstav for bokstav.
  function settStore(paa) {
    e('lese-tekst').classList.toggle('store', paa);
    var k = e('knapp-store');
    k.classList.toggle('paa', paa);
    e('store-ikon').textContent = paa ? 'aa' : 'AA';
    k.setAttribute('aria-label', paa ? 'Bytt til små bokstaver' : 'Bytt til store bokstaver');
  }

  /* ---------- opplesing av hele teksten ---------- */

  function stoppOpplesing() {
    if (okt && okt.opplesing) { okt.opplesing.stopp(); okt.opplesing = null; }
    var k = e('knapp-opplesing');
    if (k) k.classList.remove('paa');
    if (okt) okt.linjeElementer.forEach(function (p) { p.classList.remove('leses'); });
  }

  // Opplesingen gjør ingenting grønt. Å bli lest for er en annen ting enn å
  // lese selv, og en knapp som farget hele teksten ville gjort brikken til
  // noe man trykker seg til. Barnet leser etterpå — det er hele poenget med
  // å høre teksten først.
  function vekslOpplesing() {
    if (!okt || !Tale.kanLeseOpp()) return;
    Lyd.vekk();

    if (okt.opplesing) {
      stoppOpplesing();
      settStatus('Trykk på mikrofonen og les høyt.', false);
      return;
    }

    e('knapp-opplesing').classList.add('paa');
    settStatus('Hør på teksten. Så kan du lese den selv.', false);

    okt.opplesing = Tale.lesOppLinjer(
      okt.tekst.linjer,
      function (nr) {
        if (!okt) return;
        okt.linjeElementer.forEach(function (p, i) { p.classList.toggle('leses', i === nr); });
      },
      function () {
        if (!okt) return;
        okt.opplesing = null;
        e('knapp-opplesing').classList.remove('paa');
        settStatus('Nå kan du lese den selv.', false);
      },
      function (nr) { return okt && okt.opptak ? okt.opptak[nr] : null; }
    );
  }

  function settStatus(tekst, feil) {
    var s = e('lese-status');
    s.textContent = tekst;
    s.classList.toggle('feil', !!feil);
  }

  function merkNaa() {
    if (!okt) return;
    var p = okt.matcher.posisjon();
    okt.spenn.forEach(function (s, i) { s.classList.toggle('naa', i === p); });
    if (okt.spenn[p] && okt.spenn[p].scrollIntoView) {
      okt.spenn[p].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function markerTil(fra, til) {
    if (!okt) return;
    for (var i = fra; i < til && i < okt.spenn.length; i++) {
      if (okt.lest[i]) continue;
      okt.lest[i] = true;
      okt.spenn[i].classList.add('lest');
    }
    merkNaa();
    sjekkLinjer();
    sjekkFerdig();
  }

  function sjekkLinjer() {
    okt.tekst.linjer.forEach(function (_, li) {
      if (okt.linjeFeiret[li]) return;
      var alle = true;
      for (var i = 0; i < okt.ord.length; i++) {
        if (okt.ord[i].linje === li && !okt.lest[i]) { alle = false; break; }
      }
      if (alle) {
        okt.linjeFeiret[li] = true;
        // Siste linje får bare den store lyden, ikke begge oppå hverandre.
        if (li < okt.tekst.linjer.length - 1) Lyd.linje();
      }
    });
  }

  function sjekkFerdig() {
    for (var i = 0; i < okt.lest.length; i++) if (!okt.lest[i]) return;
    var tekstId = okt.tekst.id;
    stoppOkt();
    fullfor(tekstId);
  }

  function stoppOkt() {
    stoppOpplesing();
    if (okt && okt.lytter) { okt.lytter.stopp(); okt.lytter = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    var m = e('knapp-mikrofon');
    if (m) m.classList.remove('lytter');
  }

  function vekslMikrofon() {
    if (!okt || !Tale.stottes()) return;
    Lyd.vekk();
    // Mikrofon og opplesing kan ikke gå samtidig – da hører appen seg selv.
    stoppOpplesing();

    if (okt.lytter && okt.lytter.i_gang()) {
      okt.lytter.stopp();
      okt.lytter = null;
      e('knapp-mikrofon').classList.remove('lytter');
      settStatus('Trykk på mikrofonen når du vil lese videre.', false);
      return;
    }

    okt.lytter = Tale.lytt({
      matcher: okt.matcher,
      paaTreff: function (fra, til) { markerTil(fra, til); },
      paaFeil: function (grunn) {
        e('knapp-mikrofon').classList.remove('lytter');
        if (grunn === 'tillatelse') {
          settStatus('Appen får ikke bruke mikrofonen. Åpne siden i Safari og si ja til mikrofon.', true);
        } else {
          settStatus('Mikrofonen trenger nett. Du kan lese ved å trykke på ordene.', true);
        }
      }
    });
    okt.lytter.begynn();
    e('knapp-mikrofon').classList.add('lytter');
    settStatus('Les høyt — jeg hører etter.', false);
  }

  // Trykk på et ord: første trykk leser det opp, andre trykk på samme ord
  // slipper det forbi. To trinn, så et tilfeldig strøk over skjermen ikke
  // hopper over halve teksten.
  function trykkOrd(indeks) {
    if (!okt) return;
    Lyd.vekk();
    stoppOpplesing();
    var ord = okt.ord[indeks].rå;

    if (okt.lest[indeks]) { Tale.lesOpp(ord); return; }

    if (okt.hjulpet !== indeks) {
      okt.hjulpet = indeks;
      Tale.lesOpp(ord);
      settStatus('Trykk en gang til på ordet hvis du vil gå videre.', false);
      return;
    }

    okt.hjulpet = -1;
    var fra = okt.matcher.posisjon();
    okt.matcher.settPosisjon(indeks + 1);
    markerTil(Math.min(fra, indeks), indeks + 1);
    settStatus(okt.lytter && okt.lytter.i_gang() ? 'Les høyt — jeg hører etter.' : 'Trykk på mikrofonen og les videre.', false);
  }

  /* ---------- belønning ---------- */

  function fullfor(tekstId) {
    var nytt = !erLest(tekstId);
    if (nytt) {
      data.fullforte.push(tekstId);
      lagre();
    }

    var kort = e('rute-belonning');
    var tittel = e('belonning-tittel');
    var under = e('belonning-under');

    if (!nytt) {
      // Å lese en tekst om igjen er god lesetrening, så det skal føles bra —
      // men det gir ingen ny brikke, ellers ville samme tekst bygd hele bilen.
      Lyd.ferdig();
      tittel.textContent = 'Bra lest!';
      kort.innerHTML = svgTruck(Math.min(byggTruck(), TR.antall - 1), byggTruck() >= TR.antall ? PER_TRUCK : byggBrikker());
      under.textContent = 'Den kunne du fra før. Fin lesing likevel.';
      e('belonning').hidden = false;
      return;
    }

    var n = antallLest();
    var truckFerdig = (n % PER_TRUCK === 0);
    var truckIdx = truckFerdig ? (n / PER_TRUCK - 1) : Math.floor(n / PER_TRUCK);
    var brikker = truckFerdig ? PER_TRUCK : (n % PER_TRUCK);

    // Kortet tegnes med brikken fortsatt på plass, og lokket tas bort et
    // øyeblikk etter. Da ser barnet brikken falle av, i stedet for å få et
    // ferdig bilde servert.
    kort.innerHTML = svgTruck(truckIdx, brikker - 1);
    tittel.textContent = truckFerdig ? 'Ferdig truck!' : 'Bra lest!';
    under.textContent = truckFerdig
      ? 'Du fikk ' + TR.navn(truckIdx) + '. Den står i garasjen nå.'
      : 'Du fikk en ny brikke. ' + (PER_TRUCK - brikker) + ' igjen på denne trucken.';
    e('belonning').hidden = false;

    var orden = brikkerekkefolge(truckIdx);
    var lokk = kort.querySelector('.lokk[data-pos="' + orden[brikker - 1] + '"]');
    setTimeout(function () {
      if (lokk) lokk.classList.add('borte');
      if (truckFerdig) Lyd.truck(); else Lyd.ferdig();
    }, 320);
  }

  /* ---------- truckvisning ---------- */

  var vistTruck = 0;

  function visTruck(i) {
    vistTruck = i;
    e('truck-navn').textContent = TR.navn(i);
    e('rute-visning').innerHTML = svgTruck(i, PER_TRUCK);
    e('truckvisning').hidden = false;
  }

  /* ---------- innspilling av egen stemme ---------- */

  var Opptak = window.LeseOpptak;
  var opptakFor = null;    // tekst-id som er åpen i opptaksskjermen
  var opptaker = null;     // { mr, strom, linje }

  function visInnspilling() {
    e('innstillinger').hidden = true;
    Opptak.tellinger().then(function (tall) {
      var boks = e('innspilling-liste');
      boks.innerHTML = '';
      T.tekster.forEach(function (tekst, i) {
        if (i % PER_TRUCK === 0) {
          var t = document.createElement('p');
          t.className = 'liste-gruppe';
          t.textContent = 'Truck ' + (T.truckFor(i) + 1);
          boks.appendChild(t);
        }
        var har = tall[tekst.id] || 0;
        var alle = har >= tekst.linjer.length;
        var rad = document.createElement('button');
        rad.type = 'button';
        rad.className = 'liste-rad' + (alle ? ' har-opptak' : '');
        rad.dataset.tekst = tekst.id;
        rad.innerHTML = '<span class="merke">' + (alle ? '✓' : '▸') + '</span>' +
                        '<span>' + tekst.tittel + '</span>' +
                        '<span class="status-merke">' + har + '/' + tekst.linjer.length + '</span>';
        boks.appendChild(rad);
      });
      vis('innspilling');
    });
  }

  function visOpptak(tekstId) {
    var tekst = T.finn(tekstId);
    if (!tekst) return;
    opptakFor = tekstId;
    e('opptak-tittel').textContent = tekst.tittel;
    tegnOpptakslinjer();
    vis('opptak');
  }

  function tegnOpptakslinjer() {
    var tekst = T.finn(opptakFor);
    Opptak.forTekst(opptakFor, tekst.linjer.length).then(function (blober) {
      var boks = e('opptak-linjer');
      boks.innerHTML = '';
      tekst.linjer.forEach(function (linje, i) {
        var kort = document.createElement('div');
        kort.className = 'opptak-linje';
        var tar = opptaker && opptaker.linje === i;
        var knapper;
        if (tar) {
          knapper = '<button class="smaaknapp tar-opp" data-stopp="' + i + '">■ Stopp</button>';
        } else if (blober[i]) {
          knapper = '<button class="smaaknapp" data-hor="' + i + '">▶ Hør</button>' +
                    '<button class="smaaknapp" data-ta="' + i + '">● Ta opp på nytt</button>' +
                    '<button class="smaaknapp" data-slett="' + i + '">Slett</button>';
        } else {
          knapper = '<button class="smaaknapp" data-ta="' + i + '">● Spill inn</button>';
        }
        kort.innerHTML = '<p>' + linje + '</p><div class="opptak-knapper">' + knapper + '</div>';
        boks.appendChild(kort);
      });
    });
  }

  function taOpp(linje) {
    if (opptaker) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (strom) {
      var mr = new MediaRecorder(strom);
      var biter = [];
      mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) biter.push(ev.data); };
      mr.onstop = function () {
        // Slipp mikrofonen med en gang. Uten dette blir opptaksmerket stående
        // i statuslinja så lenge siden er åpen.
        strom.getTracks().forEach(function (s) { s.stop(); });
        opptaker = null;
        if (!biter.length) { tegnOpptakslinjer(); return; }
        var type = mr.mimeType || biter[0].type || 'audio/mp4';
        Opptak.lagre(opptakFor, linje, new Blob(biter, { type: type }))
          .then(tegnOpptakslinjer, tegnOpptakslinjer);
      };
      opptaker = { mr: mr, strom: strom, linje: linje };
      mr.start();
      tegnOpptakslinjer();
    }).catch(function () {
      opptaker = null;
      alert('Fikk ikke tilgang til mikrofonen. Åpne siden i Safari og si ja til mikrofon.');
    });
  }

  function stoppOpptaker() {
    if (opptaker && opptaker.mr.state !== 'inactive') opptaker.mr.stop();
    else if (opptaker) { opptaker = null; tegnOpptakslinjer(); }
  }

  /* ---------- innstillinger for stemmen ---------- */

  var PROVESETNING = 'Ildkulen står midt i hallen. Motoren våkner med et brøl.';

  function fyllStemmer() {
    var velger = e('valg-stemme');
    var alle = Tale.alleStemmer();
    var vis = data.alleStemmer ? alle : alle.filter(function (s) { return Tale.erNorsk(s.lang); });

    // Er den valgte stemmen filtrert bort, tas den med likevel – ellers ville
    // velgeren stille byttet stemme bak ryggen på den som valgte den.
    if (data.stemme && !vis.some(function (s) { return s.uri === data.stemme; })) {
      var valgt = alle.filter(function (s) { return s.uri === data.stemme; });
      vis = valgt.concat(vis);
    }

    velger.innerHTML = '';
    if (!vis.length) {
      var tom = document.createElement('option');
      tom.textContent = alle.length ? 'Ingen norske stemmer' : 'Fant ingen stemmer';
      tom.value = '';
      velger.appendChild(tom);
    }
    vis.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.uri;
      o.textContent = s.navn + ' (' + s.lang + ')' + (s.lokal ? '' : ' – nett');
      if (s.uri === data.stemme) o.selected = true;
      velger.appendChild(o);
    });
    if (!data.stemme) {
      var naa = Tale.naavaerendeStemme();
      if (naa) velger.value = naa;
    }

    oppdaterFasit(alle);
  }

  // Fasiten er hele grunnen til at denne skjermen finnes: den viser nøyaktig
  // hva Safari rapporterer på denne iPaden. Personlig stemme fra iOS ligger
  // bak en native tillatelse i AVSpeechSynthesis, og så vidt vi vet slipper
  // ikke Safari den ut til nettsider — men det er bedre å se etter på enheten
  // enn å tro.
  function oppdaterFasit(alle) {
    var norske = alle.filter(function (s) { return Tale.erNorsk(s.lang); }).length;
    var t = 'Safari melder om ' + alle.length + ' stemme' + (alle.length === 1 ? '' : 'r') +
            ' på denne enheten, ' + norske + ' av dem norske.';
    if (alle.length && !data.alleStemmer) {
      t += ' Kryss av over for å se hele lista — er den personlige stemmen din tilgjengelig for nettsider, dukker den opp der, og da kan du velge den.';
    }
    e('stemme-fasit').textContent = t;
  }

  function settFart(f) {
    data.fart = f;
    Tale.settFart(f);
    e('valg-fart').value = String(f);
    e('fart-verdi').textContent = f < 0.7 ? 'Sakte' : (f > 0.95 ? 'Rask' : 'Vanlig');
  }

  function visInnstillinger() {
    Lyd.vekk();
    e('valg-alle').checked = data.alleStemmer;
    settFart(data.fart);
    fyllStemmer();
    e('innstillinger').hidden = false;
    // Første kall til getVoices() er ofte tomt. speak() på et gyldig trykk får
    // iOS til å laste lista, og voiceschanged fyller velgeren rett etterpå.
    if (!Tale.alleStemmer().length) Tale.lesOpp(' ');
  }

  /* ---------- hendelser ---------- */

  function koble() {
    e('knapp-les').addEventListener('click', function () {
      Lyd.vekk();
      var i = nesteIndeks();
      if (i < 0) i = Math.max(0, T.tekster.length - 1);
      startLesing(T.tekster[i].id);
    });

    e('knapp-liste').addEventListener('click', function () {
      tegnListe();
      vis('tekstliste');
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-tilbake]'), function (b) {
      b.addEventListener('click', function () {
        stoppOkt();
        stoppOpptaker();
        Tale.stoppLyd();
        okt = null;
        // Tilbake fra en tekst til innspillingslista: tallene har endret seg,
        // så lista må tegnes på nytt og ikke bare vises igjen.
        if (b.dataset.tilbake === 'innspilling') { visInnspilling(); return; }
        tegnGarasje();
        vis(b.dataset.tilbake);
      });
    });

    e('liste-innhold').addEventListener('click', function (ev) {
      var rad = ev.target.closest ? ev.target.closest('.liste-rad') : null;
      if (rad && rad.dataset.tekst) startLesing(rad.dataset.tekst);
    });

    e('samling-liste').addEventListener('click', function (ev) {
      var kort = ev.target.closest ? ev.target.closest('.samling-kort') : null;
      if (kort) { Lyd.vekk(); visTruck(parseInt(kort.dataset.truck, 10)); }
    });

    e('knapp-mikrofon').addEventListener('click', vekslMikrofon);
    e('knapp-opplesing').addEventListener('click', vekslOpplesing);

    e('knapp-store').addEventListener('click', function () {
      data.store = !data.store;
      lagre();
      settStore(data.store);
    });

    e('lese-tekst').addEventListener('click', function (ev) {
      var s = ev.target.closest ? ev.target.closest('.ord') : null;
      if (s) trykkOrd(parseInt(s.dataset.i, 10));
    });

    e('knapp-videre').addEventListener('click', function () {
      e('belonning').hidden = true;
      okt = null;
      tegnGarasje();
      vis('garasje');
    });

    e('knapp-lukk').addEventListener('click', function () {
      e('truckvisning').hidden = true;
    });

    e('knapp-brum').addEventListener('click', function () { Lyd.brum(); });

    e('knapp-innstillinger').addEventListener('click', visInnstillinger);

    e('knapp-lukk-innstillinger').addEventListener('click', function () {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      e('innstillinger').hidden = true;
    });

    e('valg-stemme').addEventListener('change', function () {
      data.stemme = e('valg-stemme').value || null;
      Tale.settStemme(data.stemme);
      lagre();
      Tale.lesOpp(PROVESETNING);
    });

    e('valg-fart').addEventListener('change', function () {
      settFart(parseFloat(e('valg-fart').value));
      lagre();
      Tale.lesOpp(PROVESETNING);
    });

    e('valg-fart').addEventListener('input', function () {
      settFart(parseFloat(e('valg-fart').value));
    });

    e('valg-alle').addEventListener('change', function () {
      data.alleStemmer = e('valg-alle').checked;
      lagre();
      fyllStemmer();
    });

    e('knapp-prov').addEventListener('click', function () { Tale.lesOpp(PROVESETNING); });

    e('knapp-innspilling').hidden = !Opptak.stottes();
    e('opptak-mangler').hidden = Opptak.stottes();
    e('knapp-innspilling').addEventListener('click', visInnspilling);

    e('innspilling-liste').addEventListener('click', function (ev) {
      var rad = ev.target.closest ? ev.target.closest('.liste-rad') : null;
      if (rad) visOpptak(rad.dataset.tekst);
    });

    e('opptak-linjer').addEventListener('click', function (ev) {
      var k = ev.target.closest ? ev.target.closest('.smaaknapp') : null;
      if (!k) return;
      var d = k.dataset;
      if (d.ta !== undefined) { Tale.stoppLyd(); taOpp(parseInt(d.ta, 10)); }
      else if (d.stopp !== undefined) stoppOpptaker();
      else if (d.hor !== undefined) {
        var nr = parseInt(d.hor, 10);
        var tekst = T.finn(opptakFor);
        Opptak.forTekst(opptakFor, tekst.linjer.length).then(function (b) {
          if (b[nr]) Tale.spillBlob(b[nr], function () {});
        });
      } else if (d.slett !== undefined) {
        Tale.stoppLyd();
        Opptak.slett(opptakFor, parseInt(d.slett, 10)).then(tegnOpptakslinjer);
      }
    });

    // Stemmelista kommer ofte etter at siden er lastet. Står velgeren åpen,
    // skal den fylle seg selv i stedet for å bli stående tom.
    Tale.naarStemmerKommer(function () {
      if (!e('innstillinger').hidden) fyllStemmer();
    });

    e('knapp-lyd').addEventListener('click', function () {
      data.lyd = !data.lyd;
      lagre();
      e('knapp-lyd').textContent = data.lyd ? '🔊' : '🔇';
      if (data.lyd) Lyd.linje();
    });

    // Mikrofonen skal ikke stå på i bakgrunnen når iPaden legges bort.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stoppOkt();
    });
  }

  /* ---------- start ---------- */

  last();
  koble();
  Tale.settStemme(data.stemme);
  Tale.settFart(data.fart);
  e('knapp-lyd').textContent = data.lyd ? '🔊' : '🔇';
  tegnGarasje();
  vis('garasje');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
