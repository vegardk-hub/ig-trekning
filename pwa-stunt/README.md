# Stuntgarasjen

Bygg og design en stuntbil, kjør den gjennom baner med looper, hopp, is,
gjørme, tunneler og broer, og tjen penger til flere deler. PWA, som de andre
appene her — ingen avhengigheter, ingen byggesteg, alt lagret lokalt.

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

## Kontrollene: tre knapper, og ulik jobb på bakken og i lufta

Gass og brems gjør to forskjellige ting avhengig av hvor bilen er. Det er det
som gjør at det finnes noe å gjøre hele veien, uten en fjerde knapp:

| | På bakken | I lufta |
| --- | --- | --- |
| Gass | framover, med lavgir | snurrer bilen **bakover** |
| Brems | bremser | snurrer bilen **forover** |
| Turbo | ekstra kraft, tømmer måleren | ingenting — ingen bakke under hjulene |

### Saltoen er en kontroll, ikke en utbetaling

En hel runde rundt i lufta er en salto, og den betales **bare hvis bilen lander
noenlunde rett** — innenfor `SALTOVINDU` på 0,75 radianer. Det er det som gjør
den til noe man gjør og ikke til gratis penger: holder man bare gassen,
fortsetter bilen å snurre og lander på taket. Slipper man begge knappene,
demper spinnet seg og bilen søker mot nærmeste hele runde. **Spinn opp, slipp,
land flatt.**

Et første forsøk betalte saltoen i det runden ble fullført, midt i lufta. Da
fikk en maksbil som bare holdt gassen åtte saltoer per tur og tjente 33 % mer
uten å gjøre noe — prøven `maks.saltoer === 0` står der for å hindre at det
kommer tilbake.

En bom koster ingenting. Det er hele premisset: her finnes det ingen måte å
tape på, så en mislykket salto er en uteblitt bonus, aldri en straff. Det
eneste som skjer, er at bilen retter seg opp igjen på bakken — og den
vrikningen er nettopp signalet om at den ikke satt.

Hintet kommer i to trinn, og bare til barnet har landet sin første:
«Hold gass i lufta = salto!» mens den snurrer, så «Slipp, så lander du rett!»
så snart runden er i boks.

### Turboen fylles av det man plukker

Måleren fylles av mynter (`TURBOMYNT`) og looper (`TURBOLOOP`), så det man
samler underveis blir til noe man kan bruke. Den kan ikke *tennes* under 22 %,
men en turbo som allerede brenner får tømme tanken — uten det unntaket slukner
den midt i en bakke med en fjerdedel igjen.

To tall er verdt å vite hvorfor står der:

* **Taket er bare 15 % over toppfarten.** Myntbuene over hoppene er regnet ut
  fra en *målt* avsprangsfart (`REFERANSEFART` i `lope.js`), og en turbo som ga
  vesentlig mer fart ville sendt bilen i en bue langt over sine egne mynter.
* **Kraften toner ut mot det taket**, slik lavgiret toner ut mot toppfarten.
  Et første forsøk la på en fast kraft og stolte på den myke toppfartsbremsen.
  Den bremser med 2,2 per sekund; en maksbil med turbo fant likevekt over 2000,
  fløy 8745 enheter, hoppet over to ramper og seilte tvers gjennom løypa.

Det finnes et gulv på 0,15 i uttoningen, så knappen aldri kjennes død: en bil
som allerede ligger på taket sitt skal fortsatt få et dytt og et flammesprut.

**Turboen er ikke gratis å spamme.** På en fullt oppgradert bil er rampene bare
rundt 330 enheter fra å nås av forrige hopp, og turboen spiser den marginen: en
maksbil med turboen inne hele veien flyr *forbi* en rampe og taper hoppet.
Det er en ekte avveining, ikke en feil.

## Kameraet: bilen står midt i bildet

