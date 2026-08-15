# Stuntgarasjen

Bygg og design en stuntbil, kjør den gjennom en løype med looper og hopp, og
tjen penger til flere deler. PWA, som de andre appene her — ingen
avhengigheter, ingen byggesteg, alt lagret lokalt.

## Premisset: man kan ikke tape

Samme linje som Fargeflasker, Poengtavla og Monstergiret. Bilen kan ikke
velte, kan ikke krasje, og kan ikke bli stående fast. Det finnes ingen
klokke, ingen konkurrent og ingen «game over» — det eneste som varierer fra
tur til tur, er hvor mye man tjener.

Det er ikke bare en snillhet, det er også det som lar hele fysikken være så
liten som den er.

## Fysikken: bilen er et punkt på en kurve

Løypa er én lang punktliste (`js/lope.js`). Bilen har to tall: hvor langt den
har kommet langs kurven (`s`) og hvor fort den går (`v`). Tyngdekraften virker
langs kurvens helning, så bakker koster fart og utforbakker gir fart, helt
gratis.

**Dette er det bærende valget i appen.** Ekte stivlegeme-fysikk med hjul og
fjæring ville krevd et bibliotek — som repoet ikke har — og gitt looper der
bilen faller gjennom asfalten når bildefrekvensen dipper. Med en kurve er en
loop bare en sirkel i punktlista, og den er riktig hver eneste gang.

Bilen slipper kurven ett eneste sted: på et hopp. Da er den et vanlig kast
med tyngdekraft til den treffer bakken igjen.

### Tre steder vi hjelper bilen med vilje

Alle tre står i `js/fysikk.js` med tall man kan se, ikke som skjulte
unntak:

* **I looper er tyngdekraften dempet til 45 %, og farten har et gulv på 170.**
  En loop med radius 120 ville ellers krevd rundt 700 i fart nederst, og det
  har ikke en umodifisert bil. Nå kommer en svak bil rundt — bare langsomt.
* **Et hopp som ikke helt rekker over, får lande på kanten.** Alternativet er
  en bil som synker ned i hullet, og det er en måte å tape på.
* **Gassen har lavgir:** den tar 2,3 ganger så hardt fra stillstand som ved
  toppfart. Uten det ble en umodifisert bil stående på den bratteste rampa —
  45 grader koster mer enn motoren gir — og da satt barnet fast i en app som
  ikke skal kunne tapes, uten noe å trykke på som hjalp.

Står bilen likevel stille uten at det trykkes gass, dukker «Trykk på gass!»
opp etter 1,2 sekunder. En bil som er blitt stående i en motbakke ser ut som
en app som har hengt seg, og det er den eneste måten dette spillet kan se ut
som det er slutt uten å være det.

## Økonomien: én pott, og stil som ganger opp

Eieren ba om **én pott** — samme penger til både oppgraderinger og pynt. Den
åpenbare fella med det er at pynt konkurrerer med fart: kjøper barnet glitter,
får det en tregere bil, og angrer på noe det syntes var gøy.

Løsningen er at **designdelene gir stilpoeng, og stilpoengene ganger opp alt
man tjener i løypa**. En naken bil ligger på ×1,04; alt kjøpt gir ×2,07. Da er
glitter en investering som betaler seg over noen turer, ikke en utgift som
gjør bilen dårligere. Det oppfyller også ønsket om «mer penger når man designer
mer avansert» — men som en sats per tur, ikke en engangssum man kan hente ut om
igjen ved å bytte deler fram og tilbake.

Tallene er kalibrert slik:

| | |
| --- | --- |
| Startkapital | $250 |
| Umodifisert bil, én tur | ~$798 |
| Fullt utstyrt bil, én tur | ~$2002 |
| Hele designkatalogen | $5790 |
| Alle oppgraderinger | $17 050 |

