# Kryss & Ring

Et puslespill på et brett med fem rader og ti kolonner. Ti brikker, fem ruter
i hver, femti ruter til sammen. Hver rute er merket med et **kryss** eller en
**ring**, og brettet er løst når alle femti er dekket og merkene veksler som et
sjakkbrett: et kryss rører aldri et kryss, en ring rører aldri en ring —
verken vannrett eller loddrett.

Spillet er en digital utgave av mekanikken i et fysisk puslespill. Formene er
lest av brikkene; oppgavene er våre egne, regnet ut her.

**Status: under arbeid.** Foreløpig finnes brikkesettet, løseren og en
kalibreringsside — `kalibrering.html`. Selve spillet kommer.

## Det som bærer alt annet

**Snuing bytter kryss og ring.** Dette er ikke en detalj, det er premisset.
Teller man merkene med forsiden opp, har settet 29 kryss og 21 ringer, mens
brettet trenger 25 av hver. Regnestykket går bare opp fordi baksiden er
motsatt, og fire eller fem brikker må ligge snudd i enhver løsning.

Konsekvensen for grensesnittet: **speiling og merking kan ikke velges hver for
seg.** De fire rotasjonene på forsiden har én merking, de fire på baksiden den
motsatte. En «snu»-knapp som bare speiler formen, gir et spill som ikke går
opp.

**Brettet har to farginger, og appen velger ikke.** Rute (0,0) kan ende som
kryss eller som ring. Begge gir 68 løsninger — de er speilbilder av hverandre.
Hvilken en oppgave bruker, avgjøres av brikkene som ligger der fra før. Et
tomt brett har derfor 136 løsninger, ikke 68, og et grensesnitt som tegner
påkrevde merker i tomme ruter før første brikke er lagt, halverer spillet uten
å si fra.

**Rotasjon og speiling bevarer paritet.** To naboruter har motsatt paritet før
og etter enhver vending. Derfor er merkene i en brikke alltid gitt av én bit,
`polaritet`, og merket i celle (r, k) er `(r + k + polaritet) % 2`. Men
polariteten gjelder bare koordinatene slik de står: en forskyvning på et odde
antall ruter snur den uten å røre et eneste merke. Den kan altså ikke brukes
til å svare på om en brikke ligger med forsiden opp — det spørsmålet har bare
et svar på brettet.

## Filer

| Fil | Svarer for |
| --- | --- |
| `js/brikker.js` | De ti brikkene, merkene, alle orienteringer, alle plasseringer |
| `js/loeser.js` | Eksakt dekning: om en stilling går opp, og hvordan |
| `js/tegning.js` | SVG: åttekantruta, halsen mellom naboruter, konturen, merkene |
| `kalibrering.html` | Sammenligner brikkesettet med det fysiske spillet |
| `tester/brikker.js` | Kravene til settet og løseren |

## Prøver

Trenger verken nettleser eller server. Kjøres etter hver endring i
`js/brikker.js` eller `js/loeser.js`:

```
node pwa-xoxo/tester/brikker.js
```

Den bruker rundt et sekund. Tallene den krever, er målt, ikke valgt:

- **68 løsninger per farging.** Endrer noen en form eller et merke, endres
  dette tallet, og hele oppgavebanken er ugyldig uten at noe annet sier fra.
- **Plasseringer per brikke** (40, 92, 92, 92, 96, 48, 96, 118, 96, 118).
  Fanger en form som er rettet én rute feil.
- **Like mange plasseringer i begge fargingene.** Det er den observerbare
  følgen av at baksiden finnes. Faller kravet, er enten en form eller en
  merking feil.

## Løseren

Søket fyller alltid den laveste tomme ruta. Det er det som gjør det raskt: i
stedet for å prøve hver brikke overalt, prøves bare de plasseringene som
dekker nettopp den ruta, og et hull ingen brikke kan nå, oppdages med en gang
i stedet for etter at ni brikker er lagt.

Flomfyllet er den andre halvparten: hver tom flekk må ha et antall ruter som
er delelig med fem. Uten den beskjæringen tar en full gjennomgang 5,4 sekunder
— med den, 0,4.

## Tegningen

Ruta er en åttekant, og mellom fire åttekanter står en liten firkant på
høykant. Det er avkortet firkantmønster, og det er slik brettet ser ut.

Konturen er en strek tegnet **under** fyllet, ikke rundt hver rute. Tegner man
hver åttekant med sin egen strek, får brikka sømmer tvers over seg selv; med
streken under og fyllet oppå blir bare yttergrensa mørk.

Merkefargen velges etter brikkefargens lysstyrke. En mørk X på `#2d5aa8`
forsvinner.
