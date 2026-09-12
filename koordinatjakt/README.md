# Koordinatjakt

Lager øvingsark der barnet finner ting i et rutenett og skriver ordet.
Bokstavene A–J står vannrett, tallene 1–10 loddrett med **1 øverst** — som på
et kart, ikke som i et koordinatsystem.

Det er **ett ark med tre måter å svare på**: på skjermen er svarlinja et
skrivefelt med en mikrofonknapp ved siden av, på papiret er den en strek. Samme brett, samme oppgaver, samme
rekkefølge — så en voksen kan skrive ut arket til ett barn og la det andre
skrive på iPaden uten at de to sitter med hver sin oppgave.

Live: <https://vegardk-hub.github.io/ig-trekning/koordinatjakt/>

## Premisset

Bildet skal **henge sammen**. Et rutenett med tilfeldige ikoner er en
bildeordbok, ikke et kart, og da er det ingenting å resonnere om: barnet
leter, finner, skriver. Er det derimot en dyrehage med en sti gjennom, dyr i
innhegninger og en kiosk ved porten, kan barnet gjette seg til hvor ting *bør*
være og bruke koordinaten til å sjekke. Det er den øvelsen arket er til for.

Derfor legges veien først, sonene må grense til veien, og tingene langs veien
må ha en veirute som nabo. Rekkefølgen står i `js/scene.js`.

## Filene

| Fil | Ansvar |
| --- | --- |
| `js/tilfeldig.js` | Sådd tilfeldighet. Brettnummeret er såkornet. |
| `js/brikker.js` | Alle tingene som kan tegnes, hver i sitt eget 100×100-rom, hver med sitt ord. |
| `js/temaer.js` | Hvilke brikker som hører sammen, og hvor de kan stå. |
| `js/scene.js` | Utleggingen av ett brett. Ingen piksler. |
| `js/oppgaver.js` | Hvilke funn det spørres om, og fasiten. |
| `js/svar.js` | Om et svar er riktig – skrevet eller sagt. Ingen DOM. |
| `js/lytting.js` | Mikrofonen. Ett ord, ett forsøk. |
| `js/tegn.js` | Scenen som SVG. |
| `js/app.js` | Panelet, adressen og utskriften. |

`scene.js` er skilt fra `tegn.js` av samme grunn som fysikken i
Stuntgarasjen er skilt fra tegningen: spørsmålene som avgjør om et brett
duger, lar seg svare på uten nettleser.

## Skrivemodus

**Arket øver koordinater, ikke rettskriving.** Det er premisset for hele
`svar.js`, og det avgjør hver eneste regel der. Et barn som finner sjiraffen i
C4 og skriver «sjiraf», har løst oppgaven; en app som svarer nei på det, måler
feil ferdighet og gjør en seier om til et nederlag.

Derfor godtas fire ting utover det eksakte ordet:

1. **Artikkel og bestemt form** — «en løve», «løven», «løva», «løvene». Et ord
   på -e mister e-en i hunkjønn bestemt form, så endelsene legges også på
   stammen uten den; ellers ryker «løva».
2. **Æ, ø og å skrevet som ae, o og a.** På et tastatur som står på engelsk er
   ikke det en feil, det er et tastaturvalg.
3. **Én skrivefeil, inkludert ombytte.** Avstanden er Damerau-Levenshtein og
   ikke vanlig Levenshtein, nettopp for ombyttet: «elefnat» ligger to vanlige
   redigeringer fra «elefant», men én ombytting, og det er den feilen en
   sjuåring gjør oftest.
4. **Kjente alternative ord** — «gatelys» for en lyktestolpe, «fjøs» for en
   låve. De står i `OGSAA` i `brikker.js`.

Og tre ting som ikke godtas, fordi de gjør fasiten utydelig:

- **Korte ord må treffe eksakt.** Samme lærdom som ordmatchingen i
  Monstergiret: med én bokstavs slingring er «kart» og «katt» samme svar.
  Grensa går ved fem bokstaver.
- **Et svar som ligger like nær et annet ord på brettet, teller ikke.** Da må
  barnet skrive nøyaktig.
- **Delvis skrevne ord.** Toleransen gjelder når barnet sier seg ferdig, ikke
  mens det skriver — ellers låser feltet seg på «elefan». Derfor har
  `Svar.godtar` et `streng`-flagg: `input` bruker det, `Enter` og `blur` ikke.

### Innlesing

Barnet kan si ordet i stedet for å skrive det. Det er en annen bruk av
mikrofonen enn i Monstergiret og Lesestjerna, der den står på mens barnet
leser en hel tekst, og det gir en annen innstilling i `lytting.js`:

- **`continuous = false`.** Vi venter på ett ord, ikke på en strøm. Og
  gjenkjenneren skal **ikke** startes på nytt i `onend` — det er nødvendig når
  noen leser og pauser, men her ville det bare latt mikrofonen stå åpen i
  bakgrunnen.
- **`maxAlternatives = 5`.** Ett ord uten setning rundt seg er det vanskeligste
  en gjenkjenner får, for den har ingen sammenheng å gjette ut fra.
  Førstevalget er ofte feil mens det riktige ligger som nummer tre. Alle
  alternativene prøves, og det er den enkeltendringen som flytter mest på hvor
  ofte innlesing faktisk virker.
- **Tidsur på sju sekunder.** Sier barnet ingenting, fyrer verken `onresult`
  eller `onerror` på alle nettlesere, og knappen blir stående og lyse.

Matchingen er den samme som for skrevne svar, pluss en lydvei: `Svar.forenkle`
skriver ordet om til noe som ligner uttalen, så skrivemåter som høres like ut,
faller sammen. Ideen er hentet fra `pwa-lesing/js/tale.js`, og grunnen er den
samme — **gjenkjenneren skriver ned det den hørte, ikke det som staves.**
Rekkefølgen i `forenkle` er ikke likegyldig: æ, ø og å må stå igjen til etter
sj- og kj-reglene, ellers blir «skole» til «sjole».

Et treff skriver **fasiten** inn i feltet, ikke det gjenkjenneren fikk til.
Den kan ha hørt «sjiraf» og blitt godtatt; i feltet skal det stå «sjiraff». For
et barn som ikke skriver ennå, er det gratis lesetrening.

Gjenkjenningen går over nett i både Chrome og Safari — lyden sendes til en
tjener. Uten nett skjer det ingenting, og det er ikke en feil i appen. Finnes
ikke `SpeechRecognition` i det hele tatt, forsvinner mikrofonknappene og
panelet sier hvorfor; skriving virker som før.

Har mikrofonen sluttet å virke etter at siden er lagt på hjemskjermen: prøv
den i Safari først. Samme historie som Monstergiret — talegjenkjenning i
hjemskjermmodus har vært upålitelig på iOS, og det er ikke koden her.

### Hvorfor «aldri avvis» ikke gjelder for det skrevne svaret – men gjelder for det talte

Monstergiret og Lesestjerna kan bekrefte, aldri avvise, og ingenting blir
rødt. Den regelen kommer av at **talegjenkjenning bommer på barnestemmer** —
et «feil» ville rammet barn som leste riktig.

Det gjør at de to svarveiene her må behandles motsatt, og forskjellen er hvor
usikkerheten ligger:

- **Skrevet svar.** Det står nøyaktig det barnet skrev. Appen kan trygt si at
  det ikke stemte.
- **Talt svar.** Det er en gjetning om en barnestemme. Et bom fra mikrofonen
  sier ingenting om barnet, og får derfor aldri `bom`-rammen eller «ikke
  helt». Appen forteller hva den hørte — det er en opplysning om mikrofonen,
  ikke en dom.

