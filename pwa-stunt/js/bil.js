/*
 * Bilen: delekatalogen og tegningen av den.
 *
 * Samme grep som truckene i Monstergiret – én tegnerutine og en tabell med
 * deler – men her velger barnet delene selv, så tabellen er delt i fem
 * kategorier som kan settes sammen fritt: form, lakk, hjul, dekor, spoiler.
 *
 * Formen eier alle målene. `dekorboks` og `spoilerfeste` ligger derfor på
 * hver form og ikke i tegnerutinene, for et lyn skal sitte på siden av
 * karosseriet enten det er en racer eller en monsterbil. Samme lærdom som
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

  /* ---------- former ---------- */

  var FORMER = [
    {
      id: 'racer', navn: 'Racer', pris: 0, stil: 2,
      tegn: '🏎️',
      hjul: [{ x: 98, y: BAKKE - 32, r: 32 }, { x: 300, y: BAKKE - 32, r: 32 }],
      dekorboks: { x: 78, y: 116, b: 216, h: 30 },
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
      lykt: { x: 366, y: 126 }
    },
    {
      id: 'buggy', navn: 'Buggy', pris: 120, stil: 5,
      tegn: '🛺',
      hjul: [{ x: 100, y: BAKKE - 40, r: 40 }, { x: 302, y: BAKKE - 40, r: 40 }],
      dekorboks: { x: 96, y: 108, b: 210, h: 28 },
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
      lykt: { x: 356, y: 112 }
    },
    {
      id: 'monster', navn: 'Monsterbil', pris: 320, stil: 9,
      tegn: '🚙',
      hjul: [{ x: 110, y: BAKKE - 52, r: 52 }, { x: 298, y: BAKKE - 52, r: 52 }],
      dekorboks: { x: 98, y: 62, b: 204, h: 32 },
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
      lykt: { x: 364, y: 70 }
    },
    {
      id: 'buss', navn: 'Stuntbussen', pris: 260, stil: 7,
      tegn: '🚐',
      hjul: [{ x: 104, y: BAKKE - 34, r: 34 }, { x: 302, y: BAKKE - 34, r: 34 }],
      dekorboks: { x: 60, y: 116, b: 210, h: 28 },
      spoilerfeste: { x: 58, y: 64 },
      kropp: 'M38 148 L38 70 Q38 58 54 58 L242 58 Q254 58 260 66 L292 100 ' +
             'L356 106 Q374 108 374 126 L374 148 Z',
      rute: 'M62 76 L132 76 L132 110 L62 110 Z' +
            '~M148 76 L218 76 L218 110 L148 110 Z' +
            '~M246 70 L282 102 L318 104 L272 70 Z',
      strek: 'M38 118 L374 126',
      lykt: { x: 366, y: 116 }
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

  var DEKOR = [
    { id: 'ingen',    navn: 'Ingen',     pris: 0,   stil: 0,  tegn: '⬜' },
    { id: 'striper',  navn: 'Striper',   pris: 50,  stil: 3,  tegn: '➖' },
    { id: 'lyn',      navn: 'Lyn',       pris: 120, stil: 6,  tegn: '⚡' },
    { id: 'flammer',  navn: 'Flammer',   pris: 180, stil: 8,  tegn: '🔥' },
    { id: 'stjerner', navn: 'Stjerner',  pris: 150, stil: 7,  tegn: '⭐' },
    { id: 'glitter',  navn: 'Glitter',   pris: 260, stil: 11, tegn: '✨' },
    { id: 'tenner',   navn: 'Tenner',    pris: 220, stil: 10, tegn: '🦈' }
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
    { id: 'dekor',   navn: 'Dekor',   tegn: '✨', liste: DEKOR },
    { id: 'spoiler', navn: 'Spoiler', tegn: '🪽', liste: SPOILERE }
  ];

  function finn(liste, id) {
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return liste[0];
  }

  function deler(valgt) {
    return {
      form: finn(FORMER, valgt.form),
      lakk: finn(LAKKER, valgt.lakk),
      hjul: finn(HJUL, valgt.hjul),
      dekor: finn(DEKOR, valgt.dekor),
      spoiler: finn(SPOILERE, valgt.spoiler)
    };
  }

  // Stilpoengene summeres over alle fem kategoriene. Bonusen er med vilje
  // flat nok til at ingen enkeltdel avgjør alt: full pynt gir omtrent
  // dobbelt så mye per mynt som en helt naken bil.
  function stil(valgt) {
    var d = deler(valgt);
    return d.form.stil + d.lakk.stil + d.hjul.stil + d.dekor.stil + d.spoiler.stil;
  }

  function bonus(valgt) {
    return 1 + stil(valgt) / 56;
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

  function dekorTegning(id, boks, lakk) {
    var x = boks.x, y = boks.y, b = boks.b, h = boks.h, s = '', i;
    var lys = lakk.pynt, mork = lakk.mork;

    switch (id) {
      case 'striper':
        s += '<rect x="' + x + '" y="' + (y + 4) + '" width="' + b + '" height="' + (h * 0.28).toFixed(1) +
             '" rx="4" fill="' + lys + '"/>';
        s += '<rect x="' + x + '" y="' + (y + h * 0.55).toFixed(1) + '" width="' + (b * 0.7).toFixed(1) +
             '" height="' + (h * 0.2).toFixed(1) + '" rx="4" fill="' + mork + '"/>';
        return s;

      case 'lyn':
        // Ett stort lyn midt på siden, med et lite foran.
        var lx = x + b * 0.28, ly = y;
        s += '<path d="M' + (lx + 40) + ' ' + ly + ' L' + (lx - 6) + ' ' + (ly + h * 0.6) +
             ' L' + (lx + 16) + ' ' + (ly + h * 0.6) + ' L' + (lx - 4) + ' ' + (ly + h) +
             ' L' + (lx + 52) + ' ' + (ly + h * 0.42) + ' L' + (lx + 28) + ' ' + (ly + h * 0.42) +
             ' L' + (lx + 56) + ' ' + ly + ' Z" fill="' + lys + '"/>';
        s += '<path d="M' + (x + b * 0.78) + ' ' + ly + ' L' + (x + b * 0.68) + ' ' + (ly + h * 0.6) +
             ' L' + (x + b * 0.76) + ' ' + (ly + h * 0.6) + ' L' + (x + b * 0.7) + ' ' + (ly + h) +
             ' L' + (x + b * 0.88) + ' ' + (ly + h * 0.4) + ' L' + (x + b * 0.79) + ' ' + (ly + h * 0.4) +
             ' L' + (x + b * 0.9) + ' ' + ly + ' Z" fill="' + lys + '" opacity="0.9"/>';
        return s;

      case 'flammer':
        // Én tunge per flamme: opp langs venstre side til en spiss, og ned
        // igjen på høyre. Første forsøk brukte to korte kurver og ga fem
        // bobler langs underkanten i stedet for ild.
        var bunn = y + h;
        var bredde = b / 4.6;
        for (i = 0; i < 5; i++) {
          var fx = x + i * (b / 5.2);
          var hoy = h * (1.0 - (i % 2) * 0.3);
          s += '<path d="M' + fx.toFixed(1) + ' ' + bunn.toFixed(1) +
               ' C' + (fx + bredde * 0.08).toFixed(1) + ' ' + (bunn - hoy * 0.55).toFixed(1) +
               ' ' + (fx + bredde * 0.52).toFixed(1) + ' ' + (bunn - hoy * 0.45).toFixed(1) +
               ' ' + (fx + bredde * 0.60).toFixed(1) + ' ' + (bunn - hoy).toFixed(1) +
               ' C' + (fx + bredde * 0.80).toFixed(1) + ' ' + (bunn - hoy * 0.42).toFixed(1) +
               ' ' + (fx + bredde).toFixed(1) + ' ' + (bunn - hoy * 0.38).toFixed(1) +
               ' ' + (fx + bredde).toFixed(1) + ' ' + bunn.toFixed(1) +
               ' Z" fill="' + (i % 2 ? '#ffd24a' : lys) + '"/>';
        }
        return s;

      case 'stjerner':
        for (i = 0; i < 6; i++) {
          var sx = x + 14 + i * (b - 28) / 5;
          var sy = y + (i % 2 ? h * 0.62 : h * 0.22);
          var r = i % 2 ? h * 0.24 : h * 0.34;
          s += stjerne(sx, sy, r, lys);
        }
        return s;

      case 'glitter':
        for (i = 0; i < 16; i++) {
          // Fast mønster, ikke tilfeldig: bilen skal se lik ut hver gang den
          // tegnes, ellers flimrer den mellom garasje og løype.
          var gx = x + ((i * 37) % (b - 10)) + 5;
          var gy = y + ((i * 23) % (h - 6)) + 3;
          var gr = 3 + (i % 3) * 2;
          s += '<path d="M' + gx + ' ' + (gy - gr) + ' L' + (gx + gr * 0.34) + ' ' + (gy - gr * 0.34) +
               ' L' + (gx + gr) + ' ' + gy + ' L' + (gx + gr * 0.34) + ' ' + (gy + gr * 0.34) +
               ' L' + gx + ' ' + (gy + gr) + ' L' + (gx - gr * 0.34) + ' ' + (gy + gr * 0.34) +
               ' L' + (gx - gr) + ' ' + gy + ' L' + (gx - gr * 0.34) + ' ' + (gy - gr * 0.34) +
               ' Z" fill="#ffffff" opacity="' + (0.55 + (i % 4) * 0.15).toFixed(2) + '"/>';
        }
        return s;

      case 'tenner':
        s += '<rect x="' + x + '" y="' + y + '" width="' + b + '" height="' + (h * 0.62).toFixed(1) +
             '" rx="6" fill="' + mork + '"/>';
        for (i = 0; i < 9; i++) {
          var tx = x + 6 + i * (b - 12) / 9;
          var tb = (b - 12) / 9 - 3;
          s += '<path d="M' + tx + ' ' + y + ' L' + (tx + tb) + ' ' + y +
               ' L' + (tx + tb / 2) + ' ' + (y + h * 0.6) + ' Z" fill="#ffffff"/>';
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
    s += '<g clip-path="url(#' + pre + 'kropp)">' +
         dekorTegning(d.dekor.id, f.dekorboks, lakk) + '</g>';
    s += '<path d="' + f.kropp + '" fill="none" stroke="' + lakk.mork + '" stroke-width="4"/>';

    if (f.rute) s += baner(f.rute, 'fill="#8fd0e8" opacity="0.92"');
    if (f.bur) {
      s += baner(f.burstag, 'fill="none" stroke="' + lakk.mork + '" stroke-width="8" stroke-linecap="round"');
      s += baner(f.bur, 'fill="none" stroke="' + lakk.mork + '" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"');
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
    return '<svg class="' + (klasse || '') + '" viewBox="0 0 ' + B + ' ' + (H + 10) +
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

    var kropp = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (B * 2) + '" height="' + ((H + 10) * 2) +
                '" viewBox="0 0 ' + B + ' ' + (H + 10) + '">' +
                tegning(valgt, 'c', { utenHjul: true, utenSkygge: true }) + '</svg>';

    var hjulsvg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (HJULBOKS * 2) + '" height="' + (HJULBOKS * 2) +
                  '" viewBox="0 0 ' + HJULBOKS + ' ' + HJULBOKS + '">' +
                  hjulTegning({ x: HJULBOKS / 2, y: HJULBOKS / 2, r: HJULRADIUS }, hj, 0) + '</svg>';

    // Forholdet mellom bildets *halve* bredde og hjulets radius. Tegner man
    // med hele boksen mot radien, blir hjulet dobbelt så stort som resten av
    // bilen og henger under asfalten.
    var margin = (HJULBOKS / 2) / HJULRADIUS;

    var igjen = 2, ut = { plasser: f.hjul, bredde: B, hoyde: H + 10, bakke: BAKKE, hjulboks: margin };

    function ferdig() { if (--igjen === 0) klar(ut); }

    ut.kropp = new Image();
    ut.kropp.onload = ferdig;
    ut.kropp.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(kropp);

    ut.hjul = new Image();
    ut.hjul.onload = ferdig;
    ut.hjul.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(hjulsvg);
  }

  function standard() {
    return { form: 'racer', lakk: 'rod', hjul: 'standard', dekor: 'ingen', spoiler: 'ingen' };
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
