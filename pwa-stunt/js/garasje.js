/*
 * Garasjen bilen står i.
 *
 * Ren kulisse: port, vegg, gulv, lamper, verktøytavle, hylle og en
 * dekkstabel. Ligger for seg selv fordi `bil.js` svarer for bilen og
 * ingenting annet – en vegg med lamper hører ikke hjemme i delekatalogen.
 *
 * Bilen tegnes *inni* denne SVG-en, ikke ved siden av. Da er det én
 * koordinatverden, og hjulene står på gulvet uansett hvilken form som er
 * valgt: alle formene har hjulene på `Bil.BAKKE`, og skaleringen her setter
 * den linja rett på gulvet. Legges de to som separate elementer oppå
 * hverandre, må plasseringen finstemmes på nytt hver gang en form endrer
 * høyde.
 *
 * Rommet er høyere enn det er bredt. Det er ikke tilfeldig: ruta bilen står
 * i er høy og smal på en telefon, og en bred scene ble liggende som et
 * frimerke med tomrom over og under. `preserveAspectRatio` står på
 * standard «meet» og ikke «slice», for i liggende format er ruta lav og
 * bred, og «slice» ville da skåret bort både tak og gulv.
 *
 * Innholdet er levende SVG i DOM-en, aldri et bilde på et canvas, så
 * blinkingen på bilen går av seg selv via CSS-klassene fra `Bil.blink()`.
 */
'use strict';

