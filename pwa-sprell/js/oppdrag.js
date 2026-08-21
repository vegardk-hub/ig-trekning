'use strict';

/* Oppdragsbanken. Hvert oppdrag er én setning som skal kunne leses høyt, av en
   voksen eller av maskinstemmen, uten å måtte forklares etterpå.

   Hver setning starter med verbet – «Gå til soverommet ditt og hent det mykeste
   du finner». Det er en beskjed, og handlingen skal komme først, både for den
   som leser den høyt og for den som hører maskinstemmen. Appen kjenner ikke
   noe navn og skal ikke gjøre det: den snakker til den som står foran den.

   `sted` er 'her' for det som gjøres der barnet står, og 'rom' for det som
   sender barnet av gårde i huset.

   `alder` er laveste alder oppdraget passer for – 3, 5 eller 8. Skillet er ikke
   «lett» og «vanskelig», men hva som må kunne gjøres for at beskjeden i det
   hele tatt gir mening: telle, holde på to tall samtidig, lese, stave.
   Innstillingen går til 12, og fra 8 og opp er alt med.

   Setningene kan ha luker – {rom}, {tall}, {dyr}, {farge}. Lukene er det som
   gjør at oppdragene ikke blir like mange som setningene: samme oppdrag kommer
   tilbake med nytt rom eller nytt dyr, og føles nytt. Tallene skrives med
   bokstaver, ikke siffer, fordi setningen skal leses opp – en stemme som får
   «5» kan finne på å si «fem» på engelsk. */
