# Regnbuespillet

Sudoku med symboler i stedet for tall. Målgruppen er en femåring, og det er
ikke en detalj — det er premisset som avgjør alt annet i appen.

Ingen byggesteg, ingen avhengigheter: åpne `index.html`, eller legg mappa på en
webserver og installer den på hjemskjermen. Det er en PWA.

## Symbolene

Ni symboler, i denne rekkefølgen og med disse fargene:

| # | Symbol | Farge | # | Symbol | Farge |
| --- | --- | --- | --- | --- | --- |
| 1 | Hjerte | rød | 6 | Trekant | oransje |
| 2 | Stjerne | gul | 7 | Rektangel | svart |
| 3 | Måne | grå | 8 | Kors | grønn |
| 4 | Fotball | hvit/svart | 9 | Regnbue | regnbue |
| 5 | Firkant | blå | | | |

Rekkefølgen er ikke tilfeldig. Et brett på 4×4 bruker de fire første og 6×6 de
seks første, så de letteste formene ligger først: hjerte og stjerne kjenner et
barn igjen før det skiller en firkant fra et rektangel.

Alle har **både form og farge** å kjennes igjen på. Det er med vilje dobbelt:
former alene er krevende i små ruter, og farge alene stenger ute den som ser
farger annerledes. Alle tegnes med mørk kontur, så de står fram også der fargen
er lys.

## Tre brettstørrelser

| Nivå | Brett | Bokser | Symboler |
| --- | --- | --- | --- |
| Fire ruter | 4×4 | 2×2 | 4 |
| Seks ruter | 6×6 | 2×3 | 6 |
| Ni ruter | 9×9 | 3×3 | 9 |

Valget vises med en liten rutevisning ved siden av navnet — den som ikke leser,
ser likevel med en gang hvor stort brettet er.

## To avgjørelser som bærer resten

Dette er de to reglene appen står og faller på. Ikke rull dem tilbake.

**Et galt symbol går ikke inn.** Ruta rister, og ingenting settes. Lar man feil
bli stående, ender brettet før eller siden i en knute som bare kan løses ved å
se at noe langt tilbake var galt — og det er nøyaktig det målgruppen ikke kan.
Appen avviser trekket, aldri barnet: ingen rødt, ingen teller, ingen poengsum,
ingen klokke.

**Alle brett kan løses med enere alene.** Generatoren graver bare så lenge
brettet både er entydig *og* lar seg løse uten en eneste teknikk utover nakne
og skjulte enere. Et brett som krever låste kandidater eller par, kan ikke løses
av noen som ikke kan lese enda. Barnet skal kunne peke på en rute og si «her må
det være hjerte, for hjertet er brukt opp i de andre».

**Hjelp meg** fyller inn én rute — den enkleste som finnes nå — og lyser kort
opp i grønt. Ingen forklaring: en femåring har ikke bruk for å høre at dette var
en skjult ener.

## Filene

| Fil | Ansvar |
| --- | --- |
| `js/kjerne.js` | Rutenett av vilkårlig boksform, enerløser, generator, entydighet |
| `js/symboler.js` | De ni symbolene, som SVG |
| `js/app.js` | Grensesnittet: brett, tastatur, lagring |
| `styles.css` | Utseende. Ett fast, lyst oppsett — se under |
| `sw.js` | Offline. Nett først, cache som reserve |

**Ingen fargeoppsett å velge mellom**, og det er et valg: symbolene har sine
egne farger, og et mørkt tema ville gjort det svarte rektangelet usynlig og
snudd den grå månen opp ned. Rutene er alltid lyse.

Rutenettet er generelt over boksform, så `lagRutenett(2, 3)` gir 6×6 med bokser
på 2 rader og 3 kolonner. Antall bokser er alltid `N`, og `N / boksB === boksH`
— det er den identiteten `boks()` hviler på.

## Prøver

```
NODE_PATH=/opt/node22/lib/node_modules node tester/kjor.js
```

`kjor.js` starter serveren selv. Prøven måler begge reglene over, at
boksinndelingen er et ekte sudokunett, at et galt symbol ikke blir stående, at
brettet kan spilles helt ut, og at tastene er minst 36 px på fire
skjermstørrelser — fem år gamle fingre bommer mer enn voksne.

Playwright er det eneste som må være installert.

## Hvis du endrer noe

- **Rører du generatoren, kjør prøven.** Et brett som ikke lenger lar seg løse
  med enere, ser helt normalt ut helt til barnet står fast uten vei videre.
- **Endrer du en fil i `FILER`, bump `CACHE` i `sw.js`.** Ellers ligger den
  gamle cachen igjen hos alle som har installert appen.
- **Tastaturet har ulik spaltefordeling stående og liggende** (`--tastkol` og
  `--tastkol-l`). Tastene er kvadratiske, så spalteantallet bestemmer høyden:
  ni taster i tre spalter ble 355 px stående, og da havnet «Hjelp meg» under
  skjermkanten. Liggende er spalta smal, og fem spalter ville gitt 33 px taster.
- **`.app` må trekke fra det trygge området.** `min-height: 100dvh` inne i en
  `body` som polstres med `env(safe-area-inset-*)` stikker nøyaktig de
  innsettingene utenfor, og da lar sida seg dra noen millimeter opp og ned.
