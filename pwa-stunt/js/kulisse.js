/*
 * Kulissene: himmel, landskap, asfalt og mål.
 *
 * Alt som *ikke* er bilen eller partiklene tegnes her. Skilt fra
 * `kjoring.js` av samme grunn som fysikken ble det: den fila svarer for
 * kamera, kjøretøy og sløyfe, og et landskap med fire parallakselag, sol,
 * skyer og jordlag hører ikke hjemme sammen med det.
 *
 * To ting bærer utseendet:
 *
 *   Dybde uten 3D. Det finnes ingen WebGL her. Følelsen av rom kommer fra
 *   fire parallakselag som blandes mot himmelfargen etter avstand
 *   (luftperspektiv), fra at bakken er et *tverrsnitt* med gress, jord og
 *   fjell i lag, og fra at asfalten har tykkelse i stedet for å være en
 *   strek. Det er billigere enn en 3D-motor og leser like romlig i profil.
 *
 *   Klipping. Løypa har nesten 3000 punkter, og under to hundre av dem er
 *   synlige om gangen. Alt her tegner bare det som er innenfor kameraet, og
 *   finner området ved å gå utover fra bilens eget punkt. Uten det spiste
 *   asfalten alene hele rutebudsjettet, og det ville ikke vært plass til
 *   noe av det andre.
 */
'use strict';

