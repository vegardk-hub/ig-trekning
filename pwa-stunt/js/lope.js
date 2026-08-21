/*
 * Løypa: én sammenhengende kurve, punkt for punkt.
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
 * Hvert punkt har `s` (avstand langs løypa) og `bakke` (om det er fast grunn
 * eller en del av en loop). Fyllet under løypa tegnes bare under bakken –
 * en loop skal ha himmel på begge sider.
 */
'use strict';

var Lope = (function () {

  var STEG = 7;          // avstand mellom punktene, i spillenheter
  var MYNTAVSTAND = 300; // hvor tett myntene ligger langs løypa

  /*
   * Tyngdekraften kommer utenfra fordi myntbuene over hoppene *er* bilens
   * kastebane. Regnet buene med sin egen konstant, ville de sluttet å stemme
   * i samme øyeblikk som noen justerte fysikken – og det er nettopp det å
   * ikke stemme som var feilen med den forrige buen.
   */
  function bygg(tyngde) {
    var G = tyngde || 900;
    var p = [];
    var x = 0, y = 0;

    function legg(nx, ny, bakke, hopp) {
      p.push({ x: nx, y: ny, bakke: bakke !== false, hopp: !!hopp });
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

    function flat(lengde) { grunn(lengde, function () { return 0; }); }

    // Myk kul: opp og ned igjen, uten knekk i endene.
    function kul(lengde, h) {
      grunn(lengde, function (t) { return -h * Math.sin(Math.PI * t) * Math.sin(Math.PI * t); });
    }

    // Jevn overgang til et nytt nivå. Positiv dh er nedover på skjermen.
    function trapp(lengde, dh) {
      grunn(lengde, function (t) { return dh * (1 - Math.cos(Math.PI * t)) / 2; });
    }

    function bolger(lengde, antall, h) {
      grunn(lengde, function (t) { return -h * (1 - Math.cos(2 * Math.PI * antall * t)) / 2; });
    }

    /*
     * Loop. Bilen går inn nederst mot høyre, opp høyresiden, over toppen og
     * ned venstresiden. Sirkelen driver litt mot høyre underveis, slik at
     * inn- og utgang ikke ligger oppå hverandre – ellers ser det ut som
     * løypa har en knekk der den egentlig bare er tilbake der den startet.
     */
    function loop(r, drift) {
      var cx = x, cy = y - r;
      var n = Math.max(40, Math.round(2 * Math.PI * r / STEG));
      for (var i = 1; i <= n; i++) {
        var fi = 2 * Math.PI * i / n;
        legg(cx + Math.sin(fi) * r + drift * fi / (2 * Math.PI),
             cy + Math.cos(fi) * r, false);
      }
      x += drift;
    }

    // Rampe med økende bratthet, så avspranget peker oppover.
    function rampe(lengde, h) {
      grunn(lengde, function (t) { return -h * t * t; });
      p[p.length - 1].hopp = true;
    }

    // Hoppet selv har ingen punkter: bilen flyr, og lander på det neste
    // bakkesegmentet. Vi flytter bare pennen fram og ned.
    function gap(lengde, fall) { x += lengde; y += fall; legg(x, y, true); }

    /* ---------- Stuntløypa ---------- */

    /*
     * Løypa er delt i to: først bakker og looper, så hoppene. Rekkefølgen er
     * ikke smak, den er et krav.
     *
     * Bilen kan bare lande på fast grunn. En loop som ligger innenfor
     * rekkevidden til et hopp, er derfor ikke noe bilen treffer – den seiler
     * tvers gjennom loopens asfalt i lufta. En fullt oppgradert bil flyr over
     * 3000 enheter, så alle fire loopene ligger før den første rampa.
     *
     * Av samme grunn er det minst 3400 enheter mellom to rampekanter: ellers
     * flyr en maksbil over den neste rampa og hopper aldri fra den. Det siste
     * hoppet er unntaket med vilje – der *skal* den fly hele veien i mål.
     *
     * `tester/lope.js` kontrollerer begge deler, og sier fra med tall hvis en
     * justering bryter dem.
     */

    /* --- første del: bakker opp og ned, og fire looper --- */

    flat(380);
    kul(400, 90);
    flat(140);
    loop(95, 70);                 // liten loop
    kul(360, 120);
    bolger(540, 2, 70);
    flat(160);
    loop(115, 78);
    trapp(280, -80);              // opp et platå
    kul(420, 140);
    bolger(600, 3, 80);
    flat(160);
    loop(105, 74);
    trapp(320, 90);               // ned igjen
    kul(400, 110);
    flat(160);
    loop(130, 86);                // den største
    trapp(280, -60);
    kul(380, 100);
    flat(220);

    /* --- andre del: fire hopp, med bakker imellom --- */

    rampe(300, 150);
    gap(520, 40);                 // hopp 1
    trapp(260, 60);
    bolger(640, 2, 70);
    kul(460, 130);
    bolger(600, 3, 70);
    kul(420, 100);
    flat(260);

    rampe(320, 160);
    gap(540, 50);                 // hopp 2
    trapp(280, 70);
    kul(480, 140);
    bolger(660, 3, 80);
    kul(440, 110);
    bolger(580, 2, 60);
    flat(280);

    rampe(340, 180);
    gap(560, 70);                 // hopp 3
    trapp(300, 80);
    bolger(620, 2, 75);
    kul(500, 150);
    bolger(640, 3, 70);
    kul(460, 120);
    flat(300);

    /*
     * Det siste hoppet. Alt etter denne rampekanten er kortere enn en
     * maksbils rekkevidde, så en ferdig utbygd bil flyr fra avspranget og
     * helt over målstreken. En umodifisert bil lander tidlig og kjører
     * resten – det er belønningen for å ha bygd bilen ferdig, og den er
     * verdt å beholde.
     */
    rampe(380, 220);
    gap(540, 120);                // hopp 4, det siste
    trapp(300, 80);
    kul(460, 120);
    bolger(560, 2, 60);
    kul(420, 90);
    flat(600);                    // utrulling og mål

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

    // Looper markeres som strekninger, så kjøringen vet når den skal hjelpe
    // bilen rundt og når den skal betale for en fullført loop.
    var looper = [];
    var start = -1;
    for (i = 0; i < p.length; i++) {
      if (!p[i].bakke && start < 0) start = i;
      if ((p[i].bakke || i === p.length - 1) && start >= 0) {
        looper.push({ fra: p[start].s, til: p[i].s, betalt: false });
        start = -1;
      }
    }

    var lope = {
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

  return { bygg: bygg, ved: ved, iLoop: iLoop, vinkeldiff: vinkeldiff };
})();
