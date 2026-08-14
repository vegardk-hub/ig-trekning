/*
 * Prøver for løypa og økonomien i Stuntgarasjen.
 *
 * Kjøres uten nettleser og uten server:
 *
 *     node pwa-stunt/tester/lope.js
 *
 * Løypa er stemt av mot tall som bare simuleringen kjenner – hvor fort bilen
 * forlater hver rampe, hvor langt den flyr, om en maksbil rekker fra siste
 * hopp til mål. De tallene ble tidligere målt ved å instrumentere koden med
 * en `console.log`, starte en nettleser og kjøre løypa i sanntid. Nå står de
 * her, og de sier fra av seg selv når noen justerer en rampe eller en motor.
 *
 * Legger du til et hopp eller en loop, er det disse kravene som avgjør om
 * plasseringen går an.
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

var Bil = last('bil');
var Lope = last('lope');
var Fysikk = last('fysikk', 'Lope', Lope);

var feil = 0, gjort = 0;

function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}

function overskrift(t) { console.log('\n' + t); }

/* ---------- biler å måle med ---------- */

var NAKEN = { motor: 0, gir: 0, dekk: 0 };
var MAKS = { motor: 6, gir: 6, dekk: 6 };

var BONUS_NAKEN = Bil.bonus(Bil.standard());
var BONUS_MAKS = Bil.bonus({
  form: 'monster', lakk: 'regnbue', hjul: 'ild', spoiler: 'rakett',
  dekor: ['striper', 'stjerner', 'lyn', 'flammer', 'tenner', 'glitter']
});

function tur(oppg, bonus, gass) {
  return Fysikk.simuler(Lope.bygg(Fysikk.G), oppg, bonus, gass);
}

var lope = Lope.bygg(Fysikk.G);
var naken = tur(NAKEN, BONUS_NAKEN);
var maks = tur(MAKS, BONUS_MAKS);

function avsprang(res) { return res.hendelser.filter(function (h) { return h.type === 'avsprang'; }); }
function landinger(res) { return res.hendelser.filter(function (h) { return h.type === 'landing'; }); }

/* ---------- 1: begge kommer i mål ---------- */

overskrift('Begge bilene kommer i mål');
krev(naken.kjortFerdig, 'en umodifisert bil kom ikke i mål');
krev(maks.kjortFerdig, 'en fullt oppgradert bil kom ikke i mål');

// En bil som aldri får gass skal bli stående, ikke komme i mål av seg selv.
// Det er hintet «Trykk på gass!» som er svaret der, ikke en gratis tur.
var passiv = Fysikk.simuler(Lope.bygg(Fysikk.G), NAKEN, BONUS_NAKEN, function () { return false; });
krev(!passiv.kjortFerdig, 'en bil uten gass kom i mål helt av seg selv');

/* ---------- 2: alle hoppene klares ---------- */

overskrift('Hoppene');
var ramper = lope.punkter.filter(function (p) { return p.hopp; });
krev(ramper.length >= 4, 'løypa har færre enn fire hopp', ramper.length);
krev(naken.hopp === ramper.length,
     'en umodifisert bil traff ikke alle rampene', naken.hopp + ' av ' + ramper.length);

landinger(naken).forEach(function (h, i) {
  krev(h.lengde > 0, 'hopp ' + (i + 1) + ' ga ingen lengde for en umodifisert bil');
});

/*
 * Hvert gap skal klares med god margin av den svakeste bilen. Rekker den
 * akkurat ikke over, blir den reddet av kanten – det virker, men da ser
 * hoppet ut som et uhell i stedet for et stunt.
 */
var gap = [];
lope.punkter.forEach(function (p, i) {
  if (p.hopp && lope.punkter[i + 1]) gap.push(lope.punkter[i + 1].x - p.x);
});

avsprang(naken).forEach(function (a, i) {
  var l = landinger(naken)[i];
  krev(a.grader < -25, 'avsprang ' + (i + 1) + ' peker ikke oppover', a.grader.toFixed(1) + '°');
  krev(l && l.lengde > gap[i] + 90,
       'hopp ' + (i + 1) + ' klarer så vidt gapet for en umodifisert bil',
       l && ('fløy ' + l.lengde + ' over et gap på ' + Math.round(gap[i])));
});

/* ---------- 3: ingen loop ligger i en flybane ---------- */

overskrift('Ingen loop ligger innenfor et hopp');

/*
 * Bilen kan bare lande på fast grunn, så en loop innenfor rekkevidden til et
 * hopp er ikke noe den treffer – den seiler tvers gjennom asfalten i lufta.
 * Rekkevidden måles på maksbilen, for det er den som flyr lengst.
 */
var loopX = lope.punkter.filter(function (p) { return !p.bakke; }).map(function (p) { return p.x; });

avsprang(maks).forEach(function (a, i) {
  var l = landinger(maks)[i];
  if (!l) return;
  var traff = loopX.filter(function (x) { return x > a.x + 40 && x < a.x + l.lengde - 40; });
  krev(traff.length === 0,
       'maksbilen flyr gjennom en loop på hopp ' + (i + 1),
       'hopp ' + Math.round(l.lengde) + ' fra x=' + Math.round(a.x));
});

