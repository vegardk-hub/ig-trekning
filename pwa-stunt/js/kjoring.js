/*
 * Kjøringen: kamera, bakgrunn og tegning av løypa.
 *
 * Selve fysikken ligger i `fysikk.js`. Den ble skilt ut fordi løypa må
 * stemmes av mot tall bare simuleringen kjenner – avsprangsfart, hopplengde,
 * om en maksbil rekker fra siste hopp til mål – og de spørsmålene skal kunne
 * besvares av en prøve i node på et sekund, ikke av en nettleser som kjører
 * løypa i sanntid.
 *
 * Det som er igjen her, er utseende: hvor kameraet står, hvordan asfalten,
 * jorda og åsene tegnes, og hvor fort hjulene snurrer.
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
     * Ekte fart ville gitt over 40 grader per rute på toppfart. Taket ligger
     * godt under halve eikeavstanden, så hjulet alltid går rett vei; under
     * det er snurringen nøyaktig.
     */
    var MAKSSNURR = 16;   // radianer per sekund

    /*
     * Blinkefasen. Bilen er et bilde her, og et bilde animerer ikke – så
     * `Bil.tegninger()` har laget ett bilde per fase, og vi bytter mellom
     * dem i takt med klokka. Takten er den samme som CSS-animasjonen i
     * garasjen, så lysene blinker likt begge steder.
     */
    var BLINKTAKT = 0.45;   // sekunder per fase

    function snurr(dt) {
      var fart = Math.abs(b.flyr ? b.fvx : b.v);
      hjulsnurr += Math.min(fart / hjulradius, MAKSSNURR) * dt;
    }

    /* ---------- tegning ---------- */

    var bilPos = fys.posisjon;

    function tegn() {
      var bredde = lerret.width, hoyde = lerret.height;
      var skala = Math.max(bredde / SYNSBREDDE, hoyde / SYNSHOYDE);
      var pos = bilPos();

      // Kameraet følger bilen rett. Et tak på hvor høyt det kan gå var
      // fristende, men da klatrer bildet vekk fra bilen i loopene og man
      // mister den man styrer.
      var kamX = pos.x, kamY = pos.y - 40;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      himmel(bredde, hoyde);

      ctx.save();
      // Bilen står til venstre for midten, så det er plass til å se hva som
      // kommer. Den kjører bare én vei.
      ctx.translate(bredde * 0.36, hoyde * 0.56);
      ctx.scale(skala, skala);
      ctx.translate(-kamX, -kamY);

      aser(kamX, kamY, bredde / skala, hoyde / skala);
      tegnBakkefyll();
      tegnVei();
      tegnMaal();
      tegnMynter();
      tegnBil(pos);
      tegnPopper();

      ctx.restore();
    }

    function himmel(bredde, hoyde) {
      var g = ctx.createLinearGradient(0, 0, 0, hoyde);
      g.addColorStop(0, '#2b3a72');
      g.addColorStop(0.55, '#5a6fc0');
      g.addColorStop(1, '#9fa9de');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bredde, hoyde);
    }

    /*
     * Åsene i bakgrunnen. De ligger fast i forhold til kameraet og flyttes
     * bare en brøkdel av kamerabevegelsen – det er hele parallakseffekten,
     * og den er det eneste som gir følelse av fart mens bilen står stille
     * på skjermen. Høyden følger kameraet, ellers stuper horisonten ut av
     * bildet hver gang bilen går rundt en loop.
     */
    function aser(kamX, kamY, vidde, hoyde) {
      var lag = [
        { dybde: 0.26, farge: '#3d4a86', h: 220, b: 860, y: 0.40 },
        { dybde: 0.50, farge: '#46568f', h: 150, b: 590, y: 0.46 }
      ];
      var bunn = kamY + hoyde;
      for (var l = 0; l < lag.length; l++) {
        var a = lag[l];
        var grunn = kamY + hoyde * a.y;
        var faseskift = kamX * (1 - a.dybde);
        var forste = Math.floor((kamX - vidde - faseskift) / a.b) * a.b + faseskift;
        ctx.fillStyle = a.farge;
        ctx.beginPath();
        for (var x = forste; x < kamX + vidde; x += a.b) {
          // Buene er bredere enn avstanden mellom dem, så de går inn i
          // hverandre. Møttes de akkurat, fikk hver dal en skarp V som så
          // ut som en feil i tegningen heller enn som terreng.
          ctx.moveTo(x - a.b * 0.2, bunn);
          ctx.lineTo(x - a.b * 0.2, grunn);
          ctx.quadraticCurveTo(x + a.b / 2, grunn - a.h, x + a.b * 1.2, grunn);
          ctx.lineTo(x + a.b * 1.2, bunn);
          ctx.closePath();
        }
        ctx.fill();
      }
    }

    /*
     * Løypa deles i strekninger som brytes ved hopp, og bare der. Et tidlig
     * forsøk brøt på loop-punktene i stedet, og da fikk bakken et loddrett
     * hull i hele loopens bredde – man så himmelen gjennom jorda. Loopen er
     * en del av samme strekning; det er hoppet som er et ekte gap.
     */
    function strekninger() {
      var p = lope.punkter, ut = [], na = [];
      for (var i = 0; i < p.length; i++) {
        na.push(p[i]);
        if (p[i].hopp) { ut.push(na); na = []; }
      }
      if (na.length) ut.push(na);
      return ut;
    }

    var STREKNINGER = null;

    function tegnBakkefyll() {
      if (!STREKNINGER) STREKNINGER = strekninger();
      var dyp = lope.lavest + 1400;
      ctx.fillStyle = '#2f5a34';
      for (var s = 0; s < STREKNINGER.length; s++) {
        // Bare fast grunn danner overkanten. En loop skal ha himmel under seg.
        var g = STREKNINGER[s].filter(function (q) { return q.bakke; });
        if (g.length < 2) continue;
        // Første og siste strekning strekkes ut til sidene. Uten det slutter
        // jorda tvert ved startstreken, og bilen står på en grønn flate med
        // himmel rett bak seg.
        var venstre = s === 0 ? g[0].x - 4000 : g[0].x;
        var hoyre = s === STREKNINGER.length - 1 ? g[g.length - 1].x + 4000 : g[g.length - 1].x;

        ctx.beginPath();
        ctx.moveTo(venstre, g[0].y);
        for (var k = 0; k < g.length; k++) ctx.lineTo(g[k].x, g[k].y);
        ctx.lineTo(hoyre, g[g.length - 1].y);
        ctx.lineTo(hoyre, dyp);
        ctx.lineTo(venstre, dyp);
        ctx.closePath();
        ctx.fill();
      }
    }

    function tegnVei() {
      if (!STREKNINGER) STREKNINGER = strekninger();

      function strek(bredde, farge, stiplet) {
        ctx.lineWidth = bredde;
        ctx.strokeStyle = farge;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash(stiplet || []);
        for (var s = 0; s < STREKNINGER.length; s++) {
          var d = STREKNINGER[s];
          ctx.beginPath();
          ctx.moveTo(d[0].x, d[0].y);
          for (var k = 1; k < d.length; k++) ctx.lineTo(d[k].x, d[k].y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      strek(30, '#20242c');
      strek(22, '#39414f');
      strek(3, 'rgba(255,255,255,0.5)', [26, 30]);
    }

    function tegnMaal() {
      var p = lope.punkter[lope.punkter.length - 1];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 6, p.y - 230, 12, 230);
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 3; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#ffffff' : '#1b1e24';
          ctx.fillRect(p.x + 6 + c * 26, p.y - 228 + r * 26, 26, 26);
        }
      }
    }

    function tegnMynter() {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < lope.mynter.length; i++) {
        var m = lope.mynter[i];
        if (m.tatt) continue;
        var puls = 1 + Math.sin(tid * 5 + m.x * 0.02) * 0.06;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.scale(puls, puls);
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.22)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#2ecc71';
        ctx.stroke();
        ctx.fillStyle = '#7dfcb0';
        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.fillText('$', 0, 1);
        ctx.restore();
      }
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
        if (fys.ferdig()) break;
      }

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
