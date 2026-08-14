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
  var MYNTAVSTAND = 200; // hvor tett myntene ligger langs løypa

  function bygg() {
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

    flat(420);
    kul(420, 90);
    flat(180);
    loop(95, 70);                 // første loop, den lille
    flat(240);
    kul(340, 60);
    rampe(300, 150);
    gap(300, 30);                 // første hopp
    trapp(220, 40);
    bolger(620, 3, 70);
    flat(200);
    loop(120, 80);                // stor loop
    trapp(260, -60);
    kul(360, 80);
    rampe(360, 210);
    gap(430, 90);                 // det lange hoppet
    trapp(260, 60);
    kul(300, 50);
    flat(560);                    // utrulling og mål

    /* ---------- etterarbeid ---------- */

    // Buelengde og tangent. Vinkelen er positiv når løypa peker nedover på
    // skjermen, som er den samme retningen tyngdekraften drar.
    p[0].s = 0;
    for (var i = 1; i < p.length; i++) {
      p[i].s = p[i - 1].s + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    }
    for (i = 0; i < p.length; i++) {
      var a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      p[i].vinkel = Math.atan2(b.y - a.y, b.x - a.x);
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

    leggMynter(lope);
    return lope;
  }

  /*
   * Myntene ligger et stykke over løypa, langs normalen. I en loop peker
   * normalen innover, så myntene havner inni loopen – akkurat der bilen
   * kjører. Det er også det som gjør at en loop lønner seg: du plukker et
   * dusin mynter på en runde du uansett skulle kjørt.
   */
  function leggMynter(lope) {
    var p = lope.punkter, neste = 260;
    for (var i = 1; i < p.length - 1; i++) {
      if (p[i].s < neste) continue;
      neste = p[i].s + MYNTAVSTAND;
      var t = p[i].vinkel;
      var nx = Math.sin(t), ny = -Math.cos(t);
      lope.mynter.push({ x: p[i].x + nx * 52, y: p[i].y + ny * 52, tatt: false });
    }

    // Over hvert hopp henger en bue med mynter. De er den eneste grunnen til
    // å hoppe langt i tillegg til bonusen, og de viser hvor bilen skal.
    for (i = 0; i < p.length - 1; i++) {
      if (!p[i].hopp) continue;
      var a = p[i], b = p[i + 1];
      var lengde = b.x - a.x;
      for (var k = 1; k <= 6; k++) {
        var tt = k / 7;
        lope.mynter.push({
          x: a.x + lengde * tt,
          y: a.y + (b.y - a.y) * tt - 130 * Math.sin(Math.PI * tt) - 40,
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
