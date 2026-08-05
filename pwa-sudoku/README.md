# Sudoku

En sudoku-app i samme ånd som Jason Linharts *Sudoku* (5.2.7): rene brett,
automatiske blyantmerker og — viktigst — en hintmotor som ikke bare sier hvilket
tall som skal inn, men **forklarer hvilken løseteknikk som gjelder og hvorfor**.

Appen er en PWA. Ingen byggesteg, ingen avhengigheter: åpne `index.html`, eller
legg mappa på en webserver og installer den på hjemskjermen.

## Stående og liggende

Stående ligger tastaturet under brettet, med tittelen over.

Legger du telefonen ned, deler layouten seg: brettet tar hele høyden, og
talltastene står på **hver sin side**, så alt kan nås uten å flytte tomlene.
Tittelen og telleren flytter opp i hjørnene — sto de i midten, ville de kostet
nettopp den høyden brettet skal ha. Appnavnet får hele venstre spalte og
skalerer med bredden på den, i stedet for å stå i en fast, liten størrelse.
Nivået og telleren står til høyre, over de store tallene, på to linjer:
«Vanskelig · 45 igjen» på én måtte settes for smått til å leses i en så smal
spalte. De to toppene har samme faste høyde, ellers ville tastaturene under dem
stått i hver sin høyde.

◐-knappen står i flyten ved siden av appnavnet liggende, ikke absolutt plassert
i hjørnet. Absolutt plassering måtte gjette hvor spalta begynner, og gjettet
bommer: er brettet høydebegrenset, står hele raden midtstilt med luft på sidene.

Verktøyknappene finnes bare til **høyre** liggende. Ett sett er nok, og plassen
under venstre talltast går til **hint og meldinger** i stedet. Før lå de midt
over brettet, og skjulte da gjerne nettopp rutene et hint pekte på — som er hele
poenget med å vise dem. Er hintet høyere enn feltet, skroller teksten; knappene
står fast i bunnen, så **Bruk** aldri havner utenfor.

Liggende er sida **frosset**: ingen skroll, ingen sprett. Brettet fyller høyden,
så et drag har ingenting å avdekke — det ville bare skjøvet nederste rad ut av
syne. Stående får fortsatt skrolle, for der kan en forklaringsmelding gjøre
innholdet høyere enn skjermen, og da må den kunne nås.

Brettet trekker fra det trygge området i begge retninger. `100dvh` teller hele
skjermen, også stripa hjemindikatoren ligger i, og et brett regnet uten den blir
høyere enn plassen det faktisk får.

Loddrett brukes den **største** av innsettingene på begge sider. Hjemindikatoren
gir en stripe nederst og som regel ingenting øverst, så et brett som bare tar
hensyn til hver side for seg havner tett i toppen og fritt i bunnen. Brettet blir
et hakk mindre av å balansere det, men står midt i skjermen.

### Skriftstørrelser

Appen skal kunne leses på en armlengdes avstand av noen som ikke har unge øyne.
Etikettene under verktøysymbolene, tellerne på tallknappene, hintteksten,
meldingene og teksten i dialogene er derfor satt opp et hakk fra der de lå — de
hadde krympet et par ganger for å gi plass til noe annet, og var blitt vanskelige
å lese.

Grensa for hvor stort det kan bli, er **etikettene**: åtte verktøyknapper på rad
gir smale kolonner, og «Nytt spill» og «Gjør om» er de lengste ordene. `.vtekst`
er derfor det eneste tallet som ikke er fast — fra nettbrettbredde og opp følger
den brettbredden. Testene måler `scrollWidth` mot knappebredden på ni skjermer og
sier fra når et ord sprekker.

Tallknappene er delt etter side:

| Side | Trykket gir |
| --- | --- |
| Høyre | tallet, stort i ruta |
| Venstre | et blyantmerke |

Derfor finnes ingen **Blyant**-knapp liggende — siden du trykker på *er*
bryteren. Venstre tast er skiltet med det den lager: blyantmerkets farge og
størrelse. **Fyll** husker hvilken side tallet ble valgt fra, så et armet tall
fra venstre blir merker og fra høyre blir tall.