Den sto lenge på **36 %** av bredden, med den begrunnelsen at bilen kjører én
vei og trenger plass til å se hva som kommer. I tillegg skjøv et *framsyn*
kameraet opp til 150 enheter videre framover jo fortere bilen gikk. De to la
seg oppå hverandre: på en telefon havnet bilen rundt **20 %** inn fra venstre
kant, og eieren ba om den midt i bildet.

Nå er ankeret 0,5 og framsynet borte. Sikten framover er ikke tapt av den
grunn — synsfeltet ble utvidet fra 1000 til 1100 enheter da kulissene kom, så
halve det er 550 enheter mot 640 før. Til gjengjeld ser man mye mer *bak*
bilen, og det er der dollartegnene fra et hopp henger igjen.

Kameraet trekker seg fortsatt litt ut i fart og rister når bilen lander. Det
er de to tallene som gjør at bildet *kjører* bilen i stedet for bare å følge
den.

## Farten: én skala, ikke nye tall

Alt i `fysikk.js` er stemt av mot alt annet — rampevinkler, hopplengder,
myntbuer, økonomi. Farten kan derfor ikke settes ned ved å skru på tallene
uten å rive opp hele avstemmingen.

`TIDSSKALA` (0,78) senker i stedet *hele verden* likt: bilen bruker lenger tid
på samme løype, og ingen avstand, bue eller sum endrer seg. Hastighetsmåleren
i HUD-en ganges med den samme skalaen, for et tall som sier 160 mens bilen
tydelig går saktere, leser som at måleren er ødelagt.

`tid` i resultatet er **simulerte** sekunder. Virkelig varighet er
`tid / TIDSSKALA`, og det er det tallet `tester/lope.js` måler mot: en
umodifisert bil bruker rundt 40 sekunder, en maksbil rundt 22.

## Oppgraderinger: ti tiere à fem trinn

Motor, girkasse og dekk hadde sju nivåer hver, og bilen var ferdig utbygd
etter rundt tjue turer. Så ble det seks tiere, og da tok det sytti — fortsatt
for fort. Nå er det **ti tiere med fem trinn i hvert**: femti kjøpbare trinn
per del, hundre og femti i alt, og rundt **190 turer** før alt er eid. Hvert
tier har sin egen farge og sitt eget navn, og siste trinn i et tier løfter
bilen inn i det neste:

| Tier | | Farge | | Tier | | Farge |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Stål | `#9aa7bd` | | 6 | Rubin | `#ff4d5e` |
| 2 | Bronse | `#c9803f` | | 7 | Magma | `#ff8a2b` |
| 3 | Smaragd | `#4ade80` | | 8 | Gull | `#ffd54a` |
| 4 | Safir | `#38bdf8` | | 9 | Plasma | `#ff2d95` |
| 5 | Ametyst | `#c084fc` | | 10 | Kvantum | `#2ffbe0` |

De seks første navnene sto her fra før og er beholdt i rekkefølge — et barn
som har nådd Safir, skal ikke finne at Safir plutselig er noe annet. Bronse og
Rubin er skutt inn der stigen trengte et trinn, Gull og Kvantum lagt på toppen.

`TRINN` er uendret på fem. Derfor betyr nivå 5 fortsatt «tier 2, null av fem»,
og en lagring fra da det var seks tiere, peker på nøyaktig samme tier som før
— den har bare flere igjen over seg.

Tre tall henger sammen her, og ingen av dem går an alene:

* **Ytelsen har samme tak som før.** Toppfarten på siste trinn er fortsatt
  1280. Den *må* være det: farten går inn i hopplengden i annen potens, og et
  forsøk med 1650 ga en maksbil som fløy 5000 enheter og seilte over både
  neste rampe og alt som lå mellom. Flere tiere gir altså **finere trinn, ikke
  en raskere bil** — «litt og litt bedre».
