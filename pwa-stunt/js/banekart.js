/*
 * Høydeprofilen på banekortet.
 *
 * Kortet i banevelgeren skal kunne svare på «hvordan ser den ut?» uten at
 * barnet må kjøre den først. Profilen tegnes derfor fra løypas egne punkter,
 * ikke fra en håndtegnet miniatyr: en ny bane får kartet sitt gratis, og det
 * kan ikke bli uenig med det man faktisk kjører.
 *
 * Det er en *profil*, ikke et kart. Løypa går bare framover, så hele banen er
 * en kurve fra venstre til høyre – og da er en silhuett med looper og ramper
 * markert oppå den alt som trengs for å se forskjell på fem baner.
 */
'use strict';

var Banekart = (function () {

  var BREDDE = 300;
  var HOYDE = 74;
  var KANT = 11;        // luft over og under profilen, til merkene

  /*
   * Profilen samples grovt. Løypa har flere tusen punkter, og et kort på en
   * telefon er 300 piksler bredt – hvert sjette punkt gir en kurve som er
   * jevn nok, og en SVG-streng som ikke er en kilobyte lang.
   */
  var STEG = 6;

  function lag(lope) {
    var p = lope.punkter, g = [], i;
    for (i = 0; i < p.length; i += STEG) if (p[i].bakke) g.push(p[i]);
    if (p[p.length - 1].bakke) g.push(p[p.length - 1]);

    var x1 = g[g.length - 1].x || 1;
    var hoy = Infinity, lav = -Infinity;
    for (i = 0; i < g.length; i++) {
      if (g[i].y < hoy) hoy = g[i].y;
      if (g[i].y > lav) lav = g[i].y;
    }
    // En helt flat bane ville gitt deling på null her.
    var spenn = Math.max(1, lav - hoy);

    /*
     * Høyden overdrives, men med tak. Strekkes høydespennet ut til hele
     * kortet, blir en bane som er 24 000 enheter lang og 600 høy til et
     * seismogram: hver eneste kul står som et fjell, og de fem banene ser
     * like ut fordi alle er fulle av pigger. Taket på fem ganger den ekte
     * målestokken holder profilen til noe som ligner terrenget.
     */
    var skala = Math.min((HOYDE - KANT * 2) / spenn, 5 * BREDDE / x1);
    var midt = (HOYDE - spenn * skala) / 2;

    function px(x) { return x / x1 * BREDDE; }
    function py(y) { return midt + (y - hoy) * skala; }

    // Bakkehøyden ved en x, til å henge merkene på.
    function ved(x) {
      for (var k = 1; k < g.length; k++) {
        if (g[k].x >= x) {
          var t = (x - g[k - 1].x) / Math.max(1, g[k].x - g[k - 1].x);
          return py(g[k - 1].y + (g[k].y - g[k - 1].y) * t);
        }
      }
      return py(g[g.length - 1].y);
    }

    return { g: g, px: px, py: py, ved: ved };
  }

  /*
   * `merke` må være unik per kort. To SVG-er på samme side med samme
   * gradient-id gir den *første* definisjonen til begge, så alle fem kortene
   * ville fått fargen til Stuntløypa.
   */
  function svg(lope, farge, merke) {
    var k = lag(lope), p = lope.punkter, i;

    var linje = '';
    for (i = 0; i < k.g.length; i++) {
      linje += (i ? 'L' : 'M') + k.px(k.g[i].x).toFixed(1) + ' ' + k.py(k.g[i].y).toFixed(1) + ' ';
    }

    var merker = '';

    // Loopene som ringer. De tegnes i banens egen farge, så kortet leser som
    // én ting og ikke som et diagram med forklaring.
    for (i = 0; i < lope.looper.length; i++) {
      var lx = Lope.ved(lope, (lope.looper[i].fra + lope.looper[i].til) / 2).x;
      merker += '<circle cx="' + k.px(lx).toFixed(1) + '" cy="' + (k.ved(lx) - 7).toFixed(1) +
                '" r="4" fill="none" stroke="' + farge + '" stroke-width="2"/>';
    }

    // Rampene som trekanter som peker samme vei som hoppet.
    for (i = 0; i < p.length; i++) {
      if (!p[i].hopp) continue;
      var hx = k.px(p[i].x), hy = k.ved(p[i].x) - 4;
      merker += '<path d="M' + (hx - 4).toFixed(1) + ' ' + hy.toFixed(1) +
                'L' + (hx + 4).toFixed(1) + ' ' + hy.toFixed(1) +
                'L' + (hx + 4).toFixed(1) + ' ' + (hy - 7).toFixed(1) +
                'Z" fill="' + farge + '"/>';
    }

    return '<svg class="banekart" viewBox="0 0 ' + BREDDE + ' ' + HOYDE +
           '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="bk' + merke + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + farge + '" stop-opacity="0.55"/>' +
        '<stop offset="1" stop-color="' + farge + '" stop-opacity="0.04"/>' +
      '</linearGradient></defs>' +
      '<path d="' + linje + 'L' + BREDDE + ' ' + HOYDE + ' L0 ' + HOYDE +
        ' Z" fill="url(#bk' + merke + ')"/>' +
      '<path d="' + linje + '" fill="none" stroke="' + farge +
        '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      merker +
    '</svg>';
  }

  return { svg: svg };
})();
