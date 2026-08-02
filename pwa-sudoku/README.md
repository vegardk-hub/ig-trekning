# Sudoku

En sudoku-app i samme ånd som Jason Linharts *Sudoku* (5.2.7): rene brett,
automatiske blyantmerker og — viktigst — en hintmotor som ikke bare sier hvilket
tall som skal inn, men **forklarer hvilken løseteknikk som gjelder og hvorfor**.

Appen er en PWA. Ingen byggesteg, ingen avhengigheter: åpne `index.html`, eller
legg mappa på en webserver og installer den på hjemskjermen.

## Slik spiller du

| Handling | Mus/berøring | Tastatur |
| --- | --- | --- |
| Velg rute | trykk på ruta | piltaster |
| Skriv tall | trykk 1–9 | `1`–`9` |
| Visk ut | **Slett** | `Backspace`, `Delete` eller `0` |
| Fyllmodus | **Fyll** | – |
| Blyantmodus | **Blyant** | `P` |
| Angre | **Angre** | `Ctrl`/`Cmd` + `Z` |
| Gjør om | **Gjør om** | `Ctrl`/`Cmd` + `Shift` + `Z`, eller `Ctrl` + `Y` |
| Hint | **Hint** | `H` |
| Lukk hint/dialog | ✕ | `Esc` |

Trykker du et tall som allerede står i ruta, viskes det ut.

## To måter å skrive på

Vanligvis går det rute først: velg ruta, trykk tallet. Skal det samme tallet inn
flere steder, er det en omvei — du må innom ruta og tallet annenhver gang.

**Fyll** snur på det. Du velger tallet én gang, og så er hvert trykk på brettet
en innsetting: fire ruter, fire trykk. Tallknappen du har valgt lyser opp, og
brettet markerer hvor tallet allerede står, så du ser med én gang hvilke rader,
kolonner og bokser som er tatt. Trykker du tallknappen om igjen, legger du den
fra deg.

Ruter som er gitt i oppgaven, står naturligvis i fred — de blir bare markert, så
du kan bruke trykket til å se på naboene. Treffer du en rute der tallet allerede
står, viskes det ut, akkurat som ellers. Hvert trykk er sitt eget steg i
angreloggen.

Fyll og **Blyant** virker sammen: med Auto slått av setter du samme kandidat i
mange ruter på rad, som er den kjedeligste delen av å føre merker for hånd.

Med tastatur velger `1`–`9` tallet, og `Enter` eller mellomrom setter det inn i
ruta du står i — piltastene flytter deg videre. Bryr du deg ikke om fyllmodus,
merker du ingenting: med **Fyll** avslått er alt nøyaktig som før.

Angreloggen er ubegrenset og dekker tall, blyantmerker, strykninger fra hint og
**Auto**-vekslingen. Den ligger i minnet — den lagres ikke sammen med brettet, og
tømmes når du starter et nytt spill.

## Hint i tre trinn

Hintet avslører like mye som du ber om, slik at du kan bli stående og tenke selv:

1. **Navnet på teknikken** og en kort setning om hva den sier.
2. **Vis hvor** — brettet markerer cellene teknikken bygger på (gult), enheten
   den gjelder i (svak gul), og cellene som rammes (rødt, med kandidatene
   overstrøket). Du får hele resonnementet i klartekst.
3. **Bruk** — tallet settes inn, eller kandidatene strykes.

Finner ikke løseren noe trekk, sier den fra om hvorfor: enten står det et tall på
brettet som ikke stemmer med løsningen (og hvilken rute det gjelder), eller så er
brettet ferdig.

## Blyantmerker

**Auto** er på som standard: kandidatene regnes ut og oppdateres av seg selv når
du fyller inn tall. Kandidater du stryker via et hint, blir borte for godt.

Slår du av **Auto**, tømmes brettet for merker, og du fører dem selv med
**Blyant** + tall. Var det et feiltrykk, henter **Angre** dem tilbake. Slår du
**Auto** på igjen, regnes kandidatene ut på nytt, og det du hadde ført selv,
viker for dem.

Endrer du et tall du allerede hadde satt, nullstilles strykningene fra hint — de
var utledet fra et brett som ikke gjelder lenger.

## Vanskelighetsgrader

Nivået er ikke antall ledetråder, men **den vanskeligste teknikken som faktisk
trengs** for å komme i mål med ren logikk:

| Nivå | Krever opp til |
| --- | --- |
| Lett | Nakne og skjulte enere |
| Middels | Låste kandidater (peker og krav) |
| Vanskelig | Nakne og skjulte par |
| Ekspert | Tripler, kvadrupler, X-Wing, XY-Wing, sverdfisk |

Grensene er satt etter måling, ikke etter hvor avanserte teknikkene høres ut:
tripler, kvadrupler og X-Wing blir sjelden *nødvendige* – noe enklere holder
nesten alltid – mens XY-Wing er den vanlige toppteknikken. Derfor deler de siste
seks nivåene ett bånd.

## Under panseret

| Fil | Ansvar |
| --- | --- |
| `js/core.js` | Rutenett, enheter, kandidater, brute force-løser med propagering |
| `js/solver.js` | De tolv løseteknikkene, forklaringene og graderingen |
| `js/generator.js` | Lager entydige brett på ønsket nivå |
| `js/app.js` | Grensesnitt, tastatur, angrelogg, lagring |
| `lag_ikon.py` | Lager appikonene (krever Pillow) |

### Løseteknikkene

Prøves i stigende rekkefølge, så hintet alltid er det enkleste som finnes:

1. Naken ener · 2. Skjult ener · 3. Låst kandidat (peker og krav) ·
4. Nakent par · 5. Skjult par · 6. Nakent trippel · 7. Skjult trippel ·
8. Nakent kvadruppel · 9. X-Wing · 10. XY-Wing · 11. Sverdfisk

### Generatoren

Et komplett rutenett fylles, og celler graves ut så lenge brettet har nøyaktig
én løsning. Et dypt utgravd brett havner som regel enten svært lett eller helt
utenfor rekkevidden til de menneskelige teknikkene. Derfor legges ledetråder
tilbake én om gangen — og alltid den som gjør brettet *minst* lettere, ellers
hopper man rett forbi det båndet man siktet på. Første punktet der brettet blir
logisk løsbart, er nettopp det vanskeligste.

Brettene er symmetriske (180°) på alle nivåer unntatt Ekspert, som trenger
asymmetrisk graving for å bli hardt nok.

### Offline

`sw.js` bruker **nett først, cache som reserve**. Cache først ville servert
gammel kode i det uendelige etter en oppdatering, siden filnavnene aldri endrer
seg. Bumper du `CACHE`-navnet, ryddes gamle cacher bort ved aktivering.

## Ikoner

```
python lag_ikon.py
```

Skriver `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` og
`apple-touch-icon.png`.
