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
    'idag', 'neste', 'middag', 'bursdager', 'lekserKnapp', 'lekser', 'lekserTittel', 'lekserBarn',
    'lekserStatus', 'lekserLukk', 'lekserUke', 'lekserDager', 'konfetti',
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
    iOppsett: false,      // ⋯ er trykket: ikke tegn tavla over skjemaet
    planer: [],           // [{ navn, person, plan }] fra «Ukeplan <barn>»
    lekserBarn: '',       // barnet leksefanen viser
    lekserSist: 0         // siste trykk i leksefanen
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

    // Ukeplanene: én hendelse per uke i «Ukeplan <barn>», med planen i
    // notatfeltet. Barnet finnes ved navn blant personkalendrene.
    st.planer = [];
    var idag = midnatt(new Date());
    st.kalendere.filter(function (k) { return k.rolle === 'ukeplan'; }).forEach(function (k) {
      var navn = k.navn.replace(/^ukeplan\s+/i, '').trim();
      var person = st.kalendere.filter(function (p) {
        return p.rolle === 'person' && p.navn.toLowerCase() === navn.toLowerCase();
      })[0] || null;
      // Et barn uten egen kalender får likevel en kolonne – ellers har
      // skolehendelsene ingen plass å stå. Den får en ledig farge.
      if (!person) {
        var brukte = st.kalendere.map(function (p) { return p.farge; });
        person = { navn: navn, rolle: 'person', hendelser: [],
          farge: FARGER.filter(function (f) { return brukte.indexOf(f) < 0; })[0] || FARGER[0] };
        st.kalendere.push(person);
      }
      Kalender.forekomster(k.hendelser, pluss(idag, -35), pluss(idag, 35)).forEach(function (f) {
        if (f.beskrivelse) st.planer.push({ navn: person.navn, person: person, plan: Ukeplan.les(f.beskrivelse, f.start) });
      });
    });
  }

  // Skolehendelsene fra ukeplanene, i samme form som kalenderforekomstene.
  function planHendelser(person, fra, til) {
    var ut = [];
    st.planer.forEach(function (p) {
      if (!p.person || (person && p.person !== person)) return;
      p.plan.hendelser.forEach(function (h) {
        if (h.start >= til || h.slutt <= fra) return;
        ut.push({ start: h.start, slutt: h.slutt, heldag: h.heldag, tittel: h.tittel, sted: '', uid: '',
          kalender: p.person, kalendere: [p.person] });
      });
    });
    return ut;
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
    if (rolle === 'person') ut = ut.concat(planHendelser(null, fra, til));
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
    var barn = barnMedLekser(idag);
    el.lekserKnapp.hidden = !barn.length;
    if (!el.lekser.hidden) {
      // Står fanen åpen uten at noen rører den, går tavla tilbake av seg selv.
      if (Date.now() - st.lekserSist > 3 * 60000) lukkLekser(); else tegnLekser();
    }
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
      var dagens = lekserFor(k.navn, idag);
      if (dagens.length) {
        var gjort = dagens.filter(erGjort).length;
        var knapp = lag('button', 'leksemerke' + (gjort === dagens.length ? ' ferdig' : ''),
          gjort === dagens.length ? 'Lekser gjort' : 'Lekser ' + gjort + ' av ' + dagens.length);
        knapp.type = 'button';
        knapp.addEventListener('click', function () { aapneLekser(k.navn); });
        kol.appendChild(knapp);
      }
      var liste = lag('ul', 'avtaler');
      var alle = Kalender.forekomster(k.hendelser, idag, pluss(idag, 1)).concat(planHendelser(k, idag, pluss(idag, 1)));
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

  // ---- Lekser -------------------------------------------------------------
  //
  // Leksefanen er det eneste på tavla man trykker på, og den er for barna.
  // Avkrysningen lagres på nettbrettet, ikke i kalenderen: den gjelder bare her,
  // og et barn som krysser av, skal ikke kunne endre noe foreldrene har lagt inn.
  // Feiringen er liten og peker bare oppover – ingenting markerer en lekse som
  // ikke er gjort, samme premiss som i Poengtavla og Fargeflasker.

  var LEKSER = 'familietavle.lekser';

  function lekseliste() {
    try { return JSON.parse(hent(LEKSER) || '{}') || {}; } catch (e) { return {}; }
  }

  function iso(d) { return d.getFullYear() + '-' + to(d.getMonth() + 1) + '-' + to(d.getDate()); }

  function nokkelFor(l) { return l.navn + '|' + l.uke + '|' + l.dag + '|' + l.tekst; }

  function erGjort(l) { return !!lekseliste()[nokkelFor(l)]; }

  function settGjort(l, gjort) {
    var alle = lekseliste();
    if (gjort) alle[nokkelFor(l)] = Date.now(); else delete alle[nokkelFor(l)];
    // Rydd bort det som er eldre enn åtte uker, så lista ikke vokser for alltid.
    var grense = Date.now() - 56 * DAG;
    Object.keys(alle).forEach(function (k) { if (alle[k] < grense) delete alle[k]; });
    lagre(LEKSER, JSON.stringify(alle));
  }

  // Planene for uka `dag` ligger i, for ett barn.
  function planerFor(navn, dag) {
    var mandag = Ukeplan.mandagI(dag).getTime();
    return st.planer.filter(function (p) {
      return p.navn === navn && p.plan.mandag.getTime() === mandag;
    });
  }

  function lekserFor(navn, dag) {
    var ut = [];
    planerFor(navn, dag).forEach(function (p) {
      p.plan.lekser.forEach(function (l) {
        if (l.dag.getTime() === midnatt(dag).getTime()) {
          ut.push({ navn: navn, uke: iso(p.plan.mandag), dag: iso(l.dag), tekst: l.tekst });
        }
      });
    });
    return ut;
  }

  function barnMedLekser(idag) {
    var navn = [];
    st.planer.forEach(function (p) {
      if (p.plan.mandag.getTime() === Ukeplan.mandagI(idag).getTime() &&
          (p.plan.lekser.length || p.plan.ukelekser.length) && navn.indexOf(p.navn) < 0) navn.push(p.navn);
    });
    return navn;
  }

  function aapneLekser(navn) {
    var barn = barnMedLekser(midnatt(new Date()));
    st.lekserBarn = navn && barn.indexOf(navn) >= 0 ? navn : (barn.indexOf(st.lekserBarn) >= 0 ? st.lekserBarn : barn[0]);
    st.lekserSist = Date.now();
    el.lekser.hidden = false;
    tegnLekser();
  }

  function lukkLekser() {
    el.lekser.hidden = true;
  }

  function lekseKort(l, tekst, idag) {
    var b = lag('button', 'lekse');
    b.type = 'button';
    var gjort = erGjort(l);
    b.classList.toggle('gjort', gjort);
    b.setAttribute('aria-pressed', gjort ? 'true' : 'false');
    b.appendChild(lag('span', 'hake', '✓'));
    b.appendChild(lag('span', 'lekse-tekst', tekst));
    b.addEventListener('click', function (e) {
      st.lekserSist = Date.now();
      var na = !erGjort(l);
      settGjort(l, na);
      if (na) feir(e.clientX, e.clientY);
      tegnLekser();
      tegn();
    });
    return b;
  }

  function tegnLekser() {
    var idag = midnatt(new Date());
    var barn = barnMedLekser(idag);
    if (!barn.length) { lukkLekser(); return; }
    if (barn.indexOf(st.lekserBarn) < 0) st.lekserBarn = barn[0];
    var navn = st.lekserBarn;
    var person = st.kalendere.filter(function (k) { return k.rolle === 'person' && k.navn === navn; })[0];
    el.lekser.style.setProperty('--farge', person ? person.farge : 'var(--aksent)');
    el.lekserTittel.textContent = 'Lekser uke ' + ukenr(idag);

    el.lekserBarn.textContent = '';
    if (barn.length > 1) {
      barn.forEach(function (n) {
        var f = lag('button', 'fane' + (n === navn ? ' valgt' : ''), n);
        f.type = 'button';
        f.setAttribute('role', 'tab');
        f.setAttribute('aria-selected', n === navn ? 'true' : 'false');
        var p = st.kalendere.filter(function (k) { return k.rolle === 'person' && k.navn === n; })[0];
        if (p) f.style.setProperty('--farge', p.farge);
        f.addEventListener('click', function () { st.lekserBarn = n; st.lekserSist = Date.now(); tegnLekser(); });
        el.lekserBarn.appendChild(f);
      });
    } else {
      el.lekserBarn.appendChild(lag('span', 'fane valgt', navn));
    }

    var planer = planerFor(navn, idag);
    var uke = iso(Ukeplan.mandagI(idag));

    el.lekserUke.textContent = '';
    var ukelekser = [];
    planer.forEach(function (p) { ukelekser = ukelekser.concat(p.plan.ukelekser); });
    if (ukelekser.length) {
      el.lekserUke.appendChild(lag('h2', '', 'Hele uka'));
      var rad = lag('div', 'ukerad');
      ukelekser.forEach(function (t) {
        rad.appendChild(lekseKort({ navn: navn, uke: uke, dag: 'uke', tekst: t }, t, idag));
      });
      el.lekserUke.appendChild(rad);
    }

    el.lekserDager.textContent = '';
    var alle = [];
    planer.forEach(function (p) { alle = alle.concat(p.plan.lekser); });
    var sisteDag = alle.reduce(function (m, l) { return Math.max(m, (l.dag.getDay() + 6) % 7); }, 4);
    el.lekserDager.style.setProperty('--dager', sisteDag + 1);
    for (var i = 0; i <= sisteDag; i++) {
      var dag = pluss(Ukeplan.mandagI(idag), i);
      var kol = lag('div', 'leksedag' + (dag.getTime() === idag.getTime() ? ' idag' : ''));
      kol.appendChild(lag('h3', '', UKEDAG[dag.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + dag.getDate() + '.'));
      alle.filter(function (l) { return l.dag.getTime() === dag.getTime(); }).forEach(function (l) {
        kol.appendChild(lekseKort({ navn: navn, uke: uke, dag: iso(l.dag), tekst: l.tekst }, l.tekst, idag));
      });
      el.lekserDager.appendChild(kol);
    }

    var dagens = lekserFor(navn, idag);
    var gjort = dagens.filter(erGjort).length;
    el.lekserStatus.textContent = !dagens.length ? '' :
      gjort === dagens.length ? 'Alt gjort i dag!' : gjort + ' av ' + dagens.length + ' i dag';
    el.lekserStatus.classList.toggle('ferdig', !!dagens.length && gjort === dagens.length);
  }

  // Feiringen: en liten sky av konfetti fra der fingeren trykket, og to korte
  // toner. Lyden lages av oscillatorer, så det finnes ingen lydfil – og
  // AudioContext lages i trykket, ellers er den stum.
  var lyd = null;
  function feir(x, y) {
    try {
      lyd = lyd || new (window.AudioContext || window.webkitAudioContext)();
      [[880, 0], [1318.5, 0.11]].forEach(function (t) {
        var o = lyd.createOscillator(), g = lyd.createGain();
        o.type = 'sine';
        o.frequency.value = t[0];
        g.gain.setValueAtTime(0.0001, lyd.currentTime + t[1]);
        g.gain.exponentialRampToValueAtTime(0.18, lyd.currentTime + t[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, lyd.currentTime + t[1] + 0.35);
        o.connect(g).connect(lyd.destination);
        o.start(lyd.currentTime + t[1]);
        o.stop(lyd.currentTime + t[1] + 0.4);
      });
    } catch (e) { /* uten lyd er feiringen fortsatt der */ }

    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = el.konfetti, ctx = c.getContext && c.getContext('2d');
    if (!ctx) return;
    c.width = innerWidth; c.height = innerHeight;
    var farger = ['#f2c14e', '#7bd389', '#5aa9e6', '#f28f6b', '#c79bf2'];
    var biter = [];
    for (var i = 0; i < 46; i++) {
      var v = Math.random() * Math.PI * 2, fart = 4 + Math.random() * 7;
      biter.push({ x: x, y: y, vx: Math.cos(v) * fart, vy: Math.sin(v) * fart - 5,
        r: 4 + Math.random() * 5, f: farger[i % farger.length], rot: Math.random() * 6 });
    }
    var start = performance.now();
    (function steg(t) {
      var gaatt = (t - start) / 1000;
      ctx.clearRect(0, 0, c.width, c.height);
      if (gaatt > 1.3) return;
      biter.forEach(function (b) {
        b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.rot += 0.2;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - gaatt / 1.3);
        ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.fillStyle = b.f;
        ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2);
        ctx.restore();
      });
      requestAnimationFrame(steg);
    })(start);
  }

  el.lekserKnapp.addEventListener('click', function () { aapneLekser(); });
  el.lekserLukk.addEventListener('click', lukkLekser);

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
