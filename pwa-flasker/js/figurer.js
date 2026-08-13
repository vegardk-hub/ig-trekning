/*
 * Figurene som skal fylles – én per nivå, på rundgang.
 *
 * Hver figur er ett omriss som både tegnes og brukes som clipPath for væsken.
 * Omrisset kan bestå av flere delstier: en kanin er kropp + hode + to ører,
 * lagt oppå hverandre i samme `d`. Det er langt enklere enn å føre pennen
 * rundt hele silhuetten i én strek, og fyllregelen slår dem sammen for oss.
 *
 * Skal du legge til en figur, trenger du bare:
 *   b, h      – viewBox
 *   omriss    – silhuetten
 *   fyll      – [toppY, bunnY] for væsken
 *   apning    – [x, y] der flaskene helles nedi
 * Resten har fornuftige standardverdier, og strømmene under feiringen
 * regnes ut fra apningen, så de slipper å tegnes for hånd.
 */
'use strict';

var Figurer = (function () {

  // Ellipse som sti, så den kan inngå i et omriss sammen med andre former.
  function ell(cx, cy, rx, ry) {
    return 'M' + (cx - rx) + ' ' + cy +
      ' a' + rx + ' ' + ry + ' 0 1 0 ' + (2 * rx) + ' 0' +
      ' a' + rx + ' ' + ry + ' 0 1 0 ' + (-2 * rx) + ' 0 Z';
  }

  var LISTE = [
    {
      navn: 'vulkanen', kort: 'Vulkan', tegn: '🌋',
      b: 320, h: 215,
      omriss: 'M118 24 C106 70 80 130 20 190 L300 190 C240 130 214 70 202 24 Z',
      fyll: [32, 184], apning: [160, 24], munn: [42, 9],
      under: '<ellipse class="figurskygge" cx="160" cy="204" rx="152" ry="9"/>' +
             '<rect class="figurfot" x="8" y="184" width="304" height="20" rx="9"/>',
      blank: 'M48 182 C100 128 116 74 124 32 L136 32 C128 76 112 130 62 184 Z'
    },
    {
      navn: 'raketten', kort: 'Rakett', tegn: '🚀',
      b: 320, h: 250,
      omriss: 'M160 14 C134 54 110 88 110 118 L110 196 L62 234 L62 242 ' +
              'L110 232 L110 242 L210 242 L210 232 L258 242 L258 234 ' +
              'L210 196 L210 118 C210 88 186 54 160 14 Z',
      fyll: [22, 240], apning: [160, 16], munn: [22, 7],
      under: '<ellipse class="figurskygge" cx="160" cy="246" rx="120" ry="8"/>',
      detaljer: '<circle class="detalj-mork" cx="160" cy="132" r="28"/>' +
                '<path class="detalj-lys" d="M138 176 L182 176 L182 186 L138 186 Z"/>'
    },
    {
      // Intetkjønn: «huset er fullt», ikke «full». Eneste av figurene så langt.
      navn: 'huset', kort: 'Hus', tegn: '🏠', intetkjonn: true,
      b: 320, h: 250,
      omriss: 'M160 22 L96 70 L96 34 L68 34 L68 91 L38 114 L38 232 ' +
              'L282 232 L282 114 Z',
      fyll: [30, 232], apning: [82, 34], munn: [16, 6],
      under: '<ellipse class="figurskygge" cx="160" cy="240" rx="136" ry="8"/>',
      detaljer: '<rect class="detalj-mork" x="140" y="164" width="44" height="68" rx="9"/>' +
                '<rect class="detalj-lys" x="66" y="146" width="44" height="40" rx="7"/>' +
                '<rect class="detalj-lys" x="214" y="146" width="44" height="40" rx="7"/>'
    },
    {
      navn: 'bilen', kort: 'Bil', tegn: '🚗',
      b: 320, h: 230,
      omriss: 'M34 190 L34 134 C34 124 42 118 54 116 L92 112 L124 72 ' +
              'C130 64 138 60 148 60 L208 60 C218 60 226 64 232 72 L260 112 ' +
              'L290 118 C300 120 304 128 304 138 L304 190 Z' +
              ell(90, 192, 30, 30) + ell(232, 192, 30, 30),
      fyll: [60, 222], apning: [168, 60], munn: [24, 7],
      under: '<ellipse class="figurskygge" cx="160" cy="226" rx="140" ry="8"/>',
      detaljer: '<path class="detalj-lys" d="M132 78 L154 78 L154 110 L106 110 Z"/>' +
                '<path class="detalj-lys" d="M166 78 L204 78 L228 110 L166 110 Z"/>' +
                '<circle class="detalj-mork" cx="90" cy="192" r="11"/>' +
                '<circle class="detalj-mork" cx="232" cy="192" r="11"/>'
    },
    {
      navn: 'kaninen', kort: 'Kanin', tegn: '🐰',
      b: 320, h: 250,
      omriss: ell(160, 172, 78, 62) + ell(160, 98, 54, 48) +
              ell(132, 44, 16, 40) + ell(188, 44, 16, 40),
      fyll: [4, 234], apning: [160, 52], munn: [18, 6],
      under: '<ellipse class="figurskygge" cx="160" cy="240" rx="92" ry="8"/>',
      detaljer: '<circle class="detalj-mork" cx="140" cy="96" r="7"/>' +
                '<circle class="detalj-mork" cx="180" cy="96" r="7"/>' +
                '<ellipse class="detalj-mork" cx="160" cy="118" rx="9" ry="6"/>'
    },
    {
      navn: 'bjørnen', kort: 'Bjørn', tegn: '🐻',
      b: 320, h: 250,
      omriss: ell(160, 176, 82, 58) + ell(160, 98, 58, 52) +
              ell(114, 52, 23, 23) + ell(206, 52, 23, 23),
      fyll: [28, 236], apning: [160, 46], munn: [20, 6],
      under: '<ellipse class="figurskygge" cx="160" cy="240" rx="96" ry="8"/>',
      detaljer: '<circle class="detalj-mork" cx="138" cy="92" r="7"/>' +
                '<circle class="detalj-mork" cx="182" cy="92" r="7"/>' +
                '<ellipse class="detalj-lys" cx="160" cy="122" rx="26" ry="19"/>' +
                '<ellipse class="detalj-mork" cx="160" cy="114" rx="10" ry="7"/>'
    }
  ];

  function forNivaa(n) {
    return LISTE[((n - 1) % LISTE.length + LISTE.length) % LISTE.length];
  }

  // Strømmene som renner nedover figuren under feiringen vifter ut fra
  // apningen. De regnes ut i stedet for å tegnes, så en ny figur ikke krever
  // seks nye stier – og litt utenfor silhuetten gjør ingenting, det leser
  // like godt som noe som renner over.
  function stromer(f) {
    var ut = [];
    var ax = f.apning[0], ay = f.apning[1];
    var fall = f.fyll[1] - ay;
    var slutt = ay + fall * 1.04;
    for (var i = 0; i < 6; i++) {
      var t = (i / 5) * 2 - 1;                 // -1 .. 1
      // Enden holdes innenfor figuren. Sitter apningen ute på siden – pipa på
      // huset – ville en vifte sentrert på den sendt halve lavaen ut i lufta
      // til venstre for veggen.
      var mot = f.b * (0.5 + t * 0.42);
      var dx = mot - ax;
      ut.push('M' + (ax + dx * 0.06).toFixed(0) + ' ' + (ay + 4) +
        ' C' + (ax + dx * 0.28).toFixed(0) + ' ' + (ay + fall * 0.34).toFixed(0) +
        ' ' + (ax + dx * 0.70).toFixed(0) + ' ' + (ay + fall * 0.70).toFixed(0) +
        ' ' + mot.toFixed(0) + ' ' + slutt.toFixed(0));
    }
    return ut;
  }

  function stor(navn) {
    return navn.charAt(0).toUpperCase() + navn.slice(1);
  }

  return { LISTE: LISTE, forNivaa: forNivaa, stromer: stromer, stor: stor };
})();
