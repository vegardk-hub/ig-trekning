/*
 * Prøver ordmatchingen uten nettleser: tale.js lastes inn i et falskt
 * window-objekt. Ingen playwright, ingen server – matchingen er ren logikk.
 *
 * Kjør etter hver endring i js/tale.js:
 *   node pwa-lesing/tester/match.js
 *
 * Skruen som justeres oftest, er hvor rundhåndet matchingen skal være. Da er
 * det de to siste bolkene som betyr noe: at feil tekst ikke farger noe, og at
 * overspranget stopper etter to ord.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = { window: {}, setTimeout, console };
ctx.window.speechSynthesis = null;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'tale.js'), 'utf8'), ctx);
const Tale = ctx.window.LeseTale;

let feil = 0;
function sjekk(navn, faktisk, ventet) {
  const ok = faktisk === ventet;
  if (!ok) feil++;
  console.log((ok ? 'OK   ' : 'FEIL ') + navn + '  ->  ' + faktisk + (ok ? '' : ' (ventet ' + ventet + ')'));
}

function les(setning, sagt) {
  const ord = setning.split(/\s+/);
  const m = Tale.lagMatcher(ord);
  (Array.isArray(sagt) ? sagt : [sagt]).forEach(u => {
    m.nyttUtsagn();
    m.mat(Tale.normaliser(u));
  });
  return m.posisjon();
}

const S1 = 'Ildkulen står midt i hallen.';
sjekk('perfekt opplesing', les(S1, 'Ildkulen står midt i hallen'), 5);
sjekk('med tegnsetting og stor bokstav', les(S1, 'Ildkulen, står midt i Hallen.'), 5);
sjekk('halvveis', les(S1, 'Ildkulen står'), 2);
sjekk('to utsagn etter hverandre', les(S1, ['Ildkulen står', 'midt i hallen']), 5);
sjekk('gjenkjenneren fant på et ord', les(S1, 'Ildkulen står ehm midt i hallen'), 5);
sjekk('ett ord ble ikke hørt', les(S1, 'Ildkulen står midt hallen'), 5);

const S2 = 'Truckene kjører opp den bratte rampen.';
sjekk('kj skrevet som sj', les(S2, 'Truckene sjører opp den bratte rampen'), 6);
sjekk('liten skrivefeil i ett ord', les(S2, 'Truckene kjører opp den brate rampen'), 6);

const S3 = 'En monstertruck hopper over fem biler.';
sjekk('sammensatt ord delt i to', les(S3, 'En monster truck hopper over fem biler'), 6);

const S4 = 'Den flyr over 5 gamle biler.';
sjekk('siffer lest som ord', les(S4, 'Den flyr over fem gamle biler'), 6);

const S5 = 'Bakken rister når den lander.';
sjekk('stum d', les(S5, 'Bakken rister når den lanner'), 5);

// Det som IKKE skal gå gjennom: helt annen tekst må ikke farge noe.
sjekk('helt feil tekst gir ingenting', les(S1, 'jeg vil ha is og kake'), 0);
sjekk('korte ord matcher ikke hverandre', les('og', 'om'), 0);
// Overspringet gjelder ett ord, ikke resten av setningen: sier man bare det
// siste ordet, skal ingenting bli grønt.
sjekk('siste ord alene hopper ikke over resten', les(S1, 'hallen'), 0);
sjekk('to tapte ord paa rad', les(S1, 'Ildkulen i hallen'), 5);
sjekk('tre tapte ord paa rad stopper', les('a b c d e f', 'a f'), 1);

// Omskrevet foreløpig resultat skal ikke telles to ganger.
const ord = S1.split(/\s+/);
const m = Tale.lagMatcher(ord);
m.nyttUtsagn(); m.mat(Tale.normaliser('Ildkulen står'));
m.mat(Tale.normaliser('Ildkulen står midt'));
m.mat(Tale.normaliser('Ildkulen står midt i hallen'));
sjekk('omskrevet interim teller én gang', m.posisjon(), 5);

console.log(feil ? '\n' + feil + ' feil' : '\nAlt gikk gjennom');
process.exit(feil ? 1 : 0);
