/*
 * De ti brikkene, formen deres og alle lovlige orienteringer.
 *
 * Brettet er 5 x 10 ruter, og hver rute skal ende som X eller O i et
 * sjakkbrettmønster: en X rører aldri en X, en O rører aldri en O. Hver
 * brikke dekker fem ruter og bærer sine egne merker.
 *
 * Det avgjørende er at brikkene er *tosidige*, og at snuingen bytter X og O.
 * Det er ikke pynt – regnestykket går ikke opp uten. Teller man merkene slik
 * de ligger med forsiden opp, har de ti brikkene 29 X-er og 21 O-er, mens
 * brettet har 25 av hver. Baksiden er motsatt, og fire eller fem brikker må
 * ligge snudd i enhver løsning.
 *
 * Rotasjon og speiling bevarer paritet: to naboruter har motsatt paritet før
 * og etter. Derfor er merkene i en brikke alltid gitt av én bit – `polaritet`
 * – og merket i en celle er (r + k + polaritet) % 2, der 0 er X og 1 er O.
 *
 * Merk at `polaritet` bare gjelder koordinatene slik de står. En forskyvning
 * på et odde antall ruter snur den uten å røre et eneste merke, så den kan
 * ikke brukes til å svare på om en brikke ligger med forsiden eller baksiden
 * opp. Det spørsmålet har bare et svar på brettet.
 *
 * Konsekvensen for spillet: du kan ikke velge speiling og merking hver for
 * seg. De fire rotasjonene på forsiden har én polaritet, de fire på baksiden
 * den motsatte.
 */
'use strict';

var Brikker = (function () {

  var X = 0, O = 1;

  // Formene er lest av det fysiske spillet. Merkene står eksplisitt her, selv
  // om de kunne regnes ut av pariteten – listen skal kunne sammenlignes med
  // brikkene i esken uten å kjenne formelen.
  var RA = [
    { id: 'i',  navn: 'Stigen',     farge: '#2d5aa8', celler: [[0,0,X],[0,1,O],[0,2,X],[0,3,O],[0,4,X]] },
    { id: 'l',  navn: 'Vinkelen',   farge: '#a4bf3f', celler: [[0,0,X],[0,1,O],[0,2,X],[0,3,O],[1,3,X]] },
    { id: 'y',  navn: 'Kroken',     farge: '#d8433a', celler: [[0,0,X],[0,1,O],[0,2,X],[0,3,O],[1,2,O]] },
    { id: 'n',  navn: 'Trappa',     farge: '#d98fb5', celler: [[0,0,X],[0,1,O],[1,1,X],[1,2,O],[1,3,X]] },
    { id: 'v',  navn: 'Hjørnet',    farge: '#66bcd8', celler: [[0,0,X],[0,1,O],[0,2,X],[1,2,O],[2,2,X]] },
    { id: 's',  navn: 'Slangen',    farge: '#4b8f57', celler: [[0,0,X],[1,0,O],[1,1,X],[1,2,O],[2,2,X]] },
    { id: 't',  navn: 'Tverrsaget', farge: '#f0b429', celler: [[0,0,X],[1,0,O],[2,0,X],[1,1,X],[1,2,O]] },
    { id: 'p',  navn: 'Klossen',    farge: '#3f8fd8', celler: [[1,0,X],[1,1,O],[1,2,X],[0,2,O],[0,1,X]] },
    { id: 'w',  navn: 'Trappetrinn',farge: '#ef8034', celler: [[0,0,X],[0,1,O],[1,1,X],[1,2,O],[2,2,X]] },
    { id: 'u',  navn: 'Hesteskoen', farge: '#7b57b0', celler: [[0,0,X],[1,0,O],[1,1,X],[1,2,O],[0,2,X]] }
  ];

  var RAD = 5, KOL = 10;

  function normaliser(celler) {
    var mr = Infinity, mk = Infinity, i;
    for (i = 0; i < celler.length; i++) {
      if (celler[i][0] < mr) mr = celler[i][0];
      if (celler[i][1] < mk) mk = celler[i][1];
    }
    return celler.map(function (c) { return [c[0] - mr, c[1] - mk, c[2]]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  }

  // Polariteten er den ene biten som sier hvilken vei merkene ligger. Den må
  // leses ut etter normaliseringen, for en forskyvning med odde (dr+dk) snur
  // pariteten uten å røre merkene.
  function polaritet(celler) {
    return (celler[0][2] + celler[0][0] + celler[0][1]) % 2 === 0 ? 0 : 1;
  }

  function merkeI(r, k, pol) { return (r + k + pol) % 2; }

  function konsistent(celler) {
    var pol = polaritet(celler);
    return celler.every(function (c) { return merkeI(c[0], c[1], pol) === c[2]; });
  }

  // De åtte orienteringene. Speilvending er å snu brikka, så da bytter hvert
  // merke plass – det er der tosidigheten ligger.
  function orienteringer(celler) {
    var ut = [], sett = {}, speil, rot, c, n, nok;
    for (speil = 0; speil < 2; speil++) {
      c = celler.map(function (p) {
        return [p[0], speil ? -p[1] : p[1], speil ? 1 - p[2] : p[2]];
      });
      for (rot = 0; rot < 4; rot++) {
        c = c.map(function (p) { return [p[1], -p[0], p[2]]; });
        n = normaliser(c);
        nok = JSON.stringify(n);
        if (!sett[nok]) { sett[nok] = true; ut.push({ celler: n, snudd: speil, rotasjon: rot }); }
      }
    }
    return ut;
  }

  var brikker = RA.map(function (b, nr) {
    var celler = normaliser(b.celler);
    return {
      id: b.id,
      nr: nr + 1,
      navn: b.navn,
      farge: b.farge,
      celler: celler,
      polaritet: polaritet(celler),
      orienteringer: orienteringer(celler)
    };
  });

  // Alle plasseringer på brettet: orientering x forskyvning, filtrert på at
  // merkene faller der brettet krever dem. `farging` er 0 når rute (0,0) skal
  // være X. Begge fargingene er lovlige i det fysiske spillet – det er
  // brikkene som er lagt ut på forhånd som avgjør hvilken en oppgave bruker.
  function plasseringer(brikke, farging) {
    var ut = [];
    brikke.orienteringer.forEach(function (o, oi) {
      var hr = 0, hk = 0;
      o.celler.forEach(function (c) { if (c[0] > hr) hr = c[0]; if (c[1] > hk) hk = c[1]; });
      for (var dr = 0; dr + hr < RAD; dr++) {
        for (var dk = 0; dk + hk < KOL; dk++) {
          var ruter = [], ok = true;
          for (var i = 0; i < o.celler.length; i++) {
            var r = o.celler[i][0] + dr, k = o.celler[i][1] + dk;
            if ((r + k + farging) % 2 !== o.celler[i][2]) { ok = false; break; }
            ruter.push(r * KOL + k);
          }
          if (ok) ut.push({ orientering: oi, dr: dr, dk: dk, ruter: ruter });
        }
      }
    });
    return ut;
  }

  return {
    RAD: RAD,
    KOL: KOL,
    X: X,
    O: O,
    alle: brikker,
    ved: function (id) { return brikker.filter(function (b) { return b.id === id; })[0]; },
    normaliser: normaliser,
    polaritet: polaritet,
    merkeI: merkeI,
    konsistent: konsistent,
    orienteringer: orienteringer,
    plasseringer: plasseringer
  };
})();

if (typeof window !== 'undefined') window.Brikker = Brikker;
