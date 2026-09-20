/*
 * Prøver for brikkesettet og løseren.
 *
 * Kjøres uten nettleser og uten server:
 *
 *     node pwa-xoxo/tester/brikker.js
 *
 * Brikkesettet er lest av et fysisk spill, og det er den eneste antakelsen
 * hele appen hviler på. Går en form eller et merke feil, er oppgavebanken
 * ubrukelig – oppgavene er regnet ut fra settet, så de vil se riktige ut og
 * være uløselige med brikkene i esken. Derfor står kravene her, og derfor
 * står også tallet 68: det er nok til å oppdage at noe er endret, og det er
 * dyrt nok å regne ut for hånd til at ingen skriver det inn på slump.
 */
'use strict';

var fs = require('fs');
var sti = require('path');

var HER = sti.join(__dirname, '..', 'js');

function last(navn, argnavn, arg) {
  var kode = fs.readFileSync(sti.join(HER, navn + '.js'), 'utf8');
  var globalt = navn.charAt(0).toUpperCase() + navn.slice(1);
  return new Function(argnavn || 'x', kode + '; return ' + globalt + ';')(arg);
}

var Brikker = last('brikker');
var Loeser = last('loeser', 'Brikker', Brikker);

var feil = 0, gjort = 0;

function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}

function nokkel(celler) {
  return celler.map(function (c) { return c.join(','); }).join(' ');
}

console.log('Brikkesettet');

krev(Brikker.alle.length === 10, 'ti brikker', Brikker.alle.length);
krev(Brikker.RAD * Brikker.KOL === 50, 'brettet har femti ruter');

Brikker.alle.forEach(function (b) {
  krev(b.celler.length === 5, 'brikke ' + b.nr + ' har fem ruter', b.celler.length);
  krev(Brikker.konsistent(b.celler), 'brikke ' + b.nr + ' veksler mellom X og O');
  krev(/^#[0-9a-f]{6}$/.test(b.farge), 'brikke ' + b.nr + ' har en farge');
});

// Formene skal være forskjellige. To like brikker ville gitt en oppgavebank
// med oppgaver som ser entydige ut og har to løsninger.
var former = {};
Brikker.alle.forEach(function (b) {
  var n = nokkel(b.celler.map(function (c) { return [c[0], c[1]]; }));
  krev(!former[n], 'brikke ' + b.nr + ' har en form ingen annen har');
  former[n] = true;
});

console.log('Merkene og snuingen');

// Regnestykket som *krever* at snuingen bytter merkene: med forsiden opp har
// settet 29 kryss og 21 ringer, mens brettet trenger 25 av hver.
var kryss = 0;
Brikker.alle.forEach(function (b) {
  b.celler.forEach(function (c) { if (c[2] === Brikker.X) kryss++; });
});
krev(kryss === 29, 'settet har 29 kryss med forsiden opp', kryss);
krev(kryss !== 25, 'settet går ikke opp uten at snuing bytter merke');

Brikker.alle.forEach(function (b) {
  var snudd = Brikker.normaliser(b.celler.map(function (c) { return [c[0], -c[1], 1 - c[2]]; }));
  krev(Brikker.konsistent(snudd), 'baksiden av brikke ' + b.nr + ' veksler også');
  // Polariteten i normaliserte koordinater sier ingenting alene – en speiling
  // flytter brikka sidelengs, og en forskyvning på et odde antall ruter snur
  // pariteten uten at et eneste merke er rørt. Det som betyr noe, er hva som
  // skjer på brettet: brikka passer like mange steder uansett hvilken vei
  // brettet er farget, nettopp fordi baksiden finnes. Faller det kravet, er
  // enten en form eller en merking feil.
  krev(Brikker.plasseringer(b, 0).length === Brikker.plasseringer(b, 1).length,
    'brikke ' + b.nr + ' passer like mange steder i begge fargingene',
    Brikker.plasseringer(b, 0).length + ' mot ' + Brikker.plasseringer(b, 1).length);
  var polariteter = {};
  b.orienteringer.forEach(function (o) { polariteter[Brikker.polaritet(o.celler)] = true; });
  krev(polariteter[0] && polariteter[1],
    'brikke ' + b.nr + ' har orienteringer med begge polariteter');
});

Brikker.alle.forEach(function (b) {
  var sett = {};
  b.orienteringer.forEach(function (o) {
    var n = nokkel(o.celler);
    krev(!sett[n], 'brikke ' + b.nr + ' har ingen dobbel orientering');
    sett[n] = true;
    krev(o.celler.length === 5, 'orientering av brikke ' + b.nr + ' har fem ruter');
    krev(Brikker.konsistent(o.celler), 'orientering av brikke ' + b.nr + ' veksler');
  });
  krev(b.orienteringer.length === 4 || b.orienteringer.length === 8,
    'brikke ' + b.nr + ' har fire eller åtte orienteringer', b.orienteringer.length);
});

// Regresjonsvakt: endrer noen en form, endres disse tallene.
var fasit = [40, 92, 92, 92, 96, 48, 96, 118, 96, 118];
Brikker.alle.forEach(function (b, i) {
  var n = Brikker.plasseringer(b, 0).length;
  krev(n === fasit[i], 'brikke ' + b.nr + ' har ' + fasit[i] + ' plasseringer', n);
});

console.log('Løseren');

[0, 1].forEach(function (farging) {
  var t0 = Date.now();
  var svar = Loeser.loes(Loeser.tomStart(farging), 1e9);
  var tid = Date.now() - t0;
  krev(svar.losninger.length === 68, 'farging ' + farging + ' gir 68 løsninger', svar.losninger.length);
  krev(tid < 5000, 'farging ' + farging + ' er ferdig på under fem sekunder', tid + ' ms');

  svar.losninger.forEach(function (l, i) {
    var dekket = new Int8Array(50), brukt = {};
    l.forEach(function (p) {
      krev(!brukt[p.brikke], 'løsning ' + i + ' bruker brikke ' + (p.brikke + 1) + ' én gang');
      brukt[p.brikke] = true;
      p.ruter.forEach(function (r) { dekket[r]++; });
    });
    var helt = true;
    for (var r = 0; r < 50; r++) if (dekket[r] !== 1) helt = false;
    krev(helt, 'løsning ' + i + ' dekker hver rute nøyaktig én gang');
  });
});

// XOXO-regelen selv: to naboruter må aldri ha samme merke. Den følger av
// fargingen, men den er hele spillet, så den skal stå som et eget krav.
var svar0 = Loeser.loes(Loeser.tomStart(0), 1);
var merker = new Int8Array(50);
svar0.losninger[0].forEach(function (p) {
  var b = Brikker.alle[p.brikke], o = b.orienteringer[p.orientering];
  o.celler.forEach(function (c) { merker[(c[0] + p.dr) * Brikker.KOL + (c[1] + p.dk)] = c[2]; });
});
var vekslet = true;
for (var r = 0; r < Brikker.RAD; r++) {
  for (var k = 0; k < Brikker.KOL; k++) {
    var i = r * Brikker.KOL + k;
    if (k < Brikker.KOL - 1 && merker[i] === merker[i + 1]) vekslet = false;
    if (r < Brikker.RAD - 1 && merker[i] === merker[i + Brikker.KOL]) vekslet = false;
  }
}
krev(vekslet, 'en ferdig løsning veksler mellom X og O i begge retninger');

console.log('');
console.log(gjort + ' krav, ' + feil + ' feil');
process.exit(feil ? 1 : 0);
