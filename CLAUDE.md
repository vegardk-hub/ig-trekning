# ig-trekning

Et lite knippe frittstående nettapper, hver i sin egen mappe. Ingen felles
kodebase, ingen pakkebehandler, ingen byggesteg.

| Mappe | App |
| --- | --- |
| `index.html` (rot) | Trekning — trekk en vinner blant Instagram-kommentarer |
| `visualizer/` | Lydspeil — lydvisualisering i Canvas 2D |
| `visualizer/v2/` | Prisme — én visualisering i WebGL |
| `pwa-sudoku/` | Sudoku — PWA med hintmotor som forklarer løseteknikkene |
| `pwa-flasker/` | Fargeflasker — sorteringsspill for de minste, PWA |
| `flaskespill.html` (rot) | Fargeflasker som én fil, bygget fra `pwa-flasker/` |

## Publisering

GitHub Pages bygger fra `main`, med rota som kilde. Det finnes ingen
workflow-fil i repoet — Pages kjører sin egen innebygde
`pages-build-deployment`. Alt som havner på `main`, ligger live et minutt
senere på `https://vegardk-hub.github.io/ig-trekning/` under samme sti som i
repoet:

- Sudoku: `https://vegardk-hub.github.io/ig-trekning/pwa-sudoku/`
- Fargeflasker: `https://vegardk-hub.github.io/ig-trekning/pwa-flasker/`

Det betyr at en endring ikke er ute før den er på `main`. Ligger arbeidet på
en gren, må grenen slås sammen først.

Eieren av repoet vil ha ferdig arbeid **rett på `main`**, ikke liggende på en
gren i påvente av en gjennomgang: en gren som ikke er slått sammen, er en
endring han ikke kan prøve på telefonen. Vanlig runde er derfor commit på
arbeidsgrenen, så `git checkout main && git merge --ff-only <gren> && git push
origin main`. Ingen pull request med mindre det blir bedt om.

**Henger utrullingen, sjekk `githubstatus.com` før du feilsøker repoet.**
`curl -s https://www.githubstatus.com/api/v2/summary.json` viser komponentene
`Actions` og `Pages` direkte. Et bygg som blir stående i `queued` eller
`building` i mer enn et par minutter, er nesten alltid en hendelse hos GitHub —
et normalt Pages-bygg tar rundt ett minutt. Symptomet er forvirrende, for
`git push` går fint hele tiden: Git Operations er en annen komponent enn Pages.
6. august 2026 kostet det en runde med å avbryte kjøringer og be om nye bygg før
statussida ble sjekket, og da sto det «Pages – Deployment Lag» der hele tiden.

Feiler et Pages-bygg med `"duration": 0` og den generiske meldinga
`"Page build failed."` — se `GET /repos/{eier}/{repo}/pages/builds/latest` — er
det heller ikke innholdet. Et ekte Jekyll-problem gir en melding som peker på en
fil.

Utrullingen lar seg ikke sjekke med et oppslag mot `github.io` herfra — proxyen
svarer 403 på CONNECT. Se på byggekjøringene i stedet: workflow-id `323690282`
(`pages-build-deployment`) gjennom GitHub-verktøyene. Svaret er stort nok til å
sprenge konteksten, så skriv det til fil og hent ut feltene med python. Bygget
tar rundt et minutt, og `head_sha` i svaret kan henge etter ett commit — se på
tidspunktet, ikke bare sha-en.

## Arbeidsflyt

Ingen avhengigheter å installere, ingen linter. Skal du se en app lokalt, hold
deg til en statisk server i mappa — `file://` slår av både service worker og
modullasting:

```
python3 -m http.server 8000
```

Sudoku har prøver, som eneste app her. Kjør dem etter endringer i
`pwa-sudoku/`:

```
NODE_PATH=/opt/node22/lib/node_modules node pwa-sudoku/tester/kjor.js
```

De tar knappe minuttet, starter serveren selv og trenger bare playwright.
`pwa-sudoku/tester/README.md` sier hva hver av dem svarer for.

Kjøres de på Windows i stedet for i skyøkta, feiler `fyllmodus` og `tema` på ett
mål hver, med tre piksler. Det er ikke en regresjon: `system-ui` løser til Segoe
UI med 21 px linjeboks der, mot 17 px på Linux, som tallene er kalibrert mot.
Ikke «rett» dem lokalt — da ryker de på telefonen. Node ligger på
`C:\Program Files\nodejs`, utenfor PATH, og `NODE_PATH` skal peke på
`C:\Users\vegar\AppData\Roaming\npm\node_modules`.

Sudoku og Fargeflasker er PWA-er. Endrer du filene de forhåndslagrer, bump
`CACHE`-navnet i `sw.js`, ellers ligger den gamle cachen igjen hos alle som
allerede har installert appen.

## Konvensjoner

