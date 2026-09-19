/*
 * Fysikken og økonomien i en kjøring – uten et eneste piksel.
 *
 * Dette er skilt fra `kjoring.js` med vilje. Løypa må stemmes av mot tall
 * som bare simuleringen kjenner: hvor fort bilen forlater hver rampe, hvor
 * langt den flyr, om en maksbil rekker fra siste hopp til mål. Så lenge
 * fysikken satt inne i tegnekoden, måtte hvert slikt spørsmål besvares ved
 * å starte en nettleser, kjøre løypa i sanntid og lese av en `console.log`.
 * Her kan `tester/lope.js` svare på alt sammen på et sekund.
 *
 * Modulen kjenner derfor bare `Lope` – ingen canvas, ingen DOM, ingen bil-
 * tegning. Hjulsnurringen ligger i `kjoring.js`, for den er utseende.
 *
 * Bilen har to tall: hvor langt den har kommet langs kurven (`s`) og hvor
 * fort den går (`v`). Tyngdekraften virker langs kurvens helning. Bilen
 * slipper kurven ett eneste sted: på et hopp, og da er den et vanlig kast.
 *
 * Tre steder hjelper vi bilen med vilje, fordi appen ikke skal kunne tapes:
 * i looper er tyngdekraften dempet og farten har et gulv, et hopp som ikke
 * helt rekker over får lande på kanten, og gassen har lavgir. Alle tre står
 * som tall man kan se, ikke som skjulte unntak.
 */
'use strict';

