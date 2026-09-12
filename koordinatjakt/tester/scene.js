/*
 * Prøver for utleggingen, oppgavene og tegningen i Koordinatjakt.
 *
 * Kjøres uten nettleser og uten server:
 *
 *     node koordinatjakt/tester/scene.js
 *
 * Kravene her er de som gjør et ark brukbart. De fleste av dem er stille
 * feil: et brett med to løver ser helt riktig ut, og oppdages først når
 * barnet har skrevet «løve» i C4 og fasiten sier F8. Derfor kjøres alle tre
 * temaene gjennom flere hundre brett hver gang – en regel som holder for
 * brett 1 til 20, kan ryke på brett 137.
 */
'use strict';

var fs = require('fs');
var sti = require('path');

var HER = sti.join(__dirname, '..', 'js');

function les(navn) { return fs.readFileSync(sti.join(HER, navn + '.js'), 'utf8'); }
function last(navn, globalt, argnavn, argverdier) {
  return new Function(argnavn || '', les(navn) + '; return ' + globalt + ';')
    .apply(null, argverdier || []);
}

var Tilfeldig = last('tilfeldig', 'Tilfeldig');
var Brikker = last('brikker', 'Brikker');
var Temaer = last('temaer', 'Temaer');
var Scene = last('scene', 'Scene', 'Tilfeldig,Brikker,Temaer', [Tilfeldig, Brikker, Temaer]);
var Oppgaver = last('oppgaver', 'Oppgaver', 'Tilfeldig,Brikker', [Tilfeldig, Brikker]);
var Tegn = last('tegn', 'Tegn', 'Brikker,Scene', [Brikker, Scene]);

var feil = 0, gjort = 0;

function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }

var TEMAER = Temaer.IDER;
var BRETT = 300;

/* ------------------------------------------------------- determinisme */

bolk('Samme brettnummer gir samme brett');
TEMAER.forEach(function (t) {
  var a = JSON.stringify(Scene.lag(t, 42));
  var b = JSON.stringify(Scene.lag(t, 42));
  krev(a === b, t + ': brett 42 ble ulikt to ganger');
  krev(a !== JSON.stringify(Scene.lag(t, 43)), t + ': brett 42 og 43 ble like');
});
krev(JSON.stringify(Scene.lag('dyrehage', 7)) !== JSON.stringify(Scene.lag('by', 7)),
  'to temaer med samme brettnummer ga samme utlegging');

bolk('Antall oppgaver endrer ikke bildet');
var bilde8 = JSON.stringify(Scene.lag('dyrehage', 11));
Oppgaver.lag(Scene.lag('dyrehage', 11), 8);
Oppgaver.lag(Scene.lag('dyrehage', 11), 16);
krev(bilde8 === JSON.stringify(Scene.lag('dyrehage', 11)), 'scenen endret seg av oppgavevalget');

/* ------------------------------------------------------------ rutenavn */

bolk('Rutenavn: bokstav vannrett, rad 1 øverst');
krev(Scene.rutenavn(0, 0) === 'A1', 'øverst til venstre skal være A1', Scene.rutenavn(0, 0));
krev(Scene.rutenavn(9, 9) === 'J10', 'nederst til høyre skal være J10', Scene.rutenavn(9, 9));
krev(Scene.rutenavn(2, 3) === 'C4', 'tredje kolonne, fjerde rad skal være C4', Scene.rutenavn(2, 3));

/* -------------------------------------------------------- alle brettene */

bolk('Alle brett i alle temaer (' + (TEMAER.length * BRETT) + ' brett)');

var minstFunn = 99, mestFunn = 0, minstTomme = 100;

