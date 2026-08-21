'use strict';

/* Selve appen: trekker et oppdrag til det barnet som står for tur, viser
   setningen, og leser den opp.

   Trekkingen går via en kurv – oppdragene som passer stokkes, og det trekkes
   uten tilbakelegging til kurven er tom. Ren Math.random gir samme oppdrag to
   ganger på rad ofte nok til at et barn merker det, og da er maskinen
   «ødelagt». */
(function () {

  var LAGER = 'sprell-v1';

  var el = {
    oppdrag: document.getElementById('oppdrag'),
    teller: document.getElementById('teller'),
    trekk: document.getElementById('trekk'),
    les: document.getElementById('les'),
    kunHer: document.getElementById('kun-her'),
    autoles: document.getElementById('autoles'),
    talebeskjed: document.getElementById('talebeskjed'),
    barn: [].slice.call(document.querySelectorAll('.barn')),
    navn: [document.getElementById('navn-0'), document.getElementById('navn-1')],
    alder: [document.getElementById('alder-0'), document.getElementById('alder-1')]
  };

  var valg = hentValg();
  var kurv = [];
  var forrigeId = null;
  var antall = 0;
  var visning = '';

  function standard() {
    return {
      kunHer: false,
      autoles: true,
      aktiv: 0,
      barn: [{ navn: 'Vetle', alder: 8 }, { navn: 'Live', alder: 5 }]
    };
  }

  function hentValg() {
    var v = standard();
    try {
      var lagret = JSON.parse(localStorage.getItem(LAGER) || '{}');
      if (typeof lagret.kunHer === 'boolean') v.kunHer = lagret.kunHer;
      if (typeof lagret.autoles === 'boolean') v.autoles = lagret.autoles;
      if (lagret.aktiv === 0 || lagret.aktiv === 1) v.aktiv = lagret.aktiv;
      if (Array.isArray(lagret.barn)) {
        for (var i = 0; i < 2; i++) {
          if (!lagret.barn[i]) continue;
          /* Navnet lagres slik det skrives. Samme lærdom som i Poengtavla:
             blokkbokstaver hører hjemme i CSS, ikke i dataene. */
          if (typeof lagret.barn[i].navn === 'string') v.barn[i].navn = lagret.barn[i].navn;
          var a = parseInt(lagret.barn[i].alder, 10);
          if (a >= 3 && a <= 16) v.barn[i].alder = a;
        }
      }
    } catch (e) {
      return standard();
    }
    return v;
  }

  function lagreValg() {
    try {
      localStorage.setItem(LAGER, JSON.stringify(valg));
    } catch (e) {
      /* Privat modus kan nekte skriving. Appen virker like fullt, den husker
         bare ikke valgene til neste gang. */
    }
  }

  function aktivtBarn() {
    return valg.barn[valg.aktiv];
  }

  function aktuelle() {
    var alder = aktivtBarn().alder;
    return window.SprellOppdrag.alle.filter(function (o) {
      if (valg.kunHer && o.sted !== 'her') return false;
      return o.alder <= alder;
    });
  }

  function fyllKurv() {
    kurv = aktuelle().slice();
    for (var i = kurv.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var b = kurv[i]; kurv[i] = kurv[j]; kurv[j] = b;
    }
    /* Ny kurv kan starte med det samme oppdraget som avsluttet den forrige.
       Da bytter vi det med nummer to. */
    if (kurv.length > 1 && kurv[kurv.length - 1].id === forrigeId) {
      var siste = kurv.pop();
      kurv.splice(kurv.length - 1, 0, siste);
    }
  }

  function trekk() {
    if (!kurv.length) fyllKurv();
    if (!kurv.length) return;
    var o = kurv.pop();
    forrigeId = o.id;
    antall++;
    visning = window.SprellOppdrag.medNavn(
      aktivtBarn().navn.trim(),
      window.SprellOppdrag.fyllUt(o.tekst)
    );
    el.oppdrag.textContent = visning;
    el.teller.textContent = 'Oppdrag nummer ' + antall;
    oppdaterTalestatus();
    if (valg.autoles && window.SprellTale.kanLese()) window.SprellTale.les(visning);
  }

  function lesOpp() {
    if (!visning) return;
    window.SprellTale.les(visning);
  }

  function oppdaterTalestatus() {
    var kan = window.SprellTale.kanLese();
    el.les.disabled = !kan || !visning;
    el.autoles.disabled = !kan;
    if (!kan) {
      el.talebeskjed.textContent = 'Denne nettleseren kan ikke lese opp. Les oppdraget høyt selv.';
    } else if (!window.SprellTale.harNorskStemme()) {
      el.talebeskjed.textContent = 'Fant ingen norsk stemme på enheten – opplesingen kan låte rar.';
    } else {
      el.talebeskjed.textContent = '';
    }
  }

  function tegnBarn() {
    for (var i = 0; i < 2; i++) {
      var navn = valg.barn[i].navn.trim();
      el.barn[i].textContent = navn || 'Barn ' + (i + 1);
      el.barn[i].setAttribute('aria-pressed', valg.aktiv === i ? 'true' : 'false');
      el.barn[i].classList.toggle('valgt', valg.aktiv === i);
    }
  }

  el.trekk.addEventListener('click', trekk);
  el.les.addEventListener('click', lesOpp);

  el.barn.forEach(function (knapp) {
    knapp.addEventListener('click', function () {
      var nr = parseInt(knapp.getAttribute('data-nr'), 10);
      if (nr === valg.aktiv) return;
      valg.aktiv = nr;
      lagreValg();
      tegnBarn();
      /* Barna har ulikt utvalg. Kurven er stokket ut fra det forrige barnets
         alder, så den må lages på nytt. */
      kurv = [];
    });
  });

  for (var i = 0; i < 2; i++) {
    (function (nr) {
      el.navn[nr].value = valg.barn[nr].navn;
      el.alder[nr].value = valg.barn[nr].alder;
      el.navn[nr].addEventListener('input', function () {
        valg.barn[nr].navn = el.navn[nr].value;
        lagreValg();
        tegnBarn();
      });
      el.alder[nr].addEventListener('change', function () {
        var a = parseInt(el.alder[nr].value, 10);
        if (!(a >= 3 && a <= 16)) {
          el.alder[nr].value = valg.barn[nr].alder;
          return;
        }
        valg.barn[nr].alder = a;
        lagreValg();
        if (nr === valg.aktiv) kurv = [];
      });
    })(i);
  }

  el.kunHer.checked = valg.kunHer;
  el.autoles.checked = valg.autoles;

  el.kunHer.addEventListener('change', function () {
    valg.kunHer = el.kunHer.checked;
    lagreValg();
    /* Kurven er stokket ut fra det gamle filteret, så den må lages på nytt –
       ellers ville et avkrysset «bare her jeg står» fortsatt sende barnet på
       badet så lenge det lå igjen slike i kurven. */
    kurv = [];
  });

  el.autoles.addEventListener('change', function () {
    valg.autoles = el.autoles.checked;
    lagreValg();
    if (!valg.autoles) window.SprellTale.stopp();
  });

  window.SprellTale.naarStemmerKommer(oppdaterTalestatus);
  tegnBarn();
  oppdaterTalestatus();
})();