var Garasje = (function () {

  var B = 480, H = 640;
  var GULV = 470;          // gulvlinja bilen står på
  var BILSKALA = 0.75;

  var VEGG = '#232a40';
  var VEGG_LYS = '#2c3550';
  var VEGG_MORK = '#1b2136';
  var RAMME = '#39415e';
  var RAMME_MORK = '#2a3049';
  var METALL = '#4a5470';

  /* ---------- ting i rommet ---------- */

  function lampe(x, pre, gruppe) {
    return '<line x1="' + x + '" y1="64" x2="' + x + '" y2="112" stroke="' + METALL + '" stroke-width="3"/>' +
           '<path d="M' + (x - 26) + ' 136 L' + (x - 11) + ' 112 L' + (x + 11) + ' 112 L' + (x + 26) +
             ' 136 Z" fill="' + METALL + '"/>' +
           '<ellipse cx="' + x + '" cy="136" rx="26" ry="6" fill="#fff3c4"/>' +
           // Lyskjeglen ned mot gulvet. Den er det som gjør at rommet ser
           // opplyst ut i stedet for bare lyst malt.
           '<path d="M' + (x - 24) + ' 139 L' + (x + 24) + ' 139 L' + (x + 118) + ' ' + GULV +
             ' L' + (x - 118) + ' ' + GULV + ' Z" fill="url(#' + pre + 'kjegle)"/>' +
           '<circle cx="' + x + '" cy="139" r="8" fill="#fff8dc"' + ' class="blink-' + gruppe + '"/>';
  }

  /*
   * Lyspyttene på gulvet hører sammen med kjeglene. En kjegle som stopper i
   * gulvlinja ser ut som et forheng: det er flekken nedenfor som gjør at
   * lyset lander et sted.
   */
  function lyspytt(x, pre) {
    return '<ellipse cx="' + x + '" cy="' + (GULV + 46) + '" rx="150" ry="46" fill="url(#' +
           pre + 'pytt)"/>';
  }

  /*
   * Gulvet i perspektiv. Linjene møtes i et punkt bak veggen, og tverrlinjene
   * står tettere jo lenger bak de ligger. Det er den eneste konstruksjonen i
   * hele appen som later som den er tredimensjonal, og den koster åtte
   * linjer: uten den leser gulvet som enda en vegg lagt ned.
   */
  function gulvrutenett(pre) {
    var vx = B / 2, vy = GULV - 150;
    var s = '<g clip-path="url(#' + pre + 'gulvklipp)" stroke="' + RAMME +
            '" stroke-width="2" opacity="0.55" fill="none">';
    for (var i = -7; i <= 17; i++) {
      s += '<line x1="' + (i * 52) + '" y1="' + H + '" x2="' + vx + '" y2="' + vy + '"/>';
    }
    for (var k = 1; k <= 5; k++) {
      var t = k / 6;
      var y = GULV + (H - GULV) * t * t;
      s += '<line x1="0" y1="' + y.toFixed(1) + '" x2="' + B + '" y2="' + y.toFixed(1) + '"/>';
    }
    return s + '</g>';
  }

  function verktoytavle(x, y) {
    var s = '<rect x="' + x + '" y="' + y + '" width="82" height="92" rx="5" fill="' + VEGG_MORK +
            '" stroke="' + RAMME + '" stroke-width="3"/>';
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 6; c++) {
        s += '<circle cx="' + (x + 11 + c * 12) + '" cy="' + (y + 12 + r * 13) + '" r="1.6" fill="#141a2c"/>';
      }
    }
    // Skiftenøkkel
    s += '<g transform="translate(' + (x + 12) + ',' + (y + 18) + ')">' +
         '<rect x="4" y="9" width="7" height="42" rx="3" fill="#aab4cc"/>' +
         '<circle cx="7.5" cy="8" r="9" fill="#aab4cc"/>' +
         '<circle cx="7.5" cy="8" r="4.5" fill="' + VEGG_MORK + '"/></g>';
    // Skrutrekker
    s += '<g transform="translate(' + (x + 38) + ',' + (y + 18) + ')">' +
         '<rect x="2" y="0" width="11" height="19" rx="4" fill="#e0642a"/>' +
         '<rect x="6" y="18" width="3.5" height="32" fill="#aab4cc"/></g>';
    // Hammer
    s += '<g transform="translate(' + (x + 58) + ',' + (y + 20) + ')">' +
         '<rect x="5" y="9" width="5" height="40" rx="2" fill="#8a6a44"/>' +
         '<path d="M-2 4 h20 v10 h-7 l-2 -4 h-11 z" fill="#aab4cc"/></g>';
    return s;
  }

  function hylle(x, y) {
    var s = '<rect x="' + x + '" y="' + y + '" width="92" height="6" rx="2" fill="' + RAMME + '"/>' +
            '<rect x="' + x + '" y="' + (y + 62) + '" width="92" height="6" rx="2" fill="' + RAMME + '"/>';
    // Malingsspann og bokser
    s += '<rect x="' + (x + 8) + '" y="' + (y - 26) + '" width="26" height="26" rx="3" fill="#3fae44"/>' +
         '<rect x="' + (x + 8) + '" y="' + (y - 20) + '" width="26" height="5" fill="#256c28"/>';
    s += '<rect x="' + (x + 40) + '" y="' + (y - 22) + '" width="22" height="22" rx="3" fill="#2f6ed4"/>';
    s += '<rect x="' + (x + 66) + '" y="' + (y - 30) + '" width="20" height="30" rx="9" fill="#e0642a"/>';
    s += '<rect x="' + (x + 14) + '" y="' + (y + 34) + '" width="30" height="28" rx="3" fill="#7b45b8"/>';
    s += '<rect x="' + (x + 50) + '" y="' + (y + 28) + '" width="34" height="34" rx="4" fill="' + METALL + '"/>' +
         '<rect x="' + (x + 50) + '" y="' + (y + 42) + '" width="34" height="5" fill="' + VEGG_MORK + '"/>';
    return s;
  }

  function dekkstabel(x, y) {
    var s = '';
    for (var i = 0; i < 3; i++) {
      var cy = y - i * 23;
      s += '<ellipse cx="' + x + '" cy="' + cy + '" rx="34" ry="14" fill="#20242e"/>' +
           '<ellipse cx="' + x + '" cy="' + (cy - 4) + '" rx="34" ry="14" fill="#2b303c"/>' +
           '<ellipse cx="' + x + '" cy="' + (cy - 4) + '" rx="15" ry="6" fill="#171a22"/>';
    }
    return s;
  }

  function verktoykasse(x, y) {
    return '<rect x="' + x + '" y="' + y + '" width="58" height="44" rx="4" fill="#c8392c"/>' +
           '<rect x="' + x + '" y="' + (y + 15) + '" width="58" height="7" fill="#8f2419"/>' +
           '<rect x="' + (x + 19) + '" y="' + (y - 10) + '" width="20" height="11" rx="5" fill="none" stroke="' +
             METALL + '" stroke-width="3"/>' +
           '<rect x="' + (x + 22) + '" y="' + (y + 28) + '" width="14" height="4" rx="2" fill="#8f2419"/>';
  }

  // Vimpelrekke under porten. Rene farger, ingen tekst – en tekststreng her
  // ville måttet oversettes og brutt på smale skjermer.
  function vimpler(y) {
    var farger = ['#ff4d6d', '#ffd24a', '#4ad991', '#3aa8ff', '#a05cff'];
    var s = '<path d="M40 ' + y + ' Q240 ' + (y + 22) + ' 440 ' + y +
            '" stroke="' + METALL + '" stroke-width="2" fill="none"/>';
    for (var i = 0; i < 10; i++) {
      var t = (i + 0.5) / 10;
      var x = 40 + 400 * t;
      var ly = y + 22 * 2 * t * (1 - t);   // følger buen på snoren
      s += '<path d="M' + (x - 11) + ' ' + ly + ' L' + (x + 11) + ' ' + ly +
           ' L' + x + ' ' + (ly + 24) + ' Z" fill="' + farger[i % farger.length] + '"/>';
    }
    return s;
  }

  /* ---------- hele rommet ---------- */

  function svg(valgt, pre, tier) {
    pre = pre || 'g';

    var s = '<svg class="garasjescene" viewBox="0 0 ' + B + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';

    s += '<defs>' +
         '<linearGradient id="' + pre + 'kjegle" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0" stop-color="#ffeec2" stop-opacity="0.30"/>' +
           '<stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>' +
         '<radialGradient id="' + pre + 'pytt">' +
           '<stop offset="0" stop-color="#ffeaa8" stop-opacity="0.26"/>' +
           '<stop offset="1" stop-color="#ffeaa8" stop-opacity="0"/></radialGradient>' +
         '<linearGradient id="' + pre + 'gulv" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0" stop-color="#333e60"/>' +
           '<stop offset="0.45" stop-color="#232b45"/>' +
           '<stop offset="1" stop-color="#12172680"/></linearGradient>' +
         '<linearGradient id="' + pre + 'vegg" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0" stop-color="' + VEGG_LYS + '"/>' +
           '<stop offset="0.72" stop-color="' + VEGG + '"/>' +
           '<stop offset="1" stop-color="' + VEGG_MORK + '"/></linearGradient>' +
         // Refleksjonen tones bort nedover. Uten uttoningen ser speilbildet
         // like fast ut som bilen, og gulvet blir en glassplate.
         '<linearGradient id="' + pre + 'demp" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0" stop-color="#171d30" stop-opacity="0.10"/>' +
           '<stop offset="0.5" stop-color="#171d30" stop-opacity="0.72"/>' +
           '<stop offset="1" stop-color="#171d30" stop-opacity="0.96"/></linearGradient>' +
         '<clipPath id="' + pre + 'gulvklipp">' +
           '<rect x="0" y="' + GULV + '" width="' + B + '" height="' + (H - GULV) + '"/>' +
         '</clipPath>' +
         '</defs>';

    /* --- vegg og gulv, helt ut til kanten --- */

    s += '<rect x="0" y="0" width="' + B + '" height="' + H + '" fill="' + VEGG_MORK + '"/>';
    s += '<rect x="0" y="56" width="' + B + '" height="' + (GULV - 56) + '" fill="url(#' + pre + 'vegg)"/>';

    // Skjøtene i veggplatene
    for (var y = 116; y < GULV; y += 54) {
      s += '<rect x="0" y="' + y + '" width="' + B + '" height="3" fill="' + VEGG_LYS + '" opacity="0.6"/>';
    }

    s += '<rect x="0" y="' + GULV + '" width="' + B + '" height="' + (H - GULV) +
         '" fill="url(#' + pre + 'gulv)"/>';
    s += gulvrutenett(pre);
    s += '<rect x="0" y="' + (GULV - 3) + '" width="' + B + '" height="5" fill="' + RAMME + '"/>';

    /* --- ting langs veggen --- */

    s += lampe(148, pre, 'a') + lampe(332, pre, 'b');
    s += vimpler(78);
    s += verktoytavle(20, 196);
    s += hylle(368, 214);
    s += verktoykasse(22, 412);
    s += dekkstabel(424, 458);

    /* --- bilen, i samme koordinatverden --- */

    var tx = (B - Bil.bredde * BILSKALA) / 2;
    var ty = GULV - Bil.BAKKE * BILSKALA;

    /*
     * Speilbildet først, så lyspyttene, så bilen. Rekkefølgen er hele
     * trikset: lyset legger seg *over* refleksjonen og vasker den ut der
     * gulvet er lyst, akkurat som et blankt betonggulv gjør.
     */
    /*
     * Klippet ligger på en *ytre* gruppe uten transform. `clip-path` løses i
     * brukerrommet elementets eget `transform` har satt opp, så en klipperute
     * i gulvkoordinater på den speilvendte gruppa ble tolket i speilvendt,
     * skalert rom – og klippet bort hele refleksjonen.
     */
    s += '<g clip-path="url(#' + pre + 'gulvklipp)" opacity="0.19">' +
         '<g transform="translate(' + tx + ',' + (2 * GULV - ty).toFixed(1) +
         ') scale(' + BILSKALA + ',' + (-BILSKALA) + ')">' +
         Bil.innhold(valgt, pre + 'speil', { tier: tier }) + '</g></g>';
    s += '<rect x="0" y="' + GULV + '" width="' + B + '" height="' + (H - GULV) +
         '" fill="url(#' + pre + 'demp)"/>';
    s += lyspytt(148, pre) + lyspytt(332, pre);

    // Skygge rett under bilen, så den ikke svever over sitt eget speilbilde.
    s += '<ellipse cx="' + (B / 2) + '" cy="' + (GULV + 6) + '" rx="116" ry="11" fill="#0c1020" opacity="0.42"/>';

    s += '<g transform="translate(' + tx + ',' + ty.toFixed(1) + ') scale(' + BILSKALA + ')">' +
         Bil.innhold(valgt, pre + 'bil', { tier: tier }) + '</g>';

    /* --- portrammen, foran alt --- */

    s += '<rect x="0" y="0" width="' + B + '" height="56" fill="' + RAMME + '"/>';
    // Porten er rullet opp: noen få lameller under bjelken.
    for (var i = 0; i < 4; i++) {
      s += '<rect x="0" y="' + (8 + i * 11) + '" width="' + B + '" height="8" rx="3" fill="' +
           RAMME_MORK + '"/>';
    }
    s += '<rect x="0" y="0" width="22" height="' + H + '" fill="' + RAMME + '"/>';
    s += '<rect x="' + (B - 22) + '" y="0" width="22" height="' + H + '" fill="' + RAMME + '"/>';

    return s + '</svg>';
  }

  return { svg: svg };
})();
