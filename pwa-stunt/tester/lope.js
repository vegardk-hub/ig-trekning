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
krev(naken.penger > 380 && naken.penger < 620,
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

krev(Fysikk.TIERE === 10, 'det skal være ti tiere', Fysikk.TIERE);
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

/*
 * Hvert tier må koste mer enn det forrige, ellers er de bare farger. Grensa
 * er 1,5 og ikke 1,8: med ti tiere ganges `TIERFAKTOR` opp ni ganger i
 * stedet for fem, så raten per tier er lavere selv om spennet fra første til
 * siste tier er større. Kravet fanger et sammenbrudd i prisingen, ikke en
 * bestemt faktor – den måles av progresjonen lenger nede.
 */
Fysikk.OPPGRADERINGER.forEach(function (o) {
  for (var i = 1; i < Fysikk.TIERE; i++) {
    var for_ = Fysikk.pris(o.data, (i - 1) * Fysikk.TRINN);
    var na = Fysikk.pris(o.data, i * Fysikk.TRINN);
    krev(na > for_ * 1.5,
         o.id + ': tier ' + (i + 1) + ' koster ikke nok mer enn tier ' + i, for_ + ' → ' + na);
  }
});

/*
 * En bil som var fullt utbygd på den gamle sjunivå-skalaen skal begynne på
 * *starten av tier 2*. Versjon 2 ganget i stedet det gamle nivået med TRINN,
 * og da landet en maksbil rett på trinn 30 – ferdig utbygd i samme øyeblikk
 * som appen oppdaterte seg. Begge veiene inn må gi samme svar, for versjon 2
 * rakk å bli lagret hos dem som åpnet appen mens den lå ute.
 */
var UMIGRERT = undefined, V2 = 2;

krev(Fysikk.fraGammelLagring(6, UMIGRERT) === Fysikk.TRINN,
     'en maksa bil fra den gamle skalaen havner ikke på starten av tier 2',
     Fysikk.fraGammelLagring(6, UMIGRERT));
// Versjon 2 lagret en maksa gammel bil som 6 × TRINN. At det tallet en stund
// var det samme som MAKSNIVA, var tilfeldig – nå er MAKSNIVA 50.
krev(Fysikk.fraGammelLagring(6 * Fysikk.TRINN, V2) === Fysikk.TRINN,
     'en bil som allerede fikk versjon 2-migreringen, blir ikke rettet tilbake',
     Fysikk.fraGammelLagring(6 * Fysikk.TRINN, V2));
krev(Fysikk.tierInfo(Fysikk.fraGammelLagring(6, UMIGRERT)).n === 2,
     'en maksa bil starter ikke i tier 2');
krev(Fysikk.tierInfo(Fysikk.fraGammelLagring(6, UMIGRERT)).trinn === 0,
     'en maksa bil starter ikke på *begynnelsen* av tier 2');
krev(Fysikk.fraGammelLagring(0, UMIGRERT) === 0, 'en ubrukt bil fikk nivåer den ikke hadde');

// De to veiene inn må være enige om hvert eneste gamle nivå.
for (var gl = 0; gl <= 6; gl++) {
  krev(Fysikk.fraGammelLagring(gl, UMIGRERT) === Fysikk.fraGammelLagring(gl * Fysikk.TRINN, V2),
       'de to migreringsveiene er uenige om gammelt nivå ' + gl,
       Fysikk.fraGammelLagring(gl, UMIGRERT) + ' mot ' +
       Fysikk.fraGammelLagring(gl * Fysikk.TRINN, V2));
  krev(Fysikk.fraGammelLagring(gl, UMIGRERT) <= Fysikk.TRINN,
       'gammelt nivå ' + gl + ' havner forbi starten av tier 2');
}

// En lagring som allerede er på dagens skala, skal stå urørt.
krev(Fysikk.fraGammelLagring(17, 3) === 17, 'en fersk lagring ble migrert om igjen');
krev(Fysikk.fraGammelLagring(Fysikk.MAKSNIVA, 3) === Fysikk.MAKSNIVA,
     'en ferdig bygd bil på dagens skala ble skrudd ned');

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

  // Hvor mange turer hvert tier varte. Det er dette tallet som skal vokse.
  var varte = [];
  for (var i = 1; i <= Fysikk.TIERE; i++) {
    if (!merke[i]) break;
    varte.push((merke[i + 1] || turer) - merke[i]);
  }
  return { turer: turer, merke: merke, varte: varte };
}

