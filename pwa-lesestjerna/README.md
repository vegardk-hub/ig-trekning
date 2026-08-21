# Lesestjerna

Leseapp for en åtteåring som har knekt lesekoden. **Barnet leser, appen lytter.**
Ordene lyser grønt etter hvert som han sier dem riktig, hver ferdig setning gir
en stjerne, og hver ferdig tekst gir mynter han kan bruke på huset sitt.

Det er verdt å slå fast hva dette *ikke* er, for det er den nærliggende
misforståelsen: det er ikke en app som leser teksten *for* barnet.
Tyngdepunktet ligger i `SpeechRecognition`, ikke `speechSynthesis`. Stemmen —
Microsoft Finn — er bare hjelperen som viser hvordan et ord skal låte når han
står fast.

## Rammene som er låst

| | |
|---|---|
| Målgruppe | Én gutt på 8 år. **Leser hele setninger**, ikke lydering |
| Plattform | **Windows + Edge.** Valgt bevisst for å få stemmen Finn Online |
| Tekst | Forhåndsgenerert bank i JSON, og innliming av egen tekst |
| Husregler | Ingen klokke, ingen måte å tape på, hjelp koster aldri noe |

Edge er ikke en tilfeldighet som kan endres. Finn finnes bare der, og både
lyttingen og stemmen krever nett.

## Slik henger det sammen

Sløyfa er **hus → verden → lesing → ferdig → hus**, og den er orkestrert bare i
`js/app.js`. Ingen annen fil vet hva som kommer før eller etter.

| Fil | Ansvar |
|---|---|
| `js/tekst.js` | Norsk setningsdeling, opprensking av ord, tallverdi |
| `js/stemme.js` | Finn og mikrofonen — de to Web Speech-delene, samlet |
| `js/lesing.js` | Leseskjermen og matchingen. Hjertet i appen |
| `js/lagring.js` | `localStorage`, tre spillere, sikkerhetskopi, papirkurv |
| `js/spill.js` | Økonomien: mynter, ord, bøker, level. Ingen skjerm |
| `js/bank.js` | Leser `data/tekster.json` og svarer hva han skal lese nå |
| `js/spillere.js` | «Hvem leser?» |
| `js/verden.js` | Emnevelgeren |
| `js/hus.js` | Rommet, figuren, levelbobla, boka på bordet |
| `js/app.js` | Skallet: hvilken skjerm som vises når |
| `sjekk_tekster.py` | Validerer tekstbanken. **Kjør den etter hver endring** |
| `prove-lytting.html` | Måleverktøyet som avgjorde om konseptet bar |

`Lesing.start({tekst, vanskeligeOrd}, {ferdig})` gir
`{ord, hoppetOver, setninger, ordTotalt, fullfoert}`. Lesemotoren vet ikke hvor
teksten kom fra, og økonomien vet ikke hvordan noe ser ut. Den samme motoren
brukes derfor både av banken og av innlimt tekst.

**Ingen service worker.** Appen trenger nett uansett, både til Finn og til
lyttingen, så et offline-hurtiglager ville bare vært til bry.

## Kjør den lokalt

Talegjenkjenning krever sikker kontekst. `file://` virker ikke.

```
python -m http.server 8340 --directory pwa-lesestjerna
```

og åpne <http://localhost:8340/> **i Edge**.

## Målt i Edge, ikke gjettet

`prove-lytting.html` ble kjørt med gutten før noe ble bygget. Loggen viste fire
ting som all koden hviler på:

- **Mellomvarianter kommer**, omtrent to i sekundet. Ordene kan derfor lyse mens
  han leser, ikke først når setningen er slutt.
- **Gjenkjenneren sender tomme endelige resultater** når den runder av. Slippes
  de gjennom, nulles framgangen på slutten av hver eneste setning. Siles bort i
  `stemme.js`.
- **`confidence` er verdiløs.** 0,50 på alt underveis, 1,00 på alt endelig — også
  på de tomme. Faste verdier, ikke målinger. Kan aldri brukes som signal.
- **Endelige resultater har stor forbokstav og punktum**, mellomvariantene ikke.
  Matchingen må være blind for begge.

Senere ble hele appen prøvd med gutten: ordene lyser raskt nok, og ingen ord ble
grå. Talegjenkjenning er trent på voksne, og et barn som leser sakte var den
store usikkerheten. Den holdt ikke.

## Fellene — les denne delen før du rører matchingen

Hver av disse er en feil som allerede er gjort, funnet og rettet. De ser ut som
detaljer og er det ikke.

**`basis` må være første ord i setningen, ikke siste trufne ord.** Dette er
forskjellen på en app som virker og en som ikke gjør det. Med en peker som bare
går framover, blir et feilhørt ord liggende bak for godt, og han kan lese
setningen aldri så riktig uten at hullet fylles. Når hver gjennomlesing i stedet
begynner på nytt fra setningens første ord, fanges ordet opp neste gang han sier
det. `basis` flyttes bare når hele setningen er ferdig.

**Hoppebudsjettet må ikke brukes opp av ord han alt har lest riktig.**
Matchingen tåler at inntil to ord bommer, ellers låser ett feilhørt ord resten
av setningen. Men å gå forbi et *grønt* ord koster ingenting — bare grå ord
teller. Uten dette kan han ikke si igjen et enkeltord som ligger mer enn to ord
inn i setningen.