window.SprellOppdrag = (function () {

  /* Rommene er stedene i huset. Har man ikke loft, er dette lista man stryker
     fra – ikke setningene. */
  var ROM = ['badet', 'soverommet ditt', 'kjøkkenet', 'stua', 'gangen', 'loftet'];
  var TALL = ['tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ti'];
  /* Bare hankjønnsord: setningene sier «som en …», og «som en egern» blir feil. */
  var DYR = ['krabbe', 'kenguru', 'elefant', 'slange', 'frosk', 'gorilla', 'and', 'kylling'];
  /* Intetkjønnsform: «noe som er rødt». */
  var FARGE = ['rødt', 'blått', 'grønt', 'gult', 'hvitt', 'svart'];

  var VANLIG = [
    /* --- der du står --- */
    { id: 'snoengel', sted: 'her', alder: 3, tekst: 'Legg deg på gulvet og lag en snøengel.' },
    { id: 'tell-ti', sted: 'her', alder: 3, tekst: 'Sett deg på rumpa og tell rolig til ti.' },
    { id: 'froskehopp', sted: 'her', alder: 3, tekst: 'Hopp som en frosk {tall} ganger.' },
    { id: 'ett-bein', sted: 'her', alder: 3, tekst: 'Stå på ett bein så lenge du klarer, mens noen teller.' },
    { id: 'gaa-som-dyr', sted: 'her', alder: 3, tekst: 'Gå som en {dyr} tvers over rommet og tilbake igjen.' },
    { id: 'grimase', sted: 'her', alder: 3, tekst: 'Lag den rareste grimasen du kan, og hold den mens noen teller til fem.' },
    { id: 'snurr', sted: 'her', alder: 3, tekst: 'Snurr rundt tre ganger, og prøv å stå helt stille etterpå.' },
    { id: 'sakte-sang', sted: 'her', alder: 3, tekst: 'Syng en sang du kan, men syng den så sakte du klarer.' },
    { id: 'pute-paa-hodet', sted: 'her', alder: 3, tekst: 'Balanser en pute på hodet og gå tre skritt uten at den faller.' },
    { id: 'liten-stor', sted: 'her', alder: 3, tekst: 'Gjør deg så liten du kan, og så så stor du kan. Gjenta tre ganger.' },
    { id: 'usynlig-is', sted: 'her', alder: 3, tekst: 'Lat som du spiser en usynlig is som smelter altfor fort.' },
    { id: 'lydlos', sted: 'her', alder: 3, tekst: 'Gå på tå bort til nærmeste dør og tilbake, helt lydløst.' },
    { id: 'baklengs', sted: 'her', alder: 5, tekst: 'Gå fem skritt baklengs, snu deg rundt, og gå fem skritt tilbake.' },
    { id: 'klapp', sted: 'her', alder: 5, tekst: 'Klapp {tall} ganger over hodet, og {tall} ganger bak ryggen.' },
    { id: 'sykle', sted: 'her', alder: 5, tekst: 'Legg deg på ryggen og sykle i lufta mens du teller til tjue.' },
    { id: 'robotstemme', sted: 'her', alder: 5, tekst: 'Snakk som en robot helt til neste oppdrag.' },
    { id: 'veggpress', sted: 'her', alder: 5, tekst: 'Ta {tall} armhevinger mot veggen.' },

    /* --- ut i huset --- */
    { id: 'hent-farge', sted: 'rom', alder: 3, tekst: 'Gå til {rom} og hent noe som er {farge}. Legg det tilbake etterpå.' },
    { id: 'lop-og-hopp', sted: 'rom', alder: 3, tekst: 'Gå til {rom}, hopp tre ganger på stedet, og kom tilbake.' },
    { id: 'mykeste', sted: 'rom', alder: 3, tekst: 'Gå til soverommet ditt og hent det mykeste du finner.' },
    { id: 'som-dyr-til-rom', sted: 'rom', alder: 3, tekst: 'Gå som en {dyr} helt til {rom}, og som deg selv tilbake.' },
    { id: 'hvisk', sted: 'rom', alder: 3, tekst: 'Gå til {rom}, hvisk «god dag» til veggen, og kom tilbake.' },
    { id: 'tannborster', sted: 'rom', alder: 5, tekst: 'Gå til badet og tell tannbørstene. Kom tilbake og si tallet.' },
    { id: 'glass-vann', sted: 'rom', alder: 5, tekst: 'Gå til kjøkkenet og hent deg et glass vann.' },
    { id: 'tell-dorer', sted: 'rom', alder: 5, tekst: 'Gå til {rom} og tell hvor mange dører du går forbi på veien.' },
    { id: 'snik', sted: 'rom', alder: 5, tekst: 'Snik deg til {rom} og tilbake uten å lage en eneste lyd.' },
    { id: 'noe-rundt', sted: 'rom', alder: 5, tekst: 'Gå til {rom} og finn noe som er rundt. Kom tilbake og vis det.' },
    { id: 'sko', sted: 'rom', alder: 5, tekst: 'Gå til gangen og tell skoene som står der. Kom tilbake og si tallet.' },
    { id: 'lukt', sted: 'rom', alder: 5, tekst: 'Gå til kjøkkenet og lukt på tre ting. Kom tilbake og fortell hva som luktet best.' },

    /* --- krever lesing, staving eller telling baklengs --- */
    { id: 'statue', sted: 'her', alder: 8, tekst: 'Vær en statue til du har telt til femten inni deg.' },
    { id: 'tell-baklengs', sted: 'her', alder: 8, tekst: 'Stå på ett bein og tell baklengs fra tjue til null.' },
    { id: 'stav-baklengs', sted: 'her', alder: 8, tekst: 'Stav navnet ditt baklengs, høyt og tydelig.' },
    { id: 'ukedager', sted: 'her', alder: 8, tekst: 'Ta {tall} knebøy mens du sier alle ukedagene i riktig rekkefølge.' },
    { id: 'lukkede-oyne', sted: 'her', alder: 8, tekst: 'Balanser på ett bein med lukkede øyne, og tell til ti.' },
    { id: 'samme-bokstav', sted: 'rom', alder: 8, tekst: 'Gå til {rom} og finn tre ting som begynner på samme bokstav som navnet ditt.' },
    { id: 'hent-bok', sted: 'rom', alder: 8, tekst: 'Gå til {rom} og hent en bok. Les den første setningen høyt.' }
  ];

  /* Rampemodus. Alt her går ut på å tulle med de voksne, og det er en egen
     bank – ikke oppdrag som blandes inn i den vanlige. Tre regler holder den
     på riktig side av morsom:

     1. Alt skal kunne gjøres om igjen på ti sekunder. En sko som gjemmes, skal
        finnes igjen; derfor står «husk hvor du la den» i selve setningen.
     2. Ingenting som virkelig trengs – nøkler, briller, telefon, medisiner.
        En rampestrek som gjør en voksen sen til jobb, er ikke en rampestrek.
     3. Ingenting som gjør vondt, ødelegger noe, eller skremmer på ordentlig.

     «Mamma» og «pappa» står i tekstene fordi barnet skal kjenne igjen hvem det
     gjelder. Passer det ikke i huset, er det disse ordene som byttes. */
  var RAMPE = [
    { id: 'r-sur-sokk', sted: 'her', alder: 3, tekst: 'Kast en sur sokk på pappa, og løp din vei.' },
    { id: 'r-si-pappa', sted: 'her', alder: 3, tekst: 'Si «pappa» ti ganger på rad, helt til han svarer.' },
    { id: 'r-hund', sted: 'her', alder: 3, tekst: 'Vær en hund som logrer rundt beina til en voksen.' },
    { id: 'r-teppe', sted: 'her', alder: 3, tekst: 'Gjem deg under et teppe og lat som du er en sofa.' },
    { id: 'r-herm', sted: 'her', alder: 5, tekst: 'Herm etter alt pappa sier, helt til han oppdager det.' },
    { id: 'r-maten', sted: 'her', alder: 5, tekst: 'Rop «maten er klar!» selv om den slett ikke er det.' },
    { id: 'r-stirr', sted: 'her', alder: 5, tekst: 'Still deg helt stille bak pappa, og se på han til han snur seg.' },
    { id: 'r-hviskedag', sted: 'her', alder: 5, tekst: 'Snakk bare med hviskestemme til noen spør hvorfor.' },
    { id: 'r-hemmelighet', sted: 'her', alder: 5, tekst: 'Si at du har en hemmelighet, og ikke si hva den er.' },
    { id: 'r-bo', sted: 'rom', alder: 3, tekst: 'Snik deg inn bak mamma og si «bø».' },
    { id: 'r-toffel-snu', sted: 'rom', alder: 3, tekst: 'Snu tøflene til en voksen så de peker feil vei.' },
    { id: 'r-kosedyr', sted: 'rom', alder: 3, tekst: 'Legg et kosedyr under dyna i senga til mamma og pappa.' },
    { id: 'r-pappas-sko', sted: 'rom', alder: 3, tekst: 'Ta på deg pappas sko og gå en runde i huset.' },
    { id: 'r-kile', sted: 'rom', alder: 3, tekst: 'Krabb under bordet og kile en voksen på foten.' },
    { id: 'r-sovner', sted: 'rom', alder: 3, tekst: 'Sett deg på fanget til en voksen og lat som du sovner med én gang.' },
    { id: 'r-klem', sted: 'rom', alder: 3, tekst: 'Gi mamma en klem, og ikke slipp før hun sier «slipp».' },
    { id: 'r-gjem-sko', sted: 'rom', alder: 5, tekst: 'Gjem en av pappas sko et sted han aldri ville lett. Husk hvor du la den.' },
    { id: 'r-bak-doren', sted: 'rom', alder: 5, tekst: 'Gjem deg bak en dør, og si «hei» når noen går forbi.' },
    { id: 'r-bytt-toffel', sted: 'rom', alder: 5, tekst: 'Bytt om tøflene til mamma og pappa.' },
    { id: 'r-fjernkontroll', sted: 'rom', alder: 5, tekst: 'Gjem fjernkontrollen under en pute, og si fra etterpå.' },
    { id: 'r-sokk-i-sko', sted: 'rom', alder: 5, tekst: 'Legg en sokk ned i pappas sko.' },
    { id: 'r-rop-ingenting', sted: 'rom', alder: 5, tekst: 'Rop på mamma fra et annet rom, og si «ingenting» når hun kommer.' },
    { id: 'r-opp-ned', sted: 'rom', alder: 8, tekst: 'Snu en kopp eller et bilde opp ned, og se hvor lang tid det tar før noen oppdager det.' }
  ];

  function tilfeldig(liste) {
    return liste[Math.floor(Math.random() * liste.length)];
  }

  /* Hver luke trekkes for seg. To {tall} i samme setning skal kunne bli to
     forskjellige tall – «klapp fem ganger over hodet og tre ganger bak
     ryggen» er morsommere enn å høre samme tallet to ganger. */
  function fyllUt(tekst) {
    return tekst.replace(/\{(rom|tall|dyr|farge)\}/g, function (_, luke) {
      if (luke === 'rom') return tilfeldig(ROM);
      if (luke === 'tall') return tilfeldig(TALL);
      if (luke === 'dyr') return tilfeldig(DYR);
      return tilfeldig(FARGE);
    });
  }

  return {
    vanlige: VANLIG,
    rampe: RAMPE,
    ROM: ROM,
    fyllUt: fyllUt
  };
})();