* **Prisene ganges med 1,64 for hvert tier** (`TIERFAKTOR`), og med 30 % for
  hvert trinn inne i et tier. Tallet ser lavere ut enn det var med seks tiere
  (2,35), og er det ikke: med ti tiere ganges det opp ni ganger i stedet for
  fem, så tier 10 koster 75 ganger tier 1. Første motortrinn koster $150,
  første trinn i tier 10 koster $11 500.
* **Inntekten må følge etter, men saktere.** `teknikkbonus()` ganger opp alt
  man tjener, opp til ×4,0 med alt bygd. Uten den blir de siste tierne en
  vegg, for ytelsen har jo et tak — en halvferdig bil kjører nesten like fort
  som en ferdig og ville tjent omtrent det samme. Men den vokser *saktere* enn
  prisene, og det er nettopp differansen som gjør at et tier tar lengre tid
  enn det forrige.

`UTBETALING` (0,60) er grunnsatsen alle utbetalinger ganges med. Den er det ene
tallet som styrer tempoet uten å røre balansen *mellom* utbetalingene — en mynt
skal fortsatt være verdt en tidel av en loop, og en salto skal fortsatt være
det største enkeltbeløpet i spillet. En umodifisert tur gir rundt $500, mot
$890 før.

`tester/lope.js` spiller gjennom hele progresjonen med en grådig kjøper og
teller turer. Det er den eneste prøven som faktisk setter de tre tallene opp
mot hverandre, og den sier fra hvis de driver fra hverandre:

```
turer per tier: T1:8 T2:5 T3:5 T4:8 T5:11 T6:13 T7:18 T8:29 T9:46 T10:46
alt eid etter 190 turer
```

**Fra tier 3 og opp varer hvert tier lenger enn det forrige**, og prøven
håndhever det. Kravet gjelder ikke tier 1 og 2: der konkurrerer
oppgraderingene med designkatalogen om de samme pengene, og stilbonusen dobler
inntekten i løpet av de første ti turene. De to første tierne blir korte
uansett hva prisene gjør — og det er riktig, for det er der barnet kjøper lakk
og glitter.

### Dekk-tieret er det eneste man ser

Motor og girkasse er tall. Felgen er et bilde, og den er det som gjør et nytt
tier til noe annet enn en dyrere pipe i en meter. Lagene **stables** — et tier
legger til noe, det fjerner aldri noe — så tier 6 er summen av alt, og barnet
kjenner igjen det det allerede hadde:

| Tier | Legger til |
| --- | --- |
| 1 | dekk, felg, eiker, nav |
| 2 | skygge i gummien og **felgkant i tierfargen** |
| 3 | boltring i tierfargen |
| 4 | bremseskive bak eikene |
| 5 | farget navkapsel |
| 6 | neonring inne i felgen, blinker |
| 7 | lys i eikene, i motfase |
| 8 | enda en ring lenger ut |
| 9 | gnister rundt felgkanten |
| 10 | full glorie utenfor dekket |

Ett lag per tier er ikke tilfeldig: **et tier som ikke endrer noe man ser, er
en dyrere pipe i en meter.** Et første forsøk med ti tiere ga tier 2 og 3 bare
en skygge i gummien og hvite bolter — de så ut nøyaktig som tier 1, mens navnet
og fargen i verkstedet sa noe helt annet. Derfor kommer tierfargen inn allerede
på felgkanten i tier 2. Legger du til tiere, må lista deles på nytt — ikke
stables opp i toppen.

Ingen `<filter>`. Glød lages av tre konsentriske streker med fallende bredde og
stigende ugjennomsiktighet (`glorie()`). Et SVG-filter ville vært penere, men
tegningen serialiseres til en data-URL og rastreres per designbytte — filtre er
både trege og upålitelige den veien.

To ting som kostet tid:

* **`HJULBOKS` måtte fra 110 til 150.** Glorien på tier 6 rekker ut til 1,29
  ganger radien, og den gamle boksen stoppet på 1,1. Hele neonringen ble skåret
  bort — og bare i løypa, for i garasjen er bilen en SVG uten noen boks å
  klippes mot. Endrer du glorien, må tallet følge etter.