TEMAER.forEach(function (tema) {
  for (var n = 1; n <= BRETT; n++) {
    var sc = Scene.lag(tema, n);
    var merke = tema + ' brett ' + n;
    var brukt = {}, ord = {}, i, f;

    krev(sc.funn.length >= Scene.MIN_FUNN, merke + ': for få funn', sc.funn.length);
    minstFunn = Math.min(minstFunn, sc.funn.length);
    mestFunn = Math.max(mestFunn, sc.funn.length);

    for (i = 0; i < sc.funn.length; i++) {
      f = sc.funn[i];
      krev(Brikker.finnes(f.brikke), merke + ': ukjent brikke ' + f.brikke);
      krev(f.x >= 0 && f.x < sc.bredde && f.y >= 0 && f.y < sc.hoyde, merke + ': funn utenfor brettet');
      krev(!brukt[f.rute], merke + ': to funn i ' + f.rute);
      krev(!ord[f.ord], merke + ': ordet «' + f.ord + '» brukt to ganger');
      krev(!sc.vei[f.y][f.x], merke + ': funn står i veien i ' + f.rute);
      krev(f.rute === Scene.rutenavn(f.x, f.y), merke + ': rutenavnet stemmer ikke med koordinaten');
      brukt[f.rute] = true;
      ord[f.ord] = true;
    }

    for (i = 0; i < sc.kulisser.length; i++) {
      var k = sc.kulisser[i];
      var navn = Scene.rutenavn(k.x, k.y);
      krev(Brikker.finnes(k.brikke), merke + ': ukjent kulisse ' + k.brikke);
      krev(!brukt[navn], merke + ': kulisse oppå noe annet i ' + navn);
      krev(!sc.vei[k.y][k.x], merke + ': kulisse i veien i ' + navn);
      // Den stille feilen: «blomst» både som svar og som pynt gjør fasiten tvetydig.
      krev(!ord[Brikker.ord(k.brikke)], merke + ': «' + Brikker.ord(k.brikke) + '» er både svar og pynt');
      brukt[navn] = true;
    }

    // Veien må henge sammen fra venstre kant til høyre.
    krev(veiHengerSammen(sc), merke + ': veien går ikke fra venstre til høyre kant');

    // Hver sone må grense til veien, og soner må ikke overlappe.
    var sonekart = {};
    sc.soner.forEach(function (s, si) {
      var naerVei = false;
      for (var y = s.y; y < s.y + s.h; y++)
        for (var x = s.x; x < s.x + s.w; x++) {
          krev(sonekart[x + ',' + y] === undefined, merke + ': soner overlapper i ' + Scene.rutenavn(x, y));
          sonekart[x + ',' + y] = si;
          krev(!sc.vei[y][x], merke + ': sone lagt oppå veien');
          if (erVei(sc, x - 1, y) || erVei(sc, x + 1, y) || erVei(sc, x, y - 1) || erVei(sc, x, y + 1)) naerVei = true;
        }
      krev(naerVei, merke + ': sone ' + si + ' grenser ikke til veien');
    });

    /* Funnene må ligge spredt. En kvadrant uten svar er en fjerdedel av
       rutenettet barnet aldri får bruk for – og det var akkurat det som
       skjedde da alt hang på én vei. Målt gulv er 3; kravet står på 2 så en
       ufarlig justering ikke velter prøven. */
    var kvadranter = [0, 0, 0, 0];
    sc.funn.forEach(function (f2) {
      kvadranter[(f2.y < sc.hoyde / 2 ? 0 : 2) + (f2.x < sc.bredde / 2 ? 0 : 1)]++;
    });
    for (var kv = 0; kv < 4; kv++)
      krev(kvadranter[kv] >= 2, merke + ': for få funn i kvadrant ' + kv, kvadranter.join('/'));

    // Letingen må være ekte: nok ruter uten noe i det hele tatt.
    var tomme = 0;
    for (var y2 = 0; y2 < sc.hoyde; y2++)
      for (var x2 = 0; x2 < sc.bredde; x2++)
        if (!sc.vei[y2][x2] && !brukt[Scene.rutenavn(x2, y2)]) tomme++;
    krev(tomme >= 25, merke + ': for få tomme ruter', tomme);
    minstTomme = Math.min(minstTomme, tomme);
  }
});

console.log('  funn per brett: ' + minstFunn + '–' + mestFunn + ', færrest tomme ruter: ' + minstTomme);

function erVei(sc, x, y) {
  return x >= 0 && x < sc.bredde && y >= 0 && y < sc.hoyde && sc.vei[y][x];
}

