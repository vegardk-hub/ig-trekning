/*
 * Bilen: delekatalogen og tegningen av den.
 *
 * Samme grep som truckene i Monstergiret – én tegnerutine og en tabell med
 * deler – men her velger barnet delene selv, så tabellen er delt i fem
 * kategorier som kan settes sammen fritt: form, lakk, hjul, dekor, spoiler.
 *
 * Formen eier alle målene. `dekorboks`, `spoilerfeste`, `tak`, `bakluke` og
 * `panser` ligger derfor på hver form og ikke i tegnerutinene, for et lyn
 * skal sitte på siden av karosseriet og en koffert på taket enten det er en
 * racer eller en monsterbil. Samme lærdom som
 * `apning` på figurene i Fargeflasker: hardkodede mål slutter å stemme i det
 * øyeblikket formen skifter.
 *
 * Hver del har en `stil`. Stilpoengene blir til en bonus på det man tjener i
 * løypa – det er slik pynt kan koste penger uten å konkurrere med motoren.
 */
'use strict';

var Bil = (function () {

  var BAKKE = 186;        // der hjulene står i tegningens viewBox
  var B = 400, H = 210;   // viewBox

  /*
   * Luft over bilen. Tilbehøret stables på taket, og fire ting oppå hverandre
   * på en lav racer rekker godt over der karosseriet slutter. Uten denne
   * marginen ble sirenen på toppen av tårnet klippet av viewBoxen.
   */
  var TAK = 46;

  /*
   * Blinking. To grupper som veksler i motfase: mens A lyser, er B dempet.
   * Lamper, gnister og stjerner deles mellom de to, så det alltid lyser noe
   * – blinker alt i takt, ser bilen ut som den slår seg av og på.
   *
   * Det finnes to helt ulike steder bilen tegnes, og de trenger hver sin vei:
   *
   *   Garasjen og verkstedet – bilen er en SVG i DOM-en, og da gjør CSS
   *   jobben. Delen får en klasse, og `styles.css` animerer den.
   *
   *   Løypa – bilen er et bilde tegnet på canvas, og et bilde animerer ikke.
   *   Der bakes fasen inn: `Bil.tegninger()` lager ett bilde per fase, og
   *   kjøringen bytter mellom dem i takt med klokka.
   *
   * Begge veier har nøyaktig de samme to tilstandene, så bilen blinker likt
   * i garasjen og i løypa.
   */
  var FASER = 2;

  function blink(gruppe, fase) {
    if (fase === undefined) return ' class="blink-' + gruppe + '"';
    var lyser = (gruppe === 'a') === (fase === 0);
    return ' opacity="' + (lyser ? 1 : 0.28) + '"';
  }

  /* ---------- former ---------- */

  var FORMER = [
    {
      id: 'racer', navn: 'Racer', pris: 0, stil: 2,
      tegn: '🏎️',
      hjul: [{ x: 98, y: BAKKE - 32, r: 32 }, { x: 300, y: BAKKE - 32, r: 32 }],
      dekorboks: { x: 70, y: 108, b: 230, h: 42 },
      spoilerfeste: { x: 60, y: 114 },
      /*
       * Bilen kjører mot høyre, og da må det lange panseret ligge til høyre
       * og kupeen bakover. Første utgave hadde det motsatt: frontlykta satt
       * riktig på høyre side, men karosseriet leste som en bil som kjørte
       * mot venstre med lykta bak. Toppkanten går derfor bakfra og fram:
       * kort bagasjeluke, bakrute opp, tak, frontrute ned, langt panser.
       */
      kropp: 'M34 152 L38 126 Q44 114 66 110 L106 106 L144 76 Q152 68 170 68 ' +
             'L214 68 Q230 68 238 78 L270 106 L348 112 Q374 116 374 134 L374 152 Z',
      rute: 'M126 102 L150 78 Q156 72 168 72 L182 72 L182 102 Z' +
            '~M196 72 L210 72 Q226 72 232 80 L250 102 L196 102 Z',
      strek: 'M38 126 L374 134',
      lykt: { x: 366, y: 126 },
      tak: { x: 192, y: 68 }, bakluke: { x: 86, y: 108 },
      panser: { x: 306, y: 110 }, eksosfeste: { x: 62, y: 140 }
    },
    {
      id: 'buggy', navn: 'Buggy', pris: 120, stil: 5,
      tegn: '🛺',
      hjul: [{ x: 100, y: BAKKE - 40, r: 40 }, { x: 302, y: BAKKE - 40, r: 40 }],
      dekorboks: { x: 84, y: 100, b: 220, h: 40 },
      spoilerfeste: { x: 66, y: 102 },
      kropp: 'M38 142 L46 112 Q52 100 76 98 L300 98 Q332 98 346 112 L368 142 Z',
      // Rullebur i mørk lakk. Tegnes som streker oppå kroppen.
      bur: 'M92 98 L134 48 L246 48 L280 98',
      // Ett stag, ikke fire. Med diagonaler i begge ender ble buret et
      // gitter man ikke leste som et bur. Buret sitter bak midten, slik at
      // det står igjen et panser foran – ellers er formen symmetrisk og
      // sier ikke hvilken vei bilen kjører.
      burstag: 'M134 48 L134 98~M246 48 L246 98',
      rute: '',
      strek: 'M46 120 L360 120',
      lykt: { x: 356, y: 112 },
      tak: { x: 190, y: 48 }, bakluke: { x: 62, y: 100 },
      panser: { x: 306, y: 99 }, eksosfeste: { x: 64, y: 128 }
    },
    {
      id: 'monster', navn: 'Monsterbil', pris: 320, stil: 9,
      tegn: '🚙',
      hjul: [{ x: 110, y: BAKKE - 52, r: 52 }, { x: 298, y: BAKKE - 52, r: 52 }],
      dekorboks: { x: 88, y: 52, b: 220, h: 48 },
      spoilerfeste: { x: 74, y: 70 },
      // Karosseriet sitter høyt over hjulene, med et understell imellom.
      // Det er den store høyden som gjør at man ser hvilken bil det er –
      // ikke at hjulene er noen piksler større. Vendt samme vei som raceren:
      // panseret fram, kupeen bak.
      understell: 'M84 96 L332 96 L332 130 L84 130 Z',
      kropp: 'M56 104 L60 66 Q68 52 90 50 L134 46 L172 18 Q180 10 198 10 ' +
             'L254 10 Q270 10 278 20 L306 46 L348 52 Q374 56 374 78 L374 104 Z',
      rute: 'M142 44 L172 20 Q178 14 190 14 L200 14 L200 44 Z' +
            '~M214 14 L252 14 Q264 14 270 22 L286 44 L214 44 Z',
      strek: 'M60 72 L374 78',
      lykt: { x: 364, y: 70 },
      tak: { x: 226, y: 10 }, bakluke: { x: 74, y: 56 },
      panser: { x: 324, y: 52 }, eksosfeste: { x: 80, y: 88 }
    },
    {
      id: 'buss', navn: 'Stuntbussen', pris: 260, stil: 7,
      tegn: '🚐',
      hjul: [{ x: 104, y: BAKKE - 34, r: 34 }, { x: 302, y: BAKKE - 34, r: 34 }],
      // Smalere enn på de andre: bussens dekorbånd ligger lavt, mellom
      // vinduene og terskelen, og hjulene dekker begge ender av det.
      dekorboks: { x: 132, y: 112, b: 172, h: 34 },
      spoilerfeste: { x: 58, y: 64 },
      kropp: 'M38 148 L38 70 Q38 58 54 58 L242 58 Q254 58 260 66 L292 100 ' +
             'L356 106 Q374 108 374 126 L374 148 Z',
      rute: 'M62 76 L132 76 L132 110 L62 110 Z' +
            '~M148 76 L218 76 L218 110 L148 110 Z' +
            '~M246 70 L282 102 L318 104 L272 70 Z',
      strek: 'M38 118 L374 126',
      lykt: { x: 366, y: 116 },
      tak: { x: 148, y: 58 }, bakluke: { x: 48, y: 60 },
      panser: { x: 322, y: 104 }, eksosfeste: { x: 58, y: 134 }
    }
  ];

  /* ---------- kjøretøy ---------- */

  /*
   * Et kjøretøy er noe annet enn en form, selv om det tegnes av de samme
   * feltene. Formene er pynt: de koster småpenger, og alle fire hører til den
   * samme bilen. Et kjøretøy er en **egen bil** – den har sine egne
   * oppgraderinger, og en ny en begynner på null.
   *
   * Det er derfor de ikke ligger i `FORMER` selv om de kunne tegnes derfra:
   * et bytte av form skal ikke røre motoren, og et bytte av kjøretøy skal
   * gjøre nettopp det.
   *
   * Den gamle bilen blir stående i garasjen, og man kan bytte tilbake når som
   * helst. Det er hele grunnen til at et nytt kjøretøy kan begynne på null
   * uten å være et tap: den maksa bilen er der fortsatt og tjener like mye som
   * før, så det å bygge opp en ny er noe man gjør *fordi man vil*, ikke noe
   * man blir tvunget gjennom.
   *
   * `inntekt` er grunnen til å gjøre det. Ytelsen kan ikke skrus opp – taket
   * på 1280 i toppfart er målt mot hopplengdene, og et kjøretøy som fløy
   * lengre ville seilt gjennom looper og forbi ramper. Så et dyrere kjøretøy
   * tjener mer per tur i stedet, og *ser* tøffere ut. Begge deler er ting et
   * barn ser med en gang.
   */
  var KJORETOY = [
    {
      id: 'stunt', navn: 'Stuntbilen', tegn: '🏎️', pris: 0, inntekt: 1,
      omtale: 'Bilen du startet med. Den eneste som kan bytte form i verkstedet.',
      // Ingen `kropp`: den henter karosseriet fra form-kategorien.
      former: true
    },

    {
      id: 'beist', navn: 'Beistet', tegn: '👹', pris: 10000, inntekt: 1.35,
      omtale: 'Ekte monstertruck: dekk i mannshøyde, synlige dempere og to eksosstakker.',
      /*
       * En monstertruck er *ikke* en bil med store hjul. Det som gjør den til
       * en monstertruck, er avstanden: et lite førerhus høyt oppe på en smal
       * ramme, med luft mellom karosseriet og gummien, og fjæringa synlig i
       * hullet. Uten det ser den bare ut som en oppjekket varebil.
       */
      hjul: [{ x: 92, y: BAKKE - 66, r: 66 }, { x: 312, y: BAKKE - 66, r: 66 }],
      dekorboks: { x: 118, y: 52, b: 168, h: 40 },
      spoilerfeste: { x: 98, y: 66 },
      /*
       * Ramma er smal og ligger høyt, og hjulene står *utenfor* den. Det er
       * lufta mellom karosseriet og gummien som gjør bilen til en
       * monstertruck – uten den er det bare en oppjekket varebil.
       */
      understell: 'M112 98 L296 98 L296 116 L112 116 Z',
      // Dempere ut til hvert hjul, tegnet som ei saks. Et første forsøk hadde
      // dem tynne og rett ned, og da forsvant de rett inn i skyggen under bilen.
      fjaering: 'M124 112 L92 152~M156 112 L92 152~M284 112 L312 152~M252 112 L312 152' +
                '~M112 118 L296 118~M92 128 L92 156~M312 128 L312 156',
      kropp: 'M114 102 L118 62 Q124 48 146 46 L178 42 L200 18 Q208 10 222 10 ' +
             'L258 10 Q270 10 278 20 L298 42 L322 48 Q338 52 338 72 L338 102 Z',
      rute: 'M182 40 L202 20 Q208 14 216 14 L222 14 L222 40 Z' +
            '~M234 14 L256 14 Q264 14 270 22 L282 40 L234 40 Z',
      bur: 'M134 46 L178 -2 L266 -2 L302 48',
      burstag: 'M178 -2 L178 42~M266 -2 L266 42',
      // Stakkene stikker rett opp gjennom panseret, som på en ekte pullingtruck.
      stakker: [{ x: 306, y: 50, h: 56 }, { x: 324, y: 56, h: 46 }],
      strek: 'M118 68 L338 72',
      lykt: { x: 330, y: 64 },
      tak: { x: 222, y: -2 }, bakluke: { x: 126, y: 54 },
      panser: { x: 314, y: 48 }, eksosfeste: { x: 120, y: 90 }
    },

    {
      id: 'panser', navn: 'Panservogna', tegn: '🛡️', pris: 20000, inntekt: 1.75,
      omtale: 'Beltegående, med tårn og kanon. Ingen vinduer — bare sikteglugger i stålet.',
      /*
       * Belter, ikke hjul. Seks små veihjul ruller inne i et beltebånd som
       * tegnes med karosseriet, og det er den ene endringen som gjør at dette
       * ikke lenger leser som en bil: silhuetten har ingen hjulbuer.
       *
       * Veihjulene får `stil: 'belte'`, så gummikanten er smal – det man ser,
       * er stålet utenfor, ikke dekket.
       */
      hjul: [
        { x: 84, y: BAKKE - 28, r: 21, stil: 'belte' },
        { x: 132, y: BAKKE - 28, r: 21, stil: 'belte' },
        { x: 180, y: BAKKE - 28, r: 21, stil: 'belte' },
        { x: 228, y: BAKKE - 28, r: 21, stil: 'belte' },
        { x: 276, y: BAKKE - 28, r: 21, stil: 'belte' },
        { x: 324, y: BAKKE - 28, r: 21, stil: 'belte' }
      ],
      belte: { x0: 84, x1: 324, y: BAKKE - 28, r: 34 },
      dekorboks: { x: 92, y: 106, b: 216, h: 26 },
      spoilerfeste: { x: 56, y: 104 },
      /*
       * Skroget er lavt, langt og kantete, med en skrå glacisplate foran.
       * Ikke én kurve i hele formen – alt annet i garasjen er rundet, så en
       * form uten kurver leser som pansret helt av seg selv.
       */
      kropp: 'M36 150 L36 106 L70 92 L288 92 L322 102 L382 130 L382 150 Z',
      // Ingen `rute`: et pansret kjøretøy har ikke frontrute. Gluggene sitter
      // i tårnet og tegnes i stål-mørkt, ikke i glassblått.
      nagler: [
        { x: 48, y: 112 }, { x: 48, y: 134 }, { x: 48, y: 146 },
        { x: 86, y: 100 }, { x: 130, y: 100 }, { x: 246, y: 100 }, { x: 290, y: 100 },
        { x: 322, y: 110 }, { x: 348, y: 122 }, { x: 372, y: 138 },
        { x: 100, y: 142 }, { x: 170, y: 142 }, { x: 240, y: 142 }, { x: 310, y: 142 }
      ],
      // Tårnet: en avkortet pyramide, og kanonen som peker framover.
      taarn: 'M138 92 L152 54 L236 54 L252 92 Z',
      kanon: { x: 240, y: 64, lengde: 138 },
      glugge: 'M168 62 L214 62 L214 72 L168 72 Z',
      strek: 'M36 118 L382 140',
      lykt: { x: 364, y: 128 },
      tak: { x: 194, y: 54 }, bakluke: { x: 44, y: 100 },
      panser: { x: 318, y: 98 }, eksosfeste: { x: 46, y: 140 }
    },

    {
      id: 'jet', navn: 'Jetbilen', tegn: '🔥', pris: 30000, inntekt: 2.30,
      omtale: 'En jetmotor med hjul på. Førerhuset er en boble foran turbinen.',
      /*
       * Her er motoren *hele* kjøretøyet. En dragster med et panser oppå ville
       * bare vært en lang bil; en turbin med et lite førerhus foran seg er noe
       * annet, og det er forskjellen barnet ser.
       */
      hjul: [{ x: 120, y: BAKKE - 46, r: 46 }, { x: 352, y: BAKKE - 18, r: 18 }],
      dekorboks: { x: 250, y: 120, b: 110, h: 22 },
      spoilerfeste: { x: 58, y: 72 },
      // Selve ramma: en tynn bjelke fra turbinen og fram til forhjulet.
      kropp: 'M50 150 L50 96 L84 88 L246 92 L284 116 L376 142 Q392 146 392 154 L392 160 Z',
      /*
       * Boblekupé foran turbinen, ikke et bilvindu. Den lå først bak
       * innsuget og ble til en liten blå flekk – nå står den godt foran, med
       * hele boblen i friluft.
       */
      rute: 'M266 112 Q272 76 300 76 Q328 76 334 114 Z',
      turbin: { x: 58, y: 60, b: 182, h: 58 },
      // Halefinne over turbinen, som på et fly.
      finne: 'M54 64 L80 12 L108 12 L112 64 Z',
      strek: 'M54 128 L386 154',
      dyser: [{ x: 58, y: 89, lengde: 86 }],
      lykt: { x: 382, y: 152 },
      tak: { x: 300, y: 76 }, bakluke: { x: 62, y: 72 },
      panser: { x: 348, y: 130 }, eksosfeste: { x: 88, y: 142 }
    },

    {
      id: 'rom', navn: 'Romfartøyet', tegn: '🛸', pris: 40000, inntekt: 3.00,
      omtale: 'Linseformet skrog, glasskuppel og tre motorer. Det svever — det har ikke dekk.',
      /*
       * Ingen hjulbuer, ingen panserlinje, ingen frontrute: et skrog som er
       * spisst i begge ender og tykkest på midten. Det er linseformen som gjør
       * at den ikke leser som en bil, uansett hvor mye neon man legger på.
       *
       * «Hjulene» er svevende puter (`stil: 'sveve'`) – en glødende skive i
       * hjuldesignets egen farge i stedet for gummi. Da virker både
       * hjulvalget og dekk-tieret på et fartøy som ikke har dekk.
       */
      hjul: [
        { x: 124, y: BAKKE - 32, r: 32, stil: 'sveve' },
        { x: 282, y: BAKKE - 32, r: 32, stil: 'sveve' }
      ],
      dekorboks: { x: 116, y: 106, b: 180, h: 26 },
      spoilerfeste: { x: 70, y: 96 },
      kropp: 'M18 124 Q70 82 204 78 Q338 82 390 124 Q338 152 204 156 Q70 152 18 124 Z',
      // Kuppelen, ikke en frontrute.
      rute: 'M152 80 Q170 34 222 34 Q274 34 292 80 Z',
      // Svevefinne bak, svakt tilbakestrøket.
      finne: 'M58 106 L96 44 L126 44 L114 100 Z',
      strek: 'M40 114 L378 118',
      // Tre motorer i hekken, ikke én.
      dyser: [
        { x: 44, y: 104, lengde: 56 },
        { x: 34, y: 124, lengde: 72 },
        { x: 44, y: 144, lengde: 56 }
      ],
      /*
       * Neonstripa ligger *under* skroget. Der leser den som at fartøyet
       * svever; oppå skroget er den bare en stripe i lakken.
       */
      neon: 'M96 160 L322 160',
      kjegler: [{ x: 124, y: 150, b: 44 }, { x: 282, y: 150, b: 44 }],
      antenne: { x: 250, y: 40 },
      lykt: { x: 372, y: 122 },
      tak: { x: 222, y: 34 }, bakluke: { x: 60, y: 100 },
      panser: { x: 332, y: 96 }, eksosfeste: { x: 70, y: 140 }
    }
  ];

  function finnKjoretoy(id) { return finn(KJORETOY, id); }

  /*
   * Karosseriet til det kjøretøyet som er valgt. Stuntbilen henter det fra
   * form-kategorien, de andre eier sitt eget. Alt som tegner bilen går gjennom
   * denne, så garasjen, verkstedet, delelista og løypa aldri kan vise hvert
   * sitt karosseri.
   */
  function karosseri(valgt) {
    var k = finnKjoretoy(valgt.kjoretoy);
    return k.kropp ? k : finn(FORMER, valgt.form);
  }

  /* ---------- lakk ---------- */
  // `mork` brukes til skygge og understell, `pynt` til detaljer som skal lyse
  // mot karosseriet.

  var LAKKER = [
    { id: 'rod',     navn: 'Ildrød',     pris: 0,   stil: 1, farge: '#e0342a', mork: '#9c1f18', pynt: '#ffd24a' },
    { id: 'bla',     navn: 'Turboblå',   pris: 40,  stil: 2, farge: '#2f6ed4', mork: '#1c4694', pynt: '#e8f2ff' },
    { id: 'gronn',   navn: 'Giftgrønn',  pris: 40,  stil: 2, farge: '#3fae44', mork: '#256c28', pynt: '#e6ff8a' },
    { id: 'lilla',   navn: 'Nattlilla',  pris: 70,  stil: 3, farge: '#7b45b8', mork: '#472668', pynt: '#e0c9ff' },
    { id: 'oransje', navn: 'Lavaoransje',pris: 70,  stil: 3, farge: '#f07a18', mork: '#a3480a', pynt: '#fff0c2' },
    { id: 'rosa',    navn: 'Sjokkrosa',  pris: 110, stil: 4, farge: '#f0479c', mork: '#a41f61', pynt: '#ffe3f2' },
    { id: 'krom',    navn: 'Krom',       pris: 220, stil: 8, farge: '#c8d2dd', mork: '#7a8794', pynt: '#ffffff', blank: true },
    { id: 'gull',    navn: 'Gull',       pris: 300, stil: 10, farge: '#f0bf2a', mork: '#9c7508', pynt: '#fff4c2', blank: true },
    { id: 'regnbue', navn: 'Regnbue',    pris: 420, stil: 14, farge: '#ff5aa0', mork: '#5a2d8c', pynt: '#ffffff', regnbue: true }
  ];

  /* ---------- hjul ---------- */

  var HJUL = [
    { id: 'standard', navn: 'Vanlige',   pris: 0,   stil: 0, felg: '#cfd8e3', dekk: '#23262b', eiker: 5 },
    { id: 'terreng',  navn: 'Terreng',   pris: 90,  stil: 3, felg: '#e8d5b0', dekk: '#1c1f24', eiker: 6, grov: true },
    { id: 'gull',     navn: 'Gullfelg',  pris: 200, stil: 6, felg: '#f2c94c', dekk: '#23262b', eiker: 8 },
    { id: 'neon',     navn: 'Neonfelg',  pris: 280, stil: 9, felg: '#5ddcff', dekk: '#191c21', eiker: 6, glod: '#5ddcff' },
    { id: 'ild',      navn: 'Ildhjul',   pris: 380, stil: 12, felg: '#ff8a1e', dekk: '#20140e', eiker: 6, glod: '#ff8a1e', grov: true }
  ];

  /* ---------- dekor ---------- */

  /*
   * Dekor er den eneste kategorien der flere deler kan stå på samtidig, og
   * det er hele poenget: et barn som setter på stjerner skal ikke miste lynet
   * det nettopp kjøpte. Derfor er `valgt.dekor` en liste, ikke én id.
   *
   * For at det skal gå an, har hver type sin egen `sone` – en andel av
   * formens `dekorboks`. De fire figurene står på rekke bakfra og fram:
   *
   *     striper  langs over- og underkanten, hele lengden
   *     stjerner | lyn | flammer | tenner
   *     glitter  over alt
   *
   * Et første forsøk stablet dem i tre rader oppå hverandre. Det virket, men
   * en bilside er lang og lav, og en tredjedels høyde gjorde flammene til en
   * gul flekk. På rekke får hver figur en nesten kvadratisk plass, og med
   * alle på er bilen dekket fra bak til front.
   *
   * Glitteret ligger over alt og er med vilje unntaket: gnister skal kunne
   * falle oppå det andre.
   *
   * Stilverdiene er lavere enn da bare én kunne stå på – de legges nå sammen,
   * og seks deler à 10 ville sprengt stilbonusen.
   */
  var DEKOR = [
    { id: 'striper',  navn: 'Striper',   pris: 40,  stil: 2, tegn: '➖',
      sone: { x0: 0.00, x1: 1.00, y0: 0.00, y1: 1.00 } },
    { id: 'stjerner', navn: 'Stjerner',  pris: 110, stil: 4, tegn: '⭐',
      sone: { x0: 0.01, x1: 0.25, y0: 0.18, y1: 0.84 } },
    { id: 'lyn',      navn: 'Lyn',       pris: 90,  stil: 4, tegn: '⚡',
      sone: { x0: 0.26, x1: 0.50, y0: 0.18, y1: 0.84 } },
    { id: 'flammer',  navn: 'Flammer',   pris: 130, stil: 5, tegn: '🔥',
      sone: { x0: 0.51, x1: 0.75, y0: 0.18, y1: 0.84 } },
    { id: 'tenner',   navn: 'Tenner',    pris: 160, stil: 5, tegn: '🦈',
      sone: { x0: 0.76, x1: 0.99, y0: 0.18, y1: 0.84 } },
    { id: 'glitter',  navn: 'Glitter',   pris: 190, stil: 6, tegn: '✨',
      sone: { x0: 0.00, x1: 1.00, y0: 0.00, y1: 1.00 } }
  ];

  /* ---------- ekstra: ting som settes på bilen ---------- */

  /*
   * Tilbehør, i motsetning til dekor: dette er gjenstander som sitter *på*
   * bilen, ikke mønstre malt på siden. Flere kan stå på samtidig, som dekor.
   *
   * `plass` sier hvor delen fester seg — `tak`, `bakluke` eller `panser` —
   * og formen eier de tre punktene.
   *
   * Takdelene stables: hver av dem har en `hoyde`, og neste del legger seg
   * oppå den forrige. Det er det som gjør at ett valg ligger pent på taket
   * mens fire blir et komisk tårn. Faste lag ville gitt luft under en del
   * hvis den under ikke var kjøpt.
   *
   * Rekkefølgen i lista er stableorden nedenfra: koffert nederst, sirene
   * øverst.
   */
  var EKSTRA = [
    { id: 'koffert',   navn: 'Takkoffert',  pris: 160, stil: 4, tegn: '🧳', plass: 'tak', hoyde: 24 },
    { id: 'surfebrett',navn: 'Surfebrett',  pris: 220, stil: 5, tegn: '🏄', plass: 'tak', hoyde: 16 },
    { id: 'lysboyle',  navn: 'Lysbøyle',    pris: 180, stil: 5, tegn: '💡', plass: 'tak', hoyde: 25 },
    { id: 'sirene',    navn: 'Sirene',      pris: 260, stil: 6, tegn: '🚨', plass: 'tak', hoyde: 23 },
    { id: 'ballonger', navn: 'Ballonger',   pris: 110, stil: 4, tegn: '🎈', plass: 'bakluke' },
    { id: 'eksos',     navn: 'Eksosrør',    pris: 140, stil: 4, tegn: '💨', plass: 'eksosfeste' },
    { id: 'and',       navn: 'Gummiand',    pris: 60,  stil: 3, tegn: '🦆', plass: 'panser' },
    { id: 'vimpel',    navn: 'Vimpel',      pris: 80,  stil: 3, tegn: '🚩', plass: 'panser' }
  ];

  /* ---------- spoiler ---------- */

  var SPOILERE = [
    { id: 'ingen',  navn: 'Ingen',        pris: 0,   stil: 0,  tegn: '⬜' },
    { id: 'liten',  navn: 'Liten',        pris: 60,  stil: 3,  tegn: '▬' },
    { id: 'stor',   navn: 'Stor vinge',   pris: 160, stil: 7,  tegn: '🪽' },
    { id: 'dobbel', navn: 'Dobbeltvinge', pris: 300, stil: 11, tegn: '🛩️' },
    { id: 'rakett', navn: 'Rakettmotor',  pris: 420, stil: 14, tegn: '🚀' }
  ];

  var KATEGORIER = [
    { id: 'form',    navn: 'Form',    tegn: '🚗', liste: FORMER },
    { id: 'lakk',    navn: 'Lakk',    tegn: '🎨', liste: LAKKER },
    { id: 'hjul',    navn: 'Hjul',    tegn: '🛞', liste: HJUL },
    { id: 'dekor',   navn: 'Dekor',   tegn: '✨', liste: DEKOR, flere: true },
    { id: 'spoiler', navn: 'Spoiler', tegn: '🪽', liste: SPOILERE },
    { id: 'ekstra',  navn: 'Ekstra',  tegn: '🧳', liste: EKSTRA, flere: true }
  ];

  function finn(liste, id) {
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return liste[0];
  }

  // Dekoren returneres i katalogens rekkefølge, ikke i den rekkefølgen barnet
  // trykket. Da er lagdelingen fast: striper nederst, glitter øverst, uansett
  // hva som ble kjøpt først.
  function valgtDekor(valgt) {
    var pa = valgt.dekor || [];
    return DEKOR.filter(function (d) { return pa.indexOf(d.id) >= 0; });
  }

  function valgtEkstra(valgt) {
    var pa = valgt.ekstra || [];
    return EKSTRA.filter(function (d) { return pa.indexOf(d.id) >= 0; });
  }

  function deler(valgt) {
    return {
      form: karosseri(valgt),
      kjoretoy: finnKjoretoy(valgt.kjoretoy),
      lakk: finn(LAKKER, valgt.lakk),
      hjul: finn(HJUL, valgt.hjul),
      dekor: valgtDekor(valgt),
      spoiler: finn(SPOILERE, valgt.spoiler),
      ekstra: valgtEkstra(valgt)
    };
  }

  // Stilpoengene summeres over alle fem kategoriene. Bonusen er med vilje
  // flat nok til at ingen enkeltdel avgjør alt: full pynt gir omtrent
  // dobbelt så mye per mynt som en helt naken bil.
  /*
   * Stilpoengene er *bare* pynt man har skrudd på. Kjøretøyet teller ikke med,
   * selv om et romfartøy er tøffere enn en racer: det har sin egen
   * `inntekt`-ganger, og teller det i tillegg på stilen, ganges den samme
   * fordelen opp to ganger. Ett kjøretøy, ett tall.
   *
   * `d.form` er kjøretøyet selv når kjøretøyet eier karosseriet, så
   * formpoengene hentes bare når det er Stuntbilen som kjører.
   */
  function stil(valgt) {
    var d = deler(valgt);
    var sum = (d.kjoretoy.kropp ? 0 : d.form.stil) +
              d.lakk.stil + d.hjul.stil + d.spoiler.stil;
    for (var i = 0; i < d.dekor.length; i++) sum += d.dekor[i].stil;
    for (i = 0; i < d.ekstra.length; i++) sum += d.ekstra[i].stil;
    return sum;
  }

  // Kjøretøyets egen ganger på alt man tjener. Den er grunnen til å bygge opp
  // en ny bil fra null: ytelsen har et tak som ikke kan røres, inntekten har
  // ikke det.
  function kjoretoyBonus(valgt) {
    return finnKjoretoy(valgt.kjoretoy).inntekt;
  }

  // Nevneren er satt slik at en fullt pyntet bil lander rundt ×2,1. Legger du
  // til en dekortype, øker maks stil, og nevneren må følge etter – ellers
  // vokser inntekten i løypa uten at noe annet er endret.
  function bonus(valgt) {
    return 1 + stil(valgt) / 104;
  }

  /* ---------- tegning ---------- */

  function baner(d, klasse) {
    // Flere delstier i ett felt skilles med ~. Enklere enn en liste per form
    // når de aller fleste har én eller to.
    if (!d) return '';
    var ut = '', biter = d.split('~');
    for (var i = 0; i < biter.length; i++) ut += '<path d="' + biter[i] + '" ' + klasse + '/>';
    return ut;
  }

  /* ---------- hjulet, og hva dekk-tieret gjør med det ---------- */

  /*
   * Dekktieret er den eneste oppgraderingen man *ser*. Motor og girkasse er
   * tall; felgen er et bilde, og den er det som gjør at et nytt tier kjennes
   * som noe og ikke bare som en dyrere pipe i en meter.
   *
   * Lagene stables: et tier legger til noe, det fjerner aldri noe. Slik blir
   * øverste tier summen av alt, og barnet kjenner igjen det det allerede
   * hadde.
   *
   *    1  Stål     – dekk, felg, eiker, nav
   *    2  Bronse   – skygge i gummien og felgkant i tierfargen
   *    3  Smaragd  – boltring i tierfargen
   *    4  Safir    – bremseskive bak eikene, i tierfargen
   *    5  Ametyst  – farget navkapsel
   *    6  Rubin    – neonring inne i felgen, blinker
   *    7  Magma    – lys i eikene, i motfase
   *    8  Gull     – enda en ring lenger ut
   *    9  Plasma   – gnister rundt felgkanten
   *   10  Kvantum  – full glorie utenfor dekket
   *
   * Ett lag per tier er ikke tilfeldig: et tier som ikke endrer noe man ser,
   * er en dyrere pipe i en meter. Legger du til tiere, må denne lista deles
   * på nytt – ikke stables opp i toppen.
   *
   * Ingen `<filter>`. Glød lages av tre konsentriske streker med fallende
   * bredde og stigende ugjennomsiktighet. Et SVG-filter ville vært penere,
   * men tegningen serialiseres til en data-URL og rastreres per designbytte –
   * filtre er både trege og upålitelige den veien.
   */
  var STANDARDTIER = { n: 1, farge: '#9aa7bd' };

  // Tre streker utenpå hverandre leser som lys. Bredden faller og
  // ugjennomsiktigheten stiger innover, så kanten er skarp og halo-en myk.
  function glorie(x, y, r, farge, bredde, styrke, b) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r.toFixed(1) +
             '" fill="none" stroke="' + farge + '" stroke-width="' + (bredde * 3.4).toFixed(1) +
             '" stroke-opacity="' + (0.13 * styrke).toFixed(2) + '"' + b + '/>' +
           '<circle cx="' + x + '" cy="' + y + '" r="' + r.toFixed(1) +
             '" fill="none" stroke="' + farge + '" stroke-width="' + (bredde * 1.9).toFixed(1) +
             '" stroke-opacity="' + (0.3 * styrke).toFixed(2) + '"' + b + '/>' +
           '<circle cx="' + x + '" cy="' + y + '" r="' + r.toFixed(1) +
             '" fill="none" stroke="' + farge + '" stroke-width="' + bredde.toFixed(1) +
             '" stroke-opacity="' + (0.95 * styrke).toFixed(2) + '"' + b + '/>';
  }

  function hjulTegning(h, hj, i, fase, tier) {
    var t = tier || STANDARDTIER;
    var niva = t.n || 1;
    var tf = t.farge || STANDARDTIER.farge;
    var g = '<g>', e, v;

    // Tier 10: halo utenfor selve dekket, så hjulet lyser opp asfalten rundt seg.
    if (niva >= 10) {
      g += glorie(h.x, h.y, h.r * 1.12, tf, h.r * 0.10, 1, blink('a', fase));
    }

    /*
     * Gummien, og de to kjøretøyene som ikke har gummi.
     *
     * `h.stil` kommer fra kjøretøyets egen hjulliste og er det som gjør at et
     * belteknekt og et svevefartøy kan bruke den *samme* tegnerutinen som en
     * bil. Alt annet – felg, eiker, nav og alle ti tier-lagene – er likt, så
     * barnets valgte hjuldesign og dekk-tier vises på alle fem kjøretøyene.
     */
    if (h.stil === 'sveve') {
      // Svevepute: ingen gummi i det hele tatt, bare en glødende skive. Et
      // romfartøy med dekk er ikke et romfartøy.
      var gl = hj.glod || hj.felg;
      g += glorie(h.x, h.y, h.r * 0.92, gl, h.r * 0.20, 0.9, '');
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.80).toFixed(1) +
           '" fill="' + gl + '" fill-opacity="0.30"/>';
    } else if (h.stil === 'belte') {
      // Veihjul inne i beltet: bare en smal gummikant, for beltebåndet
      // utenfor er det man faktisk ser.
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + h.r + '" fill="' + hj.dekk + '"/>';
    } else {
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + h.r + '" fill="' + hj.dekk + '"/>';
      if (hj.grov) {
        g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r - 5) + '" fill="none" stroke="' +
             hj.dekk + '" stroke-width="12" stroke-dasharray="10 9"/>';
      }
    }

    /*
     * Skyggen i dekket, fra tier 2. En bue langs innsiden av gummien i stedet
     * for en hel ring: lys ovenfra betyr skygge nederst, og en jevn ring rundt
     * hele dekket leser som en strek og ikke som rundhet.
     */
    if (niva >= 2 && h.stil !== 'sveve') {
      g += '<path d="M' + (h.x - h.r * 0.82).toFixed(1) + ' ' + (h.y + h.r * 0.28).toFixed(1) +
           ' A ' + (h.r * 0.87).toFixed(1) + ' ' + (h.r * 0.87).toFixed(1) + ' 0 0 0 ' +
           (h.x + h.r * 0.82).toFixed(1) + ' ' + (h.y + h.r * 0.28).toFixed(1) +
           '" fill="none" stroke="#000000" stroke-opacity="0.34" stroke-width="' +
           (h.r * 0.16).toFixed(1) + '" stroke-linecap="round"/>';
    }

    // Tier 4: bremseskive bak eikene, i tierfargen.
    if (niva >= 4) {
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.70).toFixed(1) +
           '" fill="' + tf + '" fill-opacity="0.22"/>';
    }

    g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.62).toFixed(1) +
         '" fill="' + hj.felg + '"' + (h.stil === 'sveve' ? ' fill-opacity="0.45"' : '') + '/>';

    /*
     * Tier 2: felgkant i tierfargen. Dette er det første stedet fargen vises,
     * og den må vises tidlig. Et første forsøk ga tier 2 og 3 bare en skygge
     * i gummien og hvite bolter – de så ut nøyaktig som tier 1, mens navnet
     * og fargen i verkstedet sa noe helt annet. Et tier man ikke ser, er en
     * dyrere pipe i en meter.
     */
    if (niva >= 2) {
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.62).toFixed(1) +
           '" fill="none" stroke="' + tf + '" stroke-width="' +
           (h.r * 0.09).toFixed(1) + '"/>';
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.58).toFixed(1) +
           '" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="' +
           (h.r * 0.03).toFixed(1) + '"/>';
    }

    // Tier 3: en ring med bolter, også i tierfargen.
    if (niva >= 3) {
      for (e = 0; e < 6; e++) {
        v = (e * 60 + i * 18) * Math.PI / 180;
        g += '<circle cx="' + (h.x + Math.cos(v) * h.r * 0.34).toFixed(1) +
             '" cy="' + (h.y + Math.sin(v) * h.r * 0.34).toFixed(1) +
             '" r="' + (h.r * 0.055).toFixed(1) + '" fill="' + tf + '"/>';
      }
    }

    /*
     * Eikene. På en svevepute tegnes de i glødefargen i stedet for i den
     * svarte gummifargen: svarte eiker er det tydeligste hjul-signalet som
     * finnes, og med dem så puta ut som et hjul uansett hvor mye den glødet.
     */
    var eikefarge = h.stil === 'sveve' ? (hj.glod || hj.felg) : hj.dekk;
    for (e = 0; e < hj.eiker; e++) {
      v = (e * 360 / hj.eiker + i * 18) * Math.PI / 180;
      var x1 = (h.x + Math.cos(v) * h.r * 0.18).toFixed(1);
      var y1 = (h.y + Math.sin(v) * h.r * 0.18).toFixed(1);
      var x2 = (h.x + Math.cos(v) * h.r * 0.55).toFixed(1);
      var y2 = (h.y + Math.sin(v) * h.r * 0.55).toFixed(1);
      g += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
           '" stroke="' + eikefarge + '" stroke-width="' + (h.r * 0.12).toFixed(1) +
           '" stroke-linecap="round"/>';
      // Tier 7: lys midt i hver eike, i motfase av ringene.
      if (niva >= 7) {
        g += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
             '" stroke="' + tf + '" stroke-width="' + (h.r * 0.05).toFixed(1) +
             '" stroke-linecap="round"' + blink('b', fase) + '/>';
      }
    }

    g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.17).toFixed(1) +
         '" fill="' + eikefarge + '"/>';

    // Tier 5: farget navkapsel oppå navet.
    if (niva >= 5) {
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.11).toFixed(1) +
           '" fill="' + tf + '"/>';
    }

    // Tier 6: neonring inne i felgen. Tier 8 legger en til lenger ut, i motfase.
    if (niva >= 6) {
      g += glorie(h.x, h.y, h.r * 0.50, tf, h.r * 0.055, 1, blink('a', fase));
    }
    if (niva >= 8) {
      g += glorie(h.x, h.y, h.r * 0.68, tf, h.r * 0.045, 0.85, blink('b', fase));
    }

    /*
     * Tier 9: gnister rundt felgkanten. De står fast i forhold til hjulet, så
     * de snurrer med det i løypa – et mønster som ikke fulgte hjulet, ville
     * sett ut som et lag som lå og flimret oppå.
     */
    if (niva >= 9) {
      for (e = 0; e < 10; e++) {
        v = (e * 36 + i * 18) * Math.PI / 180;
        g += '<circle cx="' + (h.x + Math.cos(v) * h.r * 0.86).toFixed(1) +
             '" cy="' + (h.y + Math.sin(v) * h.r * 0.86).toFixed(1) +
             '" r="' + (h.r * 0.06).toFixed(1) + '" fill="#ffffff"' +
             blink(e % 2 ? 'a' : 'b', fase) + '/>';
      }
    }

    // Designhjulets egen glød ligger ytterst, så den ikke forsvinner under
    // tierlagene. Den er valgt og betalt for, og skal fortsatt synes.
    if (hj.glod) {
      g += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + (h.r * 0.78).toFixed(1) +
           '" fill="none" stroke="' + hj.glod + '" stroke-width="3"' + blink('a', fase) + '/>';
    }
    return g + '</g>';
  }

  // Fra andeler av formens dekorboks til en ekte boks i tegningens
  // koordinater. Sonene er andeler nettopp fordi hver form har sin egen
  // dekorboks – en monsterbil har mye høyere side enn en racer.
  function sone(boks, s) {
    return {
      x: boks.x + boks.b * s.x0,
      y: boks.y + boks.h * s.y0,
      b: boks.b * (s.x1 - s.x0),
      h: boks.h * (s.y1 - s.y0)
    };
  }

  /*
   * Hver figur tegnes i enhetskoordinater innenfor sin egen sone: u og v går
   * fra 0 til 1. Da fyller den plassen sin uansett hvilken form bilen har og
   * hvor stor sonen er, og en ny dekortype er en `switch`-gren uten et eneste
   * mål å regne ut på nytt.
   */
  function dekorTegning(id, boks, lakk, fase) {
    var lys = lakk.pynt, mork = lakk.mork, s = '', i;

    function X(u) { return (boks.x + boks.b * u).toFixed(1); }
    function Y(v) { return (boks.y + boks.h * v).toFixed(1); }

    switch (id) {
      // Striper er ikke en figur, men en ramme: to bånd langs over- og
      // underkanten av hele flata, med midten fri til de andre.
      case 'striper':
        return '<rect x="' + X(0) + '" y="' + Y(0.02) + '" width="' + boks.b.toFixed(1) +
               '" height="' + (boks.h * 0.13).toFixed(1) + '" rx="3" fill="' + lys + '"/>' +
               '<rect x="' + X(0) + '" y="' + Y(0.88) + '" width="' + boks.b.toFixed(1) +
               '" height="' + (boks.h * 0.10).toFixed(1) + '" rx="3" fill="' + mork + '"/>';

      case 'stjerner':
        var plasser = [[0.22, 0.26, 0.30], [0.68, 0.22, 0.20], [0.46, 0.62, 0.34], [0.86, 0.70, 0.22]];
        for (i = 0; i < plasser.length; i++) {
          // Annenhver stjerne i hver gruppe, så de tindrer i stedet for å
          // slå seg av og på samlet.
          s += stjerne(boks.x + boks.b * plasser[i][0],
                       boks.y + boks.h * plasser[i][1],
                       boks.h * plasser[i][2], lys, i % 2 ? 'b' : 'a', fase);
        }
        return s;

      // Ett lyn som fyller sonen. To lyn ville krevd halve bredden hver, og
      // da leser ingen av dem som et lyn.
      case 'lyn':
        return '<path' + blink('a', fase) + ' d="M' + X(0.68) + ' ' + Y(0) +
               ' L' + X(0.10) + ' ' + Y(0.56) +
               ' L' + X(0.42) + ' ' + Y(0.56) +
               ' L' + X(0.16) + ' ' + Y(1) +
               ' L' + X(0.92) + ' ' + Y(0.40) +
               ' L' + X(0.56) + ' ' + Y(0.40) +
               ' L' + X(1.00) + ' ' + Y(0) +
               ' Z" fill="' + lys + '"/>';

      // Tre tunger som fyller høyden. Hver går opp langs venstre side til en
      // spiss og ned igjen på høyre – to korte kurver ga bobler, ikke ild.
      case 'flammer':
        for (i = 0; i < 3; i++) {
          var u0 = i / 3, ub = 1 / 3;
          var hoy = i === 1 ? 1.0 : 0.74;
          s += '<path d="M' + X(u0) + ' ' + Y(1) +
               ' C' + X(u0 + ub * 0.08) + ' ' + Y(1 - hoy * 0.55) +
               ' ' + X(u0 + ub * 0.52) + ' ' + Y(1 - hoy * 0.45) +
               ' ' + X(u0 + ub * 0.60) + ' ' + Y(1 - hoy) +
               ' C' + X(u0 + ub * 0.80) + ' ' + Y(1 - hoy * 0.42) +
               ' ' + X(u0 + ub) + ' ' + Y(1 - hoy * 0.38) +
               ' ' + X(u0 + ub) + ' ' + Y(1) +
               ' Z" fill="' + (i === 1 ? '#ffd24a' : lys) + '"/>';
        }
        return s;

      // En munn: mørkt bånd med hvite tenner som biter nedover.
      case 'tenner':
        s += '<rect x="' + X(0) + '" y="' + Y(0.04) + '" width="' + boks.b.toFixed(1) +
             '" height="' + (boks.h * 0.52).toFixed(1) + '" rx="4" fill="' + mork + '"/>';
        for (i = 0; i < 5; i++) {
          var t0 = 0.03 + i * 0.194, tb = 0.16;
          s += '<path d="M' + X(t0) + ' ' + Y(0.06) +
               ' L' + X(t0 + tb) + ' ' + Y(0.06) +
               ' L' + X(t0 + tb / 2) + ' ' + Y(0.86) + ' Z" fill="#ffffff"/>';
        }
        return s;

      // Fast mønster, ikke tilfeldige tall: bilen tegnes både som SVG i
      // garasjen og som bilde i løypa, og de to må bli like.
      case 'glitter':
        for (i = 0; i < 22; i++) {
          var gu = ((i * 37) % 97) / 97;
          var gv = ((i * 61) % 89) / 89;
          var gr = boks.h * (0.07 + (i % 3) * 0.05);
          var gx = boks.x + boks.b * gu, gy = boks.y + boks.h * gv;
          s += '<path d="M' + gx.toFixed(1) + ' ' + (gy - gr).toFixed(1) +
               ' L' + (gx + gr * 0.34).toFixed(1) + ' ' + (gy - gr * 0.34).toFixed(1) +
               ' L' + (gx + gr).toFixed(1) + ' ' + gy.toFixed(1) +
               ' L' + (gx + gr * 0.34).toFixed(1) + ' ' + (gy + gr * 0.34).toFixed(1) +
               ' L' + gx.toFixed(1) + ' ' + (gy + gr).toFixed(1) +
               ' L' + (gx - gr * 0.34).toFixed(1) + ' ' + (gy + gr * 0.34).toFixed(1) +
               ' L' + (gx - gr).toFixed(1) + ' ' + gy.toFixed(1) +
               ' L' + (gx - gr * 0.34).toFixed(1) + ' ' + (gy - gr * 0.34).toFixed(1) +
               ' Z" fill="#ffffff"' + blink(i % 2 ? 'b' : 'a', fase) + '/>';
        }
        return s;
    }
    return '';
  }

  function stjerne(cx, cy, r, farge, gruppe, fase) {
    var d = '', i;
    for (i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r;
      var v = (i * 36 - 90) * Math.PI / 180;
      d += (i ? ' L' : 'M') + (cx + Math.cos(v) * rr).toFixed(1) + ' ' + (cy + Math.sin(v) * rr).toFixed(1);
    }
    return '<path d="' + d + ' Z" fill="' + farge + '"' +
           (gruppe ? blink(gruppe, fase) : '') + '/>';
  }

  /*
   * Tilbehøret. Alt tegnes i faste mål rundt et festepunkt, ikke skalert til
   * formen: en takkoffert er like stor på en racer som på en buss, akkurat
   * som i virkeligheten. At den henger litt utenfor et lite tak, er riktig.
   *
   * `t` er toppen delen skal stå på – for takdelene flyttes den oppover for
   * hver del som allerede ligger der.
   */
  function ekstraTegning(id, f, t, lakk, fase) {
    var x = f.x, y = t, i, s = '';
    var METALL = '#48505c', METALL_MORK = '#2f3540';

    switch (id) {

      /* --- taket, nedenfra og opp --- */

      case 'koffert':
        return '<rect x="' + (x - 38) + '" y="' + (y - 26) + '" width="76" height="26" rx="9" fill="' +
                 lakk.farge + '"/>' +
               '<rect x="' + (x - 38) + '" y="' + (y - 26) + '" width="76" height="26" rx="9" fill="none" stroke="' +
                 lakk.mork + '" stroke-width="3"/>' +
               '<rect x="' + (x - 34) + '" y="' + (y - 15) + '" width="68" height="4" rx="2" fill="' +
                 lakk.mork + '"/>' +
               '<rect x="' + (x - 8) + '" y="' + (y - 20) + '" width="16" height="12" rx="3" fill="' +
                 lakk.pynt + '"/>';

      case 'surfebrett':
        // Langt og tynt, med spiss i begge ender. Det henger godt utenfor
        // taket på de små bilene, og det er nettopp det som er morsomt.
        return '<path d="M' + (x - 86) + ' ' + (y - 7) +
                 ' Q' + (x - 40) + ' ' + (y - 15) + ' ' + x + ' ' + (y - 15) +
                 ' Q' + (x + 46) + ' ' + (y - 15) + ' ' + (x + 86) + ' ' + (y - 7) +
                 ' Q' + (x + 46) + ' ' + y + ' ' + x + ' ' + y +
                 ' Q' + (x - 40) + ' ' + y + ' ' + (x - 86) + ' ' + (y - 7) + ' Z" fill="#ff6f5e"/>' +
               '<path d="M' + (x - 70) + ' ' + (y - 7) + ' L' + (x + 70) + ' ' + (y - 7) +
                 '" stroke="#fff3d0" stroke-width="3" stroke-linecap="round"/>' +
               '<circle cx="' + (x + 52) + '" cy="' + (y - 7) + '" r="4" fill="#3aa8ff"/>';

      case 'lysboyle':
        s = '<rect x="' + (x - 34) + '" y="' + (y - 12) + '" width="68" height="11" rx="5" fill="' +
              METALL + '"/>' +
            '<rect x="' + (x - 26) + '" y="' + (y - 3) + '" width="7" height="5" fill="' + METALL_MORK + '"/>' +
            '<rect x="' + (x + 19) + '" y="' + (y - 3) + '" width="7" height="5" fill="' + METALL_MORK + '"/>';
        for (i = 0; i < 4; i++) {
          var lx = x - 24 + i * 16;
          var g = i % 2 ? 'b' : 'a';
          s += '<g' + blink(g, fase) + '>' +
               '<circle cx="' + lx + '" cy="' + (y - 17) + '" r="7" fill="#fff6c9"/>' +
               '<circle cx="' + lx + '" cy="' + (y - 17) + '" r="3" fill="#ffffff"/></g>';
        }
        return s;

      case 'sirene':
        // Rødt og blått veksler, som et ekte blålys.
        return '<rect x="' + (x - 20) + '" y="' + (y - 6) + '" width="40" height="7" rx="3" fill="' +
                 METALL_MORK + '"/>' +
               '<path d="M' + (x - 17) + ' ' + (y - 6) + ' q0 -12 17 -12 q17 0 17 12 Z" fill="#ff4d4d"' +
                 blink('a', fase) + '/>' +
               '<path d="M' + x + ' ' + (y - 18) + ' q17 0 17 12 L' + x + ' ' + (y - 6) + ' Z" fill="#3aa8ff"' +
                 blink('b', fase) + '/>' +
               '<circle cx="' + x + '" cy="' + (y - 20) + '" r="3" fill="#ffffff"/>';

      /* --- bakluka --- */

      case 'ballonger':
        // Hvor høyt de stiger avhenger av hvor mye plass det er over bilen.
        // En monsterbil har bakluka nesten oppe i viewBoxens tak, og med en
        // fast høyde forsvant ballongene ut av bildet på akkurat den formen.
        var stig = Math.min(96, y + TAK - 22);
        var ball = [[-30, -stig, 15, '#ff4d6d'],
                    [-4, -stig - 16, 16, '#ffd24a'],
                    [20, -stig + 4, 14, '#4ad991']];
        for (i = 0; i < ball.length; i++) {
          var bx = x + ball[i][0], by = y + ball[i][1];
          s += '<path d="M' + bx + ' ' + (by + ball[i][2]) + ' Q' + (bx - 10) + ' ' + (by + 46) +
               ' ' + x + ' ' + y + '" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.75"/>';
        }
        for (i = 0; i < ball.length; i++) {
          bx = x + ball[i][0]; by = y + ball[i][1];
          s += '<ellipse cx="' + bx + '" cy="' + by + '" rx="' + (ball[i][2] - 2) + '" ry="' +
                 ball[i][2] + '" fill="' + ball[i][3] + '"/>' +
               '<ellipse cx="' + (bx - 4) + '" cy="' + (by - 5) + '" rx="3" ry="4" fill="#ffffff" opacity="0.55"/>';
        }
        return s;

      case 'eksos':
        // Sitter lavt bak på karosseriet, med en liten flamme ut av røret.
        var ey = y;
        return '<rect x="' + (x - 34) + '" y="' + ey + '" width="42" height="11" rx="5" fill="' + METALL + '"/>' +
               '<rect x="' + (x - 34) + '" y="' + (ey + 14) + '" width="42" height="11" rx="5" fill="' + METALL + '"/>' +
               '<circle cx="' + (x - 33) + '" cy="' + (ey + 5) + '" r="7" fill="' + METALL_MORK + '"/>' +
               '<circle cx="' + (x - 33) + '" cy="' + (ey + 19) + '" r="7" fill="' + METALL_MORK + '"/>' +
               '<path d="M' + (x - 40) + ' ' + (ey + 5) + ' l-22 -6 l10 6 l-10 6 z" fill="#ff8a1e"' +
                 blink('a', fase) + '/>' +
               '<path d="M' + (x - 40) + ' ' + (ey + 19) + ' l-18 -5 l8 5 l-8 5 z" fill="#ffd24a"' +
                 blink('b', fase) + '/>';

      /* --- panseret --- */

      case 'and':
        var ax = x - 18, ay = y - 14;
        return '<ellipse cx="' + ax + '" cy="' + ay + '" rx="15" ry="11" fill="#ffd83d"/>' +
               '<circle cx="' + (ax + 10) + '" cy="' + (ay - 12) + '" r="10" fill="#ffd83d"/>' +
               '<path d="M' + (ax + 19) + ' ' + (ay - 12) + ' l13 3 l-13 5 z" fill="#ff8a1e"/>' +
               '<circle cx="' + (ax + 12) + '" cy="' + (ay - 15) + '" r="2.4" fill="#20242c"/>' +
               '<path d="M' + (ax - 12) + ' ' + (ay - 2) + ' q-9 -6 -2 -11" stroke="#f0b300" stroke-width="3" fill="none"/>';

      case 'vimpel':
        // Flagget blåser *bakover*, altså mot venstre: bilen kjører mot
        // høyre. Første utgave lot vimpelen peke forover, og da så det ut
        // som om det blåste kraftig imot i stedet for at bilen kjørte fort.
        var vx = x + 34;
        return '<rect x="' + (vx - 2) + '" y="' + (y - 54) + '" width="4" height="56" rx="2" fill="' +
                 METALL_MORK + '"/>' +
               '<path d="M' + (vx - 2) + ' ' + (y - 52) + ' L' + (vx - 44) + ' ' + (y - 42) +
                 ' L' + (vx - 2) + ' ' + (y - 30) + ' Z" fill="#ff4d6d"/>' +
               '<path d="M' + (vx - 2) + ' ' + (y - 46) + ' L' + (vx - 26) + ' ' + (y - 42) +
                 ' L' + (vx - 2) + ' ' + (y - 37) + ' Z" fill="#fff3d0"/>';
    }
    return '';
  }

  function spoilerTegning(id, feste, lakk, fase) {
    var x = feste.x, y = feste.y;
    var f = lakk.farge, m = lakk.mork, p = lakk.pynt;
    switch (id) {
      // Stagene går 26 enheter *under* festepunktet. De blir tegnet før
      // karosseriet og skjult av det, og det er nettopp det som gjør at
      // vingen ser fastskrudd ut: rekker de bare akkurat ned, blir det en
      // luftspalte på den formen som har litt annen takhøyde.
      case 'liten':
        return '<path d="M' + (x - 6) + ' ' + (y + 16) + ' L' + (x + 56) + ' ' + (y + 16) +
               ' L' + (x + 56) + ' ' + (y - 14) + ' L' + (x - 6) + ' ' + (y - 6) + ' Z" fill="' + m + '"/>';
      case 'stor':
        return '<rect x="' + (x + 4) + '" y="' + (y - 40) + '" width="9" height="66" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x + 42) + '" y="' + (y - 40) + '" width="9" height="66" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x - 10) + '" y="' + (y - 52) + '" width="80" height="15" rx="6" fill="' + f + '"/>' +
               '<rect x="' + (x - 10) + '" y="' + (y - 52) + '" width="80" height="5" rx="2" fill="' + p + '"/>';
      case 'dobbel':
        return '<rect x="' + (x + 4) + '" y="' + (y - 62) + '" width="9" height="88" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x + 42) + '" y="' + (y - 62) + '" width="9" height="88" rx="3" fill="' + m + '"/>' +
               '<rect x="' + (x - 14) + '" y="' + (y - 40) + '" width="88" height="13" rx="5" fill="' + f + '"/>' +
               '<rect x="' + (x - 14) + '" y="' + (y - 74) + '" width="88" height="15" rx="6" fill="' + f + '"/>' +
               '<rect x="' + (x - 14) + '" y="' + (y - 74) + '" width="88" height="5" rx="2" fill="' + p + '"/>';
      case 'rakett':
        // Selve røret strekker seg inn under karosseriet mot høyre, så bare
        // dysa og flammen stikker ut bak. Uten overlappen svevde raketten
        // som en løs gjenstand ved siden av bilen.
        return '<rect x="' + (x - 12) + '" y="' + (y - 40) + '" width="96" height="32" rx="15" fill="#48505c"/>' +
               '<rect x="' + (x - 4) + '" y="' + (y - 33) + '" width="32" height="8" rx="4" fill="' + p + '"/>' +
               '<rect x="' + (x + 10) + '" y="' + (y - 12) + '" width="10" height="34" rx="4" fill="#2f3540"/>' +
               '<rect x="' + (x + 46) + '" y="' + (y - 12) + '" width="10" height="34" rx="4" fill="#2f3540"/>' +
               '<path d="M' + (x - 12) + ' ' + (y - 40) + ' l-16 5 l0 22 l16 5 z" fill="#2f3540"/>' +
               '<path d="M' + (x - 28) + ' ' + (y - 32) + ' l-28 8 l28 8 z" fill="#ff8a1e"' +
                 blink('a', fase) + '/>';
    }
    return '';
  }

  /*
   * Bygger hele bilen som SVG-innhold. `pre` er en unik id-forstavelse:
   * regnbuelakken bruker en gradient, og to biler på samme side med samme
   * gradient-id gir en av dem feil farge.
   *
   * `opts.utenHjul` og `opts.utenSkygge` brukes til utgaven som kjører i
   * løypa: der tegnes hjulene for seg så de kan snurre, og skyggen skal ikke
   * være med i det hele tatt – den følger bilen når den roterer, og en skygge
   * som ligger *over* bilen i toppen av en loop ser ut som en flekk.
   */
  function tegning(valgt, pre, opts) {
    opts = opts || {};
    var d = deler(valgt);
    var f = d.form, lakk = d.lakk;
    var defs = '', fyll = lakk.farge;

    if (lakk.regnbue) {
      defs += '<linearGradient id="' + pre + 'regn" x1="0" y1="0" x2="1" y2="0.3">' +
              '<stop offset="0" stop-color="#ff4d6d"/><stop offset="0.25" stop-color="#ffb01f"/>' +
              '<stop offset="0.5" stop-color="#4ad991"/><stop offset="0.75" stop-color="#3aa8ff"/>' +
              '<stop offset="1" stop-color="#a05cff"/></linearGradient>';
      fyll = 'url(#' + pre + 'regn)';
    } else if (lakk.blank) {
      defs += '<linearGradient id="' + pre + 'blank" x1="0" y1="0" x2="0" y2="1">' +
              '<stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>' +
              '<stop offset="0.45" stop-color="' + lakk.farge + '"/>' +
              '<stop offset="1" stop-color="' + lakk.mork + '"/></linearGradient>';
      fyll = 'url(#' + pre + 'blank)';
    }

    // Dekoren skal ikke renne utenfor karosseriet.
    defs += '<clipPath id="' + pre + 'kropp"><path d="' + f.kropp + '"/></clipPath>';

    var s = '<defs>' + defs + '</defs>';

    if (!opts.utenSkygge) {
      s += '<ellipse cx="200" cy="' + (BAKKE + 14) + '" rx="168" ry="10" fill="rgba(0,0,0,0.28)"/>';
    }

    // Spoileren bak karosseriet, ellers ser stagene ut som de er limt utenpå.
    s += spoilerTegning(d.spoiler.id, f.spoilerfeste, lakk, opts.fase);

    /*
     * ---------- alt som skal ligge *bak* karosseriet ----------
     *
     * Rekkefølgen her er ikke smak. Hjulene tegnes aller sist, så et beltebånd
     * må være et bånd med hull i, med veihjulene inni hullet: tegnes båndet
     * over hjulene, forsvinner de, og tegnes det etter, ligger gummien oppå
     * stålet. Flammer og fjæring må bak av samme grunn – de kommer ut fra noe.
     */

    // Beltebånd. Et stadion-formet bånd langs en midtlinje, med hull i midten
    // der veihjulene står.
    if (f.belte) {
      var bl = f.belte;
      s += '<line x1="' + bl.x0 + '" y1="' + bl.y + '" x2="' + bl.x1 + '" y2="' + bl.y +
           '" stroke="#23262b" stroke-width="' + (bl.r * 2) +
           '" stroke-linecap="round"/>';
      // Beltetenner. En stiplet strek langs samme linje gir mønsteret gratis.
      s += '<line x1="' + bl.x0 + '" y1="' + bl.y + '" x2="' + bl.x1 + '" y2="' + bl.y +
           '" stroke="#12141a" stroke-width="' + (bl.r * 2 - 6) +
           '" stroke-linecap="round" stroke-dasharray="9 11"/>';
      s += '<line x1="' + bl.x0 + '" y1="' + bl.y + '" x2="' + bl.x1 + '" y2="' + bl.y +
           '" stroke="' + lakk.mork + '" stroke-width="' + (bl.r * 2 - 26) +
           '" stroke-linecap="round"/>';
    }

    /*
     * Lyskjegler ned mot bakken. Det er det ene som gjør at noe *svever* i
     * stedet for å stå: en glødende skive alene leser fortsatt som et hjul,
     * men et lysskjær ned mot asfalten gjør det ikke.
     */
    if (f.kjegler) {
      for (var lk = 0; lk < f.kjegler.length; lk++) {
        var kx = f.kjegler[lk].x, ky = f.kjegler[lk].y, kb = f.kjegler[lk].b || 46;
        s += '<path d="M' + (kx - kb * 0.45) + ' ' + ky + ' L' + (kx + kb * 0.45) + ' ' + ky +
             ' L' + (kx + kb) + ' ' + (BAKKE + 8) + ' L' + (kx - kb) + ' ' + (BAKKE + 8) +
             ' Z" fill="#5ddcff" opacity="0.16"/>';
        /*
         * `fill-opacity` og ikke `opacity` her, for `blink()` setter `opacity`.
         * To like attributter i samme tagg er ugyldig XML, og en SVG som ikke
         * kan parses blir et *ødelagt bilde* – noe man bare ser i løypa, der
         * tegningen lastes som en data-URI. I garasjen gir `blink()` en klasse
         * i stedet, så der så alt riktig ut.
         */
        s += '<path d="M' + (kx - kb * 0.22) + ' ' + ky + ' L' + (kx + kb * 0.22) + ' ' + ky +
             ' L' + (kx + kb * 0.5) + ' ' + (BAKKE + 8) + ' L' + (kx - kb * 0.5) + ' ' + (BAKKE + 8) +
             ' Z" fill="#bff2ff" fill-opacity="0.18"' + blink('b', opts.fase) + '/>';
      }
    }

    // Fjæring: synlige dempere og armer mellom ramma og hjulet.
    if (f.fjaering) {
      s += baner(f.fjaering, 'fill="none" stroke="#3a4048" stroke-width="11" stroke-linecap="round"');
      s += baner(f.fjaering, 'fill="none" stroke="#6e7885" stroke-width="4" stroke-linecap="round"');
    }

    /*
     * Flammene. De tegnes bak karosseriet og røret foran – både Jetbilen og
     * Romfartøyet har hale eller skrog akkurat der flammen skal ut, og tegnes
     * hele dysa etter kroppen, blir bare en flis av flammen synlig.
     */
    var dyser = f.dyser || (f.dyse ? [f.dyse] : []);
    for (var dd = 0; dd < dyser.length; dd++) {
      var dx = dyser[dd].x, dy = dyser[dd].y, dl = dyser[dd].lengde || 70;
      // To lag i motfase. Ett lag alene pulserer av og på; to lag leser som en
      // flamme som står og brenner.
      s += '<path d="M' + dx + ' ' + (dy - dl * 0.24) + ' l' + (-dl) + ' ' + (dl * 0.24) +
           ' l' + dl + ' ' + (dl * 0.24) + ' z" fill="#ff8a1e"' + blink('a', opts.fase) + '/>';
      s += '<path d="M' + dx + ' ' + (dy - dl * 0.14) + ' l' + (-dl * 0.63) + ' ' + (dl * 0.14) +
           ' l' + (dl * 0.63) + ' ' + (dl * 0.14) + ' z" fill="#ffe27a"' + blink('b', opts.fase) + '/>';
    }

    if (f.understell) s += '<path d="' + f.understell + '" fill="' + lakk.mork + '"/>';
    s += '<path d="' + f.kropp + '" fill="' + fyll + '"/>';
    var pynt = '';
    for (var n = 0; n < d.dekor.length; n++) {
      pynt += dekorTegning(d.dekor[n].id, sone(f.dekorboks, d.dekor[n].sone), lakk, opts.fase);
    }
    s += '<g clip-path="url(#' + pre + 'kropp)">' + pynt + '</g>';
    s += '<path d="' + f.kropp + '" fill="none" stroke="' + lakk.mork + '" stroke-width="4"/>';

    if (f.finne) s += '<path d="' + f.finne + '" fill="' + lakk.mork + '"/>';

    /*
     * Turbinen. På en jetdragster er motoren ikke noe som ligger under et
     * panser – den *er* kjøretøyet, og alt annet henger på den.
     */
    if (f.turbin) {
      var t = f.turbin;
      s += '<rect x="' + t.x + '" y="' + t.y + '" width="' + t.b + '" height="' + t.h +
           '" rx="' + (t.h / 2) + '" fill="#4a525f"/>';
      s += '<rect x="' + t.x + '" y="' + (t.y + 4) + '" width="' + t.b + '" height="' + (t.h * 0.32) +
           '" rx="' + (t.h * 0.16) + '" fill="#79838f" opacity="0.55"/>';
      // Bånd rundt kassa, som på en ekte turbin.
      for (var tb = 1; tb <= 3; tb++) {
        var bx = t.x + t.b * tb / 4;
        s += '<rect x="' + bx + '" y="' + (t.y - 3) + '" width="7" height="' + (t.h + 6) +
             '" rx="3" fill="#333a44"/>';
      }
      // Innsuget foran: en ring man ser inn i.
      s += '<ellipse cx="' + (t.x + t.b) + '" cy="' + (t.y + t.h / 2) + '" rx="' + (t.h * 0.22) +
           '" ry="' + (t.h / 2) + '" fill="#2a3038"/>';
      // `fill-opacity`, ikke `opacity`: `blink()` setter `opacity`, og to like
      // attributter i samme tagg gjør hele SVG-en uleselig.
      s += '<ellipse cx="' + (t.x + t.b) + '" cy="' + (t.y + t.h / 2) + '" rx="' + (t.h * 0.13) +
           '" ry="' + (t.h * 0.33) + '" fill="#8fd0e8" fill-opacity="0.5"' +
           blink('b', opts.fase) + '/>';
    }

    if (f.rute) s += baner(f.rute, 'fill="#8fd0e8" opacity="0.92"');

    // Naglene gjør flater om til plater. Uten dem er Panservogna bare en
    // kantete bil i samme lakk som alle de andre.
    if (f.nagler) {
      for (var g = 0; g < f.nagler.length; g++) {
        s += '<circle cx="' + f.nagler[g].x + '" cy="' + f.nagler[g].y + '" r="4" fill="' + lakk.mork + '"/>';
        s += '<circle cx="' + (f.nagler[g].x - 1) + '" cy="' + (f.nagler[g].y - 1) +
             '" r="1.6" fill="' + lakk.pynt + '" opacity="0.8"/>';
      }
    }

    if (f.neon) {
      s += baner(f.neon, 'fill="none" stroke="#5ddcff" stroke-width="14" stroke-linecap="round" opacity="0.22"');
      s += baner(f.neon, 'fill="none" stroke="#bff2ff" stroke-width="5" stroke-linecap="round"' +
                         blink('a', opts.fase));
    }

    if (f.antenne) {
      s += '<path d="M' + f.antenne.x + ' ' + f.antenne.y + ' L' + (f.antenne.x - 6) +
           ' ' + (f.antenne.y - 34) + '" stroke="' + lakk.mork + '" stroke-width="4" fill="none"/>';
      s += '<circle cx="' + (f.antenne.x - 6) + '" cy="' + (f.antenne.y - 38) + '" r="7" fill="#ff4d6d"' +
           blink('b', opts.fase) + '/>';
    }

    // Selve rørene, foran karosseriet.
    for (var dr = 0; dr < dyser.length; dr++) {
      var rl = dyser[dr].lengde || 70;
      var rh = Math.round(rl * 0.60), rb = Math.round(rl * 0.54);
      s += '<rect x="' + (dyser[dr].x - 6) + '" y="' + (dyser[dr].y - rh / 2) +
           '" width="' + rb + '" height="' + rh + '" rx="' + Math.round(rh / 4) + '" fill="#48505c"/>';
      s += '<rect x="' + (dyser[dr].x - 6) + '" y="' + (dyser[dr].y - rh / 2) +
           '" width="' + Math.round(rb * 0.3) + '" height="' + rh + '" rx="' + Math.round(rh / 8) +
           '" fill="#2f3540"/>';
    }

    /*
     * Tårnet med kanon. Det er det ene draget som gjør en kantete bil til et
     * pansret kjøretøy – uten kanonen er Panservogna bare en firkantet bil.
     */
    if (f.taarn) {
      var k = f.kanon;
      if (k) {
        s += '<rect x="' + k.x + '" y="' + (k.y - 7) + '" width="' + k.lengde +
             '" height="14" rx="6" fill="#3a4048"/>';
        s += '<rect x="' + (k.x + k.lengde - 26) + '" y="' + (k.y - 11) +
             '" width="26" height="22" rx="6" fill="#565f6c"/>';
        s += '<rect x="' + k.x + '" y="' + (k.y - 7) + '" width="' + k.lengde +
             '" height="4" rx="2" fill="#7e8794" opacity="0.6"/>';
      }
      s += '<path d="' + f.taarn + '" fill="' + fyll + '"/>';
      s += '<path d="' + f.taarn + '" fill="none" stroke="' + lakk.mork + '" stroke-width="4"/>';
      if (f.glugge) s += baner(f.glugge, 'fill="#16181e"');
    }

    // Eksosstakker rett opp gjennom panseret.
    if (f.stakker) {
      for (var st = 0; st < f.stakker.length; st++) {
        var sx = f.stakker[st].x, sy = f.stakker[st].y, sh = f.stakker[st].h;
        s += '<rect x="' + (sx - 8) + '" y="' + (sy - sh) + '" width="16" height="' + sh +
             '" rx="7" fill="#3a4048"/>';
        s += '<rect x="' + (sx - 8) + '" y="' + (sy - sh) + '" width="6" height="' + sh +
             '" rx="3" fill="#6e7885"/>';
        s += '<ellipse cx="' + sx + '" cy="' + (sy - sh) + '" rx="9" ry="4" fill="#16181e"/>';
      }
    }

    if (f.bur) {
      s += baner(f.burstag, 'fill="none" stroke="' + lakk.mork + '" stroke-width="8" stroke-linecap="round"');
      s += baner(f.bur, 'fill="none" stroke="' + lakk.mork + '" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"');
    }

    /*
     * Tilbehøret. Takdelene stables: `takhoyde` er hvor høyt det allerede
     * ligger noe, og hver del legger seg oppå. De andre henger på sitt eget
     * faste punkt.
     */
    var takhoyde = 0;
    for (var e = 0; e < d.ekstra.length; e++) {
      var del = d.ekstra[e];
      var feste = f[del.plass] || f.tak;
      var toppen = del.plass === 'tak' ? feste.y - takhoyde : feste.y;
      s += ekstraTegning(del.id, feste, toppen, lakk, opts.fase);
      if (del.plass === 'tak') takhoyde += del.hoyde;
    }

    s += '<circle cx="' + f.lykt.x + '" cy="' + f.lykt.y + '" r="9" fill="#fff6c9"/>';
    s += '<circle cx="' + f.lykt.x + '" cy="' + f.lykt.y + '" r="4" fill="#ffffff"/>';
    s += '<circle cx="' + f.lykt.x + '" cy="' + f.lykt.y + '" r="13" fill="#fff6c9"' +
         ' fill-opacity="0.4"' + blink('b', opts.fase) + '/>';

    if (!opts.utenHjul) {
      for (var i = 0; i < f.hjul.length; i++) {
        s += hjulTegning(f.hjul[i], d.hjul, i, opts.fase, opts.tier);
      }
    }

    return s;
  }

  // Hjulene er den eneste kategorien der navnet ikke sier noe om hvordan
  // delen ser ut. Lista viser derfor selve hjulet, tegnet med sine egne
  // farger, i stedet for det samme symbolet fem ganger.
  /*
   * Prøven i lista tegnes **uten** dekk-tier, og det er med vilje. Lista
   * finnes for å skille de fem designene fra hverandre – navnet sier
   * ingenting om hvordan felgen ser ut – og på øverste tier la glorien seg over
   * alle fem så de ble til fem like rosa klatter. Bilen rett over lista viser
   * hvordan hjulet faktisk ser ut med tieret på.
   */
  function miniHjul(hj) {
    return '<svg viewBox="0 0 100 100" width="38" height="38" aria-hidden="true">' +
           hjulTegning({ x: 50, y: 50, r: 46 }, hj, 0) + '</svg>';
  }

  function svg(valgt, pre, klasse, tier) {
    return '<svg class="' + (klasse || '') + '" viewBox="0 ' + (-TAK) + ' ' + B + ' ' + (H + 10 + TAK) +
           '" xmlns="http://www.w3.org/2000/svg">' + tegning(valgt, pre, { tier: tier }) + '</svg>';
  }

  /*
   * Til canvas. Bilen deles i to bilder: karosseriet uten hjul, og ett hjul
   * for seg. I løypa tegnes karosseriet én gang per bilderute og hjulet to
   * ganger, rotert etter hvor langt bilen har kjørt – det er hele
   * hjulsnurringen, og den koster to ekstra drawImage per rute.
   *
   * Begge lages én gang når designet endres. Å serialisere SVG-en per
   * bilderute ville drept bildefrekvensen på telefon.
   *
   * Hjulboksen er større enn hjulet (75 mot 50). Mønsteret på de grove
   * dekkene stikker noen enheter utenfor radien, og glorien på øverste dekk-tier
   * rekker ut til 1,29 ganger radien. Med den gamle boksen på 55 ble hele
   * neonringen skåret bort i løypa – og bare der, for i garasjen er bilen en
   * SVG uten noen boks å klippes mot. Endrer du glorien, må dette tallet
   * følge etter.
   */
  var HJULBOKS = 150, HJULRADIUS = 50;

  function tegninger(valgt, klar, tier) {
    var f = karosseri(valgt);
    var hj = finn(HJUL, valgt.hjul);

    var full = H + 10 + TAK;

    function kroppSvg(fase) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (B * 2) + '" height="' + (full * 2) +
             '" viewBox="0 ' + (-TAK) + ' ' + B + ' ' + full + '">' +
             tegning(valgt, 'c' + fase, { utenHjul: true, utenSkygge: true, fase: fase, tier: tier }) + '</svg>';
    }

    function hjulSvg(fase) {
      // Hjulstilen hentes fra kjøretøyets første hjul. Alle hjulene på ett
      // kjøretøy har samme stil – ett bilde gjenbrukes for alle sammen.
      var stil = f.hjul.length ? f.hjul[0].stil : undefined;
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (HJULBOKS * 2) + '" height="' + (HJULBOKS * 2) +
             '" viewBox="0 0 ' + HJULBOKS + ' ' + HJULBOKS + '">' +
             hjulTegning({ x: HJULBOKS / 2, y: HJULBOKS / 2, r: HJULRADIUS, stil: stil },
                         hj, 0, fase, tier) + '</svg>';
    }

    // Forholdet mellom bildets *halve* bredde og hjulets radius. Tegner man
    // med hele boksen mot radien, blir hjulet dobbelt så stort som resten av
    // bilen og henger under asfalten.
    var margin = (HJULBOKS / 2) / HJULRADIUS;

    /*
     * Hjulplasseringene og `bakke` regnes om til bildets koordinater. Bildet
     * starter TAK enheter over tegningens null, så alt som skal treffe
     * asfalten må flyttes like mye ned.
     */
    var plasser = f.hjul.map(function (h) { return { x: h.x, y: h.y + TAK, r: h.r }; });

    /*
     * Ett bilde per fase av hver del. Bildene lages bare når designet endres,
     * så to faser koster to serialiseringer i det øyeblikket man trykker
     * KJØR – ingenting per bilderute.
     */
    var ut = {
      plasser: plasser, bredde: B, hoyde: full,
      bakke: BAKKE + TAK, hjulboks: margin,
      kropp: [], hjul: []
    };

    var igjen = FASER * 2;
    function ferdig() { if (--igjen === 0) klar(ut); }

    function lastInn(liste, fase, kilde) {
      var img = new Image();
      img.onload = ferdig;
      img.onerror = ferdig;   // en ødelagt tegning skal ikke henge kjøringen
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(kilde);
      liste[fase] = img;
    }

    for (var fase = 0; fase < FASER; fase++) {
      lastInn(ut.kropp, fase, kroppSvg(fase));
      lastInn(ut.hjul, fase, hjulSvg(fase));
    }
  }

  function standard() {
    return { kjoretoy: 'stunt', form: 'racer', lakk: 'rod', hjul: 'standard',
             dekor: [], spoiler: 'ingen', ekstra: [] };
  }

  return {
    KATEGORIER: KATEGORIER,
    FORMER: FORMER,
    KJORETOY: KJORETOY,
    finnKjoretoy: finnKjoretoy,
    karosseri: karosseri,
    kjoretoyBonus: kjoretoyBonus,
    BAKKE: BAKKE,
    bredde: B,
    hoyde: H + 10,
    FASER: FASER,
    finn: finn,
    deler: deler,
    stil: stil,
    bonus: bonus,
    svg: svg,
    // Selve tegningen uten <svg> rundt, så garasjen kan legge bilen inn i
    // sin egen koordinatverden med en transform.
    innhold: tegning,
    miniHjul: miniHjul,
    tegninger: tegninger,
    standard: standard
  };
})();
