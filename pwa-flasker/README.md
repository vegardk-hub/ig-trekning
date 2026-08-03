# Fargeflasker

Et rolig sorteringsspill for de aller minste. Hell fargene fra flaske til
flaske til hver flaske har sin egen farge.

Laget for en femåring, og det styrer alle valgene:

* **Ingen klokke og ingen måte å tape på.** Man kan sitte like lenge man vil.
* **Alt kan angres**, så mange trekk tilbake man orker.
* **Ingen avslag.** Trykker man på en flaske det ikke går an å helle i, rister
  den litt og blir den nye valgte flasken i stedet – da slipper man å trykke
  to ganger.
* **Hjelp-knappen** regner ut et trekk som faktisk fører fram, og blinker på de
  to flaskene. Har man rotet seg inn i en blindvei, sier den fra om det.
* **Nivåene vokser sakte.** Nivå 1 og 2 har to farger og tre lag, og først fra
  nivå 7 blir flaskene fire lag høye. Det er alltid to tomme flasker å
  mellomlagre i.

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
| `js/app.js` | Grensesnittet: trykk, hellingsanimasjon, lyd, lagring |
| `sw.js` | Service worker – nett først, hurtiglager som reserve |
| `lag_ikon.py` | Lager ikonene med Pillow: `python lag_ikon.py` |

## Slik lages nivåene

Fargene stokkes tilfeldig ut i flaskene, og så sjekker løseren at brettet
faktisk går an å løse. Går det ikke, stokkes det på nytt. Alternativet – å
stokke «baklengs» fra et ferdig brett – gir ofte nivåer som nesten løser seg
selv.

Tilfeldigheten er sådd med nivånummeret, så nivå 7 ser likt ut hver gang.
Et barn liker å kjenne igjen brettet det holdt på med i går.

Fremdriften ligger i `localStorage` under nøkkelen `fargeflasker`.