Dette er kravet som er lettest å ødelegge ved et uhell, siden de to veiene
ender i samme felt. `tester/lytting.js` håndhever det.

Så Koordinatjakt sier fra — men uten å rope. Feltet får en rolig ramme, aldri
en rød. Beskjeden nevner ruta og hjelpeknappen, ikke barnet. Hjelpen har to
trinn: første trykk gir første bokstav og antall bokstaver, andre trykk
skriver inn ordet, og ingen av dem markerer oppgaven som mislykket — samme
premiss som «Hopp over» i Sprellemaskinen.

Skrev barnet noe annet enn fasiten og fikk det godtatt, blir **barnets egen
skrivemåte stående**, med riktig skrivemåte i lyst ved siden av. En rettelse,
ikke en underkjennelse.

### iPaden er ikke en detalj

Fem ting i feltet er der på grunn av iOS, ikke på grunn av smak:

- `autocorrect="off"` — ellers skriver iOS om ordet mens barnet skriver.
- `autocapitalize="none"` — ellers får hvert svar stor forbokstav.
- `spellcheck="false"` — røde bølger under et riktig dyrenavn hjelper ingen.
- `enterkeyhint="next"` — Enter går til neste ubesvarte felt.
- **16 px skriftstørrelse.** Er skriften mindre, zoomer Safari inn på feltet i
  det det får fokus, og kartet forsvinner ut av skjermen.

Bildet og svarene står **side ved side** fra 56 rem og opp. På en iPad i
liggende stilling tar tastaturet halve høyden, og med svarene under kartet
ville barnet mistet kartet av syne akkurat idet det skulle bruke det. Feltet
scroller seg selv til midten når det får fokus.

Svarene lagres i `localStorage` per brett. Et halvferdig ark skal tåle at
iPaden låser seg — ellers begynner barnet forfra på tolv oppgaver det
allerede har løst. Selve bildet lagres aldri: det er brettnummeret.

## Reglene som holder fasiten entydig

Bryter du en av disse, ser arket helt riktig ut og fasiten blir feil:

- **Ett ord kan bare brukes én gang per brett.** To løver gjør «løve» til et
  svar med to riktige koordinater.
- **En kulisse kan aldri være et funn på samme brett.** Er «blomst» svaret i
  F3, kan det ikke stå blomster som pynt i fire andre ruter. Kulissepoolen
  filtreres derfor mot ordene som allerede er i bruk.
- **En brikke må holde seg innenfor sitt eget 0–100-rom.** Slangens tunge lå
  på `x=104` og pekte inn i naboruta. `tester/scene.js` måler alle brikkene.
- **Funnene må ligge spredt.** Hver fjerdedel av arket skal ha minst to.

## Veien er et kryss, ikke en strek

Første utgave hadde én vannrett sti. Siden både soner og ting langs veien
krever en veirute som nabo, hang alt sammen med den — lå stien i rad 7, sto
hele øvre halvdel av arket tomt, og halve tallaksen var uten oppgaver.

Nå legges to stier, én vannrett og én loddrett, og hver fjerdedel med under
tre veiruter får en L-formet arm inn til seg fra nærmeste veirute. Det er
dette, og ikke en regel om spredning, som fordeler funnene. I tillegg søker
hvert nytt funn den fjerdedelen som har færrest fra før (`taCelle` i
`scene.js`).

## Tegningen

Ruta er drøyt 17 mm på A4. Det er premisset for hvordan brikkene ser ut:

- **Silhuett med ett kjennetegn.** Manken på løva, snabelen på elefanten,
  halsen på sjiraffen. To brikker som bare skiller seg i farge, er to brikker
  barnet ikke kan svare på.
- **Mørk kontur på alt**, satt i CSS på gruppa og ikke på hver form. Konturen
  er det eneste som holder bildet lesbart når arket kommer ut av en skriver
  med tom fargepatron. Detaljer som ikke skal ha kontur — flekker, striper,
  øyne — får klassen `u`.
