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
var MAKS = { motor: Fysikk.MAKSNIVA, gir: Fysikk.MAKSNIVA, dekk: Fysikk.MAKSNIVA };

var BONUS_NAKEN = Bil.bonus(Bil.standard());
var ALT = {
  form: 'monster', lakk: 'regnbue', hjul: 'ild', spoiler: 'rakett',
  dekor: ['striper', 'stjerner', 'lyn', 'flammer', 'tenner', 'glitter'],
  ekstra: ['koffert', 'surfebrett', 'lysboyle', 'sirene', 'ballonger', 'eksos', 'and', 'vimpel']
};
var BONUS_MAKS = Bil.bonus(ALT);

function tur(oppg, bonus, gass, turbo) {
  return Fysikk.simuler(Lope.bygg(Fysikk.G), oppg, bonus, gass, turbo);
}

var ALLTID = function () { return true; };

/*
 * «Flink» er et barn som har skjønt saltoen: gass hele veien, men slipp i
 * lufta så snart bilen har fått en hel runde rundt, så den lander på hjulene.
 * Det er den øvre grensa for hva som kan tjenes på én tur, og det er den som
 * må holde seg innenfor det økonomien tåler.
 */
var FLINK = function (t) { return !t.flyr || t.runder === 0; };

var lope = Lope.bygg(Fysikk.G);
var naken = tur(NAKEN, BONUS_NAKEN);
var maks = tur(MAKS, BONUS_MAKS);
var nakenAlt = tur(NAKEN, BONUS_NAKEN, FLINK, ALLTID);
var maksFlink = tur(MAKS, BONUS_MAKS, FLINK);
var maksAlt = tur(MAKS, BONUS_MAKS, FLINK, ALLTID);

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
/*
 * Varigheten måles i *virkelige* sekunder, ikke simulerte. Fysikken kjøres
 * gjennom `TIDSSKALA`, så de to er ikke samme tall – og det er det barnet
 * sitter og venter på som skal ligge innenfor.
 */
var nakenEkte = naken.tid / Fysikk.TIDSSKALA;
var maksEkte = maks.tid / Fysikk.TIDSSKALA;
krev(nakenEkte > 22 && nakenEkte < 48,
     'en tur med den svakeste bilen tar urimelig lang eller kort tid',
     nakenEkte.toFixed(1) + ' s');
krev(maksEkte > 15,
     'en maksbil raser gjennom løypa for fort til å se noe av den',
     maksEkte.toFixed(1) + ' s');

/* ---------- 7: saltoen og turboen ---------- */

overskrift('Kjørekontrollene');

/*
 * Saltoen skal være noe man *gjør*. Holder man bare gassen, snurrer bilen
 * videre og lander på taket: en maksbil med gassen i bunn hele veien skal
 * derfor ikke få en eneste. Slipper man i lufta, skal alle fire sitte.
 */
krev(maks.saltoer === 0,
     'en maksbil som bare holder gassen får saltoer gratis', maks.saltoer);
krev(maksFlink.saltoer >= ramper.length,
     'en bil som slipper gassen i lufta lander ikke saltoene sine',
     maksFlink.saltoer + ' av ' + ramper.length);
krev(maksFlink.penger > maks.penger * 1.1,
     'det lønner seg ikke nok å lande saltoene',
     maksFlink.penger + ' mot ' + maks.penger);

landinger(maks).forEach(function (h, i) {
  krev(h.runder >= 1, 'hopp ' + (i + 1) + ' gir ikke luft nok til en hel runde', h.runder);
});

/*
 * Turboen må ikke flytte avsprangsfarten mer enn myntbuene tåler. Buene er
 * regnet ut fra REFERANSEFART, og en turbo som ga vesentlig mer fart ville
 * sendt bilen i en bue langt over sine egne mynter. Et første forsøk la på
 * en fast kraft: maksbilen fant likevekt over 2000 og fløy 8745 enheter.
 */
avsprang(nakenAlt).forEach(function (a, i) {
  krev(Math.abs(a.v - 750) < 130,
       'avsprangsfart ' + (i + 1) + ' med turbo ligger langt fra REFERANSEFART',
       Math.round(a.v) + ' mot 750');
});

krev(nakenAlt.kjortFerdig && maksAlt.kjortFerdig,
     'en bil som bruker turbo kom ikke i mål');

// Turboen skal heller ikke kunne skyte noen gjennom en loop.
avsprang(maksAlt).forEach(function (a, i) {
  var l = landinger(maksAlt)[i];
  if (!l) return;
  var traff = loopX.filter(function (x) { return x > a.x + 40 && x < a.x + l.lengde - 40; });
  krev(traff.length === 0,
       'en maksbil med turbo flyr gjennom en loop på hopp ' + (i + 1),
       'hopp ' + Math.round(l.lengde) + ' fra x=' + Math.round(a.x));
});