var gjennom = spillGjennom();
console.log('  turer per tier: ' + gjennom.varte.map(function (v, i) {
  return 'T' + (i + 1) + ':' + v;
}).join(' '));
console.log('  alt eid etter ' + gjennom.turer + ' turer');

krev(gjennom.turer > 140 && gjennom.turer < 260,
     'det tar urimelig få eller mange turer å bygge bilen ferdig', gjennom.turer + ' turer');
krev(gjennom.merke[Fysikk.TIERE] !== undefined, 'siste tier ble aldri nådd');
krev(gjennom.merke[2] !== undefined && gjennom.merke[2] <= 14,
     'det tar for lang tid å se det andre tieret – første farge må komme tidlig',
     'tur ' + gjennom.merke[2]);

/*
 * «Lengre og lengre tid for hvert nivå». Kravet gjelder fra tier 3 og opp,
 * og ikke fra tier 1: der konkurrerer oppgraderingene med designkatalogen om
 * de samme pengene, og stilbonusen dobler inntekten i løpet av de første ti
 * turene. Tier 1 og 2 blir derfor korte uansett hva prisene gjør, og det er
 * riktig – det er der barnet kjøper lakk og glitter.
 */
for (var v = 3; v < gjennom.varte.length; v++) {
  krev(gjennom.varte[v] >= gjennom.varte[v - 1],
       'tier ' + (v + 1) + ' går fortere enn tier ' + v + ' – stigningen har snudd',
       gjennom.varte[v - 1] + ' → ' + gjennom.varte[v] + ' turer');
}
krev(gjennom.varte[Fysikk.TIERE - 1] > gjennom.varte[2] * 4,
     'det siste tieret er ikke vesentlig lengre enn det tredje',
     gjennom.varte[2] + ' mot ' + gjennom.varte[Fysikk.TIERE - 1] + ' turer');

/* ---------- 10: alle banene ---------- */

/*
 * Kravene over gjelder Stuntløypa i detalj. Dette går gjennom *hver* bane i
 * katalogen og krever det samme av alle. Det er hele forberedelsen på at det
 * kommer flere baner: en ny post i `Lope.BANER` blir prøvd av seg selv, og
 * en bane som ikke kan kjøres, slipper ikke ut.
 */

overskrift('Katalogen');

var ider = {}, banenavn = {};
Lope.BANER.forEach(function (bane) {
  krev(!ider[bane.id], 'to baner deler id', bane.id);
  krev(!banenavn[bane.navn], 'to baner deler navn', bane.navn);
  ider[bane.id] = banenavn[bane.navn] = 1;
  krev(!!bane.tegn && !!bane.farge && !!bane.omtale,
       bane.id + ': mangler tegn, farge eller omtale');
});
krev(Lope.finn('finnesikke').id === Lope.BANER[0].id,
     'en ukjent bane-id faller ikke tilbake på den første');

