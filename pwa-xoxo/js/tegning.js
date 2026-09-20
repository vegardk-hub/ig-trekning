/*
 * Tegner brettet og brikkene som SVG.
 *
 * Ruta er en åttekant, og mellom fire åttekanter står det en liten firkant på
 * høykant. Det er ikke pynt – det er avkortet firkantmønster, og det er slik
 * brettet i esken ser ut. To naboruter i samme brikke møtes langs den flate
 * kanten, og halsen mellom dem tegnes med vilje litt smalere, så øyet ser
 * hvor rutene går uten at det trengs en strek inni brikka.
 *
 * Konturen er en strek tegnet *under* fyllet, ikke rundt hver rute. Tegner
 * man hver åttekant med strek, får brikka sømmer på tvers av seg selv; med
 * streken under og fyllet oppå blir bare yttergrensa mørk.
 *
 * Merkene tegnes i svart eller hvitt etter hvor lys brikkefargen er. Kontrast
 * er målt, ikke valgt: en mørk X på #2d5aa8 forsvinner.
 */
'use strict';

var Tegning = (function () {

  var S = 100;   // rutestørrelse
  var C = 24;    // hjørneavskjæring – åttekanten er en avkortet firkant
  var H = 22;    // halv halsbredde mellom to naboruter
  var M = 22;    // merkets radius
  var STREK = 13;
  var KONTUR = 11;

  function tall(n) { return Math.round(n * 100) / 100; }

  function attekant(r, k) {
    var x = k * S, y = r * S;
    return 'M' + [
      [x + C, y], [x + S - C, y], [x + S, y + C], [x + S, y + S - C],
      [x + S - C, y + S], [x + C, y + S], [x, y + S - C], [x, y + C]
    ].map(function (p) { return tall(p[0]) + ',' + tall(p[1]); }).join('L') + 'Z';
  }

  function firkant(x, y, b, h) {
    return 'M' + tall(x) + ',' + tall(y) + 'h' + tall(b) + 'v' + tall(h) + 'h' + tall(-b) + 'Z';
  }

  // Halsen overlapper begge naboene med noen piksler, ellers står det en
  // hårstrek igjen mellom to fyllte flater i enkelte nettlesere.
  function hals(r, k, dr, dk) {
    if (dk === 1) return firkant((k + 1) * S - C - 1, r * S + S / 2 - H, 2 * (C + 1), 2 * H);
    return firkant(k * S + S / 2 - H, (r + 1) * S - C - 1, 2 * H, 2 * (C + 1));
  }

  function lysstyrke(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function mork(hex, andel) {
    var n = parseInt(hex.slice(1), 16), ut = '#';
    [(n >> 16) & 255, (n >> 8) & 255, n & 255].forEach(function (v) {
      ut += ('0' + Math.round(v * (1 - andel)).toString(16)).slice(-2);
    });
    return ut;
  }

  function merke(r, k, type, farge) {
    var cx = k * S + S / 2, cy = r * S + S / 2;
    if (type === 1) {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + M + '" fill="none" stroke="' +
        farge + '" stroke-width="' + STREK + '"/>';
    }
    var d = M * 0.78;
    return '<path d="M' + tall(cx - d) + ',' + tall(cy - d) + 'L' + tall(cx + d) + ',' + tall(cy + d) +
      'M' + tall(cx + d) + ',' + tall(cy - d) + 'L' + tall(cx - d) + ',' + tall(cy + d) +
      '" fill="none" stroke="' + farge + '" stroke-width="' + STREK + '" stroke-linecap="round"/>';
  }

  // celler: [[r, k, merke], ...] med merke 0 = X, 1 = O
  function brikkeBane(celler) {
    var d = '', har = {};
    celler.forEach(function (c) { har[c[0] + ':' + c[1]] = true; });
    celler.forEach(function (c) {
      d += attekant(c[0], c[1]);
      if (har[c[0] + ':' + (c[1] + 1)]) d += hals(c[0], c[1], 0, 1);
      if (har[(c[0] + 1) + ':' + c[1]]) d += hals(c[0], c[1], 1, 0);
    });
    return d;
  }

  function omfang(celler) {
    var hr = 0, hk = 0;
    celler.forEach(function (c) { if (c[0] > hr) hr = c[0]; if (c[1] > hk) hk = c[1]; });
    return { rader: hr + 1, kolonner: hk + 1 };
  }

  // Selve brikka, uten <svg> rundt – så den kan settes rett inn i brettet òg.
  function brikkeInnhold(celler, farge) {
    var d = brikkeBane(celler);
    var merkefarge = lysstyrke(farge) > 0.55 ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.8)';
    var ut = '<path d="' + d + '" fill="' + mork(farge, 0.45) + '" stroke="' + mork(farge, 0.45) +
      '" stroke-width="' + KONTUR + '" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="' + farge + '"/>';
    celler.forEach(function (c) { ut += merke(c[0], c[1], c[2], merkefarge); });
    return ut;
  }

  function brikke(celler, farge, valg) {
    valg = valg || {};
    var o = omfang(celler), p = KONTUR;
    var b = o.kolonner * S, h = o.rader * S;
    return '<svg class="brikke" viewBox="' + (-p) + ' ' + (-p) + ' ' + (b + 2 * p) + ' ' + (h + 2 * p) +
      '" width="' + (valg.bredde || b / 2.2) + '" role="img" aria-label="' + (valg.tekst || 'brikke') + '">' +
      brikkeInnhold(celler, farge) + '</svg>';
  }

  // Brettet slik det ligger i esken: fordypninger i en lys plate, med de små
  // firkantene på høykant der fire ruter møtes.
  function brett(rader, kolonner) {
    var b = kolonner * S, h = rader * S, p = 26, r, k;
    var ut = '<svg class="brett" viewBox="' + (-p) + ' ' + (-p) + ' ' + (b + 2 * p) + ' ' + (h + 2 * p) + '">';
    ut += '<rect x="' + (-p) + '" y="' + (-p) + '" width="' + (b + 2 * p) + '" height="' + (h + 2 * p) +
      '" rx="34" fill="#e9e6df"/>';
    for (r = 0; r < rader; r++) {
      for (k = 0; k < kolonner; k++) {
        ut += '<path d="' + attekant(r, k) + '" fill="#dbd7ce" stroke="#cbc6bb" stroke-width="3"/>';
      }
    }
    for (r = 1; r < rader; r++) {
      for (k = 1; k < kolonner; k++) {
        var x = k * S, y = r * S;
        ut += '<path d="M' + (x - C) + ',' + y + 'L' + x + ',' + (y - C) + 'L' + (x + C) + ',' + y +
          'L' + x + ',' + (y + C) + 'Z" fill="#dbd7ce" stroke="#cbc6bb" stroke-width="3"/>';
      }
    }
    return ut + '</svg>';
  }

  return {
    S: S,
    brikke: brikke,
    brikkeInnhold: brikkeInnhold,
    brikkeBane: brikkeBane,
    brett: brett,
    omfang: omfang,
    mork: mork,
    lysstyrke: lysstyrke
  };
})();

if (typeof window !== 'undefined') window.Tegning = Tegning;