* **Hjulprøvene i verkstedslista tegnes uten tier.** Lista finnes for å skille
  de fem designene fra hverandre, og på tier 6 la glorien seg over alle fem så
  de ble til fem like rosa klatter. Bilen rett over lista viser hvordan det
  faktisk ser ut.

### En gammel lagring begynner på tier 2

`Fysikk.fraGammelLagring()` regner om en lagring fra den gamle sjunivå-skalaen.
En bil som var **fullt utbygd der, begynner på starten av tier 2** — ikke på
toppen av tier 6.

Det er en retting, ikke den opprinnelige planen. Første forsøk ganget det
gamle nivået med `TRINN`, og da landet en maksbil rett på trinn 30: ferdig
utbygd i samme øyeblikk som appen oppdaterte seg, med hele det nye systemet
oppbrukt før det var prøvd. Eierens to barn hadde begge maksa bilen, og fikk
seks tiere de aldri kom til å spille.

Begge veiene inn må derfor rettes, for `versjon: 2` rakk å bli lagret hos dem
som åpnet appen mens den lå ute:

| Lagringen sier | Hva som gjøres |
| --- | --- |
| ingen `versjon` | gammelt nivå 0–6 skaleres inn i tier 1 |
| `versjon: 2` | deles på `TRINN` først, så samme skalering |
| `versjon: 3` og opp | står som det er |

De to første veiene må gi **nøyaktig samme svar** for hvert gamle nivå — de
kommer fra de samme dataene — og prøven går gjennom alle sju og sier fra hvis
de er uenige.

Taket på `TRINN` er det som gjør at «makset» blir nøyaktig tier 2, trinn null.
**Penger, design og rekord røres ikke**: det er bare ytelsen som spoles
tilbake, for det er den progresjonen som skal spilles på nytt. En bil som var
maksa, har som regel noen tusen spart, og de er et godt forsprang inn i tier 2.

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
| Umodifisert bil, én tur | ~$496 |
| Umodifisert bil, kjørt godt (saltoer landet, turbo brukt) | ~$552 |
| Fullt utbygd bil, én tur | ~$4841 |
| Hele designkatalogen | $5790 |
| Alle oppgraderinger (150 trinn) | $698 725 |
| Turer til alt er eid | ~190 |

Avstanden mellom den første og den siste bilen er ni ganger, og det er
teknikkbonusen som gjør det: prisene i tier 6 er hundre ganger dem i tier 1.
Blir den mye større, er de første turene ikke verdt å kjøre; blir den mindre,
er de siste tierne en vegg. Prøven holder den mellom seks og tolv.

Tallene måles av `tester/lope.js`, som feiler hvis de driver utenfor rammene.
Å eie alt tar rundt 190 turer, og de siste tierne er noe man sparer til over
mange økter — det er meningen.

**De to bonusene ganges sammen.** Stil kommer fra pynt, teknikk fra
oppgraderinger, og de er to uavhengige måter å tjene mer på. Begge skal lønne
seg uten å gjøre den andre unødig; derfor er det `bonus × teknikkbonus` og
ikke den største av dem.

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

Saltoen er den største enkeltutbetalingen i spillet — 45 mot 35 for en loop og
4 for en mynt, før `UTBETALING` og bonusene. Det er med vilje: den er det eneste som krever at barnet
gjør noe annet enn å holde gassen. Taket på hva én tur kan gi, måles som
`nakenAlt` i prøven, og skal ikke kunne dobles av salto og turbo alene.

## Filene

