/*
 * Utleggingen av ett brett – 10 × 10 ruter, uten et eneste piksel.
 *
 * Skilt fra tegnekoden med samme begrunnelse som fysikken i Stuntgarasjen:
 * spørsmålene som avgjør om et brett duger – står to funn i samme rute, har
 * hvert funn sitt eget ord, henger veien sammen fra kant til kant, grenser
 * hver innhegning til veien – lar seg svare på i `tester/scene.js` på et
 * sekund, uten nettleser.
 *
 * Rekkefølgen er det som gir et bilde som henger sammen:
 *
 *   1. Veien legges først, fra venstre kant til høyre, med et par sidegrener.
 *   2. Sonene plasseres etterpå, og en sone som ikke grenser til veien
 *      forkastes. Det er hele forskjellen på et kart og en haug med ikoner.
 *   3. Funnene fylles inn – dyrene inne i sonene, tingene langs veien.
 *   4. Kulissene tar resten, og bare ruter som ikke er en sone: et tre midt i
 *      kvartalet ser ut som en feil.
 *
 * To regler holder fasiten entydig, og begge er lette å bryte ved et uhell:
 *
 * - **Ett ord kan bare brukes én gang per brett.** To løver i hver sin rute
 *   gjør «løve» til et svar med to riktige koordinater.
 * - **En kulisse kan aldri være et funn på samme brett.** Er «blomst» svaret
 *   i F3, kan det ikke stå blomster som pynt i fire andre ruter.
 */
'use strict';

