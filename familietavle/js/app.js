/*
 * Selve tavla: henter datafila, dekrypterer, og tegner dagen.
 *
 * Tavla er en **visning, ikke et redigeringsverktøy**. Alt legges inn fra
 * telefonen i Kalender-appen – avtaler i hver sin kalender, middagen i
 * «Middag», bursdagene i «Bursdager» – og tavla leser. Det er ikke latskap:
 * det de ferdige veggkalenderne får mest kritikk for, er synk som henger og
 * et tregt grensesnitt å taste i. En tavle uten redigering har ingen av delene,
 * og det finnes bare ett sted dataene kan være feil.
 *
 * Dataene kommer fra en kryptert fil på grenen `familietavle-data`, som
 * synk-jobben i GitHub Actions skriver hvert kvarter (se `synk/synk.js`).
 * GitHubs timer er «best effort» og kan henge etter, så tavla sier fra i
 * bunnlinja når fila er gammel, i stedet for å late som den er fersk.
 */
'use strict';

(function () {

  var DATA = 'https://raw.githubusercontent.com/vegardk-hub/ig-trekning/familietavle-data/tavle.json';
  var LAGER = 'familietavle.passfrase';
  var FARGER = ['#5aa9e6', '#f28f6b', '#7bd389', '#c79bf2', '#f2c14e', '#4ec3ae', '#f07fa8', '#b8c46a'];
  var DAG = 86400000;
  var GAMMEL = 2 * 3600000;        // så lenge før bunnlinja sier fra
  var NATT = [23, 6];              // svart fra 23 til 6

  var param = new URLSearchParams(location.search);
  var demo = param.has('demo');
  var dataUrl = param.get('data') || DATA;

  var el = {};
  ['tavle', 'tid', 'dato', 'tomming', 'vaer', 'innhold', 'side', 'middagKort', 'bursdagKort',
    'idag', 'neste', 'middag', 'bursdager',
    'personer', 'status', 'meny', 'oppsett', 'oppsettSkjema', 'passfrase', 'oppsettMelding',
    'glem', 'natt'].forEach(function (id) { el[id] = document.getElementById(id); });

  var st = {
    pakke: null,          // den krypterte fila sist vi så den
    data: null,           // dekryptert innhold
    kalendere: [],        // [{ navn, rolle, farge, hendelser }]
    vaer: null,           // direkte fra MET
    vaerTid: 0,
    feil: '',
    vekketTil: 0,
    iOppsett: false       // ⋯ er trykket: ikke tegn tavla over skjemaet
  };

  // ---- Småhjelp ----------------------------------------------------------

  function lagre(nokkel, verdi) {
    try {
      if (verdi === null) localStorage.removeItem(nokkel); else localStorage.setItem(nokkel, verdi);
    } catch (e) { /* privat modus o.l. – tavla virker, men spør på nytt */ }
  }

  function hent(nokkel) {
    try { return localStorage.getItem(nokkel); } catch (e) { return null; }
  }

  function lag(tag, klasse, tekst) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (tekst !== undefined) e.textContent = tekst;
    return e;
  }

  function to(n) { return (n < 10 ? '0' : '') + n; }
  function kl(d) { return to(d.getHours()) + ':' + to(d.getMinutes()); }
  function midnatt(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function pluss(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  var UKEDAG = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  var KORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  var MND = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august',
    'september', 'oktober', 'november', 'desember'];

  function ukenr(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAG + 1) / 7);
  }

  function siden(ms) {
    var min = Math.round(ms / 60000);
    if (min < 60) return min + ' min';
    var t = Math.round(min / 60);
    return t < 48 ? t + ' t' : Math.round(t / 24) + ' døgn';
  }

  // ---- Data --------------------------------------------------------------

  // Personene får fargen kalenderen har på iPhone, så Ellas avtaler er grønne
  // både på veggen og i lomma. Men standardkalenderen har samme farge hos alle
  // som aldri har endret den, og to personer i samme blåfarge er verre enn
  // ingen farger. Den som kommer sist, får da en ledig farge fra paletten.
  function taIBruk(data) {
    st.data = data;
    var brukt = [];
    st.kalendere = data.kalendere.map(function (k) {
      var lest = Kalender.les(k.ics);
      var farge = '';
      if (k.rolle === 'person') {
        farge = lest.farge && brukt.indexOf(lest.farge) < 0 ? lest.farge
          : FARGER.filter(function (f) { return brukt.indexOf(f) < 0; })[0] || FARGER[brukt.length % FARGER.length];
        brukt.push(farge);
      }
      return { navn: k.navn, rolle: k.rolle, farge: farge, hendelser: lest.hendelser };
    });
  }

  function hentData() {
    if (demo) {
      taIBruk(Demo.pakke(new Date()));
      return Promise.resolve();
    }
    var passfrase = hent(LAGER);
    if (!passfrase) { visOppsett(''); return Promise.resolve(); }
    return fetch(dataUrl, { cache: 'no-cache' }).then(function (svar) {
      if (svar.status === 404) throw new Error('ingen-data');
      if (!svar.ok) throw new Error('HTTP ' + svar.status);
      return svar.json();
    }).then(function (pakke) {
      if (st.pakke && st.pakke.data === pakke.data) return;
      return Krypto.dekrypter(pakke, passfrase).then(function (tekst) {
        st.pakke = pakke;
        taIBruk(JSON.parse(tekst));
        st.feil = '';
      }, function () {
        throw new Error('passfrase');
      });
    }).catch(function (e) {
      if (e.message === 'passfrase' && !st.data) {
        visOppsett('Passfrasen stemmer ikke med datafila.');
      } else if (e.message === 'ingen-data' && !st.data) {
        visOppsett('Fant ingen datafil ennå. Har synk-jobben i GitHub Actions kjørt?');
      } else {
        st.feil = e.message === 'passfrase' ? 'Passfrasen er endret – trykk ⋯' : 'Fikk ikke hentet kalenderen';
      }
    });
  }

  function hentVaer() {
    return fetch(Vaer.URL).then(function (svar) {
      if (!svar.ok) throw new Error('HTTP ' + svar.status);
      return svar.json();
    }).then(function (v) {
      st.vaer = v;
      st.vaerTid = Date.now();
    }).catch(function () { /* faller tilbake på kopien i datafila */ });
  }

  function vaerdata() {
    if (st.vaer && Date.now() - st.vaerTid < 3 * 3600000) return st.vaer;
    return st.data && st.data.vaer;
  }

  // Alle forekomster i et tidsrom, merket med kalenderen de kom fra.
  //
  // En avtale flere er invitert til, ligger i hver sin kalender med samme UID.
  // Den vises én gang, med alle navnene – det ferdige veggskjermer får mest
  // kritikk for etter synkfeil, er den samme avtalen tre–fire ganger.
  function hendelser(rolle, fra, til) {
    var ut = [], sett = {};
    st.kalendere.forEach(function (k) {
      if (k.rolle !== rolle) return;
      Kalender.forekomster(k.hendelser, fra, til).forEach(function (f) {
        var nokkel = f.uid ? f.uid + '|' + f.start.getTime() : '';
        if (nokkel && sett[nokkel]) {
          if (sett[nokkel].kalendere.indexOf(k) < 0) sett[nokkel].kalendere.push(k);
          return;
        }
        f.kalender = k;
        f.kalendere = [k];
        if (nokkel) sett[nokkel] = f;
        ut.push(f);
      });
    });
    ut.sort(function (a, b) {
      return (b.heldag - a.heldag) || (a.start - b.start) || a.tittel.localeCompare(b.tittel, 'nb');
    });
    return ut;
  }

  // ---- Tegning -----------------------------------------------------------

  // Fjerner linjer nedenfra til kortet ikke lenger klipper, og sier hvor mange
  // som ble borte. En linje som er halvt synlig nederst, er verre enn ingen:
  // den ser ut som en feil, og den forteller ikke at det finnes mer.
  function kapp(kort, liste, velger, tag) {
    var skjult = 0, flere = null;
    while (kort.scrollHeight > kort.clientHeight + 1) {
      var linjer = liste.querySelectorAll(velger);
      if (!linjer.length) break;
      linjer[linjer.length - 1].remove();
      skjult++;
      if (!flere) { flere = lag(tag, 'flere'); liste.appendChild(flere); }
      flere.textContent = '+ ' + skjult + ' til';
    }
  }

  function tegn() {
    if (!st.data || st.iOppsett) return;
    var naa = new Date();
    var idag = midnatt(naa);
    el.tavle.hidden = false;
    el.oppsett.hidden = true;

    el.tid.textContent = kl(naa);
    el.dato.textContent = UKEDAG[naa.getDay()] + ' ' + naa.getDate() + '. ' + MND[naa.getMonth()] +
      ' · uke ' + ukenr(naa);

    // Middag og bursdager vises bare når kalenderen finnes. Uten dem får
    // dagen og uka hele bredden.
    var harMiddag = st.kalendere.some(function (k) { return k.rolle === 'middag'; });
    var harBursdager = st.kalendere.some(function (k) { return k.rolle === 'bursdager'; });
    el.middagKort.hidden = !harMiddag;
    el.bursdagKort.hidden = !harBursdager;
    el.side.hidden = !harMiddag && !harBursdager;
    el.innhold.classList.toggle('med-side', !el.side.hidden);

    tegnVaer(naa);
    tegnTomming(idag);
    tegnIdag(naa, idag);
    tegnNeste(idag);
    if (harMiddag) tegnMiddag(idag);
    if (harBursdager) tegnBursdager(idag);
    tegnBunn(naa);
    tegnNatt(naa);
  }

  function ikon(symbol) {
    var i = lag('img');
    i.alt = Vaer.tekst(symbol);
    if (symbol) i.src = 'vaer/' + symbol + '.svg';
    return i;
  }

  function grader(t) { return Math.round(t) + '°'; }

  function tegnVaer(naa) {
    var v = vaerdata();
    el.vaer.textContent = '';
    var n = v && Vaer.naa(v, naa);
    if (!n) { el.vaer.appendChild(lag('div', 'tomt', 'Ingen værdata')); return; }

    var blokk = lag('div', 'vaer-naa');
    blokk.appendChild(ikon(n.symbol));
    var tekst = lag('div');
    tekst.appendChild(lag('div', 'vaer-temp' + (n.temp < 0 ? ' minus' : ''), grader(n.temp)));
    var linje = Vaer.tekst(n.symbol) || Vaer.STED.navn;
    if (n.nedbor) linje += ' · ' + String(n.nedbor).replace('.', ',') + ' mm';
    tekst.appendChild(lag('div', 'vaer-tekst', linje));
    blokk.appendChild(tekst);
    el.vaer.appendChild(blokk);

    var rekke = lag('div', 'vaer-rekke');
    Vaer.timer(v, naa, 3, 3).forEach(function (t) {
      var c = lag('div', 'vaer-liten');
      c.appendChild(lag('div', 'naar', 'kl ' + t.tid.getHours()));
      c.appendChild(ikon(t.symbol));
      c.appendChild(lag('div', 'temp' + (t.temp < 0 ? ' minus' : ''), grader(t.temp)));
      rekke.appendChild(c);
    });
    Vaer.dager(v, naa, 3).forEach(function (d) {
      var c = lag('div', 'vaer-liten');
      c.appendChild(lag('div', 'naar', KORT[d.dato.getDay()]));
      c.appendChild(ikon(d.symbol));
      var t = lag('div', 'temp' + (d.maks < 0 ? ' minus' : ''), grader(d.maks));
      t.appendChild(lag('span', 'lav', ' ' + grader(d.min)));
      c.appendChild(t);
      rekke.appendChild(c);
    });
    el.vaer.appendChild(rekke);
  }

  // Én farge per person i kanten; en felles avtale får en stripe per person.
  function farget(e, f) {
    var farger = f.kalendere.map(function (k) { return k.farge; }).filter(Boolean);
    if (!farger.length) return e;
    e.style.setProperty('--farge', farger[0]);
    if (farger.length > 1) {
      var del = 100 / farger.length;
      e.style.borderImage = 'linear-gradient(' + farger.map(function (c, i) {
        return c + ' ' + (i * del) + '% ' + ((i + 1) * del) + '%';
      }).join(', ') + ') 1';
    }
    return e;
  }

  // Dagen i én kolonne per person. Det tavla skal svare på, er «hvem har hva
  // i dag, og hvem henter» – og det leses raskest når hver person har sin
  // egen stripe, ikke når alt står i én tidslinje som må leses navn for navn.
  // En felles avtale står i kolonnen til hver av dem den gjelder.
  function tegnIdag(naa, idag) {
    el.idag.textContent = '';
    var personer = st.kalendere.filter(function (k) { return k.rolle === 'person'; });
    personer.forEach(function (k) {
      var kol = lag('div', 'personkol');
      kol.style.setProperty('--farge', k.farge);
      kol.appendChild(lag('h3', '', k.navn));
      var liste = lag('ul', 'avtaler');
      var alle = Kalender.forekomster(k.hendelser, idag, pluss(idag, 1));
      alle.sort(function (a, b) { return (b.heldag - a.heldag) || (a.start - b.start); });
      if (!alle.length) liste.appendChild(lag('li', 'tomt', '–'));
      alle.forEach(function (f) {
        if (f.heldag) { liste.appendChild(lag('li', 'merke', f.tittel)); return; }
        var li = lag('li', 'avtale');
        if (f.slutt <= naa && f.slutt > f.start) li.classList.add('forbi');
        else if (f.start <= naa && naa < f.slutt) li.classList.add('pagar');
        // En avtale som begynte i går (over midnatt), står som «–» til den slutter.
        li.appendChild(lag('span', 'kl', f.start < idag ? '–' + kl(f.slutt) : kl(f.start)));
        li.appendChild(lag('span', 'hva', f.tittel));
        liste.appendChild(li);
      });
      kol.appendChild(liste);
      el.idag.appendChild(kol);
      // Er dagen for full, går det som er over først – det er det ingen trenger.
      while (kol.scrollHeight > kol.clientHeight + 1) {
        var forbi = liste.querySelector('.forbi');
        if (!forbi) break;
        forbi.remove();
      }
      kapp(kol, liste, '.avtale, .merke', 'li');
    });
    el.idag.style.setProperty('--antall', Math.max(1, personer.length));
  }

  // Neste tømming, fra kalenderen «Søppel». Bærum tømmer etter faste
  // intervaller, så tre gjentakende hendelser holder – ingen API å hente fra.
  function tegnTomming(idag) {
    var alle = hendelser('tomming', idag, pluss(idag, 8));
    if (!alle.length) { el.tomming.hidden = true; return; }
    var dag = midnatt(alle[0].start);
    var samme = alle.filter(function (f) { return midnatt(f.start).getTime() === dag.getTime(); })
      .map(function (f) { return f.tittel; });
    var om = Math.round((dag - idag) / DAG);
    var naar = om === 0 ? 'i dag' : om === 1 ? 'i morgen' : UKEDAG[dag.getDay()];
    el.tomming.textContent = 'Søppel ' + naar + ': ' + samme.join(', ');
    el.tomming.classList.toggle('snart', om <= 1);
    el.tomming.hidden = false;
  }

  function tegnNeste(idag) {
    el.neste.textContent = '';
    for (var i = 1; i <= 6; i++) {
      var dag = pluss(idag, i);
      var alle = hendelser('person', dag, pluss(dag, 1));
      var boks = lag('div', 'dag');
      var h = lag('h3', '', i === 1 ? 'I morgen ' : UKEDAG[dag.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ');
      h.appendChild(lag('span', 'lite', dag.getDate() + '.' + (i === 1 ? ' ' + KORT[dag.getDay()] : '')));
      boks.appendChild(h);
      if (!alle.length) boks.appendChild(lag('div', 'tomt', '–'));
      alle.forEach(function (f) {
        if (f.heldag) { boks.appendChild(farget(lag('div', 'hel', f.tittel), f)); return; }
        var l = farget(lag('div', 'linje'), f);
        // Begynte den før denne dagen (nattevakt), er det slutten som teller.
        l.appendChild(lag('span', 'kl', f.start < dag ? '–' + kl(f.slutt) : kl(f.start)));
        l.appendChild(lag('span', '', f.tittel));
        boks.appendChild(l);
      });
      el.neste.appendChild(boks);
      kapp(boks, boks, '.linje, .hel', 'div');
    }
  }

  function tegnMiddag(idag) {
    el.middag.textContent = '';
    var alle = hendelser('middag', idag, pluss(idag, 7));
    for (var i = 0; i < 7; i++) {
      var dag = pluss(idag, i);
      var hva = alle.filter(function (f) {
        return f.start < pluss(dag, 1) && f.slutt > dag;
      }).map(function (f) { return f.tittel; }).join(', ');
      var li = lag('li', i === 0 ? 'idag' : '');
      li.appendChild(lag('span', 'naar', i === 0 ? 'I dag' : KORT[dag.getDay()]));
      li.appendChild(lag('span', 'hva' + (hva ? '' : ' ingen'), hva || '–'));
      el.middag.appendChild(li);
    }
  }

  function tegnBursdager(idag) {
    el.bursdager.textContent = '';
    var alle = hendelser('bursdager', idag, pluss(idag, 60));
    if (!alle.length) el.bursdager.appendChild(lag('li', 'tomt', 'Ingen de neste to månedene.'));
    alle.slice(0, 5).forEach(function (f) {
      var dager = Math.round((midnatt(f.start) - idag) / DAG);
      var li = lag('li', dager === 0 ? 'bursdag-idag' : '');
      li.appendChild(lag('span', 'naar', dager === 0 ? 'I dag' : f.start.getDate() + '.' + (f.start.getMonth() + 1) + '.'));
      // Alderen regnes bare når hendelsen er lagt på fødselsdatoen, altså
      // et år før i år. Se README.
      var fodt = f.forste.getFullYear();
      var alder = fodt > 1900 && fodt < f.start.getFullYear() ? f.start.getFullYear() - fodt : 0;
      li.appendChild(lag('span', 'hva', f.tittel + (alder ? ' ' + (dager === 0 ? 'fyller ' : 'blir ') + alder : '')));
      if (dager > 0) li.appendChild(lag('span', 'om', dager === 1 ? 'i morgen' : 'om ' + dager + ' d'));
      el.bursdager.appendChild(li);
    });
    kapp(el.bursdager.parentNode, el.bursdager, 'li:not(.flere)', 'li');
  }

  function tegnBunn(naa) {
    el.personer.textContent = '';
    st.kalendere.forEach(function (k) {
      if (k.rolle !== 'person') return;
      var p = lag('span', 'person', k.navn);
      p.style.setProperty('--farge', k.farge);
      el.personer.appendChild(p);
    });
    var hentet = new Date(st.data.hentet);
    var alder = naa - hentet;
    var tekst = demo ? 'Eksempel – oppdiktet familie' : 'Kalender hentet ' + kl(hentet);
    if (!demo && alder > GAMMEL) tekst = 'Kalenderen ble sist hentet for ' + siden(alder) + ' siden';
    if (st.feil) tekst = st.feil + ' · ' + tekst;
    el.status.textContent = tekst;
    el.status.classList.toggle('gammel', !demo && (alder > GAMMEL || !!st.feil));
  }

  function tegnNatt(naa) {
    var t = naa.getHours();
    var natt = (t >= NATT[0] || t < NATT[1]) && Date.now() > st.vekketTil;
    el.natt.hidden = !natt;
  }

  // ---- Oppsett -----------------------------------------------------------

  function visOppsett(melding) {
    el.tavle.hidden = true;
    el.oppsett.hidden = false;
    el.oppsettMelding.textContent = melding || '';
    el.glem.hidden = !hent(LAGER);
  }

  el.oppsettSkjema.addEventListener('submit', function (e) {
    e.preventDefault();
    var p = el.passfrase.value.trim();
    if (!p) return;
    lagre(LAGER, p);
    st.iOppsett = false;
    el.passfrase.value = '';
    el.oppsettMelding.textContent = 'Henter …';
    st.pakke = null;
    st.data = null;
    oppdater();
  });

  el.glem.addEventListener('click', function () {
    lagre(LAGER, null);
    location.href = location.pathname;
  });

  el.meny.addEventListener('click', function () {
    if (demo) { location.href = location.pathname; return; }
    st.iOppsett = true;
    visOppsett('');
  });

  // ---- Våken skjerm og natt ---------------------------------------------

  var vakt = null;
  function holdVaaken() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || vakt) return;
    navigator.wakeLock.request('screen').then(function (v) {
      vakt = v;
      v.addEventListener('release', function () { vakt = null; });
    }).catch(function () { /* lavt batteri eller ikke støttet */ });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { holdVaaken(); oppdater(); }
  });

  document.addEventListener('pointerdown', function () {
    holdVaaken();
    if (!el.natt.hidden) { st.vekketTil = Date.now() + 2 * 60000; el.natt.hidden = true; }
  });

  // ---- Takten ------------------------------------------------------------

  function oppdater() {
    return Promise.all([hentData(), hentVaer()]).then(tegn);
  }

  var startdag = new Date().getDate();
  setInterval(function () {
    var naa = new Date();
    // En gang i døgnet lastes hele sida på nytt, så ny kode fra main kommer
    // fram uten at noen må røre nettbrettet.
    if (naa.getDate() !== startdag && naa.getHours() >= 4) { location.reload(); return; }
    tegn();
  }, 20000);
  setInterval(hentData, 5 * 60000);
  setInterval(hentVaer, 30 * 60000);

  holdVaaken();
  oppdater();
})();