Verktøyene er like på begge sider og styrer samme tilstand: slår du på **Fyll**
til høyre, lyser knappen til venstre også. Derfor bygges knappene fra
`VERKTOY`-lista i `app.js` og ikke fra markupen — to sett i HTML ville betydd
doble id-er — og trykk fanges med delegering på spilleflata. Hvilken side en
knapp står på leser koden av DOM-en, ikke av en kopi av mediaspørringen: CSS
eier avgjørelsen om når tastaturet er delt.

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
| Fargeoppsett | ◐ oppe til høyre (stående) / ved appnavnet (liggende) | – |
| Lukk hint/dialog | ✕, eller trykk utenfor | `Esc` |

Trykker du et tall som allerede står i ruta, viskes det ut.

## Hvor tallet ellers finnes

Trykker du på en rute med et tall i, lyser brettet opp begge stedene tallet er
i spill: rutene der det **står**, og rutene der det er **ført som blyantmerke**.
I de siste blir selve merket uthevet, så du ser hvilken av kandidatene det
gjelder, ikke bare hvilken rute.

Begge slag får **samme flate**. To styrker var forsøkt først, og gjorde bare den
svakeste av dem vanskelig å se — det er tallet som skal være lett å finne.
Hvilket av slagene en rute er, leser du av innholdet: stort tall eller uthevet
merke. Ruta du står i er ett hakk sterkere enn resten. I fyllmodus gjelder det
samme for tallet du har armet.

Hver tallknapp bærer et lite tall oppe i hjørnet: hvor mange av det sifferet som
ennå ikke står på brettet. Er alle ni satt, forsvinner telleren og knappen
tones ned.

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

**Auto**-knappen går i ring gjennom tre trinn, ikke av og på:

| Trinn | Knappen | Merkene |
| --- | --- | --- |
| 1 | ◈ Auto | regnes ut og oppdateres av seg selv |
| 2 | ◇ Manuell | de beregnede er kopiert over — nå er de dine å redigere |
| 3 | ○ Tomt | fjernet, du fører dem fra bunnen |

Knappen viser trinnet du står i, ikke det neste, og symbolene går fra fylt til
tomt, så rekkefølgen er til å lese uten å ha trykket seg gjennom den.

Trinn 2 finnes fordi de to ytterpunktene sjelden er det man vil ha: å begynne
helt på bar bakke er mye arbeid, og å ha alt regnet ut hindrer deg i å føre dine
egne. Med **Manuell** starter du fra det maskinen kom fram til, og retter på det.

Kandidater du stryker via et hint, blir borte for godt. Hvert trinnbytte er ett
steg i angreloggen, så **Angre** går baklengs gjennom ringen — var trykket et
uhell, er merkene tilbake med det samme.

Starter du et nytt spill mens du står på **Manuell**, flyttes trinnet til
**Tomt**: brettet er nytt og merkene er borte, og da ville «Manuell» sagt noe
som ikke stemte.

Setter du et tall inn i en rute, stryker appen det samme tallet fra blyantmerkene
i hele raden, kolonnen og boksen — de tjue rutene som tallet ville kollidert med.
Står det først der, er merkene motbevist, og da er de bare i veien. Det samme
skjer når et hint setter inn tallet for deg, og **Angre** tar med seg
strykningene tilbake.

Endrer du et tall du allerede hadde satt, nullstilles strykningene fra hint — de
var utledet fra et brett som ikke gjelder lenger.

## Fargeoppsett

◐-knappen gir fire oppsett, pluss **Følg systemet** som veksler
mellom Papir og Natt etter lys/mørk-innstillingen på enheten. Valget huskes.

Oppsettet slår inn i det du trykker på det, så det er ingenting å bekrefte — en
**✕** i hjørnet er hele veien ut. Liggende står lista i to spalter: fem oppsett
under hverandre ga et kort på 460 px, halvannen skjermhøyde, og da lå ✕ over
kanten. Nå er kortet 298 px og får plass på den laveste telefonen.