var Fysikk = (function () {

  var G = 900;               // tyngdekraft i spillenheter per sekund²
  var DT = 1 / 120;          // fast tidssteg – variabelt steg gir looper som
                             // oppfører seg ulikt på 60 og 120 Hz
  var LOOPSTOTTE = 0.45;     // hvor mye av tyngdekraften som virker i en loop
  var LOOPGULV = 170;        // laveste fart inne i en loop

  /*
   * Simulerte sekunder per virkelig sekund. Alt annet i fila er stemt av mot
   * hverandre – rampevinkler, hopplengder, myntbuer, økonomi – så farten kan
   * ikke settes ned ved å skru på tallene uten å rive opp hele avstemmingen.
   * En tidsskala senker *hele* verden likt: bilen bruker lenger tid på samme
   * løype, og ingen avstand, bue eller sum endrer seg.
   *
   * `tid` i resultatet er derfor simulerte sekunder. Virkelig varighet er
   * `tid / TIDSSKALA`, og det er det tallet `tester/lope.js` måler mot.
   */
  var TIDSSKALA = 0.78;

  /*
   * Luftkontroll. Gass spinner bilen bakover, brems forover – som i sjangeren
   * ellers, og det er den fysiske intuisjonen: hjulene får gass, og kroppen
   * roterer motsatt vei.
   *
   * Rotasjonen er *bare* tegning. Landingen leser farten, ikke hvordan bilen
   * ser ut, så en bil som lander opp-ned lander like trygt som en som står
   * rett. Det er samme regel som at ingenting kan gå galt i en loop: her
   * finnes det ingen måte å tape på, så en salto kan bare gi noe.
   */
  var LUFTKRAFT = 7.5;       // rad/s² fra gass eller brems i lufta
  var MAKSSPINN = 8.0;       // rad/s
  var SALTOLONN = 45;
  var RETTING = 14;          // hvor fort bilen retter seg opp etter landing

  /*
   * En salto betales først når bilen lander noenlunde rett. Det er det som
   * gjør den til en *kontroll* og ikke til gratis penger: holder man bare
   * gassen, snurrer bilen videre og lander på taket. Slipper man begge
   * knappene, retter den seg mot nærmeste hele runde – spinn opp, slipp,
   * land flatt.
   *
   * En bom koster ingenting. Det er hele premisset: her finnes det ingen måte
   * å tape på, så en mislykket salto er en uteblitt bonus, aldri en straff.
   */
  var SALTOVINDU = 0.75;     // radianer fra rett opp som godtas i landingen
  var SALTORETT = 2.4;       // hvor fort bilen søker mot hel runde uten trykk
  var SPINNDEMP = 4.0;       // hvor fort spinnet ebber ut uten trykk

  /*
   * Turbo. Måleren fylles av mynter og looper, så det man plukker underveis
   * blir til noe man kan bruke – ikke bare til et tall på skjermen.
   *
   * Taket er med vilje bare 15 % over toppfarten. Myntbuene over hoppene er
   * regnet ut fra en *målt* avsprangsfart (`REFERANSEFART` i `lope.js`), og
   * en turbo som ga vesentlig mer fart ville sendt bilen i en bue langt over
   * sine egne mynter. Kreften er derimot dobbel, så turboen kjennes på det
   * som faktisk er tregt: opp en bakke og ut av en loop.
   */
  var TURBOKRAFT = 2.0;      // ganger girkraften, på toppen av gassen
  var TURBOTAK = 1.15;       // hvor mye toppfarten løftes mens den brenner
  var TURBOBRUK = 0.9;       // andel av måleren per sekund
  var TURBOMYNT = 0.055;     // påfyll per mynt
  var TURBOLOOP = 0.15;      // påfyll per loop
  var TURBOMIN = 0.22;       // laveste stand som kan tennes
  var TURBOSTART = 0.35;     // med i tanken fra start, så den kan prøves tidlig

  /* ---------- oppgraderinger: seks tiere à fem trinn ---------- */

  /*
   * Det var sju nivåer per del, og bilen var ferdig utbygd etter rundt tjue
   * turer. Nå er det seks *tiere* med fem trinn i hver – tretti kjøpbare
   * trinn per del, nitti i alt. Hvert tier har sin egen farge, og siste trinn
   * i et tier løfter bilen inn i det neste.
   *
   * Tre ting henger sammen her, og det ene går ikke an uten det andre:
   *
   *   Ytelsen har *samme tak som før*. Toppfarten på siste trinn er den
   *   samme 1280 som den måtte være: farten går inn i hopplengden i annen
   *   potens, og et forsøk med 1650 ga en maksbil som fløy 5000 enheter og
   *   seilte over både neste rampe og alt som lå mellom. Flere tiere gir
   *   altså *finere* trinn, ikke en raskere bil – «litt og litt bedre».
   *
   *   Prisene dobler seg nesten for hvert tier. Uten det er tier 6 kjøpt opp
   *   på et par turer, og de fem første var bare en teller.
   *
   *   Inntekten må følge etter, ellers blir de siste tierne en vegg. Derfor
   *   `teknikkbonus()`: hvert kjøpte trinn ganger opp alt man tjener, akkurat
   *   som stilbonusen gjør for pynt. Det er dette som gjør at man tjener mer
   *   og mer jo lenger man kommer.
   *
   * `tester/lope.js` spiller gjennom hele progresjonen og sier fra hvis de tre
   * driver fra hverandre.
   */
  var TIERE = 6;
  var TRINN = 5;                      // kjøpbare trinn i hvert tier
  var MAKSNIVA = TIERE * TRINN;       // 30 per del

  // Navnene og fargene brukes både på felgen og i verkstedet, så et tier ser
  // likt ut uansett hvor barnet møter det.
  var TIER = [
    { navn: 'Stål',    farge: '#9aa7bd' },
    { navn: 'Smaragd', farge: '#4ade80' },
    { navn: 'Safir',   farge: '#38bdf8' },
    { navn: 'Ametyst', farge: '#c084fc' },
    { navn: 'Magma',   farge: '#ff8a2b' },
    { navn: 'Plasma',  farge: '#ff2d95' }
  ];

  /*
   * Tieret et nivå hører til. Merk at siste trinn i et tier *flytter* bilen
   * opp: nivå 5 er «tier 2, null av fem», ikke «tier 1, fem av fem». Det er
   * det som gjør at kjøpet man sparte til, gir en ny farge med en gang.
   * Unntaket er toppen: nivå 30 blir stående som tier 6, fullt utbygd.
   */
  function tierAv(nivaa) {
    return Math.min(TIERE, Math.floor(grense(nivaa) / TRINN) + 1);
  }

  function grense(nivaa) {
    return Math.max(0, Math.min(MAKSNIVA, nivaa | 0));
  }

  function tierInfo(nivaa) {
    var n = grense(nivaa);
    var t = tierAv(n);
    return {
      n: t,
      navn: TIER[t - 1].navn,
      farge: TIER[t - 1].farge,
      trinn: n - (t - 1) * TRINN,     // 0..TRINN
      av: TRINN,
      full: n >= MAKSNIVA
    };
  }

  /* ---------- fra en gammel lagring til dagens skala ---------- */

  /*
   * Før tierne hadde hver del sju nivåer, 0 til 6. En bil som var fullt
   * utbygd der, skal begynne på **starten av tier 2** – ikke på toppen av
   * tier 6.
   *
   * Det er en retting av en tidligere migrering, ikke en ny idé. Versjon 2
   * ganget det gamle nivået med `TRINN`, og da landet en maksbil rett på
   * trinn 30: ferdig utbygd i samme øyeblikk som appen oppdaterte seg, med
   * hele det nye systemet oppbrukt før det var prøvd. Eierens to barn hadde
   * begge maksa bilen, og fikk seks tiere de aldri kom til å spille.
   *
   * Begge veiene inn må derfor rettes, for versjon 2 rakk å bli lagret hos
   * dem som åpnet appen mens den lå ute:
   *
   *   ingen versjon   gammelt nivå 0..6        → skaleres inn i tier 1
   *   versjon 2       gammelt nivå ganget ×5   → deles på TRINN først
   *   versjon 3+      allerede dagens skala    → står som det er
   *
   * Taket på `TRINN` er det som gjør at «makset» blir nøyaktig tier 2, trinn
   * null. Penger, design og rekord røres ikke: det er bare ytelsen som
   * spoles tilbake, og det er den progresjonen som skal spilles på nytt.
   */
  var GAMMEL_TOPP = 6;

  function fraGammelLagring(nivaa, versjon) {
    var n = Math.max(0, Number(nivaa) || 0);
    if (versjon >= 3) return grense(n);
    if (versjon === 2) n = n / TRINN;
    return Math.min(TRINN, Math.round(n * TRINN / GAMMEL_TOPP));
  }

  var MOTOR = {
    navn: 'Motor', tegn: '🔧', hva: 'Toppfart',
    fra: 700, til: 1280, grunnpris: 150
  };
  var GIR = {
    navn: 'Girkasse', tegn: '⚙️', hva: 'Akselerasjon',
    fra: 620, til: 1520, grunnpris: 120
  };
  var DEKK = {
    navn: 'Dekk', tegn: '🛞', hva: 'Grep i landing',
    // Hvor mye fart en skjev landing spiser. Aldri helt til null: da ville
    // det siste trinnet fjerne en regel i stedet for å myke den opp.
    fra: 0.45, til: 0.07, grunnpris: 130
  };

  var OPPGRADERINGER = [
    { id: 'motor', data: MOTOR },
    { id: 'gir', data: GIR },
    { id: 'dekk', data: DEKK }
  ];

  // Ytelsen går rett fra bunn til tak over de tretti trinnene. Ingen kurve:
  // et tier skal kjennes likt uansett hvilket det er, og det er prisen og
  // fargen som skiller dem, ikke hvor mye hvert trinn gir.
  function niva(data, n) {
    return data.fra + (data.til - data.fra) * (grense(n) / MAKSNIVA);
  }

  var TIERFAKTOR = 2.35;      // hvor mye dyrere hvert tier er enn det forrige
  var TRINNOKNING = 0.30;     // hvor mye dyrere hvert trinn er inne i et tier

  /*
   * Hva det koster å gå fra `nivaa` til `nivaa + 1`. Tieret er det man står i
   * mens man kjøper, altså `tierAv(nivaa)` og ikke tieret man havner i.
   * Avrundingen til nærmeste femmer er bare for at tallene skal være til å se
   * på; på de øverste tierne runder den av til hundre.
   */
  function pris(data, nivaa) {
    var n = grense(nivaa);
    if (n >= MAKSNIVA) return null;
    var t = tierAv(n);
    var i = n - (t - 1) * TRINN;
    var p = data.grunnpris * Math.pow(TIERFAKTOR, t - 1) * (1 + TRINNOKNING * i);
    var steg = p > 5000 ? 100 : 5;
    return Math.round(p / steg) * steg;
  }

  /*
   * Teknikkbonusen. Den ganger opp alt man tjener i løypa, på samme måte som
   * stilbonusen fra pynt – og den er svaret på «man tjener mer og mer penger
   * etter hvert som man oppgraderer».
   *
   * Den må være der. Ytelsen har et tak, så en ferdig bygd bil kjører ikke
   * nevneverdig fortere enn en halvferdig og ville tjent omtrent det samme –
   * mens prisene i tier 6 er hundre ganger dem i tier 1.
   */
  var TEKNIKK = 3.0;          // hvor mye fullt utbygd ganger opp

  function teknikkbonus(oppg) {
    var sum = 0;
    for (var i = 0; i < OPPGRADERINGER.length; i++) {
      sum += grense(oppg ? oppg[OPPGRADERINGER[i].id] : 0);
    }
    return 1 + TEKNIKK * sum / (OPPGRADERINGER.length * MAKSNIVA);
  }

  function lag(lope, oppg, bonus) {

    var b = {
      s: 0, v: 0,
      flyr: false, fx: 0, fy: 0, fvx: 0, fvy: 0,
      vinkel: 0,
      // Luftvinkelen er nesen som følger farten; `snurret` er saltoen som
      // legges oppå, og `retting` er det som er igjen av den etter landing.
      luftvinkel: 0, spinn: 0, snurret: 0, runder: 0, retting: 0,
      turbo: TURBOSTART, turboPaa: false,
      hoppFra: 0, hoppStart: 0, hoppTid: 0,
      ferdig: false
    };

    var inn = { gass: false, brems: false, turbo: false };
    var penger = 0, mynter = 0, looper = 0, hopp = 0, lengsteHopp = 0, saltoer = 0;
    var popper = [];
    var tid = 0, staarTid = 0;

    // Hendelseslogg. Prøvene leser den for å måle avsprangsfart og
    // hopplengder; appen bryr seg ikke om den.
    var hendelser = [];

    var toppfart = niva(MOTOR, oppg.motor);
    var kraft = niva(GIR, oppg.gir);
    var landingstap = niva(DEKK, oppg.dekk);

    // De to bonusene ganges sammen: pynt og teknikk er to uavhengige måter å
    // tjene mer på, og begge skal lønne seg uten å gjøre den andre unødig.
    var sats = bonus * teknikkbonus(oppg);

    for (var i = 0; i < lope.mynter.length; i++) lope.mynter[i].tatt = false;
    for (i = 0; i < lope.looper.length; i++) lope.looper[i].betalt = false;

    /* ---------- penger ---------- */

    /*
     * Alle beløp går gjennom her, og alle ganges med stilbonusen. Tallene
     * står i README-en sammen med hva en umodifisert og en fullt utstyrt bil
     * kjører inn på én tur. De to henger sammen: en sterk bil flyr over
     * strekninger og mister mynter, så den tjener ikke proporsjonalt mer.
     */
    function betal(sum, tekst, x, y, stor) {
      var belop = Math.max(1, Math.round(sum * sats));
      penger += belop;
      popper.push({ x: x, y: y, tekst: tekst, belop: belop, alder: 0, stor: !!stor });
    }

    /* ---------- bakken ---------- */

    /*
     * Turboen har en sperre nedover, ikke oppover: den kan ikke *tennes* under
     * `TURBOMIN`, men en turbo som allerede brenner får tømme tanken. Uten
     * sperren blir knappen et konstant lite dytt i stedet for noe man sparer
     * på, og uten unntaket slukner den midt i en bakke med en fjerdedel igjen.
     */
    function turboSteg() {
      if (!inn.turbo || b.turbo <= 0) { b.turboPaa = false; return false; }
      if (!b.turboPaa && b.turbo < TURBOMIN) { return false; }
      b.turboPaa = true;
      b.turbo = Math.max(0, b.turbo - TURBOBRUK * DT);
      return true;
    }

    function fyllTurbo(mengde) {
      b.turbo = Math.min(1, b.turbo + mengde);
    }

    function stegBakke() {
      var pkt = Lope.ved(lope, b.s);
      var loop = Lope.iLoop(lope, b.s);
      var brenner = turboSteg();
      var tak = toppfart * (brenner ? TURBOTAK : 1);
      var a = 0;

      /*
       * Turbokraften toner ut mot sitt eget tak, på samme måte som lavgiret
       * toner ut mot toppfarten. Et første forsøk la på en fast kraft og
       * stolte på at den myke toppfartsbremsen holdt igjen – den bremser med
       * 2,2 per sekund, og en maksbil med turbo fant likevel likevekt langt
       * over 2000. Den fløy 8745 enheter, hoppet over to ramper og seilte
       * tvers gjennom løypa.
       */
      // Gulvet på 0,15 er der for at knappen aldri skal kjennes død: en bil
      // som allerede ligger på taket sitt, skal fortsatt få et dytt og et
      // flammesprut når barnet trykker.
      if (brenner) a += kraft * TURBOKRAFT * Math.max(0.15, 1 - b.v / tak);

      /*
       * Lavgir: gassen tar hardest når bilen står nesten stille, og ebber ut
       * mot toppfarten. Uten dette kunne en umodifisert bil bli stående på
       * den bratteste rampa – 45 grader koster mer enn motoren gir – og da
       * sto barnet fast i en app som ikke skal kunne tapes, uten noe å
       * trykke på som hjalp. Med lavgiret kommer enhver bil opp overalt,
       * bare langsomt hvis den er svak.
       */
      if (inn.gass) a += kraft * (1 + 1.3 * (1 - Math.min(1, b.v / toppfart)));
      if (inn.brems) a -= b.v > 0 ? kraft * 1.4 : 0;

      // Positiv vinkel = løypa peker nedover på skjermen, og da drar
      // tyngdekraften bilen framover.
      a += G * Math.sin(pkt.vinkel) * (loop ? LOOPSTOTTE : 1);
      a -= b.v * 0.30;

      b.v += a * DT;

      // Toppfarten er ikke et hardt tak: en bratt utforbakke skal kunne gi
      // mer, den skal bare ebbe ut igjen.
      if (b.v > tak) b.v -= (b.v - tak) * 2.2 * DT;
      if (loop && b.v < LOOPGULV) b.v = LOOPGULV;
      if (b.v < 0) b.v = 0;

      // Står bilen nesten stille uten at det trykkes gass, skal det si fra.
      // En bil som er blitt stående i en motbakke ser ut som en app som har
      // hengt seg, og det er den eneste måten dette spillet kan se ut som
      // det er slutt uten å være det.
      staarTid = (b.v < 45 && !inn.gass) ? staarTid + DT : 0;

      b.s += b.v * DT;

      // Landet bilen skjevt, står `retting` igjen og ebber ut. Uten den
      // smeller bilen fra opp-ned til blank rett i én bilderute, og saltoen
      // ser ut som en tegnefeil i stedet for et stunt som gikk bra.
      b.vinkel = pkt.vinkel + b.retting;
      if (b.retting) {
        b.retting *= 1 - RETTING * DT;
        if (Math.abs(b.retting) < 0.01) b.retting = 0;
      }

      if (loop && !loop.betalt && b.s > loop.til - 30) {
        loop.betalt = true;
        looper++;
        fyllTurbo(TURBOLOOP);
        hendelser.push({ type: 'loop', x: pkt.x, v: b.v });
        betal(35, 'LOOP!', pkt.x, pkt.y, true);
      }

      if (b.s >= lope.lengde) {
        b.s = lope.lengde;
        avslutt();
        return;
      }

      var p = lope.punkter[pkt.i];
      if (p && p.hopp && b.v > 40) startHopp(pkt);
    }

    /* ---------- lufta ---------- */

    function startHopp(pkt) {
      b.flyr = true;
      b.fx = pkt.x;
      b.fy = pkt.y;
      b.fvx = Math.cos(pkt.vinkel) * b.v;
      b.fvy = Math.sin(pkt.vinkel) * b.v;
      b.hoppFra = pkt.x;
      b.hoppStart = pkt.i;
      b.hoppTid = 0;
      b.luftvinkel = pkt.vinkel;
      b.spinn = 0;
      b.snurret = 0;
      b.runder = 0;
      b.retting = 0;
      b.turboPaa = false;   // ingen motorkraft uten bakke under hjulene
      hendelser.push({
        type: 'avsprang', x: pkt.x, v: b.v,
        grader: pkt.vinkel * 180 / Math.PI
      });
    }

    // Første faste punkt foran bilen. Loop-punkter hoppes over: de ligger i
    // lufta, og en bil på vei ned skal ikke lande midt i en loop.
    function bakkePunkt(fra, x) {
      var p = lope.punkter;
      for (var i = fra; i < p.length; i++) {
        if (p[i].bakke && p[i].x >= x) return p[i];
      }
      return p[p.length - 1];
    }

    function stegLuft() {
      b.fvy += G * DT;
      b.fx += b.fvx * DT;
      b.fy += b.fvy * DT;
      b.hoppTid += DT;

      // Gass spinner bakover, brems forover. Trykkes begge, står det stille –
      // det er riktig svar og krever ingen egen regel.
      if (inn.gass) b.spinn -= LUFTKRAFT * DT;
      if (inn.brems) b.spinn += LUFTKRAFT * DT;
      if (b.spinn > MAKSSPINN) b.spinn = MAKSSPINN;
      if (b.spinn < -MAKSSPINN) b.spinn = -MAKSSPINN;

      if (!inn.gass && !inn.brems) {
        b.spinn *= 1 - SPINNDEMP * DT;
        var hel = Math.round(b.snurret / (Math.PI * 2)) * Math.PI * 2;
        b.snurret += (hel - b.snurret) * Math.min(1, SALTORETT * DT);
      }

      b.snurret += b.spinn * DT;
      b.runder = Math.floor(Math.abs(b.snurret) / (Math.PI * 2));

      // Nesen følger farten, og saltoen legges oppå. Landingen leser farten
      // og ikke tegningen, så bilen lander like trygt opp-ned – det er den
      // samme regelen som at ingenting kan gå galt i en loop.
      var mal = Math.atan2(b.fvy, b.fvx);
      b.luftvinkel += Lope.vinkeldiff(mal, b.luftvinkel) * Math.min(1, 4 * DT);
      b.vinkel = b.luftvinkel + b.snurret;

      var mark = bakkePunkt(b.hoppStart, b.fx);

      // Rekker ikke bilen over, får den kanten. Alternativet er en bil som
      // synker ned i hullet, og det er en måte å tape på.
      var kortet = b.fx < mark.x && b.fy > mark.y;

      if (b.fy >= mark.y || kortet) land(mark);
    }

    function land(mark) {
      var lengde = Math.round(b.fx - b.hoppFra);
      if (lengde > lengsteHopp) lengsteHopp = lengde;
      hopp++;

      var fart = Math.hypot(b.fvx, b.fvy);
      var diff = Math.abs(Lope.vinkeldiff(Math.atan2(b.fvy, b.fvx), mark.vinkel));
      // En landing rett ned i en flat bakke koster fart. Bedre dekk koster
      // mindre. Full stopp finnes ikke.
      b.v = Math.max(120, fart * (1 - landingstap * Math.min(1, diff / (Math.PI / 2))));

      b.s = mark.s;
      // Det som er igjen av saltoen tas med ned og rettes opp på bakken.
      // `vinkeldiff` gir korteste vei, så bilen aldri snurrer den lange veien
      // tilbake etter halvannen runde.
      b.retting = Lope.vinkeldiff(b.vinkel, mark.vinkel);
      b.vinkel = mark.vinkel + b.retting;
      b.spinn = 0;
      b.flyr = false;

      hendelser.push({
        type: 'landing', x: mark.x, lengde: lengde, tid: b.hoppTid,
        runder: b.runder, rett: Math.abs(b.retting) < SALTOVINDU
      });
      betal(8 + lengde / 28 + b.hoppTid * 14, 'HOPP ' + lengde, mark.x, mark.y - 90, true);

      // Saltoen betales her, og bare hvis bilen kom ned på hjulene.
      if (b.runder > 0 && Math.abs(b.retting) < SALTOVINDU) {
        saltoer += b.runder;
        betal(SALTOLONN * b.runder,
              (b.runder > 1 ? b.runder + '× ' : '') + 'SALTO!',
              mark.x, mark.y - 150, true);
      }

      // Landet bilen på eller forbi målstreken, er turen over med en gang.
      // Uten dette ville en maksbil som flyr helt fram, lande og så trille
      // videre i et løype-punkt den allerede har passert.
      if (b.s >= lope.lengde) avslutt();
    }

    function taMynter() {
      var pos = b.flyr ? { x: b.fx, y: b.fy } : Lope.ved(lope, b.s);
      for (var i = 0; i < lope.mynter.length; i++) {
        var m = lope.mynter[i];
        if (m.tatt) continue;
        if (Math.abs(m.x - pos.x) < 62 && Math.abs(m.y - (pos.y - 40)) < 66) {
          m.tatt = true;
          mynter++;
          fyllTurbo(TURBOMYNT);
          betal(4, '', m.x, m.y);
        }
      }
    }

    /*
     * Ett hint om gangen, og bare når det trengs. «Trykk på gass» er det som
     * berger en bil som er blitt stående; salto-hintet vises bare til barnet
     * har fått sin første, for etter det er det ingen nyhet.
     */
    function hint() {
      if (b.ferdig) return '';
      if (staarTid > 1.2) return 'Trykk på gass! 👉';
      if (!b.flyr || saltoer > 0) return '';
      // To trinn, fordi saltoen har to: få den rundt, og så lande den.
      if (b.runder > 0) return 'Slipp, så lander du rett! 👐';
      if (b.hoppTid > 0.3) return 'Hold gass i lufta = salto! 🔄';
      return '';
    }

    function avslutt() {
      if (b.ferdig) return;
      b.ferdig = true;
      var mal = Lope.ved(lope, lope.lengde);
      betal(30, 'I MÅL!', mal.x, mal.y - 90, true);
    }

    /* ---------- utsiden ---------- */

    function steg(dt) {
      if (b.ferdig) return;
      tid += dt;
      if (b.flyr) stegLuft(); else stegBakke();
      taMynter();
    }

    return {
      DT: DT,
      bil: b,
      popper: popper,
      hendelser: hendelser,
      steg: function () { steg(DT); },
      sett: function (hva, pa) { inn[hva] = pa; },
      ferdig: function () { return b.ferdig; },
      posisjon: function () {
        return b.flyr ? { x: b.fx, y: b.fy } : Lope.ved(lope, b.s);
      },
      tilstand: function () {
        return {
          penger: penger,
          // Hastigheten vises slik den *ser ut*, altså gjennom tidsskalaen.
          // Et tall som sier 160 mens bilen tydelig går saktere, leser som
          // at måleren er ødelagt.
          fart: Math.round((b.flyr ? Math.hypot(b.fvx, b.fvy) : b.v) * TIDSSKALA / 8),
          andel: Math.min(1, b.s / lope.lengde),
          flyr: b.flyr,
          runder: b.runder,
          turbo: b.turbo,
          turboPaa: b.turboPaa,
          turboKlar: b.turbo >= TURBOMIN,
          hint: hint()
        };
      },
      resultat: function () {
        return {
          penger: penger, mynter: mynter, looper: looper,
          hopp: hopp, lengsteHopp: lengsteHopp, saltoer: saltoer, tid: tid
        };
      }
    };
  }

  /*
   * Kjører en hel tur uten tegning. Brukes av prøvene: `gass` og `turbo` er
   * funksjoner som får tilstanden og svarer om knappen holdes, så en prøve
   * kan kjøre både en bil som holder alt i bunn og en som aldri rører noe.
   *
   * `turbo` er som standard *av*. Tallene løypa er stemt av mot, er målt på
   * en bil uten turbo, og de skal fortsette å bety det samme.
   */
  function simuler(lope, oppg, bonus, gass, turbo) {
    var f = lag(lope, oppg, bonus);
    var vakt = 0;
    while (!f.ferdig() && vakt++ < 200000) {
      var t = f.tilstand();
      f.sett('gass', gass ? gass(t) : true);
      f.sett('turbo', turbo ? turbo(t) : false);
      f.steg();
    }
    var ut = f.resultat();
    ut.hendelser = f.hendelser;
    ut.kjortFerdig = f.ferdig();
    return ut;
  }

  return {
    lag: lag,
    simuler: simuler,
    G: G,
    DT: DT,
    TIDSSKALA: TIDSSKALA,
    TURBOMIN: TURBOMIN,
    TIERE: TIERE,
    TRINN: TRINN,
    MAKSNIVA: MAKSNIVA,
    tierInfo: tierInfo,
    fraGammelLagring: fraGammelLagring,
    LAGRINGSVERSJON: 3,
    pris: pris,
    verdi: niva,
    teknikkbonus: teknikkbonus,
    MOTOR: MOTOR,
    GIR: GIR,
    DEKK: DEKK,
    OPPGRADERINGER: OPPGRADERINGER
  };
})();
