# Fargeflasker

Et sorteringsspill for de aller minste. Flaskene står rundt en stor glassfigur
— **en ny for hvert nivå**: vulkan, rakett, hus, bil, kanin, bjørn. Får du en
flaske ensfarget, begynner den å lyse, og da kan du trykke på den og så på
figuren, så flyr den bort, tømmer seg nedi og står igjen **tom**. Er figuren
full, går den i utbrudd, og nivået er løst.

**Tappingen skjer ikke av seg selv.** Den gjorde det først, og da var
belønningen noe som bare hendte. Nå er det barnet som utfører den: full
flaske lyser og vipper, vulkanen lyser når den kan ta imot, og først når hun
trykker, renner det. Bare en full, ensfarget flaske slipper nedi — en halvfull
ville tatt fargen ut av spill og gjort nivået uløselig.

Laget for en femåring, og det styrer alle valgene:

* **Ingen klokke og ingen måte å tape på.** Man kan sitte like lenge man vil.
* **Alt kan angres**, så mange trekk tilbake man orker.
* **Ingen avslag.** Trykker man på en flaske det ikke går an å helle i, rister
  den litt og blir den nye valgte flasken i stedet – da slipper man å trykke
  to ganger.
* **Hjelp-knappen** regner ut et trekk som faktisk fører fram, og blinker på de
  to flaskene. Har man rotet seg inn i en blindvei, sier den fra om det.

## Vulkanen er regelen, ikke pynten

At en ferdig flaske tømmes og kan brukes om igjen, er det som bærer hele
vanskegraden. Uten den måtte hvert nivå ha en tom flaske per farge man vil
kunne mellomlagre. Med den holder det med **én** tom flaske fra nivå 13 og
oppover: brettet ser umulig trangt ut, men løsner så snart den første fargen
er i havn, og blir lettere for hver farge som forsvinner.

Derfor er den harde skruen den siste tomme flasken, ikke antall farger. Under
én tom flaske finnes det ingen lovlige trekk i det hele tatt — alle flasker er
fulle, og ingenting kan helles noe sted.

## En farge fyller flere flasker

Dette er det som avgjør hvor stort et brett kan bli. Med én flaske per farge
er brettets størrelse låst til fargeantallet: fem farger gir fem fulle
flasker, og det er for lite til at et barn som har knekt spillet, orker det.

Derfor er `farger` og `fylte` uavhengige. Nivå 1 har **fem farger fordelt på
åtte flasker**, så tre av fargene skal samles fra to flasker hver. Da holder
det ikke å rydde — man må velge hvilken flaske hver farge skal ende i, og en
farge som er spredd på tre flasker må samles før noen av dem kan tappes.

Vulkanen har ett lag per **flaske** som skal tappes, ikke per farge: en farge
som fyller to flasker, tappes to ganger.

## Nivåene

| Nivå | Farger | Fylte flasker | Lag per flaske | Tomme | Flasker i alt |
| --- | --- | --- | --- | --- | --- |
| 1–2 | 5 | 8 | 4 | 2 | 10 |
| 3–4 | 6 | 9 | 4 | 2 | 11 |
| 5–6 | 6 | 10 | 4 | 2 | 12 |
| 7–9 | 7 | 10 | 4 | 2 | 12 |
| 10–12 | 7 | 11 | 4 | 2 | 13 |
| 13–15 | 8 | 11 | 4 | 2 | 13 |
| 16–18 | 8 | 11 | 4 | **1** | 12 |
| 19–22 | 9 | 12 | 4 | 1 | 13 |
| 23–26 | 9 | 12 | **5** | 1 | 13 |
| 27–31 | 10 | 12 | 5 | 1 | 13 |
| 32+ | 10 | 13 | 5 | 1 | 14 |

Målt over nivå 1–40: alle løsbare, generering på 0,5 ms i snitt og 4 ms på det
verste. Løsningen vokser fra **25 trekk på nivå 1** til rundt 97 på nivå 40.

`fylte` må alltid være minst `farger`, ellers blir en farge til overs. Fire
flasker per sidestabel er taket — en femte gjør stablene høyere enn skjermen —
så fra fjorten flasker og opp må bunnraden vokse i stedet.