**Vanskelige ord må heller ikke koste hopp.** `vanskeligeOrd` er merket nettopp
fordi gjenkjenneren ikke kan treffe dem. Lar man dem tape hopp, straffes han for
noe maskinen ikke klarer. Vilkåret er
`if (!ord[j].truffet && !ord[j].vanskelig && ++bom > 2) return;`

**Tall sammenliknes som verdi, ikke som ord.** Gjenkjenneren gir `2469` der
teksten sier «to tusen fire hundre og sekstini» — seks ord på rad som aldri kan
matche ord for ord. `Tekst.tallverdi()` regner ut hva teksten *mener*,
`merkTall()` i `lesing.js` binder ordrekka til én gruppe `{fra, til, verdi}`, og
hører matchingen `2469`, lyser alle seks. Da spiller det ingen rolle om det står
«sju» eller «syv» i teksten. Feil tall lyser ikke.

**Ord som hoppes over skal ikke lyse som lest.** Sier han «revet» der det står
«reven», er det direkte skadelig å gi ham grønt. De overhoppede ordene lyser
først når setningen er ferdig, og de teller ikke som lest.

**Stjerna venter på et endelig resultat**, selv om ordene lyser med én gang. En
mellomvariant kan trekkes tilbake, og en stjerne som forsvinner igjen er verre
enn en som kommer et halvsekund senere.

**Det må finnes en vei ut.** «Hopp over ordet» finnes fordi gjenkjenneren av og
til rett og slett ikke vil høre et ord. Uten den kan han bli stående fast, og
det bryter husregelen om at det ikke skal gå an å tape.

**«Finnish» inneholder «Finn».** Et navnesøk på `/finn/i` plukker en finsk
stemme. Sjekk språket først (`/^n[bno]/i` på `v.lang`), let etter navnet bare
blant de norske. Rekkefølgen som virker: Finn → annen norsk nettstemme → første
norske → ingen, og si fra.

**Mikrofonen må døves mens Finn leser.** Ellers hører gjenkjenneren på Finn og
tror gutten leste ordene. `Stemme.si()` gjør dette, med 250 ms luft etterpå så
halen ikke fanges.

## Tekstbanken

`data/tekster.json` har bruksanvisningen innebygd i feltet `_lesmeg`. Legg til
et objekt i lista, og **kjør `python sjekk_tekster.py`**. Antall ord lagres
ikke — det regnes ut ved innlasting, så det finnes ingenting å holde i takt for
hånd.

To regler er verdt å kjenne:

**Tekstene skal ha ett konkret tall eller én sammenlikning hver.** De første tjue
tekstene la kunnskapsnivået for lavt, og eieren ba om høyere: ikke «det høyeste
fjellet i Norge», men «to tusen fire hundre og sekstini meter over havet». Det er
dette som gjør teksten verdt å lese, ikke bare å øve på.

**Skriv tall med bokstaver, aldri siffer, og legg hvert ord i tallet i
`vanskeligeOrd` — også «og» inni det.** Ett umerket tallord gjør at setningen
aldri kan bli ferdig, og stjerna kommer aldri. `sjekk_tekster.py` avviser slike
tekster; regelen finnes fordi feilen ble gjort åtte ganger i første forsøk. «av» i
«sju av ti» skal *ikke* merkes — bare «og» forsvinner inni et norsk tall.

`Bank.neste(emne)` gir letteste uleste, og når alt er lest kommer tekstene om
igjen i stedet for `null`: det skal ikke gå an å tømme et emne og stå fast. En
tekst med feil legges bort og meldes i `Bank.feil()`; appen stopper ikke.

## Økonomien

1 mynt per ord, +10 for fullført tekst. **Hver tekst betaler én gang** — ellers
er den korteste teksten lest førti ganger den beste måten å tjene penger på.
Bok nr. *N* ved `100·N·(N+2)` ord, level = bøker + 1.

Aldri trekk mynter, aldri senk level, ingen rekke som kan brytes. En brutt rekke
er en måte å tape på. Ukesstripa i boka teller derfor *dager han har lest*, ikke
dager på rad.

Belønningen i seg selv er ikke motivasjonen. Eierens ord: myntene er «noe han
bryr seg om når han kan kjøpe noe for det og putte inn i rommene sine». Huset er
grunnen til at han leser, og butikken er derfor ikke pynt på slutten.

## Det som gjenstår

1. **Butikken og møbelplasseringen.** `Spill.kjop/selg/flytt` finnes alt og
   lagrer `{ting, pris, x, y}` i `eide`; det som mangler er en butikkskjerm og
   tegningen av møblene i rommet. Grafikk: **Kenney-pakkene (CC0)**. RPG Makers
   grafikk er lisensiert kun til bruk inne i RPG Maker og kan ikke brukes.
2. **Navn og figurvalg ved første oppstart.** `js/spillere.js` bruker fortsatt
   `prompt()` og `confirm()`. De må byttes ut med skikkelige felt i sida.
3. Scenen er **klikkbar, ikke gåbar**. Det er et bevisst valg, ikke en mangel.
