# Sånn jobber vi

**Les `README.md` i denne mappa først.** Den forklarer hvorfor appen er som den
er, og hvilke feller som allerede er gått i. Dette dokumentet handler bare om
arbeidsmåten.

## Status

Fem av sju steg er ferdige:

1. ✅ Lesemotoren skilt ut med et rent API
2. ✅ Lagring, tre spillere, sikkerhetskopi
3. ✅ Tekstbanken — 20 tekster over fem emner, med et valideringsskript
4. ✅ Emnevelgeren, koblet til lesesløyfa og økonomien
5. ✅ Huset — rommet, figuren, levelbobla, boka på bordet
6. ⬜ **Butikken og møbelplasseringen** ← neste
7. ⬜ Navn og figurvalg ved første oppstart

`Spill.kjop/selg/flytt` finnes allerede og lagrer `{ting, pris, x, y}` i `eide`.
Det som mangler i steg 6 er en butikkskjerm og tegningen av møblene i rommet.
Grafikk: **Kenney-pakkene (CC0)**. RPG Makers grafikk er lisensiert kun til bruk
inne i RPG Maker og kan ikke brukes her.

I steg 7 må `prompt()` og `confirm()` i `js/spillere.js` byttes ut med
skikkelige felt i sida.

## GitHub er arbeidsstedet

Alt ligger i `vegardk-hub/ig-trekning`, i mappa `pwa-lesestjerna/`. Arbeidskopien
på denne PC-en er `C:\Vegard\Claude\ig-trekning`.

Grunnen til at vi jobber mot repoet og ikke mot løse filer, er verifiseringen:
alt som havner på `main` ligger live et minutt senere på
<https://vegardk-hub.github.io/ig-trekning/pwa-lesestjerna/>. Det er https, så
talegjenkjenningen virker der — appen kan altså prøves med ekte mikrofon i Edge,
på hvilken som helst maskin, uten å kjøre noe lokalt.

Det er verdt å ta på alvor: **kode som ser riktig ut er ikke verifisert kode.**
Den eneste feilen som virkelig har gjort vondt her — at ordene sluttet å bli
grønne — så helt riktig ut på skjermen og ble først oppdaget da noen leste høyt
for appen. Alt som rører matchingen eller lyttingen skal prøves med stemme før
det regnes som ferdig.

Vil du prøve før du pusher, går det lokalt også. `file://` virker ikke —
talegjenkjenning krever sikker kontekst:

```
python -m http.server 8340 --directory pwa-lesestjerna
```

og åpne <http://localhost:8340/> **i Edge**.

**Hent alltid ned før du pusher.** Flere jobber i dette repoet samtidig, og det
kommer arbeid inn fra økter du ikke ser. 21. august ble et push avvist fordi en
hel ny app hadde kommet til i mellomtiden. Konflikten kommer som regel i
`CLAUDE.md` og `README.md` i rota, der begge sider har lagt til sin egen app i
tabellen — behold begge, aldri velg én side.

Ferdig arbeid går **rett på `main`**, ikke på en gren i påvente av gjennomgang.
En gren som ikke er slått sammen, er en endring som ikke kan prøves. Ingen pull
request med mindre det blir bedt om.

Kjør `python sjekk_tekster.py` etter endringer i `data/tekster.json`.

## I et Claude-prosjekt

Koble repoet til prosjektet i stedet for å laste opp filene: **opplastede filer
blir foreldet i samme øyeblikk som noen commiter**, og en Claude som resonnerer
om gammel kode gir råd som ikke passer.

Merk at Claude i et prosjekt ikke kan kjøre appen, ikke åpne Edge og ikke høre
en mikrofon. Den kan skrive koden, men den siste prøven må et menneske ta.

## Reglene som ikke skal forhandles bort

De gjelder alle barneappene i dette repoet, og de er ikke stilvalg:

- **Ingen klokke. Ingen måte å tape på. Alt kan gjøres om igjen.**
- **Hjelp koster aldri noe.** Et ord han trykte seg forbi gir ingen mynt, men
  det er *ingen bonus*, ikke en straff. Forskjellen betyr alt for en åtteåring.
- **Aldri trekk mynter, aldri senk level.** Ingen rekke som kan brytes — en
  brutt rekke er en måte å tape på.
- **Ingen avhengigheter.** Vanilla JS, CSS og HTML. Ingen bundler, ingen
  byggesteg, ingen bibliotek uten at det er bedt om.
- **Norsk** i grensesnitt, kommentarer og domenebegreper. Kommentarer forklarer
  *hvorfor*, ikke hva.

## Til slutt

Appen er laget til ett bestemt barn, ikke til et marked. Går du i tvil om et
valg, er spørsmålet ikke «hva er best praksis» men «hva gjør at han leser en
tekst til». Det er derfor huset ligger først i sløyfa, og det er derfor det ikke
finnes rødt noe sted i denne appen.