// En umodifisert bil skal fortsatt ikke nå målet fra siste hopp, uansett
// hvor mye turbo den bruker.
var altSisteA = avsprang(nakenAlt)[avsprang(nakenAlt).length - 1];
var altSisteL = landinger(nakenAlt)[landinger(nakenAlt).length - 1];
krev(altSisteA.x + altSisteL.lengde < maalX - 400,
     'en umodifisert bil med turbo når målet fra siste hopp',
     Math.round(maalX - altSisteA.x - altSisteL.lengde) + ' enheter til overs');

/* ---------- 8: økonomien ---------- */

overskrift('Økonomien');

var katalog = Bil.KATEGORIER.reduce(function (sum, k) {
  return sum + k.liste.reduce(function (a, d) { return a + d.pris; }, 0);
}, 0);
var oppgraderinger = Fysikk.OPPGRADERINGER.reduce(function (sum, o) {
  for (var n = 0; n < Fysikk.MAKSNIVA; n++) sum += Fysikk.pris(o.data, n);
  return sum;
}, 0);

console.log('  naken tur $' + naken.penger + ' | maks tur $' + maks.penger +
            ' | katalog $' + katalog + ' | oppgraderinger $' + oppgraderinger);
console.log('  naken: ' + naken.mynter + ' mynter, ' + naken.looper + ' looper, ' +
            naken.hopp + ' hopp, lengste ' + naken.lengsteHopp +
            ', ' + nakenEkte.toFixed(1) + ' s');
console.log('  maks:  ' + maks.mynter + ' mynter, ' + maks.looper + ' looper, ' +
            maks.hopp + ' hopp, lengste ' + maks.lengsteHopp +
            ', ' + maksEkte.toFixed(1) + ' s');
console.log('  med salto og turbo: naken $' + nakenAlt.penger +
            ' (' + nakenAlt.saltoer + ' salto) | maks $' + maksAlt.penger +
            ' (' + maksAlt.saltoer + ' salto)');

// Stilbonusen skal ligge rundt x2,1 med alt på. Legger noen til en kategori
// uten å justere nevneren i Bil.bonus(), vokser inntekten i løypa av seg selv.
krev(BONUS_MAKS > 1.95 && BONUS_MAKS < 2.25,
     'stilbonusen med alt på har drevet vekk fra x2,1', '×' + BONUS_MAKS.toFixed(2));

/*
 * Båndet gjelder en umodifisert bil som bare holder gassen. Det flyttet seg
 * opp da saltoen kom til – den er en ny inntekt, og den skal være verdt å
 * lære seg. `nakenAlt` er taket: samme bil, men kjørt av en som lander
 * saltoene og bruker turboen. Klarer den å doble seg, er det ikke lenger en
 * bonus, det er en ny økonomi.
 */
krev(naken.penger > 700 && naken.penger < 1050,
     'en umodifisert tur ligger utenfor det README-en lover', naken.penger);
krev(nakenAlt.penger < naken.penger * 1.4,
     'salto og turbo gir for mye på en umodifisert bil',
     nakenAlt.penger + ' mot ' + naken.penger);
/*
 * Avstanden mellom den første og den siste bilen er nå mye større enn før,
 * og det er hele poenget med teknikkbonusen: prisene i tier 6 er hundre
 * ganger dem i tier 1, og uten en inntekt som følger etter, blir de siste
 * tierne en vegg. Båndet holder likevel igjen – blir det mer enn tolv
 * ganger, er tidlige turer ikke verdt å kjøre.
 */
krev(maks.penger > naken.penger * 6,
     'en fullt utbygd bil tjener ikke nok mer enn en naken – de siste tierne blir en vegg',
     maks.penger + ' mot ' + naken.penger);
krev(maks.penger < naken.penger * 12,
     'en fullt utbygd bil tjener urimelig mye mer', maks.penger + ' mot ' + naken.penger);

/* ---------- 9: tierne og hvor lenge de varer ---------- */

overskrift('Tiere og progresjon');

krev(Fysikk.TIERE === 6, 'det skal være seks tiere', Fysikk.TIERE);
krev(Fysikk.MAKSNIVA === Fysikk.TIERE * Fysikk.TRINN, 'maksnivået stemmer ikke med tiere × trinn');

/*
 * Siste trinn i et tier *flytter* bilen opp. Nivå 5 er «tier 2, null av fem»
 * og ikke «tier 1, fem av fem» – det er det som gjør at kjøpet man sparte til,
 * gir en ny farge med en gang. Toppen er unntaket og blir stående i tier 6.
 */
krev(Fysikk.tierInfo(0).n === 1, 'nivå 0 skal være tier 1');
krev(Fysikk.tierInfo(Fysikk.TRINN - 1).n === 1, 'siste trinn før et tierskifte hoppet for tidlig');
krev(Fysikk.tierInfo(Fysikk.TRINN).n === 2, 'et fullført tier løfter ikke bilen opp i neste');
krev(Fysikk.tierInfo(Fysikk.MAKSNIVA).n === Fysikk.TIERE, 'toppen havnet utenfor siste tier');
krev(Fysikk.tierInfo(Fysikk.MAKSNIVA).trinn === Fysikk.TRINN, 'toppen viser ikke fullt tier');
krev(Fysikk.pris(Fysikk.MOTOR, Fysikk.MAKSNIVA) === null, 'det går an å kjøpe forbi toppen');

