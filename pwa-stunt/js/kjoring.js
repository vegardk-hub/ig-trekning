/*
 * Kjøringen: fysikk, kamera og tegning av løypa.
 *
 * Fysikken er bevisst liten. Bilen har to tall – hvor langt den har kommet
 * langs kurven (`s`) og hvor fort den går (`v`) – og tyngdekraften virker
 * langs kurvens helning. Det er nok til at bakker koster fart, utforbakker
 * gir fart, og looper krever at man har fart med seg inn. Alt annet ville
 * vært et fysikkbibliotek.
 *
 * Bilen slipper kurven bare ett sted: på et hopp. Da er den et kast med
 * tyngdekraft til den treffer bakken igjen.
 *
 * To steder hjelper vi bilen med vilje, fordi appen ikke skal kunne tapes:
 * i looper er tyngdekraften dempet og farten har et gulv, og et hopp som
 * ikke helt rekker over, får lande på kanten i stedet for å falle ned i
 * hullet. Begge er synlige i tallene under, ikke gjemt i en spesialregel.
 */
'use strict';

var Kjoring = (function () {

  var G = 900;               // tyngdekraft i spillenheter per sekund²
  var DT = 1 / 120;          // fast tidssteg – variabelt steg gir looper som
                             // oppfører seg ulikt på 60 og 120 Hz
  var BILBREDDE = 168;
  var LOOPSTOTTE = 0.45;     // hvor mye av tyngdekraften som virker i en loop
  var LOOPGULV = 170;        // laveste fart inne i en loop

  // Hvor mye av verden som får plass. Skalaen tar den strengeste av bredde
  // og høyde, så bilen er like stor stående som liggende – uten det blir den
  // et frimerke i portrett og fyller skjermen i landskap.
  var SYNSBREDDE = 1000;
  var SYNSHOYDE = 1150;

  var MOTOR = {
    navn: 'Motor', tegn: '🔧', hva: 'Toppfart',
    priser: [0, 150, 350, 650],
    verdier: [700, 830, 960, 1100]
  };
  var GIR = {
    navn: 'Girkasse', tegn: '⚙️', hva: 'Akselerasjon',
    priser: [0, 120, 300, 600],
    verdier: [620, 790, 960, 1150]
  };
  var DEKK = {
    navn: 'Dekk', tegn: '🛞', hva: 'Grep i landing',
    priser: [0, 130, 320, 620],
    verdier: [0.45, 0.32, 0.20, 0.10]   // hvor mye fart en skjev landing spiser
  };

  var OPPGRADERINGER = [
    { id: 'motor', data: MOTOR },
    { id: 'gir', data: GIR },
    { id: 'dekk', data: DEKK }
  ];

  function lag(lerret, lope, bilbilde, oppg, bonus) {
    var ctx = lerret.getContext('2d');

    var b = {
      s: 0, v: 0,
      flyr: false, fx: 0, fy: 0, fvx: 0, fvy: 0,
      vinkel: 0, hjulsnurr: 0,
      hoppFra: 0, hoppStart: 0, hoppTid: 0,
      ferdig: false
    };

    var inn = { gass: false, brems: false };
    var penger = 0, mynter = 0, looper = 0, hopp = 0, lengsteHopp = 0;
    var popper = [];
    var tid = 0, rest = 0, sistTid = 0, staarTid = 0;
    var kjorer = false, ferdigKalt = null;

    var toppfart = MOTOR.verdier[oppg.motor];
    var kraft = GIR.verdier[oppg.gir];
    var landingstap = DEKK.verdier[oppg.dekk];

    for (var i = 0; i < lope.mynter.length; i++) lope.mynter[i].tatt = false;
    for (i = 0; i < lope.looper.length; i++) lope.looper[i].betalt = false;

    /* ---------- penger ---------- */

    /*
     * Alle beløp går gjennom her, og alle ganges med stilbonusen. Tallene er
     * satt slik at en helt umodifisert bil kjører inn rundt $350 på en tur,
     * mot rundt $4000 for å eie alt. Det gir en ny del hver eller annenhver
     * tur i starten – ofte nok til at det skjer noe, sjelden nok til at det
     * er noe igjen å glede seg til.
     */
    function betal(sum, tekst, x, y, stor) {
      var belop = Math.max(1, Math.round(sum * bonus));
      penger += belop;
      popper.push({ x: x, y: y, tekst: tekst, belop: belop, alder: 0, stor: !!stor });
    }

    /* ---------- fysikk ---------- */

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
      b.hjulsnurr += b.v * DT / 26;

      if (loop && !loop.betalt && b.s > loop.til - 30) {
        loop.betalt = true;
        looper++;
        betal(35, 'LOOP!', pkt.x, pkt.y, true);
      }

      if (b.s >= lope.lengde) {
        b.s = lope.lengde;
        avslutt();
        return;
      }

      var p = lope.punkter[pkt.i];
      if (p && p.hopp && b.v > 40) start_hopp(pkt);
    }

    function start_hopp(pkt) {
      b.flyr = true;
      b.fx = pkt.x;
      b.fy = pkt.y;
      b.fvx = Math.cos(pkt.vinkel) * b.v;
      b.fvy = Math.sin(pkt.vinkel) * b.v;
      b.hoppFra = pkt.x;
      b.hoppStart = pkt.i;
      b.hoppTid = 0;
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
      b.hjulsnurr += b.fvx * DT / 26;

      // Nesen følger farten. Bilen roterer altså aldri feil vei, og lander
      // alltid på hjulene – det er den samme regelen som at ingenting kan
      // gå galt i en loop.
      var mal = Math.atan2(b.fvy, b.fvx);
      b.vinkel += Lope.vinkeldiff(mal, b.vinkel) * Math.min(1, 4 * DT);

      var mark = bakkePunkt(b.hoppStart, b.fx);

      // Rekker ikke bilen over, får den kanten. Alternativet er en bil som
      // synker ned i hullet, og det er en måte å tape på.
      var kortet = b.fx < mark.x && b.fy > mark.y;

      if (b.fy >= mark.y || kortet) {
        land(mark);
      }
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

      betal(10 + lengde / 10 + b.hoppTid * 25, 'HOPP ' + lengde, mark.x, mark.y - 90, true);
    }

    function taMynter() {
      var x = b.flyr ? b.fx : Lope.ved(lope, b.s).x;
      var y = b.flyr ? b.fy : Lope.ved(lope, b.s).y;
      for (var i = 0; i < lope.mynter.length; i++) {
        var m = lope.mynter[i];
        if (m.tatt) continue;
        if (Math.abs(m.x - x) < 62 && Math.abs(m.y - (y - 40)) < 66) {
          m.tatt = true;
          mynter++;
          betal(4, '', m.x, m.y);
        }
      }
    }

    function avslutt() {
      if (b.ferdig) return;
      b.ferdig = true;
      kjorer = false;
      betal(30, 'I MÅL!', Lope.ved(lope, lope.lengde).x, Lope.ved(lope, lope.lengde).y - 90, true);
      if (ferdigKalt) {
        ferdigKalt({
          penger: penger, mynter: mynter, looper: looper,
          hopp: hopp, lengsteHopp: lengsteHopp, tid: tid
        });
      }
    }

    /* ---------- tegning ---------- */

    function bilPos() {
      if (b.flyr) return { x: b.fx, y: b.fy };
      var p = Lope.ved(lope, b.s);
      return { x: p.x, y: p.y };
    }

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
      if (!bilbilde) return;
      var h = BILBREDDE * bilbilde.height / bilbilde.width;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(b.vinkel);
      ctx.drawImage(bilbilde, -BILBREDDE * 0.5, -h + 8, BILBREDDE, h);
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

      var dt = Math.min(0.1, (na - sistTid) / 1000 || 0);
      sistTid = na;
      tid += dt;
      rest += dt;

      var vakt = 0;
      while (rest >= DT && vakt++ < 40) {
        rest -= DT;
        if (b.flyr) stegLuft(); else stegBakke();
        taMynter();
        if (b.ferdig) break;
      }

      for (var i = popper.length - 1; i >= 0; i--) {
        popper[i].alder += dt;
        if (popper[i].alder > (popper[i].stor ? 1.2 : 0.6)) popper.splice(i, 1);
      }

      tegn();
      if (kjorer) requestAnimationFrame(bilderute);
    }

    return {
      start: function (nar) {
        ferdigKalt = nar;
        kjorer = true;
        sistTid = performance.now();
        requestAnimationFrame(bilderute);
      },
      stopp: function () { kjorer = false; },
      sett: function (hva, pa) { inn[hva] = pa; },
      tilstand: function () {
        return {
          penger: penger,
          fart: Math.round((b.flyr ? Math.hypot(b.fvx, b.fvy) : b.v) / 8),
          andel: Math.min(1, b.s / lope.lengde),
          flyr: b.flyr,
          staar: staarTid > 1.2 && !b.ferdig
        };
      },
      tegnEn: tegn
    };
  }

  return { lag: lag, OPPGRADERINGER: OPPGRADERINGER, MOTOR: MOTOR, GIR: GIR, DEKK: DEKK };
})();
