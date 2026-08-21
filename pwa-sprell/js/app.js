'use strict';

/* Selve appen: trekker et oppdrag, viser setningen, og leser den opp.
   Trekkingen går via en kurv – alle oppdragene stokkes, og det trekkes uten
   tilbakelegging til kurven er tom. Ren Math.random gir samme oppdrag to
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
    talebeskjed: document.getElementById('talebeskjed')
  };

  var valg = hentValg();
  var kurv = [];
  var forrigeId = null;
  var antall = 0;
  var visning = '';

  function hentValg() {
    var standard = { kunHer: false, autoles: true };
    try {
      var lagret = JSON.parse(localStorage.getItem(LAGER) || '{}');
      return {
        kunHer: !!lagret.kunHer,
        autoles: lagret.autoles === undefined ? standard.autoles : !!lagret.autoles
      };
    } catch (e) {
      return standard;
    }
  }

  function lagreValg() {
    try {
      localStorage.setItem(LAGER, JSON.stringify(valg));
    } catch (e) {
      /* Privat modus kan nekte skriving. Appen virker like fullt, den husker
         bare ikke valgene til neste gang. */
    }
  }

  function aktuelle() {
    return window.SprellOppdrag.alle.filter(function (o) {
      return !valg.kunHer || o.sted === 'her';
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
    var o = kurv.pop();
    forrigeId = o.id;
    antall++;
    visning = window.SprellOppdrag.fyllUt(o.tekst);
    el.oppdrag.textContent = visning;
    el.teller.textContent = 'Oppdrag nummer ' + antall;
    el.les.disabled = !window.SprellTale.kanLese();
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

  el.trekk.addEventListener('click', trekk);
  el.les.addEventListener('click', lesOpp);

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
  oppdaterTalestatus();
})();
