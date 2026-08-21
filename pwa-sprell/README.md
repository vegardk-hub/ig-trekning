# Sprellemaskinen

Trekker et tilfeldig oppdrag barna kan gjøre inne. Setningen står stort på
skjermen, så en voksen kan lese den høyt — eller barnet kan trykke **Les opp**
og la maskinstemmen gjøre det.

Første versjon: svart på hvitt, ingen bilder, bare knappene som trengs.

## Filene

| Fil | Ansvar |
| --- | --- |
| `index.html` | Grensesnittet: setningen, to knapper, to avkryssinger |
| `styles.css` | Utseendet |
| `js/oppdrag.js` | Oppdragsbanken og utfyllingen av lukene |
| `js/tale.js` | Maskinstemmen (`speechSynthesis`) |
| `js/app.js` | Trekkingen, filteret og lagringen av valgene |

## Oppdragene

Tretti oppdrag, delt i to etter hvor de gjøres:

- **`sted: 'her'`** (18 stk) — gjøres der barnet står. Snøengel, fem skritt
  baklengs, sitte på rumpa og telle til ti.
- **`sted: 'rom'`** (12 stk) — sender barnet til badet, kjøkkenet, loftet og
  tilbake igjen.

Avkryssingen **«Bare oppdrag der jeg står»** skrur av den siste gruppa. Den er
til leggetid og til besøk hos andre — ikke en innstilling som skal glemmes bort,
så den huskes i `localStorage`.

### Lukene

Setningene kan ha `{rom}`, `{tall}`, `{dyr}` og `{farge}`. Det er dette som gjør
at tretti oppdrag ikke blir tretti setninger: «Gå som en kenguru helt til
badet» kommer tilbake som «Gå som en krabbe helt til loftet» og føles nytt.
Listene ligger øverst i `js/oppdrag.js`.

To ting å vite før du skriver nye oppdrag:

- **Tall skrives med bokstaver**, ikke siffer. Setningen skal leses opp, og en
  stemme som får «5» kan finne på å si det på engelsk.
- **`{dyr}` må være hankjønnsord.** Setningene sier «som en …», så «som en
  egern» blir feil. `{farge}` må stå i intetkjønn: «noe som er rødt».

Rommene i `ROM` er stedene i et vanlig hus. Har man ikke loft, er det lista man
stryker fra — ikke setningene.

## Trekkingen

Oppdragene trekkes fra en **kurv**: hele lista stokkes, og det trekkes uten
tilbakelegging til kurven er tom. Ren `Math.random()` gir samme oppdrag to
ganger på rad ofte nok til at et barn merker det, og da er maskinen «ødelagt».
Når kurven fylles på nytt, byttes førstemann bort hvis det er samme oppdrag som
avsluttet forrige kurv.

Bytter man filter, kastes kurven — den er stokket ut fra det gamle utvalget, og
ville ellers fortsatt sende barnet på badet en stund etter at «bare her jeg
står» ble krysset av.

## Stemmen

`js/tale.js` velger første norske stemme systemet melder om. To feller ligger
der allerede:

- `getVoices()` er tom til systemet har lastet lista. Uten lytteren på
  `voiceschanged` ville knappen sett død ut første gang siden åpnes, også på en
  telefon som har norsk stemme.
- `cancel()` fyrer `onend` på det som spilles. Uten flagget ville den gamle
  setningens `onend` meldt «ferdig» for den nye.

Finnes ingen stemme, står det under knappene i stedet for at knappen bare ikke
gjør noe. Automatisk opplesing skjer alltid rett etter et trykk, som er det
iOS krever for å slippe lyd ut i det hele tatt.

## Ikke gjort ennå

Ingen service worker og ingen manifest — appen er ikke en PWA i denne versjonen.
Legges det til, må ikonene lages, og `CACHE`-navnet i `sw.js` må bumpes hver
gang oppdragsbanken endres.
