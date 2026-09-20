/*
 * Løypene: én sammenhengende kurve per bane, punkt for punkt.
 *
 * Dette er det bærende valget i hele appen. Bilen er ikke et stivt legeme
 * med hjul og fjærer – den er en posisjon langs en kurve, og farten endres
 * av hvor bratt kurven står. Da blir en loop bare en sirkel i punktlista,
 * og den er riktig hver eneste gang. Ekte kollisjonsfysikk ville krevd et
 * bibliotek (som repoet ikke har) og gitt looper der bilen faller gjennom
 * asfalten når bildefrekvensen dipper.
 *
 * Prisen er at bilen ikke kan velte. For målgruppen her er det en fordel:
 * man kommer alltid i mål, det varierer bare hvor fort.
 *
 * Hvert punkt har `s` (avstand langs løypa), `bakke` (om det er fast grunn
 * eller en del av en loop) og `sone` (underlag eller byggverk – is, gjørme,
 * tunnel, bro, rumlefelt). Fyllet under løypa tegnes bare under bakken – en
 * loop skal ha himmel på begge sider, og det skal en bro også.
 *
 * ---------------------------------------------------------------------------
 * Å legge til en bane
 * ---------------------------------------------------------------------------
 * Skriv en ny post i `BANER` med en `bygg`-funksjon som får byggesettet. Alt
 * annet følger av seg selv: kortet i banevelgeren, høydeprofilen på kortet,
 * merkene som sier hvilke elementer banen har, rekorden per bane, og hele
 * prøvesettet i `tester/lope.js` – det går gjennom *alle* banene og krever det
 * samme av hver.
 *
 * To regler holder banen kjørbar, og prøven sier fra hvis de brytes:
 *
 *   Bilen lander bare på fast grunn. En loop innenfor rekkevidden til et
 *   hopp er derfor ikke noe bilen treffer – den seiler tvers gjennom loopens
 *   asfalt i lufta. Hold loopene unna flybanene.
 *
 *   Rampene må ha luft foran seg. Lander bilen oppå den neste rampa, hopper
 *   den aldri fra den.
 */
'use strict';

