# Sprellemaskinen

Trekker et tilfeldig oppdrag barna kan gjøre inne. Setningen står stort på
skjermen, så en voksen kan lese den høyt — eller barnet kan trykke **Les opp**
og la maskinstemmen gjøre det.

Svart på hvitt, ingen bilder, bare knappene som trengs. PWA — kan legges på
hjemskjermen og virker uten nett.

## Filene

| Fil | Ansvar |
| --- | --- |
| `index.html` | Grensesnittet: setningen, knappene og innstillingene |
| `styles.css` | Utseendet |
| `js/oppdrag.js` | De to oppdragsbankene og utfyllingen av lukene |
| `js/tale.js` | Maskinstemmen (`speechSynthesis`) |
| `js/app.js` | Trekkingen, filtrene, rampemodus og lagringen av valgene |
| `sw.js`, `manifest.webmanifest` | PWA-delen |
| `lag_ikon.py` | Skriver ikonene i `icons/` |

## Alderen

**Appen kjenner ingen navn og skal ikke gjøre det** — den snakker til den som
står foran den, og kan gis videre til neste barn uten et eneste trykk.

Det eneste som skiller barna, er alderen, som settes fra 3 til 12 i
innstillingene og lagres i `localStorage`. Hvert oppdrag har en `alder` — 3, 5
eller 8 — som er laveste alder det passer for. Skillet er ikke lett og
vanskelig, men hva som må kunne gjøres for at beskjeden i det hele tatt gir
mening: telle, holde på to tall samtidig, lese, stave. Fra 8 og opp er alt med.

## Oppdragene

36 vanlige oppdrag, delt i to etter hvor de gjøres:

- **`sted: 'her'`** (22 stk) — gjøres der barnet står. Snøengel, fem skritt
  baklengs, sitte på rumpa og telle til ti.
- **`sted: 'rom'`** (14 stk) — sender barnet til badet, kjøkkenet, loftet og
  tilbake igjen.

Sytten er merket `alder: 3`, tolv `alder: 5` og sju `alder: 8`.

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
- **Setningen starter med verbet.** «Gå til soverommet ditt og hent det mykeste
  du finner», ikke «Live, gå til …» eller «Nå skal du gå til …». Det er en
  beskjed, og handlingen skal komme først — både for den som leser høyt og for
  den som hører maskinstemmen.

Rommene i `ROM` er stedene i et vanlig hus. Har man ikke loft, er det lista man
stryker fra — ikke setningene.

## Rampemodus

Knappen over oppdraget bytter ut hele banken: 23 rampestreker som går ut på å
tulle med de voksne. Den ligger over setningen og ikke nede blant
innstillingene, fordi den skal kunne slås av like fort som den ble slått på.

**Rampemodus lagres med vilje ikke.** Den slås på for en stund, og en app som
åpnes neste morgen skal starte i det vanlige — ellers begynner dagen med en sur
sokk uten at noen har bedt om det.

Tre regler holder banken på riktig side av morsom. Skriver du nye, skriv dem
etter disse:

1. **Alt skal kunne gjøres om igjen på ti sekunder.** En sko som gjemmes, skal
   finnes igjen — derfor står «husk hvor du la den» i selve setningen.
2. **Ingenting som virkelig trengs.** Ikke nøkler, briller, telefon eller
   medisiner. En rampestrek som gjør en voksen sen til jobb, er ikke en
   rampestrek.
3. **Ingenting som gjør vondt, ødelegger noe eller skremmer på ordentlig.**

«Mamma» og «pappa» står i tekstene fordi barnet skal kjenne igjen hvem det
gjelder. Passer det ikke i huset, er det disse ordene som byttes ut.

## Trekkingen

Oppdragene trekkes fra en **kurv**: hele lista stokkes, og det trekkes uten
tilbakelegging til kurven er tom. Ren `Math.random()` gir samme oppdrag to
ganger på rad ofte nok til at et barn merker det, og da er maskinen «ødelagt».
Når kurven fylles på nytt, byttes førstemann bort hvis det er samme oppdrag som
avsluttet forrige kurv.

Bytter man filter, alder eller modus, kastes kurven — den er stokket ut fra det
gamle utvalget, og ville ellers fortsatt sende barnet på badet en stund etter at
«bare her jeg står» ble krysset av, eller delt ut vanlige oppdrag i
rampemodus.

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

## PWA

`sw.js` er nett først med cache som reserve, og henter med `{ cache: 'no-store' }`
under installering — uten det baker Pages' `max-age=600` ti minutter gammel kode
inn i en fersk cache. **Endrer du en fil som står i `FILES`, bump `CACHE`-navnet**,
ellers blir den gamle versjonen liggende hos alle som har appen på hjemskjermen.

Ikonene er en strekfigur i et sprett, skrevet av `lag_ikon.py` uten Pillow:

```
python3 pwa-sprell/lag_ikon.py
```