// Alle seks tierne skal ha hver sin farge og sitt eget navn.
var farger = {}, navn = {};
for (var t = 0; t < Fysikk.TIERE; t++) {
  var info = Fysikk.tierInfo(t * Fysikk.TRINN);
  farger[info.farge] = 1;
  navn[info.navn] = 1;
}
krev(Object.keys(farger).length === Fysikk.TIERE, 'to tiere deler farge', Object.keys(farger).length);
krev(Object.keys(navn).length === Fysikk.TIERE, 'to tiere deler navn', Object.keys(navn).length);

// Ytelsen har samme tak som før tierne kom. Flere tiere skal gi *finere*
// trinn, ikke en raskere bil – hopplengdene er stemt av mot toppen.
krev(Math.abs(Fysikk.verdi(Fysikk.MOTOR, Fysikk.MAKSNIVA) - 1280) < 1,
     'toppfarten har flyttet seg, og da stemmer ikke lengdene i lope.js',
     Fysikk.verdi(Fysikk.MOTOR, Fysikk.MAKSNIVA));

// Hvert tier må koste mer enn det forrige, ellers er de bare farger.
Fysikk.OPPGRADERINGER.forEach(function (o) {
  for (var i = 1; i < Fysikk.TIERE; i++) {
    var for_ = Fysikk.pris(o.data, (i - 1) * Fysikk.TRINN);
    var na = Fysikk.pris(o.data, i * Fysikk.TRINN);
    krev(na > for_ * 1.8,
         o.id + ': tier ' + (i + 1) + ' koster ikke nok mer enn tier ' + i, for_ + ' → ' + na);
  }
});

/*
 * Selve progresjonen. Den spilles gjennom med en grådig kjøper: kjør en tur,
 * kjøp alt man har råd til, billigste først. Det er her de tre tallene som
 * henger sammen – ytelsestak, prisstigning og teknikkbonus – faktisk møtes,
 * og det eneste som fanger opp at de har drevet fra hverandre.
 */
function spillGjennom() {
  var penger = 250, turer;
  var eid = {}, valgt = Bil.standard(), oppg = { motor: 0, gir: 0, dekk: 0 };
  Bil.KATEGORIER.forEach(function (k) { eid[k.id] = []; });
  var merke = {};

  for (turer = 1; turer <= 500; turer++) {
    penger += Fysikk.simuler(lope, oppg, Bil.bonus(valgt)).penger;

    var bud = [];
    Fysikk.OPPGRADERINGER.forEach(function (o) {
      var p = Fysikk.pris(o.data, oppg[o.id]);
      if (p !== null) bud.push({ pris: p, gjor: function () { oppg[o.id]++; } });
    });
    Bil.KATEGORIER.forEach(function (k) {
      k.liste.forEach(function (d) {
        if (d.pris <= 0 || eid[k.id].indexOf(d.id) >= 0) return;
        bud.push({ pris: d.pris, gjor: function () {
          eid[k.id].push(d.id);
          if (k.flere) valgt[k.id].push(d.id); else valgt[k.id] = d.id;
        } });
      });
    });
    bud.sort(function (a, b) { return a.pris - b.pris; });
    if (!bud.length) break;
    while (bud.length && bud[0].pris <= penger) {
      penger -= bud[0].pris;
      bud[0].gjor();
      bud.shift();
    }
    // Når nådde motoren hvert tier?
    var t = Fysikk.tierInfo(oppg.motor).n;
    if (!merke[t]) merke[t] = turer;
  }
  return { turer: turer, merke: merke };
}

var gjennom = spillGjennom();
console.log('  tier nådd på tur: ' + Object.keys(gjennom.merke).map(function (t) {
  return 'T' + t + '@' + gjennom.merke[t];
}).join(' '));
console.log('  alt eid etter ' + gjennom.turer + ' turer');

krev(gjennom.turer > 45 && gjennom.turer < 110,
     'det tar urimelig få eller mange turer å bygge bilen ferdig', gjennom.turer + ' turer');
krev(gjennom.merke[Fysikk.TIERE] !== undefined, 'siste tier ble aldri nådd');
krev(gjennom.merke[2] !== undefined && gjennom.merke[2] <= 12,
     'det tar for lang tid å se det andre tieret – første farge må komme tidlig',
     'tur ' + gjennom.merke[2]);

/* ---------- oppsummering ---------- */

console.log('\n' + (feil ? feil + ' feil av ' + gjort + ' krav' : 'alle ' + gjort + ' krav ok'));
process.exit(feil ? 1 : 0);
