# Sprellemaskinen

Trekker et tilfeldig oppdrag barna kan gjøre inne. Setningen står stort på
skjermen, så en voksen kan lese den høyt — eller barnet kan trykke **Les opp**
og la maskinstemmen gjøre det.

Farger, lyd og raketter, laget for en femåring som ikke leser ennå. PWA — kan
legges på hjemskjermen og virker uten nett.

## Filene

| Fil | Ansvar |
| --- | --- |
| `index.html` | Grensesnittet: setningen, knappene og innstillingene |
| `styles.css` | Utseendet |
| `js/oppdrag.js` | De to oppdragsbankene og utfyllingen av lukene |
| `js/tale.js` | Maskinstemmen (`speechSynthesis`) |
| `js/lyd.js` | Lydene, satt sammen av oscillatorer i farta |
| `js/fyrverkeri.js` | Rakettene som går opp når et oppdrag er gjort |
| `js/app.js` | Trekkingen, filtrene, rampemodus og lagringen av valgene |
| `sw.js`, `manifest.webmanifest` | PWA-delen |
| `lag_ikon.py` | Skriver ikonene i `icons/` |

## Runden

Barnet trykker **Nytt oppdrag**, gjør det som står der, og trykker **Ferdig!**
Da går rakettene opp, det spilles en liten fanfare, og en stjerne legger seg i
rada under knappene.

Tre ting i den runden er valgt, ikke tilfeldige:

- **Ingenting markerer noe som ikke er gjort.** Stjernene teller bare oppover,
  det finnes ingen «mislyktes»-knapp, og telleren nullstilles av seg selv når
  datoen skifter. Samme premiss som i Fargeflasker og Poengtavla.
- **Ikonet står over setningen.** Det er ikke pynt: den som ikke kan lese ennå,
  ser at oppdraget handler om en sokk eller en frosk før noen har lest det høyt.
- **Kortet skifter farge for hvert oppdrag.** Det er den billigste måten å få et
  nytt oppdrag til å se nytt ut for den som ikke leser.

## Alderen

**Appen kjenner ingen navn og skal ikke gjøre det** — den snakker til den som
står foran den, og kan gis videre til neste barn uten et eneste trykk.

Det eneste som skiller barna, er alderen, som settes fra 3 til 12 i
innstillingene og lagres i `localStorage`. Hvert oppdrag har en `alder` — 3, 5
eller 8 — som er laveste alder det passer for. Skillet er ikke lett og
vanskelig, men hva som må kunne gjøres for at beskjeden i det hele tatt gir
mening: telle, holde på to tall samtidig, lese, stave. Fra 8 og opp er alt med.

## Oppdragene

Fire banker. **Stedet** velges i innstillingene — inne, i hagen, eller begge
deler i samme kurv — og de to modusene av hver sin knapp over oppdraget.
Modusene er gjensidig utelukkende og overstyrer stedet: står en av dem på, er
det den banken maskinen bruker, og bakgrunnen skifter med den.

**Inne** (36 stk): 22 med `sted: 'her'` — snøengel, fem skritt baklengs, sitte
på rumpa og telle til ti — og 14 med `sted: 'rom'`, som sender barnet til badet,
kjøkkenet, loftet og tilbake. Sytten er merket `alder: 3`, tolv `alder: 5` og
sju `alder: 8`.

**Hagen** (50 stk): 22 med `sted: 'her'` og 28 som sender barnet rundt i hagen.
Oppdragene bruker det som faktisk finnes ute — stein, pinner, blader, skygger,
lyder — og **ingenting forutsetter en bestemt hage**: «det nærmeste treet»
finnes også der det bare står ett. Ingenting krever verktøy, klatring eller
vann. Atten er merket `alder: 3`, tjuetre `alder: 5` og ni `alder: 8`.

Avkryssingen «bare oppdrag der jeg står» virker begge steder: ute betyr `'her'`
det som kan gjøres på flekken barnet står på.

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

## Morgenen før barnehagen

Knappen **🎒 Barnehage** bytter til morgenlista: femten steg fra «Stå opp av
senga» til «Si ha det til alle hjemme».

**Denne banken trekkes ikke — den går i rekkefølge.** Sko før jakke gir ingen
mening, og et barn som får stegene i tilfeldig orden, blir mer usikkert enn det
var. Det er den eneste banken uten `sted` og uten luker.

- **«Ferdig!» gir en stjerne og går videre.** Kvitteringen er to korte toner,
  ikke fanfaren: den kommer femten ganger på en morgen. **Rakettene spares til
  hele lista er gjennom** — ellers er feiringen brukt opp før man er ute døra.
- **«Hopp over» går videre uten stjerne.** Ingenting markerer et hoppet steg som
  mislykket; lista går bare videre. Er man i mål, blir knappen til «Begynn på
  nytt».
- **Alderen kortner lista.** Tre steg krever litt mer (gre håret, pakke
  matboksen, vurdere været) og er merket `alder: 5`. En treåring får tolv steg.
- **«Bare oppdrag der jeg står» gjelder ikke her.** En morgen går tvers gjennom
  huset uansett.

Modusen lagres ikke, av samme grunn som rampemodus: appen skal ikke stå i
morgenrutinen klokka fire på ettermiddagen.

## Rampemodus

Knappen over oppdraget bytter ut hele banken: 23 rampestreker som går ut på å
tulle med de voksne. Den overstyrer stedsvalget — rampestrekene hører hjemme
inne, uansett hva som står i innstillingene. Den ligger over setningen og ikke nede blant
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