Lope.BANER.forEach(function (bane) {
  overskrift('Banen «' + bane.navn + '»');

  var L = Lope.bygg(Fysikk.G, bane.id);
  var n = Fysikk.simuler(L, NAKEN, BONUS_NAKEN);
  var m = Fysikk.simuler(L, MAKS, BONUS_MAKS, FLINK);
  var mt = Fysikk.simuler(L, MAKS, BONUS_MAKS, FLINK, ALLTID);
  var inn = Lope.innhold(L);
  var ramp = L.punkter.filter(function (q) { return q.hopp; });

  console.log('  ' + Math.round(L.lengde) + ' enheter, ' + inn.looper + ' looper, ' +
              inn.hopp + ' hopp, soner: ' + (Object.keys(inn.soner).join(', ') || 'ingen') +
              ' | naken $' + n.penger + ' maks $' + m.penger);

  krev(n.kjortFerdig, bane.navn + ': en umodifisert bil kom ikke i mål');
  krev(m.kjortFerdig, bane.navn + ': en maksbil kom ikke i mål');
  krev(!Fysikk.simuler(L, NAKEN, BONUS_NAKEN, function () { return false; }).kjortFerdig,
       bane.navn + ': en bil uten gass kom i mål av seg selv');

  krev(L.lengde > 14000, bane.navn + ': banen er for kort', Math.round(L.lengde));
  krev(inn.looper + inn.hopp >= 3,
       bane.navn + ': banen har for få elementer til å kjennes som en bane');
  krev(n.looper === L.looper.length,
       bane.navn + ': en umodifisert bil kom ikke rundt alle loopene',
       n.looper + ' av ' + L.looper.length);
  krev(n.hopp === ramp.length,
       bane.navn + ': en umodifisert bil traff ikke alle rampene',
       n.hopp + ' av ' + ramp.length);

  // Alle soner banen bruker, må finnes i tabellen – ellers får den verken
  // friksjon, tegning eller et merke på kortet, og ingenting sier fra.
  for (var s in inn.soner) {
    krev(!!Lope.SONER[s], bane.navn + ': bruker en ukjent sone', s);
  }

  // Hvert gap klares med god margin av den svakeste bilen.
  var g = [];
  L.punkter.forEach(function (q, i) {
    if (q.hopp && L.punkter[i + 1]) g.push(L.punkter[i + 1].x - q.x);
  });
  avsprang(n).forEach(function (a, i) {
    var l = landinger(n)[i];
    krev(a.grader < -25, bane.navn + ': avsprang ' + (i + 1) + ' peker ikke oppover',
         a.grader.toFixed(1) + '°');
    krev(l && l.lengde > g[i] + 90,
         bane.navn + ': hopp ' + (i + 1) + ' klarer så vidt gapet',
         l && ('fløy ' + l.lengde + ' over et gap på ' + Math.round(g[i])));
    /*
     * Myntbuene er regnet ut fra REFERANSEFART. Isen på Frostruta er grunnen
     * til at dette må prøves per bane: en rampe rett etter en lang isstrekning
     * ga en avsprangsfart langt over referansen, og da henger buen et sted
     * bilen aldri kommer. Rampene står derfor på bar asfalt med innkjøring.
     */
    krev(Math.abs(a.v - Lope.REFERANSEFART) < 130,
         bane.navn + ': avsprangsfart ' + (i + 1) + ' ligger langt fra REFERANSEFART',
         Math.round(a.v) + ' mot ' + Lope.REFERANSEFART);
  });

  // Ingen loop innenfor en flybane, hverken med eller uten turbo.
  var lx = L.punkter.filter(function (q) { return !q.bakke; }).map(function (q) { return q.x; });
  [m, mt].forEach(function (res, nr) {
    avsprang(res).forEach(function (a, i) {
      var l = landinger(res)[i];
      if (!l) return;
      var traff = lx.filter(function (x) { return x > a.x + 40 && x < a.x + l.lengde - 40; });
      krev(traff.length === 0,
           bane.navn + ': maksbilen' + (nr ? ' med turbo' : '') +
           ' flyr gjennom en loop på hopp ' + (i + 1),
           'hopp ' + Math.round(l.lengde) + ' fra x=' + Math.round(a.x));
    });
  });

  krev(n.mynter > L.mynter.length * 0.55,
       bane.navn + ': en umodifisert bil plukker for få mynter',
       n.mynter + ' av ' + L.mynter.length);

  var ekte = n.tid / Fysikk.TIDSSKALA, ekteM = m.tid / Fysikk.TIDSSKALA;
  krev(ekte > 22 && ekte < 50, bane.navn + ': en tur tar urimelig lang eller kort tid',
       ekte.toFixed(1) + ' s');
  krev(ekteM > 12, bane.navn + ': en maksbil raser gjennom for fort til å se noe',
       ekteM.toFixed(1) + ' s');

  /*
   * Ingen bane skal være den åpenbare pengemaskinen. Er én av dem vesentlig
   * bedre betalt enn de andre, velges den hver gang, og de fire andre er
   * pynt. Båndet måles mot Stuntløypa, som er den økonomien er stemt av mot.
   */
  krev(n.penger > naken.penger * 0.75 && n.penger < naken.penger * 1.25,
       bane.navn + ': en umodifisert tur betaler for ulikt Stuntløypa',
       n.penger + ' mot ' + naken.penger);
  krev(m.penger > maksFlink.penger * 0.75 && m.penger < maksFlink.penger * 1.25,
       bane.navn + ': en maksbil tjener for ulikt Stuntløypa',
       m.penger + ' mot ' + maksFlink.penger);
});

/* ---------- 11: kjøretøyene ---------- */

