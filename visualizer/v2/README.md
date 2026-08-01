# Prisme — V2

Én visualisering, gjort så godt som mulig: en glasskule med ringer i bane,
foran en bevelet heksagonvegg. Alt tegnes av én fragment-shader i WebGL 2 —
fortsatt én fil, ingen byggesteg, ingen avhengigheter.

**Åpne:** `visualizer/v2/index.html`, eller `.../visualizer/v2/` på GitHub Pages.

## Hvorfor WebGL og ikke Canvas 2D som i V1

V1 tegner med Canvas 2D. Det er riktig verktøy for søyler, kurver og
partikler, men det kan ikke lage dette motivet: ekte lysbrytning finnes ikke i
2D-API-et, og en «glasskule» må da fakes med gradienter som ser flate ut.

Her beregnes i stedet hver piksel som en lysstråle:

- **Bakgrunnen** er ikke et bilde, men en funksjon. Heksagonmønsteret regnes ut
  fra posisjonen der strålen treffer veggen.
- **Fordi bakgrunnen er en funksjon, blir refraksjonen ekte.** Strålen brytes
  inn i glasset, går gjennom kula, brytes ut igjen — og så evalueres
  heksagonmønsteret langs den *brutte* retningen. Det er derfor mønsteret bak
  kula står forskjøvet og forstørret, uten at noe er tegnet to ganger.
- **Kromatisk splitt:** rød og blå ende brytes med litt ulik brytningsindeks,
  som gir den fargede kanten ekte glass har.
- **Ringene** er plan i hver sin rotasjon. En stråle krysser et plan i nøyaktig
  ett punkt, så forsiden og baksiden av ringen treffer hver sine piksler og
  sorteres mot kula uten at noe må sorteres i en liste.

## Bobler du kan sprekke

Klikk (eller trykk) på en av de små boblene som seiler rundt kula, så
sprekker den: et tynt skall utvider seg og toner ut, og telleren oppe i
høyre hjørne går opp. Boblen kommer tilbake et nytt sted etter noen
sekunder, så det er alltid noe å sikte på.

Når pekeren er nær en boble, tegnes en ring rundt den som viser nøyaktig
hvor stort området er som treffer, og musepekeren blir en peker. Uten den
ringen er de minste boblene bare noen få piksler brede, og man aner ikke
om man bommet eller om funksjonen er i stykker.

Dette krevde en endring under panseret. Boblene lå opprinnelig bare i
shaderen, regnet ut fra en hash-funksjon — de fantes ikke på CPU-siden, og
det man ikke vet hvor er, kan man heller ikke klikke på. Nå eier JavaScript
boblene, og posisjonene lastes opp som en uniform-array hver frame.

Treffprøvingen skjer i skjermpiksler, ikke som en stråle i 3D: boblen
projiseres til skjermen med nøyaktig samme kamera som shaderen bruker, og
den nærmeste innenfor treffflaten vinner. Det er avstanden på skjermen man
faktisk sikter etter, og det gjør at treffflaten kan ha et gulv målt i
piksler. Kameraverdiene
(`CAM_Z`, `ZOOM`) er uniformer og ikke `#define` nettopp for at JS og
shaderen skal dele ett sett tall, og antallet bobler skytes inn i shaderen
ved kompilering, slik at CPU-listen og GPU-arrayen ikke kan komme i utakt.

Telleren er et vanlig HTML-element over lerretet. Den er derfor **ikke** med
i 4K-stillbildene eller i opptakene — de fanger bare selve lerretet. Det er
med vilje for stillbildene, som da blir rene bakgrunnsbilder.

## Lyd

Samme analyse som i V1: Web Audio med 4096 punkters FFT, delt i 128
logaritmiske bånd fra 30 Hz til 16 kHz. Båndene lastes opp som en 128×1
tekstur hver frame, slik at shaderen kan slå opp spekteret direkte.

