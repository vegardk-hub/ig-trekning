'use strict';

/* Selve appen: trekker et oppdrag, viser setningen, og leser den opp.

   Trekkingen går via en kurv – oppdragene som passer stokkes, og det trekkes
   uten tilbakelegging til kurven er tom. Ren Math.random gir samme oppdrag to
   ganger på rad ofte nok til at et barn merker det, og da er maskinen
   «ødelagt». */
(function () {

  var LAGER = 'sprell-v2';

  var el = {
    oppdrag: document.getElementById('oppdrag'),
    teller: document.getElementById('teller'),
    trekk: document.getElementById('trekk'),
    les: document.getElementById('les'),
    rampe: document.getElementById('rampe'),
    alder: document.getElementById('alder'),
    kunHer: document.getElementById('kun-her'),
    autoles: document.getElementById('autoles'),
    talebeskjed: document.getElementById('talebeskjed')
  };

  var valg = hentValg();
  var kurv = [];
  var forrigeId = null;
  var antall = 0;
  var visning = '';
  /* Rampemodus lagres med vilje ikke. Den slås på for en stund, og en app som
     åpnes neste morgen skal starte i det vanlige – ellers begynner dagen med
     en sur sokk uten at noen har bedt om det. */
  var rampe = false;

  function standard() {
    return { alder: 6, kunHer: false, autoles: true };
  }

  function hentValg() {
    var v = standard();
    try {
      var lagret = JSON.parse(localStorage.getItem(LAGER) || '{}');
      if (typeof lagret.kunHer === 'boolean') v.kunHer = lagret.kunHer;
      if (typeof lagret.autoles === 'boolean') v.autoles = lagret.autoles;
      var a = parseInt(lagret.alder, 10);
      if (a >= 3 && a <= 12) v.alder = a;
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

  function aktuelle() {
    var bank = rampe ? window.SprellOppdrag.rampe : window.SprellOppdrag.vanlige;
    return bank.filter(function (o) {
      if (valg.kunHer && o.sted !== 'her') return false;
      return o.alder <= valg.alder;
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
    /* Setningen står som den er skrevet, med verbet først. */
    visning = window.SprellOppdrag.fyllUt(o.tekst);
    el.oppdrag.textContent = visning;
    el.teller.textContent = (rampe ? 'Rampestrek nummer ' : 'Oppdrag nummer ') + antall;
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

  function tegnRampe() {
    el.rampe.setAttribute('aria-pressed', rampe ? 'true' : 'false');
    el.rampe.classList.toggle('paa', rampe);
    el.rampe.textContent = rampe ? 'Rampemodus er på' : 'Rampemodus';
    el.trekk.textContent = rampe ? 'Ny rampestrek' : 'Nytt oppdrag';
  }

  el.trekk.addEventListener('click', trekk);
  el.les.addEventListener('click', lesOpp);

  el.rampe.addEventListener('click', function () {
    rampe = !rampe;
    tegnRampe();
    /* De to bankene har ingenting med hverandre å gjøre, så kurven kastes.
       Ellers ville et par vanlige oppdrag ligget igjen i rampemodus. */
    kurv = [];
    window.SprellTale.stopp();
  });

  el.alder.value = valg.alder;
  el.alder.addEventListener('change', function () {
    var a = parseInt(el.alder.value, 10);
    if (!(a >= 3 && a <= 12)) {
      el.alder.value = valg.alder;
      return;
    }
    valg.alder = a;
    lagreValg();
    /* Kurven er stokket ut fra den gamle alderen. */
    kurv = [];
  });

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
  tegnRampe();
  oppdaterTalestatus();
})();
