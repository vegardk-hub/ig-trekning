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

Alle tre står i `js/kjoring.js` med tall man kan se, ikke som skjulte
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
man tjener i løypa**. En naken bil ligger på ×1,05; alt kjøpt gir ×2,07. Da er
glitter en investering som betaler seg over noen turer, ikke en utgift som
gjør bilen dårligere. Det oppfyller også ønsket om «mer penger når man designer
mer avansert» — men som en sats per tur, ikke en engangssum man kan hente ut om
igjen ved å bytte deler fram og tilbake.

Tallene er kalibrert slik:

| | |
| --- | --- |
| Startkapital | $250 |
| Umodifisert bil, én tur | ~$391 |
| Fullt utstyrt bil, én tur | ~$832 |
| Alt i katalogen | ~$4000 |

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
| `js/lope.js` | Løypa: punktlista, myntene, oppslag langs kurven |
| `js/kjoring.js` | Fysikk, kamera, tegning av løypa, oppgraderinger |
| `js/app.js` | De fem skjermene, butikken, lagringen |

## Bilen tegnes, den lastes ikke ned

Som truckene i Monstergiret: én tegnerutine og en tabell. Fem kategorier som
kan settes sammen fritt — form, lakk, hjul, dekor, spoiler — gir 4 × 9 × 5 × 7
× 5 = 6300 forskjellige biler uten en eneste bildefil.

**Formen eier alle målene.** `dekorboks` og `spoilerfeste` ligger på hver form,
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
* **Gradientene har en id-forstavelse per tegning.** To biler på samme side med
  samme gradient-id gir den ene feil farge.

Skal du legge til en del, er det én rad i en tabell. Skal du legge til en
**form**, trenger den `kropp`, `hjul`, `dekorboks`, `spoilerfeste` og `lykt`,
og den må vende mot høyre —
og da er det verdt å rendre hele arket av form × spoiler og form × dekor og se
på det, for det er der feilene sitter.

## Løypa

Bygges av segmenter i `Lope.bygg()`: `flat`, `kul`, `trapp`, `bolger`, `loop`,
`rampe` og `gap`. Én løype foreløpig, med to looper og to hopp.

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

Ingen prøvefiler her ennå. Etter endringer i fysikk eller priser er det verdt
å kjøre appen med en umodifisert bil og med en fullt utstyrt bil, og se at
begge kommer i mål og at de to summene ligger omtrent der tabellen over sier.
Sjekk også en bil som aldri får gass: den skal bli stående med hintet synlig,
ikke låse skjermen.

**Endrer du motor, girkasse eller rampene, må `REFERANSEFART` i `js/lope.js`
måles på nytt**, ellers slutter myntbuene å følge bilen. Legg midlertidig en
`console.log` i `start_hopp()` i `js/kjoring.js` som skriver ut `b.v` og
avsprangsvinkelen, kjør en umodifisert bil gjennom løypa, og bruk farten på det
første hoppet. Gapene bør samtidig ligge et godt stykke innenfor den målte
rekkevidden — de skal klares med margin, ikke reddes av kanten.

Hoppene er lettest å vurdere som en bildeserie: skyt skjermbilder gjennom hele
svevet og se om bilen ligger *på* myntene. Gjør den det, stemmer både vinkelen,
farten og buen.

Løypa skal virke både stående og liggende. Skalaen tar den strengeste av
bredde og høyde nettopp derfor — uten det blir bilen et frimerke i portrett og
fyller skjermen i landskap.