var Lope = (function () {

  var STEG = 7;          // avstand mellom punktene, i spillenheter
  var MYNTAVSTAND = 300; // hvor tett myntene ligger langs løypa

  /*
   * Soner er underlag og byggverk. De er den ene tingen som gjør at to baner
   * med samme bakker kjennes helt forskjellige: is og gjørme endrer hvordan
   * bilen oppfører seg, tunnel og bro endrer hva man ser.
   *
   * `luft: true` betyr at det ikke skal fylles jord under. Bilen kjører og
   * lander der som normalt – det er bare bakken som mangler, og i stedet
   * tegnes et stillas.
   */
  var SONER = {
    is:      { navn: 'Is',        tegn: '🧊', friksjon: 0.35, brems: 0.30 },
    gjorme:  { navn: 'Gjørme',    tegn: '🟤', friksjon: 2.40, brems: 1 },
    rumle:   { navn: 'Rumlefelt', tegn: '〰️', friksjon: 1.35, brems: 1, rister: true },
    tunnel:  { navn: 'Tunnel',    tegn: '🕳️', friksjon: 1,    brems: 1 },
    bro:     { navn: 'Bro',       tegn: '🌉', friksjon: 1,    brems: 1, luft: true }
  };

  /*
   * Tyngdekraften kommer utenfra fordi myntbuene over hoppene *er* bilens
   * kastebane. Regnet buene med sin egen konstant, ville de sluttet å stemme
   * i samme øyeblikk som noen justerte fysikken – og det er nettopp det å
   * ikke stemme som var feilen med den forrige buen.
   */
  function bygg(tyngde, baneId) {
    var G = tyngde || 900;
    var bane = finn(baneId);

    var p = [];
    var x = 0, y = 0;
    var sone = null;
    var loopIndeks = [];

    function legg(nx, ny, bakke, hopp) {
      p.push({ x: nx, y: ny, bakke: bakke !== false, hopp: !!hopp, sone: sone });
    }

    legg(x, y);

    // Alle bakkesegmentene er en funksjon av x, og samples med samme steg.
    function grunn(lengde, f) {
      var n = Math.max(2, Math.round(lengde / STEG));
      var y0 = y;
      for (var i = 1; i <= n; i++) {
        var t = i / n;
        legg(x + lengde * t, y0 + f(t), true);
      }
      x += lengde;
      y = y0 + f(1);
    }

    /* ---------- byggesettet en baneoppskrift har til rådighet ---------- */

    var b = {};

    b.flat = function (lengde) { grunn(lengde, function () { return 0; }); };

    // Myk kul: opp og ned igjen, uten knekk i endene.
    b.kul = function (lengde, h) {
      grunn(lengde, function (t) { return -h * Math.sin(Math.PI * t) * Math.sin(Math.PI * t); });
    };

    // Jevn overgang til et nytt nivå. Positiv dh er nedover på skjermen.
    b.trapp = function (lengde, dh) {
      grunn(lengde, function (t) { return dh * (1 - Math.cos(Math.PI * t)) / 2; });
    };

    b.bolger = function (lengde, antall, h) {
      grunn(lengde, function (t) { return -h * (1 - Math.cos(2 * Math.PI * antall * t)) / 2; });
    };

    /*
     * Loop. Bilen går inn nederst mot høyre, opp høyresiden, over toppen og
     * ned venstresiden. Sirkelen driver litt mot høyre underveis, slik at
     * inn- og utgang ikke ligger oppå hverandre – ellers ser det ut som
     * løypa har en knekk der den egentlig bare er tilbake der den startet.
     */
    b.loop = function (r, drift) {
      var cx = x, cy = y - r;
      var n = Math.max(40, Math.round(2 * Math.PI * r / STEG));
      var fra = p.length;
      for (var i = 1; i <= n; i++) {
        var fi = 2 * Math.PI * i / n;
        legg(cx + Math.sin(fi) * r + drift * fi / (2 * Math.PI),
             cy + Math.cos(fi) * r, false);
      }
      /*
       * Hver loop skriver seg selv opp her. Før ble strekningene funnet ved å
       * lete etter sammenhengende punkter uten bakke, og det holdt så lenge
       * det alltid var asfalt mellom to looper. I en korketrekker er det ikke
       * det: de to rundene smeltet sammen til én strekning, og barnet fikk
       * betalt én gang for to looper.
       */
      loopIndeks.push({ fra: fra, til: p.length - 1 });
      x += drift;
    };

    /*
     * Korketrekker: flere looper rett etter hverandre, uten flatt mellom.
     * Radien krymper litt for hver runde, så den ser ut som en spiral som
     * strammer seg i stedet for som den samme loopen klistret opp to ganger.
     */
    b.korketrekker = function (r, drift, antall) {
      for (var i = 0; i < (antall || 2); i++) b.loop(r - i * 8, drift);
    };

    // Vaskebrett. Korte, tette bølger som rister bilen og spiser litt fart.
    b.rumlefelt = function (lengde, antall) {
      b.sone('rumle', function () { b.bolger(lengde, antall || 9, 16); });
    };

    // Rampe med økende bratthet, så avspranget peker oppover.
    b.rampe = function (lengde, h) {
      grunn(lengde, function (t) { return -h * t * t; });
      p[p.length - 1].hopp = true;
    };

    // Hoppet selv har ingen punkter: bilen flyr, og lander på det neste
    // bakkesegmentet. Vi flytter bare pennen fram og ned.
    b.gap = function (lengde, fall) { x += lengde; y += fall; legg(x, y, true); };

    /*
     * Alt som lages inne i `f` får sonen. Den settes og tas av igjen rundt
     * kallet i stedet for å slås på og av med to setninger – en sone som ble
     * glemt påslått, ville farget resten av banen, og det er ikke noe man ser
     * før man kjører hele veien til mål.
     */
    b.sone = function (navn, f) {
      var for_ = sone;
      sone = navn;
      f();
      sone = for_;
    };

    bane.bygg(b);

    /* ---------- etterarbeid ---------- */

    // Buelengde og tangent. Vinkelen er positiv når løypa peker nedover på
    // skjermen, som er den samme retningen tyngdekraften drar.
    p[0].s = 0;
    for (var i = 1; i < p.length; i++) {
      p[i].s = p[i - 1].s + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    }
    /*
     * Tangenten er snittet av naboene – bortsett fra på hver side av et gap,
     * der den må regnes ensidig.
     *
     * Naboen på den andre siden av et hopp ligger flere hundre enheter unna
     * og som regel lavere. Tar man snittet over gapet, blir tangenten på en
     * 45-graders rampe til noen få grader *nedover*, og bilen forlater rampa
     * med nesa ned i stedet for å bli kastet opp. Landingspunktet fikk samme
     * behandling motsatt vei.
     */
    for (i = 0; i < p.length; i++) {
      var fra = Math.max(0, i - 1), til = Math.min(p.length - 1, i + 1);
      if (p[i].hopp) til = i;                     // avsprang: bare bakover
      else if (i > 0 && p[i - 1].hopp) fra = i;   // landing: bare framover
      if (fra === til) { fra = Math.max(0, i - 1); til = Math.min(p.length - 1, i + 1); }
      p[i].vinkel = Math.atan2(p[til].y - p[fra].y, p[til].x - p[fra].x);
    }

    // Looper som strekninger langs løypa, så kjøringen vet når den skal
    // hjelpe bilen rundt og når den skal betale for en fullført runde.
    var looper = loopIndeks.map(function (L) {
      return { fra: p[L.fra].s, til: p[L.til].s, betalt: false };
    });

    var lope = {
      id: bane.id,
      bane: bane,
      punkter: p,
      lengde: p[p.length - 1].s,
      looper: looper,
      mynter: [],
      hoyest: 0,
      lavest: 0
    };

    for (i = 0; i < p.length; i++) {
      if (p[i].y < lope.hoyest) lope.hoyest = p[i].y;
      if (p[i].y > lope.lavest) lope.lavest = p[i].y;
    }

    leggMynter(lope, G);
    return lope;
  }

  // Målt avsprangsfart for en umodifisert bil. Buene tegnes for den, ikke
  // for en fullt utstyrt: den svakeste bilen skal treffe myntene, de sterke
  // flyr over og bytter mynter mot lengde. Endrer du motor eller ramper, mål
  // på nytt – det står i README-en hvordan.
  var REFERANSEFART = 750;

  /*
   * Myntene ligger et stykke over løypa, langs normalen. I en loop peker
   * normalen innover, så myntene havner inni loopen – akkurat der bilen
   * kjører. Det er også det som gjør at en loop lønner seg: du plukker et
   * dusin mynter på en runde du uansett skulle kjørt.
   */
  function leggMynter(lope, G) {
    var p = lope.punkter, neste = 260;
    for (var i = 1; i < p.length - 1; i++) {
      if (p[i].s < neste) continue;
      neste = p[i].s + MYNTAVSTAND;
      var t = p[i].vinkel;
      var nx = Math.sin(t), ny = -Math.cos(t);
      lope.mynter.push({ x: p[i].x + nx * 52, y: p[i].y + ny * 52, tatt: false });
    }

    /*
     * Over hvert hopp henger en bue med mynter, og den buen er den ekte
     * kastebanen – ikke en tegnet halvsirkel.
     *
     * Første utgave var en fast sinusbue med topp 170 enheter over gapet.
     * Bilen nådde i praksis 154 og landet flere hundre enheter forbi der
     * buen sluttet, så myntene hang både for høyt og på feil sted, og hoppet
     * så ut som om bilen ignorerte dem. Nå settes de rett på banen: samme
     * avsprangsvinkel, samme tyngdekraft, og den målte referansefarten.
     */
    for (i = 0; i < p.length - 1; i++) {
      if (!p[i].hopp) continue;
      var a = p[i], mal = p[i + 1];
      var vx = Math.cos(a.vinkel) * REFERANSEFART;
      var vy = Math.sin(a.vinkel) * REFERANSEFART;
      var dy = mal.y - a.y;
      // Tiden til banen er tilbake på landingshøyden.
      var flytid = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * dy))) / G;
      for (var k = 1; k <= 7; k++) {
        var t = flytid * k / 8;
        lope.mynter.push({
          // De 40 enhetene er den samme forskyvningen som plukkingen måler
          // mot, så mynten står midt på bilen og ikke under hjulene.
          x: a.x + vx * t,
          y: a.y + vy * t + 0.5 * G * t * t - 40,
          tatt: false
        });
      }
    }
  }

  // Punktet ved en gitt avstand langs løypa, med lineær interpolasjon.
  // Bilen står nesten alltid mellom to punkter, og uten interpolasjonen
  // hakker den fram i sju enheters sprang.
  function ved(lope, s) {
    var p = lope.punkter;
    if (s <= 0) return { x: p[0].x, y: p[0].y, vinkel: p[0].vinkel, i: 0 };
    if (s >= lope.lengde) {
      var n = p.length - 1;
      return { x: p[n].x, y: p[n].y, vinkel: p[n].vinkel, i: n };
    }
    var lo = 0, hi = p.length - 1;
    while (hi - lo > 1) {
      var m = (lo + hi) >> 1;
      if (p[m].s <= s) lo = m; else hi = m;
    }
    var a = p[lo], b = p[hi];
    var t = (s - a.s) / Math.max(0.0001, b.s - a.s);
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      vinkel: a.vinkel + vinkeldiff(b.vinkel, a.vinkel) * t,
      i: lo
    };
  }

  // Kort vei rundt sirkelen. Uten dette snurrer bilen 350 grader feil vei
  // idet vinkelen går fra +π til -π på toppen av loopen.
  function vinkeldiff(til, fra) {
    var d = til - fra;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  function iLoop(lope, s) {
    for (var i = 0; i < lope.looper.length; i++) {
      if (s >= lope.looper[i].fra && s <= lope.looper[i].til) return lope.looper[i];
    }
    return null;
  }

  /* ---------- banekatalogen ---------- */

  /*
   * Fem baner, og de skal kjennes forskjellige – ikke bare se det. Derfor har
   * hver av dem et eget *premiss*, ikke bare en annen rekkefølge på de samme
   * bakkene:
   *
   *   Stuntløypa      looper først, så fire hopp. Originalen.
   *   Frostruta       is: bilen glir, bremsen biter nesten ikke.
   *   Gruvegangen     tunnel, bro og gjørme. Trangt, mørkt og tungt.
   *   Rakettrampa     bare hopp. Mer tid i lufta enn på bakken.
   *   Korketrekkeren  korketrekkere og rumlefelt. Nesten ingen rett strekning.
   *
   * `tegn` og `farge` brukes på kortet i banevelgeren. `elementer` er bare
   * til visning – hva banen faktisk inneholder, telles ut av punktlista.
   */
  var BANER = [
    {
      id: 'stunt',
      navn: 'Stuntløypa',
      tegn: '🏁',
      farge: '#ffc61a',
      omtale: 'Fire looper og fire hopp. Den originale.',
      bygg: function (b) {
        /*
         * Delt i to: først bakker og looper, så hoppene. Rekkefølgen er ikke
         * smak, den er et krav – en fullt oppgradert bil flyr over 3000
         * enheter, så alle fire loopene ligger før den første rampa.
         */
        b.flat(380);
        b.kul(400, 90);
        b.flat(140);
        b.loop(95, 70);                 // liten loop
        b.kul(360, 120);
        b.bolger(540, 2, 70);
        b.flat(160);
        b.loop(115, 78);
        b.trapp(280, -80);              // opp et platå
        b.kul(420, 140);
        b.bolger(600, 3, 80);
        b.flat(160);
        b.loop(105, 74);
        b.trapp(320, 90);               // ned igjen
        b.kul(400, 110);
        b.flat(160);
        b.loop(130, 86);                // den største
        b.trapp(280, -60);
        b.kul(380, 100);
        b.flat(220);

        b.rampe(300, 150);
        b.gap(520, 40);                 // hopp 1
        b.trapp(260, 60);
        b.bolger(640, 2, 70);
        b.kul(460, 130);
        b.bolger(600, 3, 70);
        b.kul(420, 100);
        b.flat(260);

        b.rampe(320, 160);
        b.gap(540, 50);                 // hopp 2
        b.trapp(280, 70);
        b.kul(480, 140);
        b.bolger(660, 3, 80);
        b.kul(440, 110);
        b.bolger(580, 2, 60);
        b.flat(280);

        b.rampe(340, 180);
        b.gap(560, 70);                 // hopp 3
        b.trapp(300, 80);
        b.bolger(620, 2, 75);
        b.kul(500, 150);
        b.bolger(640, 3, 70);
        b.kul(460, 120);
        b.flat(300);

        /*
         * Det siste hoppet. Alt etter denne rampekanten er kortere enn en
         * maksbils rekkevidde, så en ferdig utbygd bil flyr fra avspranget og
         * helt over målstreken. En umodifisert bil lander tidlig og kjører
         * resten – det er belønningen for å ha bygd bilen ferdig.
         */
        b.rampe(380, 220);
        b.gap(540, 120);                // hopp 4, det siste
        b.trapp(300, 80);
        b.kul(460, 120);
        b.bolger(560, 2, 60);
        b.kul(420, 90);
        b.flat(600);                    // utrulling og mål
      }
    },

    {
      id: 'frost',
      navn: 'Frostruta',
      tegn: '🧊',
      farge: '#7dd3fc',
      omtale: 'Isen gjør bilen glatt. Den glir langt, og bremsen biter nesten ikke.',
      bygg: function (b) {
        /*
         * Isen har lav friksjon *og* nesten ingen brems. Bilen holder farten
         * over lange strekninger, og det er hele følelsen: man ruller og
         * ruller i stedet for å gasse.
         *
         * Rampene står med vilje på bar asfalt, med en lang innkjøring foran.
         * En rampe rett etter is ga en avsprangsfart langt over referansen,
         * og da henger myntbuen et sted bilen aldri kommer.
         */
        b.flat(360);

        b.sone('is', function () {
          b.kul(520, 130);
          b.bolger(760, 2, 90);
          b.trapp(340, -110);
          b.kul(560, 150);
          b.bolger(820, 3, 80);
          b.trapp(360, 120);
          b.kul(480, 120);
        });

        b.flat(200);
        b.korketrekker(100, 74, 2);     // spiral midt i isen

        b.sone('is', function () {
          b.kul(540, 140);
          b.bolger(880, 3, 95);
          b.trapp(320, -90);
          b.kul(500, 130);
          b.bolger(700, 2, 80);
        });

        b.flat(180);
        b.loop(120, 82);
        b.kul(420, 110);
        b.flat(150);
        b.loop(108, 76);

        b.sone('is', function () {
          b.bolger(760, 2, 85);
          b.kul(520, 140);
          b.trapp(340, 100);
        });

        // Bar asfalt inn mot rampa, så avspranget er til å regne på.
        b.flat(900);
        b.rampe(320, 165);
        b.gap(540, 60);
        b.trapp(300, 70);

        b.sone('is', function () {
          b.kul(540, 140);
          b.bolger(820, 3, 85);
          b.kul(480, 120);
          b.bolger(680, 2, 70);
        });

        b.flat(900);
        b.rampe(340, 175);
        b.gap(560, 80);
        b.trapp(300, 70);

        b.sone('is', function () {
          b.kul(500, 130);
          b.bolger(760, 2, 80);
          b.trapp(320, -80);
          b.kul(460, 120);
        });

        b.flat(900);
        b.rampe(360, 190);
        b.gap(570, 110);
        b.trapp(300, 75);
        b.kul(440, 115);
        b.flat(620);
      }
    },

    {
      id: 'gruve',
      navn: 'Gruvegangen',
      tegn: '🕳️',
      farge: '#c9803f',
      omtale: 'Tunneler, hengebroer og gjørme. Trangt, mørkt og tungt å komme seg gjennom.',
      bygg: function (b) {
        /*
         * Gjørma har mer enn dobbel luftmotstand. Det er her lavgiret og
         * turboen virkelig betyr noe – en umodifisert bil kryper gjennom, og
         * en oppgradert merker forskjellen med en gang.
         *
         * Broene er fast grunn uten jord under. Bilen kjører og lander på dem
         * som på alt annet; det er bare bakken som mangler, og et stillas som
         * tegnes i stedet.
         */
        b.flat(320);

        b.sone('tunnel', function () {
          b.flat(280);
          b.kul(460, 110);
          b.bolger(560, 2, 60);
          b.flat(240);
        });

        b.kul(380, 100);
        b.sone('bro', function () { b.flat(520); });
        b.trapp(260, 70);

        b.sone('gjorme', function () {
          b.bolger(640, 3, 75);
          b.trapp(380, -120);
          b.kul(440, 110);
        });

        b.flat(200);
        b.loop(110, 78);
        b.kul(400, 105);

        b.sone('tunnel', function () {
          b.bolger(620, 2, 70);
          b.flat(260);
          b.kul(480, 120);
        });

        b.sone('bro', function () { b.flat(460); });
        b.trapp(280, 80);

        b.sone('gjorme', function () {
          b.kul(460, 120);
          b.bolger(700, 3, 80);
        });

        b.flat(180);
        b.loop(125, 84);
        b.trapp(300, -70);
        b.kul(420, 110);

        b.sone('tunnel', function () {
          b.flat(300);
          b.bolger(540, 2, 65);
          b.flat(260);
        });

        b.kul(400, 100);
        b.flat(170);
        b.loop(112, 78);
        b.sone('bro', function () { b.flat(440); });
        b.kul(420, 110);

        b.flat(420);
        b.rampe(310, 160);
        b.gap(530, 60);
        b.trapp(280, 70);

        b.sone('gjorme', function () {
          b.bolger(660, 3, 75);
          b.kul(440, 115);
        });

        b.sone('bro', function () { b.flat(480); });
        b.trapp(260, 60);
        b.kul(420, 110);

        b.flat(560);
        b.rampe(330, 170);
        b.gap(550, 80);
        b.trapp(300, 70);

        b.sone('tunnel', function () {
          b.kul(460, 120);
          b.flat(320);
        });

        b.kul(400, 95);
        b.sone('gjorme', function () { b.bolger(560, 2, 70); });

        b.flat(520);
        b.rampe(350, 185);
        b.gap(560, 100);
        b.trapp(290, 75);
        b.kul(420, 105);
        b.flat(560);
      }
    },

    {
      id: 'rakett',
      navn: 'Rakettrampa',
      tegn: '🚀',
      farge: '#ff8a2b',
      omtale: 'Ingen looper – bare hopp etter hopp. Mer tid i lufta enn på bakken.',
      bygg: function (b) {
        /*
         * Ingen looper i det hele tatt, og det er et *premiss* og ikke en
         * forglemmelse: bilen lander bare på fast grunn, så en loop mellom to
         * ramper ville vært noe den seilte tvers gjennom. Her er hele banen
         * flybane.
         *
         * Rampene står tettere enn på Stuntløypa. En maksbil flyr forbi noen
         * av dem, og det er greit – den bytter et hopp mot en lengde. En
         * umodifisert bil treffer alle seks.
         */
        b.flat(420);
        b.kul(380, 90);

        b.rampe(300, 155);
        b.gap(520, 50);
        b.trapp(260, 60);
        b.kul(420, 110);
        b.bolger(520, 2, 65);
        b.kul(440, 100);
        b.flat(420);

        b.rampe(310, 165);
        b.gap(530, 60);
        b.trapp(270, 65);
        b.rumlefelt(360, 8);
        b.kul(440, 120);
        b.bolger(560, 2, 70);
        b.flat(380);

        b.rampe(320, 175);
        b.gap(545, 70);
        b.trapp(280, 70);
        b.kul(460, 125);
        b.bolger(560, 2, 70);
        b.kul(460, 110);
        b.flat(420);

        b.rampe(330, 185);
        b.gap(555, 80);
        b.trapp(290, 75);
        b.rumlefelt(380, 9);
        b.kul(480, 130);
        b.bolger(600, 3, 75);
        b.flat(400);

        b.rampe(345, 195);
        b.gap(535, 90);
        b.trapp(300, 80);
        b.kul(500, 135);
        b.bolger(580, 2, 70);
        b.kul(480, 115);
        b.flat(440);

        // Den siste er den største, og alt etter den er utrulling.
        b.rampe(390, 235);
        b.gap(525, 130);
        b.trapp(300, 80);
        b.kul(460, 115);
        b.bolger(540, 2, 60);
        b.flat(620);
      }
    },

    {
      id: 'kork',
      navn: 'Korketrekkeren',
      tegn: '🌀',
      farge: '#c084fc',
      omtale: 'Korketrekkere og rumlefelt. Nesten ingen rett strekning å hvile på.',
      bygg: function (b) {
        /*
         * Åtte looper, de fleste i korketrekkere på to. Rumlefeltene mellom
         * dem rister bilen og spiser litt fart, så man må gasse seg ut av hver
         * spiral i stedet for å rulle videre på det man hadde.
         *
         * Alt dette ligger foran det ene hoppet, av samme grunn som på
         * Stuntløypa.
         */
        b.flat(340);
        b.kul(360, 95);

        b.korketrekker(100, 72, 2);
        b.rumlefelt(320, 8);
        b.kul(400, 115);

        b.loop(118, 80);
        b.bolger(520, 2, 70);
        b.rumlefelt(300, 7);

        b.korketrekker(108, 76, 2);
        b.trapp(300, -90);
        b.kul(440, 125);
        b.rumlefelt(340, 9);

        b.loop(126, 84);
        b.bolger(560, 3, 75);
        b.trapp(320, 100);

        b.korketrekker(114, 78, 2);
        b.rumlefelt(360, 9);
        b.kul(460, 130);
        b.bolger(540, 2, 70);
        b.trapp(300, -85);
        b.kul(440, 120);
        b.rumlefelt(320, 8);
        b.bolger(520, 2, 65);
        b.kul(440, 115);
        b.rumlefelt(300, 7);
        b.trapp(300, 85);

        b.flat(680);
        b.rampe(360, 200);
        b.gap(560, 100);
        b.trapp(300, 80);
        b.kul(440, 115);
        b.rumlefelt(340, 8);
        b.kul(400, 95);

        b.flat(600);
        b.rampe(370, 210);
        b.gap(530, 115);
        b.trapp(300, 80);
        b.kul(420, 105);
        b.rumlefelt(320, 8);
        b.flat(620);
      }
    }
  ];

  function finn(id) {
    for (var i = 0; i < BANER.length; i++) if (BANER[i].id === id) return BANER[i];
    return BANER[0];
  }

  /*
   * Hva banen faktisk inneholder, talt ut av punktlista i stedet for skrevet
   * inn for hånd. En ny bane får merkene sine gratis, og de kan ikke bli
   * uenige med det man faktisk kjører.
   */
  function innhold(lope) {
    var p = lope.punkter, ut = { looper: lope.looper.length, hopp: 0, soner: {} };
    for (var i = 0; i < p.length; i++) {
      if (p[i].hopp) ut.hopp++;
      if (p[i].sone) ut.soner[p[i].sone] = true;
    }
    return ut;
  }

  return {
    bygg: bygg,
    ved: ved,
    iLoop: iLoop,
    vinkeldiff: vinkeldiff,
    BANER: BANER,
    SONER: SONER,
    finn: finn,
    innhold: innhold,
    REFERANSEFART: REFERANSEFART
  };
})();
