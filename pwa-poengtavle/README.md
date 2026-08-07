# Ukens poengtavle

Digital utgave av papirtavla som hang på kjøleskapet: oppgave × ukedag, en pris
i kroner per oppgave, ukesum og et oppgjør til slutt. Appen fjerner
hoderegningen og husker historikken — den innfører ingen ny motivasjonsmekanikk.

## Premisset

Papirtavla fungerte allerede sosialt. Derfor er dette bevisst **ikke** med:
poengtrekk, bøter, konkurranse mellom søsknene, påminnelsesvarsler, streaks og
sparemål. Tomme ruter er bare tomme — de vises aldri som noe barnet har mislyktes
med. Tonen fra arket («hver innsats teller») er hele poenget.

## Rammer som ligger fast

- **Én felles iPad.** Ingen backend, ingen innlogging, ingen konto. Alt ligger i
  `localStorage`. Barnevelgeren *er* innloggingen.
- **Barnet krysser av selv, en voksen godkjenner.** Ingenting teller i saldoen
  før godkjenning. Det er godkjenningen som utløser smilefjeset — det er
  øyeblikket barnet får betalt for.
- **Kroner**, som på papiret. Ikke poeng, ikke en belønningsmeny.
- **Én avkrysning per oppgave per dag**, maks.
- Foreldremodus ligger bak en firesifret PIN som kan endres i innstillinger.

## Datamodell

Fire lister i `localStorage` under nøkkelen `poengtavle-v1`:

| Liste | Innhold |
| --- | --- |
| `children` | navn, emoji, farge |
| `tasks` | navn, emoji, pris, hvilke barn, hvilken uke, arkivert |
| `events` | barn + oppgave + dato + `pending`/`approved` + beløp |
| `payouts` | barn + dato + beløp + måte |

Ukesum, saldo og historikk er **utledet** av `events` — ingenting lagres
dobbelt. Det betyr at ukeskiftet ikke er en nullstilling: uken er bare et filter
på datoene, og ruter som ikke er godkjent blir liggende til noen tar stilling til
dem, uansett hvor gamle de er.

To ting som ser ut som detaljer og ikke er det:

- **Beløpet fryses ved godkjenning**, ikke ved avkrysning. Endrer du prisen på
  «vaske badet» i dag, endres ikke det som allerede er tjent.
- **Sletting arkiverer.** `archived: true` fjerner oppgaven fra tavla framover,
  men historikken og pengene står. Uten det ville en opprydding i oppgavelista
  kunne krympe barnets saldo, og det lar seg ikke forklare for en sjuåring.

Oppgaver med pris `null` vises som `?` — beløpet settes av den voksne ved
godkjenning. Det er «passe på eller leke med Live» fra arket, der forhandlingen
er en del av opplegget.

## Navn og blokkbokstaver

Navn lagres slik de skrives («Leke med Live»). Barnesidene roper dem ut med
`text-transform: uppercase` i CSS. Gjør man det motsatte — lagrer versaler og
gjør dem små igjen i foreldremodus — ryker egennavnene.

Sentence case i foreldremodus mot blokkbokstaver i barnemodus er også den
raskeste måten å se hvilken side av appen man står på.

## Sikkerhetskopi

Alt ligger bare på den ene iPaden. iOS lar ikke en nettside laste ned filer uten
et trykk, så kopien er manuell: en knapp i innstillinger laster ned hele
tilstanden som JSON, og foreldremodus maser med et varsel når det er over 30
dager siden sist. Varselet dukker først opp når det finnes mer enn fem
registrerte hendelser — ellers står det og maser på en tom app.

## Filer

Ingen avhengigheter, ingen byggesteg.

```
index.html            skall
styles.css            all styling
app.js                hele appen — tilstand, visninger, hendelser
manifest.webmanifest  PWA
sw.js                 offline-cache
```

`app.js` tegner alt på nytt fra tilstanden ved hver endring (`render()`), og
hendelser fanges med én delegert lytter på `document`. Med denne mengden data er
det raskt nok, og det fjerner hele klassen av feil der skjermen og tilstanden
sier forskjellige ting.

Endrer du filene som forhåndslagres, bump `CACHE`-navnet i `sw.js`.