Panelet nullstiller skrollen når det åpnes, og det må skje *etter*
`hidden = false`: et skjult element har ingen boks å skrolle, så tilordningen
ville ellers vært en nulloperasjon — og stillingen henger igjen mellom åpninger.

| Oppsett | Til hva |
| --- | --- |
| Papir | Varmt og dempet — standarden |
| Dag | Maks kontrast, for sterkt dagslys |
| Kveld | Mørkt og varmt, uten det blå |
| Natt | Mørkt og kjølig |

### Tre roller, tre farger

Hvert oppsett holder tre ting fra hverandre, og gir dem hver sin farge i stedet
for hver sin valør av det samme:

| | Gitte tall | Dine egne | Blyantmerker |
| --- | --- | --- | --- |
| Papir | nøytral blekk | blå | brent oransje |
| Dag | svart | mørk blå | mørk oransjebrun |
| Kveld | varm hvit | gull | grønn |
| Natt | kjølig hvit | blå | rav |

Blå og oransje ligger rett overfor hverandre på fargesirkelen, og i Papir, Dag
og Natt er avstanden mellom skrift og blyant 176–177°. Kveld er unntaket: gullets
komplement *er* blått, og blått er akkurat det oppsettet skal være fritt for, så
der går det så langt som mulig uten å slippe blåtonen inn igjen — 79°.

### Markeringsflata

Flata må være sterk nok til å se, og svak nok til at tallene som står oppå den
fortsatt er lesbare. Det er de to kravene som setter styrken, og begge er målt:

| Oppsett | Flata mot brettet | Valgt mot flata | Gitte | Skrevne | Blyant |
| --- | --- | --- | --- | --- | --- |
| Papir | 1,41:1 | 1,41:1 | 10,0 | 5,3 | 4,7 |
| Dag | 1,43:1 | 1,29:1 | 14,7 | 5,5 | 4,8 |
| Kveld | 1,52:1 | 1,53:1 | 8,7 | 5,1 | 4,5 |
| Natt | 1,59:1 | 1,53:1 | 8,1 | 5,2 | 4,2 |

De tre siste kolonnene er tallenes kontrast **mot flata**, ikke mot brettet.
Papir måtte ha mørkere blyantfarge og mørkere blå for å tåle en flate på 1,41:1
— uten det falt de skrevne tallene under 4,5:1 så snart flata ble sterk nok til
å se.

Flatene er nøytrale med vilje. Var de blå, ville blå tall stått på blå flate; i
Kveld er de holdt på 17 % metning, ellers ville gullet i skriften stått på en
gullfarget flate.

Brettet markerer ikke raden, kolonnen og boksen rundt ruta du står i. Det gjorde
det før, men tre tonede felt som legger seg i kryss over brettet er mye flate i
bevegelse for lite igjen — ruta du har valgt ser du uansett, og hvilken rad den
står i er ikke noe du trenger hjelp til å se.

### Kontrast

Målt mot flaten tallene står på:

| Oppsett | Gitte tall | Skrevne tall | Blyantmerker |
| --- | --- | --- | --- |
| Papir | 14,1:1 | 6,2:1 | 5,2:1 |
| Dag | 21,0:1 | 7,9:1 | **6,9:1** |
| Kveld | 13,3:1 | 7,8:1 | 6,8:1 |
| Natt | 12,9:1 | 6,7:1 | 6,6:1 |

Blyantmerkene var lenge det svake punktet: den gamle blågrå lå på 3,1:1 i Papir,
under WCAG-grensa på 4,5:1 for småtekst — behagelig innendørs, borte i sol. Alle
oppsettene ligger nå over grensa. **Dag** går lengst, og setter i tillegg
rutenettet i svart i stedet for blågrått og bytter de myke skyggene mot én skarp
strek: diffuse skygger forsvinner uansett i sterkt lys og etterlater bare
uskarpe kanter.

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
