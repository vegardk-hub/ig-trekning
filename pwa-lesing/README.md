# Monstergiret

Leseapp for barn som har knekt lesekoden og leser noenlunde flytende. Barnet
leser en tekst høyt i mikrofonen, ordene blir grønne etter hvert som de blir
lest, og en ferdig tekst gir én brikke i et puslespill. Seks brikker gir en
monstertruck, og trucken kjører inn i garasjen — oversiktsbildet som er det
første man ser når appen åpnes.

Åtte trucker, seks tekster hver: 48 tekster i alt.

## Premisset: appen kan bekrefte, aldri avvise

Dette er ikke en stilistisk preferanse, det er den tekniske virkeligheten
gjort om til en designregel. **Talegjenkjenning på barnestemmer tar feil, og
den tar feil ofte.** Modellene er trent på voksne som snakker sammenhengende,
ikke på en åtteåring som leser med pauser midt i setningen. Bygger man en app
som sier «feil» når den ikke kjente igjen ordet, har man bygget en app som
sier «feil» til et barn som leste helt riktig. Da slutter barnet å lese.

Derfor:

* **Ord kan bare bli grønne, og grønt tas aldri tilbake.** Ingenting blir
  rødt. Det finnes ingen poengsum, ingen prosent, ingen «7 av 10 riktig».
* **Barnet kan alltid komme videre.** Trykk på et ord, så leses det opp. Trykk
  en gang til, så er ordet grønt og lesingen går videre.
* **Et ord som ble grønt av et trykk, ser nøyaktig ut som et ord som ble grønt
  av stemmen.** Ingen halvgrønn farge, ingen markering av «denne fikk du
  hjelp til». En slik forskjell ville vært en skammekrok, og den ville rammet
  hardest de gangene gjenkjenneren tok feil og ikke barnet.
* **Brikker kan ikke tapes.** De er opptjent.
* Ingen klokke, ingen tidsgrense, ingen måte å tape på. Samme linje som i
  Fargeflasker og Poengtavla.

Det gir også appen en billig forsikring: skulle talegjenkjenningen vise seg å
være ubrukelig på akkurat dette barnet, er dette fortsatt en fungerende
leseapp der man trykker seg gjennom teksten og får truckene. Mikrofonen er
motoren, men den er ikke det eneste som holder appen oppe.

## De tre knappene under teksten

Mikrofonen i midten, og to støtteknapper som begge er der for barn som synes
lesingen er tung.

**`AA` — store bokstaver.** Bytter teksten til blokkbokstaver, som mange synes
er lettere å kjenne igjen. Valget huskes. **Store bokstaver er bare en
visning** — de kommer fra `text-transform` i CSS, og teksten under ligger
urørt. Skrev vi om selve ordene, ville både matchingen og opplesingen fått
versaler å jobbe med, og en stemme som får «ILDKULEN» kan finne på å stave det
bokstav for bokstav. Samme lærdom som navnene i Poengtavla.

Versaler er bredere enn minusker, så visningen har sin egen linjelengde —
ellers brekker setninger som sto samlet i små bokstaver.

**Høyttaleren — les teksten for meg.** Leser hele teksten høyt, én linje om
gangen, og linja som leses lyser opp så barnet finner plassen.

* **Linje for linje, ikke ord for ord.** `onboundary` er den eneste veien til
  ordnøyaktig følging, og den er ikke til å stole på i Safari. En linje som
  lyser er uansett nok til å holde plassen.
* **Linja som leses har sin egen farge, ikke grønn.** Grønn betyr «du leste
  dette», og det å bli lest for er ikke det samme.
* **Opplesingen gjør ingenting grønt.** Det er et bevisst valg: en knapp som
  farget hele teksten ville gjort brikken til noe man trykker seg til. Barnet
  hører teksten først og leser den selv etterpå — det er hele poenget. Står
  det fast på ett enkelt ord, er det trykk-på-ordet som er veien videre.
* **Mikrofon og opplesing kan ikke gå samtidig.** Mikrofonen settes på pause
  for hele opplesingen — én gang, ikke per linje — og trykk på mikrofonen
  eller på et ord stopper opplesingen først. Ellers hører appen seg selv.
* `cancel()` fyrer `onend` på linja som går, så stoppen har et eget flagg.
  Uten det ville et stopptrykk startet neste linje i stedet.

