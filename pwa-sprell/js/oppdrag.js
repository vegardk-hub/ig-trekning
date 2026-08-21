'use strict';

/* Oppdragsbanken. Hvert oppdrag er én setning som skal kunne leses høyt, av en
   voksen eller av maskinstemmen, uten å måtte forklares etterpå.
   `sted` er 'her' for det som gjøres der barnet står, og 'rom' for det som
   sender barnet av gårde i huset.

   Setningene kan ha luker – {rom}, {tall}, {dyr}, {farge}. Lukene er det som
   gjør at tretti oppdrag ikke blir tretti setninger: samme oppdrag kommer
   tilbake med nytt rom eller nytt dyr, og føles nytt. Tallene skrives med
   bokstaver, ikke siffer, fordi setningen skal leses opp – en stemme som får
   «5» kan finne på å si «fem» på engelsk. */
window.SprellOppdrag = (function () {

  /* Rommene er stedene i et vanlig hus. Har man ikke loft eller bod, er dette
     lista man stryker fra – ikke setningene. */
  var ROM = ['badet', 'soverommet ditt', 'kjøkkenet', 'stua', 'gangen', 'loftet'];
  var TALL = ['tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ti'];
  /* Bare hankjønnsord: setningene sier «som en …», og «som en egern» blir feil. */
  var DYR = ['krabbe', 'kenguru', 'elefant', 'slange', 'frosk', 'gorilla', 'and', 'kylling'];
  /* Intetkjønnsform: «noe som er rødt». */
  var FARGE = ['rødt', 'blått', 'grønt', 'gult', 'hvitt', 'svart'];

  var OPPDRAG = [
    /* --- der du står --- */
    { id: 'snoengel', sted: 'her', tekst: 'Legg deg på gulvet og lag en snøengel.' },
    { id: 'baklengs', sted: 'her', tekst: 'Gå fem skritt baklengs, snu deg rundt, og gå fem skritt tilbake.' },
    { id: 'tell-ti', sted: 'her', tekst: 'Sett deg på rumpa og tell rolig til ti.' },
    { id: 'froskehopp', sted: 'her', tekst: 'Hopp som en frosk {tall} ganger.' },
    { id: 'ett-bein', sted: 'her', tekst: 'Stå på ett bein så lenge du klarer, mens noen teller.' },
    { id: 'gaa-som-dyr', sted: 'her', tekst: 'Gå som en {dyr} tvers over rommet og tilbake igjen.' },
    { id: 'grimase', sted: 'her', tekst: 'Lag den rareste grimasen du kan, og hold den mens noen teller til fem.' },
    { id: 'snurr', sted: 'her', tekst: 'Snurr rundt tre ganger, og prøv å stå helt stille etterpå.' },
    { id: 'klapp', sted: 'her', tekst: 'Klapp {tall} ganger over hodet, og {tall} ganger bak ryggen.' },
    { id: 'sykle', sted: 'her', tekst: 'Legg deg på ryggen og sykle i lufta mens du teller til tjue.' },
    { id: 'statue', sted: 'her', tekst: 'Vær en statue til du har telt til femten inni deg.' },
    { id: 'robotstemme', sted: 'her', tekst: 'Snakk som en robot helt til neste oppdrag.' },
    { id: 'sakte-sang', sted: 'her', tekst: 'Syng en sang du kan, men syng den så sakte du klarer.' },
    { id: 'pute-paa-hodet', sted: 'her', tekst: 'Balanser en pute på hodet og gå tre skritt uten at den faller.' },
    { id: 'liten-stor', sted: 'her', tekst: 'Gjør deg så liten du kan, og så så stor du kan. Gjenta tre ganger.' },
    { id: 'veggpress', sted: 'her', tekst: 'Ta {tall} armhevinger mot veggen.' },
    { id: 'usynlig-is', sted: 'her', tekst: 'Lat som du spiser en usynlig is som smelter altfor fort.' },
    { id: 'lydlos', sted: 'her', tekst: 'Gå på tå bort til nærmeste dør og tilbake, helt lydløst.' },

    /* --- ut i huset --- */
    { id: 'hent-farge', sted: 'rom', tekst: 'Gå til {rom} og hent noe som er {farge}. Legg det tilbake etterpå.' },
    { id: 'lop-og-hopp', sted: 'rom', tekst: 'Gå til {rom}, hopp tre ganger på stedet, og kom tilbake.' },
    { id: 'tannborster', sted: 'rom', tekst: 'Gå til badet og tell tannbørstene. Kom tilbake og si tallet.' },
    { id: 'glass-vann', sted: 'rom', tekst: 'Gå til kjøkkenet og hent deg et glass vann.' },
    { id: 'tell-dorer', sted: 'rom', tekst: 'Gå til {rom} og tell hvor mange dører du går forbi på veien.' },
    { id: 'snik', sted: 'rom', tekst: 'Snik deg til {rom} og tilbake uten å lage en eneste lyd.' },
    { id: 'mykeste', sted: 'rom', tekst: 'Gå til soverommet ditt og hent det mykeste du finner.' },
    { id: 'som-dyr-til-rom', sted: 'rom', tekst: 'Gå som en {dyr} helt til {rom}, og som deg selv tilbake.' },
    { id: 'noe-rundt', sted: 'rom', tekst: 'Gå til {rom} og finn noe som er rundt. Kom tilbake og vis det.' },
    { id: 'sko', sted: 'rom', tekst: 'Gå til gangen og tell skoene som står der. Kom tilbake og si tallet.' },
    { id: 'hvisk', sted: 'rom', tekst: 'Gå til {rom}, hvisk «god dag» til veggen, og kom tilbake.' },
    { id: 'lukt', sted: 'rom', tekst: 'Gå til kjøkkenet og lukt på tre ting. Kom tilbake og fortell hva som luktet best.' }
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
    alle: OPPDRAG,
    ROM: ROM,
    fyllUt: fyllUt
  };
})();