| Lyd | Hva som skjer |
|-----|----------------|
| Spekteret | Leses rundt omkretsen av hver ring — ringene blir et sirkulært spektrum |
| Bass | Kula puster, og den indre gløden svulmer |
| Mellomtone | Væskevirvelen inne i glasset |
| Diskant | Radien på den midterste ringen |
| Taktslag | Ringbølge ut over heksagonveggen, kula slår til, boblene sparkes utover |

## Kontroller

| Tast | Handling |
|------|----------|
| `Mellomrom` | Spill / pause |
| `←` / `→` | Spol 5 sekunder · med `Shift`: bytt spor |
| `C` | Neste fargetema |
| `F` | Fullskjerm |
| `S` | Lagre stillbilde |
| `R` | Start/stopp opptak |
| `M` | Mikrofon |
| `D` | Vis bildefrekvens og oppløsning |
| Klikk | Sprekk en boble |

Menyen trekker seg unna når musen står stille, og kommer tilbake ved bevegelse.

## Stillbilde i full oppløsning

`📷 4K` rendrer én frame på nytt med 3840 piksler på lengste side — uavhengig
av vindusstørrelsen — og laster den ned som PNG. Siden motivet er en shader og
ikke et bilde, blir det skarpt i hvilken som helst oppløsning. I stående
vindu gir det bakgrunnsbilder til telefon rett ut av appen.

## Ytelse

Shaderen er fyllrate-bundet: kostnaden følger antall piksler, ikke innholdet i
musikken. Den dyre delen er `background()`, som kalles flere ganger per piksel
— én gang for selve veggen, to for den kromatiske refraksjonen, én for
speilingen i kula, og én for bobler. To optimaliseringer er allerede gjort: den
kromatiske splitten bruker to oppslag i stedet for tre, og ringtreffene regnes
én gang per piksel i stedet for to.

**Merk:** utviklingsmiljøet hadde ingen GPU, bare programvare-rasterisering, så
absolutte fps-tall derfra sier ingenting om ekte maskinvare og er ikke oppgitt
her. Det som *er* målt, er at bildet skalerer med pikselantallet — derfor er
oppløsningsvelgeren (Standard / Høy / Ultra) den effektive bremsen, og `D`
viser fps og faktisk oppløsning så du kan finne riktig nivå på din maskin.
Begynn på «Høy»; er den ikke jevn, gå ned til «Standard».

## Justering

Rammeverket for motivet ligger i `#define`-blokken øverst i fragment-shaderen:

| Konstant | Betydning |
|----------|-----------|
| `CAM_Z` | Kameraavstand. Større gir roligere perspektiv |
| `ZOOM` | Bildevinkel. Mindre verdi gjør kula større i bildet |
| `BG_Z` | Hvor langt bak kula heksagonveggen står |
| `HEX_SCALE` | Størrelsen på cellene |
| `RINGS` | Antall ringer |

Boblene styres fra `CFG` øverst i skriptet:

| Konstant | Betydning |
|----------|-----------|
| `BUBBLES` | Hvor mange bobler som er i lufta samtidig |
| `HIT_SCALE` | Hvor mye større treffflaten er enn boblens synlige størrelse |
| `HIT_MIN_PX` | Minste treffflate i skjermpiksler. Det er denne som gjør de minste boblene klikkbare |
| `POP_MS` | Hvor lenge sprekk-animasjonen varer |
| `RESPAWN_MIN` / `RESPAWN_MAX` | Hvor lenge det går før en sprukket boble kommer tilbake |

Ringenes vinkler, radier og bredder settes i `main()`. Vippen (`rotX`) er den
som betyr mest visuelt: små verdier gir avlange baner som går bak og foran
kula, mens verdier nær `1.57` gjør ringene til flate sirkler rett mot kamera.

Lydsiden justeres i `CFG` øverst i skriptet — `SENSITIVITY`, `SMOOTHING` og
terskelverdiene for taktdeteksjon.

## Merknader

- Krever WebGL 2. Appen sier fra i stedet for å vise et svart bilde hvis det
  mangler.
- Mikrofonen krever `https` eller `localhost`, og lyden spilles ikke ut i
  høyttalerne.
- Opptak lagres som `.webm` med bilde og lyd.