## Stemmen som leser

Tannhjulet i garasjen åpner et valg av stemme og lesefart. Valget lagres og
brukes både til hele tekster og til enkeltord.

**Om iOS' personlige stemme.** Eieren spurte om opplesingen kunne bruke hans
egen stemme via Personlig stemme i iOS 17. Så vidt vi vet, går ikke det:
Personlig stemme ligger i `AVSpeechSynthesis` bak en egen native tillatelse
(`requestPersonalVoiceAuthorization`), og Safari eksponerer den ikke til
`speechSynthesis` på nettsider. Å nå den ville kreve en ekte iOS-app i Swift.

Derfor er stemmevelgeren bygget slik at den **viser nøyaktig det systemet
melder om**, ikke bare det vi tror finnes:

* Lista er filtrert til norske stemmer, men avkryssingen «vis alle stemmer»
  tar bort filteret helt. Dukker en personlig stemme opp for nettsider en dag,
  ser man den der og kan velge den.
* En valgt stemme vinner over språkfilteret, også når den ikke er norsk — en
  personlig stemme kan godt være merket med en annen språkkode.
* **Språkkoden på utsagnet følger stemmen.** Tvinger man `nb-NO` på en stemme
  merket med noe annet, kan systemet bytte stemme bak ryggen på valget.
* Telleren nederst sier hvor mange stemmer enheten melder om. Den er der for å
  gjøre spørsmålet etterprøvbart på enheten i stedet for å gjette.

`getVoices()` er tom til systemet har lastet lista, så velgeren fyller seg selv
på `voiceschanged`. Første åpning sender også et tomt utsagn, som er det som
får iOS til å laste lista i det hele tatt.

## Din egen stemme

Siden Personlig stemme ikke er tilgjengelig, er veien til en forelders stemme
å **spille den inn** — ikke å klone den. Innstillinger → «Spill inn tekster»
gir en liste over alle tekstene, og hver tekst kan leses inn linje for linje.

Det bærende valget er at **innspillingen er per linje og helt frivillig**. En
tekst kan være halvveis lest inn; linjer uten opptak faller tilbake på den
syntetiske stemmen. Det gjør at man kan lese inn den ene teksten barnet står
på i kveld, uten å binde seg til alle 48. Hadde opptaket vært alt-eller-intet
per tekst, ville terskelen blitt et prosjekt i stedet for et halvminutt.

* **Opptakene ligger i IndexedDB**, ikke i `localStorage` — det siste tar bare
  strenger og har en grense rundt fem megabyte. Nøkkelen er tekst-id pluss
  linjenummer.
* **Alt ligger på enheten.** Ingen backend, så tømmer man nettleserdata, må
  tekstene leses inn på nytt.
* **Mikrofonen slippes med en gang opptaket er ferdig** (`track.stop()`).
  Uten det blir opptaksmerket stående i statuslinja så lenge siden er åpen.
* **Ett `Audio`-element gjenbrukes for alle linjene.** iOS krever et ekte
  trykk for å slippe lyd gjennom, men sperren sitter på elementet: er det
  først låst opp av et trykk, kan de neste linjene spilles fra en
  `ended`-lytter, som ikke er noe trykk. Et nytt element per linje ville blitt
  stoppet fra og med linje to.
* Et opptak som ikke lar seg spille, hopper videre i stedet for å stoppe hele
  opplesingen.

## Ordmatchingen

Ligger i `js/tale.js`, uavhengig av resten, og er med vilje rundhåndet. En
falsk godkjenning koster ingenting — barnet leste, og fikk grønt. En falsk
avvisning koster leselysten.

| Tilfelle | Håndtering |
| --- | --- |
| Store bokstaver, komma, punktum | Normaliseres bort |
| «5» i teksten, «fem» i munnen | Siffer skrives om til tallord |
| «kjøre» hørt som «sjøre» | Lydforenkling: `kj`/`tj` og `skj`/`sj` faller sammen |
| «land» hørt som «lann» | Stum `d` etter `l`/`n` fjernes |
| Liten skrivefeil i ett ord | Levenshtein-avstand, med toleranse etter ordlengde |
| «monstertruck» hørt som «monster truck» | Nabotokens slås sammen og prøves |
| Ett ord ble aldri hørt | Hopp over ett ord, med vanlig toleranse |
| To ord på rad ble aldri hørt | Hopp over to, men bare på et ord som treffer **helt** |

