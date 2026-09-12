/*
 * Prøver for hva som godtas som riktig skrevet svar.
 *
 *     node koordinatjakt/tester/svar.js
 *
 * Denne delen har to måter å ryke på, og begge er stille:
 *
 * - **For streng**, og arket måler rettskriving i stedet for koordinater.
 *   Et barn som fant sjiraffen og skrev «sjiraf», får nei, og gir opp på noe
 *   det faktisk fikk til.
 * - **For slapp**, og fasiten blir meningsløs. Med én bokstavs slingring på
 *   fire bokstaver er «kart» og «katt» samme svar, og barnet får rett uten å
 *   ha sett på ruta.
 *
 * Derfor står begge sider som krav her: en liste med skrivemåter som *må*
 * godtas, og en med svar som *ikke* får gå gjennom.
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
var Svar = last('svar', 'Svar');

var feil = 0, gjort = 0;

function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + verdi + ')' : ''));
}
function bolk(navn) { console.log('\n' + navn); }

// Hjelper: lag en oppgave av en brikke-id, uten et helt brett rundt.
function oppgave(id) {
  return { ord: Brikker.ord(id), alternativer: Brikker.alternativer(id) };
}
function godtar(svar, id, andreIder, streng) {
  return Svar.godtar(svar, oppgave(id), (andreIder || []).map(oppgave), streng);
}

/* --------------------------------------------------------- normalisering */

bolk('Normalisering');
krev(Svar.normaliser('  Løve ') === 'love', 'mellomrom og store bokstaver', Svar.normaliser('  Løve '));
krev(Svar.normaliser('en løve') === 'love', 'ubestemt artikkel strykes', Svar.normaliser('en løve'));
krev(Svar.normaliser('et tre') === 'tre', 'intetkjønnsartikkel strykes');
krev(Svar.normaliser('søppel-bøtte') === 'soppelbotte', 'bindestrek og æøå');
krev(Svar.normaliser('SJIRAFF') === 'sjiraff', 'bare store bokstaver');
krev(Svar.normaliser('') === '', 'tom tekst');
krev(Svar.normaliser(null) === '', 'null');

bolk('Avstand med ombytte');
krev(Svar.avstand('elefant', 'elefant') === 0, 'likt er null');
krev(Svar.avstand('elefnat', 'elefant') === 1, 'to ombyttede bokstaver koster én', Svar.avstand('elefnat', 'elefant'));
krev(Svar.avstand('sjiraf', 'sjiraff') === 1, 'en manglende bokstav koster én');
krev(Svar.avstand('ku', 'katt') === 3, 'ulike ord er langt fra hverandre');

/* ------------------------------------------------------- skal godtas */

bolk('Skrivemåter som må godtas');
[
  ['løve', 'love'], ['Løve', 'love'], ['LØVE', 'love'],
  ['løven', 'love'], ['løva', 'love'], ['løver', 'love'], ['løvene', 'love'],
  ['en løve', 'love'], [' løve ', 'love'],
  ['love', 'love'],                       // engelsk tastatur: ø skrevet som o
  ['sjiraf', 'sjiraff'],                  // én bokstav for lite
  ['sjiraffen', 'sjiraff'],
  ['elefnat', 'elefant'],                 // ombytte
  ['pingvinen', 'pingvin'],
  ['huset', 'hus'], ['hus', 'hus'],
  ['katten', 'katt'], ['katta', 'katt'], ['pus', 'katt'],
  ['fjøs', 'laave'], ['fjøset', 'laave'], ['låve', 'laave'],
  ['gatelys', 'lykt'], ['lykt', 'lykt'], ['lyktestolpe', 'lykt'],
  ['søppelkasse', 'boette'], ['bøtte', 'boette'], ['søppelbøtte', 'boette'],
  ['trafikklys', 'lyskryss'],
  ['bjørn', 'isbjorn'], ['isbjørnen', 'isbjorn'],
  ['høyhus', 'blokk'],
  ['springvann', 'fontene'],
  ['soppelbotte', 'boette']               // æøå uten æøå
].forEach(function (par) {
  krev(godtar(par[0], par[1]), '«' + par[0] + '» skal godtas som ' + Brikker.ord(par[1]));
});

/* ------------------------------------------------------- skal ikke godtas */

bolk('Svar som ikke skal gå gjennom');
[
  ['', 'love', 'tomt svar'],
  ['   ', 'love', 'bare mellomrom'],
  ['tiger', 'love', 'et annet dyr'],
  ['hus', 'katt', 'ett tegn fra «pus», men korte ord må treffe eksakt'],
  ['kart', 'katt', 'fire bokstaver tåler ingen slingring'],
  ['katt', 'kart', 'samme vei'],
  ['l', 'love', 'én bokstav'],
  ['elefa', 'elefant', 'halvskrevet ord'],
  ['kiosk', 'butikk', 'kiosk er sitt eget svar et annet sted']
].forEach(function (par) {
  krev(!godtar(par[0], par[1]), '«' + par[0] + '» skal ikke godtas som ' +
    Brikker.ord(par[1]) + ' – ' + par[2]);
});

bolk('Mens barnet skriver godtas bare eksakt treff');
krev(godtar('sjiraff', 'sjiraff', [], true), 'eksakt treff godtas også strengt');
krev(godtar('sjiraffen', 'sjiraff', [], true), 'bestemt form er en form, ikke en feil');
krev(!godtar('sjiraf', 'sjiraff', [], true), 'skrivefeil skal ikke låse feltet mens det skrives');
krev(!godtar('elefan', 'elefant', [], true), '«elefan» skal ikke låse feltet');

bolk('Tvetydig skrivefeil avvises');
/* «krokodille» og «flodhest» er langt fra hverandre, så et konstruert par
   må til: et svar som ligger like nær to ord på samme brett. */
