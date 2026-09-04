# Koordinatjakt

Lager øvingsark der barnet finner ting i et rutenett og skriver ordet.
Bokstavene A–J står vannrett, tallene 1–10 loddrett med **1 øverst** — som på
et kart, ikke som i et koordinatsystem. Arket skrives ut; fasiten blir
stående på skjermen.

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
| `js/tegn.js` | Scenen som SVG. |
| `js/app.js` | Panelet, adressen og utskriften. |

`scene.js` er skilt fra `tegn.js` av samme grunn som fysikken i
Stuntgarasjen er skilt fra tegningen: spørsmålene som avgjør om et brett
duger, lar seg svare på uten nettleser.

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
```

De går gjennom 300 brett per tema og svarer på alt over: entydig fasit,
spredning, sammenhengende vei, soner som grenser til veien, brikker innenfor
ruta, og at samme brettnummer alltid gir samme brett.

## Nye brikker og temaer

En ny brikke er et navn i `Brikker.ALLE` med et `ord` og en `tegn()` som
holder seg innenfor 0–100. Legg den så inn i et tema, i én av tre lister:

- `soner[n].brikker` — hører hjemme inne i en innhegning, en åker, et kvartal.
- `langsvei` — må ha en veirute som nabo.
- `kulisser` — pynt, aldri et svar.

Ordet må være kort, konkret og entydig: «traktor», ikke «kjøretøy». Det er
det barnet skal skrive.