Tallene måles av `tester/lope.js`, som feiler hvis de driver utenfor rammene.
Å eie alt tar rundt tjue turer, og de siste oppgraderingstrinnene er noe man
sparer til over flere økter — det er meningen.

Nakne bilen ligger på ×1,04 i stilbonus, en bil med alt på ×2,07. Nevneren i
`Bil.bonus()` er satt etter det taket: legger du til en dekortype, øker maks
stil, og nevneren må følge etter — ellers vokser inntekten i løypa uten at noe
annet er endret.

Det gir en ny del hver eller annenhver tur i starten — ofte nok til at det
skjer noe, sjelden nok til at det er noe igjen å glede seg til. Endrer du en
pris eller en utbetaling, kjør begge ytterpunktene og se på de to tallene i
midten; de henger sammen.

Merk at en sterkere bil ikke bare tjener mer: den flyr også over strekninger
og mister mynter underveis. Det er en tilsiktet motvekt, ikke en feil.

## Filene

| Fil | Svarer for |
| --- | --- |
| `js/bil.js` | Delekatalogen og tegningen av bilen |
| `js/garasje.js` | Rommet bilen står i på garasjeskjermen |
| `js/lope.js` | Løypa: punktlista, myntene, oppslag langs kurven |
| `js/fysikk.js` | Simuleringen: fart, hopp, mynter, penger, oppgraderinger |
| `js/kjoring.js` | Kamera og tegning av løypa |
| `js/app.js` | De fem skjermene, butikken, lagringen |

**Fysikken ligger for seg selv, uten et eneste piksel.** Den ble skilt ut fra
`kjoring.js` fordi løypa må stemmes av mot tall bare simuleringen kjenner:
hvor fort bilen forlater hver rampe, hvor langt den flyr, om en maksbil
rekker fra siste hopp til mål. Så lenge fysikken satt inne i tegnekoden,
måtte hvert slikt spørsmål besvares ved å instrumentere koden med en
`console.log`, starte en nettleser og kjøre løypa i sanntid — flere minutter
per svar. Nå svarer `tester/lope.js` på alt sammen på et sekund, og
nettleseren gir nøyaktig de samme tallene.

## Bilen tegnes, den lastes ikke ned

Som truckene i Monstergiret: én tegnerutine og en tabell. Seks kategorier som
kan settes sammen fritt — form, lakk, hjul, dekor, spoiler, ekstra. To av dem
er lister der hvilken som helst kombinasjon kan stå på: seks dekortyper (2⁶)
og åtte tilbehør (2⁸). Til sammen 4 × 9 × 5 × 64 × 5 × 256 = **14,7 millioner**
forskjellige biler uten en eneste bildefil.

## Dekor er den eneste kategorien der flere kan stå på samtidig

Det var det ikke fra starten, og det var feil: et barn som satte på stjerner,
mistet lynet det nettopp hadde kjøpt. Pynt man har betalt for skal bli
værende. `valgt.dekor` er derfor en **liste**, ikke én id, og et trykk i
verkstedet slår en dekor av eller på i stedet for å bytte den ut.

For at seks ting skal få plass uten å bli en grøt, har hver type sin egen
**sone** — en andel av formens `dekorboks`. De fire figurene står på rekke
bakfra og fram, striper rammer inn over- og underkanten, og glitteret ligger
over alt:

| | |
| --- | --- |
| striper | hele lengden, bånd langs over- og underkant |
| stjerner, lyn, flammer, tenner | hver sin fjerdedel, bakfra og fram |
| glitter | hele flata, oppå de andre |

Sonene er **andeler**, ikke faste mål, nettopp fordi hver form har sin egen
`dekorboks` — en monsterbil har mye høyere side enn en racer. Figurene tegnes i
enhetskoordinater innenfor sonen sin, så en ny dekortype er en `switch`-gren
uten et eneste mål å regne ut på nytt.

To ting det er verdt å vite hvis du endrer dette:

* **Et første forsøk stablet dem i tre rader oppå hverandre.** Det virket, men
  en bilside er lang og lav, og en tredjedels høyde gjorde flammene til en gul
  flekk. På rekke får hver figur en nesten kvadratisk plass.
* **Lagrekkefølgen er katalogens, ikke trykkerekkefølgen.** `valgtDekor()`
  filtrerer `DEKOR` i stedet for å lese lista barnet bygde, så striper alltid
  ligger nederst og glitter øverst uansett hva som ble kjøpt først.

## Garasjen

Garasjeskjermen viser bilen i et rom: port, vegg, gulv med fliser, to lamper
med lyskjegler, vimpler, verktøytavle, hylle, verktøykasse og en dekkstabel.
Alt ligger i `js/garasje.js` — `bil.js` svarer for bilen og ingenting annet.

**Bilen tegnes inni garasjens SVG, ikke ved siden av.** `Bil.innhold()` gir
tegningen uten `<svg>` rundt, og garasjen legger den inn med en `transform`.
Da er det én koordinatverden: alle formene har hjulene på `Bil.BAKKE`, og én
skalering setter den linja rett på gulvet. Legges de to som separate
elementer oppå hverandre, må plasseringen finstemmes på nytt hver gang en
form endrer høyde.

Tre ting det er verdt å vite:

* **Rommet er høyere enn det er bredt.** Ruta bilen står i er høy og smal på
  en telefon, og et første forsøk med en bred scene (480 × 300) ble liggende
  som et frimerke med tomrom over og under.
* **`preserveAspectRatio` står på standard «meet», ikke «slice».** I liggende
  format er ruta lav og bred, og «slice» ville da skåret bort både tak og
  gulv — altså nettopp bilen. Luften som blir til overs, dekkes i stedet av at
  `#garasjeBil` har samme mørke bakgrunn som rommets dypeste flate.
* **I liggende legges garasjeskjermen om til to kolonner.** Rommet får hele
  høyden på venstre side, og tallene og knappene står ved siden av. Uten det
  blir ruta så lav at rommet krymper uansett hva `preserveAspectRatio` gjør.

## Kjøp skjer med ett trykk

Ingen «Ja takk» å bekrefte med. For et barn som prøver seg fram er en dialog
per kjøp et hinder, ikke en trygghet — det var slik det var først, og eieren
ba om å få det bort.

Da må trykket svare på en annen måte, og det er verdt å beholde:

* **Pengemerket blafrer** når summen går ned. Uten det blir kjøpet helt
  stille, og et barn som bommet på en rute ville ikke sett hvorfor pengene
  ble færre.
* **Det man ikke har råd til, rister** i stedet, og ruta er allerede dempet
  (`.dyr`).

Merk at et trykk på en del man ikke eier nå *kjøper* den. Det er prisen for
at kjøpet går unna, og den er akseptert: ingenting kan gå tapt for godt —
delen blir værende, og pynt kan slås av og på fritt etterpå.

## KJØR-knappen finnes på tre skjermer

Garasjen, verkstedet og delene. Uten den på de to siste måtte barnet tilbake
til garasjen bare for å starte, og det er ett trykk for mye midt i «prøve den
nye motoren». Alle tre har klassen `kjorknapp` og kobles i én sløyfe;
garasjens har i tillegg `id="knappKjor"`, som prøvene peker på.

## Ekstra: tilbehør som sitter *på* bilen

Dekor er mønstre malt på siden. **Ekstra** er gjenstander — takkoffert,
lysbøyle, surfebrett, sirene, ballonger, eksosrør, gummiand og vimpel. Som
dekor kan flere stå på samtidig, og `valgt.ekstra` er en liste.

