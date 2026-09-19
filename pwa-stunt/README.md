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

## Oppgraderinger: seks tiere à fem trinn

Motor, girkasse og dekk hadde sju nivåer hver, og bilen var ferdig utbygd
etter rundt tjue turer. Nå er det **seks tiere med fem trinn i hvert** — tretti
kjøpbare trinn per del, nitti i alt. Hvert tier har sin egen farge og sitt eget
navn, og siste trinn i et tier løfter bilen inn i det neste:

| Tier | | Farge |
| --- | --- | --- |
| 1 | Stål | `#9aa7bd` |
| 2 | Smaragd | `#4ade80` |
| 3 | Safir | `#38bdf8` |
| 4 | Ametyst | `#c084fc` |
| 5 | Magma | `#ff8a2b` |
| 6 | Plasma | `#ff2d95` |

Tre tall henger sammen her, og ingen av dem går an alene:

* **Ytelsen har samme tak som før.** Toppfarten på siste trinn er fortsatt
  1280. Den *må* være det: farten går inn i hopplengden i annen potens, og et
  forsøk med 1650 ga en maksbil som fløy 5000 enheter og seilte over både
  neste rampe og alt som lå mellom. Flere tiere gir altså **finere trinn, ikke
  en raskere bil** — «litt og litt bedre».
* **Prisene ganges med 2,35 for hvert tier** (`TIERFAKTOR`), og med 30 % for
  hvert trinn inne i et tier. Første motortrinn koster $150, første trinn i
  tier 6 koster $10 800.
* **Inntekten må følge etter.** Derfor `teknikkbonus()`: hvert kjøpte trinn
  ganger opp alt man tjener i løypa, opp til ×4,0 med alt bygd. Uten den blir
  de siste tierne en vegg, for ytelsen har jo et tak — en halvferdig bil
  kjører nesten like fort som en ferdig og ville tjent omtrent det samme.

`tester/lope.js` spiller gjennom hele progresjonen med en grådig kjøper og
teller turer. Det er den eneste prøven som faktisk setter de tre tallene opp
mot hverandre, og den sier fra hvis de driver fra hverandre:

```
tier nådd på tur: T1@1 T2@6 T3@11 T4@16 T5@23 T6@39
alt eid etter 69 turer
```

Hvert tier varer lenger enn det forrige. Det er meningen: de første fargene
skal komme raskt nok til at et barn skjønner at det finnes flere, og den siste
skal være noe man sparer til.

### Dekk-tieret er det eneste man ser

Motor og girkasse er tall. Felgen er et bilde, og den er det som gjør et nytt
tier til noe annet enn en dyrere pipe i en meter. Lagene **stables** — et tier
legger til noe, det fjerner aldri noe — så tier 6 er summen av alt, og barnet
kjenner igjen det det allerede hadde:

| Tier | Legger til |
| --- | --- |
| 1 | dekk, felg, eiker, nav |
| 2 | skygge i gummien, slipt felgkant, boltring |
| 3 | bremseskive bak eikene, farget navkapsel |
| 4 | neonring i tierfargen, blinker |
| 5 | ytterligere en ring i motfase, og lys i eikene |
| 6 | full glorie utenfor dekket og gnister rundt felgkanten |

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

En lagring fra den gamle skalaen ganges med `TRINN` ved innlasting
(`versjon`-feltet i `app.js`). Da blir *andelen* av veien man hadde gått den
samme, og siden begge skalaene går fra samme bunn til samme tak, er ytelsen
uendret. Uten det ville en bil med gammelt nivå 6 stått igjen på trinn 6 av 30
og mistet nesten hele motoren sin.

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
| Umodifisert bil, én tur | ~$890 |
| Umodifisert bil, kjørt godt (saltoer landet, turbo brukt) | ~$981 |
| Fullt utbygd bil, én tur | ~$8056 |
| Hele designkatalogen | $5790 |
| Alle oppgraderinger (90 trinn) | $396 980 |
| Turer til alt er eid | ~69 |

Avstanden mellom den første og den siste bilen er ni ganger, og det er
teknikkbonusen som gjør det: prisene i tier 6 er hundre ganger dem i tier 1.
Blir den mye større, er de første turene ikke verdt å kjøre; blir den mindre,
er de siste tierne en vegg. Prøven holder den mellom seks og tolv.

Tallene måles av `tester/lope.js`, som feiler hvis de driver utenfor rammene.
Å eie alt tar rundt sytti turer, og de siste tierne er noe man sparer til over
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

Saltoen er den største enkeltutbetalingen i spillet — $45 mot $35 for en loop
og $4 for en mynt. Det er med vilje: den er det eneste som krever at barnet
gjør noe annet enn å holde gassen. Taket på hva én tur kan gi, måles som
`nakenAlt` i prøven, og skal ikke kunne dobles av salto og turbo alene.

## Filene

| Fil | Svarer for |
| --- | --- |
| `js/bil.js` | Delekatalogen og tegningen av bilen |
| `js/garasje.js` | Rommet bilen står i på garasjeskjermen |
| `js/lope.js` | Løypa: punktlista, myntene, oppslag langs kurven |
| `js/fysikk.js` | Simuleringen: fart, hopp, mynter, penger, oppgraderinger |
| `js/kulisse.js` | Himmel, landskap, asfalt og mål — alt som ikke er bilen |
| `js/kjoring.js` | Kamera, bil, partikler og sløyfa |
| `js/app.js` | De fem skjermene, butikken, lagringen |

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
  det samme: kameraet ser 575 enheter, og de fjerne lagene ble flate plater
  fordi én skjerm dekket en tiendedel av en fjellrygg.
* **Fjellprofilen er `1 - |sin|`, ikke `sin`.** En ren sinus gir runde topper,
  og fire lag med runde topper leser som vann. Absoluttverdien legger en knekk
  på toppen, og det er knekken som gjør en silhuett til et fjell.
* **`clip-path` løses i rommet elementets eget `transform` setter opp.**
  Refleksjonen i garasjegulvet er en speilvendt, skalert gruppe; med klippet
  på den samme gruppa ble klipperuta tolket i speilvendt rom og fjernet hele
  refleksjonen. Klippet må ligge på en ytre gruppe uten transform.

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