/*
 * Et kjøretøy er en egen bil med sine egne oppgraderinger, og en ny begynner
 * på null. Ytelsen kan ikke skrus opp – taket på 1280 i toppfart er målt mot
 * hopplengdene – så det som skiller dem er `inntekt` og hvordan de ser ut.
 *
 * Det gjør økonomien til det eneste som kan måles her, og den må holde to ting
 * samtidig: hvert kjøretøy skal være verdt prisen sin, og et nytt skal aldri
 * gjøre spillet så mye tregere at barnet angrer på kjøpet.
 */

overskrift('Kjøretøyene');

var KJ = Bil.KJORETOY;

krev(KJ.length >= 5, 'det skal finnes minst fem kjøretøy', KJ.length);
krev(KJ[0].pris === 0, 'det første kjøretøyet må være gratis', KJ[0].pris);
krev(!KJ[0].kropp, 'Stuntbilen skal hente karosseriet fra form-kategorien');

var kids = {};
KJ.forEach(function (k, i) {
  krev(!kids[k.id], 'to kjøretøy deler id', k.id);
  kids[k.id] = 1;
  krev(!!k.navn && !!k.tegn && !!k.omtale, k.id + ': mangler navn, tegn eller omtale');
  if (i === 0) return;

  krev(k.pris > KJ[i - 1].pris, k.id + ': koster ikke mer enn det forrige',
       KJ[i - 1].pris + ' → ' + k.pris);
  krev(k.inntekt > KJ[i - 1].inntekt, k.id + ': tjener ikke mer enn det forrige',
       KJ[i - 1].inntekt + ' → ' + k.inntekt);

  /*
   * Et kjøretøy uten eget karosseri ville falt stille tilbake på formen, og da
   * er det bare en dyr ganger: barnet betaler 40 000 og bilen ser lik ut.
   */
  krev(!!k.kropp, k.id + ': mangler eget karosseri og faller tilbake på formen');

  // Feltene tegnerutinen slår opp uten å sjekke. Et glemt felt kaster først
  // når bilen skal tegnes, altså etter at kjøpet er gjort.
  ['hjul', 'dekorboks', 'spoilerfeste', 'strek', 'lykt', 'tak', 'bakluke',
   'panser', 'eksosfeste'].forEach(function (felt) {
    krev(k[felt] !== undefined, k.id + ': mangler festepunktet «' + felt + '»');
  });
  /*
   * Minst to hjul, men ikke nødvendigvis to: Panservogna har seks veihjul inne
   * i beltet. Kravet finnes for å fange en tom eller glemt hjulliste, ikke for
   * å binde alle kjøretøy til å være en bil.
   */
  krev(k.hjul.length >= 2, k.id + ': har for få hjul', k.hjul.length);

  /*
   * Alle hjulene på ett kjøretøy må ha samme stil. Løypa tegner *ett*
   * hjulbilde og gjenbruker det for alle plasseringene, så et kjøretøy med et
   * beltehjul og et gummihjul ville fått samme bilde begge steder – og bare i
   * løypa, ikke i garasjen, der hvert hjul tegnes for seg.
   */
  var stiler = {};
  k.hjul.forEach(function (h) { stiler[h.stil || 'dekk'] = 1; });
  krev(Object.keys(stiler).length === 1,
       k.id + ': blander hjulstiler, og løypa tegner bare én',
       Object.keys(stiler).join(','));
});

krev(Bil.finnKjoretoy('finnesikke').id === KJ[0].id,
     'en ukjent kjøretøy-id faller ikke tilbake på den første');

/*
 * Tegningen må være gyldig XML, og den ene måten den lett slutter å være det
 * på, er at samme attributt settes to ganger i én tagg.
 *
 * Det skjedde: `blink()` setter `opacity`, og et lag som allerede hadde
 * `opacity="0.5"` fikk to. En SVG som ikke lar seg parse blir et **ødelagt
 * bilde**, og det viste seg bare i løypa – der tegningen lastes som en
 * data-URI. I garasjen gir `blink()` en CSS-klasse i stedet, så der så alt
 * riktig ut, og bilen forsvant først når man trykket KJØR.
 *
 * Begge fasene må prøves: feilen finnes bare når `fase` er satt.
 */
overskrift('Tegningen er gyldig XML');

