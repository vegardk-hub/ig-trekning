# Prøver

Atten prøver, i to slag.

**Seksten kjører appen i en ekte nettleser** og måler den. De finnes fordi det
meste av det som har gått galt i denne appen ikke var logikk, men geometri og
farge: en etikett som sprakk i en smal kolonne, et tall som falt under
kontrastgrensa på flata det sto på, en knapp som lå bak et annet element og
derfor ikke lot seg trykke. Slikt ser man ikke i koden.

**To regner bare** — `teknikker` og `nivaaer`. De trenger verken nettleser eller
server, og går først i settet: er løseren gal eller nivåene tomme, sier resten
ingenting. `maaling.js` er ikke en prøve, men verktøyet båndene måles med.

## Kjøring

```
NODE_PATH=/opt/node22/lib/node_modules node pwa-sudoku/tester/kjor.js
```

`kjor.js` starter serveren selv og rydder etter seg. Hele settet tar knappe
minuttet. Én eller flere enkeltprøver:

```
node pwa-sudoku/tester/kjor.js tema liggende
```

Playwright er det eneste som må være installert; `NODE_PATH` peker på det.
Serveren i `kjor.js` er skrevet for hånd nettopp for å slippe en pakke til —
repoet skal fortsatt kunne åpnes uten å installere noe.

## Hva hver prøve svarer for

| Prøve | Spørsmålet den svarer på |
| --- | --- |
| `teknikker` | Stryker noen løseteknikk et tall som faktisk hørte hjemme der? Måles mot fasiten, steg for steg. |
| `nivaaer` | Treffer generatoren båndet den blir bedt om — på alle sju nivåene? |
| `fyllmodus` | Setter fire trykk inn fire like tall? Angrer den ett om gangen? Får etikettene på verktøyknappene plass på ni skjermer? |
| `auto` | Går knappen riktig runde: fyller → manuell → tomt? |
| `boks` | Rydder et innsatt tall bort blyantmerkene med samme tall i boksen? |
| `naboer` | Og i raden og kolonnen? |
| `alle` | Gjelder ryddingen hele nabolaget, ikke bare det nærmeste? |
| `konflikt` | Blir to like tall i samme rad, kolonne eller boks merket røde? |
| `tid` | Stopper klokka når fana legges bort, overlever den en omlasting, og telles et løst brett bare én gang? |
| `uthev` | Lyser både store tall og blyantmerker med samme siffer? |
| `tastatur` | Fører venstre side blyant og høyre side tall når telefonen ligger? |
| `liggende` | Står brettet i full høyde, sidene like brede, toppteksten i spalta, og lar ◐ seg trykke — på fem skjermstørrelser? |
| `hintplass` | Dekker hintet aldri brettet, og lukker ✕ det i begge formater? |
| `frys` | Er sida låst når det ikke er noe å skrolle til, og slipper den opp når et hint står framme? |
| `modal` | Får dialogene plass, og lukker de seg på ✕, på knappen og på trykk utenfor? |
| `tema` | Holder alle fire oppsettene kontrastkravene, er de tre rollene ulike farger, og skiller valgt rute seg fra markeringsflata? |
| `servicearbeider` | Installerer den seg, svarer den offline, og henter den nett først? |
| `versjonsmerke` | Oppdaterer merket seg i samme besøk som en ny service worker tar over? |

## Ting som er verdt å vite før du endrer dem

- **`env()` lar seg ikke emulere.** Det trygge området går derfor via
  `--trygg-topp`/`--trygg-bunn` i CSS, som prøvene setter selv. Fjerner du de
  variablene, mister `frys` evnen til å måle det den er til for.
- **`display: none` gir et nullrektangel.** En «får det plass»-måling består
  derfor selv når elementet er usynlig. Mål bredden i tillegg — `liggende` gjør
  det, etter at en slik prøve en gang sto grønn mens appnavnet var borte.
- **`versjonsmerke` skriver i `sw.js`.** Den bumper cachenavnet midt i besøket
  for å etterligne en utrulling, og kjører derfor mot en kopi `kjor.js` lager i
  et midlertidig område. Kjør den aldri direkte mot mappa i repoet.
- **Farger måles, ikke vurderes.** `tema` regner WCAG-kontrast og
  nyanseavstander. Skal en farge endres, kjør prøven først og se hva den sier —
  tallene i `../README.md` er hentet derfra.
- **Vanskelighetsgradene måles også.** Legger du til en løseteknikk, flytter du
  fordelingen for alle nivåene over den. Kjør `node tester/maaling.js 1500`, les
  hvor brettene faktisk havner, og sett båndene deretter — så `nivaaer`. Et bånd
  som er gått tomt, gir ingen feilmelding i appen: generatoren bruker opp
  forsøkene sine og leverer forrige nivå under nytt navn.
- **`nivaaer` speiler båndene med vilje.** Den leser dem ikke fra
  `generator.js` — en prøve som henter fasiten sin fra koden den prøver, godtar
  enhver endring i den. Endrer du OMRAADER, må du endre begge steder.