Hver del har en `plass` som sier hvilket festepunkt på formen den henger i:
`tak`, `bakluke`, `panser` eller `eksosfeste`. Alt tegnes i **faste mål**, ikke
skalert til formen — en takkoffert er like stor på en racer som på en buss,
akkurat som i virkeligheten, og at et surfebrett henger godt utenfor et lite
tak er nettopp poenget.

**Takdelene stables.** Hver av dem har en `hoyde`, og neste del legger seg oppå
den forrige. Det er det som gjør at ett valg ligger pent nedpå taket mens fire
blir et komisk tårn. Faste lag var det åpenbare alternativet, men da hang
sirenen i lufta hvis kofferten under ikke var kjøpt. Rekkefølgen i `EKSTRA` er
stableorden nedenfra.

### Lysene blinker to steder på hver sin måte

Lamper, blålys, lyn, gnister, stjerner, flammer og neonhjul blinker. To
grupper veksler i motfase: mens A lyser, er B dempet, og lampene i lysbøylen
ligger annenhver i hver gruppe så de løper i stedet for å slå seg av samlet.

Bilen tegnes to helt ulike steder, og de trenger hver sin mekanisme:

* **Garasjen og verkstedet** — bilen er en SVG i DOM-en. Delen får en klasse
  (`blink-a`/`blink-b`), og `styles.css` animerer den. `steps(1, end)` gir et
  hardt skifte; et blålys blinker, det toner ikke.
* **Løypa** — bilen er et bilde tegnet på canvas, og et bilde animerer ikke.
  Der bakes fasen inn: `Bil.tegninger()` lager ett bilde per fase, og
  kjøringen bytter mellom dem i takt med klokka.

Begge veier har nøyaktig de samme to tilstandene og samme takt (0,45 s per
fase), så bilen blinker likt begge steder. `Bil.blink()` er det ene stedet
valget mellom klasse og innbakt verdi tas.

Bildene lages bare når designet endres, så to faser koster to ekstra
serialiseringer i det øyeblikket man trykker KJØR — ingenting per bilderute.

To ting som kostet tid:

* **`TAK`-marginen i viewBoxen.** Fire ting stablet på en lav racer rekker godt
  over der karosseriet slutter, og uten 46 enheter ekstra luft ble sirenen på
  toppen klippet bort. Marginen går også inn i `Bil.tegninger()`, som må flytte
  både `bakke` og hjulplasseringene like mye ned — ellers står bilen 46 enheter
  under asfalten i løypa.
* **Ballongene stiger så høyt det er plass til**, ikke en fast avstand. En
  monsterbil har bakluka nesten oppe i viewBoxens tak, og med fast høyde
  forsvant ballongene ut av bildet på akkurat den formen.
* **Vimpelen blåser bakover.** Bilen kjører mot høyre, så flagget skal ligge
  mot venstre. Første utgave lot det peke forover, og da så det ut som om det
  blåste kraftig imot i stedet for at bilen kjørte fort.
* **`blink()` skriver ut `opacity` når fasen er bakt inn.** Har elementet
  allerede et `opacity`-attributt, blir SVG-en ugyldig og bildet laster ikke i
  det hele tatt. Frontlyktas glød bruker derfor `fill-opacity`.

**Formen eier alle målene.** `dekorboks`, `spoilerfeste`, `tak`, `bakluke`,
`panser` og `eksosfeste` ligger på hver form,
ikke i tegnerutinene, for et lyn skal sitte på siden av karosseriet enten det
er en racer eller en monsterbil. Samme lærdom som `apning` på figurene i
Fargeflasker: hardkodede mål slutter å stemme i det øyeblikket formen skifter.

Ting som har kostet tid her, og som ikke bør rulles tilbake:

* **Bilen kjører mot høyre, så panseret må ligge til høyre.** Den første
  utgaven hadde frontlykta riktig plassert på høyre side, men karosseriet
  speilvendt — langt panser bak, kupé foran — og da leste hele bilen som at
  den kjørte baklengs med lykta bak. Toppkanten på et karosseri skal gå
  bakfra og fram: kort bagasjeluke, bakrute opp, tak, frontrute ned, langt
  panser. Buggyen har buret bak midten av samme grunn; uten det er formen
  symmetrisk og sier ingenting om kjøreretningen.
