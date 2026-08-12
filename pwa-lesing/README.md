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

Ikonene genereres:

```
python3 pwa-lesing/lag_ikon.py
```

Skriptet skriver PNG-ene selv med `zlib` og `struct`. Pillow er ikke
installert i skyøkta, og et ikon er ikke grunn god nok til å innføre en
avhengighet i et repo som ikke har noen.

Appen er en PWA. Endrer du filene som forhåndslagres, bump `CACHE` i `sw.js`.
