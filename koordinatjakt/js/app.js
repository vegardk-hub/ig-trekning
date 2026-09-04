/*
 * Selve appen: binder valgene til generatoren, tegner arket og fasiten.
 *
 * Alt som velges ligger i adressen – `#dyrehage/42/12`. Det er ikke pynt:
 * arket skal kunne lages på nytt et halvt år senere, og et brett man har
 * skrevet ut og likt, skal kunne bokmerkes. Brettnummeret er hele
 * hukommelsen, så ingenting lagres lokalt.
 *
 * Fasiten står på skjermen, ikke på papiret – barnet svarer med blyant, og
 * den voksne retter mot skjermen. Slår man den på, blir den med i
 * utskriften på egen side: det som vises, er det som skrives ut.
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
    fasit: document.getElementById('fasit'),
    fasittittel: document.getElementById('fasittittel'),
    fasitliste: document.getElementById('fasitliste')
  };

  var MAKS_BRETT = 999;

  Temaer.LISTE.forEach(function (t) {
    var o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.navn;
    el.tema.appendChild(o);
  });

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

  function tegn() {
    var v = verdier();
    el.brett.value = v.brett;
    skrivAdresse(v);

    var scene = Scene.lag(v.tema, v.brett);
    var oppgaver = Oppgaver.lag(scene, v.antall);
    var tittel = scene.navn + ' – brett ' + scene.brett;

    el.arktittel.textContent = 'Koordinatjakt: ' + tittel;
    el.fasittittel.textContent = 'Fasit – ' + tittel;
    el.bilde.innerHTML = Tegn.svg(scene);

    el.oppgaver.innerHTML = '';
    el.fasitliste.innerHTML = '';
    oppgaver.forEach(function (o) {
      el.oppgaver.appendChild(rad(o.rute, '<span class="svarlinje"></span>'));
      el.fasitliste.appendChild(rad(o.rute, '<span class="svar">' + o.ord + '</span>'));
    });
  }

  function rad(rute, innhold) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="rute">' + rute + '</span>' + innhold;
    return li;
  }

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
