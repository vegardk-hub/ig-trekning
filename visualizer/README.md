# Lydspeil — musikkvisualisering

En visualiseringsapp for musikk som kjører rett i nettleseren. Alt ligger i
`index.html` — ingen installasjon, ingen byggesteg, ingen server. Filene dine
lastes aldri opp noe sted; all lyd behandles lokalt i nettleseren.

**Åpne appen:** dobbeltklikk `visualizer/index.html`, eller legg mappen på
GitHub Pages og gå til `.../visualizer/`.

## Hva den gjør

- **Lydfiler:** mp3, wav, flac, ogg, m4a, aac, opus
- **Videofiler:** mp4, webm, mov — lyden analyseres og bildet kan vises bak
  visualiseringen (justerbar gjennomsiktighet)
- **Mikrofon:** visualiser rommet rundt deg i sanntid
- **Spilleliste:** slipp inn flere filer, de spilles etter hverandre

## Åtte visualiseringer

| # | Modus | Beskrivelse |
|---|-------|-------------|
| 1 | Søyler | Klassisk spektrum med speilbilde og topplokk som faller sakte |
| 2 | Bølge | Oscilloskop i tre lag med spektrumsokkel |
| 3 | Sirkel | Symmetrisk spektrum rundt en bølgering som pulserer med bassen |
| 4 | Partikler | Partikler skytes ut fra sentrum på hvert taktslag |
| 5 | Spektrogram | Rullende fossefall — ca. seks sekunder historikk over skjermen |
| 6 | Nebula | Myke, roterende former bygget av spekteret |
| 7 | Kaleidoskop | Tolv speilede segmenter av bølgeform og spektrum |
| 8 | Vekst | Akkumulerende korall som bygges opp gjennom hele sangen |

Åtte fargetema, valgfri regnbue-rotasjon, og «Auto» som bytter visualisering
hvert 20. sekund.

## Kontroller

| Tast | Handling |
|------|----------|
| `Mellomrom` | Spill / pause |
| `1`–`8` | Velg visualisering |
| `←` / `→` | Spol 5 sekunder |
| `Shift` + `←` / `→` | Forrige / neste spor |
| `↑` / `↓` | Volum |
| `C` | Neste fargetema |
| `A` | Auto-bytte av visualisering |
| `F` | Fullskjerm |
| `H` | Skjul menyen (kom tilbake med `H` eller musen i bunnen) |
| `S` | Lagre bilde som PNG |
| `R` | Start/stopp opptak |
| `M` | Mikrofon av/på |

Skyvekontrollene styrer volum, følsomhet (hvor kraftig utslag lyden gir),
glatting (hvor mykt søylene beveger seg), etterslep (hvor lenge sporene henger
igjen) og hvor sterkt videobildet vises bak visualiseringen.

## Vekst — én sang, ett bilde

De sju første modusene er reaktive: de viser øyeblikket og glemmer det med én
gang. «Vekst» er det motsatte, og laget for å ta opp en hel sang.

En korall-aktig struktur vokser ut fra sentrum. Hvert frekvensbånd tilhører en
gren — bass er tykk og nær sentrum, diskant er tynn og strekker seg lengst ut —
og nye noder plantes der energien er. Kraftige taktslag setter en ring rundt
det hele, som lesbare «kapitler» i sangen. Samtidig krymper hele komposisjonen
i takt med hvor langt ut i sangen du er, slik at ny vekst alltid har plass og
det eldste pakkes tettere mot midten. Sluttbildet er dermed hele sangen i én
komposisjon, med begynnelsen i kjernen og slutten ytterst.

Progresjonen leses av mediet selv (`currentTime / duration`), ikke av en egen
teller. Det betyr at modusen oppfører seg likt uansett sanglengde, og at
spoling virker: spoler du bakover, fjernes vekst som ennå ikke har skjedd.
Strukturen nullstilles når du bytter spor — ikke når du bytter visualisering,
så du kan hoppe innom de andre modusene underveis uten å miste noe.

