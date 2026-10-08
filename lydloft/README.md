# Lydløft

Et lydverksted: ta opp eller last opp et opptak (3 sekunder til 4 minutter,
først og fremst instrumentalt – barna som spiller, eller lyd fra en høyttaler)
og lag nye versjoner av det. Til internt bruk.

Eieren vil *ikke* forbedre eksisterende sanger og ikke konkurrere med Suno.
Målet er å se hvor langt en enkel app kommer med ren signalbehandling i
nettleseren: ingen server, ingen KI, ingen avhengigheter.

To sider, som deler opptak og bibliotek (IndexedDB):

- **`index.html` – verkstedet.** Velg lyd, skru, hør, lagre.
- **`testbenk.html` – testbenken.** Måler hva telefon, nettleser og rom gjør
  med lyden. Den kom først, mens målet var å gjøre opptak *bedre*, og står
  igjen som verktøy for å se hva en mikrofon leverer.

Ingen service worker: siden trenger mikrofon og nett til første lasting, ikke
frakoblet modus. `?v=` i HTML-ene står der likevel, mot `max-age=600` fra
Pages, og nummeret står i HTML, i arbeiderne (`importScripts`) og i
`opptak.js` (`addModule`). Øk alle samtidig.

## Verkstedet

| Del | Hva | Hvor |
| --- | --- | --- |
| Karakter | 14 utgangspunkter: mer bass, gammel radio, telefon, kassett, vinyl, kirke, konsertsal, under vann, robot, romskip, gitarforsterker, 8-bit, fra naborommet | `effekter.js` |
| Tone | bass, mellomtone, diskant, lavkutt, toppkutt, volum | `effekter.js` |
| Tempo og tonehøyde | 50–200 % uten at tonen endres, ±12 halvtoner uten at tempoet endres, baklengs; ekorn, troll, sakte film, kjapp | `strekk.js` |
| Effekter | romklang og romstørrelse, ekko og ekkotid, forvrengning, chorus/vibrato, lo-fi, knitring, robot | `effekter.js` |
| Lagre | ny versjon i biblioteket med oppskriften, eller WAV, på −14 LUFS og maks −1 dBTP | `verksted.js` |

Tre ting som ser ut som detaljer og har en grunn:

- **Det du hører, er det som lagres.** Forhåndslyttingen og lagringen bygger
  samme kjede fra `effekter.js`, den ene i sanntid og den andre i en
  `OfflineAudioContext`. Lag aldri en egen eksportvei; da glir de fra
  hverandre, og den lagrede versjonen låter ikke som den du valgte.
- **Tempo og tonehøyde er tidsstrekking pluss avspillingsfart.** Strekk med
  p/t (WSOLA, `strekk.js`), spill med fart p, så blir tonehøyden p og tempoet
  t. Strekkingen regnes ut i en egen tråd og byttes inn på samme sted i
  stykket; posisjonen er en andel, ikke sekunder, så den står stille når
  lengden endres. Samme innstilling regnes ikke ut to ganger (`nokkel`).
- **En karakter starter fra null, men rører ikke tempoet.** Ellers blir
  «Kirke» etter «Telefon» en kirke i telefonen, og ekornet mister farten
  hver gang man bytter rom.

- **iOS kan holde igjen lydkonteksten.** Spiller en annen app musikk på
  samme iPhone mens opptaket går, tar iOS lyden fra Safari, og konteksten blir
  stående i Safaris egen tilstand `interrupted` – også etter at den andre
  appen er stille. `resume()` hjelper ikke da. Spill-knappen lager i stedet en
  ny kontekst inne i trykket (`LydOpptak.friskKontekst`), og effektkjeden og
  lydbufferne bygges på nytt i den. AudioWorklet-modulen hører også til
  konteksten og må lastes igjen. Første opptak på 12 sekunder virket, og ett
  på 50 med musikk fra telefonen ville ikke spille.

Kutt-filtrene er dobbelt opp (24 dB/oktav). Med ett andreordens filter er
telefon og radio for snille – det slipper gjennom for mye bass til å høres ut
som en liten høyttaler.

**Ikke laget ennå: rytme og takt.** Tempo er løst; å gjøre en firedelt takt om
til vals eller legge swing på krever at slagene finnes først og lyden klippes
opp etter dem. Det er neste store del.

# Testbenken

## Tre veier inn

| Vei | Hva det er | Hvorfor den er med |
| --- | --- | --- |
| Rå PCM (AudioWorklet) | Samplingene slik nettleseren leverer dem, som flyttall | Det beste en nettside kan få |
| MediaRecorder | Det nettleseren selv koder til – tapsfritt der det finnes (PCM i Chrome/Edge, ALAC i Safari), eller nettleserens standard | Viser hva en vanlig opptaksside ender med |
| Fil | Et opptak fra en annen app, typisk Taleopptak med *Tapsfri* | Går forbi Safari helt |

Nettleserens lydbehandling (ekkodemping, støydemping, automatisk nivå,
stemmeisolering) slås av som standard. Det nettleseren *faktisk* ga, leses
tilbake med `getSettings()` og står i rapporten – en begrensning er et ønske,
ikke en garanti. WebKit har en kjent feil der mikrofonen i Safari på iPhone
gir lavere rate og mono på musikk uansett hva siden ber om; det er hovedgrunnen
til at filveien finnes.

## Testsignalet

29,5 sekunder, definert i sekunder og hertz, ikke i samplinger – så PC-en kan
spille på 44,1 kHz mens iPhonen tar opp på 48:

| Tid (s) | Innhold | Måler |
| --- | --- | --- |
| 0–2 | stillhet | støygulv, brum på 50 Hz |
| 2–12 | logaritmisk sveip 20 Hz–20 kHz | frekvensrespons, grenser, etterklang, forvrengning |
| 12–15 | stillhet | etterklangen dør ut |
| 15–22 | 1 kHz i sju trinn à 6 dB | lineært nivå, eller AGC/limiter? Og stemmer samplingsraten? |
| 22,5–28,5 | rosa støy | demper noe vedvarende lyd? |

Sveipet er ankeret. Det finnes igjen med foldning mot et inverst filter
(Farina), og resten ligger på faste avstander fra det. Ingen klokker må
stemme, og opptaket kan startes når som helst før signalet.

Letingen skjer i to trinn: først grovt på en kopi nedsamplet åtte ganger,
så fint i full rate bare rundt sveipet. En foldning av et helt opptak i full
rate trenger hundrevis av megabyte – for mye for en iPhone. Opptak over 75
sekunder letes ikke gjennom.

## Hva som måles

**Alle opptak:** lydstyrke (BS.1770, LUFS), topp og sann topp, klipping,
støygulv (de 10 % stilleste rammene), likespenning, langtidsspektrum, hvor
høyt innholdet går, en bratt kant som tyder på en kodek, og om to kanaler
egentlig er mono.

**Opptak med testsignal i tillegg:** frekvensrespons for hele kjeden, nedre
og øvre −10 dB-grense, RT60, harmonisk forvrengning, nivåtrappen, rosa støy
mot det responsen spår, 1 kHz målt nøyaktig, brum og signal/støy.

Analysen kjører i en egen tråd (`analyse-arbeider.js`), så siden fryser ikke.

## Felle-liste

- **Det inverse filteret skal vektes med f, ikke 1/f.** Et logaritmisk sveip
  har mest energi per hertz i bassen. Feil vei gir en kurve som faller nøyaktig
  6 dB per oktav – lett å tro på, for telefoner *er* svake i bassen.
- **K-filterets konstanter hører til De Mans formel, ikke RBJ-hylla.** Med RBJ
  blir forsterkningen ved 1 kHz 0,44 dB i stedet for 0,69, og hver lydstyrke
  havner et kvart dB for lavt. Prøven med 1 kHz på −23 LUFS fanger det.
- **Spådommen for rosa støy må ta med energien under 20 Hz.** Hoppes den over,
  spår vi 1,6 dB for lite selv for en tapsfri kjede.
- **`decodeAudioData` omsampler til kontekstens rate.** WAV leses derfor selv,
  så en fil tatt opp i 44,1 kHz ikke ser ut som 48 i målingene. Andre formater
  går gjennom nettleseren, og det står i rapporten.
- **Slutten av sveipet ser ut som en kodek.** Sveipet stopper ved 20 kHz, og
  det gir en bratt kant i spekteret. Kodekfunnet vises ikke over 15 kHz når
  testsignalet er funnet.
- **Frekvensresponsen er hele kjeden.** Høyttaler, rom og mikrofon sammen. Én
  kurve alene sier lite; forskjellen mellom to opptak der bare én ting er
  byttet, sier mye. Derfor finnes sammenligningen.
- **En mikrofon kan lyve om samplingsraten.** Safari på iOS har en kjent feil
  der den leverer lavere rate enn den oppgir. Passer ikke sveipet på den
  oppgitte raten, prøves 44,1, 48, 24, 16 og 8 kHz, og treffet sier hva den
  egentlige raten er. Sveipet stoppes ved 0,45·fs når det regnes ut på en lav
  rate, ellers folder det seg ned igjen som speilbilde.
- **Et opptak som stopper før testsignalet, sier fra om det.** Første runde fra
  Safari stoppet ved 26,8 s, før den rosa støyen, og rapporten viste bare «–»
  der svaret skulle stått.
- **Digital stillhet er et funn.** −126 dBFS i pausene er ikke et stille rom,
  det er en støyport. Det var det første tegnet på at Safaris lydbehandling
  var på.
- **Lik lydstyrke ved lytting.** Det som er høyest, låter best. A/B spilles på
  −23 LUFS, aldri så høyt at toppene klipper.

## Prøver

```
node lydloft/tester/analyse.js
node lydloft/tester/strekk.js
NODE_PATH=/opt/node22/lib/node_modules node lydloft/tester/benk.js
NODE_PATH=/opt/node22/lib/node_modules node lydloft/tester/verksted.js
```

`strekk.js` krever at lengden blir riktig, at tonehøyden og nivået står, at
skjøtene ikke gir hakk og at slag verken forsvinner eller dobles.
`verksted.js` laster opp tre like sterke toner (100 Hz, 1 kHz, 8 kHz) og
måler den *lagrede* lyden for hver innstilling: bass løfter 100 Hz, telefon
kutter begge ender, sakte film forlenger uten å flytte 1 kHz, ekorn flytter
1 kHz sju halvtoner opp, og hver karakter gir gyldig lyd uten klipping.

`analyse.js` sender testsignalet gjennom en simulert telefon med kjent
lavkutt, diskantkutt, rom og støy, og skrur så på én feil om gangen –
kompressor, støydemper, brum, klipping, feil samplingsrate – og krever at
analysen sier fra om akkurat den. `benk.js` går hele veien i Chromium med en
stubbet mikrofon: rått opptak, MediaRecorder, filopplasting, sammenligning og
«spill og ta opp her». Den tar rundt ett minutt.

