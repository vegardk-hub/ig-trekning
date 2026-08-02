# ig-trekning

Et lite knippe frittstående nettapper, hver i sin egen mappe. Ingen felles
kodebase, ingen pakkebehandler, ingen byggesteg.

| Mappe | App |
| --- | --- |
| `index.html` (rot) | Trekning — trekk en vinner blant Instagram-kommentarer |
| `visualizer/` | Lydspeil — lydvisualisering i Canvas 2D |
| `visualizer/v2/` | Prisme — én visualisering i WebGL |
| `pwa-sudoku/` | Sudoku — PWA med hintmotor som forklarer løseteknikkene |

## Publisering

GitHub Pages bygger fra `main`, med rota som kilde. Det finnes ingen
workflow-fil i repoet — Pages kjører sin egen innebygde
`pages-build-deployment`. Alt som havner på `main`, ligger live et minutt
senere på `https://vegardk-hub.github.io/ig-trekning/` under samme sti som i
repoet:

- Sudoku: `https://vegardk-hub.github.io/ig-trekning/pwa-sudoku/`

Det betyr at en endring ikke er ute før den er på `main`. Ligger arbeidet på
en gren, må grenen slås sammen først.

## Arbeidsflyt

Ingen avhengigheter å installere, ingen tester å kjøre, ingen linter. Skal du
se en app lokalt, hold deg til en statisk server i mappa — `file://` slår av
både service worker og modullasting:

```
python3 -m http.server 8000
```

Sudoku er en PWA. Endrer du filene den forhåndslagrer, bump `CACHE`-navnet i
`pwa-sudoku/sw.js`, ellers ligger den gamle cachen igjen hos alle som allerede
har installert appen.

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

## Sudoku

`pwa-sudoku/README.md` dokumenterer arkitekturen grundig — løseteknikkene,
graderingen, generatoren og hintet i tre trinn. Les den før du endrer
`solver.js` eller `generator.js`; vanskelighetsgradene er satt etter måling,
ikke etter magefølelse, så de tåler ikke å justeres på slump.

Appen er bygd for telefon først: `dvh`-høyder, `viewport-fit=cover`,
`touch-action`, og én enkelt oppskalering på `@media (min-width: 480px) and
(min-height: 760px)`. Test endringer i grensesnittet i en smal viewport.