| Fil | Svarer for |
| --- | --- |
| `js/bil.js` | Delekatalogen og tegningen av bilen |
| `js/garasje.js` | Rommet bilen står i på garasjeskjermen |
| `js/lope.js` | Banekatalogen, byggesettet, punktlista, myntene, sonene |
| `js/banekart.js` | Høydeprofilen på kortet i banevelgeren |
| `js/fysikk.js` | Simuleringen: fart, hopp, mynter, penger, oppgraderinger |
| `js/kulisse.js` | Himmel, landskap, asfalt, soner og mål — alt som ikke er bilen |
| `js/kjoring.js` | Kamera, bil, partikler og sløyfa |
| `js/app.js` | De sju skjermene, butikken, lagringen |

**Fysikken ligger for seg selv, uten et eneste piksel.** Den ble skilt ut fra
`kjoring.js` fordi løypa må stemmes av mot tall bare simuleringen kjenner:
hvor fort bilen forlater hver rampe, hvor langt den flyr, om en maksbil
rekker fra siste hopp til mål. Så lenge fysikken satt inne i tegnekoden,
måtte hvert slikt spørsmål besvares ved å instrumentere koden med en
`console.log`, starte en nettleser og kjøre løypa i sanntid — flere minutter
per svar. Nå svarer `tester/lope.js` på alt sammen på et sekund, og
nettleseren gir nøyaktig de samme tallene.

## Dybde uten 3D

Det finnes ingen WebGL her, og ingen 3D-motor. Følelsen av rom er satt sammen
av fire billige grep i `kulisse.js`, og de bærer hele utseendet:

* **Fire parallakselag** med fjell, snø og skog. Hvert lag blandes mot
  himmelens disfarge etter hvor langt unna det er — luftperspektiv. Uten det
  blir alle åsene like harde, og bildet er flatt uansett hvor mange lag man
  legger på.
* **Bakken er et tverrsnitt**, ikke en grønn flate: gresstorv, jord og fjell i
  lag, som en geologisk profil. Det er det som gir bakken volum i stedet for å
  være en silhuett.
* **Asfalten er et bånd med tykkelse**, tegnet langs normalen til kurven. En
  `lineWidth`-strek ville gitt samme bildet, men da er det ingen kant å legge
  høylys eller mørkt understell på, og veien blir flat.
* **Himmelen skifter gjennom turen**, fra morgen til solnedgang, med stjerner
  som tennes når den mørkner. Løypa er lang nok til at en tur føles som en
  reise, og en himmel som skifter er det billigste som sier det.

Garasjegulvet er det eneste stedet som later som det er tredimensjonalt: et
rutenett med forsvinningspunkt bak veggen, og tverrlinjer som står tettere
bakover. Det koster åtte linjer kode, og uten det leser gulvet som enda en
vegg lagt ned.

Fire feller dette har gått i, som alle ville kommet tilbake:

* **`bland()` gir fra seg `rgb(...)`, og luftperspektivet blander en allerede
  blandet farge videre.** Så lenge `les()` bare forsto `#rrggbb`, ga det andre
  leddet `rgb(NaN,NaN,NaN)` — og canvas **ignorerer en ugyldig `fillStyle`
  stille**. Flaten ble tegnet i forrige farge, og hele landskapet kom ut som
  én blek klump uten at noe klaget.
* **Parallaksen ligger i et forskjøvet koordinat, ikke i en ganget x.** Et
  lag skal vandre `dybde` så fort som kameraet, og får det av `x - kam.x *
  (1 - dybde)`. Ganger man x-en med `dybde` i stedet, ganges bølgelengden med
  det samme: kameraet ser 630 enheter, og de fjerne lagene ble flate plater
  fordi én skjerm dekket en tiendedel av en fjellrygg.
* **Fjellprofilen er `1 - |sin|`, ikke `sin`.** En ren sinus gir runde topper,
  og fire lag med runde topper leser som vann. Absoluttverdien legger en knekk
  på toppen, og det er knekken som gjør en silhuett til et fjell.