## Kjøre spillet

Dobbeltklikk `index.html`, eller start en liten webtjener i mappen:

```
python -m http.server 8322 --directory pwa-flasker
```

Åpnes det over `http://`, registreres en service worker og spillet virker
offline. Fra `file://` virker alt bortsett fra offline-hurtiglageret.

## Installere på nettbrett eller telefon

Legg mappen på en webtjener (eller GitHub Pages), åpne adressen i Chrome eller
Safari og velg «Legg til på startskjermen». Da starter spillet i fullskjerm
med eget ikon.

## Filene

| Fil | Hva den gjør |
| --- | --- |
| `index.html` | Selve siden – bare struktur, ingen logikk |
| `styles.css` | Utseende. Flaskene er et SVG-omriss med væske som vanlige divs oppå |
| `js/spill.js` | Reglene, nivågeneratoren og løseren. Rene funksjoner, ingen DOM |
| `js/figurer.js` | Figurene som skal fylles – én per nivå, på rundgang |
| `js/app.js` | Grensesnittet: trykk, animasjoner, vulkanen, lyd, lagring |
| `sw.js` | Service worker – nett først, hurtiglager som reserve |
| `lag_ikon.py` | Lager ikonene med Pillow: `python lag_ikon.py` |
| `lag_enkeltfil.py` | Bygger `flaskespill.html` i rota – hele spillet i én fil |

## Slik lages nivåene

Fargene stokkes tilfeldig ut i flaskene, og så sjekker løseren at brettet
faktisk går an å løse. Går det ikke, stokkes det på nytt. Alternativet – å
stokke «baklengs» fra et ferdig brett – gir ofte nivåer som nesten løser seg
selv.

Brettet er løst nøyaktig når **alle flaskene står tomme** — hver ferdig farge
har da forlatt brettet og blitt et lag i vulkanen. Generatoren forkaster
utdelinger der en flaske alt er ensfarget; den ville stått og lyst før barnet
fikk tatt i den, og sett ut som en feil.

### Løseren tapper automatisk, barnet gjør det ikke

`loes()` kaller `tapp()` etter hver helling, altså tømmer ferdige flasker med
en gang. Det er riktig for å avgjøre om et brett *går an*: å tappe er aldri
skadelig, og barnet kan alltid gjøre det, så en løsning som finnes med
automatisk tapping, finnes også med manuell.

Men da stemmer ikke løserens brett med skjermens når en full flaske står
utappet. Derfor sammenlignes planen mot `tappetNokkel()` — brettet slik det
*ville* sett ut om alt ferdig var tømt. Uten det ville planen blitt forkastet
hver gang en flaske ble full, og vi er tilbake til hintet som går i ring.

Hjelp-knappen har en egen snarvei: står det en full flaske og venter, peker
den på den og på vulkanen. Det er alltid rett trekk — det er tappingen som
frigjør plassen alt annet henger på.

Tilfeldigheten er sådd med nivånummeret, så nivå 7 ser likt ut hver gang.
Et barn liker å kjenne igjen brettet det holdt på med i går.

## Om tegningen

Flaskene er et SVG-omriss med væsken som vanlige divs oppå, så formen skalerer
fritt mens væsken er rektangler vi kan animere høyden på.

### Plasseringen

Flaskene står i en stabel på hver side av vulkanen, og de som ikke får plass
der, står i en rad over den. Alt er bunnstilt mot samme gulvlinje, og hele
arenaen ligger nederst i brettet — vulkanen skal stå nede, ikke sveve.

Vulkanens viewBox er `320 x 215`, altså bred og lav. Den var høy og smal før,
og da måtte den enten rage over flaskene eller krympe til en strek.

`beregnMaal()` prøver **alle** oppstillingene — hvor mange flasker som står i
stablene på hver side, og hvor mange per rad over figuren — og beholder den
som gir de bredeste flaskene. Står to like brede, vinner den med størst figur.
Flaskebredden er tatt av på 72 px: over det blir midtsøyla, og dermed figuren,
for smal til å bære feiringen.

