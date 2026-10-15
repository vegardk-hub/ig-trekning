# Familietavla

En tavle for et nettbrett på veggen: klokke, vær fra Yr, dagen i én kolonne per
person, de neste seks dagene og neste søppeltømming. Middag og bursdager kan slås
på ved å legge til kalendrene.

Tavla svarer på det eierne ba om: **hvem har hvilke aktiviteter i dag, og hvem
henter.** Derfor har hver person sin egen kolonne i stedet for én felles
tidslinje – hvem det gjelder, er det første man leter etter.

Adresse: `https://vegardk-hub.github.io/ig-trekning/familietavle/`.
Med `?demo` viser den en oppdiktet familie.

## Slik henger det sammen

```
iPhone (Kalender-appen)
  ├─ hver persons kalender, «Middag», «Bursdager» → publisert som offentlige iCloud-lenker
  ▼
GitHub Actions hvert kvarter (.github/workflows/familietavle.yml)
  ├─ henter kalendrene (lenkene ligger som repo-hemmeligheter)
  ├─ beskjærer bort det som er ferdig
  └─ krypterer med passfrasen → grenen familietavle-data, fila tavle.json
  ▼
Nettbrettet: henter tavle.json hvert femte minutt, dekrypterer, tegner.
             Henter været rett fra api.met.no hver halvtime.
```

Tavla er **en visning, ikke et redigeringsverktøy**. Alt legges inn fra
telefonen, i Kalender-appen, og tavla leser. Det er bevisst: de ferdige
veggkalenderne (Skylight, Hearth, Cozyla) får mest kritikk for synk som henger
og et tregt grensesnitt, og en tavle uten redigering har ingen av delene.

## Oppsett

### 1. Kalendrene i iCloud

På iPhone: **Kalender → Kalendere → Legg til kalender**.