* **`clip-path` løses i rommet elementets eget `transform` setter opp.**
  Refleksjonen i garasjegulvet er en speilvendt, skalert gruppe; med klippet
  på den samme gruppa ble klipperuta tolket i speilvendt rom og fjernet hele
  refleksjonen. Klippet må ligge på en ytre gruppe uten transform.

## Kjøretøyene: fem biler, ikke fem skall

En **form** er pynt: fire karosserier til 0–320 kroner som alle hører til den
samme bilen. Et **kjøretøy** er en egen bil, og den skillelinja er hele
poenget — et kjøretøy har **sine egne oppgraderinger, og et nytt begynner på
null**.

| | Pris | Ganger | Hva den er |
| --- | --- | --- | --- |
| 🏎️ Stuntbilen | $0 | ×1,00 | Bilen man starter med. Den eneste som kan bytte form. |
| 👹 Beistet | $10 000 | ×1,35 | Monstertruck med rullebur og de største hjulene i katalogen. |
| 🛡️ Panservogna | $20 000 | ×1,75 | Kantete, naglet, med sikteglugger i stedet for vinduer. |
| 🔥 Jetbilen | $30 000 | ×2,30 | Dragster med jetdyse, svære drivhjul og bitte små forhjul. |
| 🛸 Romfartøyet | $40 000 | ×3,00 | Glasskuppel, neonlys under skroget og antenne. |

### Hvorfor inntekt og ikke ytelse

Et dyrere kjøretøy kunne fått mer motor. Det går ikke: **taket på 1280 i
toppfart er målt mot hopplengdene**, og et kjøretøy som fløy lengre ville
seilt tvers gjennom looper og forbi ramper. Prøvene ville sagt fra, men det er
ikke en avveining — det er et tak.

Så et dyrere kjøretøy **tjener mer per tur** i stedet, og *ser* tøffere ut.
Begge deler er ting et barn ser med én gang, og ingen av dem rører fysikken.

### Hvorfor «begynner på null» ikke er et tap

**Den gamle bilen blir stående i garasjen, ferdig bygd.** Man bytter fram og
tilbake på ett trykk, og den maksa Stuntbilen tjener like mye dagen etter
kjøpet som dagen før. Et nytt kjøretøy er derfor noe man bygger opp *fordi man
vil*, ikke noe man blir tvunget gjennom.

Steget ned rett etter kjøpet er målt, og prøven holder det i sjakk: en fersk
bil skal tjene mer enn en fjerdedel av det en maksa Stuntbil gjør.

| | Fersk | Maksa |
| --- | --- | --- |
| Stuntbilen | $1 085 | $4 841 |
| Beistet | $1 357 (28 %) | $6 216 |
| Panservogna | $1 781 (37 %) | $8 088 |
| Jetbilen | $2 393 (49 %) | $10 614 |
| Romfartøyet | $3 084 (64 %) | $13 839 |

### Tre ting som ser ut som detaljer

* **Kjøretøyet teller ikke på stilen.** Det har sin egen ganger, og teller det
  begge steder, ganges den samme fordelen opp to ganger — og da ryker
  kalibreringen av `Bil.bonus()` uten at noe sier fra. Prøven håndhever det.
* **Formfanen forsvinner når kjøretøyet eier sitt eget karosseri.** En fane
  som ikke endrer noe er verre enn ingen fane: barnet trykker på en racer og
  bilen over lista blir stående som et romfartøy. Valget står igjen urørt til
  man bytter tilbake til Stuntbilen.
* **Ett snurretall per hjul.** Jetbilen har 56 i radius bak og 24 foran. Med
  én felles vinkel snurret det lille hjulet altfor sakte for farten, og bilen
  så ut til å skli på forhjulet hele veien.

### Å legge til et kjøretøy

