/*
 * Brikkene som tegnes i rutene – ett omriss per ting, i sitt eget 100×100-rom.
 *
 * To ting styrer hvordan de er tegnet, og begge kommer av at arket skrives ut:
 *
 * - **18 mm per rute.** På A4 er en rute drøyt en tomannsfinger bred. Detaljer
 *   forsvinner, så hver brikke er en silhuett med ett kjennetegn: manken på
 *   løva, snabelen på elefanten, halsen på sjiraffen. To brikker som bare
 *   skiller seg i farge, er to brikker barnet ikke kan svare på.
 * - **Alt får en mørk kontur**, satt i CSS på gruppa i stedet for på hver
 *   form. Konturen er det som gjør at bildet fortsatt lar seg lese når arket
 *   kommer ut av en skriver med tom fargepatron. Detaljer som ikke skal ha
 *   kontur – flekker, striper, øyne – får klassen `u`.
 *
 * Hver brikke har et `ord`. Det ordet er fasiten, og det er det barnet skal
 * skrive. Derfor er ordene korte, konkrete og entydige: «traktor», ikke
 * «kjøretøy»; «låve», ikke «uthus».
 */
'use strict';

var Brikker = (function () {

  var F = {
    gul: '#f2c14e', oransje: '#e8871e', rod: '#d0483f', rosa: '#f0a5b8',
    brun: '#8b5e3c', lysbrun: '#c08a55', sand: '#e0c48f', kremgul: '#f6e2b3',
    gronn: '#5aa84f', morkgronn: '#39702f', lysgronn: '#8fd06a',
    bla: '#4a90d9', morkbla: '#2f5f9e', lysbla: '#a9d9f2',
    graa: '#9aa5ad', morkgraa: '#5d6b75', lysgraa: '#d3dbe0',
    hvit: '#fbfaf6', svart: '#2b3440', lilla: '#9b6bbf', turkis: '#4ec3ae',
    krem: '#f4e6c8'
  };

  // Uten kontur – for flekker, striper og øyne, som ellers blir grøt.
  var U = ' class="u"';

  function r(x, y, w, h, f, rad, k) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (rad || 0) + '" fill="' + f + '"' + (k || '') + '/>';
  }
  function c(cx, cy, rr, f, k) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + f + '"' + (k || '') + '/>';
  }
  function el(cx, cy, rx, ry, f, k) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
      '" fill="' + f + '"' + (k || '') + '/>';
  }
  function p(d, f, k) {
    return '<path d="' + d + '" fill="' + f + '"' + (k || '') + '/>';
  }
  // Strek med egen bredde – brukes til slangen, tau og streker som ikke er flater.
  function s(d, f, br) {
    return '<path d="' + d + '" fill="none" stroke="' + f + '" stroke-width="' + br +
      '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  // Fire bein på rad. xs er venstrekanten til hvert.
  function bein(xs, y, w, h, f) {
    var ut = '';
    for (var i = 0; i < xs.length; i++) ut += r(xs[i], y, w, h, f, w / 2);
    return ut;
  }
  function oye(x, y, rr) { return c(x, y, rr || 3, F.svart, U); }

  /* Bygningene deler form. De skiller seg på takfarge, veggfarge og ett
     symbol på fasaden – det er nok til å kjennes igjen på 18 mm, og langt
     mindre å vedlikeholde enn åtte frittegnede hus. */
  function hus(o) {
    var b = o.b || 62, x = 50 - b / 2, topp = o.topp || 40, bunn = 88;
    var ut = '';
    if (o.tak === 'flatt') {
      ut += r(x - 3, topp - 6, b + 6, 8, o.taksfarge || F.morkgraa, 2);
      ut += r(x, topp, b, bunn - topp, o.vegg, 2);
    } else {
      ut += r(x, topp, b, bunn - topp, o.vegg, 2);
      ut += p('M' + (x - 6) + ' ' + topp + ' L50 ' + (topp - 22) + ' L' + (x + b + 6) + ' ' + topp + ' Z',
        o.taksfarge || F.rod);
    }
    ut += r(43, 64, 14, 24, o.dor || F.brun, 2);       // dør, alltid nederst midt
    if (o.vinduer !== false) {
      ut += r(x + 5, 48, 12, 11, F.lysbla, 2);
      ut += r(x + b - 17, 48, 12, 11, F.lysbla, 2);
    }
    if (o.ekstra) ut += o.ekstra;
    return ut;
  }

  /* ---------------------------------------------------------------- dyr */

  var D = {};

  D.love = { ord: 'løve', tegn: function () {
    return s('M78 56 C92 52 94 40 88 34', F.gul, 6) + c(88, 32, 6, F.oransje) +
      bein([28, 42, 58, 72], 66, 9, 24, F.gul) +
      r(24, 42, 56, 30, F.gul, 14) +
      c(32, 46, 23, F.oransje) + c(32, 46, 15, F.gul) +
      oye(27, 42) + oye(38, 42) + el(32, 52, 5, 4, F.brun, U);
  } };

  D.elefant = { ord: 'elefant', tegn: function () {
    return bein([26, 42, 58, 72], 62, 12, 28, F.graa) +
      el(54, 48, 30, 22, F.graa) +
      c(26, 48, 18, F.graa) +
      el(30, 44, 13, 15, F.morkgraa) +
      s('M14 52 C6 62 8 76 16 84', F.graa, 9) +
      oye(20, 42);
  } };

  D.sjiraff = { ord: 'sjiraff', tegn: function () {
    return bein([38, 50, 64, 76], 62, 8, 28, F.kremgul) +
      r(34, 46, 48, 22, F.kremgul, 10) +
      p('M30 22 L44 20 L50 56 L34 58 Z', F.kremgul) +
      r(12, 10, 26, 15, F.kremgul, 7) +
      s('M22 10 L20 3', F.brun, 4) + s('M32 10 L34 3', F.brun, 4) +
      c(46, 32, 5, F.brun, U) + c(38, 46, 5, F.brun, U) +
      c(58, 54, 5, F.brun, U) + c(72, 52, 5, F.brun, U) +
      oye(20, 16);
  } };

  D.sebra = { ord: 'sebra', tegn: function () {
    return bein([28, 42, 58, 72], 64, 9, 26, F.hvit) +
      r(24, 44, 56, 28, F.hvit, 12) +
      p('M28 46 L20 20 L36 18 L44 44 Z', F.hvit) +
      r(38, 48, 6, 22, F.svart, 0, U) + r(52, 46, 6, 25, F.svart, 0, U) +
      r(66, 46, 6, 25, F.svart, 0, U) + r(24, 26, 5, 16, F.svart, 0, U) +
      s('M34 16 L46 30', F.svart, 6) + oye(24, 26);
  } };

  D.ape = { ord: 'ape', tegn: function () {
    return s('M72 58 C90 58 92 40 80 34', F.brun, 6) +
      bein([34, 56], 66, 11, 22, F.brun) +
      el(50, 56, 22, 20, F.brun) + el(50, 60, 13, 13, F.lysbrun, U) +
      c(30, 30, 7, F.brun) + c(70, 30, 7, F.brun) +
      c(50, 30, 20, F.brun) + el(50, 34, 13, 11, F.lysbrun, U) +
      oye(44, 26) + oye(56, 26);
  } };

  D.pingvin = { ord: 'pingvin', tegn: function () {
    return el(38, 88, 12, 5, F.oransje) + el(62, 88, 12, 5, F.oransje) +
      el(50, 52, 24, 34, F.svart) +
      el(50, 60, 15, 25, F.hvit, U) +
      el(24, 54, 7, 18, F.svart) + el(76, 54, 7, 18, F.svart) +
      p('M50 34 L64 42 L50 46 Z', F.oransje) +
      c(43, 30, 4, F.hvit, U) + c(57, 30, 4, F.hvit, U) + oye(43, 30, 2) + oye(57, 30, 2);
  } };

  D.sel = { ord: 'sel', tegn: function () {
    return p('M84 84 L96 68 L98 86 Z', F.graa) +
      el(52, 74, 32, 14, F.graa) +
      c(26, 52, 16, F.graa) +
      el(20, 58, 8, 6, F.morkgraa, U) +
      p('M46 76 L34 92 L58 90 Z', F.graa) +
      oye(20, 46) + oye(32, 46);
  } };

  D.isbjorn = { ord: 'isbjørn', tegn: function () {
    return bein([26, 42, 58, 74], 66, 11, 24, F.hvit) +
      r(22, 42, 58, 30, F.hvit, 15) +
      c(28, 44, 17, F.hvit) + c(20, 30, 7, F.hvit) + c(38, 28, 7, F.hvit) +
      el(18, 50, 7, 6, F.svart, U) + oye(24, 40) + oye(36, 40);
  } };

  D.tiger = { ord: 'tiger', tegn: function () {
    return s('M78 56 C92 52 94 40 88 36', F.oransje, 6) +
      bein([28, 42, 58, 72], 66, 9, 24, F.oransje) +
      r(24, 44, 56, 28, F.oransje, 13) +
      r(40, 46, 5, 24, F.svart, 0, U) + r(54, 46, 5, 24, F.svart, 0, U) +
      r(68, 46, 5, 24, F.svart, 0, U) +
      c(30, 46, 16, F.oransje) + c(21, 33, 6, F.oransje) + c(39, 33, 6, F.oransje) +
      oye(25, 42) + oye(35, 42) + el(30, 52, 5, 4, F.rosa, U);
  } };

  D.slange = { ord: 'slange', tegn: function () {
    // Tunga stakk utenfor ruta i første utgave, og så ut til å høre til naboen.
    return s('M10 84 C32 84 28 62 48 62 C68 62 64 42 82 42 C88 42 88 36 86 32',
      F.morkgronn, 15) + c(84, 28, 9, F.gronn) + s('M88 24 L94 18', F.rod, 3) +
      oye(81, 25, 2.5);
  } };

  D.papegoye = { ord: 'papegøye', tegn: function () {
    return r(46, 78, 8, 14, F.brun, 3) + r(24, 88, 52, 7, F.brun, 3) +
      p('M56 66 L84 88 L62 82 Z', F.bla) +
      el(48, 50, 18, 24, F.rod) +
      el(56, 52, 10, 15, F.gul, U) +
      c(44, 28, 13, F.rod) +
      p('M32 26 L44 22 L44 38 Z', F.gul) +
      oye(46, 24);
  } };

  D.krokodille = { ord: 'krokodille', tegn: function () {
    return bein([28, 44, 60, 74], 70, 9, 16, F.morkgronn) +
      el(54, 62, 34, 13, F.gronn) +
      p('M6 62 L34 54 L34 70 Z', F.gronn) +
      p('M34 50 L40 40 L46 50 L52 40 L58 50 L64 40 L70 50 Z', F.morkgronn) +
      p('M6 64 L30 62 L30 70 Z', F.hvit, U) + oye(34, 56);
  } };

  D.flodhest = { ord: 'flodhest', tegn: function () {
    return bein([28, 44, 60, 74], 68, 12, 22, F.lilla) +
      el(56, 54, 30, 20, F.lilla) +
      el(26, 58, 20, 16, F.lilla) +
      c(16, 42, 6, F.lilla) + c(34, 40, 6, F.lilla) +
      c(16, 60, 3.5, F.svart, U) + c(26, 60, 3.5, F.svart, U) +
      oye(20, 48) + oye(32, 48);
  } };

  D.kamel = { ord: 'kamel', tegn: function () {
    return bein([36, 48, 64, 76], 62, 8, 28, F.sand) +
      r(32, 48, 50, 20, F.sand, 8) +
      p('M36 50 C40 30 52 30 56 50 Z', F.sand) +
      p('M58 50 C62 32 74 32 78 50 Z', F.sand) +
      p('M20 20 L34 18 L40 54 L26 56 Z', F.sand) +
      r(8, 10, 22, 14, F.sand, 7) + oye(16, 15);
  } };

  D.struts = { ord: 'struts', tegn: function () {
    return r(44, 62, 7, 30, F.rosa, 3) + r(58, 62, 7, 30, F.rosa, 3) +
      el(54, 52, 26, 22, F.svart) +
      p('M74 44 L92 30 L88 54 Z', F.hvit) +
      s('M34 50 C22 40 26 22 34 16', F.rosa, 9) +
      c(34, 12, 10, F.rosa) + p('M26 12 L34 8 L34 18 Z', F.gul) + oye(36, 9);
  } };

  /* -------------------------------------------------- gårdsdyr og kjæledyr */

  D.ku = { ord: 'ku', tegn: function () {
    return bein([28, 42, 58, 72], 66, 10, 24, F.hvit) +
      r(24, 42, 58, 30, F.hvit, 12) +
      el(44, 50, 10, 8, F.svart, U) + el(68, 60, 12, 9, F.svart, U) +
      c(28, 46, 16, F.hvit) +
      s('M18 34 C12 28 14 22 20 22', F.krem, 5) + s('M40 32 C46 26 44 20 38 20', F.krem, 5) +
      el(28, 54, 11, 8, F.rosa) + c(25, 54, 2.5, F.svart, U) + c(32, 54, 2.5, F.svart, U) +
      oye(22, 42);
  } };

  D.hest = { ord: 'hest', tegn: function () {
    return s('M80 52 C92 56 94 70 88 78', F.brun, 6) +
      bein([28, 42, 58, 74], 64, 9, 26, F.brun) +
      r(24, 44, 58, 26, F.brun, 12) +
      p('M26 48 L18 22 L34 18 L44 44 Z', F.brun) +
      s('M32 16 C42 24 46 34 48 44', F.svart, 7) +
      r(14, 18, 16, 12, F.brun, 5) + oye(22, 24);
  } };

  D.sau = { ord: 'sau', tegn: function () {
    return bein([32, 46, 60, 72], 68, 8, 22, F.svart) +
      c(38, 52, 18, F.hvit) + c(58, 48, 20, F.hvit) + c(74, 56, 16, F.hvit) +
      el(56, 60, 30, 16, F.hvit) +
      el(24, 44, 13, 12, F.svart) + c(14, 38, 6, F.svart) +
      c(22, 42, 3, F.hvit, U);
  } };

  D.gris = { ord: 'gris', tegn: function () {
    return s('M80 54 C90 50 90 40 84 40', F.rosa, 5) +
      bein([30, 44, 58, 72], 66, 10, 24, F.rosa) +
      r(26, 44, 56, 28, F.rosa, 14) +
      c(30, 50, 17, F.rosa) +
      p('M18 34 L28 30 L28 42 Z', F.rosa) + p('M42 32 L34 30 L36 42 Z', F.rosa) +
      el(20, 56, 9, 7, '#e08ba0') + c(17, 56, 2, F.svart, U) + c(23, 56, 2, F.svart, U) +
      oye(26, 46);
  } };

  D.hone = { ord: 'høne', tegn: function () {
    return r(42, 80, 5, 12, F.gul, 2) + r(56, 80, 5, 12, F.gul, 2) +
      el(54, 60, 26, 22, F.krem) +
      p('M74 46 L92 32 L86 58 Z', F.krem) +
      c(34, 42, 15, F.krem) +
      p('M26 28 C30 20 36 26 40 20 C44 26 46 30 44 32 Z', F.rod) +
      p('M20 44 L30 40 L30 50 Z', F.oransje) +
      p('M30 54 C30 62 38 62 38 54 Z', F.rod) + oye(34, 38);
  } };

  D.geit = { ord: 'geit', tegn: function () {
    return bein([30, 44, 58, 72], 66, 8, 24, F.lysgraa) +
      r(26, 46, 56, 24, F.lysgraa, 11) +
      p('M28 50 L20 24 L34 20 L44 46 Z', F.lysgraa) +
      s('M24 20 C14 14 12 22 16 28', F.brun, 5) + s('M34 18 C26 10 20 16 22 22', F.brun, 5) +
      r(12, 22, 16, 11, F.lysgraa, 5) +
      p('M16 33 L24 33 L20 46 Z', F.hvit) + oye(20, 27);
  } };

  D.and = { ord: 'and', tegn: function () {
    return el(52, 66, 26, 18, F.hvit) +
      p('M70 54 L90 44 L84 66 Z', F.hvit) +
      s('M34 58 C28 44 32 34 40 32', F.hvit, 13) +
      c(38, 30, 12, F.hvit) +
      p('M24 30 L38 26 L38 36 Z', F.oransje) +
      r(44, 82, 12, 5, F.oransje, 2) + oye(40, 26);
  } };

  D.kanin = { ord: 'kanin', tegn: function () {
    return c(76, 66, 10, F.hvit) +
      el(54, 66, 24, 20, F.hvit) +
      c(30, 56, 16, F.hvit) +
      el(22, 26, 6, 18, F.hvit) + el(38, 24, 6, 18, F.hvit) +
      el(22, 26, 3, 11, F.rosa, U) + el(38, 24, 3, 11, F.rosa, U) +
      c(18, 60, 3, F.rosa) + oye(24, 52) + oye(36, 52);
  } };

  D.hund = { ord: 'hund', tegn: function () {
    return s('M78 56 C90 48 92 38 86 34', F.lysbrun, 6) +
      bein([30, 44, 58, 72], 68, 9, 22, F.lysbrun) +
      r(26, 48, 56, 26, F.lysbrun, 12) +
      c(30, 46, 16, F.lysbrun) +
      el(16, 46, 7, 15, F.brun) + el(44, 46, 7, 15, F.brun) +
      el(24, 56, 8, 6, F.svart, U) + oye(22, 42) + oye(34, 42);
  } };

  D.katt = { ord: 'katt', tegn: function () {
    return s('M76 62 C90 58 90 40 82 34', F.oransje, 6) +
      bein([32, 46, 58, 70], 70, 8, 20, F.oransje) +
      el(54, 62, 28, 16, F.oransje) +
      c(30, 50, 16, F.oransje) +
      p('M18 40 L20 26 L32 36 Z', F.oransje) + p('M42 38 L42 24 L30 34 Z', F.oransje) +
      el(28, 56, 5, 4, F.rosa, U) + oye(23, 48) + oye(35, 48);
  } };

  D.esel = { ord: 'esel', tegn: function () {
    return s('M80 54 C90 60 90 72 84 78', F.graa, 5) +
      bein([30, 44, 58, 72], 64, 9, 26, F.graa) +
      r(26, 46, 56, 24, F.graa, 11) +
      p('M28 50 L20 26 L34 22 L44 46 Z', F.graa) +
      el(18, 16, 6, 14, F.graa) + el(34, 14, 6, 14, F.graa) +
      r(12, 24, 16, 12, F.graa, 5) + oye(20, 29);
  } };

  /* ------------------------------------------------------- ting og bygg */

  D.port = { ord: 'port', tegn: function () {
    return r(14, 34, 12, 54, F.brun, 3) + r(74, 34, 12, 54, F.brun, 3) +
      p('M10 34 C10 8 90 8 90 34 L78 34 C78 22 22 22 22 34 Z', F.gronn) +
      r(30, 62, 40, 26, F.lysbrun, 3) + r(48, 62, 4, 26, F.brun, 0, U);
  } };

  D.kiosk = { ord: 'kiosk', tegn: function () {
    var m = '';
    for (var i = 0; i < 5; i++) m += r(12 + i * 15.2, 34, 7.6, 12, i % 2 ? F.hvit : F.rod, 0, U);
    return r(18, 44, 64, 44, F.krem, 3) +
      r(14, 60, 72, 8, F.lysbrun, 2) +
      r(28, 68, 44, 20, F.lysbla, 2) +
      r(12, 34, 76, 12, F.hvit, 2) + m + r(12, 34, 76, 12, 'none', 2);
  } };

  D.benk = { ord: 'benk', tegn: function () {
    return r(20, 58, 60, 9, F.lysbrun, 3) + r(20, 44, 60, 9, F.lysbrun, 3) +
      r(24, 67, 8, 21, F.morkgraa, 2) + r(68, 67, 8, 21, F.morkgraa, 2) +
      r(24, 46, 7, 22, F.morkgraa, 2) + r(69, 46, 7, 22, F.morkgraa, 2);
  } };

  D.kart = { ord: 'kart', tegn: function () {
    return r(46, 56, 8, 32, F.brun, 3) +
      r(16, 24, 68, 36, F.krem, 3) +
      s('M24 44 C36 30 48 52 62 38 L76 38', F.rod, 4) +
      c(76, 38, 5, F.bla, U) + c(24, 44, 4, F.gronn, U);
  } };

  D.fontene = { ord: 'fontene', tegn: function () {
    return el(50, 76, 38, 14, F.lysgraa) + el(50, 74, 30, 9, F.lysbla) +
      r(45, 40, 10, 32, F.lysgraa, 3) + el(50, 38, 18, 6, F.lysgraa) +
      s('M50 34 C40 24 40 16 46 12', F.lysbla, 5) +
      s('M50 34 C60 24 60 16 54 12', F.lysbla, 5);
  } };

  D.boette = { ord: 'søppelbøtte', tegn: function () {
    return p('M26 40 L74 40 L68 88 L32 88 Z', F.morkgronn) +
      r(20, 30, 60, 11, F.gronn, 3) + r(44, 22, 12, 8, F.gronn, 2) +
      r(42, 48, 5, 32, F.morkgraa, 0, U) + r(54, 48, 5, 32, F.morkgraa, 0, U);
  } };

  D.lykt = { ord: 'lyktestolpe', tegn: function () {
    return r(45, 34, 10, 54, F.morkgraa, 2) + el(50, 88, 18, 6, F.morkgraa) +
      p('M34 30 L66 30 L58 10 L42 10 Z', F.gul) + r(38, 6, 24, 6, F.morkgraa, 2);
  } };

  D.tre = { ord: 'tre', tegn: function () {
    return r(44, 56, 12, 32, F.brun, 3) +
      c(36, 46, 20, F.morkgronn) + c(62, 46, 18, F.gronn) + c(50, 32, 20, F.gronn);
  } };

  D.busk = { ord: 'busk', tegn: function () {
    return c(34, 68, 16, F.morkgronn) + c(64, 68, 15, F.gronn) + c(50, 56, 18, F.gronn);
  } };

  D.blomst = { ord: 'blomst', tegn: function () {
    var kron = '';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      kron += c(50 + Math.cos(a) * 15, 44 + Math.sin(a) * 15, 10, F.rosa);
    }
    return s('M50 88 L50 52', F.morkgronn, 5) + p('M50 70 C36 70 34 60 34 58 C44 58 50 64 50 70 Z', F.gronn) +
      kron + c(50, 44, 9, F.gul);
  } };

  D.stein = { ord: 'stein', tegn: function () {
    return p('M18 86 C14 68 26 54 44 54 C64 54 76 66 74 86 Z', F.graa) +
      p('M30 66 C34 60 44 58 50 60', 'none', ' stroke="' + F.lysgraa + '" stroke-width="4"');
  } };

  D.laave = { ord: 'låve', tegn: function () {
    return r(16, 44, 68, 44, F.rod, 2) +
      p('M8 44 L50 18 L92 44 Z', F.morkgraa) +
      r(36, 58, 28, 30, F.lysbrun, 2) +
      s('M36 58 L64 88', F.krem, 4) + s('M64 58 L36 88', F.krem, 4) +
      r(44, 30, 12, 12, F.krem, 2);
  } };

  D.hus = { ord: 'hus', tegn: function () { return hus({ vegg: F.kremgul, taksfarge: F.rod }); } };

  D.silo = { ord: 'silo', tegn: function () {
    return r(30, 26, 40, 62, F.lysgraa, 2) +
      p('M26 26 C26 6 74 6 74 26 Z', F.morkgraa) +
      s('M32 44 L68 44', F.graa, 3) + s('M32 62 L68 62', F.graa, 3) +
      r(42, 70, 16, 18, F.morkgraa, 2);
  } };

  D.traktor = { ord: 'traktor', tegn: function () {
    return r(20, 46, 48, 26, F.gronn, 4) +
      r(26, 26, 26, 22, F.gronn, 4) + r(30, 30, 18, 14, F.lysbla, 2) +
      r(60, 52, 22, 16, F.gronn, 3) +
      c(70, 72, 18, F.svart) + c(70, 72, 8, F.gul, U) +
      c(28, 78, 12, F.svart) + c(28, 78, 5, F.gul, U);
  } };

  D.hoyball = { ord: 'høyball', tegn: function () {
    return c(50, 60, 28, F.sand) + c(50, 60, 18, F.kremgul, U) + c(50, 60, 8, F.sand, U) +
      r(16, 86, 68, 6, F.lysbrun, 3);
  } };

  D.bronn = { ord: 'brønn', tegn: function () {
    return r(24, 60, 52, 28, F.graa, 3) +
      s('M30 66 L70 66', F.morkgraa, 3) + s('M30 76 L70 76', F.morkgraa, 3) +
      r(26, 52, 48, 9, F.lysgraa, 2) +
      r(26, 24, 7, 30, F.brun, 2) + r(67, 24, 7, 30, F.brun, 2) +
      p('M16 26 L50 8 L84 26 Z', F.rod) +
      r(44, 34, 12, 12, F.lysbrun, 2);
  } };

  D.fugleskremsel = { ord: 'fugleskremsel', tegn: function () {
    return r(46, 44, 8, 46, F.brun, 2) + r(18, 46, 64, 8, F.brun, 2) +
      p('M30 46 L70 46 L64 76 L36 76 Z', F.rod) +
      c(50, 30, 15, F.sand) +
      r(28, 16, 44, 7, F.brun, 3) + p('M36 22 L64 22 L60 8 L40 8 Z', F.brun) +
      oye(45, 28) + oye(55, 28) + s('M44 36 C48 40 52 40 56 36', F.svart, 3);
  } };

  D.postkasse = { ord: 'postkasse', tegn: function () {
    return r(46, 56, 8, 34, F.brun, 2) +
      p('M22 54 C22 28 78 28 78 54 Z', F.gronn) + r(22, 50, 56, 8, F.gronn, 2) +
      r(34, 38, 32, 6, F.svart, 2, U) + c(74, 40, 6, F.rod);
  } };

  D.butikk = { ord: 'butikk', tegn: function () {
    var m = '';
    for (var i = 0; i < 6; i++) m += r(12 + i * 12.7, 34, 6.4, 11, i % 2 ? F.hvit : F.turkis, 0, U);
    return hus({ vegg: F.krem, tak: 'flatt', taksfarge: F.morkgraa, vinduer: false, dor: F.turkis,
      ekstra: r(20, 48, 60, 14, F.lysbla, 2) }) +
      r(12, 34, 76, 11, F.hvit, 2) + m;
  } };

  D.skole = { ord: 'skole', tegn: function () {
    return hus({ vegg: '#e5b98f', taksfarge: '#7a3f36', dor: F.brun,
      ekstra: r(30, 70, 40, 6, '#7a3f36', 2, U) }) +
      r(48, 6, 5, 16, F.morkgraa, 2) + p('M53 8 L76 13 L53 18 Z', F.rod) +
      c(50, 32, 7, F.hvit) + s('M50 28 L50 32 L54 34', F.svart, 2.5);
  } };

  D.sykehus = { ord: 'sykehus', tegn: function () {
    return hus({ vegg: F.hvit, tak: 'flatt', taksfarge: F.lysgraa, dor: F.lysbla }) +
      r(44, 22, 12, 32, F.rod, 2, U) + r(34, 32, 32, 12, F.rod, 2, U);
  } };

  D.brannstasjon = { ord: 'brannstasjon', tegn: function () {
    return hus({ vegg: F.rod, tak: 'flatt', taksfarge: '#8f2f28', vinduer: false, dor: F.rod,
      ekstra: r(26, 52, 48, 36, F.kremgul, 2) + s('M26 62 L74 62', F.lysbrun, 3) +
        s('M26 74 L74 74', F.lysbrun, 3) }) +
      r(44, 14, 12, 20, F.lysgraa, 2) + c(50, 12, 7, F.gul);
  } };

  D.bibliotek = { ord: 'bibliotek', tegn: function () {
    return r(16, 44, 68, 44, F.krem, 2) +
      r(24, 50, 9, 38, F.lysgraa, 2) + r(46, 50, 9, 38, F.lysgraa, 2) + r(68, 50, 9, 38, F.lysgraa, 2) +
      r(14, 38, 72, 8, F.lysgraa, 2) +
      p('M8 38 L50 14 L92 38 Z', '#b9c4cb') +
      p('M38 28 L50 24 L62 28 L62 34 L50 30 L38 34 Z', F.bla);
  } };

  D.kirke = { ord: 'kirke', tegn: function () {
    return r(40, 40, 44, 48, F.hvit, 2) + p('M34 40 L62 20 L90 40 Z', F.morkgraa) +
      r(14, 34, 26, 54, F.hvit, 2) + p('M10 34 L27 8 L44 34 Z', F.morkgraa) +
      r(24, 4, 6, 14, F.gul, 1, U) + r(19, 8, 16, 5, F.gul, 1, U) +
      r(56, 56, 14, 32, F.brun, 7) + c(27, 52, 7, F.lysbla);
  } };

  D.bakeri = { ord: 'bakeri', tegn: function () {
    return hus({ vegg: '#f0d9a8', tak: 'flatt', taksfarge: F.brun, vinduer: false, dor: F.brun,
      ekstra: r(20, 50, 24, 16, F.lysbla, 2) + r(56, 50, 24, 16, F.lysbla, 2) }) +
      c(42, 28, 12, F.lysbrun) + c(58, 28, 12, F.lysbrun) + r(40, 24, 20, 10, F.lysbrun, 5);
  } };

  D.blokk = { ord: 'blokk', tegn: function () {
    var v = '';
    for (var rad = 0; rad < 4; rad++)
      for (var kol = 0; kol < 3; kol++)
        v += r(26 + kol * 18, 20 + rad * 16, 12, 10, rad === 3 && kol === 1 ? F.brun : F.lysbla, 1);
    return r(20, 12, 60, 76, F.lysgraa, 2) + r(16, 8, 68, 7, F.morkgraa, 2) + v;
  } };

  D.bil = { ord: 'bil', tegn: function () {
    return r(14, 56, 72, 20, F.bla, 7) +
      p('M28 56 L34 38 L66 38 L74 56 Z', F.bla) +
      r(36, 41, 26, 13, F.lysbla, 2) +
      c(30, 78, 11, F.svart) + c(70, 78, 11, F.svart) +
      c(30, 78, 4, F.lysgraa, U) + c(70, 78, 4, F.lysgraa, U);
  } };

  D.buss = { ord: 'buss', tegn: function () {
    var v = '';
    for (var i = 0; i < 4; i++) v += r(16 + i * 18, 36, 13, 14, F.lysbla, 2);
    return r(8, 26, 84, 50, F.gul, 6) + v +
      r(78, 54, 12, 20, F.lysbla, 2) +
      c(26, 78, 10, F.svart) + c(72, 78, 10, F.svart);
  } };

  D.sykkel = { ord: 'sykkel', tegn: function () {
    return c(26, 66, 20, 'none', ' stroke="' + F.svart + '" stroke-width="6"') +
      c(74, 66, 20, 'none', ' stroke="' + F.svart + '" stroke-width="6"') +
      s('M26 66 L46 66 L58 40 L74 66', F.rod, 6) + s('M46 66 L56 40', F.rod, 6) +
      r(38, 34, 20, 6, F.svart, 3) + s('M58 40 L70 32', F.svart, 5);
  } };

  D.lyskryss = { ord: 'lyskryss', tegn: function () {
    return r(45, 50, 10, 40, F.morkgraa, 2) +
      r(32, 8, 36, 46, F.morkgraa, 6) +
      c(50, 20, 8, F.rod) + c(50, 34, 8, F.gul) + c(50, 46, 8, F.gronn);
  } };

  /* --------------------------------------------------------------- grunn */

  /* Underlaget i en rute. Tonene er lyse med vilje: rutenettet og brikkene
     ligger oppå, og et mørkt underlag spiser begge deler på papir. */
  var GRUNN = {
    gress: '#d8ecc0',
    sand: '#f5e3b0',
    vann: '#bfe3f5',
    aker: '#e6cfa8',
    stein: '#e8e8e2',
    asfalt: '#dcdcd8',
    /* Veien er grå, ikke sandfarget. Første forsøk ga den samme varme tonen
       som sanden i innhegningene, og på arket var det umulig å se hvor
       innhegningen sluttet og stien begynte. */
    sti: '#cfc8ba',
    vei: '#c2c2bd'
  };

  /* Struktur i underlaget – ellers blir vann og åker bare farge, og en
     svart-hvitt utskrift skiller dem ikke. Tegnes uten kontur. */
  function grunnmonster(navn, rn) {
    if (navn === 'vann')
      return s('M10 32 C24 24 34 40 50 32 C66 24 76 40 90 32', '#8ec9e8', 3) +
        s('M10 62 C24 54 34 70 50 62 C66 54 76 70 90 62', '#8ec9e8', 3);
    if (navn === 'aker')
      return s('M6 24 L94 24', '#c9a978', 3) + s('M6 44 L94 44', '#c9a978', 3) +
        s('M6 64 L94 64', '#c9a978', 3) + s('M6 84 L94 84', '#c9a978', 3);
    if (navn === 'sand')
      return c(24, 30, 3, '#d9c391') + c(70, 22, 3, '#d9c391') + c(46, 70, 3, '#d9c391') +
        c(80, 66, 3, '#d9c391');
    if (navn === 'gress')
      return s('M20 74 L20 64', '#b6d69a', 3) + s('M28 78 L28 70', '#b6d69a', 3) +
        s('M66 34 L66 26', '#b6d69a', 3) + s('M74 38 L74 30', '#b6d69a', 3);
    return '';
  }

  /* --------------------------------------------------------- andre ord */

  /* Ord barnet kan skrive i stedet, og som er like riktige. Det som måles er
     om barnet fant riktig rute, ikke om det kaller tingen det samme som
     brikketabellen. «Gatelys» for en lyktestolpe og «fjøs» for en låve er
     riktige svar på et koordinatspørsmål.

     To regler når du legger til noe her:

     - **Alternativet må ikke kunne forveksles med et annet ord i banken.»
       «Kiosk» duger ikke som alternativ for butikk, for kiosk er sitt eget
       svar i dyrehagen. `tester/svar.js` sammenligner alle mot alle.
     - **Det må være et annet ord, ikke en annen form.** «Løven» og «løvene»
       håndteres av endelsene i `svar.js` og skal ikke stå her. */
  var OGSAA = {
    isbjorn: ['bjørn'],
    slange: ['orm'],
    ape: ['apekatt'],
    kamel: ['dromedar'],
    kanin: ['hare'],
    hund: ['bikkje'],
    katt: ['pus'],
    laave: ['fjøs'],
    silo: ['kornsilo'],
    bronn: ['vannbrønn'],
    hoyball: ['halmball', 'høyballe'],
    fugleskremsel: ['skremsel'],
    boette: ['søppelkasse', 'søppelspann', 'søppeldunk', 'bøtte', 'søppel'],
    lykt: ['lykt', 'gatelys', 'lysstolpe'],
    kart: ['skilt', 'kartskilt'],
    port: ['inngang', 'grind'],
    kiosk: ['bod', 'pølsebod'],
    fontene: ['springvann', 'vannfontene'],
    benk: ['sittebenk', 'parkbenk'],
    blokk: ['høyhus', 'boligblokk'],
    lyskryss: ['trafikklys', 'lyssignal'],
    sykkel: ['tohjuling'],
    bil: ['personbil'],
    hus: ['bolighus'],
    tre: ['treet']
  };

  function finnes(id) { return Object.prototype.hasOwnProperty.call(D, id); }
  function ord(id) { return D[id].ord; }
  function alternativer(id) { return OGSAA[id] || []; }
  function tegn(id) { return D[id].tegn(); }

  return {
    F: F, GRUNN: GRUNN, ALLE: D, OGSAA: OGSAA,
    finnes: finnes, ord: ord, alternativer: alternativer,
    tegn: tegn, grunnmonster: grunnmonster
  };
})();
