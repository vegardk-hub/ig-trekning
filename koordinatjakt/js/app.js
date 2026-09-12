/*
 * Selve appen: binder valgene til generatoren, tegner arket, tar imot svar
 * og viser fasiten.
 *
 * Arket er **ett ark med to måter å svare på**. Det er ikke to moduser med
 * hver sin knapp: på skjermen er svarlinja et skrivefelt, på papiret er den
 * en strek. Samme brett, samme oppgaveliste, samme rekkefølge — så en voksen
 * kan skrive ut arket til ett barn og la det andre skrive på iPaden, uten at
 * de to sitter med hver sin oppgave.
 *
 * Alt som velges ligger i adressen – `#dyrehage/42/12`. Arket skal kunne
 * lages på nytt et halvt år senere, og et brett man har skrevet ut og likt,
 * skal kunne bokmerkes. Brettnummeret er hele hukommelsen til selve bildet.
 *
 * Svarene barnet har klart, ligger derimot i `localStorage`. Et halvferdig
 * ark skal tåle at iPaden låser seg eller at noen trykker på feil fane —
 * ellers begynner barnet forfra på tolv oppgaver det allerede har løst.
 */
'use strict';

(function () {

  var el = {
    tema: document.getElementById('tema'),
    brett: document.getElementById('brett'),
    forrige: document.getElementById('forrige'),
    neste: document.getElementById('neste'),
    antall: document.getElementById('antall'),
    nytt: document.getElementById('nytt'),
    skrivut: document.getElementById('skrivut'),
    visfasit: document.getElementById('visfasit'),
    arktittel: document.getElementById('arktittel'),
    bilde: document.getElementById('bilde'),
    oppgaver: document.getElementById('oppgaver'),
    fremdrift: document.getElementById('fremdrift'),
    lyttemerknad: document.getElementById('lyttemerknad'),
    beskjed: document.getElementById('beskjed'),
    ferdigkort: document.getElementById('ferdigkort'),
    fasit: document.getElementById('fasit'),
    fasittittel: document.getElementById('fasittittel'),
    fasitliste: document.getElementById('fasitliste')
  };

  var MAKS_BRETT = 999;
  var LAGER = 'koordinatjakt-svar-v1';
  var MAKS_LAGREDE_BRETT = 40;

  var naa = { oppgaver: [], nokkel: '', lost: {}, lytter: null };

  // Mikrofonknappene finnes ikke hvis nettleseren ikke kan høre.
  el.lyttemerknad.hidden = Lytting.stottes();

  Temaer.LISTE.forEach(function (t) {
    var o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.navn;
    el.tema.appendChild(o);
  });

  /* ------------------------------------------------------------ adresse */

  function lesAdresse() {
    var biter = (location.hash || '').replace(/^#/, '').split('/');
    var tema = Temaer.IDER.indexOf(biter[0]) >= 0 ? biter[0] : Temaer.IDER[0];
    var brett = parseInt(biter[1], 10);
    var antall = parseInt(biter[2], 10);
    return {
      tema: tema,
      brett: brett >= 1 && brett <= MAKS_BRETT ? brett : 1,
      antall: [8, 12, 16].indexOf(antall) >= 0 ? antall : 12
    };
  }

  function skrivAdresse(v) {
    var ny = '#' + v.tema + '/' + v.brett + '/' + v.antall;
    if (location.hash !== ny) history.replaceState(null, '', ny);
  }

  function verdier() {
    var brett = parseInt(el.brett.value, 10);
    if (!(brett >= 1)) brett = 1;
    if (brett > MAKS_BRETT) brett = MAKS_BRETT;
    return { tema: el.tema.value, brett: brett, antall: parseInt(el.antall.value, 10) };
  }

  /* ------------------------------------------------------------- lagring
     Safari i privat modus kaster på `localStorage`. Et ark som ikke kan
     lagres, skal fortsatt kunne løses – derfor svelges alt her. */

  function lesLager() {
    try { return JSON.parse(localStorage.getItem(LAGER)) || {}; } catch (e) { return {}; }
  }

  function skrivLager(alt) {
    try {
      var nokler = Object.keys(alt);
      // Eldste først: nøklene kommer i den rekkefølgen de ble lagt inn.
      while (nokler.length > MAKS_LAGREDE_BRETT) delete alt[nokler.shift()];
      localStorage.setItem(LAGER, JSON.stringify(alt));
    } catch (e) { /* fullt eller avslått – arket virker likevel */ }
  }

  function lagreSvar(rute, tekst) {
    var alt = lesLager();
    if (!alt[naa.nokkel]) alt[naa.nokkel] = {};
    alt[naa.nokkel][rute] = tekst;
    skrivLager(alt);
  }

  /* -------------------------------------------------------------- arket */

  function tegn() {
    var v = verdier();
    el.brett.value = v.brett;
    skrivAdresse(v);

    var scene = Scene.lag(v.tema, v.brett);
    var tittel = scene.navn + ' – brett ' + scene.brett;

    naa.oppgaver = Oppgaver.lag(scene, v.antall);
    naa.nokkel = v.tema + '/' + v.brett + '/' + v.antall;
    naa.lost = lesLager()[naa.nokkel] || {};

    el.arktittel.textContent = 'Koordinatjakt: ' + tittel;
    el.fasittittel.textContent = 'Fasit – ' + tittel;
    el.bilde.innerHTML = Tegn.svg(scene);

    Lytting.stopp();
    naa.lytter = null;
    el.oppgaver.innerHTML = '';
    el.fasitliste.innerHTML = '';
    el.beskjed.textContent = '';

    naa.oppgaver.forEach(function (o) {
      el.oppgaver.appendChild(lagRad(o));
      el.fasitliste.appendChild(fasitRad(o));
    });

    oppdaterFremdrift();
  }

  function fasitRad(o) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="rute">' + o.rute + '</span>' +
      '<span class="svar">' + o.ord + '</span>';
    return li;
  }

  /* Ett skrivefelt per oppgave.

     Attributtene er ikke pynt, de er iPaden: uten `autocorrect="off"` retter
     iOS «sjiraff» til noe annet mens barnet skriver, og uten `autocapitalize`
     får hvert svar stor forbokstav. `enterkeyhint="next"` gir Enter-tasten
     riktig merkelapp, og 16 px skriftstørrelse er det som hindrer at Safari
     zoomer inn på feltet når det får fokus. */
  function lagRad(o) {
    var li = document.createElement('li');
    li.className = 'oppgave';

    var rute = document.createElement('span');
    rute.className = 'rute';
    rute.textContent = o.rute;

    var felt = document.createElement('input');
    felt.className = 'svarfelt';
    felt.type = 'text';
    felt.setAttribute('autocomplete', 'off');
    felt.setAttribute('autocorrect', 'off');
    felt.setAttribute('autocapitalize', 'none');
    felt.setAttribute('spellcheck', 'false');
    felt.setAttribute('enterkeyhint', 'next');
    felt.setAttribute('aria-label', 'Hva er i ' + o.rute + '?');

    /* Mikrofonen står før hjelpeknappen: den er et alternativ til å skrive,
       ikke en form for hjelp. Et barn som ikke skriver ennå, skal kunne løse
       hele arket med den. */
    var mikrofon = document.createElement('button');
    mikrofon.type = 'button';
    mikrofon.className = 'mikrofon';
    mikrofon.textContent = '🎤';
    mikrofon.setAttribute('aria-label', 'Si svaret for ' + o.rute);
    mikrofon.hidden = !Lytting.stottes();

    var hjelp = document.createElement('button');
    hjelp.type = 'button';
    hjelp.className = 'hjelp';
    hjelp.textContent = '?';
    hjelp.setAttribute('aria-label', 'Hjelp med ' + o.rute);

    var retting = document.createElement('span');
    retting.className = 'retting';

    li.appendChild(rute);
    li.appendChild(felt);
    li.appendChild(mikrofon);
    li.appendChild(hjelp);
    li.appendChild(retting);

    o.el = { li: li, felt: felt, mikrofon: mikrofon, hjelp: hjelp, retting: retting };
    o.hjelpetrinn = 0;

    if (naa.lost[o.rute]) laas(o, naa.lost[o.rute], false);

    felt.addEventListener('input', function () {
      felt.classList.remove('bom');
      el.beskjed.textContent = '';
      // Strengt mens det skrives: ellers låser feltet seg på «elefan».
      if (Svar.godtar(felt.value, o, andre(o), true)) godta(o);
    });
    felt.addEventListener('blur', function () { proev(o, false); });
    felt.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      proev(o, true);
    });
    felt.addEventListener('focus', function () {
      li.scrollIntoView({ block: 'center' });
    });
    hjelp.addEventListener('click', function () { hjelpetrinn(o); });
    mikrofon.addEventListener('click', function () { lyttTil(o); });

    return li;
  }

  // De andre ordene på brettet – brukes bare til å avvise en tvetydig skrivefeil.
  function andre(o) {
    return naa.oppgaver.filter(function (a) { return a.rute !== o.rute; });
  }

  function proev(o, flyttVidere) {
    if (o.el.felt.readOnly) return;
    if (!o.el.felt.value.trim()) return;
    if (Svar.godtar(o.el.felt.value, o, andre(o), false)) {
      godta(o, flyttVidere);
      return;
    }
    /* Ingenting blir rødt, og ingenting sier at barnet tok feil – men det er
       ærlig å si at svaret ikke stemte. Regelen fra Monstergiret om aldri å
       avvise kommer av at talegjenkjenning bommer på barnestemmer; et skrevet
       svar er ikke usikkert på den måten. */
    o.el.felt.classList.add('bom');
    o.el.hjelp.classList.add('tilbud');
    // Ingen naken «?» til slutt: den brekker ned på egen linje og ser ut som en feil.
    el.beskjed.textContent = 'Ikke helt. Se en gang til på ' + o.rute +
      ', eller trykk på hjelpeknappen.';
  }

  function godta(o, flyttVidere) {
    laas(o, o.el.felt.value, true);
    lagreSvar(o.rute, o.el.felt.value);
    el.beskjed.textContent = '';
    oppdaterFremdrift();
    if (flyttVidere !== false) nesteTomme(o);
  }

  /* Barnets egen skrivemåte blir stående – det var svaret, og det ble godtatt.
     Er den ulik fasiten, settes riktig skrivemåte ved siden av i lyst. Det
     lærer stavingen uten å gjøre den til en sperre. */
  function laas(o, tekst, feiring) {
    o.el.felt.value = tekst;
    o.el.felt.readOnly = true;
    o.el.felt.classList.remove('bom');
    o.el.felt.classList.add('riktig');
    o.el.hjelp.classList.remove('tilbud');
    o.el.hjelp.hidden = true;
    o.el.mikrofon.hidden = true;
    o.el.li.classList.add('lost');
    if (feiring) o.el.li.classList.add('nettopp');
    o.el.retting.textContent =
      Svar.normaliser(tekst) === Svar.normaliser(o.ord) ? '' : 'Skrives «' + o.ord + '»';
  }

  function nesteTomme(fra) {
    var start = naa.oppgaver.indexOf(fra);
    for (var i = 1; i <= naa.oppgaver.length; i++) {
      var o = naa.oppgaver[(start + i) % naa.oppgaver.length];
      if (!o.el.felt.readOnly) { o.el.felt.focus(); return; }
    }
  }

  /* Hjelpen har to trinn. Første trinn er et hint og ikke et svar: første
     bokstav og hvor mange bokstaver ordet har. Andre trinn skriver ordet.
     Ingen av dem markerer oppgaven som mislykket – samme premiss som
     «Hopp over» i Sprellemaskinen. */
  function hjelpetrinn(o) {
    if (o.el.felt.readOnly) return;
    o.hjelpetrinn++;
    if (o.hjelpetrinn === 1) {
      var prikker = '';
      for (var i = 1; i < o.ord.length; i++) prikker += ' ·';
      o.el.felt.placeholder = o.ord.charAt(0) + prikker;
      o.el.felt.focus();
      el.beskjed.textContent = o.rute + ' har ' + o.ord.length + ' bokstaver.';
      return;
    }
    /* Ordet skrives inn før det låses. Uten dette ble det som sto i feltet
       – gjerne svaret som nettopp ikke stemte – låst som riktig, og fasiten
       havnet i rettingen ved siden av. */
    o.el.felt.value = o.ord;
    godta(o);
  }

  /* -------------------------------------------------------------- talen
     Her gjelder regelen fra Monstergiret, og den gjelder for alvor:
     **appen kan bekrefte, aldri avvise.** Et nei fra mikrofonen sier
     ingenting om barnet — gjenkjenneren bommer på barnestemmer, og ett ord
     uten setning rundt seg er det vanskeligste den får. Derfor får et talt
     svar som ikke traff, aldri `bom`-rammen eller «ikke helt». Appen
     forteller hva den hørte, og det er en opplysning om mikrofonen, ikke en
     dom over barnet.

     Det er den motsatte avveiningen av det skrevne svaret, og forskjellen er
     hvor usikkerheten ligger: det barnet skrev, står det nøyaktig hva det er. */

  function avsluttLytting() {
    if (!naa.lytter) return;
    naa.lytter.el.li.classList.remove('lytter');
    naa.lytter.el.mikrofon.setAttribute('aria-pressed', 'false');
    naa.lytter = null;
  }

  function lyttTil(o) {
    if (o.el.felt.readOnly) return;
    var samme = naa.lytter === o;
    Lytting.stopp();
    avsluttLytting();
    if (samme) { el.beskjed.textContent = ''; return; }   // andre trykk slår av

    o.el.felt.classList.remove('bom');
    naa.lytter = o;
    o.el.li.classList.add('lytter');
    o.el.mikrofon.setAttribute('aria-pressed', 'true');
    el.beskjed.textContent = 'Si hva som er i ' + o.rute + ' …';

    var startet = Lytting.lytt({
      paaSvar: function (kandidater) {
        if (Svar.godtarTalt(kandidater, o, andre(o))) {
          /* Fasiten skrives inn, ikke det gjenkjenneren fikk til. Den kan ha
             hørt «sjiraf» og blitt godtatt; i feltet skal det stå «sjiraff».
             For et barn som ikke skriver ennå, er det gratis lesetrening. */
          o.el.felt.value = o.ord;
          godta(o);
          return;
        }
        el.beskjed.textContent = kandidater && kandidater.length
          ? 'Jeg hørte «' + kandidater[0] + '». Prøv en gang til, eller skriv ordet.'
          : 'Jeg hørte ingenting. Prøv en gang til.';
      },
      paaFeil: function (kode) {
        el.beskjed.textContent =
          kode === 'nektet' ? 'Mikrofonen er ikke slått på for denne siden.' :
          kode === 'nett' ? 'Innlesing trenger nett. Skriv ordet i stedet.' :
          kode === 'ingenting' ? 'Jeg hørte ingenting. Prøv en gang til.' :
          kode === 'avbrutt' ? '' :
          'Mikrofonen ville ikke. Prøv igjen, eller skriv ordet.';
      },
      paaSlutt: avsluttLytting
    });

    if (!startet) {
      avsluttLytting();
      el.beskjed.textContent = 'Fikk ikke slått på mikrofonen. Skriv ordet i stedet.';
    }
  }

  function oppdaterFremdrift() {
    var lost = naa.oppgaver.filter(function (o) { return o.el.felt.readOnly; }).length;
    var alle = naa.oppgaver.length;
    el.fremdrift.textContent = lost + ' av ' + alle + ' riktig';
    var ferdig = lost === alle && alle > 0;
    el.ferdigkort.hidden = !ferdig;
    if (ferdig) {
      el.ferdigkort.textContent = 'Ferdig! Alle ' + alle + ' rutene er funnet. 🎉';
      el.beskjed.textContent = '';
    }
  }

  /* ------------------------------------------------------------ panelet */

  function sett(v) {
    el.tema.value = v.tema;
    el.brett.value = v.brett;
    el.antall.value = String(v.antall);
    tegn();
  }

  function flytt(steg) {
    var v = verdier();
    var brett = v.brett + steg;
    if (brett < 1) brett = MAKS_BRETT;
    if (brett > MAKS_BRETT) brett = 1;
    el.brett.value = brett;
    tegn();
  }

  el.tema.addEventListener('change', tegn);
  el.antall.addEventListener('change', tegn);
  /* Bare `change`, ikke `input`: tegner vi på hvert tastetrykk, må feltet
     normaliseres underveis, og da kan det ikke tømmes for å skrives om –
     «1» dukker opp igjen i det man sletter siffer nummer to. */
  el.brett.addEventListener('change', tegn);
  el.forrige.addEventListener('click', function () { flytt(-1); });
  el.neste.addEventListener('click', function () { flytt(1); });

  /* Nytt brett er det eneste stedet ekte tilfeldighet hører hjemme:
     generatoren skal alltid være sådd, men valget av såkorn er fritt. */
  el.nytt.addEventListener('click', function () {
    el.brett.value = 1 + Math.floor(Math.random() * MAKS_BRETT);
    tegn();
  });

  el.visfasit.addEventListener('change', function () {
    el.fasit.hidden = !el.visfasit.checked;
  });

  el.skrivut.addEventListener('click', function () { window.print(); });

  // Piltastene bytter brett så lenge man ikke står i et skrivefelt.
  document.addEventListener('keydown', function (e) {
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') flytt(-1);
    if (e.key === 'ArrowRight') flytt(1);
  });

  window.addEventListener('hashchange', function () { sett(lesAdresse()); });

  sett(lesAdresse());
})();