function veiHengerSammen(sc) {
  var start = null;
  for (var y = 0; y < sc.hoyde; y++) if (sc.vei[y][0]) { start = { x: 0, y: y }; break; }
  if (!start) return false;
  var sett = {}, ko = [start], naadd = false;
  sett['0,' + start.y] = true;
  while (ko.length) {
    var c = ko.shift();
    if (c.x === sc.bredde - 1) naadd = true;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var nx = c.x + d[0], ny = c.y + d[1];
      if (!erVei(sc, nx, ny) || sett[nx + ',' + ny]) return;
      sett[nx + ',' + ny] = true;
      ko.push({ x: nx, y: ny });
    });
  }
  return naadd;
}

/* ------------------------------------------------------------ oppgaver */

bolk('Oppgavelista');
TEMAER.forEach(function (tema) {
  for (var n = 1; n <= 60; n++) {
    var sc = Scene.lag(tema, n);
    [8, 12, 16].forEach(function (antall) {
      var opp = Oppgaver.lag(sc, antall);
      var merke = tema + ' brett ' + n + ' med ' + antall + ' oppgaver';
      krev(opp.length === antall, merke + ': feil antall', opp.length);
      var sett = {};
      opp.forEach(function (o) {
        krev(!sett[o.rute], merke + ': ' + o.rute + ' spurt om to ganger');
        sett[o.rute] = true;
        var treff = sc.funn.filter(function (f) { return f.rute === o.rute; })[0];
        krev(treff && treff.ord === o.ord, merke + ': fasiten stemmer ikke i ' + o.rute);
        krev(/^[A-J](10|[1-9])$/.test(o.rute), merke + ': ugyldig rutenavn ' + o.rute);
      });
    });
  }
});

/* --------------------------------------------------------------- brikker */

bolk('Brikkene holder seg innenfor ruta');
Object.keys(Brikker.ALLE).forEach(function (id) {
  /* En brikke tegnes i sitt eget 0–100-rom og flyttes på plass av et
     `translate`. Stikker en koordinat utenfor, ser tingen ut til å høre til
     naborutas svar – og da er fasiten feil uten at noe klager. Slangens tunge
     lå på x=104 og pekte inn i ruta ved siden av. */
  var svg = Brikker.tegn(id).replace(/#[0-9a-fA-F]{3,8}/g, '');
  var tall = svg.match(/-?\d+(\.\d+)?/g) || [];
  var verst = 0;
  tall.forEach(function (t) {
    var n = parseFloat(t);
    if (n < -4 || n > 104) verst = n;
  });
  krev(verst === 0, id + ': koordinat utenfor ruta', verst);
  krev(Brikker.ord(id).length > 0, id + ': mangler ord');
});

/* -------------------------------------------------------------- tegning */

bolk('Tegningen');
TEMAER.forEach(function (tema) {
  var sc = Scene.lag(tema, 5);
  var s = Tegn.svg(sc);
  krev(s.indexOf('undefined') === -1, tema + ': «undefined» i SVG-en');
  krev(s.indexOf('NaN') === -1, tema + ': «NaN» i SVG-en');
  // Bokstavene og tallene står på alle fire sider – to av hver.
  Scene.BOKSTAVER.split('').forEach(function (b) {
    var antall = s.split('>' + b + '</text>').length - 1;
    krev(antall === 2, tema + ': bokstaven ' + b + ' står ikke på begge sider', antall);
  });
  for (var t = 1; t <= 10; t++) {
    var antT = s.split('>' + t + '</text>').length - 1;
    krev(antT === 2, tema + ': tallet ' + t + ' står ikke på begge sider', antT);
  }
  // Alle funn må faktisk være tegnet.
  sc.funn.forEach(function (f) {
    krev(s.indexOf(Brikker.tegn(f.brikke).slice(0, 40)) !== -1, tema + ': ' + f.ord + ' ble ikke tegnet');
  });
});

console.log('\n' + (feil ? feil + ' feil av ' + gjort + ' krav' : 'Alt i orden – ' + gjort + ' krav'));
process.exit(feil ? 1 : 0);
