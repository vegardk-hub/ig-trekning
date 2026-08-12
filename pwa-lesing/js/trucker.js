/*
 * Truckene tegnes, de lastes ikke ned.
 *
 * Én tegning + en tabell med farger, motor og dekor gir åtte tydelig
 * forskjellige trucker uten en eneste bildefil. Det holder appen uten
 * byggesteg, gir skarpe kanter på alle skjermer, og gjør det til en
 * tabellrad å legge til truck nummer ni.
 *
 * Puslespillet legger sine egne ruter oppå denne SVG-en, så tegningen vet
 * ingenting om brikker.
 */

(function () {
  'use strict';

  var trucker = [
    { navn: 'Ildkulen',      karosseri: '#d8342a', mork: '#9c1f18', detalj: '#ffb52e', felg: '#f2c94c', motor: 'kompressor', dekor: 'flammer' },
    { navn: 'Tordenskrall',  karosseri: '#2f6ed4', mork: '#1c4694', detalj: '#e8f2ff', felg: '#cfd8e3', motor: 'turbo',      dekor: 'lyn' },
    { navn: 'Sumpmonsteret', karosseri: '#4a8f36', mork: '#2f5f22', detalj: '#c8e06a', felg: '#8a8f6a', motor: 'v8',         dekor: 'klor' },
    { navn: 'Nattravnen',    karosseri: '#6b3fa0', mork: '#42256a', detalj: '#d9c7f5', felg: '#b9a6d8', motor: 'rakett',     dekor: 'stjerner' },
    { navn: 'Frostbiten',    karosseri: '#4fb8d8', mork: '#2b7e9c', detalj: '#ffffff', felg: '#dff3fa', motor: 'elektrisk',  dekor: 'striper' },
    { navn: 'Beinknuseren',  karosseri: '#e07820', mork: '#a44f0c', detalj: '#fff4e0', felg: '#e8d5b0', motor: 'dobbel',     dekor: 'tenner' },
    { navn: 'Gullgraveren',  karosseri: '#e8b91e', mork: '#a67d08', detalj: '#e0560f', felg: '#f5e2a0', motor: 'v8',         dekor: 'flammer' },
    { navn: 'Skyggeulven',   karosseri: '#5a6068', mork: '#33383e', detalj: '#9aa3ad', felg: '#7d858f', motor: 'turbo',      dekor: 'klor' }
  ];

  var GLASS = '#8fd0e8';

  // Motoren er metall, ikke karosseri. Første forsøk tegnet den i truckens
  // egen mørke farge, og da leste den som en pipe som vokste ut av panseret
  // i stedet for som en maskin som står oppi det.
  var METALL = '#3a4048';
  var METALL_MORK = '#282d34';

  /* ---------- hjul ---------- */

  // Mønsteret i dekket er en stiplet sirkel med tykk strek. Tolv separate
  // klosser ville gitt tolv elementer per hjul uten å se stort bedre ut.
  function hjul(cx, cy, felg) {
    var g = '<g>';
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="60" fill="#23262b"/>';
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="52" fill="none" stroke="#15171a" stroke-width="15" stroke-dasharray="13 12"/>';
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="41" fill="#2e3237"/>';
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="27" fill="' + felg + '"/>';
    for (var i = 0; i < 5; i++) {
      var v = (i * 72) * Math.PI / 180;
      g += '<line x1="' + (cx + Math.cos(v) * 9).toFixed(1) + '" y1="' + (cy + Math.sin(v) * 9).toFixed(1) +
           '" x2="' + (cx + Math.cos(v) * 24).toFixed(1) + '" y2="' + (cy + Math.sin(v) * 24).toFixed(1) +
           '" stroke="#2e3237" stroke-width="6" stroke-linecap="round"/>';
    }
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="#2e3237"/>';
    return g + '</g>';
  }

  /* ---------- motor ---------- */

  // Alle motorene stikker ned under panserlinja (y=82), slik at de sitter i
  // trucken i stedet for å sveve over den.
  function motor(type, t) {
    switch (type) {
      case 'kompressor':
        return '<rect x="74" y="58" width="52" height="30" rx="5" fill="' + METALL + '"/>' +
               '<rect x="70" y="50" width="60" height="12" rx="4" fill="' + METALL_MORK + '"/>' +
               '<path d="M80 50 l8 -16 h24 l8 16 z" fill="' + t.detalj + '"/>' +
               '<rect x="70" y="66" width="6" height="20" rx="3" fill="' + METALL_MORK + '"/>' +
               '<rect x="124" y="66" width="6" height="20" rx="3" fill="' + METALL_MORK + '"/>';
      case 'turbo':
        return '<path d="M114 78 q24 -14 28 6" stroke="' + METALL + '" stroke-width="11" fill="none" stroke-linecap="round"/>' +
               '<circle cx="98" cy="72" r="21" fill="' + METALL + '"/>' +
               '<circle cx="98" cy="72" r="11" fill="' + METALL_MORK + '"/>' +
               '<circle cx="98" cy="72" r="4" fill="' + t.detalj + '"/>';
      case 'v8':
        var s = '<rect x="68" y="66" width="66" height="22" rx="5" fill="' + METALL + '"/>';
        for (var i = 0; i < 8; i++) {
          s += '<rect x="' + (72 + i * 8) + '" y="' + (44 + (i % 2) * 6) + '" width="6" height="28" rx="3" fill="' + t.detalj + '"/>';
        }
        return s;
      case 'rakett':
        return '<rect x="286" y="54" width="58" height="30" rx="10" fill="' + METALL + '"/>' +
               '<rect x="294" y="60" width="30" height="7" rx="3" fill="' + t.detalj + '"/>' +
               // Dysa må være i det lyse metallet: bakenfor karosseriet er det
               // bare mørk bakgrunn, og den mørke tonen forsvant helt i den.
               '<path d="M344 56 l15 13 l-15 13 z" fill="' + METALL + '"/>' +
               '<path d="M359 69 l21 -9 l-6 9 l6 9 z" fill="#ffb52e"/>';
      case 'elektrisk':
        return '<rect x="74" y="56" width="54" height="32" rx="6" fill="' + METALL + '"/>' +
               '<rect x="82" y="48" width="11" height="10" rx="3" fill="' + METALL_MORK + '"/>' +
               '<rect x="110" y="48" width="11" height="10" rx="3" fill="' + METALL_MORK + '"/>' +
               '<path d="M104 60 l-14 16 h10 l-4 12 l16 -18 h-10 z" fill="' + t.detalj + '"/>';
      case 'dobbel':
        return '<rect x="68" y="64" width="66" height="24" rx="5" fill="' + METALL + '"/>' +
               '<path d="M72 64 l7 -20 h24 l7 20 z" fill="' + t.detalj + '"/>' +
               '<path d="M106 64 l5 -14 h18 l5 14 z" fill="' + t.detalj + '"/>';
    }
    return '';
  }

  /* ---------- dekor ---------- */

  // All dekor holder seg i båndet mellom y=86 og y=120. Det er den eneste
  // stripa som er rent karosseri hele veien fra front til bak — over den
  // ligger førerhuset, og et lyn tvers over vinduet ser ut som en feil.
  function dekor(type, t) {
    var i, s;
    switch (type) {
      case 'flammer':
        return '<path d="M52 120 C94 120 106 100 142 95 C131 103 129 110 136 114 ' +
               'C159 107 173 91 208 87 C196 97 194 104 201 110 C224 101 240 87 274 85 ' +
               'C258 95 254 104 262 112 C280 107 292 103 308 103 L308 120 Z" ' +
               'fill="' + t.detalj + '"/>';
      case 'lyn':
        return '<path d="M212 86 l-20 19 h12 l-8 15 l24 -21 h-13 z" fill="' + t.detalj + '"/>' +
               '<path d="M310 90 l-14 14 h9 l-6 12 l18 -17 h-10 z" fill="' + t.detalj + '" opacity="0.75"/>';
      case 'klor':
        s = '<g fill="' + t.detalj + '">';
        for (i = 0; i < 3; i++) {
          var x = 286 + i * 19;
          s += '<path d="M' + x + ' 86 q10 16 5 33 l-9 -3 q4 -15 -4 -28 z"/>';
        }
        return s + '</g>';
      case 'stjerner':
        s = '';
        [[102, 101], [178, 93], [232, 110], [288, 93], [324, 108], [142, 112]].forEach(function (p, k) {
          s += stjerne(p[0], p[1], k % 2 ? 5 : 7, t.detalj);
        });
        return s;
      case 'striper':
        return '<rect x="60" y="94" width="290" height="9" fill="' + t.detalj + '"/>' +
               '<rect x="60" y="108" width="290" height="5" fill="' + t.detalj + '" opacity="0.6"/>';
      case 'tenner':
        s = '<g fill="' + t.detalj + '">';
        for (i = 0; i < 7; i++) {
          s += '<path d="M' + (56 + i * 15) + ' 88 l14 0 l-7 22 z"/>';
        }
        return s + '</g>';
    }
    return '';
  }

  function stjerne(cx, cy, r, farge) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r;
      var v = (i * 36 - 90) * Math.PI / 180;
      d += (i ? 'L' : 'M') + (cx + Math.cos(v) * rr).toFixed(1) + ' ' + (cy + Math.sin(v) * rr).toFixed(1);
    }
    return '<path d="' + d + 'Z" fill="' + farge + '"/>';
  }

  /* ---------- hele trucken ---------- */

  function tegn(indeks, valg) {
    var t = trucker[indeks % trucker.length];
    valg = valg || {};

    // Silhuetten er den samme tegningen med alt i én farge. Da kan barnet se
    // omrisset av det som kommer, uten å se hvilken truck det er.
    if (valg.silhuett) {
      t = { navn: t.navn, karosseri: '#31353b', mork: '#31353b', detalj: '#31353b',
            felg: '#31353b', motor: t.motor, dekor: 'ingen' };
    }

    var s = '';

    // Aksel og støtdempere først – de skal ligge bak alt annet. Akselen er
    // lys nok til å skille seg fra bakgrunnen: er den mørk, ser hjulene ut
    // som to løse ringer under en truck som svever.
    s += '<rect x="96" y="188" width="208" height="13" rx="6" fill="' + METALL + '"/>';
    s += '<circle cx="200" cy="194" r="17" fill="' + METALL + '"/>';
    s += '<circle cx="200" cy="194" r="8" fill="' + METALL_MORK + '"/>';
    [[78, 96], [140, 118], [262, 284], [322, 304]].forEach(function (p) {
      s += '<line x1="' + p[0] + '" y1="126" x2="' + p[1] + '" y2="192" stroke="' + METALL + '" stroke-width="10" stroke-linecap="round"/>';
    });

    // Ramme
    s += '<rect x="46" y="122" width="312" height="16" rx="6" fill="#1b1d21"/>';

    // Karosseri: panser, førerhus og plan i ett stykke
    s += '<path d="M46 118 L46 88 Q46 82 52 82 L142 82 L166 40 Q169 34 176 34 L252 34 Q259 34 261 40 L272 82 L352 82 Q358 82 358 88 L358 118 Q358 126 350 126 L54 126 Q46 126 46 118 Z" ' +
         'fill="' + t.karosseri + '"/>';

    // Skyggekant nederst gir formen dybde uten en eneste gradient.
    s += '<path d="M46 112 L358 112 L358 118 Q358 126 350 126 L54 126 Q46 126 46 118 Z" fill="' + t.mork + '" opacity="0.55"/>';

    // Vinduer
    if (!valg.silhuett) {
      s += '<path d="M178 44 L246 44 Q251 44 253 49 L262 76 L172 76 L174 49 Q175 44 178 44 Z" fill="' + GLASS + '" opacity="0.9"/>';
      s += '<rect x="210" y="44" width="6" height="32" fill="' + t.mork + '" opacity="0.8"/>';
      // Lyktebro på taket
      s += '<rect x="180" y="26" width="66" height="9" rx="4" fill="#1b1d21"/>';
      for (var i = 0; i < 4; i++) {
        s += '<circle cx="' + (192 + i * 16) + '" cy="26" r="6" fill="#ffe9a8"/>';
      }
    }

    s += dekor(t.dekor, t);
    s += motor(t.motor, t);

    if (!valg.silhuett) {
      // Frontlykt og støtfanger
      s += '<rect x="40" y="96" width="12" height="18" rx="4" fill="#ffe9a8"/>';
      s += '<rect x="34" y="118" width="26" height="10" rx="4" fill="#4a4f57"/>';
    }

    s += hjul(96, 196, t.felg);
    s += hjul(304, 196, t.felg);

    return s;
  }

  window.LeseTrucker = {
    liste: trucker,
    antall: trucker.length,
    navn: function (i) { return trucker[i % trucker.length].navn; },
    farge: function (i) { return trucker[i % trucker.length].karosseri; },
    tegn: tegn,
    VISNING: '0 0 400 260'
  };
})();