* **Hjulene er et eget bilde, ikke en del av karosseriet.** Det er det som
  lar dem snurre: i løypa tegnes karosseriet én gang per bilderute og hjulet
  to ganger, rotert etter hvor langt bilen har rullet. `Bil.tegninger()`
  leverer begge, sammen med hjulplasseringene fra formen.
* **Hjulboksen er 110 enheter rundt et hjul med radius 50**, så mønsteret på
  de grove dekkene ikke klippes. Tegner man med hele boksen mot radien i
  stedet for halve, blir hjulet dobbelt så stort som bilen og henger under
  asfalten.
* **Snurringen har et tak på 16 rad/s.** Et femeikers hjul gjentar seg hver
  72. grad, og ekte fart ville gitt over 40 grader per bilderute på toppfart —
  da ser hjulet ut til å gå bakover, samme vognhjuleffekt som på film. Under
  taket er snurringen nøyaktig `v/r`.
* **Spoilerstagene går 26 enheter *under* festepunktet.** De tegnes før
  karosseriet og skjules av det, og det er nettopp overlappen som gjør at
  vingen ser fastskrudd ut. Rekker de bare akkurat ned, får den formen som har
  litt annen takhøyde en luftspalte under vingen.
* **Rakettmotoren strekker seg inn under karosseriet.** Tegnet symmetrisk rundt
  festepunktet svevde den som en løs gjenstand ved siden av bilen.
* **Racerens tak ligger under monsterbilens panser.** To former som bare er
  «litt ulike» leses som samme bil av et barn — forskjellen må være grov.
* **Glitteret bruker et fast mønster, ikke tilfeldige tall.** Bilen tegnes både
  som SVG i garasjen og som bilde i løypa; med `Math.random()` ville de to vært
  forskjellige biler.
* **Bussens dekorbånd er smalere enn på de andre.** Det ligger lavt, mellom
  vinduene og terskelen, og hjulene dekker begge ender av en boks i full
  bredde — stjernene bakerst forsvant bak bakhjulet.
* **Gradientene har en id-forstavelse per tegning.** To biler på samme side med
  samme gradient-id gir den ene feil farge.

Skal du legge til en del, er det én rad i en tabell. Skal du legge til en
**form**, trenger den `kropp`, `hjul`, `dekorboks`, `spoilerfeste`, `lykt`,
`tak`, `bakluke`, `panser` og `eksosfeste`, og den må vende mot høyre —
og da er det verdt å rendre hele arket av form × spoiler og form × dekor og se
på det, for det er der feilene sitter.

## Løypa

Bygges av segmenter i `Lope.bygg()`: `flat`, `kul`, `trapp`, `bolger`, `loop`,
`rampe` og `gap`. Én løype, rundt 19 600 enheter lang: fire looper, fire hopp
og bakker opp og ned hele veien. En umodifisert bil bruker vel 30 sekunder.

### To regler for hvor ting kan ligge

Begge følger av at **bilen bare kan lande på fast grunn**, og begge
kontrolleres av `tester/lope.js`:

1. **Ingen loop innenfor rekkevidden til et hopp.** En loop i flybanen er
   ikke noe bilen treffer — den seiler tvers gjennom asfalten i lufta. En
   fullt oppgradert bil flyr over 3000 enheter, så alle fire loopene ligger
   før den første rampa.
2. **Minst 3400 enheter mellom to rampekanter.** Ellers flyr en maksbil over
   den neste rampa og hopper aldri fra den.

