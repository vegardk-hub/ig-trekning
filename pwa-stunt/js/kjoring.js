/*
 * Kjøringen: kamera, bil, partikler og sløyfa.
 *
 * Fysikken ligger i `fysikk.js` og kulissene i `kulisse.js`. Det som er igjen
 * her, er kameraet, bilen selv, alt som spruter ut av den, og bilderuta som
 * binder det sammen.
 *
 * Kameraet er ikke en ren følger. Det ser lenger fram jo fortere bilen går,
 * trekker seg litt ut i fart, og rister når bilen lander. Alle tre er små
 * tall, og til sammen er de forskjellen på at bildet *følger* bilen og at
 * det *kjører* den.
 */
'use strict';

var Kjoring = (function () {

  var BILBREDDE = 168;

  // Hvor mye av verden som får plass. Skalaen tar den strengeste av bredde
  // og høyde, så bilen er like stor stående som liggende – uten det blir den
  // et frimerke i portrett og fyller skjermen i landskap.
  var SYNSBREDDE = 1000;
  var SYNSHOYDE = 1150;

  function lag(lerret, lope, bilder, oppg, bonus) {
    var ctx = lerret.getContext('2d');

    // All tilstand om bilen eies av fysikken. Tegningen leser den, den
    // skriver aldri til den.
    var fys = Fysikk.lag(lope, oppg, bonus);
    var b = fys.bil;
    var popper = fys.popper;
    var kul = Kulisse.lag(lope);

    var tid = 0, rest = 0, sistTid = 0;
    var kjorer = false, ferdigKalt = null;

    // Hjulet skal snurre like fort som bilen ruller: dθ = v·dt / r. Med en
    // fast nevner (det første forsøket delte på 26) snurrer et lite hjul for
    // sakte og et monsterhjul for fort, og bilen ser ut til å skli.
    var bilskala = BILBREDDE / bilder.bredde;
    var hjulradius = bilder.plasser[0].r * bilskala;
    var hjulsnurr = 0;

    /*
     * ...men bare opp til et tak. Et femeikers hjul gjentar seg hver 72.
     * grad, og passerer det mer enn halvparten av det mellom to bilderuter,
     * ser det ut til å snurre bakover – samme vognhjuleffekt som på film.
     */
    var MAKSSNURR = 16;   // radianer per sekund

    /*
     * Blinkefasen. Bilen er et bilde her, og et bilde animerer ikke – så
     * `Bil.tegninger()` har laget ett bilde per fase, og vi bytter mellom
     * dem i takt med klokka. Takten er den samme som CSS-animasjonen i
     * garasjen, så lysene blinker likt begge steder.
     */
    var BLINKTAKT = 0.45;

    /* ---------- kamera ---------- */

    var framsyn = 0;        // hvor langt foran bilen kameraet ser
    var ristX = 0, ristY = 0;
    var forrigeFlyr = false;

    function kamerarist(styrke) {
      ristX = styrke;
      ristY = styrke * 0.7;
    }

    /* ---------- partikler ---------- */

    /*
     * Ett felles kvantum for alt som spruter: støv fra hjulene, smell i
     * landingen og gnister når en mynt tas. Én liste og én oppdatering er
     * nok – forskjellen mellom dem er bare farge, levetid og tyngde.
     */
    var partikler = [];
    var MAKSPARTIKLER = 150;

    function gnist(x, y, vx, vy, r, farge, levetid, tyngde) {
      if (partikler.length >= MAKSPARTIKLER) partikler.shift();
      partikler.push({
        x: x, y: y, vx: vx, vy: vy, r: r,
        farge: farge, alder: 0, levetid: levetid, tyngde: tyngde || 0
      });
    }

    function stov(x, y, fart) {
      var v = (Math.random() - 0.5) * 60;
      gnist(x + (Math.random() - 0.5) * 20, y - 4,
            -fart * 0.10 + v, -20 - Math.random() * 60,
            7 + Math.random() * 9, '#c8b48e', 0.55 + Math.random() * 0.35, -90);
    }

    function smell(x, y) {
      for (var i = 0; i < 16; i++) {
        var vi = Math.PI + (Math.random() - 0.5) * Math.PI * 1.1;
        var f = 120 + Math.random() * 280;
        gnist(x, y - 6, Math.cos(vi) * f, Math.sin(vi) * f * 0.7,
              6 + Math.random() * 12, '#d8c8a4', 0.5 + Math.random() * 0.4, 260);
      }
    }

    function myntsprut(x, y) {
      for (var i = 0; i < 9; i++) {
        var vi = Math.random() * Math.PI * 2;
        var f = 90 + Math.random() * 200;
        gnist(x, y, Math.cos(vi) * f, Math.sin(vi) * f,
              3 + Math.random() * 5, '#7dfcb0', 0.35 + Math.random() * 0.25, 140);
      }
    }

    function oppdaterPartikler(dt) {
      for (var i = partikler.length - 1; i >= 0; i--) {
        var q = partikler[i];
        q.alder += dt;
        if (q.alder >= q.levetid) { partikler.splice(i, 1); continue; }
        q.vy += q.tyngde * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 1 - 1.6 * dt;
      }
    }

    function tegnPartikler() {
      for (var i = 0; i < partikler.length; i++) {
        var q = partikler[i];
        var t = q.alder / q.levetid;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = q.farge;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * (0.6 + t * 0.9), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function snurr(dt) {
      var fart = Math.abs(b.flyr ? b.fvx : b.v);
      hjulsnurr += Math.min(fart / hjulradius, MAKSSNURR) * dt;
    }

    /* ---------- hendelser å reagere på ---------- */

    // Myntene får et merke når spruten er vist, så den ikke gjentas hver
    // rute. Fysikken nullstiller `tatt`; dette nullstilles her ved start.
    for (var mi = 0; mi < lope.mynter.length; mi++) lope.mynter[mi].blaff = false;

    function sePaaHendelser(dt) {
      // Landing: fysikken sier bare at bilen ikke flyr lenger.
      if (forrigeFlyr && !b.flyr) {
        var pos = fys.posisjon();
        smell(pos.x, pos.y);
        kamerarist(26);
      }
      forrigeFlyr = b.flyr;

      if (ristX > 0) {
        ristX *= 1 - 9 * dt;
        ristY *= 1 - 9 * dt;
        if (ristX < 0.5) ristX = ristY = 0;
      }

      // Støv fra bakhjulet når bilen ruller fort på bakken.
      if (!b.flyr && b.v > 260 && Math.random() < dt * 34) {
        var q = fys.posisjon();
        stov(q.x - BILBREDDE * 0.3, q.y, b.v);
      }
    }

    function seEtterTatteMynter() {
      for (var i = 0; i < lope.mynter.length; i++) {
        var m = lope.mynter[i];
        if (m.tatt && !m.blaff) {
          m.blaff = true;
          myntsprut(m.x, m.y);
        }
      }
    }

    /* ---------- tegning ---------- */

    function tegn() {
      var bredde = lerret.width, hoyde = lerret.height;
      var pos = fys.posisjon();
      var fart = b.flyr ? Math.hypot(b.fvx, b.fvy) : b.v;

      // Fart trekker bildet litt ut, så det føles raskere uten at bilen
      // blir borte.
      var skala = Math.max(bredde / SYNSBREDDE, hoyde / SYNSHOYDE) *
                  (1 - Math.min(0.11, fart / 14000));

      var kamX = pos.x + framsyn + ristX * (Math.random() - 0.5) * 2;
      var kamY = pos.y - 40 + ristY * (Math.random() - 0.5) * 2;

      var vidde = bredde / skala, hoydeV = hoyde / skala;
      var kam = {
        x: kamX, y: kamY,
        venstre: kamX - vidde * 0.45,
        hoyre: kamX + vidde * 0.62,
        bunn: kamY + hoydeV * 0.5,
        tid: tid,
        andel: Math.min(1, b.s / lope.lengde)
      };

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      kul.himmel(ctx, bredde, hoyde, kam);

      ctx.save();
      // Bilen står til venstre for midten, så det er plass til å se hva som
      // kommer. Den kjører bare én vei.
      ctx.translate(bredde * 0.36, hoyde * 0.56);
      ctx.scale(skala, skala);
      ctx.translate(-kamX, -kamY);

      kul.verden(ctx, kam);
      seEtterTatteMynter();
      tegnMynter(kam);
      tegnSkygge(pos);
      tegnPartikler();
      tegnBil(pos);
      tegnPopper();

      ctx.restore();

      fartsstriper(bredde, hoyde, fart);
      vignett(bredde, hoyde);
    }

    /*
     * Mynten er et snurrende merke, ikke en flat ring: bredden går som en
     * cosinus, så den vender kanten til med jevne mellomrom. Det er den
     * eneste bevegelsen i løypa som ikke kommer av at bilen flytter seg, og
     * uten den ser en stillestående strekning død ut.
     */
    function tegnMynter(kam) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < lope.mynter.length; i++) {
        var m = lope.mynter[i];
        if (m.tatt) continue;
        if (m.x < kam.venstre - 60 || m.x > kam.hoyre + 60) continue;

        var snurr = Math.cos(tid * 2.6 + m.x * 0.01);
        var sv = Math.abs(snurr) * 0.85 + 0.15;
        var loft = Math.sin(tid * 2 + m.x * 0.013) * 5;

        ctx.save();
        ctx.translate(m.x, m.y + loft);

        var glod = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
        glod.addColorStop(0, 'rgba(90,255,170,0.32)');
        glod.addColorStop(1, 'rgba(90,255,170,0)');
        ctx.fillStyle = glod;
        ctx.fillRect(-40, -40, 80, 80);

        ctx.scale(sv, 1);
        ctx.beginPath();
        ctx.arc(0, 0, 21, 0, Math.PI * 2);
        ctx.fillStyle = '#146b40';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = snurr > 0 ? '#5dffa8' : '#2ecc71';
        ctx.stroke();

        if (sv > 0.34) {
          ctx.fillStyle = '#b6ffd6';
          ctx.font = 'bold 28px system-ui, sans-serif';
          ctx.fillText('$', 0, 1);
        }
        ctx.restore();
      }
    }

    /*
     * Skyggen under bilen. På bakken er den en tett flekk; i lufta krymper
     * den og blekner med høyden, og ligger igjen nede på asfalten. Den er
     * pynt, men den er også det eneste som sier hvor høyt oppe bilen er midt
     * i et hopp – uten den er det umulig å bedømme en landing.
     */
    function tegnSkygge(pos) {
      var bakkeY = pos.y, hoyde = 0;

      if (b.flyr) {
        var p = lope.punkter, funnet = null;
        for (var i = b.hoppStart; i < p.length; i++) {
          if (p[i].bakke && p[i].x >= b.fx) { funnet = p[i]; break; }
        }
        if (!funnet) return;
        bakkeY = funnet.y;
        hoyde = Math.max(0, bakkeY - pos.y);
      }

      var n = Math.min(1, hoyde / 700);
      var bred = BILBREDDE * (0.46 - n * 0.22);
      ctx.globalAlpha = 0.34 * (1 - n * 0.75);
      ctx.fillStyle = '#0d1220';
      ctx.beginPath();
      ctx.ellipse(pos.x, bakkeY + 4, bred, 10 - n * 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function tegnBil(pos) {
      if (!bilder) return;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(b.vinkel);

      // Tegningens `bakke`-linje legges på selve løypa, så hjulene står på
      // asfalten i stedet for et stykke over eller under den.
      var topp = -bilder.bakke * bilskala;
      var fase = Math.floor(tid / BLINKTAKT) % bilder.kropp.length;

      ctx.drawImage(bilder.kropp[fase], -BILBREDDE * 0.5, topp, BILBREDDE, bilder.hoyde * bilskala);

      for (var i = 0; i < bilder.plasser.length; i++) {
        var p = bilder.plasser[i];
        var r = p.r * bilskala * bilder.hjulboks;
        ctx.save();
        ctx.translate(-BILBREDDE * 0.5 + p.x * bilskala, topp + p.y * bilskala);
        ctx.rotate(hjulsnurr);
        ctx.drawImage(bilder.hjul[fase], -r, -r, r * 2, r * 2);
        ctx.restore();
      }

      ctx.restore();
    }

    function tegnPopper() {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < popper.length; i++) {
        var p = popper[i];
        var levetid = p.stor ? 1.2 : 0.6;
        var a = 1 - p.alder / levetid;
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#4dfc9a';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        // Myntene kommer tett, og i full størrelse la de seg oppå hverandre
        // i en grønn grøt gjennom hele loopen. Bare stunt får stor skrift.
        ctx.lineWidth = p.stor ? 6 : 4;
        ctx.font = 'bold ' + (p.stor ? 44 : 26) + 'px system-ui, sans-serif';
        var tekst = '$' + p.belop + (p.tekst ? '  ' + p.tekst : '');
        var y = p.y - p.alder * (p.stor ? 110 : 70);
        ctx.strokeText(tekst, p.x, y);
        ctx.fillText(tekst, p.x, y);
      }
      ctx.globalAlpha = 1;
    }

    /*
     * De to siste laget ligger i skjermkoordinater, ikke i verden: striper
     * som skal lese som fart må følge skjermen, og en vignett som følger
     * kameraet ville vandret rundt i bildet.
     */
    function fartsstriper(bredde, hoyde, fart) {
      if (fart < 700) return;
      var styrke = Math.min(1, (fart - 700) / 900);
      ctx.lineCap = 'butt';
      for (var i = 0; i < 12; i++) {
        // Høyden er fast per stripe. Et tidlig forsøk lot dem gli nedover
        // også, og da så de ut som regn i stedet for fart.
        var y = Kulisse.slump(i) * hoyde;
        var l = bredde * (0.10 + Kulisse.slump(i + 9) * 0.20) * styrke;
        var runde = bredde * 1.7;
        var x = bredde * 1.2 -
                (tid * 2600 * (0.6 + Kulisse.slump(i + 3)) + Kulisse.slump(i + 4) * runde) % runde;

        /*
         * Stripa tones ut i begge ender. En jevn hvit strek med runde ender
         * leser som en ripe i skjermen – det er uttoningen som gjør den til
         * noe som farer forbi.
         */
        var a = styrke * 0.30 * (0.4 + Kulisse.slump(i + 11));
        var g = ctx.createLinearGradient(x - l, 0, x, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.45, 'rgba(255,255,255,' + a.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5 + Kulisse.slump(i + 2) * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - l, y);
        ctx.stroke();
      }
    }

    var vignettmaske = null, vignettMaal = '';

    function vignett(bredde, hoyde) {
      var nokkel = bredde + 'x' + hoyde;
      if (vignettMaal !== nokkel) {
        // Gradienten lages bare når skjermen endrer størrelse. En ny
        // radialgradient per bilderute er ren sløsing.
        vignettmaske = ctx.createRadialGradient(
          bredde * 0.45, hoyde * 0.5, Math.min(bredde, hoyde) * 0.35,
          bredde * 0.45, hoyde * 0.5, Math.max(bredde, hoyde) * 0.78);
        vignettmaske.addColorStop(0, 'rgba(0,0,0,0)');
        vignettmaske.addColorStop(1, 'rgba(6,8,18,0.48)');
        vignettMaal = nokkel;
      }
      ctx.fillStyle = vignettmaske;
      ctx.fillRect(0, 0, bredde, hoyde);
    }

    /* ---------- sløyfe ---------- */

    function bilderute(na) {
      if (!kjorer && b.ferdig) { tegn(); return; }
      if (!kjorer) return;

      /*
       * Tidsstemplet fra requestAnimationFrame kan ligge *bak* den
       * `performance.now()` vi leste rett før vi ba om ruta, og da blir dt
       * negativ på første bilderute. Det ga en `tid` under null, og
       * `Math.floor(-0.6) % 2` er -1 i JavaScript – ikke 1 – så blinkefasen
       * pekte på `kropp[-1]` og hele kjøringen stoppet med en tom drawImage.
       */
      var dt = Math.max(0, Math.min(0.1, (na - sistTid) / 1000 || 0));
      sistTid = na;
      tid += dt;
      rest += dt;
      snurr(dt);

      var vakt = 0;
      while (rest >= Fysikk.DT && vakt++ < 40) {
        rest -= Fysikk.DT;
        fys.steg();
        sePaaHendelser(Fysikk.DT);
        if (fys.ferdig()) break;
      }

      // Framsynet glir på plass i stedet for å hoppe, ellers rykker hele
      // bildet hver gang farten endrer seg brått – som i hver eneste landing.
      var fart = b.flyr ? Math.hypot(b.fvx, b.fvy) : b.v;
      var mal = Math.min(150, fart * 0.10);
      framsyn += (mal - framsyn) * Math.min(1, 2.5 * dt);

      oppdaterPartikler(dt);

      for (var i = popper.length - 1; i >= 0; i--) {
        popper[i].alder += dt;
        if (popper[i].alder > (popper[i].stor ? 1.2 : 0.6)) popper.splice(i, 1);
      }

      tegn();

      if (fys.ferdig()) {
        kjorer = false;
        if (ferdigKalt) ferdigKalt(fys.resultat());
        return;
      }
      requestAnimationFrame(bilderute);
    }

    return {
      start: function (nar) {
        ferdigKalt = nar;
        kjorer = true;
        sistTid = performance.now();
        requestAnimationFrame(bilderute);
      },
      stopp: function () { kjorer = false; },
      sett: fys.sett,
      tilstand: fys.tilstand,
      tegnEn: tegn
    };
  }

  return { lag: lag };
})();