Én ny post i `KJORETOY` i `js/bil.js`. Den bruker de samme feltene som en form
(`kropp`, `hjul`, `dekorboks`, `spoilerfeste`, `lykt`, `tak`, `bakluke`,
`panser`, `eksosfeste`, `strek`) pluss `pris`, `inntekt`, `tegn` og `omtale`.
Valgfrie lag: `understell`, `bur`/`burstag`, `nagler`, `dyse`, `neon`,
`antenne`. Kortet, kjøpet, den egne oppgraderingstilstanden og prøvene følger
av seg selv.

## Bilen tegnes, den lastes ikke ned

Som truckene i Monstergiret: én tegnerutine og en tabell. Seks kategorier som
kan settes sammen fritt — form, lakk, hjul, dekor, spoiler, ekstra — og fem
kjøretøy som hver eier sitt eget karosseri. To av kategoriene er lister der
hvilken som helst kombinasjon kan stå på: seks dekortyper (2⁶) og åtte
tilbehør (2⁸). Til sammen 8 × 9 × 5 × 64 × 5 × 256 = **29,5 millioner**
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

Garasjeskjermen viser bilen i et rom: port, vegg, et gulv i perspektiv, to
lamper med lyskjegler og lyspytter, vimpler, verktøytavle, hylle,
verktøykasse og en dekkstabel. Bilen speiler seg svakt i gulvet. Alt ligger i
`js/garasje.js` — `bil.js` svarer for bilen og ingenting annet.

Rekkefølgen i gulvet er ikke tilfeldig: **speilbildet, så dempingen, så
lyspyttene, så bilen.** Lyset legger seg *over* refleksjonen og vasker den ut
der gulvet er lyst, akkurat som et blankt betonggulv gjør.

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

## Banene

Fem baner, og de skal kjennes forskjellige — ikke bare se det. Hver av dem har
et eget *premiss*, ikke bare en annen rekkefølge på de samme bakkene:

| Bane | Premiss | Innhold |
| --- | --- | --- |
| 🏁 Stuntløypa | Originalen | 4 looper, 4 hopp |
| 🧊 Frostruta | Isen gjør bilen glatt | 4 looper, 3 hopp, is |
| 🕳️ Gruvegangen | Trangt, mørkt og tungt | 3 looper, 3 hopp, tunnel, bro, gjørme |
| 🚀 Rakettrampa | Bare hopp, ingen looper | 6 hopp, rumlefelt |
| 🌀 Korketrekkeren | Nesten ingen rett strekning | 8 looper, 2 hopp, rumlefelt |

Banevelgeren ligger bak 🗺️-knappen i garasjen. Et trykk på et kort velger
banen **og** starter den: velgeren er ikke en innstilling man går ut av igjen.

### Å legge til en bane

Skriv én ny post i `BANER` i `js/lope.js`, med en `bygg`-funksjon som får
byggesettet. Alt annet følger av seg selv:

* kortet i velgeren, med farge og tegn fra posten
* høydeprofilen, som `js/banekart.js` tegner av løypas egne punkter
* merkene som sier hva banen inneholder — de **telles ut av punktlista**, så
  de kan ikke bli uenige med det man faktisk kjører
* rekorden, som lagres per bane (`stat.rekord[baneId]`)
* hele prøvesettet i `tester/lope.js`, som går gjennom *alle* banene

### Byggesettet

`flat`, `kul`, `trapp`, `bolger`, `loop`, `rampe` og `gap` som før, pluss:

* **`korketrekker(r, drift, antall)`** — flere looper rett etter hverandre,
  uten flatt mellom. Radien krymper åtte per runde, så spiralen strammer seg i
  stedet for å se ut som den samme loopen klistret opp to ganger.
* **`rumlefelt(lengde, antall)`** — vaskebrett. Korte, tette bølger i sonen
  `rumle`, som spiser fart og rister kameraet.
* **`sone(navn, f)`** — alt som lages inne i `f` får sonen. Den tas av igjen
  etterpå i stedet for å slås på og av med to setninger: en sone som ble glemt
  påslått, ville farget resten av banen, og det ser man ikke før man har kjørt
  helt til mål.