Det er dette søket som gjør at spillet virker både stående og liggende uten et
eget oppsett for hver. Stående er høyden rikelig og bredden knapp, så søket
lander på høye sidestabler; liggende er det motsatt, og da vinner få i
stablene og mange per rad:

| Skjerm | Nivå | Oppstilling | Flaskebredde |
| --- | --- | --- | --- |
| 375 × 812 (stående) | 1 | 3 + 3 + 4 | 72 px |
| 375 × 812 (stående) | 40 | 4 + 4 + 6 | 64 px |
| 812 × 375 (liggende) | 1 | 2 + 2 + 6 | 60 px |
| 812 × 375 (liggende) | 40 | 1 + 1 + 12 | 38 px |

En fast fordeling – tre per side – ga 20 px brede flasker på en liggende
telefon. Det var uspillelig.

Liggende flytter i tillegg verktøyknappene ut i en søyle til høyre, så brettet
får hele høyden under topplinja, og tipsteksten legger seg over den tomme
plassen øverst i stedet for å spise av den. Brettet gikk fra ~210 til ~300 px
høyde av det alene.

### Figurene

`js/figurer.js` har én oppføring per figur, og nivå *n* bruker nummer
`(n-1) % antall`. Skal du legge til en, trenger du bare fire ting:

```js
{
  navn: 'kaninen', kort: 'Kanin', tegn: '🐰',
  b: 320, h: 250,              // viewBox
  omriss: '...',               // silhuetten
  fyll: [4, 234],              // [toppY, bunnY] for væsken
  apning: [160, 52]            // der flaskene helles nedi
}
```

**Omrisset kan bestå av flere delstier.** En kanin er kropp + hode + to ører
lagt oppå hverandre i samme `d`, og fyllregelen slår dem sammen. Det er langt
enklere enn å føre pennen rundt hele silhuetten i én strek, og det er derfor
`ell()`-hjelperen finnes: den skriver en ellipse som sti.

Samme omriss brukes tre steder — bakgrunnsfyll, `clipPath` for væsken, og
konturen oppå. Da kan de ikke komme i utakt med hverandre.

`apning` sitter ulikt på hver figur: pipa på huset er langt til venstre, mens
vulkanens krater er midt på. Både flaskens flybane og sprutet regnes derfor ut
fra figuren, ikke fra en fast prosent. Det er også grunnen til at
`beregnMaal()` setter bredde og høyde i **figurens** forhold og ikke i et fast
et — treffer ikke boksen viewBoxen nøyaktig, lander strålen ved siden av
åpningen.

Detaljer som øyne, vinduer og hjulnav tegnes *oppå* væsken. Ellers mister
kaninen blikket i det den fylles.

### Utbruddet

Tre ting skjer når figuren er full: den skjelver og åpningen gløder, fargene
spruter opp av åpningen, og **figuren tømmer seg** mens det står på.

De to siste hører sammen og skal ikke skilles: sprutet er det synlige beviset
på hvor innholdet tar veien. Uten det ser tømmingen ut som at belønningen blir
tatt bort igjen. `settVulkanstand()` senker standen fra toppen, slik det ville
sett ut om noe rant ut av åpningen.

Det rant også seks lavastrømmer nedover utsiden en periode. De ble tatt bort —
det ble for mye på én gang ved siden av konfettien på seierskortet.

Vulkanen er ett SVG med en `clipPath` som holder væsken innenfor glasset.
Lagene er `<rect>`-er som animeres med `requestAnimationFrame` og ikke med en
CSS-overgang: høyden på et SVG-rektangel er ikke animerbar med `transition` i
alle nettlesere, og vulkanen som stiger er hele belønningen — den kan ikke få
lov til å bare hoppe.

`beregnMaal()` setter både bredde og høyde på vulkanen eksplisitt, i samme
forhold som viewBoxen. Det er ikke pynt: med bare `max-width` ville nettleseren
midtstilt tegningen inni en for bred boks, og da treffer ikke `kraterPunkt()`
krateret — strålen fra flasken hadde landet ved siden av.

Fremdriften ligger i `localStorage` under nøkkelen `fargeflasker`.