For mikrofon finnes ingen sanglengde å måle mot; da brukes `MIC_SPAN` som
«en hel sang».

### Justering

Alle konstantene ligger samlet i `GROWTH`-blokken øverst i `<script>`, ingen av
dem er gjentatt lenger nede. Det er ikke mulig å gjette riktige verdier på
forhånd — de avhenger av musikken. Start her:

| Konstant | Gjør hva | Prøv å endre hvis |
|----------|----------|-------------------|
| `SCALE_FALLOFF` | Hvor mye alt krymper gjennom sangen | Slutten blir trang, eller starten forsvinner i midten |
| `GROWTH_SPAN` | Hvor langt ut ny vekst legges | Ytterkanten når ikke ut i bildet |
| `SPAWN_THRESHOLD` | Energien som kreves for å plante | Bildet blir støyete (hev) eller tomt (senk) |
| `SPAWN_INTERVAL` | Sekunder mellom hvert planteforsøk | Tettheten er feil for sanglengden din |
| `BRANCHES` | Antall grener båndene fordeles på | Grenene henger ikke sammen (senk) |
| `MAX_NODES` | Hardt tak på antall noder | Ytelsen svikter, eller lange sanger mister starten |
| `BEAT_RING_GAP` | Sekunder mellom milepælsringer | Ringene dominerer bildet (hev) |

Ytterkanten ved sangslutt havner på
`BASE_RADIUS × (SEED_RADIUS + GROWTH_SPAN) / (1 + SCALE_FALLOFF)`
av skjermens korteste side — nyttig når du vil regne deg fram i stedet for å
prøve deg fram.

### Ytelse

`shadowBlur` er den dyre operasjonen, ikke antall bånd. Bare de nyeste
`GLOW_NODES` nodene får glød; resten tegnes flatt. Målt i software-rendering
(uten GPU, altså et konservativt gulv) er modusen ved fullt node-tak omtrent
dobbelt så rask som «Søyler», som allerede kjører fint — så taket på 3500
noder har god margin.

Når taket nås fjernes de eldste nodene. De er da allerede blektet ned mot
minimum av alders-blekingen, så de forsvinner ikke brått.

## Opptak

`⏺ Opptak` tar opp selve visualiseringen med lyd og laster ned en `.webm`-fil.
Filen kan legges rett inn i appen igjen, eller konverteres til mp4 med f.eks.
ffmpeg:

```
ffmpeg -i lydspeil-*.webm -c:v libx264 -c:a aac visualisering.mp4
```

## Teknisk

Web Audio API med en `AnalyserNode` på 4096 punkter. Spekteret deles i 96
logaritmiske bånd (28 Hz–16,5 kHz) slik at bassen ikke dominerer bildet, med
rask stigning og langsom fall per bånd. Taktdeteksjonen sammenligner
bassenergien mot et glidende gjennomsnitt over de siste ~48 bildene.
Tegningen skjer på ét `<canvas>` med devicePixelRatio-skalering, og
komposisjonen tar hensyn til høyden på kontrollpanelet.

De reaktive modusene tegnes oppå et bilde som tones ned hvert bilde, som gir
sporene. «Vekst» er unntatt det systemet (`persistent` i `MODES`) og tegner i
stedet hele strukturen på nytt fra en node-liste som aldri forfaller. Lerretet
tømmes fortsatt hvert bilde, fordi hele komposisjonen re-skaleres — men ingen
tilstand går tapt i den operasjonen, og det er node-listen, ikke pikslene, som
er sannheten.

### Merknader

- Mikrofonen krever `https` eller `localhost`, og lyden spilles **ikke** ut i
  høyttalerne (for å unngå rundgang).
- Hvilke videoformater som virker avhenger av nettleseren. mp4 (H.264) virker i
  Chrome, Edge og Safari; webm virker overalt.