### Sonene

Soner er underlag og byggverk, og de er den ene tingen som gjør at to baner med
de samme bakkene kjennes som to steder. Tabellen ligger i `Lope.SONER`;
`fysikk.js` leser `friksjon` og `brems`, `kulisse.js` tegner dem.

| Sone | Friksjon | Brems | Hva den gjør |
| --- | --- | --- | --- |
| Is | ×0,35 | ×0,30 | Bilen glir langt, bremsen biter nesten ikke |
| Gjørme | ×2,40 | ×1 | Spiser farten — her betyr lavgiret og turboen noe |
| Rumlefelt | ×1,35 | ×1 | Rister kameraet, spiser litt fart |
| Tunnel | ×1 | ×1 | Bare tegning: lavt fjelltak med lamper |
| Bro | ×1 | ×1 | Fast grunn **uten jord under** (`luft: true`) |

Fire ting som ser ut som detaljer og har en grunn:

* **Ramper står på bar asfalt, med lang innkjøring.** En rampe rett etter en
  isstrekning ga en avsprangsfart langt over `REFERANSEFART`, og da henger
  myntbuen et sted bilen aldri kommer. Frostruta har derfor `flat(900)` foran
  hver rampe, og prøven håndhever grensa på ±130 for *hver* bane.
* **Jorda brytes ved hopp og ved `luft`-soner, aldri ved looper.** Bryter man
  på loop-punktene, får bakken et loddrett hull i loopens bredde og man ser
  himmelen gjennom jorda. Veien går derimot over broene som over alt annet, så
  den har sin egen strekningsliste.
* **Hver loop skriver seg selv opp.** Før ble loop-strekningene funnet ved å
  lete etter sammenhengende punkter uten bakke, og det holdt så lenge det
  alltid var asfalt mellom to looper. I en korketrekker er det ikke det: de to
  rundene smeltet sammen til én strekning, og barnet fikk betalt én gang for
  to looper.
* **Ingen bane skal være den åpenbare pengemaskinen.** Er én vesentlig bedre
  betalt enn de andre, velges den hver gang og de fire andre er pynt. Prøven
  krever at både en naken og en maks tur ligger innenfor ±25 % av Stuntløypa.
  Tallene i dag: naken $496/$493/$466/$577/$476, maks $5725/$5156/$4962/
  $5550/$4342.

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
* **Jorda deles i strekninger som brytes ved hopp og ved `luft`-soner.** Et
  tidlig forsøk brøt på loop-punktene i stedet, og da fikk bakken et loddrett
  hull i hele loopens bredde — man så himmelen gjennom jorda. Veien har sin
  egen liste, som bare brytes ved hopp: den går over broene.
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

Den siste bolken går gjennom **hver bane i katalogen** og krever det samme av
alle: begge biler i mål, en bil uten gass som *ikke* kommer i mål, alle gap
klart med margin, avsprangsfart innenfor ±130 av `REFERANSEFART`, ingen loop i
en flybane (heller ikke med turbo), rimelig varighet, og en utbetaling
innenfor ±25 % av Stuntløypa. Det er det som gjør at en ny post i `BANER` blir
prøvd av seg selv.

Feiler prøven på `REFERANSEFART`, er det myntbuene som har sluttet å følge
bilen: buene regnes ut av den farten, og feilmeldingen sier hva den faktiske
avsprangsfarten ble. Sett `REFERANSEFART` i `js/lope.js` til det tallet.

Hoppene er lettest å vurdere som en bildeserie: skyt skjermbilder gjennom hele
svevet og se om bilen ligger *på* myntene. Gjør den det, stemmer både vinkelen,
farten og buen.

Løypa skal virke både stående og liggende. Skalaen tar den strengeste av
bredde og høyde nettopp derfor — uten det blir bilen et frimerke i portrett og
fyller skjermen i landskap.
