/*
 * Kurvene: frekvensrespons og spektrum på logaritmisk akse, lydbølgen,
 * og nivåtrappen.
 *
 * Fargene leses fra CSS-variablene hver gang, så mørk modus følger med uten
 * at noe her vet om den. Lerretet skaleres med `devicePixelRatio`; ellers blir
 * strekene grøtete på en iPhone, der ett CSS-piksel er tre fysiske.
 */
'use strict';

var LydTegning = (function () {

  function farge(navn) {
    return getComputedStyle(document.documentElement).getPropertyValue(navn).trim() || '#888';
  }

  function forbered(lerret, hoyde) {
    var bredde = lerret.clientWidth || 320;
    var dpr = window.devicePixelRatio || 1;
    lerret.width = Math.round(bredde * dpr);
    lerret.height = Math.round(hoyde * dpr);
    lerret.style.height = hoyde + 'px';
    var g = lerret.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, bredde, hoyde);
    g.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
    return { g: g, b: bredde, h: hoyde };
  }

  function serieFarge(i) { return farge('--serie' + ((i % 4) + 1)); }

  var FREKV_MERKER = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  function hzKort(f) { return f >= 1000 ? (f / 1000) + 'k' : String(f); }

  /*
   * Kurver på logaritmisk frekvensakse.
   * serier: [{ f: [], db: [], navn }]
   * valg: { min, maks, hoyde, nullLinje, merk: [{ f, tekst }] }
   */
  function kurver(lerret, serier, valg) {
    valg = valg || {};
    var m = forbered(lerret, valg.hoyde || 220);
    var g = m.g;
    var v = 34, h = 8, o = 8, u = 20;
    var bredde = m.b - v - h, hoyde = m.h - o - u;
    var f0 = 20, f1 = 20000;
    var alle = [];
    serier.forEach(function (s) { s.db.forEach(function (d) { if (isFinite(d)) alle.push(d); }); });
    var maks = valg.maks !== undefined ? valg.maks : Math.ceil((Math.max.apply(null, alle.concat([-200])) + 3) / 10) * 10;
    var min = valg.min !== undefined ? valg.min : Math.max(maks - 80, Math.floor((Math.min.apply(null, alle.concat([0])) - 3) / 10) * 10);
    function x(f) { return v + bredde * Math.log(f / f0) / Math.log(f1 / f0); }
    function y(d) { return o + hoyde * (maks - Math.max(min, Math.min(maks, d))) / (maks - min); }

    g.strokeStyle = farge('--rutenett');
    g.fillStyle = farge('--dempet');
    g.lineWidth = 1;
    g.textAlign = 'center';
    FREKV_MERKER.forEach(function (f) {
      g.beginPath(); g.moveTo(x(f), o); g.lineTo(x(f), o + hoyde); g.stroke();
      g.fillText(hzKort(f), x(f), m.h - 5);
    });
    g.textAlign = 'right';
    var steg = (maks - min) > 50 ? 20 : 10;
    for (var d = Math.ceil(min / steg) * steg; d <= maks; d += steg) {
      g.beginPath(); g.moveTo(v, y(d)); g.lineTo(v + bredde, y(d)); g.stroke();
      g.fillText(String(d), v - 4, y(d) + 4);
    }
    if (valg.nullLinje) {
      g.strokeStyle = farge('--dempet');
      g.setLineDash([4, 4]);
      [0, -10].forEach(function (d) {
        if (d < min || d > maks) return;
        g.beginPath(); g.moveTo(v, y(d)); g.lineTo(v + bredde, y(d)); g.stroke();
      });
      g.setLineDash([]);
    }

    serier.forEach(function (s, i) {
      g.strokeStyle = s.farge || serieFarge(i);
      g.lineWidth = 2;
      g.beginPath();
      var startet = false;
      for (var k = 0; k < s.f.length; k++) {
        if (s.f[k] < f0 || s.f[k] > f1 || !isFinite(s.db[k])) { startet = false; continue; }
        if (!startet) { g.moveTo(x(s.f[k]), y(s.db[k])); startet = true; }
        else g.lineTo(x(s.f[k]), y(s.db[k]));
      }
      g.stroke();
    });

    (valg.merk || []).forEach(function (mk, i) {
      if (!mk.f) return;
      g.strokeStyle = mk.farge || farge('--aksent');
      g.fillStyle = mk.farge || farge('--aksent');
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x(mk.f), o); g.lineTo(x(mk.f), o + hoyde); g.stroke();
      g.textAlign = x(mk.f) > v + bredde - 60 ? 'right' : 'left';
      g.fillText(mk.tekst, x(mk.f) + (g.textAlign === 'right' ? -3 : 3), o + 12 + i * 13);
    });
  }

  // Lydbølgen som min/maks per pikselkolonne, kanalene oppå hverandre.
  function bolge(lerret, kanaler, fs, markorer) {
    var m = forbered(lerret, 90);
    var g = m.g, n = kanaler[0].length;
    var midt = m.h / 2;
    kanaler.forEach(function (k, c) {
      g.fillStyle = serieFarge(c);
      g.globalAlpha = kanaler.length > 1 ? 0.6 : 1;
      var per = n / m.b;
      for (var px = 0; px < m.b; px++) {
        var a = Math.floor(px * per), b = Math.min(n, Math.floor((px + 1) * per));
        var lo = 0, hi = 0;
        for (var i = a; i < b; i++) { if (k[i] < lo) lo = k[i]; if (k[i] > hi) hi = k[i]; }
        g.fillRect(px, midt - hi * midt, 1, Math.max(1, (hi - lo) * midt));
      }
    });
    g.globalAlpha = 1;
    (markorer || []).forEach(function (mk) {
      var px = mk.t * fs / n * m.b;
      g.strokeStyle = farge('--aksent');
      g.beginPath(); g.moveTo(px, 0); g.lineTo(px, m.h); g.stroke();
      g.fillStyle = farge('--aksent');
      g.fillText(mk.tekst, px + 3, 11);
    });
  }

  // Nivåtrappen: målt mot spilt nivå, med den ideelle 1:1-linja.
  function trapp(lerret, trinn) {
    var m = forbered(lerret, 180);
    var g = m.g;
    var v = 34, h = 8, o = 8, u = 22;
    var bredde = m.b - v - h, hoyde = m.h - o - u;
    var gyldige = trinn.filter(function (t) { return t.gyldig; });
    if (!gyldige.length) return;
    // Lås kurva til det nederste gyldige trinnet, så avviket synes oppover.
    var forskyv = gyldige[0].maalt - gyldige[0].dbfs;
    var xmin = -45, xmaks = -3;
    function x(d) { return v + bredde * (d - xmin) / (xmaks - xmin); }
    function y(d) { return o + hoyde * (xmaks - Math.max(xmin, Math.min(xmaks, d))) / (xmaks - xmin); }
    g.strokeStyle = farge('--rutenett'); g.fillStyle = farge('--dempet'); g.lineWidth = 1;
    for (var d = -42; d <= -6; d += 6) {
      g.beginPath(); g.moveTo(x(d), o); g.lineTo(x(d), o + hoyde); g.stroke();
      g.beginPath(); g.moveTo(v, y(d)); g.lineTo(v + bredde, y(d)); g.stroke();
      g.textAlign = 'center'; g.fillText(String(d), x(d), m.h - 6);
      g.textAlign = 'right'; g.fillText(String(d), v - 4, y(d) + 4);
    }
    g.strokeStyle = farge('--dempet'); g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(x(xmin), y(xmin)); g.lineTo(x(xmaks), y(xmaks)); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = serieFarge(0); g.fillStyle = serieFarge(0); g.lineWidth = 2;
    g.beginPath();
    gyldige.forEach(function (t, i) {
      var yy = y(t.maalt - forskyv);
      if (i) g.lineTo(x(t.dbfs), yy); else g.moveTo(x(t.dbfs), yy);
    });
    g.stroke();
    gyldige.forEach(function (t) {
      g.beginPath(); g.arc(x(t.dbfs), y(t.maalt - forskyv), 3.5, 0, 2 * Math.PI); g.fill();
    });
  }

  return { kurver: kurver, bolge: bolge, trapp: trapp, serieFarge: serieFarge };
})();
