'use strict';

/* Selve appen: trekker et oppdrag, viser setningen, leser den opp, og feirer
   når barnet sier det er gjort.

   Trekkingen går via en kurv – oppdragene som passer stokkes, og det trekkes
   uten tilbakelegging til kurven er tom. Ren Math.random gir samme oppdrag to
   ganger på rad ofte nok til at et barn merker det, og da er maskinen
   «ødelagt». */
(function () {

  var LAGER = 'sprell-v2';

  /* Kortet skifter farge for hvert oppdrag. Det er den billigste måten å få et
     nytt oppdrag til å se nytt ut for den som ikke leser ennå. */
  var KORTFARGER = ['#ff4d6d', '#ff9f1c', '#ffd23f', '#4ecdc4', '#5aa9e6', '#a06cd5', '#7bc950'];
  var ROS = ['Kjempebra!', 'Supert!', 'Der satt den!', 'Så flink!', 'Helt topp!', 'Bra jobba!', 'Hurra!'];

  var el = {
    kort: document.getElementById('kort'),
    ikon: document.getElementById('ikon'),
    oppdrag: document.getElementById('oppdrag'),
    teller: document.getElementById('teller'),
    trekk: document.getElementById('trekk'),
    les: document.getElementById('les'),
    ferdig: document.getElementById('ferdig'),
    rampe: document.getElementById('rampe'),
    stjerner: document.getElementById('stjerner'),
    innstillinger: document.getElementById('innstillinger'),
    ark: document.getElementById('ark'),
    teppe: document.getElementById('teppe'),
    lukk: document.getElementById('lukk'),
    sted: document.getElementById('sted'),
    alder: document.getElementById('alder'),
    lyd: document.getElementById('lyd'),
    kunHer: document.getElementById('kun-her'),
    autoles: document.getElementById('autoles'),
    talebeskjed: document.getElementById('talebeskjed')
  };

  var valg = hentValg();
  var kurv = [];
  var forrigeId = null;
  var forrigeFarge = -1;
  var antall = 0;
  var visning = '';
  /* Rampemodus lagres med vilje ikke. Den slås på for en stund, og en app som
     åpnes neste morgen skal starte i det vanlige – ellers begynner dagen med
     en sur sokk uten at noen har bedt om det. */
  var rampe = false;

  function idag() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function standard() {
    return { sted: 'inne', alder: 6, kunHer: false, autoles: true, lyd: true, dato: idag(), gjort: 0 };
  }

  function hentValg() {
    var v = standard();
    try {
      var lagret = JSON.parse(localStorage.getItem(LAGER) || '{}');
      if (typeof lagret.kunHer === 'boolean') v.kunHer = lagret.kunHer;
      if (typeof lagret.autoles === 'boolean') v.autoles = lagret.autoles;
      if (typeof lagret.lyd === 'boolean') v.lyd = lagret.lyd;
      if (lagret.sted === 'inne' || lagret.sted === 'hage' || lagret.sted === 'begge') v.sted = lagret.sted;
      var a = parseInt(lagret.alder, 10);
      if (a >= 3 && a <= 12) v.alder = a;
      /* Stjernene gjelder dagen i dag. Er datoen en annen, begynner dagen på
         null av seg selv – ingen nullstillingsknapp å glemme. */
      if (lagret.dato === v.dato && lagret.gjort > 0) v.gjort = lagret.gjort;
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
    var bank = rampe ? window.SprellOppdrag.rampe : window.SprellOppdrag.bank(valg.sted);
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

  function nyFarge() {
    var i = Math.floor(Math.random() * KORTFARGER.length);
    if (i === forrigeFarge) i = (i + 1) % KORTFARGER.length;
    forrigeFarge = i;
    return KORTFARGER[i];
  }

  function vipp() {
    /* Klassen må fjernes og legges på igjen for at animasjonen skal starte på
       nytt. Uten avlesningen av offsetWidth slår nettleseren de to sammen og
       ingenting skjer fra andre trykk og utover. */
    el.kort.classList.remove('ny');
    void el.kort.offsetWidth;
    el.kort.classList.add('ny');
  }

  function trekk() {
    window.SprellLyd.vekk();
    if (!kurv.length) fyllKurv();
    if (!kurv.length) return;
    var o = kurv.pop();
    forrigeId = o.id;
    antall++;
    /* Setningen står som den er skrevet, med verbet først. */
    visning = window.SprellOppdrag.fyllUt(o.tekst);
    el.ikon.textContent = o.ikon;
    el.oppdrag.textContent = visning;
    el.kort.style.setProperty('--kort', nyFarge());
    el.teller.textContent = (rampe ? 'Rampestrek nummer ' : 'Oppdrag nummer ') + antall;
    el.ferdig.disabled = false;
    vipp();
    window.SprellLyd.trekk();
    oppdaterTalestatus();
    if (valg.autoles && window.SprellTale.kanLese()) window.SprellTale.les(visning);
  }

  function ferdig() {
    if (el.ferdig.disabled) return;
    window.SprellLyd.vekk();
    el.ferdig.disabled = true;
    visning = ROS[Math.floor(Math.random() * ROS.length)];
    el.ikon.textContent = '🎉';
    el.oppdrag.textContent = visning;
    el.kort.style.setProperty('--kort', '#2f9e44');
    vipp();
    window.SprellLyd.feiring();
    window.SprellLyd.rakett();
    /* Smellet kommer fra fyrverkeriet i det raketten sprekker, ikke fra en
       timer her: hvor lenge den stiger, avhenger av skjermhøyden. */
    window.SprellFyrverkeri.fyr(window.SprellLyd.smell);
    valg.gjort++;
    valg.dato = idag();
    lagreValg();
    tegnStjerner();
  }

  function tegnStjerner() {
    if (!valg.gjort) { el.stjerner.textContent = ''; return; }
    /* Stjernene teller bare oppover. Ingenting her markerer noe som ikke er
       gjort – det er premisset, som i Fargeflasker og Poengtavla. */
    var vist = Math.min(valg.gjort, 12);
    var rad = new Array(vist + 1).join('⭐');
    el.stjerner.textContent = valg.gjort > 12 ? rad + ' ×' + valg.gjort : rad;
  }

  function lesOpp() {
    window.SprellLyd.vekk();
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

  /* Hagen har sin egen bakgrunn, slik rampemodus har det. Klassene sitter på
     html av samme grunn: gradienten males der, og variabler satt på body når
     aldri opp dit. Rampemodus vinner når begge står på – da er det den banken
     maskinen trekker fra. */
  function tegnSted() {
    var ute = !rampe && valg.sted === 'hage';
    document.documentElement.classList.toggle('hage', ute);
    /* Fargen på statuslinja følger med når appen ligger på hjemskjermen. */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', rampe ? '#ffd166' : (ute ? '#a8e063' : '#5aa9e6'));
  }

  /* Ikonet på det tomme kortet sier hvilken bank maskinen står i før første
     trekk: terning inne, tre i hagen, fjes i rampemodus. */
  function standardIkon() {
    if (rampe) return '😈';
    return valg.sted === 'hage' ? '🌳' : '🎲';
  }

  /* Kortet stiller seg tilbake til «trykk her». Brukes når banken byttes:
     det som sto der, kom fra en annen bank. */
  function nullstillKort() {
    visning = '';
    el.ikon.textContent = standardIkon();
    el.oppdrag.textContent = 'Trykk på den store knappen!';
    el.kort.style.setProperty('--kort', nyFarge());
    el.ferdig.disabled = true;
    vipp();
    oppdaterTalestatus();
  }

  function tegnRampe() {
    el.rampe.setAttribute('aria-pressed', rampe ? 'true' : 'false');
    el.rampe.classList.toggle('paa', rampe);
    el.rampe.innerHTML = rampe
      ? '<span aria-hidden="true">😈</span> Rampemodus er på'
      : '<span aria-hidden="true">😈</span> Rampemodus';
    el.trekk.textContent = rampe ? 'Ny rampestrek' : 'Nytt oppdrag';
    /* Klassen hører hjemme på html, ikke på body: bakgrunnsgradienten males
       på html, og variabler satt på body ville aldri nådd opp dit. */
    document.documentElement.classList.toggle('rampe', rampe);
    /* Fargen på statuslinja følger med når appen ligger på hjemskjermen. */
    tegnSted();
  }

  /* ---------- innstillingsarket ---------- */

  function aapneArk() {
    el.ark.hidden = false;
    el.teppe.hidden = false;
    el.innstillinger.setAttribute('aria-expanded', 'true');
    el.ark.scrollTop = 0;
    el.alder.focus();
  }

  function lukkArk() {
    el.ark.hidden = true;
    el.teppe.hidden = true;
    el.innstillinger.setAttribute('aria-expanded', 'false');
    /* Fokus tilbake på prikkene, ellers står det igjen på et felt som er
       borte fra skjermen. */
    el.innstillinger.focus();
  }

  el.innstillinger.addEventListener('click', function () {
    if (el.ark.hidden) aapneArk(); else lukkArk();
  });
  el.lukk.addEventListener('click', lukkArk);
  el.teppe.addEventListener('click', lukkArk);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el.ark.hidden) lukkArk();
  });

  el.trekk.addEventListener('click', trekk);
  el.les.addEventListener('click', lesOpp);
  el.ferdig.addEventListener('click', ferdig);

  el.rampe.addEventListener('click', function () {
    rampe = !rampe;
    tegnRampe();
    /* De to bankene har ingenting med hverandre å gjøre, så kurven kastes.
       Ellers ville et par vanlige oppdrag ligget igjen i rampemodus. */
    kurv = [];
    window.SprellTale.stopp();
    window.SprellLyd.vekk();
    window.SprellLyd.rampe(rampe);
    nullstillKort();
  });

  el.sted.value = valg.sted;
  el.sted.addEventListener('change', function () {
    valg.sted = el.sted.value;
    lagreValg();
    /* Kurven er stokket ut fra det gamle stedet. */
    kurv = [];
    tegnSted();
    nullstillKort();
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

  el.lyd.checked = valg.lyd;
  el.kunHer.checked = valg.kunHer;
  el.autoles.checked = valg.autoles;

  el.lyd.addEventListener('change', function () {
    valg.lyd = el.lyd.checked;
    lagreValg();
    window.SprellLyd.settPaa(valg.lyd);
  });

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

  window.SprellLyd.settPaa(valg.lyd);
  window.SprellTale.naarStemmerKommer(oppdaterTalestatus);
  el.kort.style.setProperty('--kort', nyFarge());
  el.ikon.textContent = standardIkon();
  tegnRampe();
  tegnStjerner();
  oppdaterTalestatus();
})();
