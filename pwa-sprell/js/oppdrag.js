'use strict';

/* Oppdragsbanken. Hvert oppdrag er én setning som skal kunne leses høyt, av en
   voksen eller av maskinstemmen, uten å måtte forklares etterpå.

   Hver setning starter med verbet – «Gå til soverommet ditt og hent det mykeste
   du finner». Det er en beskjed, og handlingen skal komme først, både for den
   som leser den høyt og for den som hører maskinstemmen. Appen kjenner ikke
   noe navn og skal ikke gjøre det: den snakker til den som står foran den.

   Det finnes fire banker: inne, hagen, rampestrekene og morgenen før
   barnehagen. Stedet velges i innstillingene, de to modusene av hver sin knapp
   over oppdraget. Morgenbanken er den eneste som ikke trekkes tilfeldig – den
   går i rekkefølge, og har derfor verken `sted` eller luker.

   `sted` er 'her' for det som gjøres der barnet står, og 'rom' for det som
   sender barnet av gårde – i huset eller rundt i hagen.

   `ikon` er emojien som står over setningen. Den er ikke pynt: den som ikke
   kan lese ennå, ser hva oppdraget handler om før noen har lest det høyt.

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

  var INNE = [
    /* --- der du står --- */
    { id: 'snoengel', ikon: '❄️', sted: 'her', alder: 3, tekst: 'Legg deg på gulvet og lag en snøengel.' },
    { id: 'tell-ti', ikon: '🔟', sted: 'her', alder: 3, tekst: 'Sett deg på rumpa og tell rolig til ti.' },
    { id: 'froskehopp', ikon: '🐸', sted: 'her', alder: 3, tekst: 'Hopp som en frosk {tall} ganger.' },
    { id: 'ett-bein', ikon: '🦩', sted: 'her', alder: 3, tekst: 'Stå på ett bein så lenge du klarer, mens noen teller.' },
    { id: 'gaa-som-dyr', ikon: '🐾', sted: 'her', alder: 3, tekst: 'Gå som en {dyr} tvers over rommet og tilbake igjen.' },
    { id: 'grimase', ikon: '😜', sted: 'her', alder: 3, tekst: 'Lag den rareste grimasen du kan, og hold den mens noen teller til fem.' },
    { id: 'snurr', ikon: '🌀', sted: 'her', alder: 3, tekst: 'Snurr rundt tre ganger, og prøv å stå helt stille etterpå.' },
    { id: 'sakte-sang', ikon: '🎵', sted: 'her', alder: 3, tekst: 'Syng en sang du kan, men syng den så sakte du klarer.' },
    { id: 'pute-paa-hodet', ikon: '🧢', sted: 'her', alder: 3, tekst: 'Balanser en pute på hodet og gå tre skritt uten at den faller.' },
    { id: 'liten-stor', ikon: '🙌', sted: 'her', alder: 3, tekst: 'Gjør deg så liten du kan, og så så stor du kan. Gjenta tre ganger.' },
    { id: 'usynlig-is', ikon: '🍦', sted: 'her', alder: 3, tekst: 'Lat som du spiser en usynlig is som smelter altfor fort.' },
    { id: 'lydlos', ikon: '🐾', sted: 'her', alder: 3, tekst: 'Gå på tå bort til nærmeste dør og tilbake, helt lydløst.' },
    { id: 'baklengs', ikon: '👣', sted: 'her', alder: 5, tekst: 'Gå fem skritt baklengs, snu deg rundt, og gå fem skritt tilbake.' },
    { id: 'klapp', ikon: '👏', sted: 'her', alder: 5, tekst: 'Klapp {tall} ganger over hodet, og {tall} ganger bak ryggen.' },
    { id: 'sykle', ikon: '🚲', sted: 'her', alder: 5, tekst: 'Legg deg på ryggen og sykle i lufta mens du teller til tjue.' },
    { id: 'robotstemme', ikon: '🤖', sted: 'her', alder: 5, tekst: 'Snakk som en robot helt til neste oppdrag.' },
    { id: 'veggpress', ikon: '💪', sted: 'her', alder: 5, tekst: 'Ta {tall} armhevinger mot veggen.' },

    /* --- ut i huset --- */
    { id: 'hent-farge', ikon: '🎨', sted: 'rom', alder: 3, tekst: 'Gå til {rom} og hent noe som er {farge}. Legg det tilbake etterpå.' },
    { id: 'lop-og-hopp', ikon: '🏃', sted: 'rom', alder: 3, tekst: 'Gå til {rom}, hopp tre ganger på stedet, og kom tilbake.' },
    { id: 'mykeste', ikon: '🧸', sted: 'rom', alder: 3, tekst: 'Gå til soverommet ditt og hent det mykeste du finner.' },
    { id: 'som-dyr-til-rom', ikon: '🦘', sted: 'rom', alder: 3, tekst: 'Gå som en {dyr} helt til {rom}, og som deg selv tilbake.' },
    { id: 'hvisk', ikon: '🗣️', sted: 'rom', alder: 3, tekst: 'Gå til {rom}, hvisk «god dag» til veggen, og kom tilbake.' },
    { id: 'tannborster', ikon: '🪥', sted: 'rom', alder: 5, tekst: 'Gå til badet og tell tannbørstene. Kom tilbake og si tallet.' },
    { id: 'glass-vann', ikon: '🥤', sted: 'rom', alder: 5, tekst: 'Gå til kjøkkenet og hent deg et glass vann.' },
    { id: 'tell-dorer', ikon: '🚪', sted: 'rom', alder: 5, tekst: 'Gå til {rom} og tell hvor mange dører du går forbi på veien.' },
    { id: 'snik', ikon: '🥷', sted: 'rom', alder: 5, tekst: 'Snik deg til {rom} og tilbake uten å lage en eneste lyd.' },
    { id: 'noe-rundt', ikon: '⚪', sted: 'rom', alder: 5, tekst: 'Gå til {rom} og finn noe som er rundt. Kom tilbake og vis det.' },
    { id: 'sko', ikon: '👟', sted: 'rom', alder: 5, tekst: 'Gå til gangen og tell skoene som står der. Kom tilbake og si tallet.' },
    { id: 'lukt', ikon: '👃', sted: 'rom', alder: 5, tekst: 'Gå til kjøkkenet og lukt på tre ting. Kom tilbake og fortell hva som luktet best.' },

    /* --- krever lesing, staving eller telling baklengs --- */
    { id: 'statue', ikon: '🗿', sted: 'her', alder: 8, tekst: 'Vær en statue til du har telt til femten inni deg.' },
    { id: 'tell-baklengs', ikon: '🔢', sted: 'her', alder: 8, tekst: 'Stå på ett bein og tell baklengs fra tjue til null.' },
    { id: 'stav-baklengs', ikon: '🔤', sted: 'her', alder: 8, tekst: 'Stav navnet ditt baklengs, høyt og tydelig.' },
    { id: 'ukedager', ikon: '📅', sted: 'her', alder: 8, tekst: 'Ta {tall} knebøy mens du sier alle ukedagene i riktig rekkefølge.' },
    { id: 'lukkede-oyne', ikon: '😌', sted: 'her', alder: 8, tekst: 'Balanser på ett bein med lukkede øyne, og tell til ti.' },
    { id: 'samme-bokstav', ikon: '🔠', sted: 'rom', alder: 8, tekst: 'Gå til {rom} og finn tre ting som begynner på samme bokstav som navnet ditt.' },
    { id: 'hent-bok', ikon: '📖', sted: 'rom', alder: 8, tekst: 'Gå til {rom} og hent en bok. Les den første setningen høyt.' }
  ];

  /* Hagen. Samme regler som inne – verbet først, tall med bokstaver – men
     oppdragene bruker det som faktisk finnes ute: stein, pinner, blader,
     skygger og lyder. Ingenting her krever verktøy, klatring eller vann, og
     ingenting forutsetter en bestemt hage: «det nærmeste treet» finnes også
     der det bare står ett. */
  var HAGE = [
    /* --- der du står --- */
    { id: 'h-hopp-over', sted: 'her', alder: 3, ikon: '🦘', tekst: 'Hopp over noe som ligger på bakken, tre ganger.' },
    { id: 'h-dans', sted: 'her', alder: 3, ikon: '💃', tekst: 'Lag den rareste dansen du kan, midt på plenen.' },
    { id: 'h-rop', sted: 'her', alder: 3, ikon: '📣', tekst: 'Rop så høyt du kan opp mot himmelen, én gang.' },
    { id: 'h-skygge', sted: 'her', alder: 5, ikon: '🌤️', tekst: 'Finn skyggen din, og prøv å hoppe over hodet på den.' },
    { id: 'h-lytt', sted: 'her', alder: 5, ikon: '👂', tekst: 'Stå helt stille og lytt. Kom og fortell hvor mange lyder du hørte.' },
    { id: 'h-maur', sted: 'her', alder: 5, ikon: '🐜', tekst: 'Finn en maur, og følg etter den så langt du klarer.' },
    { id: 'h-skyer', sted: 'her', alder: 5, ikon: '☁️', tekst: 'Legg deg i gresset og finn en sky som ligner på noe.' },
    { id: 'h-taarn', sted: 'her', alder: 8, ikon: '🏗️', tekst: 'Bygg det høyeste tårnet du klarer av det du finner ute.' },
    { id: 'h-vinden', sted: 'her', alder: 8, ikon: '🌬️', tekst: 'Finn ut hvilken vei vinden blåser, og si det høyt.' },

    { id: 'h-hopp-hoyt', sted: 'her', alder: 3, ikon: '⬆️', tekst: 'Hopp så høyt du klarer, tre ganger på rad.' },
    { id: 'h-snurr-gress', sted: 'her', alder: 3, ikon: '🌀', tekst: 'Snurr rundt fem ganger, og sett deg ned i gresset etterpå.' },
    { id: 'h-dyrelyd', sted: 'her', alder: 3, ikon: '🐄', tekst: 'Lag lyden til et dyr, så høyt du klarer.' },
    { id: 'h-strekk', sted: 'her', alder: 3, ikon: '🙆', tekst: 'Strekk deg så høyt du kan, og bøy deg så lavt du kan.' },
    { id: 'h-vaatt-gress', sted: 'her', alder: 3, ikon: '🌱', tekst: 'Kjenn på gresset, og si om det er vått eller tørt.' },
    { id: 'h-kaste-gress', sted: 'her', alder: 3, ikon: '🌾', tekst: 'Kast en håndfull gress opp i lufta, og se hvor det lander.' },
    { id: 'h-kaninhopp', sted: 'her', alder: 5, ikon: '🐇', tekst: 'Hopp som en kanin ti hopp på stedet.' },
    { id: 'h-fly', sted: 'her', alder: 5, ikon: '✈️', tekst: 'Stå på ett bein med armene ut som et fly, mens noen teller til ti.' },
    { id: 'h-fugl', sted: 'her', alder: 5, ikon: '🐦', tekst: 'Se etter en fugl, og fortell hva den gjorde.' },
    { id: 'h-sirkel-lufta', sted: 'her', alder: 5, ikon: '✍️', tekst: 'Tegn en kjempestor sirkel i lufta med armen.' },
    { id: 'h-himmelfarge', sted: 'her', alder: 5, ikon: '🌅', tekst: 'Se opp på himmelen, og si hvilken farge den har i dag.' },
    { id: 'h-stille-seksti', sted: 'her', alder: 8, ikon: '⏳', tekst: 'Stå helt stille og tell til seksti uten å le.' },
    { id: 'h-maal-skygge', sted: 'her', alder: 8, ikon: '📏', tekst: 'Mål skyggen din med skritt, og si hvor mange det ble.' },

    /* --- rundt i hagen --- */
    { id: 'h-blad', sted: 'rom', alder: 3, ikon: '🍃', tekst: 'Finn et blad som er større enn hånda di.' },
    { id: 'h-kongler', sted: 'rom', alder: 3, ikon: '🌰', tekst: 'Lag en haug av kongler, steiner eller pinner.' },
    { id: 'h-klem-tre', sted: 'rom', alder: 3, ikon: '🌳', tekst: 'Løp til det nærmeste treet og gi det en klem.' },
    { id: 'h-pinne', sted: 'rom', alder: 3, ikon: '🪵', tekst: 'Finn en pinne som er lengre enn armen din.' },
    { id: 'h-steiner', sted: 'rom', alder: 5, ikon: '🪨', tekst: 'Finn tre steiner og legg dem på rekke, fra minst til størst.' },
    { id: 'h-rundt-huset', sted: 'rom', alder: 5, ikon: '🏠', tekst: 'Gå en runde rundt huset, så fort du klarer.' },
    { id: 'h-blomster', sted: 'rom', alder: 5, ikon: '🌼', tekst: 'Tell blomstene du finner. Kom tilbake og si tallet.' },
    { id: 'h-baklengs', sted: 'rom', alder: 5, ikon: '👣', tekst: 'Gå baklengs fra det ene hjørnet av hagen til det andre.' },
    { id: 'h-hink', sted: 'rom', alder: 5, ikon: '🦩', tekst: 'Hink på ett bein bort til gjerdet og tilbake igjen.' },
    { id: 'h-tre-farger', sted: 'rom', alder: 5, ikon: '🎨', tekst: 'Finn noe grønt, noe brunt og noe gult. Kom tilbake og vis det.' },
    { id: 'h-ruest', sted: 'rom', alder: 8, ikon: '✋', tekst: 'Kjenn på tre ting ute, og si hvilken av dem som er ruest.' },
    { id: 'h-lukt-ute', sted: 'rom', alder: 3, ikon: '👃', tekst: 'Lukt på tre forskjellige ting ute, og si hva som luktet best.' },
    { id: 'h-mykt-hardt', sted: 'rom', alder: 3, ikon: '🧤', tekst: 'Finn noe mykt og noe hardt ute, og ta med begge tilbake.' },
    { id: 'h-under-over', sted: 'rom', alder: 3, ikon: '🐛', tekst: 'Krabb under noe, over noe, og rundt noe.' },
    { id: 'h-hils-plante', sted: 'rom', alder: 3, ikon: '🌷', tekst: 'Si «hei» til den største planten du finner.' },
    { id: 'h-rundt-noe-stort', sted: 'rom', alder: 3, ikon: '🔄', tekst: 'Løp en runde rundt noe som er større enn deg.' },
    { id: 'h-rundt-tre', sted: 'rom', alder: 5, ikon: '🏃', tekst: 'Løp tre runder rundt et tre.' },
    { id: 'h-minste-blad', sted: 'rom', alder: 5, ikon: '🍂', tekst: 'Finn det minste bladet du klarer å få øye på.' },
    { id: 'h-flat-stein', sted: 'rom', alder: 5, ikon: '🥌', tekst: 'Finn den flateste steinen du klarer, og legg den ved døra.' },
    { id: 'h-tell-skritt', sted: 'rom', alder: 5, ikon: '🔢', tekst: 'Tell hvor mange skritt det er fra døra til gjerdet.' },
    { id: 'h-gjemmested', sted: 'rom', alder: 5, ikon: '🫣', tekst: 'Finn et bra gjemmested, og vis det fram etterpå.' },
    { id: 'h-sol-og-skygge', sted: 'rom', alder: 5, ikon: '☀️', tekst: 'Finn et sted med sol og et sted med skygge, og stå litt på hvert av dem.' },
    { id: 'h-tungt-lett', sted: 'rom', alder: 5, ikon: '⚖️', tekst: 'Finn noe tungt og noe lett, og hold ett i hver hånd.' },
    { id: 'h-tell-vinduer', sted: 'rom', alder: 5, ikon: '🪟', tekst: 'Tell vinduene på huset. Kom tilbake og si tallet.' },
    { id: 'h-bokstav-pinner', sted: 'rom', alder: 8, ikon: '🔤', tekst: 'Legg pinner på bakken så de blir den første bokstaven i navnet ditt.' },
    { id: 'h-regnbue', sted: 'rom', alder: 8, ikon: '🌈', tekst: 'Samle fem ting ute med hver sin farge, og legg dem på en rad.' },
    { id: 'h-spindelvev', sted: 'rom', alder: 8, ikon: '🕸️', tekst: 'Se etter et spindelvev, og kom og fortell hvor du fant det.' },
    { id: 'h-kaldest', sted: 'rom', alder: 8, ikon: '❄️', tekst: 'Kjenn på tre ting ute, og si hvilken av dem som er kaldest.' }
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
    { id: 'r-sur-sokk', ikon: '🧦', sted: 'her', alder: 3, tekst: 'Kast en sur sokk på pappa, og løp din vei.' },
    { id: 'r-si-pappa', ikon: '📣', sted: 'her', alder: 3, tekst: 'Si «pappa» ti ganger på rad, helt til han svarer.' },
    { id: 'r-hund', ikon: '🐶', sted: 'her', alder: 3, tekst: 'Vær en hund som logrer rundt beina til en voksen.' },
    { id: 'r-teppe', ikon: '🛋️', sted: 'her', alder: 3, tekst: 'Gjem deg under et teppe og lat som du er en sofa.' },
    { id: 'r-herm', ikon: '🦜', sted: 'her', alder: 5, tekst: 'Herm etter alt pappa sier, helt til han oppdager det.' },
    { id: 'r-maten', ikon: '🍽️', sted: 'her', alder: 5, tekst: 'Rop «maten er klar!» selv om den slett ikke er det.' },
    { id: 'r-stirr', ikon: '👀', sted: 'her', alder: 5, tekst: 'Still deg helt stille bak pappa, og se på han til han snur seg.' },
    { id: 'r-hviskedag', ikon: '🤫', sted: 'her', alder: 5, tekst: 'Snakk bare med hviskestemme til noen spør hvorfor.' },
    { id: 'r-hemmelighet', ikon: '🤐', sted: 'her', alder: 5, tekst: 'Si at du har en hemmelighet, og ikke si hva den er.' },
    { id: 'r-bo', ikon: '👻', sted: 'rom', alder: 3, tekst: 'Snik deg inn bak mamma og si «bø».' },
    { id: 'r-toffel-snu', ikon: '🥿', sted: 'rom', alder: 3, tekst: 'Snu tøflene til en voksen så de peker feil vei.' },
    { id: 'r-kosedyr', ikon: '🧸', sted: 'rom', alder: 3, tekst: 'Legg et kosedyr under dyna i senga til mamma og pappa.' },
    { id: 'r-pappas-sko', ikon: '👞', sted: 'rom', alder: 3, tekst: 'Ta på deg pappas sko og gå en runde i huset.' },
    { id: 'r-kile', ikon: '🤣', sted: 'rom', alder: 3, tekst: 'Krabb under bordet og kile en voksen på foten.' },
    { id: 'r-sovner', ikon: '😴', sted: 'rom', alder: 3, tekst: 'Sett deg på fanget til en voksen og lat som du sovner med én gang.' },
    { id: 'r-klem', ikon: '🤗', sted: 'rom', alder: 3, tekst: 'Gi mamma en klem, og ikke slipp før hun sier «slipp».' },
    { id: 'r-gjem-sko', ikon: '🥾', sted: 'rom', alder: 5, tekst: 'Gjem en av pappas sko et sted han aldri ville lett. Husk hvor du la den.' },
    { id: 'r-bak-doren', ikon: '🚪', sted: 'rom', alder: 5, tekst: 'Gjem deg bak en dør, og si «hei» når noen går forbi.' },
    { id: 'r-bytt-toffel', ikon: '🩴', sted: 'rom', alder: 5, tekst: 'Bytt om tøflene til mamma og pappa.' },
    { id: 'r-fjernkontroll', ikon: '📺', sted: 'rom', alder: 5, tekst: 'Gjem fjernkontrollen under en pute, og si fra etterpå.' },
    { id: 'r-sokk-i-sko', ikon: '🧦', sted: 'rom', alder: 5, tekst: 'Legg en sokk ned i pappas sko.' },
    { id: 'r-rop-ingenting', ikon: '🔔', sted: 'rom', alder: 5, tekst: 'Rop på mamma fra et annet rom, og si «ingenting» når hun kommer.' },
    { id: 'r-opp-ned', ikon: '🙃', sted: 'rom', alder: 8, tekst: 'Snu en kopp eller et bilde opp ned, og se hvor lang tid det tar før noen oppdager det.' }
  ];


  /* Morgenen før barnehagen. Denne banken er ikke som de andre: den trekkes
     ikke, den går i rekkefølge. Sko før jakke gir ingen mening, og et barn som
     får stegene i tilfeldig orden, blir bare mer usikkert enn det var.

     Stegene er skrevet så de kan gjøres alene så langt det går – appen er en
     huskeliste barnet eier selv, ikke en beskjed fra en voksen. Ingenting her
     kan mislykkes: hopper man over et steg, går lista videre uten å si fra. */
  var MORGEN = [
    { id: 'm-opp', alder: 3, ikon: '🛏️', tekst: 'Stå opp av senga.' },
    { id: 'm-do', alder: 3, ikon: '🚽', tekst: 'Gå på do, og husk å vaske hendene.' },
    { id: 'm-pyjamas', alder: 3, ikon: '🌙', tekst: 'Ta av deg pyjamasen, og legg den på plass.' },
    { id: 'm-klaer', alder: 3, ikon: '👕', tekst: 'Ta på deg klærne.' },
    { id: 'm-frokost', alder: 3, ikon: '🥣', tekst: 'Spis frokosten din.' },
    { id: 'm-tenner', alder: 3, ikon: '🪥', tekst: 'Puss tennene, både oppe og nede.' },
    { id: 'm-ansikt', alder: 3, ikon: '🧼', tekst: 'Vask ansiktet og hendene.' },
    { id: 'm-haar', alder: 5, ikon: '💇', tekst: 'Gre håret ditt.' },
    { id: 'm-matboks', alder: 5, ikon: '🍱', tekst: 'Legg matboksen og drikkeflaska i sekken.' },
    { id: 'm-vaeret', alder: 5, ikon: '🌦️', tekst: 'Se ut av vinduet, og finn ut om du trenger regnjakke.' },
    { id: 'm-jakke', alder: 3, ikon: '🧥', tekst: 'Ta på deg jakka.' },
    { id: 'm-sko', alder: 3, ikon: '👟', tekst: 'Ta på deg skoene.' },
    { id: 'm-lue', alder: 3, ikon: '🧤', tekst: 'Ta på deg lue og votter hvis det er kaldt ute.' },
    { id: 'm-sekk', alder: 3, ikon: '🎒', tekst: 'Ta sekken på ryggen.' },
    { id: 'm-hadet', alder: 3, ikon: '👋', tekst: 'Si ha det til alle hjemme.' }
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

  /* Stedet velges i innstillingene: inne, i hagen, eller begge deler i samme
     kurv. Rampemodus har sin egen bank og bryr seg ikke om stedet. */
  function bank(sted) {
    if (sted === 'hage') return HAGE;
    if (sted === 'begge') return INNE.concat(HAGE);
    return INNE;
  }

  return {
    inne: INNE,
    hage: HAGE,
    rampe: RAMPE,
    morgen: MORGEN,
    bank: bank,
    ROM: ROM,
    fyllUt: fyllUt
  };
})();
