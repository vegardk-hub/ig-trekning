/*
 * Scenen som SVG.
 *
 * Alt tegnes i ett rutenett på 100 enheter per rute, med en marg rundt til
 * bokstavene og tallene. Stilen ligger i en `<style>` inne i selve SVG-en og
 * ikke i `styles.css`: bildet skal kunne stå alene – i utskriften, i et
 * forhåndsvisningsvindu, i en fil noen lagrer – uten å miste konturene som
 * er det eneste som holder det lesbart i svart-hvitt.
 *
 * To valg som ser ut som detaljer:
 *
 * - **Bokstavene og tallene står på alle fire sider.** Et blikk som skal
 *   følge rad 8 tvers over ti ruter, sklir. Med tallet gjentatt til høyre
 *   kan barnet sikte fra begge kanter, og det halverer bomturene.
 * - **Veien tegnes to ganger** – først et bredt bånd i konturfargen, så et
 *   smalere bånd i veifargen oppå. Unionen av de brede båndene blir konturen
 *   rundt hele veien, uten at noen må regne ut hvor hjørnene møtes.
 */
'use strict';

var Tegn = (function () {

  var R = 100;    // ruteside
  var M = 62;     // marg til bokstaver og tall
  var STREK = '#2b3440';

  var STIL =
    '<style>' +
    '.tegn *{stroke:' + STREK + ';stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}' +
    '.tegn .u{stroke:none}' +
    '.grunn{stroke:none}' +
    '.rute{fill:none;stroke:' + STREK + ';stroke-width:1.8;opacity:.55}' +
    '.ramme{fill:none;stroke:' + STREK + ';stroke-width:3.4}' +
    '.merke{font:700 46px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'fill:' + STREK + ';text-anchor:middle;dominant-baseline:middle}' +
    '</style>';

  function px(x) { return M + x * R; }

  function grunnlag(scene) {
    var ut = '<g class="grunn">';
    for (var y = 0; y < scene.hoyde; y++)
      for (var x = 0; x < scene.bredde; x++) {
        var navn = scene.grunn[y][x];
        ut += '<rect x="' + px(x) + '" y="' + px(y) + '" width="' + R + '" height="' + R +
          '" fill="' + Brikker.GRUNN[navn] + '"/>';
        var m = Brikker.grunnmonster(navn);
        if (m) ut += '<g transform="translate(' + px(x) + ',' + px(y) + ')">' + m + '</g>';
      }
    return ut + '</g>';
  }

  /* Ett bånd per veirute, med armer ut mot hver nabo som også er vei. Båndet
     stopper i rammen: lot vi det løpe ut i margen, la det seg over radtallene,
     og de er halve poenget med arket. */
  function band(scene, kant, farge) {
    var b = R - 2 * kant;
    var ut = '';
    function v(x, y) {
      return x >= 0 && x < scene.bredde && y >= 0 && y < scene.hoyde && scene.vei[y][x];
    }
    for (var y = 0; y < scene.hoyde; y++)
      for (var x = 0; x < scene.bredde; x++) {
        if (!scene.vei[y][x]) continue;
        var X = px(x), Y = px(y);
        ut += '<rect x="' + (X + kant) + '" y="' + (Y + kant) + '" width="' + b + '" height="' + b + '" fill="' + farge + '"/>';
        if (v(x, y - 1)) ut += '<rect x="' + (X + kant) + '" y="' + Y + '" width="' + b + '" height="' + (R / 2) + '" fill="' + farge + '"/>';
        if (v(x, y + 1)) ut += '<rect x="' + (X + kant) + '" y="' + (Y + R / 2) + '" width="' + b + '" height="' + (R / 2) + '" fill="' + farge + '"/>';
        if (v(x - 1, y)) ut += '<rect x="' + X + '" y="' + (Y + kant) + '" width="' + (R / 2) + '" height="' + b + '" fill="' + farge + '"/>';
        if (v(x + 1, y)) ut += '<rect x="' + (X + R / 2) + '" y="' + (Y + kant) + '" width="' + (R / 2) + '" height="' + b + '" fill="' + farge + '"/>';
        /* Hjørnene. Der fire veiruter møtes, dekker verken armene eller
           midtfeltet den lille firkanten ytterst i hver av dem, og resultatet
           er et hull i asfalten på størrelse med et frimerke. Fylles bare når
           begge naboene og diagonalen er vei – ellers ville en vei som svinger
           fått fylt hjørnet på utsiden av svingen. */
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (d) {
          if (!v(x + d[0], y) || !v(x, y + d[1]) || !v(x + d[0], y + d[1])) return;
          ut += '<rect x="' + (X + (d[0] > 0 ? R / 2 : 0)) + '" y="' + (Y + (d[1] > 0 ? R / 2 : 0)) +
            '" width="' + (R / 2) + '" height="' + (R / 2) + '" fill="' + farge + '"/>';
        });
      }
    return ut;
  }

  function gjerder(scene) {
    var ut = '';
    scene.soner.forEach(function (s) {
      var x = px(s.x) + 7, y = px(s.y) + 7, w = s.w * R - 14, h = s.h * R - 14;
      ut += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
        '" rx="10" fill="none" stroke="' + scene.gjerde + '" stroke-width="6"/>';
      // Stolper i hjørnene, så gjerdet leses som et gjerde og ikke som en ramme.
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(function (h2) {
        ut += '<circle cx="' + h2[0] + '" cy="' + h2[1] + '" r="7" fill="' + scene.gjerde +
          '" stroke="' + STREK + '" stroke-width="2"/>';
      });
    });
    return ut;
  }

  function brikke(x, y, id) {
    return '<g class="tegn" transform="translate(' + px(x) + ',' + px(y) + ')">' +
      Brikker.tegn(id) + '</g>';
  }

  function rutenett(scene) {
    var ut = '<g>';
    var b = scene.bredde * R, h = scene.hoyde * R;
    for (var i = 1; i < scene.bredde; i++)
      ut += '<line class="rute" x1="' + px(i) + '" y1="' + M + '" x2="' + px(i) + '" y2="' + (M + h) + '"/>';
    for (var j = 1; j < scene.hoyde; j++)
      ut += '<line class="rute" x1="' + M + '" y1="' + px(j) + '" x2="' + (M + b) + '" y2="' + px(j) + '"/>';
    ut += '<rect class="ramme" x="' + M + '" y="' + M + '" width="' + b + '" height="' + h + '"/>';
    return ut + '</g>';
  }

  function merker(scene) {
    var ut = '<g class="merke">';
    var b = scene.bredde * R, h = scene.hoyde * R;
    for (var x = 0; x < scene.bredde; x++) {
      var bok = Scene.BOKSTAVER.charAt(x), cx = px(x) + R / 2;
      ut += '<text x="' + cx + '" y="' + (M / 2) + '">' + bok + '</text>';
      ut += '<text x="' + cx + '" y="' + (M + h + M / 2) + '">' + bok + '</text>';
    }
    for (var y = 0; y < scene.hoyde; y++) {
      var tall = y + 1, cy = px(y) + R / 2;
      ut += '<text x="' + (M / 2) + '" y="' + cy + '">' + tall + '</text>';
      ut += '<text x="' + (M + b + M / 2) + '" y="' + cy + '">' + tall + '</text>';
    }
    return ut + '</g>';
  }

  function svg(scene) {
    var b = scene.bredde * R + 2 * M, h = scene.hoyde * R + 2 * M;
    var veifarge = Brikker.GRUNN[scene.veigrunn];
    var ut = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + b + ' ' + h +
      '" role="img" aria-label="Rutenett med ' + scene.navn.toLowerCase() + '">' + STIL;
    ut += '<rect x="0" y="0" width="' + b + '" height="' + h + '" fill="#ffffff"/>';
    ut += grunnlag(scene);
    ut += '<g class="grunn">' + band(scene, 11, STREK) + band(scene, 15, veifarge) + '</g>';
    ut += gjerder(scene);
    scene.kulisser.forEach(function (k) { ut += brikke(k.x, k.y, k.brikke); });
    scene.funn.forEach(function (f) { ut += brikke(f.x, f.y, f.brikke); });
    ut += rutenett(scene);
    ut += merker(scene);
    return ut + '</svg>';
  }

  return { svg: svg };
})();
