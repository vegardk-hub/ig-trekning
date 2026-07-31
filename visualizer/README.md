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

## Sju visualiseringer

| # | Modus | Beskrivelse |
|---|-------|-------------|
| 1 | Søyler | Klassisk spektrum med speilbilde og topplokk som faller sakte |
| 2 | Bølge | Oscilloskop i tre lag med spektrumsokkel |
| 3 | Sirkel | Symmetrisk spektrum rundt en bølgering som pulserer med bassen |
| 4 | Partikler | Partikler skytes ut fra sentrum på hvert taktslag |
| 5 | Spektrogram | Rullende fossefall — ca. seks sekunder historikk over skjermen |
| 6 | Nebula | Myke, roterende former bygget av spekteret |
| 7 | Kaleidoskop | Tolv speilede segmenter av bølgeform og spektrum |

Åtte fargetema, valgfri regnbue-rotasjon, og «Auto» som bytter visualisering
hvert 20. sekund.

## Kontroller

| Tast | Handling |
|------|----------|
| `Mellomrom` | Spill / pause |
| `1`–`7` | Velg visualisering |
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

### Merknader

- Mikrofonen krever `https` eller `localhost`, og lyden spilles **ikke** ut i
  høyttalerne (for å unngå rundgang).
- Hvilke videoformater som virker avhenger av nettleseren. mp4 (H.264) virker i
  Chrome, Edge og Safari; webm virker overalt.
