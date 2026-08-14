/*
 * Bilen: delekatalogen og tegningen av den.
 *
 * Samme grep som truckene i Monstergiret – én tegnerutine og en tabell med
 * deler – men her velger barnet delene selv, så tabellen er delt i fem
 * kategorier som kan settes sammen fritt: form, lakk, hjul, dekor, spoiler.
 *
 * Formen eier alle målene. `dekorboks`, `spoilerfeste`, `tak`, `bakluke` og
 * `panser` ligger derfor på hver form og ikke i tegnerutinene, for et lyn
 * skal sitte på siden av karosseriet og en koffert på taket enten det er en
 * racer eller en monsterbil. Samme lærdom som
 * `apning` på figurene i Fargeflasker: hardkodede mål slutter å stemme i det
 * øyeblikket formen skifter.
 *
 * Hver del har en `stil`. Stilpoengene blir til en bonus på det man tjener i
 * løypa – det er slik pynt kan koste penger uten å konkurrere med motoren.
 */
'use strict';

var Bil = (function () {

  var BAKKE = 186;        // der hjulene står i tegningens viewBox
  var B = 400, H = 210;   // viewBox

  /*
   * Luft over bilen. Tilbehøret stables på taket, og fire ting oppå hverandre
   * på en lav racer rekker godt over der karosseriet slutter. Uten denne
   * marginen ble sirenen på toppen av tårnet klippet av viewBoxen.
   */
  var TAK = 46;

  /* ---------- former ---------- */

  var FORMER = [
    {
      id: 'racer', navn: 'Racer', pris: 0, stil: 2,
      tegn: '🏎️',
      hjul: [{ x: 98, y: BAKKE - 32, r: 32 }, { x: 300, y: BAKKE - 32, r: 32 }],
      dekorboks: { x: 70, y: 108, b: 230, h: 42 },
      spoilerfeste: { x: 60, y: 114 },
      /*
       * Bilen kjører mot høyre, og da må det lange panseret ligge til høyre
       * og kupeen bakover. Første utgave hadde det motsatt: frontlykta satt
       * riktig på høyre side, men karosseriet leste som en bil som kjørte
       * mot venstre med lykta bak. Toppkanten går derfor bakfra og fram:
       * kort bagasjeluke, bakrute opp, tak, frontrute ned, langt panser.
       */
      kropp: 'M34 152 L38 126 Q44 114 66 110 L106 106 L144 76 Q152 68 170 68 ' +
             'L214 68 Q230 68 238 78 L270 106 L348 112 Q374 116 374 134 L374 152 Z',
      rute: 'M126 102 L150 78 Q156 72 168 72 L182 72 L182 102 Z' +
            '~M196 72 L210 72 Q226 72 232 80 L250 102 L196 102 Z',
      strek: 'M38 126 L374 134',
      lykt: { x: 366, y: 126 },
      tak: { x: 192, y: 68 }, bakluke: { x: 86, y: 108 },
      panser: { x: 306, y: 110 }, eksosfeste: { x: 62, y: 140 }
    },
    {
      id: 'buggy', navn: 'Buggy', pris: 120, stil: 5,
      tegn: '🛺',
      hjul: [{ x: 100, y: BAKKE - 40, r: 40 }, { x: 302, y: BAKKE - 40, r: 40 }],
      dekorboks: { x: 84, y: 100, b: 220, h: 40 },
      spoilerfeste: { x: 66, y: 102 },
      kropp: 'M38 142 L46 112 Q52 100 76 98 L300 98 Q332 98 346 112 L368 142 Z',
      // Rullebur i mørk lakk. Tegnes som streker oppå kroppen.
      bur: 'M92 98 L134 48 L246 48 L280 98',
      // Ett stag, ikke fire. Med diagonaler i begge ender ble buret et
      // gitter man ikke leste som et bur. Buret sitter bak midten, slik at
      // det står igjen et panser foran – ellers er formen symmetrisk og
      // sier ikke hvilken vei bilen kjører.
      burstag: 'M134 48 L134 98~M246 48 L246 98',
      rute: '',
      strek: 'M46 120 L360 120',
      lykt: { x: 356, y: 112 },
      tak: { x: 190, y: 48 }, bakluke: { x: 62, y: 100 },
      panser: { x: 306, y: 99 }, eksosfeste: { x: 64, y: 128 }
    },
    {
      id: 'monster', navn: 'Monsterbil', pris: 320, stil: 9,
      tegn: '🚙',
      hjul: [{ x: 110, y: BAKKE - 52, r: 52 }, { x: 298, y: BAKKE - 52, r: 52 }],
      dekorboks: { x: 88, y: 52, b: 220, h: 48 },
      spoilerfeste: { x: 74, y: 70 },
      // Karosseriet sitter høyt over hjulene, med et understell imellom.
      // Det er den store høyden som gjør at man ser hvilken bil det er –
      // ikke at hjulene er noen piksler større. Vendt samme vei som raceren:
      // panseret fram, kupeen bak.
      understell: 'M84 96 L332 96 L332 130 L84 130 Z',
      kropp: 'M56 104 L60 66 Q68 52 90 50 L134 46 L172 18 Q180 10 198 10 ' +
             'L254 10 Q270 10 278 20 L306 46 L348 52 Q374 56 374 78 L374 104 Z',
      rute: 'M142 44 L172 20 Q178 14 190 14 L200 14 L200 44 Z' +
            '~M214 14 L252 14 Q264 14 270 22 L286 44 L214 44 Z',
      strek: 'M60 72 L374 78',
      lykt: { x: 364, y: 70 },
      tak: { x: 226, y: 10 }, bakluke: { x: 74, y: 56 },
      panser: { x: 324, y: 52 }, eksosfeste: { x: 80, y: 88 }
    },
    {
      id: 'buss', navn: 'Stuntbussen', pris: 260, stil: 7,
      tegn: '🚐',
      hjul: [{ x: 104, y: BAKKE - 34, r: 34 }, { x: 302, y: BAKKE - 34, r: 34 }],
      // Smalere enn på de andre: bussens dekorbånd ligger lavt, mellom
      // vinduene og terskelen, og hjulene dekker begge ender av det.
      dekorboks: { x: 132, y: 112, b: 172, h: 34 },
      spoilerfeste: { x: 58, y: 64 },
      kropp: 'M38 148 L38 70 Q38 58 54 58 L242 58 Q254 58 260 66 L292 100 ' +
             'L356 106 Q374 108 374 126 L374 148 Z',
      rute: 'M62 76 L132 76 L132 110 L62 110 Z' +
            '~M148 76 L218 76 L218 110 L148 110 Z' +
            '~M246 70 L282 102 L318 104 L272 70 Z',
      strek: 'M38 118 L374 126',
      lykt: { x: 366, y: 116 },
      tak: { x: 148, y: 58 }, bakluke: { x: 48, y: 60 },
      panser: { x: 322, y: 104 }, eksosfeste: { x: 58, y: 134 }
    }
  ];

  /* ---------- lakk ---------- */
  // `mork` brukes til skygge og understell, `pynt` til detaljer som skal lyse
  // mot karosseriet.

  var LAKKER = [
    { id: 'rod',     navn: 'Ildrød',     pris: 0,   stil: 1, farge: '#e0342a', mork: '#9c1f18', pynt: '#ffd24a' },
    { id: 'bla',     navn: 'Turboblå',   pris: 40,  stil: 2, farge: '#2f6ed4', mork: '#1c4694', pynt: '#e8f2ff' },
    { id: 'gronn',   navn: 'Giftgrønn',  pris: 40,  stil: 2, farge: '#3fae44', mork: '#256c28', pynt: '#e6ff8a' },
    { id: 'lilla',   navn: 'Nattlilla',  pris: 70,  stil: 3, farge: '#7b45b8', mork: '#472668', pynt: '#e0c9ff' },
    { id: 'oransje', navn: 'Lavaoransje',pris: 70,  stil: 3, farge: '#f07a18', mork: '#a3480a', pynt: '#fff0c2' },
    { id: 'rosa',    navn: 'Sjokkrosa',  pris: 110, stil: 4, farge: '#f0479c', mork: '#a41f61', pynt: '#ffe3f2' },
    { id: 'krom',    navn: 'Krom',       pris: 220, stil: 8, farge: '#c8d2dd', mork: '#7a8794', pynt: '#ffffff', blank: true },
    { id: 'gull',    navn: 'Gull',       pris: 300, stil: 10, farge: '#f0bf2a', mork: '#9c7508', pynt: '#fff4c2', blank: true },
    { id: 'regnbue', navn: 'Regnbue',    pris: 420, stil: 14, farge: '#ff5aa0', mork: '#5a2d8c', pynt: '#ffffff', regnbue: true }
  ];

  /* ---------- hjul ---------- */

  var HJUL = [
    { id: 'standard', navn: 'Vanlige',   pris: 0,   stil: 0, felg: '#cfd8e3', dekk: '#23262b', eiker: 5 },
    { id: 'terreng',  navn: 'Terreng',   pris: 90,  stil: 3, felg: '#e8d5b0', dekk: '#1c1f24', eiker: 6, grov: true },
    { id: 'gull',     navn: 'Gullfelg',  pris: 200, stil: 6, felg: '#f2c94c', dekk: '#23262b', eiker: 8 },
    { id: 'neon',     navn: 'Neonfelg',  pris: 280, stil: 9, felg: '#5ddcff', dekk: '#191c21', eiker: 6, glod: '#5ddcff' },
    { id: 'ild',      navn: 'Ildhjul',   pris: 380, stil: 12, felg: '#ff8a1e', dekk: '#20140e', eiker: 6, glod: '#ff8a1e', grov: true }
  ];

  /* ---------- dekor ---------- */

  /*
   * Dekor er den eneste kategorien der flere deler kan stå på samtidig, og
   * det er hele poenget: et barn som setter på stjerner skal ikke miste lynet
   * det nettopp kjøpte. Derfor er `valgt.dekor` en liste, ikke én id.
   *
   * For at det skal gå an, har hver type sin egen `sone` – en andel av
   * formens `dekorboks`. De fire figurene står på rekke bakfra og fram:
   *
   *     striper  langs over- og underkanten, hele lengden
   *     stjerner | lyn | flammer | tenner
   *     glitter  over alt
   *
   * Et første forsøk stablet dem i tre rader oppå hverandre. Det virket, men
   * en bilside er lang og lav, og en tredjedels høyde gjorde flammene til en
   * gul flekk. På rekke får hver figur en nesten kvadratisk plass, og med
   * alle på er bilen dekket fra bak til front.
   *
   * Glitteret ligger over alt og er med vilje unntaket: gnister skal kunne
   * falle oppå det andre.
   *
   * Stilverdiene er lavere enn da bare én kunne stå på – de legges nå sammen,
   * og seks deler à 10 ville sprengt stilbonusen.
   */
  var DEKOR = [
    { id: 'striper',  navn: 'Striper',   pris: 40,  stil: 2, tegn: '➖',
      sone: { x0: 0.00, x1: 1.00, y0: 0.00, y1: 1.00 } },
    { id: 'stjerner', navn: 'Stjerner',  pris: 110, stil: 4, tegn: '⭐',
      sone: { x0: 0.01, x1: 0.25, y0: 0.18, y1: 0.84 } },
    { id: 'lyn',      navn: 'Lyn',       pris: 90,  stil: 4, tegn: '⚡',
      sone: { x0: 0.26, x1: 0.50, y0: 0.18, y1: 0.84 } },
    { id: 'flammer',  navn: 'Flammer',   pris: 130, stil: 5, tegn: '🔥',
      sone: { x0: 0.51, x1: 0.75, y0: 0.18, y1: 0.84 } },
    { id: 'tenner',   navn: 'Tenner',    pris: 160, stil: 5, tegn: '🦈',
      sone: { x0: 0.76, x1: 0.99, y0: 0.18, y1: 0.84 } },
    { id: 'glitter',  navn: 'Glitter',   pris: 190, stil: 6, tegn: '✨',
      sone: { x0: 0.00, x1: 1.00, y0: 0.00, y1: 1.00 } }
  ];

  /* ---------- ekstra: ting som settes på bilen ---------- */

  /*
   * Tilbehør, i motsetning til dekor: dette er gjenstander som sitter *på*
   * bilen, ikke mønstre malt på siden. Flere kan stå på samtidig, som dekor.
   *
   * `plass` sier hvor delen fester seg — `tak`, `bakluke` eller `panser` —
   * og formen eier de tre punktene.
   *
   * Takdelene stables: hver av dem har en `hoyde`, og neste del legger seg
   * oppå den forrige. Det er det som gjør at ett valg ligger pent på taket
   * mens fire blir et komisk tårn. Faste lag ville gitt luft under en del
   * hvis den under ikke var kjøpt.
   *
   * Rekkefølgen i lista er stableorden nedenfra: koffert nederst, sirene
   * øverst.
   */
  var EKSTRA = [
    { id: 'koffert',   navn: 'Takkoffert',  pris: 160, stil: 4, tegn: '🧳', plass: 'tak', hoyde: 24 },
    { id: 'surfebrett',navn: 'Surfebrett',  pris: 220, stil: 5, tegn: '🏄', plass: 'tak', hoyde: 16 },
    { id: 'lysboyle',  navn: 'Lysbøyle',    pris: 180, stil: 5, tegn: '💡', plass: 'tak', hoyde: 25 },
    { id: 'sirene',    navn: 'Sirene',      pris: 260, stil: 6, tegn: '🚨', plass: 'tak', hoyde: 23 },
    { id: 'ballonger', navn: 'Ballonger',   pris: 110, stil: 4, tegn: '🎈', plass: 'bakluke' },
    { id: 'eksos',     navn: 'Eksosrør',    pris: 140, stil: 4, tegn: '💨', plass: 'eksosfeste' },
    { id: 'and',       navn: 'Gummiand',    pris: 60,  stil: 3, tegn: '🦆', plass: 'panser' },
    { id: 'vimpel',    navn: 'Vimpel',      pris: 80,  stil: 3, tegn: '🚩', plass: 'panser' }
  ];

  /* ---------- spoiler ---------- */

  var SPOILERE = [
    { id: 'ingen',  navn: 'Ingen',        pris: 0,   stil: 0,  tegn: '⬜' },
    { id: 'liten',  navn: 'Liten',        pris: 60,  stil: 3,  tegn: '▬' },
    { id: 'stor',   navn: 'Stor vinge',   pris: 160, stil: 7,  tegn: '🪽' },
    { id: 'dobbel', navn: 'Dobbeltvinge', pris: 300, stil: 11, tegn: '🛩️' },
    { id: 'rakett', navn: 'Rakettmotor',  pris: 420, stil: 14, tegn: '🚀' }
  ];

  var KATEGORIER = [
    { id: 'form',    navn: 'Form',    tegn: '🚗', liste: FORMER },
    { id: 'lakk',    navn: 'Lakk',    tegn: '🎨', liste: LAKKER },
    { id: 'hjul',    navn: 'Hjul',    tegn: '🛞', liste: HJUL },
    { id: 'dekor',   navn: 'Dekor',   tegn: '✨', liste: DEKOR, flere: true },
    { id: 'spoiler', navn: 'Spoiler', tegn: '🪽', liste: SPOILERE },
    { id: 'ekstra',  navn: 'Ekstra',  tegn: '🧳', liste: EKSTRA, flere: true }
  ];

  function finn(liste, id) {
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return liste[0];
  }

  // Dekoren returneres i katalogens rekkefølge, ikke i den rekkefølgen barnet
  // trykket. Da er lagdelingen fast: striper nederst, glitter øverst, uansett
  // hva som ble kjøpt først.
  function valgtDekor(valgt) {
    var pa = valgt.dekor || [];
    return DEKOR.filter(function (d) { return pa.indexOf(d.id) >= 0; });
  }

  function valgtEkstra(valgt) {
    var pa = valgt.ekstra || [];
    return EKSTRA.filter(function (d) { return pa.indexOf(d.id) >= 0; });
  }

  function deler(valgt) {
    return {
      form: finn(FORMER, valgt.form),
      lakk: finn(LAKKER, valgt.lakk),
      hjul: finn(HJUL, valgt.hjul),
      dekor: valgtDekor(valgt),
      spoiler: finn(SPOILERE, valgt.spoiler),
      ekstra: valgtEkstra(valgt)
    };
  }

  // Stilpoengene summeres over alle fem kategoriene. Bonusen er med vilje
  // flat nok til at ingen enkeltdel avgjør alt: full pynt gir omtrent
  // dobbelt så mye per mynt som en helt naken bil.
  function stil(valgt) {
    var d = deler(valgt);
    var sum = d.form.stil + d.lakk.stil + d.hjul.stil + d.spoiler.stil;
    for (var i = 0; i < d.dekor.length; i++) sum += d.dekor[i].stil;
    for (i = 0; i < d.ekstra.length; i++) sum += d.ekstra[i].stil;
    return sum;
  }

  // Nevneren er satt slik at en fullt pyntet bil lander rundt ×2,1. Legger du
  // til en dekortype, øker maks stil, og nevneren må følge etter – ellers
  // vokser inntekten i løypa uten at noe annet er endret.
  function bonus(valgt) {
    return 1 + stil(valgt) / 104;
  }

  /* ---------- tegning ---------- */

  function baner(d, klasse) {
    // Flere delstier i ett felt skilles med ~. Enklere enn en liste per form
    // når de aller fleste har én eller to.
    if (!d) return '';
    var ut = '', biter = d.split('~');
    for (var i = 0; i < biter.length; i++) ut += '<path d="' + biter[i] + '" ' + klasse + '/>';
    return ut;
  }

  function hjulTegning(h, hj, i) {
    var g = '<g>';
    g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + h.r + '" fill="' + hj.dekk + '"/>';
    if (hj.grov) {
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r - 5) + '" fill="none" stroke="' +
           hj.dekk + '" stroke-width="12" stroke-dasharray="10 9"/>';
    }
    g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.62).toFixed(1) + '" fill="' + hj.felg + '"/>';
    for (var e = 0; e < hj.eiker; e++) {
      var v = (e * 360 / hj.eiker + i * 18) * Math.PI / 180;
      g += '<line x1="' + (h.x + Math.cos(v) * h.r * 0.18).toFixed(1) +
           '" y1="' + (h.y + Math.sin(v) * h.r * 0.18).toFixed(1) +
           '" x2="' + (h.x + Math.cos(v) * h.r * 0.55).toFixed(1) +
           '" y2="' + (h.y + Math.sin(v) * h.r * 0.55).toFixed(1) +
           '" stroke="' + hj.dekk + '" stroke-width="' + (h.r * 0.12).toFixed(1) + '" stroke-linecap="round"/>';
    }
    g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.17).toFixed(1) + '" fill="' + hj.dekk + '"/>';
    if (hj.glod) {
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.78).toFixed(1) +
           '" fill="none" stroke="' + hj.glod + '" stroke-width="3" opacity="0.85"/>';
    }
    return g + '</g>';
  }

  // Fra andeler av formens dekorboks til en ekte boks i tegningens
  // koordinater. Sonene er andeler nettopp fordi hver form har sin egen
  // dekorboks – en monsterbil har mye høyere side enn en racer.
  function sone(boks, s) {
    return {
      x: boks.x + boks.b * s.x0,
      y: boks.y + boks.h * s.y0,
      b: boks.b * (s.x1 - s.x0),
      h: boks.h * (s.y1 - s.y0)
    };
  }

  /*
   * Hver figur tegnes i enhetskoordinater innenfor sin egen sone: u og v går
   * fra 0 til 1. Da fyller den plassen sin uansett hvilken form bilen har og
   * hvor stor sonen er, og en ny dekortype er en `switch`-gren uten et eneste
   * mål å regne ut på nytt.
   */
  function dekorTegning(id, boks, lakk) {
    var lys = lakk.pynt, mork = lakk.mork, s = '', i;

    function X(u) { return (boks.x + boks.b * u).toFixed(1); }
    function Y(v) { return (boks.y + boks.h * v).toFixed(1); }

    switch (id) {
      // Striper er ikke en figur, men en ramme: to bånd langs over- og
      // underkanten av hele flata, med midten fri til de andre.
      case 'striper':
        return '<rect x="' + X(0) + '" y="' + Y(0.02) + '" width="' + boks.b.toFixed(1) +
               '" height="' + (boks.h * 0.13).toFixed(1) + '" rx="3" fill="' + lys + '"/>' +
               '<rect x="' + X(0) + '" y="' + Y(0.88) + '" width="' + boks.b.toFixed(1) +
               '" height="' + (boks.h * 0.10).toFixed(1) + '" rx="3" fill="' + mork + '"/>';

      case 'stjerner':
        var plasser = [[0.22, 0.26, 0.30], [0.68, 0.22, 0.20], [0.46, 0.62, 0.34], [0.86, 0.70, 0.22]];
        for (i = 0; i < plasser.length; i++) {
          s += stjerne(boks.x + boks.b * plasser[i][0],
                       boks.y + boks.h * plasser[i][1],
                       boks.h * plasser[i][2], lys);
        }
        return s;

      // Ett lyn som fyller sonen. To lyn ville krevd halve bredden hver, og
      // da leser ingen av dem som et lyn.
      case 'lyn':
        return '<path d="M' + X(0.68) + ' ' + Y(0) +
               ' L' + X(0.10) + ' ' + Y(0.56) +
               ' L' + X(0.42) + ' ' + Y(0.56) +
               ' L' + X(0.16) + ' ' + Y(1) +
               ' L' + X(0.92) + ' ' + Y(0.40) +
               ' L' + X(0.56) + ' ' + Y(0.40) +
               ' L' + X(1.00) + ' ' + Y(0) +
               ' Z" fill="' + lys + '"/>';

      // Tre tunger som fyller høyden. Hver går opp langs venstre side til en
      // spiss og ned igjen på høyre – to korte kurver ga bobler, ikke ild.
      case 'flammer':
        for (i = 0; i < 3; i++) {
          var u0 = i / 3, ub = 1 / 3;
          var hoy = i === 1 ? 1.0 : 0.74;
          s += '<path d="M' + X(u0) + ' ' + Y(1) +
               ' C' + X(u0 + ub * 0.08) + ' ' + Y(1 - hoy * 0.55) +
               ' ' + X(u0 + ub * 0.52) + ' ' + Y(1 - hoy * 0.45) +
               ' ' + X(u0 + ub * 0.60) + ' ' + Y(1 - hoy) +
               ' C' + X(u0 + ub * 0.80) + ' ' + Y(1 - hoy * 0.42) +
               ' ' + X(u0 + ub) + ' ' + Y(1 - hoy * 0.38) +
               ' ' + X(u0 + ub) + ' ' + Y(1) +
               ' Z" fill="' + (i === 1 ? '#ffd24a' : lys) + '"/>';
        }
        return s;

      // En munn: mørkt bånd med hvite tenner som biter nedover.
      case 'tenner':
        s += '<rect x="' + X(0) + '" y="' + Y(0.04) + '" width="' + boks.b.toFixed(1) +
             '" height="' + (boks.h * 0.52).toFixed(1) + '" rx="4" fill="' + mork + '"/>';
        for (i = 0; i < 5; i++) {
          var t0 = 0.03 + i * 0.194, tb = 0.16;
          s += '<path d="M' + X(t0) + ' ' + Y(0.06) +
               ' L' + X(t0 + tb) + ' ' + Y(0.06) +
               ' L' + X(t0 + tb / 2) + ' ' + Y(0.86) + ' Z" fill="#ffffff"/>';
        }
        return s;

      // Fast mønster, ikke tilfeldige tall: bilen tegnes både som SVG i
      // garasjen og som bilde i løypa, og de to må bli like.
      case 'glitter':
        for (i = 0; i < 22; i++) {
          var gu = ((i * 37) % 97) / 97;
          var gv = ((i * 61) % 89) / 89;
          var gr = boks.h * (0.07 + (i % 3) * 0.05);
          var gx = boks.x + boks.b * gu, gy = boks.y + boks.h * gv;
          s += '<path d="M' + gx.toFixed(1) + ' ' + (gy - gr).toFixed(1) +
               ' L' + (gx + gr * 0.34).toFixed(1) + ' ' + (gy - gr * 0.34).toFixed(1) +
               ' L' + (gx + gr).toFixed(1) + ' ' + gy.toFixed(1) +
               ' L' + (gx + gr * 0.34).toFixed(1) + ' ' + (gy + gr * 0.34).toFixed(1) +
               ' L' + gx.toFixed(1) + ' ' + (gy + gr).toFixed(1) +
               ' L' + (gx - gr * 0.34).toFixed(1) + ' ' + (gy + gr * 0.34).toFixed(1) +
               ' L' + (gx - gr).toFixed(1) + ' ' + gy.toFixed(1) +
               ' L' + (gx - gr * 0.34).toFixed(1) + ' ' + (gy - gr * 0.34).toFixed(1) +
               ' Z" fill="#ffffff" opacity="' + (0.5 + (i % 4) * 0.15).toFixed(2) + '"/>';
        }
        return s;
    }
    return '';
  }

  function stjerne(cx, cy, r, farge) {
    var d = '', i;
    for (i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r;
      var v = (i * 36 - 90) * Math.PI / 180;
      d += (i ? ' L' : 'M') + (cx + Math.cos(v) * rr).toFixed(1) + ' ' + (cy + Math.sin(v) * rr).toFixed(1);
    }
    return '<path d="' + d + ' Z" fill="' + farge + '"/>';
  }

  /*
   * Tilbehøret. Alt tegnes i faste mål rundt et festepunkt, ikke skalert til
   * formen: en takkoffert er like stor på en racer som på en buss, akkurat
   * som i virkeligheten. At den henger litt utenfor et lite tak, er riktig.
   *
   * `t` er toppen delen skal stå på – for takdelene flyttes den oppover for
   * hver del som allerede ligger der.
   */
  function ekstraTegning(id, f, t, lakk) {
    var x = f.x, y = t, i, s = '';
    var METALL = '#48505c', METALL_MORK = '#2f3540';

    switch (id) {

      /* --- taket, nedenfra og opp --- */

      case 'koffert':
        return '<rect x="' + (x - 38) + '" y="' + (y - 26) + '" width="76" height="26" rx="9" fill="' +
                 lakk.farge + '"/>' +
               '<rect x="' + (x - 38) + '" y="' + (y - 26) + '" width="76" height="26" rx="9" fill="none" stroke="' +
                 lakk.mork + '" stroke-width="3"/>' +
               '<rect x="' + (x - 34) + '" y="' + (y - 15) + '" width="68" height="4" rx="2" fill="' +
                 lakk.mork + '"/>' +
               '<rect x="' + (x - 8) + '" y="' + (y - 20) + '" width="16" height="12" rx="3" fill="' +
                 lakk.pynt + '"/>';

      case 'surfebrett':
        // Langt og tynt, med spiss i begge ender. Det henger godt utenfor
        // taket på de små bilene, og det er nettopp det som er morsomt.
        return '<path d="M' + (x - 86) + ' ' + (y - 7) +
                 ' Q' + (x - 40) + ' ' + (y - 15) + ' ' + x + ' ' + (y - 15) +
                 ' Q' + (x + 46) + ' ' + (y - 15) + ' ' + (x + 86) + ' ' + (y - 7) +
                 ' Q' + (x + 46) + ' ' + y + ' ' + x + ' ' + y +
                 ' Q' + (x - 40) + ' ' + y + ' ' + (x - 86) + ' ' + (y - 7) + ' Z" fill="#ff6f5e"/>' +
               '<path d="M' + (x - 70) + ' ' + (y - 7) + ' L' + (x + 70) + ' ' + (y - 7) +
                 '" stroke="#fff3d0" stroke-width="3" stroke-linecap="round"/>' +
               '<circle cx="' + (x + 52) + '" cy="' + (y - 7) + '" r="4" fill="#3aa8ff"/>';

      case 'lysboyle':
        s = '<rect x="' + (x - 34) + '" y="' + (y - 12) + '" width="68" height="11" rx="5" fill="' +
              METALL + '"/>' +
            '<rect x="' + (x - 26) + '" y="' + (y - 3) + '" width="7" height="5" fill="' + METALL_MORK + '"/>' +
            '<rect x="' + (x + 19) + '" y="' + (y - 3) + '" width="7" height="5" fill="' + METALL_MORK + '"/>';
        for (i = 0; i < 4; i++) {
          var lx = x - 24 + i * 16;
          s += '<circle cx="' + lx + '" cy="' + (y - 17) + '" r="7" fill="#fff6c9"/>' +
               '<circle cx="' + lx + '" cy="' + (y - 17) + '" r="3" fill="#ffffff"/>';
        }
        return s;

      case 'sirene':
        return '<rect x="' + (x - 20) + '" y="' + (y - 6) + '" width="40" height="7" rx="3" fill="' +
                 METALL_MORK + '"/>' +
               '<path d="M' + (x - 17) + ' ' + (y - 6) + ' q0 -12 17 -12 q17 0 17 12 Z" fill="#ff4d4d"/>' +
               '<path d="M' + x + ' ' + (y - 18) + ' q17 0 17 12 L' + x + ' ' + (y - 6) + ' Z" fill="#3aa8ff"/>' +
               '<circle cx="' + x + '" cy="' + (y - 20) + '" r="3" fill="#ffffff"/>';

      /* --- bakluka --- */

      case 'ballonger':
        // Hvor høyt de stiger avhenger av hvor mye plass det er over bilen.
        // En monsterbil har bakluka nesten oppe i viewBoxens tak, og med en
        // fast høyde forsvant ballongene ut av bildet på akkurat den formen.
        var stig = Math.min(96, y + TAK - 22);
        var ball = [[-30, -stig, 15, '#ff4d6d'],
                    [-4, -stig - 16, 16, '#ffd24a'],
                    [20, -stig + 4, 14, '#4ad991']];
        for (i = 0; i < ball.length; i++) {
          var bx = x + ball[i][0], by = y + ball[i][1];
          s += '<path d="M' + bx + ' ' + (by + ball[i][2]) + ' Q' + (bx - 10) + ' ' + (by + 46) +
               ' ' + x + ' ' + y + '" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.75"/>';
        }
        for (i = 0; i < ball.length; i++) {
          bx = x + ball[i][0]; by = y + ball[i][1];
          s += '<ellipse cx="' + bx + '" cy="' + by + '" rx="' + (ball[i][2] - 2) + '" ry="' +
                 ball[i][2] + '" fill="' + ball[i][3] + '"/>' +
               '<ellipse cx="' + (bx - 4) + '" cy="' + (by - 5) + '" rx="3" ry="4" fill="#ffffff" opacity="0.55"/>';
        }
        return s;

      case 'eksos':
        // Sitter lavt bak på karosseriet, med en liten flamme ut av røret.
        var ey = y;
        return '<rect x="' + (x - 34) + '" y="' + ey + '" width="42" height="11" rx="5" fill="' + METALL + '"/>' +
               '<rect x="' + (x - 34) + '" y="' + (ey + 14) + '" width="42" height="11" rx="5" fill="' + METALL + '"/>' +
               '<circle cx="' + (x - 33) + '" cy="' + (ey + 5) + '" r="7" fill="' + METALL_MORK + '"/>' +
               '<circle cx="' + (x - 33) + '" cy="' + (ey + 19) + '" r="7" fill="' + METALL_MORK + '"/>' +
               '<path d="M' + (x - 40) + ' ' + (ey + 5) + ' l-22 -6 l10 6 l-10 6 z" fill="#ff8a1e"/>' +
               '<path d="M' + (x - 40) + ' ' + (ey + 19) + ' l-18 -5 l8 5 l-8 5 z" fill="#ffd24a"/>';

      /* --- panseret --- */

      case 'and':
        var ax = x - 18, ay = y - 14;
        return '<ellipse cx="' + ax + '" cy="' + ay + '" rx="15" ry="11" fill="#ffd83d"/>' +
               '<circle cx="' + (ax + 10) + '" cy="' + (ay - 12) + '" r="10" fill="#ffd83d"/>' +
               '<path d="M' + (ax + 19) + ' ' + (ay - 12) + ' l13 3 l-13 5 z" fill="#ff8a1e"/>' +
               '<circle cx="' + (ax + 12) + '" cy="' + (ay - 15) + '" r="2.4" fill="#20242c"/>' +
               '<path d="M' + (ax - 12) + ' ' + (ay - 2) + ' q-9 -6 -2 -11" stroke="#f0b300" stroke-width="3" fill="none"/>';

      case 'vimpel':
        var vx = x + 30;
        return '<rect x="' + (vx - 2) + '" y="' + (y - 54) + '" width="4" height="56" rx="2" fill="' +
                 METALL_MORK + '"/>' +
               '<path d="M' + (vx + 2) + ' ' + (y - 52) + ' L' + (vx + 44) + ' ' + (y - 42) +
                 ' L' + (vx + 2) + ' ' + (y - 30) + ' Z" fill="#ff4d6d"/>' +
               '<path d="M' + (vx + 2) + ' ' + (y - 46) + ' L' + (vx + 26) + ' ' + (y - 42) +
                 ' L' + (vx + 2) + ' ' + (y - 37) + ' Z" fill="#fff3d0"/>';
    }
    return '';
  }

  function spoilerTegning(id, feste, lakk) {
    var x = feste.x, y = feste.y;
    var f = lakk.farge, m = lakk.mork, p = lakk.pynt;
    switch (id) {
      // Stagene går 26 enheter *under* festepunktet. De blir tegnet før
      // karosseriet og skjult av det, og det er nettopp det som gjør at
      // vingen ser fastskrudd ut: rekker de bare akkurat ned, blir det en
      // luftspalte på den formen som har litt annen takhøyde.
      case 'liten':
        return '<path d="M' + (x - 6) + ' ' + (y + 16) + ' L' + (x + 56) + ' ' + (y + 16) +
               ' L' + (x + 56) + ' ' + (y - 14) + ' L' + (x - 6) + ' ' + (y - 6) + ' Z" fill="' + m + '"/>';
      case 'stor':
        return '<rect x="' + (x + 4) + '" y="' + (y - 40) + '" width="9" height="66" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x + 42) + '" y="' + (y - 40) + '" width="9" height="66" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x - 10) + '" y="' + (y - 52) + '" width="80" height="15" rx="6" fill="' + f + '"/>' +
               '<rect x="' + (x - 10) + '" y="' + (y - 52) + '" width="80" height="5" rx="2" fill="' + p + '"/>';
      case 'dobbel':
        return '<rect x="' + (x + 4) + '" y="' + (y - 62) + '" width="9" height="88" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x + 42) + '" y="' + (y - 62) + '" width="9" height="88" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x - 14) + '" y="' + (y - 40) + '" width="88" height="13" rx="5" fill="' + f + '"/>' +
               '<rect x="' + (x - 14) + '" y="' + (y - 74) + '" width="88" height="15" rx="6" fill="' + f + '"/>' +
               '<rect x="' + (x - 14) + '" y="' + (y - 74) + '" width="88" height="5" rx="2" fill="' + p + '"/>';
      case 'rakett':
        // Selve røret strekker seg inn under karosseriet mot høyre, så bare
        // dysa og flammen stikker ut bak. Uten overlappen svevde raketten
        // som en løs gjenstand ved siden av bilen.
        return '<rect x="' + (x - 12) + '" y="' + (y - 40) + '" width="96" height="32" rx="15" fill="#48505c"/>' +
               '<rect x="' + (x - 4) + '" y="' + (y - 33) + '" width="32" height="8" rx="4" fill="' + p + '"/>' +
               '<rect x="' + (x + 10) + '" y="' + (y - 12) + '" width="10" height="34" rx="4" fill="#2f3540"/>' +
               '<rect x="' + (x + 46) + '" y="' + (y - 12) + '" width="10" height="34" rx="4" fill="#2f3540"/>' +
               '<path d="M' + (x - 12) + ' ' + (y - 40) + ' l-16 5 l0 22 l16 5 z" fill="#2f3540"/>' +
               '<path d="M' + (x - 28) + ' ' + (y - 32) + ' l-28 8 l28 8 z" fill="#ff8a1e" opacity="0.9"/>';
    }
    return '';
  }

  /*
   * Bygger hele bilen som SVG-innhold. `pre` er en unik id-forstavelse:
   * regnbuelakken bruker en gradient, og to biler på samme side med samme
   * gradient-id gir en av dem feil farge.
   *
   * `opts.utenHjul` og `opts.utenSkygge` brukes til utgaven som kjører i
   * løypa: der tegnes hjulene for seg så de kan snurre, og skyggen skal ikke
   * være med i det hele tatt – den følger bilen når den roterer, og en skygge
   * som ligger *over* bilen i toppen av en loop ser ut som en flekk.
   */
  function tegning(valgt, pre, opts) {
    opts = opts || {};
    var d = deler(valgt);
    var f = d.form, lakk = d.lakk;
    var defs = '', fyll = lakk.farge;

    if (lakk.regnbue) {
      defs += '<linearGradient id="' + pre + 'regn" x1="0" y1="0" x2="1" y2="0.3">' +
              '<stop offset="0" stop-color="#ff4d6d"/><stop offset="0.25" stop-color="#ffb01f"/>' +
              '<stop offset="0.5" stop-color="#4ad991"/><stop offset="0.75" stop-color="#3aa8ff"/>' +
              '<stop offset="1" stop-color="#a05cff"/></linearGradient>';
      fyll = 'url(#' + pre + 'regn)';
    } else if (lakk.blank) {
      defs += '<linearGradient id="' + pre + 'blank" x1="0" y1="0" x2="0" y2="1">' +
              '<stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>' +
              '<stop offset="0.45" stop-color="' + lakk.farge + '"/>' +
              '<stop offset="1" stop-color="' + lakk.mork + '"/></linearGradient>';
      fyll = 'url(#' + pre + 'blank)';
    }

    // Dekoren skal ikke renne utenfor karosseriet.
    defs += '<clipPath id="' + pre + 'kropp"><path d="' + f.kropp + '"/></clipPath>';

    var s = '<defs>' + defs + '</defs>';

    if (!opts.utenSkygge) {
      s += '<ellipse cx="200" cy="' + (BAKKE + 14) + '" rx="168" ry="10" fill="rgba(0,0,0,0.28)"/>';
    }

    // Spoileren bak karosseriet, ellers ser stagene ut som de er limt utenpå.
    s += spoilerTegning(d.spoiler.id, f.spoilerfeste, lakk);

    if (f.understell) s += '<path d="' + f.understell + '" fill="' + lakk.mork + '"/>';
    s += '<path d="' + f.kropp + '" fill="' + fyll + '"/>';
    var pynt = '';
    for (var n = 0; n < d.dekor.length; n++) {
      pynt += dekorTegning(d.dekor[n].id, sone(f.dekorboks, d.dekor[n].sone), lakk);
    }
    s += '<g clip-path="url(#' + pre + 'kropp)">' + pynt + '</g>';
    s += '<path d="' + f.kropp + '" fill="none" stroke="' + lakk.mork + '" stroke-width="4"/>';

    if (f.rute) s += baner(f.rute, 'fill="#8fd0e8" opacity="0.92"');
    if (f.bur) {
      s += baner(f.burstag, 'fill="none" stroke="' + lakk.mork + '" stroke-width="8" stroke-linecap="round"');
      s += baner(f.bur, 'fill="none" stroke="' + lakk.mork + '" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"');
    }

    /*
     * Tilbehøret. Takdelene stables: `takhoyde` er hvor høyt det allerede
     * ligger noe, og hver del legger seg oppå. De andre henger på sitt eget
     * faste punkt.
     */
    var takhoyde = 0;
    for (var e = 0; e < d.ekstra.length; e++) {
      var del = d.ekstra[e];
      var feste = f[del.plass] || f.tak;
      var toppen = del.plass === 'tak' ? feste.y - takhoyde : feste.y;
      s += ekstraTegning(del.id, feste, toppen, lakk);
      if (del.plass === 'tak') takhoyde += del.hoyde;
    }

    s += '<circle cx="' + f.lykt.x + '" cy="' + f.lykt.y + '" r="9" fill="#fff6c9"/>';
    s += '<circle cx="' + f.lykt.x + '" cy="' + f.lykt.y + '" r="4" fill="#ffffff"/>';

    if (!opts.utenHjul) {
      for (var i = 0; i < f.hjul.length; i++) s += hjulTegning(f.hjul[i], d.hjul, i);
    }

    return s;
  }

  // Hjulene er den eneste kategorien der navnet ikke sier noe om hvordan
  // delen ser ut. Lista viser derfor selve hjulet, tegnet med sine egne
  // farger, i stedet for det samme symbolet fem ganger.
  function miniHjul(hj) {
    return '<svg viewBox="0 0 100 100" width="38" height="38" aria-hidden="true">' +
           hjulTegning({ x: 50, y: 50, r: 46 }, hj, 0) + '</svg>';
  }

  function svg(valgt, pre, klasse) {
    return '<svg class="' + (klasse || '') + '" viewBox="0 ' + (-TAK) + ' ' + B + ' ' + (H + 10 + TAK) +
           '" xmlns="http://www.w3.org/2000/svg">' + tegning(valgt, pre) + '</svg>';
  }

  /*
   * Til canvas. Bilen deles i to bilder: karosseriet uten hjul, og ett hjul
   * for seg. I løypa tegnes karosseriet én gang per bilderute og hjulet to
   * ganger, rotert etter hvor langt bilen har kjørt – det er hele
   * hjulsnurringen, og den koster to ekstra drawImage per rute.
   *
   * Begge lages én gang når designet endres. Å serialisere SVG-en per
   * bilderute ville drept bildefrekvensen på telefon.
   *
   * Hjulboksen er litt større enn hjulet (55 mot 50), for mønsteret på de
   * grove dekkene stikker noen enheter utenfor radien og ville blitt klippet.
   */
  var HJULBOKS = 110, HJULRADIUS = 50;

  function tegninger(valgt, klar) {
    var f = finn(FORMER, valgt.form);
    var hj = finn(HJUL, valgt.hjul);

    var full = H + 10 + TAK;
    var kropp = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (B * 2) + '" height="' + (full * 2) +
                '" viewBox="0 ' + (-TAK) + ' ' + B + ' ' + full + '">' +
                tegning(valgt, 'c', { utenHjul: true, utenSkygge: true }) + '</svg>';

    var hjulsvg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (HJULBOKS * 2) + '" height="' + (HJULBOKS * 2) +
                  '" viewBox="0 0 ' + HJULBOKS + ' ' + HJULBOKS + '">' +
                  hjulTegning({ x: HJULBOKS / 2, y: HJULBOKS / 2, r: HJULRADIUS }, hj, 0) + '</svg>';

    // Forholdet mellom bildets *halve* bredde og hjulets radius. Tegner man
    // med hele boksen mot radien, blir hjulet dobbelt så stort som resten av
    // bilen og henger under asfalten.
    var margin = (HJULBOKS / 2) / HJULRADIUS;

    /*
     * Hjulplasseringene og `bakke` regnes om til bildets koordinater. Bildet
     * starter TAK enheter over tegningens null, så alt som skal treffe
     * asfalten må flyttes like mye ned.
     */
    var plasser = f.hjul.map(function (h) { return { x: h.x, y: h.y + TAK, r: h.r }; });

    var igjen = 2, ut = {
      plasser: plasser, bredde: B, hoyde: full,
      bakke: BAKKE + TAK, hjulboks: margin
    };

    function ferdig() { if (--igjen === 0) klar(ut); }

    ut.kropp = new Image();
    ut.kropp.onload = ferdig;
    ut.kropp.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(kropp);

    ut.hjul = new Image();
    ut.hjul.onload = ferdig;
    ut.hjul.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(hjulsvg);
  }

  function standard() {
    return { form: 'racer', lakk: 'rod', hjul: 'standard', dekor: [], spoiler: 'ingen', ekstra: [] };
  }

  return {
    KATEGORIER: KATEGORIER,
    FORMER: FORMER,
    BAKKE: BAKKE,
    bredde: B,
    hoyde: H + 10,
    finn: finn,
    deler: deler,
    stil: stil,
    bonus: bonus,
    svg: svg,
    miniHjul: miniHjul,
    tegninger: tegninger,
    standard: standard
  };
})();