KJ.forEach(function (k) {
  [0, 1].forEach(function (fase) {
    var svg = Bil.innhold(kjoretoyValgtRatt(k.id), 'p' + k.id + fase,
                          { fase: fase, tier: Fysikk.tierInfo(Fysikk.MAKSNIVA) });

    krev(!/NaN|undefined|Infinity/.test(svg),
         k.id + ': tegningen inneholder et ugyldig tall (fase ' + fase + ')');

    (svg.match(/<[a-z]+[^>]*>/g) || []).forEach(function (tagg) {
      var navn = (tagg.match(/[a-zA-Z-]+=/g) || []).map(function (a) { return a.slice(0, -1); });
      var sett = {}, dobbel = '';
      navn.forEach(function (n) { if (sett[n]) dobbel = n; sett[n] = 1; });
      krev(!dobbel, k.id + ': attributtet «' + dobbel + '» settes to ganger i samme tagg',
           tagg.slice(0, 110));
    });
  });
});

// Bil.innhold() trenger et fullt `valgt`; her med all pynt på, så alle lagene
// faktisk blir tegnet.
function kjoretoyValgtRatt(id) {
  var v = Bil.standard();
  for (var f in ALT) v[f] = ALT[f];
  v.kjoretoy = id;
  return v;
}

/*
 * Kjøretøyet skal ikke telle på stilen. Det har sin egen ganger, og teller det
 * begge steder, ganges den samme fordelen opp to ganger – og da ryker
 * kalibreringen av `Bil.bonus()` uten at noe sier fra.
 */
var stilStunt = Bil.stil({ kjoretoy: 'stunt', form: 'racer', lakk: 'rod',
                           hjul: 'standard', dekor: [], spoiler: 'ingen', ekstra: [] });
var stilRom = Bil.stil({ kjoretoy: KJ[KJ.length - 1].id, form: 'racer', lakk: 'rod',
                         hjul: 'standard', dekor: [], spoiler: 'ingen', ekstra: [] });
krev(stilRom <= stilStunt, 'kjøretøyet teller på stilen i tillegg til sin egen ganger',
     stilStunt + ' mot ' + stilRom);

/* ---------- hva de tjener ---------- */

function kjoretoyValgt(id) {
  var v = Bil.standard();
  for (var f in ALT) v[f] = ALT[f];
  v.kjoretoy = id;
  return v;
}

function kjoretoyTur(id, oppgrad) {
  var v = kjoretoyValgt(id);
  return Fysikk.simuler(lope, oppgrad, Bil.bonus(v) * Bil.kjoretoyBonus(v)).penger;
}

var maksStunt = kjoretoyTur(KJ[0].id, MAKS);

KJ.forEach(function (k, i) {
  var fersk = kjoretoyTur(k.id, NAKEN);
  var full = kjoretoyTur(k.id, MAKS);
  console.log('  ' + k.navn + ': $' + k.pris + ' | ×' + k.inntekt.toFixed(2) +
              ' | fersk $' + fersk + ' | maksa $' + full +
              (i ? ' | fersk = ' + Math.round(fersk / maksStunt * 100) + ' % av maksa Stuntbil' : ''));

  if (!i) return;

  krev(fersk > kjoretoyTur(KJ[i - 1].id, NAKEN),
       k.id + ': en fersk bil tjener ikke mer enn en fersk av den forrige');
  krev(full > kjoretoyTur(KJ[i - 1].id, MAKS),
       k.id + ': en maksa bil tjener ikke mer enn en maksa av den forrige');

  /*
   * Steget ned rett etter kjøpet. Det *skal* være der – oppgraderingene
   * begynner på null, og det er hele poenget – men blir det for stort, er et
   * kjøp barnet gledet seg til det som gjør spillet tregest. En fjerdedel av
   * det den gamle bilen tjente er grensa, og den gamle bilen står igjen i
   * garasjen og tjener like mye som før uansett.
   */
  krev(fersk > maksStunt * 0.25,
       k.id + ': en fersk bil tjener så lite at kjøpet straffer seg',
       '$' + fersk + ' mot $' + maksStunt);

  /*
   * Og den må være verdt prisen. Et kjøretøy som aldri tjener inn det det
   * kostet, er en felle – barnet har spart lenge til det.
   */
  krev(full - maksStunt > k.pris / 40,
       k.id + ': tjener for lite ekstra til å forsvare prisen',
       '$' + (full - maksStunt) + ' mer per tur, pris $' + k.pris);
});

/* ---------- oppsummering ---------- */

console.log('\n' + (feil ? feil + ' feil av ' + gjort + ' krav' : 'alle ' + gjort + ' krav ok'));
process.exit(feil ? 1 : 0);
