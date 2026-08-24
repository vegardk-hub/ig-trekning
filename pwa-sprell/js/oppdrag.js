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

   Alt er skrevet for en femåring. Det er ingen aldersinnstilling: et oppdrag
   som må forklares, eller som krever lesing, staving eller store tall, hører
   ikke hjemme i banken i det hele tatt.

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
    { id: 'snoengel', ikon: '❄️', sted: 'her', tekst: 'Legg deg på gulvet og lag en snøengel.' },
    { id: 'tell-ti', ikon: '🔟', sted: 'her', tekst: 'Sett deg på rumpa og tell rolig til ti.' },
    { id: 'froskehopp', ikon: '🐸', sted: 'her', tekst: 'Hopp som en frosk {tall} ganger.' },
    { id: 'ett-bein', ikon: '🦩', sted: 'her', tekst: 'Stå på ett bein så lenge du klarer, mens noen teller.' },
    { id: 'gaa-som-dyr', ikon: '🐾', sted: 'her', tekst: 'Gå som en {dyr} tvers over rommet og tilbake igjen.' },
    { id: 'grimase', ikon: '😜', sted: 'her', tekst: 'Lag den rareste grimasen du kan, og hold den mens noen teller til fem.' },
    { id: 'snurr', ikon: '🌀', sted: 'her', tekst: 'Snurr rundt tre ganger, og prøv å stå helt stille etterpå.' },
    { id: 'sakte-sang', ikon: '🎵', sted: 'her', tekst: 'Syng en sang du kan, men syng den så sakte du klarer.' },
    { id: 'pute-paa-hodet', ikon: '🧢', sted: 'her', tekst: 'Balanser en pute på hodet og gå tre skritt uten at den faller.' },
    { id: 'liten-stor', ikon: '🙌', sted: 'her', tekst: 'Gjør deg så liten du kan, og så så stor du kan. Gjenta tre ganger.' },
    { id: 'usynlig-is', ikon: '🍦', sted: 'her', tekst: 'Lat som du spiser en usynlig is som smelter altfor fort.' },
    { id: 'lydlos', ikon: '🐾', sted: 'her', tekst: 'Gå på tå bort til nærmeste dør og tilbake, helt lydløst.' },
    { id: 'baklengs', ikon: '👣', sted: 'her', tekst: 'Gå fem skritt baklengs, snu deg rundt, og gå fem skritt tilbake.' },
    { id: 'klapp', ikon: '👏', sted: 'her', tekst: 'Klapp {tall} ganger over hodet, og {tall} ganger bak ryggen.' },
    { id: 'sykle', ikon: '🚲', sted: 'her', tekst: 'Legg deg på ryggen og sykle i lufta mens du teller til tjue.' },
    { id: 'robotstemme', ikon: '🤖', sted: 'her', tekst: 'Snakk som en robot helt til neste oppdrag.' },
    { id: 'veggpress', ikon: '💪', sted: 'her', tekst: 'Ta {tall} armhevinger mot veggen.' },

    { id: 'n-hopp-ettbein', sted: 'her', ikon: '🦵', tekst: 'Hopp {tall} ganger på ett bein.' },
    { id: 'n-hopp-langt', sted: 'her', ikon: '📏', tekst: 'Hopp så langt du klarer fra der du står.' },
    { id: 'n-hopp-klapp', sted: 'her', ikon: '🙌', tekst: 'Hopp opp og ned mens du klapper.' },
    { id: 'n-kenguru-vegg', sted: 'her', ikon: '🦘', tekst: 'Hopp som en kenguru bort til nærmeste vegg.' },
    { id: 'n-usynlig-strek', sted: 'her', ikon: '➰', tekst: 'Hopp over en usynlig strek {tall} ganger.' },
    { id: 'n-lop-paa-stedet', sted: 'her', ikon: '🏃', tekst: 'Løp på stedet så fort du klarer mens noen teller til ti.' },
    { id: 'n-robotgang', sted: 'her', ikon: '🤖', tekst: 'Gå som en robot tvers over rommet.' },
    { id: 'n-taa-ti', sted: 'her', ikon: '🩰', tekst: 'Gå på tå så høyt du klarer, ti skritt.' },
    { id: 'n-haeler', sted: 'her', ikon: '👞', tekst: 'Gå på hælene tilbake dit du kom fra.' },
    { id: 'n-slangekryp', sted: 'her', ikon: '🐍', tekst: 'Kryp som en slange bortover gulvet.' },
    { id: 'n-under-noe', sted: 'her', ikon: '🧎', tekst: 'Krabb på alle fire under noe.' },
    { id: 'n-rull', sted: 'her', ikon: '🎳', tekst: 'Rull rundt på gulvet én gang, som en stokk.' },
    { id: 'n-ettbein-tell', sted: 'her', ikon: '🦩', tekst: 'Stå på ett bein og tell til {tall}.' },
    { id: 'n-taa-balanse', sted: 'her', ikon: '🦶', tekst: 'Balanser på tå mens noen teller til fem.' },
    { id: 'n-strekk-fingre', sted: 'her', ikon: '🙆', tekst: 'Strekk armene så høyt du klarer, og rist på fingrene.' },
    { id: 'n-ta-taerne', sted: 'her', ikon: '🤸', tekst: 'Bøy deg ned og ta på tærne dine {tall} ganger.' },
    { id: 'n-huk-sprett', sted: 'her', ikon: '🐸', tekst: 'Sett deg på huk, og sprett opp så høyt du kan tre ganger.' },
    { id: 'n-snurr-armer', sted: 'her', ikon: '💫', tekst: 'Snurr rundt én gang, og stopp med armene rett ut.' },
    { id: 'n-rundt-stol', sted: 'her', ikon: '🪑', tekst: 'Gå baklengs rundt en stol.' },
    { id: 'n-blaa-tilbake', sted: 'her', ikon: '🔵', tekst: 'Løp bort til noe blått og tilbake igjen.' },
    { id: 'n-hink-dor', sted: 'her', ikon: '🚪', tekst: 'Hink på ett bein bort til nærmeste dør.' },
    { id: 'n-marsj', sted: 'her', ikon: '🥁', tekst: 'Marsjer på stedet som en soldat, ti skritt.' },
    { id: 'n-vill-dans', sted: 'her', ikon: '🕺', tekst: 'Dans så vilt du klarer til noen har telt til ti.' },
    { id: 'n-vaat-hund', sted: 'her', ikon: '🐕', tekst: 'Rist på hele kroppen som en våt hund.' },
    { id: 'n-tynn-bred', sted: 'her', ikon: '✏️', tekst: 'Gjør deg tynn som en blyant, og bred som en dør.' },
    { id: 'n-pute-hopp', sted: 'her', ikon: '🛋️', tekst: 'Legg en pute på gulvet, og hopp over den tre ganger.' },
    { id: 'n-snegle', sted: 'her', ikon: '🐌', tekst: 'Gå så sakte som en snegle bort til nærmeste dør.' },
    { id: 'n-armer-ut', sted: 'her', ikon: '🧍', tekst: 'Stå helt stille med armene rett ut mens noen teller til {tall}.' },
    { id: 'n-bro', sted: 'her', ikon: '🌉', tekst: 'Lag en bro med kroppen din, og hold den mens noen teller til fem.' },
    { id: 'n-fly-paa-magen', sted: 'her', ikon: '✈️', tekst: 'Legg deg på magen og løft armer og bein som et fly.' },
    { id: 'n-klapp-under-kne', sted: 'her', ikon: '👏', tekst: 'Sett deg på gulvet og klapp under knærne {tall} ganger.' },
    { id: 'n-krabbeskritt', sted: 'her', ikon: '🦀', tekst: 'Ta {tall} skritt til siden, som en krabbe.' },
    { id: 'n-flis-til-flis', sted: 'her', ikon: '🟫', tekst: 'Gå fra teppe til teppe uten å tråkke ved siden av.' },
    { id: 'n-bok-paa-hodet', sted: 'her', ikon: '📚', tekst: 'Gå fem skritt med en bok på hodet.' },
    { id: 'n-sokk-paa-fot', sted: 'her', ikon: '🧦', tekst: 'Balanser en sokk på foten din.' },
    { id: 'n-froskehopp-rom', sted: 'her', ikon: '🐾', tekst: 'Hopp som en {dyr} bort til nærmeste stol.' },
    { id: 'n-tramp-elefant', sted: 'her', ikon: '🐘', tekst: 'Tramp som en elefant bort til døra.' },
    { id: 'n-trippel-mus', sted: 'her', ikon: '🐭', tekst: 'Tripp som en mus tilbake igjen.' },
    { id: 'n-lava', sted: 'her', ikon: '🌋', tekst: 'Lek at gulvet er lava, og kom deg bort til døra.' },
    { id: 'n-stige', sted: 'her', ikon: '🪜', tekst: 'Lat som du klatrer opp en kjempelang stige.' },
    { id: 'n-svomme', sted: 'her', ikon: '🏊', tekst: 'Lat som du svømmer i en stor sjø.' },
    { id: 'n-rakett', sted: 'her', ikon: '🚀', tekst: 'Lat som du sitter i en rakett som skal ta av.' },
    { id: 'n-katt-vaakner', sted: 'her', ikon: '🐈', tekst: 'Lat som du er en katt som våkner og strekker seg.' },
    { id: 'n-sitron', sted: 'her', ikon: '🍋', tekst: 'Lat som du spiser den sureste sitronen i verden.' },
    { id: 'n-tungt', sted: 'her', ikon: '🏋️', tekst: 'Lat som du bærer noe kjempetungt over rommet.' },
    { id: 'n-maanen', sted: 'her', ikon: '🌕', tekst: 'Lat som du går på månen, sakte og lett.' },
    { id: 'n-tre-i-storm', sted: 'her', ikon: '🌬️', tekst: 'Lat som du er et tre i storm.' },
    { id: 'n-snork', sted: 'her', ikon: '😴', tekst: 'Lat som du sover, og snork så høyt du klarer.' },
    { id: 'n-kokk', sted: 'her', ikon: '🥞', tekst: 'Lat som du er en kokk som lager pannekaker.' },
    { id: 'n-love', sted: 'her', ikon: '🦁', tekst: 'Lat som du er en løve som våkner om morgenen.' },
    { id: 'n-motor', sted: 'her', ikon: '🚗', tekst: 'Lat som du er en bilmotor som starter.' },
    { id: 'n-isbjorn', sted: 'her', ikon: '🐻‍❄️', tekst: 'Lat som du er en isbjørn som går på isen.' },
    { id: 'n-fugleunge', sted: 'her', ikon: '🐤', tekst: 'Lat som du er en fugleunge som lærer å fly.' },
    { id: 'n-gammel-mann', sted: 'her', ikon: '👴', tekst: 'Lat som du er kjempegammel og går sakte over gulvet.' },
    { id: 'n-heks', sted: 'her', ikon: '🧙', tekst: 'Lat som du er en heks som rører i en stor gryte.' },
    { id: 'n-fisk', sted: 'her', ikon: '🐟', tekst: 'Lat som du er en fisk som svømmer rundt i rommet.' },
    { id: 'n-snomann', sted: 'her', ikon: '⛄', tekst: 'Lat som du er en snømann som smelter sakte.' },
    { id: 'n-trylle', sted: 'her', ikon: '✨', tekst: 'Lat som du tryller noe om til en frosk.' },
    { id: 'n-bamsedans', sted: 'her', ikon: '🧸', tekst: 'Lat som du er en bamse som danser.' },
    { id: 'n-dinosaur', sted: 'her', ikon: '🦕', tekst: 'Lat som du er en kjempestor dinosaur.' },
    { id: 'n-dyp-stemme', sted: 'her', ikon: '🎤', tekst: 'Syng en sang med kjempedyp stemme.' },
    { id: 'n-pipestemme', sted: 'her', ikon: '🐣', tekst: 'Syng en sang med pipestemme.' },
    { id: 'n-nynn', sted: 'her', ikon: '🎶', tekst: 'Nynn en sang, og se om noen gjetter hvilken.' },
    { id: 'n-tre-dyr', sted: 'her', ikon: '🐘', tekst: 'Si navnet på tre dyr så fort du klarer.' },
    { id: 'n-brannbil', sted: 'her', ikon: '🚒', tekst: 'Lag lyden av en brannbil.' },
    { id: 'n-tog', sted: 'her', ikon: '🚂', tekst: 'Lag lyden av et tog som kjører forbi.' },
    { id: 'n-regn-med-hender', sted: 'her', ikon: '🌧️', tekst: 'Lag lyden av regn med hendene dine.' },
    { id: 'n-klappetakt', sted: 'her', ikon: '👐', tekst: 'Klapp en takt, og la noen klappe den tilbake.' },
    { id: 'n-annen-stemme', sted: 'her', ikon: '🔢', tekst: 'Tell til ti med en helt annen stemme.' },
    { id: 'n-hemmelig-ord', sted: 'her', ikon: '🤫', tekst: 'Hvisk et hemmelig ord til noen.' },
    { id: 'n-rareste-lyd', sted: 'her', ikon: '😛', tekst: 'Lag den rareste lyden du klarer.' },
    { id: 'n-le-hoyt', sted: 'her', ikon: '😂', tekst: 'Le så høyt du klarer mens noen teller til fem.' },
    { id: 'n-rop-i-pute', sted: 'her', ikon: '🛏️', tekst: 'Rop navnet ditt inn i en pute.' },
    { id: 'n-gjett-dyret', sted: 'her', ikon: '🐮', tekst: 'Lag lyden til et dyr, og la noen gjette hvilket.' },
    { id: 'n-plystre', sted: 'her', ikon: '💨', tekst: 'Prøv å plystre tre ganger.' },
    { id: 'n-syng-med-dyrelyder', sted: 'her', ikon: '🐑', tekst: 'Syng en sang du kan, men bruk dyrelyder i stedet for ord.' },
    { id: 'n-lukk-tell', sted: 'her', ikon: '😌', tekst: 'Lukk øynene og tell rolig til femten.' },
    { id: 'n-kjenn-tre-ting', sted: 'her', ikon: '✋', tekst: 'Lukk øynene og kjenn på tre ting rundt deg.' },
    { id: 'n-pek-mot-dora', sted: 'her', ikon: '🚪', tekst: 'Lukk øynene og pek dit du tror døra er.' },
    { id: 'n-pust-dypt', sted: 'her', ikon: '🌬️', tekst: 'Pust dypt inn og ut tre ganger, helt rolig.' },
    { id: 'n-hjertet', sted: 'her', ikon: '💓', tekst: 'Legg hånda på brystet og kjenn hjertet banke.' },
    { id: 'n-lytt-ti', sted: 'her', ikon: '👂', tekst: 'Lytt i ti sekunder, og fortell hva du hørte.' },
    { id: 'n-kaldt-gulv', sted: 'her', ikon: '🦶', tekst: 'Kjenn på gulvet med foten. Er det kaldt eller varmt?' },
    { id: 'n-hender-over-orene', sted: 'her', ikon: '🎵', tekst: 'Legg hendene over ørene og syng en sang.' },
    { id: 'n-fem-farger', sted: 'her', ikon: '🌈', tekst: 'Se deg rundt og finn fem ting som er {farge}.' },
    { id: 'n-varm-hand', sted: 'her', ikon: '🔥', tekst: 'Gni hendene mot hverandre til de blir varme.' },
    { id: 'n-lett-som-fjaer', sted: 'her', ikon: '🪶', tekst: 'Gå så lett du klarer, som om du er en fjær.' },
    { id: 'n-kjenn-pusten', sted: 'her', ikon: '🫧', tekst: 'Legg hånda på magen og kjenn den gå opp og ned når du puster.' },
    { id: 'n-glad-ansikt', sted: 'her', ikon: '😄', tekst: 'Lag et ansikt som er kjempeglad.' },
    { id: 'n-trist-ansikt', sted: 'her', ikon: '😢', tekst: 'Lag et ansikt som er kjempetrist, og så le av det.' },
    { id: 'n-sint-ansikt', sted: 'her', ikon: '😠', tekst: 'Lag et ansikt som er skikkelig sint, og slipp det ut igjen.' },
    { id: 'n-overrasket', sted: 'her', ikon: '😲', tekst: 'Lag et ansikt som er helt overrasket.' },
    { id: 'n-blunk', sted: 'her', ikon: '😉', tekst: 'Blunk med ett øye, og så med det andre.' },
    { id: 'n-oyenbryn', sted: 'her', ikon: '🤨', tekst: 'Prøv å bevege bare øyenbrynene.' },
    { id: 'n-tunge-ut', sted: 'her', ikon: '😝', tekst: 'Rekk tunga så langt du klarer.' },
    { id: 'n-blaas-kinn', sted: 'her', ikon: '🎈', tekst: 'Blås opp kinnene og hold i fem sekunder.' },
    { id: 'n-smil-tilbake', sted: 'her', ikon: '😊', tekst: 'Smil til noen til de smiler tilbake.' },
    { id: 'n-nesa-med-tunga', sted: 'her', ikon: '👅', tekst: 'Prøv å ta på nesa med tunga.' },
    { id: 'n-alvorlig-lengst', sted: 'her', ikon: '😐', tekst: 'Se hvem som klarer å være alvorlig lengst.' },
    { id: 'n-speil-voksen', sted: 'her', ikon: '🪞', tekst: 'Speil alt en voksen gjør, i ti sekunder.' },
    { id: 'n-vink-speil', sted: 'her', ikon: '👋', tekst: 'Finn et speil og vink til deg selv.' },
    { id: 'n-tegn-paa-ryggen', sted: 'her', ikon: '✍️', tekst: 'Be noen tegne noe på ryggen din, og gjett hva det er.' },
    { id: 'n-hemmelig-hilsen', sted: 'her', ikon: '🤝', tekst: 'Finn på en hemmelig hilsen med noen.' },
    { id: 'n-sitt-paa-hendene', sted: 'her', ikon: '🙃', tekst: 'Sett deg på hendene dine og prøv å reise deg.' },
    { id: 'n-sokker-av-paa', sted: 'her', ikon: '🧦', tekst: 'Ta av deg sokkene, og ta dem på igjen.' },
    { id: 'n-snurr-gaa-rett', sted: 'her', ikon: '🌀', tekst: 'Snurr rundt tre ganger, og prøv å gå rett fram.' },
    { id: 'n-klapp-bak-ryggen', sted: 'her', ikon: '👏', tekst: 'Klapp hendene bak ryggen {tall} ganger.' },
    { id: 'n-klapp-med-fottene', sted: 'her', ikon: '🦶', tekst: 'Prøv å klappe med føttene.' },
    { id: 'n-stor-gjesp', sted: 'her', ikon: '🥱', tekst: 'Gjesp så stort du klarer.' },
    { id: 'n-lukkede-oyne-balanse', sted: 'her', ikon: '🙈', tekst: 'Prøv å stå på ett bein med lukkede øyne.' },
    { id: 'n-rist-haaret', sted: 'her', ikon: '💇', tekst: 'Rist på hodet så håret flyr.' },
    { id: 'n-tung-som-stein', sted: 'her', ikon: '🪨', tekst: 'Gjør deg så tung som en stein på gulvet.' },
    { id: 'n-pannekake', sted: 'her', ikon: '🫓', tekst: 'Legg deg ned og lat som du er en pannekake.' },
    { id: 'n-mot-veggen', sted: 'her', ikon: '🧱', tekst: 'Stå med ryggen mot veggen og se hvor høy du er.' },
    { id: 'n-vinger', sted: 'her', ikon: '🕊️', tekst: 'Vift med armene som vinger, ti ganger.' },
    { id: 'n-genser-baklengs', sted: 'her', ikon: '👕', tekst: 'Ta på deg en genser baklengs.' },
    { id: 'n-sokk-en-hand', sted: 'her', ikon: '🧤', tekst: 'Prøv å ta på deg en sokk med bare én hånd.' },
    { id: 'n-brett-handkle', sted: 'her', ikon: '🧺', tekst: 'Brett et håndkle så pent du klarer.' },
    { id: 'n-under-teppe', sted: 'her', ikon: '🫥', tekst: 'Legg deg under et teppe og lat som du er borte.' },
    { id: 'n-bein-i-lufta', sted: 'her', ikon: '🪑', tekst: 'Sett deg på en stol og hold beina i lufta mens noen teller til ti.' },
    { id: 'n-beste-gjemmested', sted: 'her', ikon: '🫣', tekst: 'Finn det beste gjemmestedet i dette rommet.' },
    { id: 'n-doraapning', sted: 'her', ikon: '🚪', tekst: 'Still deg i en døråpning og strekk armene ut til begge sider.' },
    { id: 'n-tarn-av-puter', sted: 'her', ikon: '🏗️', tekst: 'Bygg det høyeste tårnet du klarer av puter.' },
    { id: 'n-gjem-og-let', sted: 'her', ikon: '🔍', tekst: 'Gjem noe lite i rommet, og la noen andre lete.' },
    { id: 'n-onskedyr', sted: 'her', ikon: '🦄', tekst: 'Fortell om et dyr du skulle ønske du hadde.' },
    { id: 'n-nytt-navn', sted: 'her', ikon: '🏷️', tekst: 'Finn på et nytt navn til en av tingene i rommet.' },
    { id: 'n-usynlig', sted: 'her', ikon: '👻', tekst: 'Fortell hva du ville gjort hvis du var usynlig.' },
    { id: 'n-godt-aa-spise', sted: 'her', ikon: '🍓', tekst: 'Fortell om noe godt du gleder deg til å spise.' },
    { id: 'n-morsomste-i-dag', sted: 'her', ikon: '🌈', tekst: 'Fortell om det morsomste du har gjort i dag.' },
    { id: 'n-ny-dans-navn', sted: 'her', ikon: '💃', tekst: 'Finn på en ny dans, og gi den et navn.' },
    { id: 'n-dyret-snakker', sted: 'her', ikon: '🗨️', tekst: 'Fortell hva et dyr ville sagt hvis det kunne snakke.' },
    { id: 'n-tegn-i-lufta', sted: 'her', ikon: '🖌️', tekst: 'Tegn en figur i lufta, og la noen gjette hva det er.' },
    { id: 'n-hva-drommer-om', sted: 'her', ikon: '💭', tekst: 'Fortell hva du drømte om sist natt.' },
    { id: 'n-tre-onsker', sted: 'her', ikon: '🌠', tekst: 'Fortell hva du ville ønsket deg hvis du fikk tre ønsker.' },
    { id: 'n-superkraft', sted: 'her', ikon: '🦸', tekst: 'Fortell hvilken superkraft du helst vil ha.' },
    { id: 'n-tell-fingre', sted: 'her', ikon: '✋', tekst: 'Tell fingrene dine, én for én.' },
    { id: 'n-tell-skritt-dor', sted: 'her', ikon: '👣', tekst: 'Tell hvor mange skritt det er bort til døra.' },
    { id: 'n-tell-stoler', sted: 'her', ikon: '🪑', tekst: 'Tell stolene du kan se herfra.' },
    { id: 'n-klapp-alderen', sted: 'her', ikon: '🎂', tekst: 'Klapp like mange ganger som du er år.' },
    { id: 'n-hopp-fem', sted: 'her', ikon: '🖐️', tekst: 'Hopp like mange ganger som du har fingre på én hånd.' },
    { id: 'n-tre-ut-av-vinduet', sted: 'her', ikon: '🪟', tekst: 'Se ut av vinduet og fortell om tre ting du ser.' },
    { id: 'n-samme-farge-ting', sted: 'her', ikon: '🎨', tekst: 'Finn {tall} ting i rommet som har samme farge.' },
    { id: 'n-high-five', sted: 'her', ikon: '✋', tekst: 'Gi en voksen en high five, og så en bak ryggen.' },
    { id: 'n-favorittfarge', sted: 'her', ikon: '🎨', tekst: 'Spør en voksen hva favorittfargen deres er.' },
    { id: 'n-laer-bort-dans', sted: 'her', ikon: '🕺', tekst: 'Lær en voksen en dans du kan.' },
    { id: 'n-klem-naermest', sted: 'her', ikon: '🤗', tekst: 'Gi en klem til den som er nærmest deg.' },
    { id: 'n-fortell-vits', sted: 'her', ikon: '😹', tekst: 'Fortell den morsomste vitsen du kan.' },
    { id: 'n-takk-for-noe', sted: 'her', ikon: '💝', tekst: 'Si takk til noen for noe de gjorde i dag.' },
    { id: 'n-tramp-takt', sted: 'her', ikon: '🥁', tekst: 'Tramp en takt med føttene.' },
    { id: 'n-sakte-dans', sted: 'her', ikon: '🐢', tekst: 'Dans så sakte du klarer.' },
    { id: 'n-dans-under-vann', sted: 'her', ikon: '🌊', tekst: 'Dans som om du er under vann.' },
    { id: 'n-stopp-statue', sted: 'her', ikon: '🗿', tekst: 'Dans, og bli til en statue når noen sier stopp.' },
    { id: 'n-klapp-tjue', sted: 'her', ikon: '👏', tekst: 'Klapp helt til du har telt til tjue.' },
    { id: 'n-sang-om-rommet', sted: 'her', ikon: '🎼', tekst: 'Finn på en sang om det du ser rett foran deg.' },
    { id: 'n-trommer-paa-laar', sted: 'her', ikon: '🪘', tekst: 'Tromm en takt på lårene dine.' },
    { id: 'n-syng-navnet', sted: 'her', ikon: '🎙️', tekst: 'Syng navnet ditt i stedet for å si det.' },

    /* --- ut i huset --- */
    { id: 'hent-farge', ikon: '🎨', sted: 'rom', tekst: 'Gå til {rom} og hent noe som er {farge}. Legg det tilbake etterpå.' },
    { id: 'lop-og-hopp', ikon: '🏃', sted: 'rom', tekst: 'Gå til {rom}, hopp tre ganger på stedet, og kom tilbake.' },
    { id: 'mykeste', ikon: '🧸', sted: 'rom', tekst: 'Gå til soverommet ditt og hent det mykeste du finner.' },
    { id: 'som-dyr-til-rom', ikon: '🦘', sted: 'rom', tekst: 'Gå som en {dyr} helt til {rom}, og som deg selv tilbake.' },
    { id: 'hvisk', ikon: '🗣️', sted: 'rom', tekst: 'Gå til {rom}, hvisk «god dag» til veggen, og kom tilbake.' },
    { id: 'tannborster', ikon: '🪥', sted: 'rom', tekst: 'Gå til badet og tell tannbørstene. Kom tilbake og si tallet.' },
    { id: 'glass-vann', ikon: '🥤', sted: 'rom', tekst: 'Gå til kjøkkenet og hent deg et glass vann.' },
    { id: 'tell-dorer', ikon: '🚪', sted: 'rom', tekst: 'Gå til {rom} og tell hvor mange dører du går forbi på veien.' },
    { id: 'snik', ikon: '🥷', sted: 'rom', tekst: 'Snik deg til {rom} og tilbake uten å lage en eneste lyd.' },
    { id: 'noe-rundt', ikon: '⚪', sted: 'rom', tekst: 'Gå til {rom} og finn noe som er rundt. Kom tilbake og vis det.' },
    { id: 'sko', ikon: '👟', sted: 'rom', tekst: 'Gå til gangen og tell skoene som står der. Kom tilbake og si tallet.' },
    { id: 'lukt', ikon: '👃', sted: 'rom', tekst: 'Gå til kjøkkenet og lukt på tre ting. Kom tilbake og fortell hva som luktet best.' },

    { id: 'n-hent-mykt', sted: 'rom', ikon: '🧸', tekst: 'Gå til {rom} og hent noe som er mykt.' },
    { id: 'n-hent-kaldt', sted: 'rom', ikon: '❄️', tekst: 'Gå til {rom} og hent noe som er kaldt.' },
    { id: 'n-hent-lyd', sted: 'rom', ikon: '🔔', tekst: 'Gå til {rom} og hent noe som kan lage lyd.' },
    { id: 'n-hent-lite', sted: 'rom', ikon: '🤏', tekst: 'Gå til {rom} og hent noe som er mindre enn hånda di.' },
    { id: 'n-hent-glad-i', sted: 'rom', ikon: '❤️', tekst: 'Gå til {rom} og hent noe du er glad i.' },
    { id: 'n-firkantet', sted: 'rom', ikon: '⬜', tekst: 'Gå til {rom} og finn noe som er firkantet.' },
    { id: 'n-glatt', sted: 'rom', ikon: '🧊', tekst: 'Gå til {rom} og finn noe som er helt glatt.' },
    { id: 'n-tell-puter', sted: 'rom', ikon: '🛋️', tekst: 'Gå til {rom} og tell putene du finner.' },
    { id: 'n-tell-kopper', sted: 'rom', ikon: '☕', tekst: 'Gå til kjøkkenet og tell koppene du ser.' },
    { id: 'n-tell-handklaer', sted: 'rom', ikon: '🛁', tekst: 'Gå til badet og tell håndklærne.' },
    { id: 'n-tell-lamper', sted: 'rom', ikon: '💡', tekst: 'Gå til {rom} og tell lampene der inne.' },
    { id: 'n-storste-sko', sted: 'rom', ikon: '👞', tekst: 'Gå til gangen og finn den største skoen.' },
    { id: 'n-lukter-godt', sted: 'rom', ikon: '👃', tekst: 'Gå til {rom} og finn noe som lukter godt.' },
    { id: 'n-sokk-paa-hodet', sted: 'rom', ikon: '🧦', tekst: 'Gå til {rom}, hent en sokk, og legg den på hodet.' },
    { id: 'n-hoyere-enn-deg', sted: 'rom', ikon: '📏', tekst: 'Gå til {rom} og finn noe som er høyere enn deg.' },
    { id: 'n-like-langt-som-arm', sted: 'rom', ikon: '💪', tekst: 'Gå til {rom} og finn noe som er like langt som armen din.' },
    { id: 'n-re-senga', sted: 'rom', ikon: '🛏️', tekst: 'Gå til soverommet ditt og gjør senga så pen du klarer.' },
    { id: 'n-tre-paa-rekke', sted: 'rom', ikon: '📊', tekst: 'Gå til {rom} og legg tre ting på rekke, fra minst til størst.' },
    { id: 'n-tre-former', sted: 'rom', ikon: '🔺', tekst: 'Gå til {rom} og finn noe rundt, noe firkantet og noe langt.' },
    { id: 'n-noe-som-er-ditt', sted: 'rom', ikon: '🎁', tekst: 'Gå til {rom} og hent noe som er ditt.' },
    { id: 'n-to-like-farger', sted: 'rom', ikon: '🎨', tekst: 'Gå til {rom} og finn to ting som er {farge}.' },
    { id: 'n-tell-vinduer-inne', sted: 'rom', ikon: '🪟', tekst: 'Gå til {rom} og tell vinduene der.' },
    { id: 'n-aldri-lagt-merke', sted: 'rom', ikon: '🔍', tekst: 'Gå til {rom} og finn noe du aldri har lagt merke til før.' },
    { id: 'n-skje-balanse', sted: 'rom', ikon: '🥄', tekst: 'Gå til kjøkkenet, hent en skje, og balanser den på fingeren.' },
    { id: 'n-klem-pute', sted: 'rom', ikon: '🤗', tekst: 'Gå til {rom}, hent en pute, og klem den så hardt du kan.' },
    { id: 'n-sokk-hoyt', sted: 'rom', ikon: '🧤', tekst: 'Gå til {rom} og legg en sokk på det høyeste stedet du når.' },
    { id: 'n-noe-som-triller', sted: 'rom', ikon: '⚽', tekst: 'Gå til {rom} og hent noe som kan trille.' },
    { id: 'n-noe-vaatt', sted: 'rom', ikon: '💧', tekst: 'Gå til {rom} og finn noe som er vått.' },
    { id: 'n-minste-tingen', sted: 'rom', ikon: '🔬', tekst: 'Gå til {rom} og finn den minste tingen du klarer å se.' },
    { id: 'n-noe-som-blinker', sted: 'rom', ikon: '✨', tekst: 'Gå til {rom} og se etter noe som blinker eller skinner.' },
    { id: 'n-tre-ting-tilbake', sted: 'rom', ikon: '🧹', tekst: 'Gå til {rom} og legg tre ting på plass.' },
    { id: 'n-sko-paa-rekke', sted: 'rom', ikon: '👟', tekst: 'Gå til gangen og still skoene pent på rekke.' },
    { id: 'n-skje-i-skuff', sted: 'rom', ikon: '🍴', tekst: 'Gå til kjøkkenet og legg en skje på plass i skuffen.' },
    { id: 'n-noe-paa-gulvet', sted: 'rom', ikon: '👀', tekst: 'Gå til {rom} og se om det ligger noe på gulvet som ikke skal ligge der.' },
    { id: 'n-kosedyr-pent', sted: 'rom', ikon: '🧸', tekst: 'Gå til soverommet ditt og legg kosedyrene pent.' },
    { id: 'n-lukk-skuff', sted: 'rom', ikon: '🗄️', tekst: 'Gå til {rom} og lukk en skuff som står åpen.' },
    { id: 'n-klem-voksen', sted: 'rom', ikon: '🫂', tekst: 'Gå til {rom} og gi en voksen en klem.' },
    { id: 'n-si-noe-fint', sted: 'rom', ikon: '💬', tekst: 'Gå til {rom} og si noe fint til den du møter.' },
    { id: 'n-hent-blyant', sted: 'rom', ikon: '✏️', tekst: 'Gå til {rom} og hent noe å tegne med.' },
    { id: 'n-samme-vei-tilbake', sted: 'rom', ikon: '↩️', tekst: 'Gå til {rom}, og kom tilbake nøyaktig samme vei.' },
    { id: 'n-hent-to-like', sted: 'rom', ikon: '👯', tekst: 'Gå til {rom} og finn to ting som er helt like.' },
    { id: 'n-hent-noe-tungt', sted: 'rom', ikon: '⚖️', tekst: 'Gå til {rom} og finn noe du så vidt klarer å løfte.' },
    { id: 'n-hjelp-en-voksen', sted: 'rom', ikon: '🧑‍🍳', tekst: 'Spør en voksen om det er noe du kan hjelpe til med.' },
    { id: 'n-skjemusikk', sted: 'rom', ikon: '🥄', tekst: 'Gå til kjøkkenet og lag musikk med to skjeer.' },

    /* --- litt mer å holde styr på --- */
    { id: 'statue', ikon: '🗿', sted: 'her', tekst: 'Vær en statue mens noen teller til femten.' },
    { id: 'tell-baklengs', ikon: '🔢', sted: 'her', tekst: 'Stå på ett bein og tell baklengs fra fem til null.' },
    { id: 'stav-baklengs', ikon: '🔤', sted: 'her', tekst: 'Stav navnet ditt baklengs, høyt og tydelig.' },
    { id: 'ukedager', ikon: '📅', sted: 'her', tekst: 'Ta {tall} knebøy, og rop hepp for hver gang.' },
    { id: 'lukkede-oyne', ikon: '😌', sted: 'her', tekst: 'Balanser på ett bein med lukkede øyne, og tell til ti.' },
    { id: 'samme-bokstav', ikon: '🔠', sted: 'rom', tekst: 'Gå til {rom} og finn tre ting som begynner på samme bokstav som navnet ditt.' },
    { id: 'hent-bok', ikon: '📖', sted: 'rom', tekst: 'Gå til {rom} og hent en bok. Vis fram det fineste bildet i den.' }
  ];

  /* Hagen. Samme regler som inne – verbet først, tall med bokstaver – men
     oppdragene bruker det som faktisk finnes ute: stein, pinner, blader,
     skygger og lyder. Ingenting her krever verktøy, klatring eller vann, og
     ingenting forutsetter en bestemt hage: «det nærmeste treet» finnes også
     der det bare står ett. */
  var HAGE = [
    /* --- der du står --- */
    { id: 'h-hopp-over', sted: 'her', ikon: '🦘', tekst: 'Hopp over noe som ligger på bakken, tre ganger.' },
    { id: 'h-dans', sted: 'her', ikon: '💃', tekst: 'Lag den rareste dansen du kan, midt på plenen.' },
    { id: 'h-rop', sted: 'her', ikon: '📣', tekst: 'Rop så høyt du kan opp mot himmelen, én gang.' },
    { id: 'h-skygge', sted: 'her', ikon: '🌤️', tekst: 'Finn skyggen din, og prøv å hoppe over hodet på den.' },
    { id: 'h-lytt', sted: 'her', ikon: '👂', tekst: 'Stå helt stille og lytt. Kom og fortell hvor mange lyder du hørte.' },
    { id: 'h-maur', sted: 'her', ikon: '🐜', tekst: 'Finn en maur, og følg etter den så langt du klarer.' },
    { id: 'h-skyer', sted: 'her', ikon: '☁️', tekst: 'Legg deg i gresset og finn en sky som ligner på noe.' },
    { id: 'h-taarn', sted: 'her', ikon: '🏗️', tekst: 'Bygg det høyeste tårnet du klarer av det du finner ute.' },
    { id: 'h-vinden', sted: 'her', ikon: '🌬️', tekst: 'Finn ut hvilken vei vinden blåser, og si det høyt.' },

    { id: 'h-hopp-hoyt', sted: 'her', ikon: '⬆️', tekst: 'Hopp så høyt du klarer, tre ganger på rad.' },
    { id: 'h-snurr-gress', sted: 'her', ikon: '🌀', tekst: 'Snurr rundt fem ganger, og sett deg ned i gresset etterpå.' },
    { id: 'h-dyrelyd', sted: 'her', ikon: '🐄', tekst: 'Lag lyden til et dyr, så høyt du klarer.' },
    { id: 'h-strekk', sted: 'her', ikon: '🙆', tekst: 'Strekk deg så høyt du kan, og bøy deg så lavt du kan.' },
    { id: 'h-vaatt-gress', sted: 'her', ikon: '🌱', tekst: 'Kjenn på gresset, og si om det er vått eller tørt.' },
    { id: 'h-kaste-gress', sted: 'her', ikon: '🌾', tekst: 'Kast en håndfull gress opp i lufta, og se hvor det lander.' },
    { id: 'h-kaninhopp', sted: 'her', ikon: '🐇', tekst: 'Hopp som en kanin ti hopp på stedet.' },
    { id: 'h-fly', sted: 'her', ikon: '✈️', tekst: 'Stå på ett bein med armene ut som et fly, mens noen teller til ti.' },
    { id: 'h-fugl', sted: 'her', ikon: '🐦', tekst: 'Se etter en fugl, og fortell hva den gjorde.' },
    { id: 'h-sirkel-lufta', sted: 'her', ikon: '✍️', tekst: 'Tegn en kjempestor sirkel i lufta med armen.' },
    { id: 'h-himmelfarge', sted: 'her', ikon: '🌅', tekst: 'Se opp på himmelen, og si hvilken farge den har i dag.' },
    { id: 'h-stille-seksti', sted: 'her', ikon: '⏳', tekst: 'Stå helt stille og tell til tjue uten å le.' },
    { id: 'h-maal-skygge', sted: 'her', ikon: '📏', tekst: 'Mål skyggen din med skritt, og si hvor mange det ble.' },

    /* --- rundt i hagen --- */
    { id: 'h-blad', sted: 'rom', ikon: '🍃', tekst: 'Finn et blad som er større enn hånda di.' },
    { id: 'h-kongler', sted: 'rom', ikon: '🌰', tekst: 'Lag en haug av kongler, steiner eller pinner.' },
    { id: 'h-klem-tre', sted: 'rom', ikon: '🌳', tekst: 'Løp til det nærmeste treet og gi det en klem.' },
    { id: 'h-pinne', sted: 'rom', ikon: '🪵', tekst: 'Finn en pinne som er lengre enn armen din.' },
    { id: 'h-steiner', sted: 'rom', ikon: '🪨', tekst: 'Finn tre steiner og legg dem på rekke, fra minst til størst.' },
    { id: 'h-rundt-huset', sted: 'rom', ikon: '🏠', tekst: 'Gå en runde rundt huset, så fort du klarer.' },
    { id: 'h-blomster', sted: 'rom', ikon: '🌼', tekst: 'Tell blomstene du finner. Kom tilbake og si tallet.' },
    { id: 'h-baklengs', sted: 'rom', ikon: '👣', tekst: 'Gå baklengs fra det ene hjørnet av hagen til det andre.' },
    { id: 'h-hink', sted: 'rom', ikon: '🦩', tekst: 'Hink på ett bein bort til gjerdet og tilbake igjen.' },
    { id: 'h-tre-farger', sted: 'rom', ikon: '🎨', tekst: 'Finn noe grønt, noe brunt og noe gult. Kom tilbake og vis det.' },
    { id: 'h-ruest', sted: 'rom', ikon: '✋', tekst: 'Kjenn på tre ting ute, og si hvilken av dem som er ruest.' },
    { id: 'h-lukt-ute', sted: 'rom', ikon: '👃', tekst: 'Lukt på tre forskjellige ting ute, og si hva som luktet best.' },
    { id: 'h-mykt-hardt', sted: 'rom', ikon: '🧤', tekst: 'Finn noe mykt og noe hardt ute, og ta med begge tilbake.' },
    { id: 'h-under-over', sted: 'rom', ikon: '🐛', tekst: 'Krabb under noe, over noe, og rundt noe.' },
    { id: 'h-hils-plante', sted: 'rom', ikon: '🌷', tekst: 'Si «hei» til den største planten du finner.' },
    { id: 'h-rundt-noe-stort', sted: 'rom', ikon: '🔄', tekst: 'Løp en runde rundt noe som er større enn deg.' },
    { id: 'h-rundt-tre', sted: 'rom', ikon: '🏃', tekst: 'Løp tre runder rundt et tre.' },
    { id: 'h-minste-blad', sted: 'rom', ikon: '🍂', tekst: 'Finn det minste bladet du klarer å få øye på.' },
    { id: 'h-flat-stein', sted: 'rom', ikon: '🥌', tekst: 'Finn den flateste steinen du klarer, og legg den ved døra.' },
    { id: 'h-tell-skritt', sted: 'rom', ikon: '🔢', tekst: 'Tell hvor mange skritt det er fra døra til gjerdet.' },
    { id: 'h-gjemmested', sted: 'rom', ikon: '🫣', tekst: 'Finn et bra gjemmested, og vis det fram etterpå.' },
    { id: 'h-sol-og-skygge', sted: 'rom', ikon: '☀️', tekst: 'Finn et sted med sol og et sted med skygge, og stå litt på hvert av dem.' },
    { id: 'h-tungt-lett', sted: 'rom', ikon: '⚖️', tekst: 'Finn noe tungt og noe lett, og hold ett i hver hånd.' },
    { id: 'h-tell-vinduer', sted: 'rom', ikon: '🪟', tekst: 'Tell vinduene på huset. Kom tilbake og si tallet.' },
    { id: 'h-bokstav-pinner', sted: 'rom', ikon: '🔤', tekst: 'Legg pinner på bakken så de blir til en stjerne.' },
    { id: 'h-regnbue', sted: 'rom', ikon: '🌈', tekst: 'Samle fem ting ute med hver sin farge, og legg dem på en rad.' },
    { id: 'h-spindelvev', sted: 'rom', ikon: '🕸️', tekst: 'Se etter et spindelvev, og kom og fortell hvor du fant det.' },
    { id: 'h-kaldest', sted: 'rom', ikon: '❄️', tekst: 'Kjenn på tre ting ute, og si hvilken av dem som er kaldest.' }
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
    { id: 'r-sur-sokk', ikon: '🧦', sted: 'her', tekst: 'Kast en sur sokk på pappa, og løp din vei.' },
    { id: 'r-si-pappa', ikon: '📣', sted: 'her', tekst: 'Si «pappa» ti ganger på rad, helt til han svarer.' },
    { id: 'r-hund', ikon: '🐶', sted: 'her', tekst: 'Vær en hund som logrer rundt beina til en voksen.' },
    { id: 'r-teppe', ikon: '🛋️', sted: 'her', tekst: 'Gjem deg under et teppe og lat som du er en sofa.' },
    { id: 'r-herm', ikon: '🦜', sted: 'her', tekst: 'Herm etter alt pappa sier, helt til han oppdager det.' },
    { id: 'r-maten', ikon: '🍽️', sted: 'her', tekst: 'Rop «maten er klar!» selv om den slett ikke er det.' },
    { id: 'r-stirr', ikon: '👀', sted: 'her', tekst: 'Still deg helt stille bak pappa, og se på han til han snur seg.' },
    { id: 'r-hviskedag', ikon: '🤫', sted: 'her', tekst: 'Snakk bare med hviskestemme til noen spør hvorfor.' },
    { id: 'r-hemmelighet', ikon: '🤐', sted: 'her', tekst: 'Si at du har en hemmelighet, og ikke si hva den er.' },
    { id: 'r-bo', ikon: '👻', sted: 'rom', tekst: 'Snik deg inn bak mamma og si «bø».' },
    { id: 'r-toffel-snu', ikon: '🥿', sted: 'rom', tekst: 'Snu tøflene til en voksen så de peker feil vei.' },
    { id: 'r-kosedyr', ikon: '🧸', sted: 'rom', tekst: 'Legg et kosedyr under dyna i senga til mamma og pappa.' },
    { id: 'r-pappas-sko', ikon: '👞', sted: 'rom', tekst: 'Ta på deg pappas sko og gå en runde i huset.' },
    { id: 'r-kile', ikon: '🤣', sted: 'rom', tekst: 'Krabb under bordet og kile en voksen på foten.' },
    { id: 'r-sovner', ikon: '😴', sted: 'rom', tekst: 'Sett deg på fanget til en voksen og lat som du sovner med én gang.' },
    { id: 'r-klem', ikon: '🤗', sted: 'rom', tekst: 'Gi mamma en klem, og ikke slipp før hun sier «slipp».' },
    { id: 'r-gjem-sko', ikon: '🥾', sted: 'rom', tekst: 'Gjem en av pappas sko et sted han aldri ville lett. Husk hvor du la den.' },
    { id: 'r-bak-doren', ikon: '🚪', sted: 'rom', tekst: 'Gjem deg bak en dør, og si «hei» når noen går forbi.' },
    { id: 'r-bytt-toffel', ikon: '🩴', sted: 'rom', tekst: 'Bytt om tøflene til mamma og pappa.' },
    { id: 'r-fjernkontroll', ikon: '📺', sted: 'rom', tekst: 'Gjem fjernkontrollen under en pute, og si fra etterpå.' },
    { id: 'r-sokk-i-sko', ikon: '🧦', sted: 'rom', tekst: 'Legg en sokk ned i pappas sko.' },
    { id: 'r-rop-ingenting', ikon: '🔔', sted: 'rom', tekst: 'Rop på mamma fra et annet rom, og si «ingenting» når hun kommer.' },
    { id: 'r-opp-ned', ikon: '🙃', sted: 'rom', tekst: 'Snu en kopp eller et bilde opp ned, og se hvor lang tid det tar før noen oppdager det.' }
  ];


  /* Morgenen før barnehagen. Denne banken er ikke som de andre: den trekkes
     ikke, den går i rekkefølge. Sko før jakke gir ingen mening, og et barn som
     får stegene i tilfeldig orden, blir bare mer usikkert enn det var.

     Stegene er skrevet så de kan gjøres alene så langt det går – appen er en
     huskeliste barnet eier selv, ikke en beskjed fra en voksen. Ingenting her
     kan mislykkes: hopper man over et steg, går lista videre uten å si fra. */
  var MORGEN = [
    { id: 'm-opp', ikon: '🛏️', tekst: 'Stå opp av senga.' },
    { id: 'm-do', ikon: '🚽', tekst: 'Gå på do, og husk å vaske hendene.' },
    { id: 'm-pyjamas', ikon: '🌙', tekst: 'Ta av deg pyjamasen, og legg den på plass.' },
    { id: 'm-klaer', ikon: '👕', tekst: 'Ta på deg klærne.' },
    { id: 'm-frokost', ikon: '🥣', tekst: 'Spis frokosten din.' },
    { id: 'm-tenner', ikon: '🪥', tekst: 'Puss tennene, både oppe og nede.' },
    { id: 'm-ansikt', ikon: '🧼', tekst: 'Vask ansiktet og hendene.' },
    { id: 'm-haar', ikon: '💇', tekst: 'Gre håret ditt.' },
    { id: 'm-matboks', ikon: '🍱', tekst: 'Legg matboksen og drikkeflaska i sekken.' },
    { id: 'm-vaeret', ikon: '🌦️', tekst: 'Se ut av vinduet, og finn ut om du trenger regnjakke.' },
    { id: 'm-jakke', ikon: '🧥', tekst: 'Ta på deg jakka.' },
    { id: 'm-sko', ikon: '👟', tekst: 'Ta på deg skoene.' },
    { id: 'm-lue', ikon: '🧤', tekst: 'Ta på deg lue og votter hvis det er kaldt ute.' },
    { id: 'm-sekk', ikon: '🎒', tekst: 'Ta sekken på ryggen.' },
    { id: 'm-hadet', ikon: '👋', tekst: 'Si ha det til alle hjemme.' }
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