- **Veien tegnes to ganger**: et bredt bånd i konturfargen, så et smalere bånd
  i veifargen oppå. Unionen av de brede båndene blir konturen rundt hele
  veien, uten at noen må regne ut hvor hjørnene møtes. Der fire veiruter
  møtes, må hjørnefirkanten fylles for hånd — ellers står det et hull på
  størrelse med et frimerke midt i krysset.
- **Bokstavene og tallene står på alle fire sider.** Et blikk som skal følge
  rad 8 tvers over ti ruter, sklir.
- **Veien stopper i rammen.** Lot vi den løpe ut i margen, la den seg over
  radtallene.

## Ingen service worker

Med vilje, som i Lesestjerna. Arket lages på en maskin med skriver, ikke på
en telefon på hjemskjermen, og en cache som må versjoneres for hver rettelse
er vedlikehold uten en bruker. Ressursene har likevel `?v=`: Pages sender
`max-age=600`, så en fersk `index.html` kan ellers stå med ti minutter gammel
CSS og JS. Nummeret står i `index.html` og skal økes ved endringer i
`styles.css` eller `js/`.

## Prøver

Kjøres etter hver endring i `js/`. De trenger verken nettleser eller server:

```
node koordinatjakt/tester/scene.js
node koordinatjakt/tester/svar.js
NODE_PATH=/opt/node22/lib/node_modules node koordinatjakt/tester/skriving.js
NODE_PATH=/opt/node22/lib/node_modules node koordinatjakt/tester/lytting.js
```

`scene.js` går gjennom 300 brett per tema og svarer på alt om utleggingen:
entydig fasit, spredning, sammenhengende vei, soner som grenser til veien,
brikker innenfor ruta, og at samme brettnummer alltid gir samme brett.

`svar.js` svarer for matchingen, og har krav fra begge sider — en liste
skrivemåter som *må* godtas, og en med svar som *ikke* får gå gjennom. Den
delen ryker stille begge veier: for streng, og arket måler rettskriving; for
slapp, og fasiten er meningsløs.

`skriving.js` trenger playwright og svarer for hva feltet gjør med svaret —
at et eksakt svar låser seg selv, at en skrivefeil ikke låser seg halvveis, at
hjelpen skriver inn ordet og ikke det som sto der fra før, og at tolv løste
oppgaver overlever en omlasting.

`lytting.js` trenger playwright og **stubber gjenkjenneren**, som den skal:
skyøkta har ingen lydinngang, og `--use-fake-device-for-media-capture` hjelper
ikke — samme lærdom som innspillingsprøven i Monstergiret. Den svarer for alt
som ligger mellom gjenkjenneren og barnet: at mikrofonen settes opp for ett ord
og ikke for en strøm, at et treff skriver inn fasiten, og framfor alt at et bom
fra mikrofonen aldri behandles som et galt svar.

## Nye brikker og temaer

En ny brikke er et navn i `Brikker.ALLE` med et `ord` og en `tegn()` som
holder seg innenfor 0–100. Legg den så inn i et tema, i én av tre lister:

- `soner[n].brikker` — hører hjemme inne i en innhegning, en åker, et kvartal.
- `langsvei` — må ha en veirute som nabo.
- `kulisser` — pynt, aldri et svar.

Ordet må være kort, konkret og entydig: «traktor», ikke «kjøretøy». Det er
det barnet skal skrive.

Alternative ord hører i `OGSAA` i `brikker.js`, med to regler: alternativet må
ikke kunne forveksles med et annet ord i banken («kiosk» duger ikke for
butikk, for kiosk er sitt eget svar i dyrehagen), og det må være et annet ord,
ikke en annen form — «løven» håndteres av endelsene i `svar.js`.
`tester/svar.js` sammenligner alle skrivemåter mot alle.
