/*
 * Stuntgarasjen: skjermene, butikken og lagringen.
 *
 * Fem skjermer, én om gangen: garasje, verksted, deler, løype, resultat.
 * All tilstand ligger i ett objekt som lagres i localStorage, og hele
 * grensesnittet tegnes på nytt fra det. Med så få skjermer er det både
 * kortere og tryggere enn å flytte enkeltverdier inn og ut av DOM-en.
 *
 * Pengene er én pott, slik eieren ba om. Det som hindrer at pynt straffer
 * seg, er at designdelene gir stilbonus på alt man tjener i løypa – en
 * glitterlakk konkurrerer altså ikke med motoren, den betaler for seg selv
 * over noen turer.
 */
'use strict';

(function () {

  var NOKKEL = 'stuntgarasjen';
  var STARTPENGER = 250;

  var stat = last();
  var lope = Lope.bygg(Fysikk.G, stat.bane);
  var lop = null;          // aktiv kjøring
  var bilbilde = null;      // karosseri + hjul som bilder, til løypa
  var aktivKategori = 'form';

  var e = {};
  ['skjermGarasje', 'skjermVerksted', 'skjermDeler', 'skjermLop', 'skjermResultat',
   'skjermBaner', 'baneListe', 'banerPenger', 'baneNavn',
   'skjermKjoretoy', 'kjoretoyListe', 'kjoretoyPenger', 'kjoretoyNavn',
   'garasjeBil', 'garasjePenger', 'garasjeStil', 'garasjeTeknikk', 'garasjeBeste',
   'verkstedBil', 'verkstedPenger', 'kategorier', 'valgene', 'stilLinje',
   'delerPenger', 'delerListe', 'delerBil',
   'lerret', 'hudPenger', 'hudFart', 'framdrift', 'hudHint',
   'knappGass', 'knappBrems', 'knappTurbo', 'turbofyll',
   'resultatSum', 'resultatDetaljer', 'resultatBil', 'resultatRekord'
  ].forEach(function (id) { e[id] = document.getElementById(id); });

  /* ---------- lagring ---------- */

  function last() {
    var s = { penger: STARTPENGER, eid: {}, valgt: Bil.standard(),
              biler: {}, beste: 0, turer: 0,
              bane: Lope.BANER[0].id, rekord: {},
              versjon: Fysikk.LAGRINGSVERSJON };
    try {
      var lagret = JSON.parse(localStorage.getItem(NOKKEL));
      if (lagret && typeof lagret === 'object') {
        s.penger = typeof lagret.penger === 'number' ? lagret.penger : s.penger;
        s.eid = lagret.eid || {};
        s.beste = lagret.beste || 0;
        s.turer = lagret.turer || 0;

        /*
         * Rekorden var ett tall før det fantes flere baner. Den hører til
         * Stuntløypa, for det er den eneste som er kjørt – legges den på alle
         * banene, møter barnet en rekord det aldri har satt på en bane det
         * aldri har sett.
         */
        s.rekord = lagret.rekord || {};
        if (!lagret.rekord && s.beste) s.rekord[Lope.BANER[0].id] = s.beste;

        // En bane som er fjernet fra katalogen, skal ikke låse appen på en
        // løype som ikke finnes. `Lope.finn()` faller tilbake på den første.
        s.bane = Lope.finn(lagret.bane).id;
        if (lagret.valgt) for (var k in s.valgt) if (lagret.valgt[k]) s.valgt[k] = lagret.valgt[k];

        // Dekor var én valgt del før, og er nå en liste. En lagring fra den
        // gamle utgaven skal ikke tømme bilen for pynt – eller krasje på en
        // streng der koden venter en liste.
        if (typeof s.valgt.dekor === 'string') {
          s.valgt.dekor = (s.valgt.dekor && s.valgt.dekor !== 'ingen') ? [s.valgt.dekor] : [];
        }
        if (!Array.isArray(s.valgt.dekor)) s.valgt.dekor = [];
        if (!Array.isArray(s.valgt.ekstra)) s.valgt.ekstra = [];

        /*
         * Oppgraderingene er per kjøretøy. Før fantes det bare ett, og da lå
         * de i `oppg` rett på toppnivået – den lagringen er Stuntbilens, for
         * det er den eneste bilen som har vært kjørt.
         */
        s.biler = (lagret.biler && typeof lagret.biler === 'object') ? lagret.biler : {};
        if (!lagret.biler && lagret.oppg) s.biler[Bil.KJORETOY[0].id] = lagret.oppg;

        // Et kjøretøy som er fjernet fra katalogen skal ikke låse appen på en
        // bil som ikke finnes. `finnKjoretoy()` faller tilbake på den første.
        s.valgt.kjoretoy = Bil.finnKjoretoy(s.valgt.kjoretoy).id;

        for (var kid in s.biler) {
          var o = s.biler[kid] || {};
          // Oppgraderingene gikk fra sju nivåer til tiere à fem trinn.
          // `Fysikk.fraGammelLagring()` eier hele omregningen og sier hvorfor
          // en maksa bil skal begynne på tier 2 og ikke på toppen av stigen.
          for (var m in o) o[m] = Fysikk.fraGammelLagring(o[m], lagret.versjon);
        }
        s.versjon = Fysikk.LAGRINGSVERSJON;
      }
    } catch (f) { /* ødelagt lagring skal ikke stoppe spillet */ }

    // Gratisdelene eier man alltid, ellers kan man stå med en bil man ikke
    // har lov til å bruke etter en oppdatering av katalogen.
    Bil.KATEGORIER.forEach(function (kat) {
      if (!s.eid[kat.id]) s.eid[kat.id] = [];
      kat.liste.forEach(function (del) {
        if (del.pris === 0 && s.eid[kat.id].indexOf(del.id) < 0) s.eid[kat.id].push(del.id);
      });
    });

    // Kjøretøyene eies i samme liste som resten, men de står ikke i
    // `KATEGORIER` – de kjøpes på sin egen skjerm, ikke i verkstedet.
    if (!Array.isArray(s.eid.kjoretoy)) s.eid.kjoretoy = [];
    Bil.KJORETOY.forEach(function (k) {
      if (k.pris === 0 && s.eid.kjoretoy.indexOf(k.id) < 0) s.eid.kjoretoy.push(k.id);
    });

    /*
     * Hvert eid kjøretøy har sine egne oppgraderinger, og et nytt begynner på
     * null. Det er det som gjør at en ny bil er noe å bygge opp og ikke bare
     * et nytt skall utenpå den gamle motoren.
     */
    s.eid.kjoretoy.forEach(function (id) {
      var o = s.biler[id] || {};
      s.biler[id] = {
        motor: typeof o.motor === 'number' ? o.motor : 0,
        gir: typeof o.gir === 'number' ? o.gir : 0,
        dekk: typeof o.dekk === 'number' ? o.dekk : 0
      };
    });
    if (s.eid.kjoretoy.indexOf(s.valgt.kjoretoy) < 0) s.valgt.kjoretoy = Bil.KJORETOY[0].id;
    return s;
  }

  function lagre() {
    try { localStorage.setItem(NOKKEL, JSON.stringify(stat)); } catch (f) { /* full disk */ }
  }

  function eier(kat, id) { return stat.eid[kat].indexOf(id) >= 0; }

  /*
   * Oppgraderingene til den bilen som står i garasjen nå. Alt som spør om
   * motor, gir eller dekk går gjennom denne – ellers ville et bytte av
   * kjøretøy måttet huskes ett sted til for hver skjerm som viser et tall.
   */
  function oppg() { return stat.biler[stat.valgt.kjoretoy]; }

  function kjoretoy() { return Bil.finnKjoretoy(stat.valgt.kjoretoy); }

  /*
   * Alt som ganger opp det man tjener, i ett tall. Stilbonusen kommer fra
   * pynten, kjøretøygangeren fra bilen selv, og fysikken legger teknikkbonusen
   * oppå. De tre er uavhengige, og derfor ganges de sammen.
   */
  function inntektsbonus() { return Bil.bonus(stat.valgt) * Bil.kjoretoyBonus(stat.valgt); }

  /* ---------- skjermbytte ---------- */

  var SKJERMER = ['skjermGarasje', 'skjermVerksted', 'skjermDeler', 'skjermLop',
                  'skjermResultat', 'skjermBaner', 'skjermKjoretoy'];

  function vis(navn) {
    SKJERMER.forEach(function (s) { e[s].hidden = (s !== navn); });
    if (navn === 'skjermGarasje') tegnGarasje();
    if (navn === 'skjermVerksted') tegnVerksted();
    if (navn === 'skjermDeler') tegnDeler();
    if (navn === 'skjermBaner') tegnBaner();
    if (navn === 'skjermKjoretoy') tegnKjoretoy();
  }

  /*
   * Tusenskille med hardt mellomrom. Prisene i de øverste tierne er femsifrede
   * og totalen sekssifret, og «$28300» er ikke et tall et barn leser – det er
   * en sifferrekke. Mellomrommet må være hardt, ellers brekker beløpet i to
   * midt i en knapp.
   */
  function kr(n) {
    return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  }

  function penger() { return kr(stat.penger); }

  // Felgen viser dekk-tieret. Alt som tegner bilen går gjennom denne, så
  // garasjen, verkstedet, delelista, resultatet og løypa aldri kan vise
  // hvert sitt hjul.
  function dekktier() { return Fysikk.tierInfo(oppg().dekk); }

  // Rekorden er per bane. En felles rekord ville gjort de korteste banene
  // meningsløse å prøve: tallet sto der fra den lengste, og ingenting man
  // kjørte på Korketrekkeren kunne noen gang slå det.
  function rekord(id) { return stat.rekord[id] || 0; }

  /* ---------- garasje ---------- */

  function tegnGarasje() {
    // Garasjen tegner bilen inni seg, i sin egen koordinatverden – derfor
    // ikke `Bil.svg()` her.
    e.garasjeBil.innerHTML = Garasje.svg(stat.valgt, 'g', dekktier());
    e.garasjePenger.textContent = penger();
    var b = Bil.bonus(stat.valgt);
    e.garasjeStil.textContent = '×' + b.toFixed(2);
    e.garasjeTeknikk.textContent = '×' + Fysikk.teknikkbonus(oppg()).toFixed(2);
    e.garasjeBeste.textContent = rekord(stat.bane) ? kr(rekord(stat.bane)) : '–';

    /*
     * Baneknappen sier hvilken bane som er valgt. Uten navnet på knappen må
     * barnet inn i velgeren bare for å se hva KJØR-knappen kommer til å gjøre.
     *
     * Tegnet blir stående på kartet og bytter *ikke* til banens eget: de to
     * andre knappene har et fast tegn og en etikett, og en knapp som skifter
     * begge deler leser som en tilstand i stedet for som en vei videre.
     */
    e.baneNavn.textContent = Lope.finn(stat.bane).navn;
    e.kjoretoyNavn.textContent = kjoretoy().navn;
  }

  /* ---------- kjøretøyene ---------- */

  /*
   * Et kjøretøy er en *egen bil*: den har sine egne oppgraderinger, og en ny
   * begynner på null. Den gamle blir stående i garasjen, ferdig bygd, og man
   * kan bytte fram og tilbake når som helst.
   *
   * Det er den vekslingen som gjør at «begynner på null» ikke er et tap. Uten
   * den ville et kjøp på 40 000 gjort bilen langsom med én gang, og barnet
   * hadde brukt alt det eide på å gjøre spillet tregere – stikk i strid med at
   * ingenting her skal kunne gå galt.
   */
  function tegnKjoretoy() {
    e.kjoretoyPenger.textContent = penger();
    e.kjoretoyListe.innerHTML = '';

    Bil.KJORETOY.forEach(function (k, n) {
      var har = stat.eid.kjoretoy.indexOf(k.id) >= 0;
      var paa = k.id === stat.valgt.kjoretoy;
      var raad = stat.penger >= k.pris;

      /*
       * Kortet viser bilen slik den faktisk blir, med barnets egen lakk og
       * pynt – ikke et ikon. Da ser man hva pengene kjøper før man bruker dem.
       * Dekk-tieret er kjøretøyets eget, så et nytt kjøretøy viser nakne felger
       * og sier med det samme at oppgraderingene begynner på nytt.
       */
      var vis_ = {};
      for (var f in stat.valgt) vis_[f] = stat.valgt[f];
      vis_.kjoretoy = k.id;
      var egneOppg = stat.biler[k.id];

      var kort = document.createElement('button');
      kort.className = 'kjoretoykort' + (paa ? ' valgt' : '') + (!har && !raad ? ' dyr' : '');
      kort.setAttribute('aria-pressed', paa ? 'true' : 'false');

      var under;
      if (paa) under = '<span class="paa">✓ Denne kjører du</span>';
      else if (har) under = '<span class="eid">Bytt til denne</span>';
      else under = '<span class="pris">' + kr(k.pris) + '</span>';

      // Tilstanden på *den* bilen, ikke på den som står i garasjen nå.
      var tilstand = har
        ? (egneOppg && (egneOppg.motor + egneOppg.gir + egneOppg.dekk)
            ? 'Bygd til tier ' + Fysikk.tierInfo(egneOppg.motor).n
            : 'Uten oppgraderinger')
        : 'Begynner uten oppgraderinger';

      kort.innerHTML =
        '<span class="banetegn" aria-hidden="true">' + k.tegn + '</span>' +
        '<span class="banetittel">' + k.navn + '</span>' +
        under +
        '<span class="kjoretoybil">' +
          Bil.svg(vis_, 'kv' + n, '', Fysikk.tierInfo(har ? egneOppg.dekk : 0)) +
        '</span>' +
        '<span class="baneomtale">' + k.omtale + '</span>' +
        '<span class="banemerker">' +
          '<span class="banemerke">💰 ×' + k.inntekt.toFixed(2) + ' på alt du tjener</span>' +
          '<span class="banemerke">🔧 ' + tilstand + '</span>' +
        '</span>';

      kort.onclick = function () { velgKjoretoy(k); };
      e.kjoretoyListe.appendChild(kort);
    });
  }

  function velgKjoretoy(k) {
    if (stat.eid.kjoretoy.indexOf(k.id) < 0) {
      if (stat.penger < k.pris) { rist(e.kjoretoyPenger); return; }
      stat.penger -= k.pris;
      stat.eid.kjoretoy.push(k.id);
      // Et nytt kjøretøy begynner på null. Det er hele premisset.
      stat.biler[k.id] = { motor: 0, gir: 0, dekk: 0 };
      blafr(e.kjoretoyPenger);
    }
    stat.valgt.kjoretoy = k.id;

    /*
     * Formen hører til Stuntbilen. Kjører man noe annet, skal valget stå igjen
     * urørt til man bytter tilbake – ellers mister barnet en form det har
     * betalt for hver gang det prøver et nytt kjøretøy, samme lærdom som
     * dekorlista.
     */
    if (aktivKategori === 'form' && Bil.finnKjoretoy(k.id).kropp) aktivKategori = 'lakk';

    lagre();
    tegnKjoretoy();
  }

  /* ---------- banevelgeren ---------- */

  /*
   * Løypene bygges én gang og blir liggende. Fem baner er noen tusen punkter
   * til sammen, og kortene trenger dem uansett for å tegne høydeprofilen –
   * men de skal ikke bygges på nytt hver gang skjermen vises.
   */
  var bygde = {};

  function bygg(id) {
    if (!bygde[id]) bygde[id] = Lope.bygg(Fysikk.G, id);
    return bygde[id];
  }

  function tegnBaner() {
    e.banerPenger.textContent = penger();
    e.baneListe.innerHTML = '';

    Lope.BANER.forEach(function (bane, n) {
      var L = bygg(bane.id);
      var inn = Lope.innhold(L);

      /*
       * Merkene telles ut av løypa, ikke skrevet inn i katalogen. En bane som
       * får en loop til, sier det på kortet uten at noen må huske å rette
       * teksten – og det kan aldri stå noe der som ikke finnes i løypa.
       */
      var merker = '';
      if (inn.looper) merker += lite('🔁', inn.looper + (inn.looper === 1 ? ' loop' : ' looper'));
      if (inn.hopp) merker += lite('🛫', inn.hopp + ' hopp');
      for (var s in inn.soner) {
        merker += lite(Lope.SONER[s].tegn, Lope.SONER[s].navn);
      }

      var r = rekord(bane.id);

      var kort = document.createElement('button');
      kort.className = 'banekortet' + (bane.id === stat.bane ? ' valgt' : '');
      kort.style.setProperty('--banefarge', bane.farge);
      kort.setAttribute('aria-pressed', bane.id === stat.bane ? 'true' : 'false');
      kort.innerHTML =
        '<span class="banetegn" aria-hidden="true">' + bane.tegn + '</span>' +
        '<span class="banetittel">' + bane.navn + '</span>' +
        '<span class="banerekord">' + (r ? 'Rekord ' + kr(r) : 'Ikke kjørt') + '</span>' +
        Banekart.svg(L, bane.farge, String(n)) +
        '<span class="baneomtale">' + bane.omtale + '</span>' +
        '<span class="banemerker">' + merker + '</span>';

      kort.onclick = function () { velgBane(bane.id); };
      e.baneListe.appendChild(kort);
    });
  }

  function lite(tegn, tekst) {
    return '<span class="banemerke"><span aria-hidden="true">' + tegn + '</span> ' + tekst + '</span>';
  }

  /*
   * Et trykk på et kort velger banen *og* starter den. Velgeren er ikke en
   * innstilling man går ut av igjen – man er der for å kjøre, og et kort som
   * bare huket av ville krevd et trykk til på en KJØR-knapp lenger ned enn
   * kortene rekker.
   */
  function velgBane(id) {
    stat.bane = id;
    lagre();
    startLop();
  }

  /* ---------- verksted ---------- */

  function tegnVerksted() {
    e.verkstedBil.innerHTML = Bil.svg(stat.valgt, 'v', 'bilbilde', dekktier());
    e.verkstedPenger.textContent = penger();

    /*
     * Formfanen gjelder bare Stuntbilen. De dyre kjøretøyene eier sitt eget
     * karosseri, og en fane som ikke endret noe ville vært verre enn ingen
     * fane: barnet trykker på en racer og bilen over lista blir stående som
     * et romfartøy.
     */
    var kategorier = Bil.KATEGORIER.filter(function (kat) {
      return kat.id !== 'form' || !kjoretoy().kropp;
    });
    if (!kategorier.some(function (kat) { return kat.id === aktivKategori; })) {
      aktivKategori = kategorier[0].id;
    }

    e.kategorier.innerHTML = '';
    kategorier.forEach(function (kat) {
      var k = document.createElement('button');
      k.className = 'fane' + (kat.id === aktivKategori ? ' valgt' : '');
      k.innerHTML = '<span class="fanetegn" aria-hidden="true">' + kat.tegn + '</span>' +
                    '<span class="fanenavn">' + kat.navn + '</span>';
      k.setAttribute('aria-pressed', kat.id === aktivKategori ? 'true' : 'false');
      k.onclick = function () { aktivKategori = kat.id; tegnVerksted(); };
      e.kategorier.appendChild(k);
    });

    var kat = null;
    kategorier.forEach(function (k) { if (k.id === aktivKategori) kat = k; });

    e.valgene.innerHTML = '';
    kat.liste.forEach(function (del) {
      var har = eier(kat.id, del.id);
      var valgt = kat.flere
        ? stat.valgt[kat.id].indexOf(del.id) >= 0
        : stat.valgt[kat.id] === del.id;
      var raad = stat.penger >= del.pris;

      var k = document.createElement('button');
      k.className = 'valg' + (valgt ? ' valgt' : '') + (!har && !raad ? ' dyr' : '');
      k.setAttribute('aria-pressed', valgt ? 'true' : 'false');

      var merke;
      if (kat.id === 'lakk') {
        merke = '<span class="lakkprikk" style="background:' +
          (del.regnbue ? 'linear-gradient(120deg,#ff4d6d,#ffb01f,#4ad991,#3aa8ff,#a05cff)' : del.farge) +
          '"></span>';
      } else if (kat.id === 'hjul') {
        merke = '<span class="hjulprove">' + Bil.miniHjul(del) + '</span>';
      } else {
        merke = '<span class="valgtegn" aria-hidden="true">' + (del.tegn || kat.tegn) + '</span>';
      }

      var under = har
        ? (valgt ? '<span class="paa">✓ På bilen</span>' : '<span class="eid">Eier</span>')
        : '<span class="pris">' + kr(del.pris) + '</span>';

      k.innerHTML = merke + '<span class="valgnavn">' + del.navn + '</span>' + under +
                    (del.stil ? '<span class="stilmerke">+' + del.stil + ' stil</span>' : '<span class="stilmerke"></span>');

      k.onclick = function () { velgDel(kat, del); };
      e.valgene.appendChild(k);
    });

    var b = Bil.bonus(stat.valgt);
    e.stilLinje.innerHTML = (kat.flere ? 'Sett på så mange du vil! ' : '') +
      'Stil <strong>' + Bil.stil(stat.valgt) + '</strong> gir <strong class="gronn">×' +
      b.toFixed(2) + '</strong> på alt du tjener i løypa';
  }

  function velgDel(kat, del) {
    if (eier(kat.id, del.id)) {
      if (kat.flere) {
        // Dekor slås av og på. Et trykk på noe som allerede står på tar det
        // av igjen – ellers ville barnet ikke hatt noen vei tilbake fra en
        // pynt det ble lei av, uten en egen «fjern»-knapp.
        var pa = stat.valgt[kat.id];
        var n = pa.indexOf(del.id);
        if (n >= 0) pa.splice(n, 1); else pa.push(del.id);
      } else {
        stat.valgt[kat.id] = del.id;
      }
      lagre();
      tegnVerksted();
      return;
    }
    if (stat.penger < del.pris) {
      rist(e.verkstedPenger);
      return;
    }
    stat.penger -= del.pris;
    stat.eid[kat.id].push(del.id);
    if (kat.flere) stat.valgt[kat.id].push(del.id);
    else stat.valgt[kat.id] = del.id;
    lagre();
    tegnVerksted();
    blafr(e.verkstedPenger);
  }

  /* ---------- deler (oppgraderinger) ---------- */

  function tegnDeler() {
    e.delerPenger.textContent = penger();
    // Bilen står også her. Oppgraderinger er tall, og et barn som ser bilen
    // mens det bruker pengene, vet hva tallene gjelder.
    e.delerBil.innerHTML = Bil.svg(stat.valgt, 'd', 'bilbilde', dekktier());
    e.delerListe.innerHTML = '';

    Fysikk.OPPGRADERINGER.forEach(function (o) {
      var niva = oppg()[o.id];
      var t = Fysikk.tierInfo(niva);
      var pris = Fysikk.pris(o.data, niva);

      var rad = document.createElement('div');
      rad.className = 'delrad';
      // Fargen settes fra tieret og ikke fra en klasse per tier: ti tiere
      // × tre deler ville blitt tretti regler i CSS-en for én farge.
      rad.style.setProperty('--tierfarge', t.farge);

      /*
       * Pipene viser trinnene i *dette* tieret, ikke alle femti. Femti piper
       * på en telefonrad blir en stripe man ikke kan telle, og poenget med
       * tiere er nettopp at man alltid ser en kort vei til neste farge.
       */
      var pipper = '';
      for (var i = 1; i <= t.av; i++) {
        pipper += '<span class="pip' + (i <= t.trinn ? ' fylt' : '') + '"></span>';
      }

      var knapp = pris === null
        ? '<span class="fullt">Fullt utbygd</span>'
        : '<button class="kjopknapp" data-id="' + o.id + '">' + kr(pris) + '</button>';

      rad.innerHTML =
        '<span class="deltegn" aria-hidden="true">' + o.data.tegn + '</span>' +
        '<span class="delnavn">' + o.data.navn +
          '<small><span class="tiermerke">Tier ' + t.n + ' · ' + t.navn + '</span> ' +
          o.data.hva + '</small></span>' +
        '<span class="pipper">' + pipper + '</span>' + knapp;

      e.delerListe.appendChild(rad);
    });

    Array.prototype.forEach.call(e.delerListe.querySelectorAll('.kjopknapp'), function (k) {
      k.onclick = function () { kjopOppgradering(k.getAttribute('data-id')); };
    });
  }

  function kjopOppgradering(id) {
    var o = null;
    Fysikk.OPPGRADERINGER.forEach(function (x) { if (x.id === id) o = x; });
    var niva = oppg()[id];
    var pris = Fysikk.pris(o.data, niva);
    if (pris === null) return;
    if (stat.penger < pris) { rist(e.delerPenger); return; }

    var for_ = Fysikk.tierInfo(niva).n;
    stat.penger -= pris;
    oppg()[id] = niva + 1;
    lagre();
    tegnDeler();
    blafr(e.delerPenger);

    // Et nytt tier er det eneste kjøpet som endrer hvordan bilen ser ut.
    // Da skal hele raden si fra, ellers går fargeskiftet på felgen tapt for
    // et barn som ser på knappen det nettopp trykket.
    if (Fysikk.tierInfo(oppg()[id]).n > for_) {
      var rad = e.delerListe.querySelectorAll('.delrad')[
        Fysikk.OPPGRADERINGER.map(function (x) { return x.id; }).indexOf(id)];
      if (rad) blafr(rad);
    }
  }

  /* ---------- svar på et trykk ---------- */

  /*
   * Et kjøp skjer med én gang, uten et «Ja takk» å bekrefte med. Eieren ba
   * om det: for et barn som prøver seg fram er en dialog per kjøp et hinder,
   * ikke en trygghet.
   *
   * Da må trykket svare på en annen måte. Pengemerket blafrer når summen
   * går ned, så det er tydelig at noe kostet noe – uten det blir kjøpet helt
   * stille, og et barn som bommet på en rute ville ikke sett hvorfor pengene
   * ble færre. Det som ikke er råd til, rister i stedet.
   */
  function blafr(el) {
    el.classList.remove('blafrer');
    void el.offsetWidth;   // tvinger fram en ny animasjon
    el.classList.add('blafrer');
  }

  function rist(el) {
    el.classList.remove('rister');
    void el.offsetWidth;   // tvinger fram en ny animasjon
    el.classList.add('rister');
  }

  /* ---------- løypa ---------- */

  function passLerret() {
    var d = window.devicePixelRatio || 1;
    var r = e.lerret.getBoundingClientRect();
    e.lerret.width = Math.round(r.width * d);
    e.lerret.height = Math.round(r.height * d);
  }

  function startLop() {
    vis('skjermLop');
    passLerret();

    Bil.tegninger(stat.valgt, function (bilder) {
      bilbilde = bilder;
      // Løypa bygges på nytt for hver tur. `looper[].betalt` står igjen fra
      // forrige runde, og en gjenbrukt løype ville betalt loopene én gang.
      lope = bygde[stat.bane] = Lope.bygg(Fysikk.G, stat.bane);
      lop = Kjoring.lag(e.lerret, lope, bilder, oppg(), inntektsbonus());
      lop.start(ferdigLop);
      oppdaterHud();
    }, dekktier());
  }

  function oppdaterHud() {
    if (!lop) return;
    var t = lop.tilstand();
    e.hudPenger.textContent = kr(t.penger);
    e.hudFart.textContent = t.fart + ' km/t';
    e.framdrift.style.width = (t.andel * 100).toFixed(1) + '%';

    // Hintet er en streng og ikke et flagg: fysikken vet når det er verdt å
    // si noe, og hva. Tom streng betyr ingenting å si.
    e.hudHint.hidden = !t.hint;
    if (t.hint) e.hudHint.textContent = t.hint;

    e.turbofyll.style.height = (t.turbo * 100).toFixed(0) + '%';
    e.knappTurbo.classList.toggle('klar', t.turboKlar || t.turboPaa);
    e.knappTurbo.classList.toggle('brenner', t.turboPaa);
    if (!e.skjermLop.hidden) requestAnimationFrame(oppdaterHud);
  }

  function ferdigLop(res) {
    var ny = res.penger > rekord(stat.bane);
    stat.penger += res.penger;
    stat.turer++;
    if (ny) stat.rekord[stat.bane] = res.penger;
    if (res.penger > stat.beste) stat.beste = res.penger;
    lagre();

    e.resultatSum.textContent = kr(res.penger);
    e.resultatBil.innerHTML = Bil.svg(stat.valgt, 'r', 'bilbilde', dekktier());
    e.resultatRekord.textContent = ny
      ? 'Ny rekord på ' + Lope.finn(stat.bane).navn + '! 🏆'
      : 'Rekord: ' + kr(rekord(stat.bane));

    var b = Bil.bonus(stat.valgt);
    var bane = Lope.finn(stat.bane);
    e.resultatDetaljer.innerHTML =
      linje(bane.tegn, bane.navn) +
      linje('🟢', res.mynter + ' mynter') +
      linje('🔁', res.looper + (res.looper === 1 ? ' loop' : ' looper')) +
      linje('🛫', res.hopp + (res.hopp === 1 ? ' hopp' : ' hopp') +
                 (res.lengsteHopp ? ', lengste ' + res.lengsteHopp : '')) +
      (res.saltoer ? linje('🔄', res.saltoer + (res.saltoer === 1 ? ' salto' : ' saltoer')) : '') +
      linje('✨', 'Stilbonus ×' + b.toFixed(2)) +
      (kjoretoy().inntekt > 1
        ? linje(kjoretoy().tegn, kjoretoy().navn + ' ×' + kjoretoy().inntekt.toFixed(2))
        : '');

    // Litt pause, så det siste dollartegnet rekker å bli sett.
    setTimeout(function () { vis('skjermResultat'); }, 700);
  }

  function linje(tegn, tekst) {
    return '<div class="detaljlinje"><span aria-hidden="true">' + tegn + '</span> ' + tekst + '</div>';
  }

  function avbryt() {
    if (lop) { lop.stopp(); lop = null; }
    vis('skjermGarasje');
  }

  /* ---------- knapper ---------- */

  function hold(knapp, hva) {
    function ned(ev) { ev.preventDefault(); if (lop) lop.sett(hva, true); knapp.classList.add('trykket'); }
    function opp() { if (lop) lop.sett(hva, false); knapp.classList.remove('trykket'); }
    knapp.addEventListener('pointerdown', ned);
    knapp.addEventListener('pointerup', opp);
    knapp.addEventListener('pointercancel', opp);
    knapp.addEventListener('pointerleave', opp);
  }

  hold(e.knappGass, 'gass');
  hold(e.knappBrems, 'brems');
  hold(e.knappTurbo, 'turbo');

  // Tastatur er bare til utprøving på maskin – telefonen er hovedsaken.
  window.addEventListener('keydown', function (ev) {
    if (!lop) return;
    if (ev.key === 'ArrowRight' || ev.key === ' ') lop.sett('gass', true);
    if (ev.key === 'ArrowLeft') lop.sett('brems', true);
    if (ev.key === 'ArrowUp' || ev.key === 'Shift') lop.sett('turbo', true);
  });
  window.addEventListener('keyup', function (ev) {
    if (!lop) return;
    if (ev.key === 'ArrowRight' || ev.key === ' ') lop.sett('gass', false);
    if (ev.key === 'ArrowLeft') lop.sett('brems', false);
    if (ev.key === 'ArrowUp' || ev.key === 'Shift') lop.sett('turbo', false);
  });

  document.getElementById('knappVerksted').onclick = function () { vis('skjermVerksted'); };
  document.getElementById('knappDeler').onclick = function () { vis('skjermDeler'); };
  // KJØR-knappen finnes på tre skjermer: garasjen, verkstedet og delene.
  // Uten den på de to siste måtte barnet tilbake til garasjen bare for å
  // starte, og det er ett trykk for mye midt i «prøve den nye motoren».
  Array.prototype.forEach.call(document.querySelectorAll('.kjorknapp'), function (k) {
    k.onclick = startLop;
  });
  document.getElementById('knappBaner').onclick = function () { vis('skjermBaner'); };
  document.getElementById('knappKjoretoy').onclick = function () { vis('skjermKjoretoy'); };
  document.getElementById('knappTilbakeVerksted').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappTilbakeDeler').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappTilbakeBaner').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappTilbakeKjoretoy').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappAvbryt').onclick = avbryt;
  document.getElementById('knappIgjen').onclick = startLop;
  document.getElementById('knappGarasje').onclick = function () { vis('skjermGarasje'); };
  document.getElementById('knappTilDeler').onclick = function () { vis('skjermDeler'); };

  window.addEventListener('resize', function () {
    if (!e.skjermLop.hidden) { passLerret(); if (lop) lop.tegnEn(); }
  });

  vis('skjermGarasje');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline er en bonus, ikke et krav */ });
    });
  }
})();