Følg stilen i fila du er i — den er gjennomført og bevisst:

- **Ingen avhengigheter.** Alt er vanilla JS, CSS og HTML. Ikke innfør et
  bibliotek, en bundler eller et byggesteg uten at det er bedt om.
- **Norsk.** Grensesnittstekst, kommentarer og domenebegreper er på norsk
  (`verdier`, `blyant`, `nivaa`, `rad`/`kolonne`/`boks`). Rene
  strukturnavn kan være engelske (`state`, `cells`, `PEERS`).
- **Moduler som IIFE-er** på `window` (`window.SudokuCore`,
  `SudokuSolver`, `SudokuGenerator`), ikke ES-moduler. Hver fil åpner med
  `'use strict';` og en kommentar som sier hva fila svarer for.
- **Kommentarer forklarer hvorfor**, ikke hva. Se `sw.js`, som begrunner
  nett-først-strategien.

## Fallgruver som har kostet tid før

Ikke rull noen av disse tilbake uten å vite hvorfor de står der:

- `fetch()` i en service worker går gjennom HTTP-cachen, og Pages sender
  `max-age=600`. Uten `{ cache: 'no-store' }` bakes ti minutter gammel kode inn
  i en fersk cache og blir liggende der.
- `matchMedia()` gir et nytt objekt hver gang. Lytteren må festes på et objekt
  du holder på, ellers reagerer «Følg systemet» aldri.
- `[hidden] { display: none }` er en nettleserstil. En egen `display:` i CSS slår
  den, og elementet blir stående synlig selv om koden har skjult det. Bruk
  `:not([hidden])`.
- `env()` lar seg ikke emulere i en test. Det trygge området går derfor via
  `--trygg-topp`/`--trygg-bunn`, som prøvene kan sette.
- `scrollTop = 0` gjør ingenting på et skjult element — sett `hidden = false`
  først.
- `display: none` gir et nullrektangel, så en «får det plass»-måling består selv
  når elementet er usynlig. Mål bredden i tillegg.
- **En lytter på `pagehide` som lagrer alt, opphever `localStorage.clear()`.**
  Prøvene tømmer lagringen og laster om for å få et ferskt brett; `pagehide`
  fyrer på omlastingen og skriver det gamle brettet rett tilbake, så appen
  starter med det forrige i stedet. Lagre bare feltet du er ute etter, og bare
  hvis posten finnes fra før — se `lagreTid()` i `app.js`.

## Sudoku

`pwa-sudoku/README.md` dokumenterer arkitekturen grundig — løseteknikkene,
graderingen, generatoren og hintet i tre trinn. Les den før du endrer
`solver.js` eller `generator.js`; vanskelighetsgradene er satt etter måling,
ikke etter magefølelse, så de tåler ikke å justeres på slump.

De sju nivåene hviler på en svært skjev fordeling: noen teknikker er den
vanskeligste som trengs i 40 % av brettene, andre i under 0,1 %. Legger du til
en teknikk, flytter du fordelingen for alle nivåene over den. Kjør
`node pwa-sudoku/tester/maaling.js 1500`, sett båndene etter tallene, og la
`nivaaer` bekrefte at generatoren treffer dem. Et tomt bånd gir ingen
feilmelding — generatoren leverer stille forrige nivå under nytt navn.

Appen er bygd for telefon først: `dvh`-høyder, `viewport-fit=cover`,
`touch-action`, og én enkelt oppskalering på `@media (min-width: 480px) and
(min-height: 760px)`. Test endringer i grensesnittet i en smal viewport.

Utseendet er målt, ikke vurdert: kontrasten på hver farge mot flata den står på,
nyanseavstanden mellom rollene, bredden på hver etikett i den smaleste kolonnen.
Tallene står i `pwa-sudoku/README.md`, og kravene som prøver i `tester/tema.js`
og `tester/liggende.js`. Endrer du en farge eller en skriftstørrelse, kjør dem
og les hva de sier før du velger.

## Fargeflasker

Målgruppen er en femåring, og det er ikke en detalj — det er premisset. Ingen
tidtaking, ingen måte å tape på, ubegrenset angring, og et hint som regner ut
et trekk som faktisk fører fram i stedet for å si «prøv igjen». `pwa-flasker/README.md`
går gjennom resten.

`flaskespill.html` i rota er **generert**, ikke skrevet. Retter du noe i
`pwa-flasker/`, kjør `python pwa-flasker/lag_enkeltfil.py` så enkeltfila følger
med — ellers driver de fra hverandre uten at noe klager.

Nivåene lages ved å stokke fargene tilfeldig og la løseren bekrefte at brettet
går an. Tilfeldigheten er sådd med nivånummeret, så nivå 7 må se likt ut hver
gang; endrer du `nivaaOppsett` eller generatoren, bytter alle brettene innhold
for et barn som kjenner dem igjen.