- **Hver persons egen kalender** brukes som den er, og får én kolonne.
- **Søppel** – tre heldagshendelser som gjentas: rest- og matavfall hver
  andre uke, papir og plast hver fjerde, glass og metall hver åttende. Første
  dato for hver står i [Bærums tømmekalender](https://www.baerum.kommune.no/tjenester/avfall-og-gjenvinning/tommekalender/).
  Kommunen har ikke noe åpent API, men intervallene er faste, så tre
  gjentakelser er nok. Flytter kommunen en tømming i jula, endres den ene
  forekomsten i kalenderen. Tavla viser neste tømming i bunnlinja, og lyser
  gult dagen før og samme dag.

- **Ukeplan Ella** (én per barn, «Ukeplan» + barnets navn slik det står i
  personkalenderen) – én hendelse per uke, med ukeplanen limt inn i
  **Merknader**. Se «Ukeplanen fra skolen» under.

Middag og bursdager er **valgt bort i første versjon**, men virker om
kalendrene legges til:

- **Middag** – én heldagshendelse per dag, med middagen som tittel. Erstatter
  lista i Påminnelser; Påminnelser har ikke noe API tavla kan lese.
- **Bursdager** – én heldagshendelse per person, **gjentas hvert år**, lagt på
  **fødselsdatoen med fødselsåret**. Da regner tavla ut alderen («Mormor blir
  73»). Legges den på årets dato i stedet, viser tavla bare navnet fra neste år
  av – altså feil alder. iPhones innebygde «Fødselsdager» kan ikke deles eller
  publiseres, så den må kopieres over én gang.

Med middag og bursdager kommer en sidekolonne, og da blir uka lagt i to rader
og trang på et 10,6" nettbrett. Skal de inn for godt, bør utformingen tenkes
på nytt.

Kalendernavnene «Søppel», «Middag» og «Bursdager» er det som avgjør hvor de
havner på tavla – se steg 3.

### 2. Publiser hver kalender

På iPhone: **Kalender → Kalendere → (i) ved kalenderen → slå på «Offentlig
kalender» → Del lenke → Kopier**. Lenka begynner med `webcal://`.

Hver person må gjøre dette for sine egne kalendre, fra sin egen telefon.

> **Familiedelings-kalenderen («Familie») kan ikke publiseres** – Apple gir den
> ikke de samme valgene. Bruk vanlige iCloud-kalendre som deles med de andre.

> Den som har en publisert lenke, kan lese kalenderen. Lenkene skal derfor
> **bare** inn i GitHub-hemmeligheten under, aldri i en fil i repoet.

### 3. To hemmeligheter i GitHub

**Repoet → Settings → Secrets and variables → Actions → New repository secret.**

`FAMILIETAVLE_KALENDERE` – én kalender per linje, `Navn: lenke`:

```
Pappa: webcal://p123-caldav.icloud.com/published/2/...
Mamma: webcal://p45-caldav.icloud.com/published/2/...
Ella: webcal://...
Middag: webcal://...
Bursdager: webcal://...
```

Navnet er det som står på tavla. «Søppel», «Middag» og «Bursdager» er
spesielle; alle andre er en person og får en farge i den rekkefølgen de står. Linjer som
begynner med `#`, hoppes over.

`FAMILIETAVLE_PASSFRASE` – fire–fem tilfeldige ord, minst 16 tegn. Den
krypterer datafila, som ligger åpent på nettet. Den skal skrives inn én gang
på nettbrettet, så velg ord som er greie å taste.

### 4. Første kjøring

**Actions → Familietavle – synk → Run workflow.** Etter et halvt minutt skal
grenen `familietavle-data` finnes, med én fil. Loggen viser hvor mange
hendelser hver kalender hadde, men aldri lenkene.

### 5. Nettbrettet (Redmi Pad)

1. Åpne adressen i **Chrome**, skriv inn passfrasen.
2. Chrome-menyen → **Legg til på startsiden / Installer app**. Da åpner tavla
   seg i fullskjerm fra ikonet.
3. **Innstillinger → Batteri → Batteribeskyttelse**: slå på en ladegrense hvis
   den finnes. Et nettbrett som lades døgnet rundt på 100 %, kan få et
   oppsvulmet batteri. Finnes ikke valget, er en smartplugg som lader mellom
   ca. 40 og 80 % det trygge alternativet – ellers: kjenn etter jevnlig om
   baksida buler.
4. **Apper → Chrome → Batterisparing: Ingen begrensninger**, og slå på
   **Autostart**. Xiaomi stopper ellers apper i bakgrunnen, og tavla fryser om
   natta.
5. **Utvikleralternativer → Hold skjermen på (under lading)**. Tavla ber selv
   om å holde skjermen våken, men dette er sikkerhetsnettet.

6. **Batteri → Tilleggsfunksjoner → Planlagt på/av**: slå nettbrettet av om
   kvelden og på om morgenen. Eierne vil ikke ha lys om natta, og en nettside
   kan ikke slå av skjermen. Tavla blir svart fra 23 til 06 som en reserve,
   men bakgrunnslyset i en LCD lyser litt gjennom svart. (Stien er hentet fra
   Xiaomis side for Redmi Pad SE; menynavnene kan avvike litt.)

Et trykk på den svarte skjermen viser tavla i to minutter.

## Ukeplanen fra skolen

Skolens ukeplan er en PDF med en tabell der det ikke går an å se sikkert
hvilken dag en lekse hører til. Den må leses av en språkmodell, og det er
gratis når dere gjør det selv i Claude-appen. Tavla leser bare resultatet.

**Hver uke, cirka to minutter:**

1. Last opp PDF-en i Claude-appen og lim inn instruksen under.
2. Kopier svaret.
3. I Kalender på iPhone: ny hendelse i «Ukeplan Ella» på mandagen, gjerne
   heldag, tittel «Ukeplan». Lim svaret inn i **Merknader**.

Innen en time står skolehendelsene (tur, foreldremøte, skolejogg) i Ellas
kolonne, og leksene i leksefanen. «Skole» alene – vanlig skoledag – vises ikke.

**Instruksen:**

```
Les ukeplanen i PDF-en som et bilde: tabellen med Mandag–Fredag øverst må
leses kolonne for kolonne, så hver lekse havner på dagen den står under.
Gjør den om til akkurat dette formatet, og ikke skriv noe før eller etter:

## Hendelser
| Dato | Hendelse | Detaljer |
|---|---|---|
| Man 5.10 | Skole | 08.30–13.15 |
| Ons 7.10 | Foreldremøte | 17.00–19.00. Sted og annet viktig |

## Lekser
- Man: én lekse
- Tor: én lekse
- Tor: neste lekse samme dag

## Ukelekse
- det som gjelder hele uka

Regler:
- Én rad per hendelse, med klokkeslett først i Detaljer når det finnes.
  Skriv «Skole» alene for vanlige skoledager, men ta med sted eller annet
  som skiller seg ut («Skole, idrettshallen»).
- Ta med hendelser fra «Ukens info» med dato (foreldremøte, skolejogg, tur),
  med det barnet må ha med eller ha på seg.
- Én linje per lekse. Står det flere lekser eller «Ekstra» under samme dag,
  får hver sin linje med samme dag foran.
- Dager uten lekse («God helg!») utelates.
- Er du usikker på hvilken dag noe hører til, skriv [sannsynlig] bak teksten.
- Ta ikke med SFO-mat, læringsmål, begreper, sang eller generell info.
```

**Kontroller dagene før du limer inn.** Den første tolkningen av uke 41 la
«Les inn leseleksen» og «Lad læringsbrettet» på fredag. I PDF-en står de under
torsdag, og fredag er «God helg!». Feilen kom av at modellen leste teksten i
PDF-en i stedet for tabellen slik den ser ut – kolonnene glir over i hverandre
når teksten trekkes ut. Derfor ber instruksen om å lese den som et bilde.

Tavla tåler at svaret har flere seksjoner enn dette – den leser bare
Hendelser, Lekser og Ukelekse.

**Leksefanen** åpnes fra knappen «Lekser» i bunnlinja eller i barnets kolonne.
Barnet trykker på en lekse når den er gjort og får en liten feiring: konfetti
og to toner. Et nytt trykk angrer. Avkrysningen lagres på nettbrettet, ikke i
kalenderen – et barn som krysser av, skal ikke kunne endre noe foreldrene har
lagt inn. Fanen lukker seg selv etter tre minutter.

> Det er ikke dokumentert at iCloud tar med Merknader i en publisert kalender.
> Synk-loggen i Actions skriver «Ukeplan Ella: 1 hendelser med notat». Står
> det 0, kommer ikke notatene fram, og ukeplanen må en annen vei.

## Redigere fra nettbrettet

Tavla selv redigerer ikke. Vil dere legge inn avtaler på nettbrettet, er
[DAVx⁵](https://davx5.com/tested-with/icloud) veien: den henter iCloud-kalendrene
inn i Androids egen kalender, og endringer der går tilbake til iCloud. Den
trenger et **app-spesifikt passord** fra appleid.apple.com, ikke Apple-ID-
passordet. Velg bare familiekalendrene i DAVx⁵ – alt som synkroniseres, kan
leses av alle som står foran nettbrettet. En endring på nettbrettet kommer på
tavla etter neste synk, som alt annet.

## Det som er verdt å vite

- **Forsinkelsen er 15–60 minutter, iblant mer.** GitHubs timer er «best
  effort». Bunnlinja sier «Kalender hentet 14:07», og blir oransje når fila er
  over to timer gammel. En tannlegetime som flyttes en time før, kan altså stå
  feil på veggen. Blir det et problem, er en Cloudflare Worker neste steg –
  det er én adresse i `app.js` som må byttes.
- **GitHub slår av planlagte jobber etter 60 dager uten aktivitet** i et
  offentlig repo. Står tavla på «sist hentet for 3 døgn siden», sjekk
  Actions-fanen.
- **Feiler én kalender, stopper hele kjøringen**, og den forrige fila blir
  stående. Hellere en hel tavle som er et kvarter gammel enn en fersk tavle
  der Ella mangler. GitHub sender en e-post når en planlagt jobb feiler.
- **Ny passfrase:** bytt hemmeligheten, kjør jobben, og trykk ⋯ nederst til
  høyre på tavla.
- **Ny kode kommer av seg selv.** Tavla laster seg selv på nytt en gang i
  døgnet etter kl. 04.

## Filene

| Fil | Svarer for |
| --- | --- |
| `js/kalender.js` | Leser ICS, folder ut gjentakelser, beskjærer. Brukes både av tavla og av synk-jobben. |
| `js/krypto.js` | AES-GCM med PBKDF2. Samme kode i Node og i nettleseren. |
| `js/ukeplan.js` | Leser ukeplanen i notatfeltet: hendelser, lekser, ukelekser. |
| `js/vaer.js` | Trekker ut nå, tre klokkeslett og tre dager fra Locationforecast. Stedet (Bekkestua) står her. |
| `js/app.js` | Henter, dekrypterer, tegner, demper om natta. |
| `js/demo.js` | Den oppdiktede familien – brukes av `?demo` og av prøvene. |
| `synk/synk.js` | Synk-jobben i Actions. |
| `vaer/` | Yrs værikoner, MIT-lisens (`vaer/LISENS.txt`). |

## Fellene

- **Gjentakelser foldes ut i veggtid.** En trening hver tirsdag kl. 17 skal stå
  kl. 17 også etter vintertid. Sju ganger 24 timer gir kl. 16.
- **29. februar havner på 28. februar** for årlige hendelser i år uten skuddår.
  RFC 5545 sier hopp over; en tavle som glemmer en bursdag tre år av fire,
  blir ikke trodd.
- **En flyttet forekomst (`RECURRENCE-ID`) erstatter den opprinnelige.** Ellers
  står en flyttet korpsøvelse både på gammel og ny tid.
- **Linjene limes sammen før teksten dekodes.** RFC 5545 bretter etter 75
  *byte*. Bretter en server midt i en «ø», blir den til «��» hvis man dekoder
  først – `limSammen()` i `synk.js`.
- **`WKST` endrer datoene.** Annenhver uke med søndag som ukestart (en iPhone
  på engelsk) gir andre datoer enn med mandag. RFC-ens eget eksempel er en
  prøve.
- **En felles avtale vises én gang.** En invitasjon flere har takket ja til,
  ligger i hver sin kalender med samme UID. Tavla slår dem sammen og gir
  avtalen én stripe per person – den samme avtalen tre–fire ganger er en av
  de vanligste klagene på Echo Show som familiekalender.
- **Fargene kommer fra iPhone** (`X-APPLE-CALENDAR-COLOR`), men to personer
  får aldri samme farge. Standardkalenderen har samme farge hos alle som ikke
  har endret den.
- **Beskjæringen er ikke pynt.** En iCloud-kalender med ti års historikk er
  fort et par megabyte, og nettbrettet henter fila hvert femte minutt.
- **Kortene kapper nedenfra, og sier hvor mye som ble borte.** En halvt synlig
  linje nederst ser ut som en feil. I dag-kortet fjernes avtaler som er over
  først, før noe som kommer.
- **Datagrenen har alltid ett commit.** Den skrives over hver gang. Alt på
  `main` bygges av Pages, så data der ville gitt 96 bygg i døgnet.
- **METs symbolkoder har to stavefeil** (`lightssleetshowersandthunder`,
  `lightssnowshowersandthunder`), og ikonfilene er stavet likt. Ikke rett dem.

## Prøver

```
node familietavle/tester/data.js
NODE_PATH=/opt/node22/lib/node_modules node familietavle/tester/tavle.js
NODE_PATH=/opt/node22/lib/node_modules node familietavle/tester/icloud.js
```

`tester/simulert-icloud.js` er en oppdiktet familie med fem kalendre skrevet
slik iCloud skriver dem – tidssoneblokker, Apple-felt, invitasjoner, bretting
midt i et tegn, flyttede og avlyste forekomster – med en liste over hva tavla
skal vise. Den er det nærmeste prøvene kommer ekte data; skyøkta når ikke
iCloud. Dukker det opp en særhet i en ekte kalender, legg den inn der først.

`data.js` trenger verken nettleser eller nett: kalenderreglene, simuleringen,
krypteringen og hele synk-jobben mot en lokal server. `icloud.js` kjører hele
kjeden – simulert iCloud, den ekte synk-jobben, tavla i nettleser – og
sammenligner skjermen med fasiten. `tavle.js` trenger playwright: at
ingenting stikker ut av skjermen på fire skjermstørrelser, at dagen står der
den skal, passfrasen, den gamle fila og natta. Med `BILDER=<mappe>` lagrer den
skjermbilder.