Korte ord på tre bokstaver eller mindre må treffe eksakt. Med én bokstavs
slingring ville «og» matchet «om», «opp» og «i» om hverandre, og halve teksten
hadde blitt grønn av seg selv.

Overspranget stopper på to ord. Tre tapte ord på rad lar barnet stå fast, og
da er det trykk-på-ordet som er veien videre — det er billigere enn å la støy
kunne hoppe over en hel setning.

To ting som ser ut som detaljer og ikke er det:

* **Fargeleggingen skjer på foreløpige resultater** (`interimResults`), ikke på
  endelige. Det er det som gir følelsen av at ordene farges mens man leser.
  Foreløpige resultater skrives om hele tiden, men siden posisjonen bare kan
  gå framover, blir omskrivningen aldri synlig som et ord som mistet fargen.
* **Hvert utsagn matches fra bunnen av hver gang**, fra der forrige utsagn
  sluttet. Uten det ville et omskrevet foreløpig resultat blitt talt to ganger.

Alle alternativene fra gjenkjenneren prøves, ikke bare det første. Den gjetter
ofte riktig på andre forsøk.

## Talegjenkjenning i praksis

Appen bruker `webkitSpeechRecognition` med `lang = 'nb-NO'`.

* **Gjenkjenneren stopper av seg selv ved stillhet.** Et barn som leser,
  pauser hele tiden, så `onend` starter den igjen. Uten det ville mikrofonen
  dødd ved første tenkepause.
* **Appen skal ikke høre seg selv.** Mikrofonen settes på pause mens et ord
  leses opp, og fortsetter etterpå.
* **Mikrofonen stanser når iPaden legges bort** (`visibilitychange`).
* **Talegjenkjenning krever som regel nett.** Resten av appen gjør ikke det:
  uten nett virker lesingen med trykk, brikkene, garasjen og opplesingen av
  enkeltord.

**Ustabilt i hjemskjermmodus.** Talegjenkjenning i en PWA lagt til på
hjemskjermen har historisk vært upålitelig på iOS. Appen tar høyde for det —
får den ikke mikrofonen, sier den fra at man kan åpne siden i Safari, og lar
barnet lese videre med trykk i mellomtiden. **Virker ikke mikrofonen, prøv
siden i Safari før du leter etter feil i koden.**

## Puslespillet

Brikkene er ikke oppdelte bildefiler. Trucken tegnes hel, og de brikkene som
ikke er tjent ennå, ligger som **lokk** oppå — seks ruter i et 3×2-rutenett.
Å avdekke en brikke er å ta bort et lokk, og det gir animasjonen gratis.

**Brikkene dukker opp i tilfeldig rekkefølge**, ikke fra venstre mot høyre. Et
bilde som avdekkes ovenfra og ned røper hvilken truck det er på brikke to, og
det er nettopp «hvilken truck blir det?» som drar barnet til neste tekst.
Rekkefølgen er sådd med trucknummeret, så den er den samme hver gang.
Navnet på trucken holdes skjult til halve bildet er framme.

## Truckene tegnes, de lastes ikke ned

`js/trucker.js` er én tegning pluss en tabell: farge, mørk skyggefarge,
detaljfarge, felgfarge, motortype og dekortype. Åtte rader gir åtte tydelig
forskjellige trucker uten en eneste bildefil, skarpt på alle skjermer, og en
niende truck er en ny rad i tabellen.

Tre ting som er prøvd og rettet, og som ikke bør rulles tilbake:

* **Motoren er metall, ikke karosserifarge.** Først ble den tegnet i truckens
  egen mørke farge, og da leste den som en pipe som vokste ut av panseret i
  stedet for som en maskin som står oppi det. Alle motorene stikker også ned
  under panserlinja (`y=82`), ellers svever de.
* **All dekor holder seg i båndet mellom `y=86` og `y=120`.** Det er den
  eneste stripa som er rent karosseri hele veien fra front til bak. Over den
  ligger førerhuset, og et lyn tvers over vinduet ser ut som en feil.
* **Akselen mellom hjulene må være i det lyse metallet.** Med en mørk aksel
  mot mørk bakgrunn ser hjulene ut som to løse ringer under en truck som
  svever.