/* ---------- 4: maksbilen når målet fra siste hopp ---------- */

overskrift('Maksbilen skal fly fra siste hopp og helt i mål');

var sisteRampe = ramper[ramper.length - 1];
var maalX = lope.punkter[lope.punkter.length - 1].x;
var sisteAvsprang = avsprang(maks)[avsprang(maks).length - 1];
var sisteLanding = landinger(maks)[landinger(maks).length - 1];

krev(sisteAvsprang && Math.abs(sisteAvsprang.x - sisteRampe.x) < 40,
     'maksbilens siste avsprang var ikke fra den siste rampa');
krev(sisteLanding && sisteAvsprang.x + sisteLanding.lengde >= maalX - 20,
     'maksbilen nådde ikke målet fra siste hopp',
     sisteLanding && ('landet ' + Math.round(maalX - sisteAvsprang.x - sisteLanding.lengde) +
                      ' enheter for kort'));

// ...men en umodifisert bil skal ikke klare det. Klarer den det, er det ikke
// lenger en belønning for å ha bygd bilen ferdig.
var nakenSisteA = avsprang(naken)[avsprang(naken).length - 1];
var nakenSisteL = landinger(naken)[landinger(naken).length - 1];
krev(nakenSisteA.x + nakenSisteL.lengde < maalX - 400,
     'en umodifisert bil når også målet fra siste hopp – da er det ingen belønning',
     Math.round(maalX - nakenSisteA.x - nakenSisteL.lengde) + ' enheter til overs');

/* ---------- 5: myntbuene ligger på den ekte banen ---------- */

overskrift('Myntbuene følger kastebanen');

/*
 * Buene regnes ut av avsprangsvinkelen og en målt referansefart. Stemmer ikke
 * referansefarten med det bilen faktisk har, henger myntene et sted bilen
 * aldri kommer – og det var nettopp feilen som gjorde at hoppene så livløse
 * ut før.
 */
avsprang(naken).forEach(function (a, i) {
  krev(Math.abs(a.v - 750) < 130,
       'avsprangsfart ' + (i + 1) + ' ligger langt fra REFERANSEFART i lope.js',
       Math.round(a.v) + ' mot 750');
});

// Og bilen skal faktisk plukke dem: en umodifisert bil bør ta minst to
// tredeler av myntene i lufta over hvert hopp.
krev(naken.mynter > lope.mynter.length * 0.55,
     'en umodifisert bil plukker for få mynter', naken.mynter + ' av ' + lope.mynter.length);

/* ---------- 6: løypa har nok innhold ---------- */

overskrift('Innholdet i løypa');
krev(lope.looper.length >= 4, 'løypa har færre enn fire looper', lope.looper.length);
krev(lope.lengde > 16000, 'løypa er kortere enn 16 000 enheter', Math.round(lope.lengde));
krev(naken.looper === lope.looper.length,
     'en umodifisert bil kom ikke rundt alle loopene', naken.looper + ' av ' + lope.looper.length);
krev(naken.tid > 18 && naken.tid < 45,
     'en tur tar urimelig lang eller kort tid', naken.tid.toFixed(1) + ' s');

/* ---------- 7: økonomien ---------- */

overskrift('Økonomien');

var katalog = Bil.KATEGORIER.reduce(function (sum, k) {
  return sum + k.liste.reduce(function (a, d) { return a + d.pris; }, 0);
}, 0);
var oppgraderinger = Fysikk.OPPGRADERINGER.reduce(function (sum, o) {
  return sum + o.data.priser.reduce(function (a, p) { return a + p; }, 0);
}, 0);

console.log('  naken tur $' + naken.penger + ' | maks tur $' + maks.penger +
            ' | katalog $' + katalog + ' | oppgraderinger $' + oppgraderinger);
console.log('  naken: ' + naken.mynter + ' mynter, ' + naken.looper + ' looper, ' +
            naken.hopp + ' hopp, lengste ' + naken.lengsteHopp);
console.log('  maks:  ' + maks.mynter + ' mynter, ' + maks.looper + ' looper, ' +
            maks.hopp + ' hopp, lengste ' + maks.lengsteHopp);

krev(naken.penger > 500 && naken.penger < 900,
     'en umodifisert tur ligger utenfor det README-en lover', naken.penger);
krev(maks.penger > naken.penger * 1.5,
     'en fullt utstyrt bil tjener ikke nok mer enn en naken', maks.penger + ' mot ' + naken.penger);
krev(maks.penger < naken.penger * 4,
     'en fullt utstyrt bil tjener urimelig mye mer', maks.penger + ' mot ' + naken.penger);

/* ---------- oppsummering ---------- */

console.log('\n' + (feil ? feil + ' feil av ' + gjort + ' krav' : 'alle ' + gjort + ' krav ok'));
process.exit(feil ? 1 : 0);