Det siste hoppet bryter regel 2 med vilje: alt etter den siste rampekanten er
kortere enn en maksbils rekkevidde, så **en ferdig utbygd bil flyr fra siste
avsprang og helt over målstreken**. En umodifisert bil lander etter 650
enheter og kjører de siste 2300. Det er belønningen for å ha bygd bilen
ferdig, og prøven passer på begge halvdelene: at maksbilen når fram, og at den
nakne ikke gjør det.

* **Loopen driver litt mot høyre** mens den går rundt, så inn- og utgang ikke
  ligger oppå hverandre. Ellers ser løypa ut til å ha en knekk der den
  egentlig bare er tilbake der den startet.
* **Punktene i en loop er merket `bakke: false`.** Bilen kan ikke lande i en
  loop, og jorda tegnes ikke under den.
* **Løypa deles i strekninger som brytes ved hopp, og bare der.** Et tidlig
  forsøk brøt på loop-punktene i stedet, og da fikk bakken et loddrett hull i
  hele loopens bredde — man så himmelen gjennom jorda.
* **Myntene ligger langs normalen, som peker innover i en loop.** Det er det
  som gjør at en loop lønner seg: man plukker et dusin mynter på en runde man
  uansett skulle kjørt.
* **Tangenten regnes ensidig på hver side av et gap.** Dette var den verste
  feilen i løypa. Naboen på den andre siden av et hopp ligger flere hundre
  enheter unna og lavere, så snittet over gapet gjorde tangenten på en
  45-graders rampe til noen få grader *nedover* — bilen forlot rampa med nesa
  ned og datt ut i hullet i stedet for å bli kastet opp. Hoppene så livløse ut
  uten at det var åpenbart hvorfor.
* **Myntbuen over et hopp er den ekte kastebanen.** Den regnes ut av
  avsprangsvinkelen, referansefarten og *samme tyngdekraft som fysikken
  bruker* — derfor tar `Lope.bygg()` imot `Kjoring.G` i stedet for å ha sin
  egen konstant. Første utgave var en tegnet sinusbue med topp 170 over gapet,
  mens bilen i praksis nådde 154 og landet flere hundre enheter forbi der buen
  sluttet. Myntene hang både for høyt og på feil sted, og hoppet så ut som om
  bilen ignorerte dem.
* **Begge loopene ligger før begge hoppene.** En fullt utstyrt bil flyr nesten
  2000 enheter. Lå en loop innenfor den rekkevidden, seilte bilen tvers gjennom
  loopens asfalt i lufta — den kan bare lande på fast grunn, så loopen er ikke
  noe den treffer, bare noe den klipper gjennom.
* **Utrullingen er lang med vilje.** En maksbil lander nesten 1900 enheter
  etter den siste rampa og skal rekke ned før målstreken.

## Prøving

Løypa og økonomien har prøver som verken trenger nettleser eller server:

```
node pwa-stunt/tester/lope.js
```

De kjører hele turen for en umodifisert og en fullt oppgradert bil og krever
blant annet at begge kommer i mål, at alle fire gapene klares med margin, at
ingen loop ligger i en flybane, at maksbilen når målet fra siste hopp og at
den nakne ikke gjør det. **Kjør dem etter hver endring i `lope.js` eller
`fysikk.js`** — priser, rampevinkler og motorverdier henger sammen på måter
det ikke går an å se på koden.

Feiler prøven på `REFERANSEFART`, er det myntbuene som har sluttet å følge
bilen: buene regnes ut av den farten, og feilmeldingen sier hva den faktiske
avsprangsfarten ble. Sett `REFERANSEFART` i `js/lope.js` til det tallet.

Hoppene er lettest å vurdere som en bildeserie: skyt skjermbilder gjennom hele
svevet og se om bilen ligger *på* myntene. Gjør den det, stemmer både vinkelen,
farten og buen.

Løypa skal virke både stående og liggende. Skalaen tar den strengeste av
bredde og høyde nettopp derfor — uten det blir bilen et frimerke i portrett og
fyller skjermen i landskap.
