'use strict';

/* Selve appen: viser ett oppdrag om gangen, leser det opp, og feirer når
   barnet sier det er gjort.

   Tre moduser deler samme skjerm:

   - `vanlig`  – trekker fra inne- eller hagebanken, alt etter stedsvalget.
   - `rampe`   – trekker fra rampestrekene, uansett sted.
   - `morgen`  – går gjennom morgenlista i rekkefølge. Den eneste som ikke
                 trekker: sko før jakke gir ingen mening.

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
  var GRONN = '#2f9e44';

  var el = {
    kort: document.getElementById('kort'),
    ikon: document.getElementById('ikon'),
    oppdrag: document.getElementById('oppdrag'),
    teller: document.getElementById('teller'),
    trekk: document.getElementById('trekk'),
    les: document.getElementById('les'),
    ferdig: document.getElementById('ferdig'),
    rampe: document.getElementById('rampe'),
    morgen: document.getElementById('morgen'),
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
  /* Modusen lagres med vilje ikke. Begge slås på for en stund, og en app som
     åpnes neste morgen skal starte i det vanlige – ellers begynner dagen med
     en sur sokk uten at noen har bedt om det. */
  var modus = 'vanlig';
  var morgenliste = [];
  var steg = 0;

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

  /* ---------- felles ---------- */

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

  function visKort(ikon, tekst, farge) {
    visning = tekst;
    el.ikon.textContent = ikon;
    el.oppdrag.textContent = tekst;
    el.kort.style.setProperty('--kort', farge || nyFarge());
    vipp();
    oppdaterTalestatus();
    if (valg.autoles && window.SprellTale.kanLese()) window.SprellTale.les(tekst);
  }

  function stjerne() {
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

  function feir() {
    window.SprellLyd.feiring();
    window.SprellLyd.rakett();
    /* Smellet kommer fra fyrverkeriet i det raketten sprekker, ikke fra en
       timer her: hvor lenge den stiger, avhenger av skjermhøyden. */
    window.SprellFyrverkeri.fyr(window.SprellLyd.smell);
  }

  /* ---------- trekking (vanlig og rampe) ---------- */

  function aktuelle() {
    var bank = modus === 'rampe' ? window.SprellOppdrag.rampe : window.SprellOppdrag.bank(valg.sted);
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

  function trekkOppdrag() {
    if (!kurv.length) fyllKurv();
    if (!kurv.length) return;
    var o = kurv.pop();
    forrigeId = o.id;
    antall++;
    /* Setningen står som den er skrevet, med verbet først. */
    visKort(o.ikon, window.SprellOppdrag.fyllUt(o.tekst));
    el.teller.textContent = (modus === 'rampe' ? 'Rampestrek nummer ' : 'Oppdrag nummer ') + antall;
    el.ferdig.disabled = false;
    window.SprellLyd.trekk();
  }

  /* ---------- morgenlista ---------- */

  function morgenStart() {
    /* Lista filtreres bare på alder. «Bare oppdrag der jeg står» hører ikke
       hjemme her – en morgen går tvers gjennom huset uansett. */
    morgenliste = window.SprellOppdrag.morgen.filter(function (o) {
      return o.alder <= valg.alder;
    });
    steg = 0;
    visSteg();
  }

  function visSteg() {
    if (steg >= morgenliste.length) { visMaal(); return; }
    var o = morgenliste[steg];
    visKort(o.ikon, o.tekst);
    el.teller.textContent = 'Steg ' + (steg + 1) + ' av ' + morgenliste.length;
    el.ferdig.disabled = false;
    el.trekk.textContent = 'Hopp over';
  }

  function visMaal() {
    visKort('🎒', 'Nå er du klar for barnehagen!', GRONN);
    el.teller.textContent = 'Alt er gjort!';
    el.ferdig.disabled = true;
    el.trekk.textContent = 'Begynn på nytt';
    feir();
  }

  function nesteSteg() {
    steg++;
    visSteg();
  }

  /* ---------- knappene ---------- */

  function trekk() {
    window.SprellLyd.vekk();
    if (modus !== 'morgen') { trekkOppdrag(); return; }
    if (steg >= morgenliste.length) { morgenStart(); return; }
    window.SprellLyd.trekk();
    nesteSteg();
  }

  function ferdig() {
    if (el.ferdig.disabled) return;
    window.SprellLyd.vekk();
    stjerne();
    if (modus === 'morgen') {
      /* Hvert steg gir en stjerne og en liten kvittering. Rakettene spares til
         hele lista er gjennom – ellers er feiringen brukt opp før man er
         kommet ut døra. */
      window.SprellLyd.stjerne();
      nesteSteg();
      return;
    }
    el.ferdig.disabled = true;
    visKort('🎉', ROS[Math.floor(Math.random() * ROS.length)], GRONN);
    feir();
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

  /* ---------- modus ---------- */

  /* Ikonet på det tomme kortet sier hvilken bank maskinen står i før første
     trykk: terning inne, tre i hagen, fjes i rampemodus. */
  function standardIkon() {
    if (modus === 'rampe') return '😈';
    return valg.sted === 'hage' ? '🌳' : '🎲';
  }

  /* Kortet stiller seg tilbake til «trykk her». Brukes når banken byttes:
     det som sto der, kom fra en annen bank. */
  function nullstillKort() {
    visning = '';
    el.ikon.textContent = standardIkon();
    el.oppdrag.textContent = 'Trykk på den store knappen!';
    el.kort.style.setProperty('--kort', nyFarge());
    el.teller.textContent = '';
    el.ferdig.disabled = true;
    vipp();
    oppdaterTalestatus();
  }

  /* Bakgrunnen sier hvilken modus appen står i, på tvers av rommet. Klassene
     sitter på html og ikke på body: gradienten males der, og variabler satt på
     body når aldri opp dit. */
  function tegnFarger() {
    var rot = document.documentElement;
    rot.classList.toggle('rampe', modus === 'rampe');
    rot.classList.toggle('morgen', modus === 'morgen');
    rot.classList.toggle('hage', modus === 'vanlig' && valg.sted === 'hage');
    var farge = '#5aa9e6';
    if (modus === 'rampe') farge = '#ffd166';
    else if (modus === 'morgen') farge = '#ffe29a';
    else if (valg.sted === 'hage') farge = '#a8e063';
    /* Fargen på statuslinja følger med når appen ligger på hjemskjermen. */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', farge);
  }

  function tegnModus() {
    el.rampe.setAttribute('aria-pressed', modus === 'rampe' ? 'true' : 'false');
    el.rampe.classList.toggle('paa', modus === 'rampe');
    el.morgen.setAttribute('aria-pressed', modus === 'morgen' ? 'true' : 'false');
    el.morgen.classList.toggle('paa', modus === 'morgen');
    if (modus === 'rampe') el.trekk.textContent = 'Ny rampestrek';
    else if (modus === 'morgen') el.trekk.textContent = 'Hopp over';
    else el.trekk.textContent = 'Nytt oppdrag';
    tegnFarger();
  }

  function byttModus(ny) {
    var fra = modus;
    modus = (modus === ny) ? 'vanlig' : ny;
    tegnModus();
    /* De to bankene har ingenting med hverandre å gjøre, så kurven kastes.
       Ellers ville et par vanlige oppdrag ligget igjen i rampemodus. */
    kurv = [];
    window.SprellTale.stopp();
    window.SprellLyd.vekk();
    if (modus === 'rampe') window.SprellLyd.rampe(true);
    else if (fra === 'rampe') window.SprellLyd.rampe(false);
    if (modus === 'morgen') morgenStart(); else nullstillKort();
  }

  /* ---------- innstillingsarket ---------- */

  function aapneArk() {
    el.ark.hidden = false;
    el.teppe.hidden = false;
    el.innstillinger.setAttribute('aria-expanded', 'true');
    el.ark.scrollTop = 0;
    el.sted.focus();
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

  /* ---------- lyttere ---------- */

  el.trekk.addEventListener('click', trekk);
  el.les.addEventListener('click', lesOpp);
  el.ferdig.addEventListener('click', ferdig);
  el.rampe.addEventListener('click', function () { byttModus('rampe'); });
  el.morgen.addEventListener('click', function () { byttModus('morgen'); });

  el.sted.value = valg.sted;
  el.sted.addEventListener('change', function () {
    valg.sted = el.sted.value;
    lagreValg();
    /* Kurven er stokket ut fra det gamle stedet. */
    kurv = [];
    tegnFarger();
    if (modus !== 'morgen') nullstillKort();
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
    if (modus === 'morgen') morgenStart();
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
  tegnModus();
  tegnStjerner();
  oppdaterTalestatus();
})();