var Kulisse = (function () {

  /* ---------- farger ---------- */

  /*
   * Leser både `#rrggbb` og `rgb(r,g,b)`. Begge former trengs fordi `bland()`
   * gir fra seg `rgb(...)`, og luftperspektivet blander en allerede blandet
   * himmelfarge videre inn i åsene. Uten rgb-grenen ga det andre leddet
   * `rgb(NaN,NaN,NaN)` – som canvas *ignorerer stille*, så flaten ble tegnet i
   * forrige farge og hele landskapet kom ut som én blek klump.
   */
  function les(farge) {
    if (farge.charAt(0) === '#') {
      return [parseInt(farge.substr(1, 2), 16),
              parseInt(farge.substr(3, 2), 16),
              parseInt(farge.substr(5, 2), 16)];
    }
    var t = farge.match(/\d+/g);
    return [+t[0], +t[1], +t[2]];
  }

  function bland(a, b, t) {
    var x = les(a), y = les(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' +
                    Math.round(x[1] + (y[1] - x[1]) * t) + ',' +
                    Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }

  /*
   * Himmelen går fra morgen til solnedgang gjennom turen. Løypa er lang nok
   * til at en tur føles som en reise, og en himmel som skifter er det
   * billigste som sier det. Fargene hentes ut med `andel`, altså hvor langt
   * bilen har kommet.
   */
  var MORGEN = { topp: '#17235c', midt: '#4a72c4', bunn: '#a9cfe6', sol: '#fff6cf', dis: '#a9cfe6' };
  var KVELD  = { topp: '#241546', midt: '#8c3f6e', bunn: '#f2a15c', sol: '#ffd7a0', dis: '#f2a15c' };

  function himmelfarger(andel) {
    // Skiftet skjer mest på slutten, så mesteparten av turen er lys.
    var t = Math.pow(Math.min(1, Math.max(0, andel)), 1.7);
    return {
      topp: bland(MORGEN.topp, KVELD.topp, t),
      midt: bland(MORGEN.midt, KVELD.midt, t),
      bunn: bland(MORGEN.bunn, KVELD.bunn, t),
      sol: bland(MORGEN.sol, KVELD.sol, t),
      dis: bland(MORGEN.dis, KVELD.dis, t),
      t: t
    };
  }

  /* ---------- faste, men tilfeldig utseende tall ---------- */

  /*
   * Stjerner og skyer skal stå i ro fra rute til rute. `Math.random()` ville
   * flyttet dem hver gang; en enkel hash på indeksen gir det samme rotete
   * inntrykket og er fast.
   */
  function slump(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /*
   * Fjellprofilen er en formel, ikke en lagret punktliste: da er den
   * sammenhengende uansett hvor kameraet står, og koster ingenting å hoppe
   * inn i midten av.
   *
   * `1 - |sin|` og ikke `sin`. En ren sinus gir bølger med runde topper, og
   * fire lag med runde topper leser som vann, ikke som fjell. Absoluttverdien
   * legger en knekk på toppen og runder dalen – det er den knekken som gjør
   * en silhuett til et fjell.
   *
   * Frekvensene er satt mot synsfeltet: kameraet ser omtrent 630 enheter i
   * bredden, så hovedtoppene kommer med drøyt halvannen skjerms mellomrom.
   */
  function fjellhoyde(x, frø) {
    var rygg = 1 - Math.abs(Math.sin(x * 0.0034 + frø));
    return 0.34 + 0.48 * rygg +
                  0.12 * Math.sin(x * 0.0091 + frø * 2.3) +
                  0.06 * Math.sin(x * 0.0223 + frø * 4.1);
  }

  /* ---------- modulen ---------- */

  function lag(lope) {

    var p = lope.punkter;

    /*
     * Strekninger som indeksområder, brutt ved hopp og bare der. Et tidlig
     * forsøk brøt på loop-punktene, og da fikk bakken et loddrett hull i
     * loopens bredde – man så himmelen gjennom jorda.
     *
     * Dette er veien. Den går over broene som over alt annet.
     */
    var STREKK = [];
    (function () {
      var fra = 0;
      for (var i = 0; i < p.length; i++) {
        if (p[i].hopp) { STREKK.push({ fra: fra, til: i }); fra = i + 1; }
      }
      STREKK.push({ fra: fra, til: p.length - 1 });
    })();

    /*
     * Jorda under veien er en annen liste, for den brytes ett sted til: en
     * bro er fast grunn *uten* fylling under. Tegnes jorda der også, står
     * broa på en haug og stillaset henger i den.
     *
     * `apen0`/`apen1` sier om enden skal strekkes 4000 enheter utover. Det
     * skal den bare når den er løypas egen ende – en ende mot et gap eller en
     * bro er en ekte kant, og strekkes den, legger jorda seg tvers under
     * hoppet.
     */
    var JORDSTREKK = [];
    (function () {
      // `luft` på sonen, ikke navnet «bro». En ny sone som henger fritt –
      // en planke over en kløft, et stillas – skal få hullet sitt uten at
      // noen må huske å nevne den her også.
      function luft(i) {
        var s = Lope.SONER[p[i].sone];
        return p[i].hopp || !!(s && s.luft);
      }
      var fra = 0, apen = true;
      for (var i = 0; i < p.length; i++) {
        if (!luft(i)) continue;
        JORDSTREKK.push({ fra: fra, til: i - 1, apen0: apen, apen1: false });
        while (i < p.length && luft(i)) i++;
        fra = i;
        apen = false;
      }
      JORDSTREKK.push({ fra: fra, til: p.length - 1, apen0: apen, apen1: true });
    })();

    /*
     * Soner som sammenhengende indeksområder. De tegnes hver for seg oppå
     * asfalten, og de er den ene tingen som gjør at to baner med de samme
     * bakkene ser ut som to steder.
     */
    var SONESTREKK = [];
    (function () {
      var fra = -1;
      for (var i = 0; i <= p.length; i++) {
        var s = i < p.length ? p[i].sone : null;
        if (fra >= 0 && s !== p[fra].sone) {
          SONESTREKK.push({ sone: p[fra].sone, fra: fra, til: i - 1 });
          fra = -1;
        }
        if (s && fra < 0) fra = i;
      }
    })();

    /*
     * Loopene som geometri. De brukes til å tegne stillaset under dem: en
     * loop som henger fritt i lufta ser ut som en strek noen har glemt å
     * feste, og et par søyler med kryssbånd gjør den til et byggverk.
     */
    var LOOPER = [];
    (function () {
      var fra = -1;
      for (var i = 0; i < p.length; i++) {
        if (!p[i].bakke && fra < 0) fra = i;
        if ((p[i].bakke || i === p.length - 1) && fra >= 0) {
          var minX = Infinity, maksX = -Infinity, minY = Infinity, maksY = -Infinity;
          for (var k = fra; k < i; k++) {
            if (p[k].x < minX) minX = p[k].x;
            if (p[k].x > maksX) maksX = p[k].x;
            if (p[k].y < minY) minY = p[k].y;
            if (p[k].y > maksY) maksY = p[k].y;
          }
          LOOPER.push({ minX: minX, maksX: maksX, topp: minY, bunn: maksY });
          fra = -1;
        }
      }
    })();

    // Hvor langt ut i lista kameraet sto sist. Det går bare framover, så
    // søket neste rute starter et par punkter unna svaret.
    var sist = 0;

    /*
     * Synlig indeksområde. Går utover fra der *kameraet* står, ikke fra
     * bilen: under et langt hopp er bilen tusenvis av enheter foran rampa
     * den tok av fra, og et søk som startet der ville dratt med seg hele
     * strekningen imellom.
     *
     * Kurven er sammenhengende, så naboene i lista er naboer i rommet, og et
     * par hundre steg holder.
     */
    function omrade(kam) {
      while (sist < p.length - 1 && p[sist].x < kam.x) sist++;
      while (sist > 0 && p[sist].x > kam.x) sist--;
      var a = sist, b = sist;
      while (a > 0 && p[a].x > kam.venstre) a--;
      while (b < p.length - 1 && p[b].x < kam.hoyre) b++;
      return { a: a, b: b };
    }

    /* ---------- himmel ---------- */

    function himmel(ctx, bredde, hoyde, kam) {
      var f = himmelfarger(kam.andel);

      var g = ctx.createLinearGradient(0, 0, 0, hoyde);
      g.addColorStop(0, f.topp);
      g.addColorStop(0.55, f.midt);
      g.addColorStop(1, f.bunn);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bredde, hoyde);

      // Stjerner tennes først når himmelen mørkner. De ligger nesten helt
      // stille – en stjerne som følger kameraet merkbart, ser ut som støv på
      // skjermen.
      if (f.t > 0.35) {
        ctx.globalAlpha = (f.t - 0.35) / 0.65 * 0.9;
        ctx.fillStyle = '#ffffff';
        for (var i = 0; i < 70; i++) {
          var sx = (slump(i) * bredde * 2 - kam.x * 0.04) % (bredde * 2);
          if (sx < 0) sx += bredde * 2;
          if (sx > bredde) continue;
          var sy = slump(i + 99) * hoyde * 0.55;
          var r = 0.7 + slump(i + 7) * 1.6;
          ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(kam.tid * 2 + i);
          ctx.fillRect(sx, sy, r, r);
          ctx.globalAlpha = (f.t - 0.35) / 0.65 * 0.9;
        }
        ctx.globalAlpha = 1;
      }

      // Sola synker gjennom turen og blir større og varmere mot slutten,
      // som en ekte lav sol.
      var solX = bredde * 0.74 - (kam.x * 0.012) % (bredde * 1.6);
      if (solX < -bredde * 0.3) solX += bredde * 1.6;
      var solY = hoyde * (0.16 + 0.42 * f.t);
      var r0 = bredde * (0.05 + 0.02 * f.t);

      var glod = ctx.createRadialGradient(solX, solY, r0 * 0.6, solX, solY, r0 * 7);
      glod.addColorStop(0, f.sol);
      glod.addColorStop(0.18, 'rgba(255,225,160,0.30)');
      glod.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = glod;
      ctx.fillRect(0, 0, bredde, hoyde);

      ctx.fillStyle = f.sol;
      ctx.beginPath();
      ctx.arc(solX, solY, r0, 0, Math.PI * 2);
      ctx.fill();

      skyer(ctx, bredde, hoyde, kam, f);
    }

    function skyer(ctx, bredde, hoyde, kam, f) {
      var lag = [
        { dybde: 0.06, y: 0.10, s: 1.5, a: 0.30, n: 6 },
        { dybde: 0.14, y: 0.24, s: 1.0, a: 0.45, n: 7 }
      ];
      for (var l = 0; l < lag.length; l++) {
        var L = lag[l];
        ctx.fillStyle = bland('#ffffff', f.sol, 0.35 + 0.4 * f.t);
        ctx.globalAlpha = L.a;
        var bredd = bredde * 2.2;
        for (var i = 0; i < L.n; i++) {
          var cx = (slump(i + l * 31) * bredd - kam.x * L.dybde) % bredd;
          if (cx < 0) cx += bredd;
          if (cx > bredde + 200 || cx < -200) continue;
          var cy = hoyde * (L.y + slump(i + l * 17 + 3) * 0.10);
          var s = (24 + slump(i + l * 13) * 26) * L.s * (bredde / 900);
          ctx.beginPath();
          ctx.arc(cx, cy, s, 0, Math.PI * 2);
          ctx.arc(cx + s * 0.9, cy + s * 0.18, s * 0.75, 0, Math.PI * 2);
          ctx.arc(cx - s * 0.9, cy + s * 0.22, s * 0.65, 0, Math.PI * 2);
          ctx.arc(cx + s * 0.2, cy - s * 0.45, s * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- landskapet bak løypa ---------- */

    /*
     * Fire lag, bakerst først. Hvert lag blandes mot himmelens bunnfarge
     * etter hvor langt unna det er – det er luftperspektiv, og det er den
     * enkleste tingen som gir dybde i en flat profil. Uten det blir alle
     * åsene like harde og bildet flatt uansett hvor mange lag man legger på.
     */
    var LANDSKAP = [
      { dybde: 0.10, farge: '#2f3f7a', dis: 0.66, h: 620, y: 0.08, fro: 1.3, sno: 0.80 },
      { dybde: 0.20, farge: '#2b4a72', dis: 0.46, h: 470, y: 0.15, fro: 3.7, sno: 0.86 },
      { dybde: 0.34, farge: '#2a5359', dis: 0.26, h: 330, y: 0.22, fro: 6.1, trar: true },
      { dybde: 0.54, farge: '#27543b', dis: 0.11, h: 220, y: 0.30, fro: 9.4, trar: true }
    ];

    /*
     * Lagets egen x. Et lag skal vandre `dybde` så fort som kameraet, og det
     * får det ved å lese profilen et stykke tilbake – ikke ved å gange x-en
     * med `dybde`. Forskjellen er hele poenget: ganger man x-en, ganges
     * bølgelengden med det samme, og de fjerne lagene kommer ut som flate
     * plater fordi én skjerm da dekker en tiendedel av en fjellrygg.
     */
    function lagX(L, x, kam) {
      return x - kam.x * (1 - L.dybde);
    }

    function landskap(ctx, kam) {
      var f = himmelfarger(kam.andel);
      var vidde = kam.hoyre - kam.venstre;
      var bunn = kam.bunn + 500;
      var px0 = kam.venstre - 120, px1 = kam.hoyre + 120;
      var steg = Math.max(9, vidde / 70);

      for (var l = 0; l < LANDSKAP.length; l++) {
        var L = LANDSKAP[l];
        var grunn = kam.y + (kam.bunn - kam.y) * L.y;
        var x;

        /*
         * Loddrett forløp i hvert lag, lysest øverst. Det er den billigste
         * måten å gi en silhuett form på: uten den er laget en utklippet
         * papirbit, med den ser ryggen ut til å fange lys på toppen og ligge
         * i skygge ned mot foten.
         */
        var topp = bland(L.farge, f.dis, L.dis);
        var fot = bland(L.farge, '#0d1330', 0.34);
        var gr = ctx.createLinearGradient(0, grunn - L.h, 0, grunn + L.h * 0.25);
        gr.addColorStop(0, bland(topp, '#ffffff', 0.10));
        gr.addColorStop(0.55, topp);
        gr.addColorStop(1, bland(fot, f.dis, L.dis * 0.7));

        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(px0, bunn);
        for (x = px0; x <= px1; x += steg) {
          ctx.lineTo(x, grunn - L.h * fjellhoyde(lagX(L, x, kam), L.fro));
        }
        ctx.lineTo(px1, bunn);
        ctx.closePath();
        ctx.fill();

        /*
         * Snø over snøgrensa. Den klippes mot fjellet som nettopp ble fylt,
         * så grensa blir en vannrett linje tvers over ryggene – akkurat som
         * en ekte snøgrense, og gratis: det er samme banen én gang til.
         */
        if (L.sno) {
          ctx.save();
          ctx.clip();
          ctx.fillStyle = bland('#eaf1ff', f.dis, L.dis * 0.75);
          ctx.fillRect(px0, grunn - L.h * 1.3, px1 - px0, L.h * (1.3 - L.sno));
          ctx.restore();
        }

        // Grantrær langs kanten på de to nærmeste lagene.
        if (L.trar) {
          ctx.fillStyle = bland('#1d3f2c', f.dis, L.dis * 0.9);
          for (var tx = px0; tx <= px1; tx += steg * 1.6) {
            var ty = grunn - L.h * fjellhoyde(lagX(L, tx, kam), L.fro);
            var th = (18 + slump(Math.floor(tx / 17)) * 26) * (0.6 + L.dybde);
            var tb = th * 0.40;
            ctx.beginPath();
            ctx.moveTo(tx, ty - th);
            ctx.lineTo(tx + tb, ty + 6);
            ctx.lineTo(tx - tb, ty + 6);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    /* ---------- bakken som tverrsnitt ---------- */

    var GRESS = '#3f8f45';
    var GRESS_KANT = '#58b45c';
    var JORD = '#5a4030';
    var JORD_MORK = '#46301f';
    var FJELL = '#33323f';

    /*
     * Bakken er ikke en grønn flate, den er et tverrsnitt: gresstorv øverst,
     * jord under, fjell nederst. Det er det samme grepet som i en
     * geologisk profil, og det er grunnen til at bakken ser ut til å ha
     * volum i stedet for å være en silhuett.
     */
    // Ett jordlag: en stripe mellom to dybder under overflaten. Er `tykk1`
    // et tall, lukkes stripa mot den dybden; er det bunnen, går den helt ned.
    function lagflate(ctx, g, v, h, tykk0, tykk1, farge) {
      var k;
      ctx.fillStyle = farge;
      ctx.beginPath();
      ctx.moveTo(v, g[0].y + tykk0);
      for (k = 0; k < g.length; k++) ctx.lineTo(g[k].x, g[k].y + tykk0);
      ctx.lineTo(h, g[g.length - 1].y + tykk0);
      ctx.lineTo(h, g[g.length - 1].y + tykk1);
      for (k = g.length - 1; k >= 0; k--) ctx.lineTo(g[k].x, g[k].y + tykk1);
      ctx.lineTo(v, g[0].y + tykk1);
      ctx.closePath();
      ctx.fill();
    }

    function bakke(ctx, kam, omr) {
      var dyp = lope.lavest + 2200;
      var k;

      for (var s = 0; s < JORDSTREKK.length; s++) {
        var R = JORDSTREKK[s];
        var fra = Math.max(R.fra, omr.a);
        var til = Math.min(R.til, omr.b);
        if (til - fra < 1) continue;

        // Bare fast grunn danner overkanten. En loop skal ha himmel under seg.
        var g = [];
        for (var i = fra; i <= til; i++) if (p[i].bakke) g.push(p[i]);
        if (g.length < 2) continue;

        /*
         * Kantene strekkes 4000 enheter ut når de skyldes klipping eller er
         * løypas egne ender. Uten det slutter jorda tvert i skjermkanten –
         * og ved startstreken sto bilen på en grønn flate med himmel rett
         * bak seg.
         */
        var v = (R.apen0 || fra > R.fra) ? g[0].x - 4000 : g[0].x;
        var h = (R.apen1 || til < R.til) ? g[g.length - 1].x + 4000 : g[g.length - 1].x;

        // Fjellet går helt til bunnen, så dybden er et absolutt tall og ikke
        // en tykkelse: `dyp` ligger langt under laveste punkt i løypa.
        lagflate(ctx, g, v, h, 150, dyp - g[0].y, FJELL);
        lagflate(ctx, g, v, h, 28, 150, JORD);
        lagflate(ctx, g, v, h, 0, 28, GRESS);

        // Lys kant på torva. Den gjør skillet mellom gress og himmel skarpt
        // og er det som får bakken til å «slutte» et sted.
        ctx.strokeStyle = GRESS_KANT;
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(v, g[0].y);
        for (k = 0; k < g.length; k++) ctx.lineTo(g[k].x, g[k].y);
        ctx.lineTo(h, g[g.length - 1].y);
        ctx.stroke();

        // Et par lag i fjellet, så det ikke er en ensfarget blokk.
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 3;
        for (var d = 260; d < 900; d += 210) {
          ctx.beginPath();
          ctx.moveTo(v, g[0].y + d);
          for (k = 0; k < g.length; k += 3) ctx.lineTo(g[k].x, g[k].y + d);
          ctx.lineTo(h, g[g.length - 1].y + d);
          ctx.stroke();
        }
      }
    }

    /* ---------- stillas under loopene ---------- */

    /*
     * Stillaset står *utenfor* loopen, ikke tvers over den. Et tidlig forsøk
     * la kryssbånd mellom loopens ytterkanter, og siden loopen er åpen i
     * midten så man rett på båndene gjennom hullet – det leste som et
     * spindelvev, ikke som et byggverk.
     */
    function stillas(ctx, kam) {
      for (var i = 0; i < LOOPER.length; i++) {
        var L = LOOPER[i];
        if (L.maksX < kam.venstre - 240 || L.minX > kam.hoyre + 240) continue;

        var fot = L.bunn + 40;
        var sx = [L.minX - 26, L.maksX + 26];
        var tak = L.topp - 22;

        ctx.strokeStyle = '#2c3242';
        ctx.lineCap = 'round';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(sx[0], tak); ctx.lineTo(sx[0], fot);
        ctx.moveTo(sx[1], tak); ctx.lineTo(sx[1], fot);
        ctx.moveTo(sx[0], tak); ctx.lineTo(sx[1], tak);
        ctx.stroke();

        // Skråstivere ned mot bakken og korte armer inn mot loopen. Begge
        // holder seg i kanten, så åpningen blir stående fri.
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#353c4f';
        ctx.beginPath();
        ctx.moveTo(sx[0], fot - 90); ctx.lineTo(sx[0] - 52, fot);
        ctx.moveTo(sx[1], fot - 90); ctx.lineTo(sx[1] + 52, fot);
        for (var k = 1; k <= 3; k++) {
          var y = tak + (fot - tak) * (k / 4);
          ctx.moveTo(sx[0], y); ctx.lineTo(sx[0] + 26, y);
          ctx.moveTo(sx[1], y); ctx.lineTo(sx[1] - 26, y);
        }
        ctx.stroke();
      }
    }

    /* ---------- asfalten ---------- */

    /*
     * Veien tegnes som et bånd med to kanter, ikke som en strek. Kantene
     * ligger langs normalen, så båndet har samme bredde i en loop som på
     * flatmark – en strek med `lineWidth` ville gitt samme bildet, men da er
     * det ingen kant å legge rekkverk eller høylys på, og veien blir flat.
     */
    var VEIBREDDE = 15;

    // Punktet `ut` enheter ut fra veien langs normalen. Negativ `ut` er
    // undersiden. Alt som legger seg på veien – soner, rekkverk, rumleriller –
    // går gjennom denne, så det følger loopene av seg selv.
    function utX(i, ut) { return p[i].x + Math.sin(p[i].vinkel) * ut; }
    function utY(i, ut) { return p[i].y - Math.cos(p[i].vinkel) * ut; }

    // Lukket bane langs et stykke vei, `ut` på hver side.
    function bandbane(ctx, fra, til, ut) {
      ctx.beginPath();
      for (var i = fra; i <= til; i++) {
        if (i === fra) ctx.moveTo(utX(i, ut), utY(i, ut));
        else ctx.lineTo(utX(i, ut), utY(i, ut));
      }
      for (i = til; i >= fra; i--) ctx.lineTo(utX(i, -ut), utY(i, -ut));
      ctx.closePath();
    }

    function veibaand(ctx, omr, ut, farge, kant) {
      for (var s = 0; s < STREKK.length; s++) {
        var fra = Math.max(STREKK[s].fra, omr.a);
        var til = Math.min(STREKK[s].til, omr.b);
        if (til - fra < 1) continue;

        ctx.fillStyle = farge;
        bandbane(ctx, fra, til, ut);
        ctx.fill();

        if (kant) {
          ctx.strokeStyle = kant;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (var i = fra; i <= til; i++) {
            if (i === fra) ctx.moveTo(utX(i, ut), utY(i, ut));
            else ctx.lineTo(utX(i, ut), utY(i, ut));
          }
          ctx.stroke();
        }
      }
    }

    function vei(ctx, kam, omr) {
      veibaand(ctx, omr, VEIBREDDE + 7, '#15181f', null);        // understell
      veibaand(ctx, omr, VEIBREDDE, '#3c4454', '#5b657a');       // asfalt med høylys
      veibaand(ctx, omr, VEIBREDDE * 0.55, 'rgba(255,255,255,0.045)', null);

      // Midtstripa
      ctx.strokeStyle = 'rgba(255,240,200,0.55)';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([26, 30]);
      ctx.lineCap = 'butt';
      for (var s = 0; s < STREKK.length; s++) {
        var fra = Math.max(STREKK[s].fra, omr.a);
        var til = Math.min(STREKK[s].til, omr.b);
        if (til - fra < 1) continue;
        ctx.beginPath();
        ctx.moveTo(p[fra].x, p[fra].y);
        for (var i = fra + 1; i <= til; i++) ctx.lineTo(p[i].x, p[i].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    /* ---------- sonene ---------- */

    /*
     * Hver sone tegnes oppå asfalten, etter at veien står. De er delt i to
     * grupper av en grunn: is, gjørme og rumlefelt er *underlag* og legger seg
     * på veibåndet, mens tunnel og bro er *byggverk* som rekker langt utenfor
     * det. Rekkefølgen under følger det – byggverkene sist, så de får ligge
     * oppå.
     */

    function is(ctx, fra, til) {
      ctx.fillStyle = '#cfeeff';
      bandbane(ctx, fra, til, VEIBREDDE + 3);
      ctx.fill();

      // Blankskuret midt i sporet. Isen er det eneste underlaget som skal se
      // *glatt* ut, og et hvitt høylys midt på båndet er det som sier det.
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      bandbane(ctx, fra, til, VEIBREDDE * 0.4);
      ctx.fill();

      // Istapper under kanten. De henger bare på undersiden, så de leser som
      // is og ikke som en hvit strek noen har malt.
      ctx.fillStyle = 'rgba(207,238,255,0.85)';
      for (var i = fra; i <= til; i += 9) {
        var h = 8 + slump(i) * 22;
        ctx.beginPath();
        ctx.moveTo(utX(i, -VEIBREDDE - 2), utY(i, -VEIBREDDE - 2));
        ctx.lineTo(utX(i + 3, -VEIBREDDE - 2), utY(i + 3, -VEIBREDDE - 2));
        ctx.lineTo(utX(i + 1, -VEIBREDDE - 2 - h), utY(i + 1, -VEIBREDDE - 2 - h));
        ctx.closePath();
        ctx.fill();
      }
    }

    function gjorme(ctx, fra, til) {
      ctx.fillStyle = '#4a3422';
      bandbane(ctx, fra, til, VEIBREDDE + 4);
      ctx.fill();

      /*
       * Sølepytter og hjulspor. Uten de lyse flekkene ser gjørma bare ut som
       * asfalt i en annen farge. De klippes mot gjørmebåndet: uten klippet la
       * de seg utover torva langs veien, og gresset fikk brune prikker der
       * det ikke er noen gjørme.
       */
      ctx.save();
      bandbane(ctx, fra, til, VEIBREDDE + 4);
      ctx.clip();
      for (var i = fra; i <= til; i += 5) {
        var r = 3 + slump(i * 3) * 9;
        var av = (slump(i + 5) - 0.5) * VEIBREDDE * 1.4;
        ctx.fillStyle = slump(i) > 0.55 ? 'rgba(122,92,58,0.9)' : 'rgba(30,22,14,0.8)';
        ctx.beginPath();
        ctx.arc(utX(i, av), utY(i, av), r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function rumle(ctx, fra, til) {
      /*
       * Riller på tvers. De er det eneste av de tre underlagene som ikke
       * farger veien om – rumlefeltet er asfalt, bare frest opp. Derfor må de
       * stå glissent: tett nok til å lese som riller, og med asfalt imellom.
       * Et første forsøk hadde dem hvert fjerde punkt og fem brede, og da ble
       * strekningen en svart renne det så ut som veien manglet.
       */
      ctx.strokeStyle = 'rgba(12,14,20,0.55)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      for (var i = fra; i <= til; i += 7) {
        ctx.moveTo(utX(i, VEIBREDDE), utY(i, VEIBREDDE));
        ctx.lineTo(utX(i, -VEIBREDDE), utY(i, -VEIBREDDE));
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,214,90,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (i = fra; i <= til; i += 7) {
        ctx.moveTo(utX(i, VEIBREDDE + 2), utY(i, VEIBREDDE + 2));
        ctx.lineTo(utX(i, VEIBREDDE + 9), utY(i, VEIBREDDE + 9));
      }
      ctx.stroke();
    }

    /*
     * Tunnelen er en fjellmasse over veien, og den må lukke seg ned mot
     * asfalten i begge ender – ellers er den et tak som svever, ikke en
     * åpning inn i et fjell. Taket tegnes derfor med en høyde som toner ut
     * mot null de siste hundre punktene.
     */
    /*
     * Taket ligger lavt med vilje. Kameraet ser 1260 enheter i høyden, så et
     * tak 260 over veien havner nesten en tredjedels skjerm opp – og da så
     * bilen ut til å kjøre under en mørk sky i stedet for inne i et fjell.
     * 150 er omtrent halvannen bilhøyde: trangt, men bilen er tydelig inni.
     */
    var TUNNELHOYDE = 150;

    function tunnelTak(i, fra, til) {
      var inn = Math.min(i - fra, til - i) / 34;
      var h = TUNNELHOYDE * Math.min(1, inn);
      return h * (0.82 + 0.18 * Math.sin(i * 0.11));
    }

    function tunnel(ctx, fra, til, kam) {
      var i;

      // Mørket inne i tunnelen. Det ligger under fjellet, så veien fortsatt
      // skimtes – en helsvart tunnel er en tunnel man ikke ser bilen i.
      ctx.fillStyle = 'rgba(8,6,14,0.62)';
      ctx.beginPath();
      for (i = fra; i <= til; i++) {
        var h = tunnelTak(i, fra, til);
        if (i === fra) ctx.moveTo(utX(i, h), utY(i, h));
        else ctx.lineTo(utX(i, h), utY(i, h));
      }
      for (i = til; i >= fra; i--) ctx.lineTo(utX(i, -VEIBREDDE), utY(i, -VEIBREDDE));
      ctx.closePath();
      ctx.fill();

      /*
       * Fjellet er et *bånd* over taket, ikke en masse som går opp og ut av
       * bildet. Et første forsøk fylte helt opp til 900 enheter over veien, og
       * siden en tunnel er lengre enn en skjerm, ble hele venstre halvdel av
       * bildet en flat mørk plate med en loddrett kant i tunnelmunningen.
       * Med et bånd ser man himmelen over, og det leser som en fjellhall.
       */
      ctx.fillStyle = '#2b2533';
      ctx.beginPath();
      for (i = fra; i <= til; i++) {
        h = tunnelTak(i, fra, til);
        if (i === fra) ctx.moveTo(utX(i, h), utY(i, h));
        else ctx.lineTo(utX(i, h), utY(i, h));
      }
      for (i = til; i >= fra; i--) {
        h = tunnelTak(i, fra, til);
        // Den ujevne oversida er det som skiller fjell fra en malt stripe.
        var tykk = h > 4 ? h + 230 + 70 * Math.sin(i * 0.037) : h;
        ctx.lineTo(utX(i, tykk), utY(i, tykk));
      }
      ctx.closePath();
      ctx.fill();

      // Lamper i taket. De er den eneste varme fargen i gruva, og de er det
      // som gjør tunnelen til et sted noen har bygd.
      for (i = fra + 36; i < til - 36; i += 38) {
        h = tunnelTak(i, fra, til);
        var lx = utX(i, h - 10), ly = utY(i, h - 10);
        var g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 120);
        g.addColorStop(0, 'rgba(255,208,120,0.55)');
        g.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, ly, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd98a';
        ctx.beginPath();
        ctx.arc(lx, ly, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /*
     * Broa er fast grunn uten jord under. `JORDSTREKK` sørger for hullet;
     * her kommer det som står i det – dekke, bukker og kryssbånd, ned mot
     * bunnen av dalen.
     */
    function bro(ctx, fra, til) {
      var bunn = lope.lavest + 900;
      var i;

      ctx.strokeStyle = '#4a3a2c';
      ctx.lineCap = 'round';

      for (i = fra + 4; i < til - 4; i += 16) {
        var fx = utX(i, -VEIBREDDE), fy = utY(i, -VEIBREDDE);
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - 26, bunn);
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + 26, bunn);
        ctx.stroke();

        // Kryssbånd mellom bukkene, så de leser som ett byggverk.
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (var k = 1; k <= 3; k++) {
          var y = fy + (bunn - fy) * (k / 4);
          var ut = 26 * (k / 4);
          ctx.moveTo(fx - ut, y);
          ctx.lineTo(fx + ut, y);
        }
        ctx.stroke();
      }

      // Dekket helt til slutt, så bukkene forsvinner under det.
      ctx.fillStyle = '#6b5136';
      bandbane(ctx, fra, til, VEIBREDDE + 7);
      ctx.fill();
      ctx.fillStyle = '#3c4454';
      bandbane(ctx, fra, til, VEIBREDDE);
      ctx.fill();

      // Rekkverk på oversiden. Det er det som sier «her er det langt ned».
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (i = fra; i <= til; i++) {
        if (i === fra) ctx.moveTo(utX(i, VEIBREDDE + 34), utY(i, VEIBREDDE + 34));
        else ctx.lineTo(utX(i, VEIBREDDE + 34), utY(i, VEIBREDDE + 34));
      }
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (i = fra; i <= til; i += 10) {
        ctx.moveTo(utX(i, VEIBREDDE), utY(i, VEIBREDDE));
        ctx.lineTo(utX(i, VEIBREDDE + 36), utY(i, VEIBREDDE + 36));
      }
      ctx.stroke();
    }

    var TEGNERE = { is: is, gjorme: gjorme, rumle: rumle };

    function soner(ctx, kam, omr) {
      var s, S, fra, til;

      for (s = 0; s < SONESTREKK.length; s++) {
        S = SONESTREKK[s];
        fra = Math.max(S.fra, omr.a);
        til = Math.min(S.til, omr.b);
        if (til - fra < 2) continue;
        if (TEGNERE[S.sone]) TEGNERE[S.sone](ctx, fra, til);
      }

      /*
       * Byggverkene tegnes med *hele* sitt strekk, ikke bare den synlige
       * biten. Et tunneltak som ble klippet i skjermkanten, lukket seg ned
       * mot veien der og så ut som at tunnelen sluttet midt i fjellet.
       */
      for (s = 0; s < SONESTREKK.length; s++) {
        S = SONESTREKK[s];
        if (S.sone !== 'tunnel' && S.sone !== 'bro') continue;
        if (p[S.til].x < kam.venstre - 400 || p[S.fra].x > kam.hoyre + 400) continue;
        if (S.sone === 'tunnel') tunnel(ctx, S.fra, S.til, kam);
        else bro(ctx, S.fra, S.til);
      }
    }

    /* ---------- målet ---------- */

    function maal(ctx, kam) {
      var m = p[p.length - 1];
      if (m.x < kam.venstre - 400) return;

      var h = 300, br = 150;
      ctx.fillStyle = '#2c3242';
      ctx.fillRect(m.x - br - 14, m.y - h, 20, h);
      ctx.fillRect(m.x + br - 6, m.y - h, 20, h);

      // Bannerets rutemønster
      var rader = 3, kol = 12, rw = (br * 2) / kol, rh = 62 / rader;
      for (var r = 0; r < rader; r++) {
        for (var c = 0; c < kol; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#f4f6fb' : '#20242e';
          ctx.fillRect(m.x - br + c * rw, m.y - h + r * rh, rw + 0.5, rh + 0.5);
        }
      }

      ctx.fillStyle = 'rgba(255,214,90,0.9)';
      ctx.fillRect(m.x - br - 14, m.y - h - 12, br * 2 + 28, 12);

      // Lysstripe ned i asfalten, så målstreken også finnes på bakken.
      for (c = 0; c < 8; c++) {
        ctx.fillStyle = c % 2 ? '#f4f6fb' : '#20242e';
        ctx.fillRect(m.x - 22 + c * 5.5, m.y - 16, 5.5, 32);
      }
    }

    /* ---------- utsiden ---------- */

    return {
      himmel: himmel,
      omrade: omrade,
      verden: function (ctx, kam) {
        var omr = omrade(kam);
        landskap(ctx, kam);
        stillas(ctx, kam);
        bakke(ctx, kam, omr);
        vei(ctx, kam, omr);
        soner(ctx, kam, omr);
        maal(ctx, kam);
        return omr;
      }
    };
  }

  return { lag: lag, bland: bland, slump: slump };
})();
