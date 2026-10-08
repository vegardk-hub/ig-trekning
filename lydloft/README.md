# Lydløft – testbenk

Første steg mot en app som tar opp et musikkstykke (3 sekunder til 4 minutter,
instrumentalt) og lager en versjon som låter bedre enn opptaket. Før noe kan
gjøres bedre, må vi vite hva som gikk tapt på veien. Testbenken måler nettopp
det: hva telefonen, nettleseren og rommet gjør med lyden.

Til internt bruk. Ingen service worker: siden trenger mikrofon og en fersk
analyse, ikke frakoblet modus. `?v=` i `index.html` står der likevel, mot
`max-age=600` fra Pages.

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
NODE_PATH=/opt/node22/lib/node_modules node lydloft/tester/benk.js
```

`analyse.js` sender testsignalet gjennom en simulert telefon med kjent
lavkutt, diskantkutt, rom og støy, og skrur så på én feil om gangen –
kompressor, støydemper, brum, klipping, feil samplingsrate – og krever at
analysen sier fra om akkurat den. `benk.js` går hele veien i Chromium med en
stubbet mikrofon: rått opptak, MediaRecorder, filopplasting, sammenligning og
«spill og ta opp her». Den tar rundt ett minutt.

## Videre

Nivå 1 (ren signalbehandling i nettleseren: kompensasjon for lavkuttet,
støyport, declip, EQ, kompresjon, −14 LUFS / −1 dBTP) bygges når testbenken
har målt ekte opptak fra iPhone og Edge. Det er tallene herfra som skal
bestemme hva kjeden gjør.
