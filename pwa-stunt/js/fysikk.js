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
   * Sju nivåer per del. Det var fire, og da var bilen ferdig utbygd før
   * barnet var ferdig med å spille. Trinnene over det fjerde koster mer enn
   * hele designkatalogen til sammen, og det er meningen: de siste er noe å
   * spare til, ikke noe man passerer.
   *
   * Toppfarten på siste trinn er valgt slik at bilen rekker fra det siste
   * hoppet og helt i mål. Den er også med vilje *ikke* høyere enn det: farten
   * går inn i rekkevidden i annen potens, og et første forsøk med 1650 ga en
   * maksbil som fløy 5000 enheter og seilte over både neste rampe og alt som
   * lå mellom. Endrer du den, må avstandene i `lope.js` følge etter –
   * `tester/lope.js` sier fra hvis de ikke stemmer.
   */
  var MOTOR = {
    navn: 'Motor', tegn: '🔧', hva: 'Toppfart',
    priser:  [0, 150, 350, 650, 1000, 1500, 2200],
    verdier: [700, 790, 880, 970, 1060, 1160, 1280]
  };
  var GIR = {
    navn: 'Girkasse', tegn: '⚙️', hva: 'Akselerasjon',
    priser:  [0, 120, 300, 600, 950, 1450, 2100],
    verdier: [620, 760, 900, 1040, 1190, 1350, 1520]
  };
  var DEKK = {
    navn: 'Dekk', tegn: '🛞', hva: 'Grep i landing',
    priser:  [0, 130, 320, 620, 980, 1480, 2150],
    // Hvor mye fart en skjev landing spiser. Aldri helt til null: da ville
    // det siste trinnet fjerne en regel i stedet for å myke den opp.
    verdier: [0.45, 0.38, 0.31, 0.25, 0.19, 0.13, 0.07]
  };

  var OPPGRADERINGER = [
    { id: 'motor', data: MOTOR },
    { id: 'gir', data: GIR },
    { id: 'dekk', data: DEKK }
  ];

  function niva(data, n) {
    return data.verdier[Math.max(0, Math.min(data.verdier.length - 1, n | 0))];
  }

  function lag(lope, oppg, bonus) {

    var b = {
      s: 0, v: 0,
      flyr: false, fx: 0, fy: 0, fvx: 0, fvy: 0,
      vinkel: 0,
      hoppFra: 0, hoppStart: 0, hoppTid: 0,
      ferdig: false
    };

    var inn = { gass: false, brems: false };
    var penger = 0, mynter = 0, looper = 0, hopp = 0, lengsteHopp = 0;
    var popper = [];
    var tid = 0, staarTid = 0;

    // Hendelseslogg. Prøvene leser den for å måle avsprangsfart og
    // hopplengder; appen bryr seg ikke om den.
    var hendelser = [];

    var toppfart = niva(MOTOR, oppg.motor);
    var kraft = niva(GIR, oppg.gir);
    var landingstap = niva(DEKK, oppg.dekk);

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
      var belop = Math.max(1, Math.round(sum * bonus));
      penger += belop;
      popper.push({ x: x, y: y, tekst: tekst, belop: belop, alder: 0, stor: !!stor });
    }

    /* ---------- bakken ---------- */

    function stegBakke() {
      var pkt = Lope.ved(lope, b.s);
      var loop = Lope.iLoop(lope, b.s);
      var a = 0;

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
      if (b.v > toppfart) b.v -= (b.v - toppfart) * 2.2 * DT;
      if (loop && b.v < LOOPGULV) b.v = LOOPGULV;
      if (b.v < 0) b.v = 0;

      // Står bilen nesten stille uten at det trykkes gass, skal det si fra.
      // En bil som er blitt stående i en motbakke ser ut som en app som har
      // hengt seg, og det er den eneste måten dette spillet kan se ut som
      // det er slutt uten å være det.
      staarTid = (b.v < 45 && !inn.gass) ? staarTid + DT : 0;

      b.s += b.v * DT;
      b.vinkel = pkt.vinkel;

      if (loop && !loop.betalt && b.s > loop.til - 30) {
        loop.betalt = true;
        looper++;
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

      // Nesen følger farten. Bilen roterer altså aldri feil vei, og lander
      // alltid på hjulene – det er den samme regelen som at ingenting kan
      // gå galt i en loop.
      var mal = Math.atan2(b.fvy, b.fvx);
      b.vinkel += Lope.vinkeldiff(mal, b.vinkel) * Math.min(1, 4 * DT);

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
      b.vinkel = mark.vinkel;
      b.flyr = false;

      hendelser.push({ type: 'landing', x: mark.x, lengde: lengde, tid: b.hoppTid });
      betal(8 + lengde / 28 + b.hoppTid * 14, 'HOPP ' + lengde, mark.x, mark.y - 90, true);

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
          betal(4, '', m.x, m.y);
        }
      }
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
          fart: Math.round((b.flyr ? Math.hypot(b.fvx, b.fvy) : b.v) / 8),
          andel: Math.min(1, b.s / lope.lengde),
          flyr: b.flyr,
          staar: staarTid > 1.2 && !b.ferdig
        };
      },
      resultat: function () {
        return {
          penger: penger, mynter: mynter, looper: looper,
          hopp: hopp, lengsteHopp: lengsteHopp, tid: tid
        };
      }
    };
  }

  /*
   * Kjører en hel tur uten tegning. Brukes av prøvene: `gass` er en funksjon
   * som får tilstanden og svarer om det trykkes gass, så en prøve kan kjøre
   * både en bil som holder gassen i bunn og en som aldri rører den.
   */
  function simuler(lope, oppg, bonus, gass) {
    var f = lag(lope, oppg, bonus);
    var vakt = 0;
    while (!f.ferdig() && vakt++ < 200000) {
      f.sett('gass', gass ? gass(f.tilstand()) : true);
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
    MOTOR: MOTOR,
    GIR: GIR,
    DEKK: DEKK,
    OPPGRADERINGER: OPPGRADERINGER
  };
})();
