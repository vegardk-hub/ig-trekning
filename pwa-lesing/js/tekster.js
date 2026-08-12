/*
 * Lesetekstene. Seks tekster per truck, og rekkefølgen i lista er
 * rekkefølgen barnet møter dem i — indeks 0-5 hører til truck 0, 6-11 til
 * truck 1, og så videre.
 *
 * Tekstene handler om truckene med vilje. Belønningen skal ikke være et
 * fremmedelement som henges på lesingen etterpå; den skal være det samme
 * barnet nettopp leste om.
 *
 * Hver linje er én setning, for det er linja som utløser den lille tonen.
 * Hold dem under ti-tolv ord: en lang setning betyr lang tid før barnet får
 * noe tilbake, og gjenkjenneren driver av gårde underveis.
 */

(function () {
  'use strict';

  var tekster = [
    /* ---------- Ildkulen ---------- */
    { id: 't01', tittel: 'Motoren våkner', linjer: [
      'Ildkulen står midt i hallen.',
      'Motoren våkner med et brøl.'
    ] },
    { id: 't02', tittel: 'Store hjul', linjer: [
      'Hjulene er høyere enn en voksen mann.',
      'Dekkene har dype pigger av gummi.'
    ] },
    { id: 't03', tittel: 'Rød som lava', linjer: [
      'Ildkulen er rød som lava.',
      'På siden brenner det gule flammer.'
    ] },
    { id: 't04', tittel: 'Klar til start', linjer: [
      'Føreren spenner beltet og tar på hjelmen.',
      'Lyset skifter fra rødt til grønt.'
    ] },
    { id: 't05', tittel: 'Første hopp', linjer: [
      'Truckene kjører opp den bratte rampen.',
      'Ildkulen flyr over fem gamle biler.'
    ] },
    { id: 't06', tittel: 'Landing', linjer: [
      'Bakken rister når den lander.',
      'Alle på tribunen roper så høyt de kan.'
    ] },

    /* ---------- Tordenskrall ---------- */
    { id: 't07', tittel: 'Torden i hallen', linjer: [
      'Tordenskrall er blå som himmelen før regn.',
      'Motoren låter som torden langt borte.'
    ] },
    { id: 't08', tittel: 'Lyn på siden', linjer: [
      'To hvite lyn står malt på døra.',
      'De blinker når lyset treffer dem.'
    ] },
    { id: 't09', tittel: 'Turboen', linjer: [
      'Under panseret sitter en turbo.',
      'Den suger inn luft og gir motoren mer kraft.'
    ] },
    { id: 't10', tittel: 'Regn på banen', linjer: [
      'Det har regnet hele natten.',
      'Banen er full av søle og store dammer.'
    ] },
    { id: 't11', tittel: 'Sølesprut', linjer: [
      'Tordenskrall kjører rett gjennom dammen.',
      'Sølen spruter helt opp på tribunen.'
    ] },
    { id: 't12', tittel: 'Seieren', linjer: [
      'Tordenskrall kommer først over målstreken.',
      'Føreren rekker en neve ut av vinduet.'
    ] },

    /* ---------- Sumpmonsteret ---------- */
    { id: 't13', tittel: 'Fra sumpen', linjer: [
      'Sumpmonsteret er grønt som gammelt gress.',
      'Den ser ut som den har kjørt gjennom en myr.'
    ] },
    { id: 't14', tittel: 'Klomerker', linjer: [
      'Tre lange klomerker går over panseret.',
      'Det ser ut som et digert dyr har vært der.'
    ] },
    { id: 't15', tittel: 'Åtte sylindre', linjer: [
      'Motoren har åtte sylindre og åtte rør.',
      'Rørene peker rett opp i lufta.'
    ] },
    { id: 't16', tittel: 'Sølete dekk', linjer: [
      'Dekkene er tunge av våt leire.',
      'Sumpmonsteret kaster den av seg når hjulene spinner.'
    ] },
    { id: 't17', tittel: 'Gjennom gjørma', linjer: [
      'Ingen annen truck tør å kjøre den veien.',
      'Sumpmonsteret velger alltid den sølete siden.'
    ] },
    { id: 't18', tittel: 'Trygg på bunnen', linjer: [
      'Hjulene finner fast grunn under gjørma.',
      'Sakte og sikkert drar den seg opp på den andre siden.'
    ] },

    /* ---------- Nattravnen ---------- */
    { id: 't19', tittel: 'Truck i mørket', linjer: [
      'Nattravnen er lilla og nesten svart.',
      'Den er vanskelig å få øye på når solen har gått ned.'
    ] },
    { id: 't20', tittel: 'Stjerner på taket', linjer: [
      'Små sølvstjerner er malt over hele taket.',
      'De lyser svakt i mørket, som ekte stjerner.'
    ] },
    { id: 't21', tittel: 'Raketten bak', linjer: [
      'Bak på planet sitter en rakettmotor.',
      'Når den tennes, står det en blå flamme ut av røret.'
    ] },
    { id: 't22', tittel: 'Nattløpet', linjer: [
      'Løpet starter først når klokka er ni om kvelden.',
      'Bare lysene fra truckene viser hvor banen går.'
    ] },
    { id: 't23', tittel: 'Fart i svingen', linjer: [
      'Nattravnen tar den siste svingen på to hjul.',
      'Alle holder pusten mens den retter seg opp igjen.'
    ] },
    { id: 't24', tittel: 'Stille etterpå', linjer: [
      'Motoren stopper, og det blir helt stille.',
      'Bare lyden av varm metall som knirker er igjen.'
    ] },

    /* ---------- Frostbiten ---------- */
    { id: 't25', tittel: 'Kald som is', linjer: [
      'Frostbiten er isblå med hvite striper langs siden.',
      'Den ser ut som den er hugget ut av en isbre.'
    ] },
    { id: 't26', tittel: 'Uten lyd', linjer: [
      'Frostbiten går på strøm og har ingen eksos.',
      'Den eneste lyden er en svak, høy tone fra motoren.'
    ] },
    { id: 't27', tittel: 'Batteriet', linjer: [
      'Under gulvet ligger et batteri på flere hundre kilo.',
      'Det tar hele natten å lade det opp igjen.'
    ] },
    { id: 't28', tittel: 'Løp på isen', linjer: [
      'Banen er dekket av hard, blank is.',
      'Dekkene har små pigger av stål for å få feste.'
    ] },
    { id: 't29', tittel: 'Kraft med en gang', linjer: [
      'En elektrisk motor gir all kraften i samme sekund.',
      'Frostbiten er først fra start hver eneste gang.'
    ] },
    { id: 't30', tittel: 'Sporet i isen', linjer: [
      'Etter løpet står det et dypt spor igjen i isen.',
      'Man kan se nøyaktig hvor hun kjørte.'
    ] },

    /* ---------- Beinknuseren ---------- */
    { id: 't31', tittel: 'Tenner foran', linjer: [
      'Beinknuseren er oransje med store, hvite tenner malt foran.',
      'Den ser ut som den vil spise bilene den kjører over.'
    ] },
    { id: 't32', tittel: 'To luftinntak', linjer: [
      'To brede luftinntak stikker opp gjennom panseret.',
      'De suger inn all luften motoren trenger for å yte.'
    ] },
    { id: 't33', tittel: 'Bilstabelen', linjer: [
      'Tolv gamle biler er stablet i midten av banen.',
      'Ingen har klart å kjøre over hele stabelen før.'
    ] },
    { id: 't34', tittel: 'Opp på toppen', linjer: [
      'Beinknuseren tar fart fra det ene hjørnet.',
      'Forhjulene griper tak i den første bilen.'
    ] },
    { id: 't35', tittel: 'Balanse', linjer: [
      'På toppen står den stille et lite øyeblikk.',
      'Alle fire hjulene henger i lufta samtidig.'
    ] },
    { id: 't36', tittel: 'Ned igjen', linjer: [
      'Så tipper den forover og buldrer ned den andre siden.',
      'Bak den ligger tolv biler som er flatere enn før.'
    ] },

    /* ---------- Gullgraveren ---------- */
    { id: 't37', tittel: 'Gul over alt', linjer: [
      'Gullgraveren er malt i en gul farge som skinner.',
      'I sollys må man nesten myse for å se på den.'
    ] },
    { id: 't38', tittel: 'Den eldste', linjer: [
      'Denne trucken er den eldste i hele hallen.',
      'Den har kjørt løp lenger enn føreren har levd.'
    ] },
    { id: 't39', tittel: 'Verkstedet', linjer: [
      'Hver kveld står den inne på verkstedet.',
      'To mekanikere skrur på den til langt på natt.'
    ] },
    { id: 't40', tittel: 'Delene', linjer: [
      'Nesten ingen deler passer til en så gammel truck.',
      'De må lages for hånd, én om gangen.'
    ] },
    { id: 't41', tittel: 'Siste løp', linjer: [
      'I dag skal Gullgraveren kjøre sitt siste løp.',
      'Hele hallen står og klapper allerede før start.'
    ] },
    { id: 't42', tittel: 'Æresrunden', linjer: [
      'Den kjører en rolig runde rundt hele banen.',
      'Så parkerer den midt på, og motoren stanser for godt.'
    ] },

    /* ---------- Skyggeulven ---------- */
    { id: 't43', tittel: 'Grå som stein', linjer: [
      'Skyggeulven har ingen skarpe farger i det hele tatt.',
      'Den er grå som stein, fra tak til hjul.'
    ] },
    { id: 't44', tittel: 'Ingen vet', linjer: [
      'Ingen vet hvem som kjører den.',
      'Hjelmen har mørkt glass, og føreren sier aldri et ord.'
    ] },
    { id: 't45', tittel: 'Fire klomerker', linjer: [
      'Fire riper går på skrå over den ene døra.',
      'De er ikke malt på. De er ekte.'
    ] },
    { id: 't46', tittel: 'Vent og se', linjer: [
      'Skyggeulven ligger sist gjennom hele løpet.',
      'Den venter, akkurat som et dyr som jakter.'
    ] },
    { id: 't47', tittel: 'Siste runde', linjer: [
      'På siste runde kommer den opp på utsiden.',
      'Ingen hørte den komme før den var forbi.'
    ] },
    { id: 't48', tittel: 'Borte igjen', linjer: [
      'Da folk snudde seg mot målet, var den allerede vekk.',
      'Porten sto åpen, og garasjeplassen var tom.'
    ] }
  ];

  window.LeseTekster = {
    tekster: tekster,
    PER_TRUCK: 6,

    /* Teksten hører til trucken den bygger. Rekkefølgen i lista er avtalen. */
    truckFor: function (indeks) {
      return Math.floor(indeks / 6);
    },

    finn: function (id) {
      for (var i = 0; i < tekster.length; i++) {
        if (tekster[i].id === id) return tekster[i];
      }
      return null;
    },

    indeksFor: function (id) {
      for (var i = 0; i < tekster.length; i++) {
        if (tekster[i].id === id) return i;
      }
      return -1;
    },

    /* Alle ordene i en tekst, i lesrekkefølge, med linjenummer på hvert. */
    ord: function (tekst) {
      var ut = [];
      tekst.linjer.forEach(function (linje, li) {
        linje.split(/\s+/).forEach(function (o) {
          if (o) ut.push({ rå: o, linje: li });
        });
      });
      return ut;
    }
  };
})();