var Scene = (function () {

  var BREDDE = 10, HOYDE = 10;
  var BOKSTAVER = 'ABCDEFGHIJ';

  /* 18 funn er tett nok til at brettet ser levende ut, og romslig nok til at
     16 oppgaver aldri tømmer det. MIN er gulvet prøvene håndhever. */
  var MAAL_FUNN = 18;
  var MIN_FUNN = 16;

  // Rad 1 er øverst – som på et kart, ikke som i et koordinatsystem.
  function rutenavn(x, y) { return BOKSTAVER.charAt(x) + (y + 1); }

  function tomtKart(verdi) {
    var ut = [];
    for (var y = 0; y < HOYDE; y++) {
      ut[y] = [];
      for (var x = 0; x < BREDDE; x++) ut[y][x] = verdi;
    }
    return ut;
  }

  function lag(temaId, brett) {
    var tema = Temaer.hent(temaId);
    var rng = Tilfeldig.lag(Tilfeldig.sad(tema.id, brett));

    var grunn = tomtKart(tema.grunn);
    var vei = tomtKart(false);
    var opptatt = tomtKart(false);
    var sonekart = tomtKart(-1);

    /* --- 1. veien -------------------------------------------------------
       Et kryss, ikke én vei: én sti fra venstre kant til høyre og én fra topp
       til bunn. Første utgave hadde bare den vannrette, og da hang alt sammen
       med den – sonene må grense til veien, og tingene langs veien likeså. Lå
       veien i rad 7, sto hele øvre halvdel av arket tomt, og halve
       tallaksen var uten oppgaver. Krysset fordeler funnene i alle fire
       hjørner uten en eneste regel om spredning.

       Begge stiene flytter seg høyst én rute om gangen, og begge rutene
       markeres i skrittet – ellers ville stien få et diagonalt hopp den ikke
       kan ha. */
    var y = rng.mellom(2, HOYDE - 3);
    for (var x = 0; x < BREDDE; x++) {
      vei[y][x] = true;
      if (x < BREDDE - 1 && rng.sjanse(0.35)) {
        var ny = y + (rng.sjanse(0.5) ? 1 : -1);
        if (ny >= 1 && ny <= HOYDE - 2) { y = ny; vei[y][x] = true; }
      }
    }

    var vx = rng.mellom(2, BREDDE - 3);
    for (var vy = 0; vy < HOYDE; vy++) {
      vei[vy][vx] = true;
      if (vy < HOYDE - 1 && rng.sjanse(0.28)) {
        var nx = vx + (rng.sjanse(0.5) ? 1 : -1);
        if (nx >= 1 && nx <= BREDDE - 2) { vx = nx; vei[vy][nx] = true; }
      }
    }

    /* Krysset alene holder ikke: ligger begge stiene mot samme hjørne, blir
       den motsatte fjerdedelen av arket uten en eneste veirute – og siden
       både soner og ting langs veien krever en veirute som nabo, blir hele
       den fjerdedelen tom. Her får hver fjerdedel med under tre veiruter en
       arm inn til seg, lagt L-formet fra nærmeste veirute, så den henger
       sammen med resten. */
    function veiruter(filter) {
      var ut = [];
      for (var ry = 0; ry < HOYDE; ry++)
        for (var rx = 0; rx < BREDDE; rx++)
          if (vei[ry][rx] && (!filter || filter(rx, ry))) ut.push({ x: rx, y: ry });
      return ut;
    }

    for (var kv = 0; kv < 4; kv++) {
      var kx0 = (kv % 2) * (BREDDE / 2), ky0 = (kv < 2 ? 0 : 1) * (HOYDE / 2);
      var iKv = function (x2, y2) {
        return x2 >= kx0 && x2 < kx0 + BREDDE / 2 && y2 >= ky0 && y2 < ky0 + HOYDE / 2;
      };
      if (veiruter(iKv).length >= 3) continue;
      var maal = { x: rng.mellom(kx0 + 1, kx0 + 3), y: rng.mellom(ky0 + 1, ky0 + 3) };
      var naermest = null, best = 999;
      veiruter().forEach(function (c) {
        var d = Math.abs(c.x - maal.x) + Math.abs(c.y - maal.y);
        if (d < best) { best = d; naermest = c; }
      });
      if (!naermest) continue;
      var cx = naermest.x, cy = naermest.y;
      while (cx !== maal.x) { cx += cx < maal.x ? 1 : -1; vei[cy][cx] = true; }
      while (cy !== maal.y) { cy += cy < maal.y ? 1 : -1; vei[cy][cx] = true; }
    }

    /* Én sidegren til – iblant. Krysset og armene gir allerede nok vei; en
       fast gren til gjorde stiene så brede at en tredjedel av arket var
       asfalt, og de rutene kan ikke ha noe å finne i seg. */
    var grener = rng.mellom(0, 1);
    for (var g = 0; g < grener; g++) {
      var kandidater = [];
      for (var gy = 0; gy < HOYDE; gy++)
        for (var gx = 1; gx < BREDDE - 1; gx++) if (vei[gy][gx]) kandidater.push({ x: gx, y: gy });
      if (!kandidater.length) break;
      var start = rng.velg(kandidater);
      var opp = rng.sjanse(0.5);
      var lengde = rng.mellom(2, 4);
      var cy = start.y;
      for (var i = 0; i < lengde; i++) {
        cy += opp ? -1 : 1;
        if (cy < 0 || cy >= HOYDE) break;
        vei[cy][start.x] = true;
      }
    }

    function erVei(x, y2) { return x >= 0 && x < BREDDE && y2 >= 0 && y2 < HOYDE && vei[y2][x]; }
    function inntilVei(x, y2) {
      return erVei(x - 1, y2) || erVei(x + 1, y2) || erVei(x, y2 - 1) || erVei(x, y2 + 1);
    }

    /* --- 2. sonene ------------------------------------------------------
       En sone må grense til veien. Uten det kravet havner innhegninger i
       hjørner det ikke går an å komme til, og bildet slutter å henge sammen.
       Kravet om én tom rute mellom soner er ikke pynt: to gjerder inntil
       hverandre leses som ett stort inngjerdet område. */
    var FORMER = [[2, 2], [2, 2], [3, 2], [2, 3], [3, 2], [2, 3], [3, 3], [4, 2], [2, 4]];
    var maalSoner = rng.mellom(5, 7);
    var soner = [];
    var slagkurv = rng.stokk(tema.soner.slice());

    function kanPlassere(sx, sy, w, h) {
      var i, j, naerVei = false;
      for (j = sy - 1; j <= sy + h; j++)
        for (i = sx - 1; i <= sx + w; i++) {
          if (i < 0 || i >= BREDDE || j < 0 || j >= HOYDE) continue;
          if (sonekart[j][i] !== -1) return false;
        }
      for (j = sy; j < sy + h; j++)
        for (i = sx; i < sx + w; i++) {
          if (vei[j][i]) return false;
          if (inntilVei(i, j)) naerVei = true;
        }
      return naerVei;
    }

    var forsok = 0;
    while (soner.length < maalSoner && forsok < 900) {
      forsok++;
      var form = rng.velg(FORMER);
      var w = form[0], h = form[1];
      var sx = rng.heltall(BREDDE - w + 1), sy = rng.heltall(HOYDE - h + 1);
      if (!kanPlassere(sx, sy, w, h)) continue;
      if (!slagkurv.length) slagkurv = rng.stokk(tema.soner.slice());
      var slag = slagkurv.shift();
      var sone = { x: sx, y: sy, w: w, h: h, grunn: slag.grunn, brikker: slag.brikker };
      for (var j = sy; j < sy + h; j++)
        for (var i = sx; i < sx + w; i++) { grunn[j][i] = slag.grunn; sonekart[j][i] = soner.length; }
      soner.push(sone);
    }

    /* --- 3. funnene ----------------------------------------------------- */
    var funn = [];
    var kulisser = [];
    var bruktOrd = {};

    /* Uten dette samler funnene seg der veiene tilfeldigvis ligger tettest,
       og en hel kvadrant av arket kan bli stående uten et eneste svar. Da er
       en fjerdedel av koordinatene uten oppgaver, og barnet øver bare på det
       halve rutenettet. Telleren gjør at hvert nye funn søker den delen av
       arket som har færrest fra før. */
    var kvadranttall = [0, 0, 0, 0];
    function kvadrant(x2, y2) { return (y2 < HOYDE / 2 ? 0 : 2) + (x2 < BREDDE / 2 ? 0 : 1); }

    function ledigBrikke(pool) {
      var stokket = rng.stokk(pool);
      for (var i2 = 0; i2 < stokket.length; i2++)
        if (!bruktOrd[Brikker.ord(stokket[i2])]) return stokket[i2];
      return null;
    }
    function plasser(x2, y2, id) {
      opptatt[y2][x2] = true;
      kvadranttall[kvadrant(x2, y2)]++;
      bruktOrd[Brikker.ord(id)] = true;
      funn.push({ x: x2, y: y2, brikke: id, ord: Brikker.ord(id), rute: rutenavn(x2, y2) });
    }

    /* Et slag med tomme hender gir en innhegning uten dyr. Har tre parker
       delt på tre parkbrikker, står den fjerde tom – derfor bytter en sone
       til et slag som fortsatt har ubrukte brikker, hvis det finnes. */
    function friskeIgjen(slag) {
      for (var b2 = 0; b2 < slag.brikker.length; b2++)
        if (!bruktOrd[Brikker.ord(slag.brikker[b2])]) return true;
      return false;
    }

    soner.forEach(function (sone) {
      if (!friskeIgjen(sone)) {
        var bytte = rng.stokk(tema.soner.slice()).filter(friskeIgjen)[0];
        if (bytte) {
          sone.brikker = bytte.brikker;
          sone.grunn = bytte.grunn;
          for (var by2 = sone.y; by2 < sone.y + sone.h; by2++)
            for (var bx = sone.x; bx < sone.x + sone.w; bx++) grunn[by2][bx] = sone.grunn;
        }
      }
      var celler = [];
      for (var j2 = sone.y; j2 < sone.y + sone.h; j2++)
        for (var i2 = sone.x; i2 < sone.x + sone.w; i2++) celler.push({ x: i2, y: j2 });
      celler = rng.stokk(celler);
      var antall = sone.w * sone.h >= 6 ? 2 : 1;
      for (var n = 0; n < antall && celler.length; n++) {
        var id = ledigBrikke(sone.brikker);
        if (!id) break;
        var celle = celler.shift();
        plasser(celle.x, celle.y, id);
      }
    });

    // Ting langs veien: krever en veirute som nabo, og står aldri i veien.
    var naboer = [];
    for (var ny2 = 0; ny2 < HOYDE; ny2++)
      for (var nx = 0; nx < BREDDE; nx++)
        if (!vei[ny2][nx] && sonekart[ny2][nx] === -1 && inntilVei(nx, ny2)) naboer.push({ x: nx, y: ny2 });
    naboer = rng.stokk(naboer);

    /* Lista er stokket, så like gode kandidater trekkes tilfeldig – det er
       bare kvadranten som styrer valget. */
    function taCelle(liste) {
      var beste = -1, faerrest = Infinity;
      for (var i2 = liste.length - 1; i2 >= 0; i2--) {
        if (opptatt[liste[i2].y][liste[i2].x]) { liste.splice(i2, 1); continue; }
        var antall = kvadranttall[kvadrant(liste[i2].x, liste[i2].y)];
        if (antall < faerrest) { faerrest = antall; beste = i2; }
      }
      if (beste < 0) return null;
      return liste.splice(beste, 1)[0];
    }

    var langsvei = rng.stokk(tema.langsvei);
    for (var v = 0; v < langsvei.length && funn.length < MAAL_FUNN; v++) {
      if (bruktOrd[Brikker.ord(langsvei[v])]) continue;
      var plass = taCelle(naboer);
      if (!plass) break;
      plasser(plass.x, plass.y, langsvei[v]);
    }

    function ledigeCeller() {
      var ut = [];
      for (var j3 = 0; j3 < HOYDE; j3++)
        for (var i3 = 0; i3 < BREDDE; i3++)
          if (!vei[j3][i3] && !opptatt[j3][i3]) ut.push({ x: i3, y: j3 });
      return ut;
    }

    /* Nødventil: et brett med få soner kan komme under gulvet, og et ark med
       færre funn enn oppgaver er ubrukelig.

       Ruter inntil veien først, og bare deretter hvor som helst. Uten den
       rekkefølgen havnet en brannstasjon midt ute på en tom slette fire ruter
       fra nærmeste gate, og bildet sluttet å henge sammen akkurat der. */
    if (funn.length < MIN_FUNN) {
      var alle = [];
      tema.soner.forEach(function (s) { alle = alle.concat(s.brikker); });
      alle = rng.stokk(alle.concat(tema.langsvei));
      var frieVei = rng.stokk(ledigeCeller().filter(function (c4) { return inntilVei(c4.x, c4.y); }));
      var frieEllers = rng.stokk(ledigeCeller().filter(function (c5) { return !inntilVei(c5.x, c5.y); }));
      for (var a = 0; a < alle.length && funn.length < MIN_FUNN; a++) {
        if (bruktOrd[Brikker.ord(alle[a])]) continue;
        var c2 = taCelle(frieVei) || taCelle(frieEllers);
        if (!c2) break;
        plasser(c2.x, c2.y, alle[a]);
      }
    }

    /* --- 4. kulissene ---------------------------------------------------
       Bare utenfor sonene, og aldri en brikke som allerede er et svar. */
    var kulissepool = tema.kulisser.filter(function (id) { return !bruktOrd[Brikker.ord(id)]; });

    /* En innhegning uten noe i seg ser ut som en glipp. Får sonen ingen funn –
       det skjer når temaet har flere soner enn brikker å fylle dem med – får
       den pynt i stedet, så gjerdet har en grunn til å stå der. */
    if (kulissepool.length) {
      soner.forEach(function (sone, si) {
        var harFunn = funn.some(function (f3) { return sonekart[f3.y][f3.x] === si; });
        if (harFunn) return;
        var inni = rng.stokk((function () {
          var ut = [];
          for (var y3 = sone.y; y3 < sone.y + sone.h; y3++)
            for (var x3 = sone.x; x3 < sone.x + sone.w; x3++)
              if (!opptatt[y3][x3]) ut.push({ x: x3, y: y3 });
          return ut;
        })());
        for (var d = 0; d < 2 && inni.length; d++) {
          var c6 = inni.shift();
          opptatt[c6.y][c6.x] = true;
          kulisser.push({ x: c6.x, y: c6.y, brikke: rng.velg(kulissepool) });
        }
      });
    }

    if (kulissepool.length) {
      var frie = rng.stokk(ledigeCeller().filter(function (c3) { return sonekart[c3.y][c3.x] === -1; }));
      var antKulisser = rng.mellom(12, 18);
      for (var q = 0; q < antKulisser && frie.length; q++) {
        var f2 = frie.shift();
        opptatt[f2.y][f2.x] = true;
        kulisser.push({ x: f2.x, y: f2.y, brikke: rng.velg(kulissepool) });
      }
    }

    return {
      tema: tema.id,
      navn: tema.navn,
      brett: brett,
      bredde: BREDDE,
      hoyde: HOYDE,
      gjerde: tema.gjerde,
      veigrunn: tema.veigrunn,
      grunn: grunn,
      vei: vei,
      soner: soner,
      funn: funn,
      kulisser: kulisser
    };
  }

  return {
    lag: lag,
    rutenavn: rutenavn,
    BREDDE: BREDDE,
    HOYDE: HOYDE,
    BOKSTAVER: BOKSTAVER,
    MIN_FUNN: MIN_FUNN
  };
})();
