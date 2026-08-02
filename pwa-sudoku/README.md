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
| Fargeoppsett | ◐ oppe til høyre | – |
| Lukk hint/dialog | ✕, eller trykk utenfor | `Esc` |

Trykker du et tall som allerede står i ruta, viskes det ut.

## Når to tall ikke kan stå sammen

Skriver du et tall som allerede står i samme rad, kolonne eller boks, blir det
stående rødt. Det er et rent regelbrudd som vises — ikke en sammenlikning mot
løsningen — så markeringen røper ingenting du ikke kunne sett selv ved å følge
raden. Retter du, forsvinner den.

Bare tall du har skrevet blir røde. De gitte kan du likevel ikke endre, og et
rødt tall skal alltid være noe du kan gjøre noe med.

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

Setter du et tall inn i en rute, stryker appen det samme tallet fra blyantmerkene
i hele raden, kolonnen og boksen — de tjue rutene som tallet ville kollidert med.
Står det først der, er merkene motbevist, og da er de bare i veien. Det samme
skjer når et hint setter inn tallet for deg, og **Angre** tar med seg
strykningene tilbake.

Endrer du et tall du allerede hadde satt, nullstilles strykningene fra hint — de
var utledet fra et brett som ikke gjelder lenger.

## Fargeoppsett

◐-knappen oppe til høyre gir fire oppsett, pluss **Følg systemet** som veksler
mellom Papir og Natt etter hva telefonen står på. Valget huskes.

| Oppsett | Til hva |
| --- | --- |
| Papir | Varmt og dempet — standarden |
| Sollys | Maks kontrast, for sterkt dagslys |
| Natt | Mørkt og kjølig |
| Kveld | Mørkt og varmt, uten det blå |

**Sollys** finnes fordi blyantmerkene er det første som forsvinner ute. Målt mot
flaten de står på:

| Oppsett | Gitte tall | Skrevne tall | Blyantmerker |
| --- | --- | --- | --- |
| Papir | 14,1:1 | 5,2:1 | **3,1:1** |
| Sollys | 21,0:1 | 7,9:1 | **11,7:1** |
| Natt | 12,5:1 | 6,8:1 | 4,2:1 |
| Kveld | 12,7:1 | 7,8:1 | 4,4:1 |

3,1:1 er under WCAG-grensa på 4,5:1 for småtekst — behagelig innendørs, borte i
sol. Sollys tar merkene til 11,7:1, setter rutenettet i svart i stedet for
blågrått, og bytter de myke skyggene mot én skarp strek: diffuse skygger
forsvinner uansett i sterkt lys og etterlater bare uskarpe kanter.

Palettene ligger i `styles.css`, én blokk per oppsett. `js/tema.js` lastes fra
`<head>` og setter `data-tema` på `<html>` før første maling — gjøres det fra
`app.js`, som lastes nederst, rekker standardfargene å blinke til. Den slår også
«Følg systemet» opp mot `prefers-color-scheme`, slik at hver palett står
nøyaktig ett sted og ingen mediaspørring skal holdes i takt.

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
| `js/tema.js` | Fargeoppsettene — settes før første maling |
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

Nederst på skjermen står cachenavnet — `v8`, `v9` — som et lite, dust merke.
Det svarer på «kjører telefonen den koden jeg nettopp la ut?», som ellers er
overraskende vanskelig å avgjøre. Tallet leses fra cachen enheten faktisk har,
ikke fra en konstant i `app.js`, så det kan ikke påstå noe annet enn sannheten.
Det forutsetter til gjengjeld at `CACHE` bumpes ved hver endring.

Nett først må bety nettet, ikke nettleserens HTTP-cache. GitHub Pages sender
`Cache-Control: max-age=600`, og et vanlig `fetch()` inne i en service worker
går gjennom den cachen — så i ti minutter etter en utrulling kunne appen servere
forrige versjon, og forhåndslagringen kunne bake den gamle koden inn i en fersk
cache, der den så ble liggende. Både oppslagene og forhåndslagringen bruker
derfor `cache: 'no-store'`, og registreringen `updateViaCache: 'none'`, slik at
heller ikke `sw.js` selv kan bli hengende igjen i HTTP-cachen.

## Ikoner

```
python lag_ikon.py
```

Skriver `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` og
`apple-touch-icon.png`.
