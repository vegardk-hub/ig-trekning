'use strict';

/* Oppdragsbanken. Hvert oppdrag er én setning som skal kunne leses høyt, av en
   voksen eller av maskinstemmen, uten å måtte forklares etterpå.

   `sted` er 'her' for det som gjøres der barnet står, og 'rom' for det som
   sender barnet av gårde i huset.

   `alder` er laveste alder oppdraget passer for. Femåringen får alt som står
   med 5, åtteåringen får alt. Skillet er ikke «lett» og «vanskelig» – det er
   ting som krever lesing, staving eller å telle baklengs, som femåringen bare
   ville blitt stående og lurt på. Ingenting i grensesnittet sier at den ene
   har flere oppdrag enn den andre; de sammenligner, akkurat som i Poengtavla.

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

  var OPPDRAG = [
    /* --- der du står --- */
    { id: 'snoengel', sted: 'her', alder: 5, tekst: 'Legg deg på gulvet og lag en snøengel.' },
    { id: 'baklengs', sted: 'her', alder: 5, tekst: 'Gå fem skritt baklengs, snu deg rundt, og gå fem skritt tilbake.' },
    { id: 'tell-ti', sted: 'her', alder: 5, tekst: 'Sett deg på rumpa og tell rolig til ti.' },
    { id: 'froskehopp', sted: 'her', alder: 5, tekst: 'Hopp som en frosk {tall} ganger.' },
    { id: 'ett-bein', sted: 'her', alder: 5, tekst: 'Stå på ett bein så lenge du klarer, mens noen teller.' },
    { id: 'gaa-som-dyr', sted: 'her', alder: 5, tekst: 'Gå som en {dyr} tvers over rommet og tilbake igjen.' },
    { id: 'grimase', sted: 'her', alder: 5, tekst: 'Lag den rareste grimasen du kan, og hold den mens noen teller til fem.' },
    { id: 'snurr', sted: 'her', alder: 5, tekst: 'Snurr rundt tre ganger, og prøv å stå helt stille etterpå.' },
    { id: 'klapp', sted: 'her', alder: 5, tekst: 'Klapp {tall} ganger over hodet, og {tall} ganger bak ryggen.' },
    { id: 'sykle', sted: 'her', alder: 5, tekst: 'Legg deg på ryggen og sykle i lufta mens du teller til tjue.' },
    { id: 'robotstemme', sted: 'her', alder: 5, tekst: 'Snakk som en robot helt til neste oppdrag.' },
    { id: 'sakte-sang', sted: 'her', alder: 5, tekst: 'Syng en sang du kan, men syng den så sakte du klarer.' },
    { id: 'pute-paa-hodet', sted: 'her', alder: 5, tekst: 'Balanser en pute på hodet og gå tre skritt uten at den faller.' },
    { id: 'liten-stor', sted: 'her', alder: 5, tekst: 'Gjør deg så liten du kan, og så så stor du kan. Gjenta tre ganger.' },
    { id: 'veggpress', sted: 'her', alder: 5, tekst: 'Ta {tall} armhevinger mot veggen.' },
    { id: 'usynlig-is', sted: 'her', alder: 5, tekst: 'Lat som du spiser en usynlig is som smelter altfor fort.' },
    { id: 'lydlos', sted: 'her', alder: 5, tekst: 'Gå på tå bort til nærmeste dør og tilbake, helt lydløst.' },

    /* --- ut i huset --- */
    { id: 'hent-farge', sted: 'rom', alder: 5, tekst: 'Gå til {rom} og hent noe som er {farge}. Legg det tilbake etterpå.' },
    { id: 'lop-og-hopp', sted: 'rom', alder: 5, tekst: 'Gå til {rom}, hopp tre ganger på stedet, og kom tilbake.' },
    { id: 'tannborster', sted: 'rom', alder: 5, tekst: 'Gå til badet og tell tannbørstene. Kom tilbake og si tallet.' },
    { id: 'glass-vann', sted: 'rom', alder: 5, tekst: 'Gå til kjøkkenet og hent deg et glass vann.' },
    { id: 'tell-dorer', sted: 'rom', alder: 5, tekst: 'Gå til {rom} og tell hvor mange dører du går forbi på veien.' },
    { id: 'snik', sted: 'rom', alder: 5, tekst: 'Snik deg til {rom} og tilbake uten å lage en eneste lyd.' },
    { id: 'mykeste', sted: 'rom', alder: 5, tekst: 'Gå til soverommet ditt og hent det mykeste du finner.' },
    { id: 'som-dyr-til-rom', sted: 'rom', alder: 5, tekst: 'Gå som en {dyr} helt til {rom}, og som deg selv tilbake.' },
    { id: 'noe-rundt', sted: 'rom', alder: 5, tekst: 'Gå til {rom} og finn noe som er rundt. Kom tilbake og vis det.' },
    { id: 'sko', sted: 'rom', alder: 5, tekst: 'Gå til gangen og tell skoene som står der. Kom tilbake og si tallet.' },
    { id: 'hvisk', sted: 'rom', alder: 5, tekst: 'Gå til {rom}, hvisk «god dag» til veggen, og kom tilbake.' },
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

  /* Navnet foran setningen, slik en voksen ville sagt det: «Live, gå til
     badet …». Første bokstav må ned i det små, ellers står det «Live, Gå».
     Uten navn står setningen som den er – navnefeltet kan stå tomt. */
  function medNavn(navn, setning) {
    if (!navn) return setning;
    return navn + ', ' + setning.charAt(0).toLowerCase() + setning.slice(1);
  }

  return {
    alle: OPPDRAG,
    ROM: ROM,
    fyllUt: fyllUt,
    medNavn: medNavn
  };
})();