Bytter man sted, filter, alder eller modus, kastes kurven — den er stokket ut fra det
gamle utvalget, og ville ellers fortsatt sende barnet på badet en stund etter at
«bare her jeg står» ble krysset av, eller delt ut vanlige oppdrag i
rampemodus.

## Lyd og raketter

Lydene er satt sammen av oscillatorer og hvit støy når de spilles — ingen
lydfiler, ingenting å laste ned, ingen nye avhengigheter:

- **Trekket:** to blipp oppover, som en maskin som spytter ut en lapp.
- **Ferdig:** en fanfare, et sus mens raketten stiger, og et smell med knitring
  når den sprekker. Suset og smellet er den samme hvite støyen — forskjellen
  ligger i filteret, som klatrer oppover i suset og faller som en stein i
  smellet.
- **Rampemodus:** en sniklyd som går nedover når den slås på, og oppover når
  den slås av. Lyden sier hvilken vei det gikk, også for den som ikke rekker å
  lese knappen.

**Smellet kalles fra fyrverkeriet, ikke fra en timer i `app.js`.** Raketten
sprekker når den slutter å stige, og det tidspunktet avhenger av skjermhøyden —
en fast forsinkelse ville sklidd fra bildet på en annen telefon. `fyr()` tar
derfor imot en funksjon som kjøres i det gnistene kommer.

To ting som må stå som de står:

- **`AudioContext` må lages inne i et trykk.** iOS starter den i `suspended`, og
  en kontekst laget mens siden lastes, blir aldri vekket — da er appen stum
  resten av økta uten at noe feiler. Derfor kaller hvert trykk `Lyd.vekk()`.
- **Hver tone trenger myke ramper på volumet.** Uten dem knepper det i
  høyttaleren hver gang en tone slås av.

Rakettene tegnes i et lerret som ligger over hele siden med
`pointer-events: none`, så knappene under virker mens det spruter. Løkka stopper
når siste gnist er borte — en telefon skal ikke tegne et tomt lerret seksti
ganger i sekundet resten av kvelden. Har systemet slått på «reduser bevegelse»,
går det opp én rakett med færre gnister, og kortet slutter å vippe.

## Innstillingene

Innstillingene er for den voksne og ligger bak **prikkene i hjørnet**, ikke på
barnets skjerm: der skal det stå ett oppdrag og tre knapper, ikke fire
avkryssinger et barn kan skru på uten å vite hva de gjør. Arket kommer opp
nedenfra, og lukkes med knappen, med et trykk på teppet bak, eller med Escape.
Fokus flyttes til første felt når det åpnes, og tilbake til prikkene når det
lukkes — ellers står fokus igjen på et felt som er borte fra skjermen.

Arket skjules med attributtet `hidden`. **Regelen i CSS er
`.ark:not([hidden])`**, ikke en egen `display:` på `.ark` — en `display` i CSS
slår nettleserens egen `[hidden] { display: none }`, og arket ville blitt
stående synlig selv om koden hadde skjult det.

Beskjeden om at enheten mangler norsk stemme står også i arket. Den er til den
voksne, ikke til barnet.

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

## Fargene

Bakgrunnen er en gradient, og den skifter i rampemodus. **Klassen må sitte på
`html`, ikke på `body`:** gradienten males på `html`, og variabler satt på
`body` når aldri opp dit — bakgrunnen ble stående uendret første gang. Fargen på
statuslinja (`theme-color`) følger med, så det synes også når appen ligger på
hjemskjermen.

Hagen har sin egen grønne bakgrunn, satt på samme måte (`html.hage`), morgenen
en lys soloppgang (`html.morgen`), og statuslinjefargen følger med. Bytter man sted eller modus, stilles kortet
tilbake til «trykk her» med ikonet for den nye banken — terning inne, tre i
hagen, fjes i rampemodus — for det som sto der, kom fra en annen bank.

Kortet får farge fra `--kort`, som `app.js` setter for hvert oppdrag. Vippen
krever at klassen `ny` fjernes, at `offsetWidth` leses, og at den legges på
igjen — uten avlesningen slår nettleseren de to sammen, og animasjonen kjører
bare første gang.

## PWA

`sw.js` er nett først med cache som reserve, og henter med `{ cache: 'no-store' }`
både under installering og ved hvert nettkall — uten det svarer Pages'
`max-age=600` med opptil ti minutter gammel fil.

### Versjonsnummeret må flyttes tre steder

CSS-en og JS-en lastes med `?v=N` i adressen. Det er ikke pynt: uten det kan en
telefon havne med **ny `index.html` og gammel `styles.css` og `app.js`** — og da
tegner prikkeknappen seg uten stilen som plasserer den (den havner øverst til
venstre) og uten koden som lytter på den (ingenting skjer når man trykker). Det
skjedde, på en iPhone, og det er grunnen til at nummeret finnes.

Endrer du en fil, øk `N` **alle tre stedene samtidig**:

1. `?v=N` på hver `<link>` og `<script>` i `index.html`
2. de samme adressene i `FILES` i `sw.js` — det er de forespørslene nettleseren
   faktisk sender, og bare de treffer noe i cachen
3. `CACHE`-navnet i `sw.js`

Versjonsnummeret står også nederst i innstillingsarket, så det går an å spørre
«hva står det der?» i stedet for å gjette på hva telefonen kjører.

Tar en ny service worker over mens appen står åpen, lastes siden om én gang
(`controllerchange` i `index.html`) — ellers ligger den gamle koden fortsatt i
vinduet selv om cachen er ny.

Ikonene er en strekfigur i et sprett, skrevet av `lag_ikon.py` uten Pillow:

```
python3 pwa-sprell/lag_ikon.py
```