Silhuetten er den samme tegningen med alt i én farge.

## Tekstene

`js/tekster.js`. Rekkefølgen i lista *er* rekkefølgen barnet møter dem i:
indeks 0–5 bygger truck 0, 6–11 truck 1, og så videre. Hver linje er én
setning, for det er linja som utløser den lille tonen underveis.

Tekstene handler om truckene med vilje. Belønningen skal ikke være et
fremmedelement som henges på lesingen etterpå; den skal være det samme barnet
nettopp leste om. Vanskegraden stiger gjennom de 48 tekstene.

Hold setningene under ti-tolv ord. En lang setning betyr lang tid før barnet
får noe tilbake, og gjenkjenneren driver av gårde underveis.

**Å lese en tekst om igjen gir ingen ny brikke**, men det skal fortsatt føles
bra — gjentatt lesing er god lesetrening. Uten den regelen kunne én tekst
bygget hele samlingen.

## Lagring

`localStorage` under `lesing-v1`: lista over fullførte tekster, og om lyden er
på. **Alt annet utledes** — brikketall, hvilken truck som bygges, hvilke
trucker som er ferdige, og hvilken tekst som står for tur. Ingenting lagres
dobbelt, så brikketallet og lesehistorikken kan ikke komme i utakt.

Neste tekst er den første som ikke er lest, og bare den er åpen i tekstlista.
Samme mønster som `opplaast` i Fargeflasker.

## Lyd

Toner lages på stedet med WebAudio. Ingen lydfiler. En liten tone når en
setning er ferdig, en større når teksten er det, og en egen, lengre fanfare
når hele trucken er ferdig — det siste steget må høres forskjellig fra en
vanlig brikke, ellers mister det alt. Motorbrølet i garasjen er to lave
sagtenner som sklir i tonehøyde.

iOS gir ingen lyd før et ekte trykk har vekket `AudioContext`, så `Lyd.vekk()`
kalles fra knappene.

## Prøver og ikoner

Ordmatchingen har prøver, og de trenger verken nettleser eller server —
`js/tale.js` laster inn i et falskt `window`-objekt:

```
node pwa-lesing/tester/match.js
```

Kjør dem etter hver endring i `js/tale.js`. Skruen som justeres oftest, er hvor
rundhåndet matchingen skal være, og de to siste bolkene er de som holder den i
sjakk: helt feil tekst skal ikke farge noe, og overspranget skal stoppe etter
to ord.

Opplesingen har egne prøver, som trenger playwright:

```
NODE_PATH=/opt/node22/lib/node_modules node pwa-lesing/tester/opplesing.js
```

Stemmevelgeren og innspillingen har også prøver:

```
NODE_PATH=/opt/node22/lib/node_modules node pwa-lesing/tester/stemmer.js
NODE_PATH=/opt/node22/lib/node_modules node pwa-lesing/tester/innspilling.js
```

Innspillingsprøven stubber selve opptaket. **Skyøkta har ingen lydinngang, og
Chromiums `--use-fake-device-for-media-capture` hjelper ikke** — getUserMedia
svarer `NotFoundError` uansett flaggkombinasjon. Ikke bruk tid på å få den
ekte veien til å virke der. Hvordan MediaRecorder oppfører seg i Safari, kan
uansett ingen prøve på Linux svare på; det prøven svarer for, er tilstandene i
skjermen, at opptaket havner i IndexedDB og overlever omlasting, og at
høyttaleren spiller opptaket på de innleste linjene og lar maskinstemmen ta
resten.

Begge bytter ut `speechSynthesis` med en falsk som lar prøven gå én linje om
gangen — i skyøkta finnes ingen stemmer, så ekte tale er ferdig før den har
begynt. Merk at `speechSynthesis` er en getter på `window`: vanlig tilordning
feiler stille, og da kjører prøven mot den ekte uten å si fra. Bruk
`Object.defineProperty`.

Ikonene genereres:

```
python3 pwa-lesing/lag_ikon.py
```

Skriptet skriver PNG-ene selv med `zlib` og `struct`. Pillow er ikke
installert i skyøkta, og et ikon er ikke grunn god nok til å innføre en
avhengighet i et repo som ikke har noen.

Appen er en PWA. Endrer du filene som forhåndslagres, bump `CACHE` i `sw.js`.
