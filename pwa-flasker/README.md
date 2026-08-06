# Fargeflasker

Et sorteringsspill for de aller minste. Flaskene står rundt en stor
glassvulkan. Får du en flaske ensfarget, flyr den bort og renner ned i
vulkanen — og står igjen **tom**. Er vulkanen full, går den i utbrudd, og
nivået er løst.

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

## Nivåene

| Nivå | Farger | Lag per flaske | Tomme flasker |
| --- | --- | --- | --- |
| 1–2 | 3 | 3 | 2 |
| 3–4 | 4 | 3 | 2 |
| 5–6 | 4 | 4 | 2 |
| 7–9 | 5 | 4 | 2 |
| 10–12 | 6 | 4 | 2 |
| 13–16 | 6 | 4 | **1** |
| 17–20 | 7 | 4 | 1 |
| 21–25 | 8 | 4 | 1 |
| 26–31 | 9 | 4 | 1 |
| 32–38 | 10 | 4 | 1 |
| 39+ | 10 | **5** | 1 |

Målt over nivå 1–50: alle løsbare, generering på 1,3 ms i snitt og 12 ms på
det verste. Løsningen vokser fra 5 trekk på nivå 1 til rundt 80 på nivå 40.

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
| `js/app.js` | Grensesnittet: trykk, animasjoner, vulkanen, lyd, lagring |
| `sw.js` | Service worker – nett først, hurtiglager som reserve |
| `lag_ikon.py` | Lager ikonene med Pillow: `python lag_ikon.py` |
| `lag_enkeltfil.py` | Bygger `flaskespill.html` i rota – hele spillet i én fil |

## Slik lages nivåene

Fargene stokkes tilfeldig ut i flaskene, og så sjekker løseren at brettet
faktisk går an å løse. Går det ikke, stokkes det på nytt. Alternativet – å
stokke «baklengs» fra et ferdig brett – gir ofte nivåer som nesten løser seg
selv.

Tappingen er ikke et trekk, men en følge av et trekk: både i `loes()` og i
grensesnittet kalles `tapp()` rett etter hver helling. Derfor er brettet løst
nøyaktig når **alle flaskene står tomme** — hver ferdig farge har da forlatt
brettet. Generatoren forkaster også utdelinger der en flaske alt er ensfarget;
den ville rent ned i vulkanen før barnet fikk tatt i den, og se ut som en feil.

Tilfeldigheten er sådd med nivånummeret, så nivå 7 ser likt ut hver gang.
Et barn liker å kjenne igjen brettet det holdt på med i går.

## Om tegningen

Flaskene er et SVG-omriss med væsken som vanlige divs oppå, så formen skalerer
fritt mens væsken er rektangler vi kan animere høyden på.

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