krev(godtar('lyktestolpen', 'lykt'), 'entydig når det står alene');
krev(!godtar('kart', 'katt', ['kart']), 'ligger et annet ord på brettet like nær, må svaret være eksakt');

/* ----------------------------------------------------------- talte svar */

bolk('Lydforenkling');
[
  ['sjiraff', 'Siraf'],
  ['skole', 'skole'],        // «sk» er hardt foran o – ikke «sjole»
  ['skøyte', 'Soyte'],       // men mykt foran ø
  ['kirke', 'Cirke'],        // «k» er mykt foran i
  ['kanin', 'kanin'],        // og hardt foran a
  ['hund', 'hun'],
  ['katt', 'kat']
].forEach(function (par) {
  krev(Svar.forenkle(par[0]) === par[1],
    'forenkle(«' + par[0] + '») skal bli ' + par[1], Svar.forenkle(par[0]));
});

bolk('Talte svar godtas');
[
  [['løve'], 'love', 'ordet rett fram'],
  [['Løve.'], 'love', 'gjenkjenneren setter punktum og stor bokstav'],
  [['det er en løve'], 'love', 'barnet sier en hel setning'],
  [['grevling', 'revling', 'løve'], 'love', 'riktig ord ligger som tredje alternativ'],
  [['sjiraf'], 'sjiraff', 'gjenkjenneren skriver det den hørte'],
  [['lyktestolpen'], 'lykt', 'bestemt form'],
  [['gatelys'], 'lykt', 'et annet riktig ord'],
  [['fjøs'], 'laave', 'alternativ, talt']
].forEach(function (p) {
  krev(Svar.godtarTalt(p[0], oppgave(p[1]), []), p[2] + ': ' + JSON.stringify(p[0]) +
    ' skal godtas som ' + Brikker.ord(p[1]));
});

bolk('Talte svar som ikke skal gå gjennom');
krev(!Svar.godtarTalt(['grevling'], oppgave('love'), []), 'et annet ord');
krev(!Svar.godtarTalt([], oppgave('love'), []), 'ingenting hørt');
krev(!Svar.godtarTalt([''], oppgave('love'), []), 'tomt utsagn');
krev(!Svar.godtarTalt(['kart'], oppgave('katt'), []), 'korte ord må treffe, også på øret');
krev(!Svar.godtarTalt(['tiger'], oppgave('love'), [oppgave('tiger')]),
  'et annet funn på samme brett');
/* Lydveien må stoppes av den samme tvetydighetsregelen som skriveveien.
   To ekte ord som kolliderer finnes ikke i banken, så paret er konstruert. */
krev(!Svar.godtarTalt(['hunn'], { ord: 'hund', alternativer: [] }, [{ ord: 'hun', alternativer: [] }]),
  'et talt ord som høres ut som to ting på brettet');

/* --------------------------------------------------- ordene mot hverandre */

bolk('Ingen to brikker deler en skrivemåte');
var ider = Object.keys(Brikker.ALLE);
var eier = {};
ider.forEach(function (id) {
  Svar.former(Brikker.ord(id), Brikker.alternativer(id)).forEach(function (form) {
    krev(!eier[form] || eier[form] === id,
      'skrivemåten «' + form + '» tilhører både ' + eier[form] + ' og ' + id);
    eier[form] = eier[form] || id;
  });
});

bolk('Ingen to brikker høres like ut');
var lydeier = {};
ider.forEach(function (id) {
  Svar.former(Brikker.ord(id), Brikker.alternativer(id)).forEach(function (form) {
    var lyd = Svar.forenkle(form);
    krev(!lydeier[lyd] || lydeier[lyd] === id,
      'lyden «' + lyd + '» tilhører både ' + lydeier[lyd] + ' og ' + id);
    lydeier[lyd] = lydeier[lyd] || id;
  });
});

bolk('Alternativene er andre ord, ikke andre former');
ider.forEach(function (id) {
  Brikker.alternativer(id).forEach(function (alt) {
    var a = Svar.normaliser(alt), o = Svar.normaliser(Brikker.ord(id));
    krev(a !== o, id + ': «' + alt + '» er ordet selv');
  });
});

/* ------------------------------------------------- hele brett, hele veien */

bolk('Fasiten godtas på hvert eneste brett');
var runder = 0;
Temaer.IDER.forEach(function (tema) {
  for (var n = 1; n <= 120; n++) {
    var sc = Scene.lag(tema, n);
    var opp = Oppgaver.lag(sc, 16);
    opp.forEach(function (o) {
      var andre = opp.filter(function (a) { return a.rute !== o.rute; });
      runder++;
      // Selve fasiten må alltid gå gjennom, også med resten av brettet ved siden av.
      krev(Svar.godtar(o.ord, o, andre, false), tema + ' ' + n + ': fasiten «' + o.ord + '» ble ikke godtatt');
      krev(Svar.godtar(o.ord, o, andre, true), tema + ' ' + n + ': fasiten ble ikke godtatt mens den skrives');
      krev(Svar.godtarTalt([o.ord], o, andre), tema + ' ' + n + ': fasiten «' + o.ord + '» ble ikke godtatt talt');
      // Et annet ord på samme brett må aldri gå gjennom.
      if (andre.length) {
        var feilOrd = andre[0].ord;
        krev(!Svar.godtar(feilOrd, o, andre, false),
          tema + ' ' + n + ': «' + feilOrd + '» ble godtatt som ' + o.ord);
      }
    });
  }
});
console.log('  ' + runder + ' oppgaver prøvd');

console.log('\n' + (feil ? feil + ' feil av ' + gjort + ' krav' : 'Alt i orden – ' + gjort + ' krav'));
process.exit(feil ? 1 : 0);
