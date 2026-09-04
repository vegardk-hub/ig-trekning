/*
 * Temaene – hvilke brikker som hører sammen, og hvor de kan stå.
 *
 * Et tema er ikke en liste med ting: det er et sett regler for hva som kan
 * ligge ved siden av hva. Det er det som skiller et bilde fra et
 * klistremerkeark. Løva står i en innhegning, ikke midt i veien; traktoren
 * står på åkeren; bussen står i gata.
 *
 * Derfor har hvert tema tre kilder, og de plasseres forskjellig:
 *
 * - `soner`   – innhegninger, åkre, kvartaler. Rektangler som må grense til
 *               veien, med eget underlag og egne brikker inni.
 * - `langsvei`– ting som hører til ved veien og må ha en veirute som nabo.
 * - `kulisser`– pynt som fyller resten. Aldri et svar, og aldri en brikke som
 *               allerede er brukt som svar på samme brett.
 */
'use strict';

var Temaer = (function () {

  var LISTE = [
    {
      id: 'dyrehage',
      navn: 'Dyrehagen',
      grunn: 'gress',
      veigrunn: 'sti',
      gjerde: '#8b5e3c',
      soner: [
        { grunn: 'sand', brikker: ['love', 'sjiraff', 'sebra', 'struts', 'kamel', 'elefant'] },
        { grunn: 'gress', brikker: ['ape', 'tiger', 'papegoye', 'slange', 'isbjorn'] },
        { grunn: 'vann', brikker: ['pingvin', 'sel', 'krokodille', 'flodhest'] }
      ],
      langsvei: ['port', 'kiosk', 'kart', 'fontene', 'benk', 'boette', 'lykt'],
      kulisser: ['tre', 'busk', 'blomst', 'stein']
    },
    {
      id: 'bondegard',
      navn: 'Bondegården',
      grunn: 'gress',
      veigrunn: 'sti',
      gjerde: '#8b5e3c',
      soner: [
        { grunn: 'gress', brikker: ['ku', 'hest', 'sau', 'geit', 'esel'] },
        { grunn: 'aker', brikker: ['fugleskremsel', 'traktor', 'hoyball'] },
        { grunn: 'vann', brikker: ['and'] },
        { grunn: 'sand', brikker: ['hone', 'gris', 'kanin', 'hund', 'katt'] }
      ],
      langsvei: ['laave', 'hus', 'silo', 'bronn', 'postkasse', 'traktor', 'hoyball', 'lykt'],
      kulisser: ['tre', 'busk', 'blomst', 'stein']
    },
    {
      id: 'by',
      navn: 'Byen',
      grunn: 'stein',
      veigrunn: 'vei',
      gjerde: '#9aa5ad',
      soner: [
        { grunn: 'sand', brikker: ['butikk', 'skole', 'sykehus', 'brannstasjon', 'bibliotek', 'kirke', 'bakeri', 'blokk'] },
        { grunn: 'gress', brikker: ['fontene', 'blomst', 'benk', 'lykt'] }
      ],
      langsvei: ['bil', 'buss', 'sykkel', 'lyskryss', 'postkasse', 'boette', 'benk', 'lykt', 'hus'],
      kulisser: ['tre', 'busk']
    }
  ];

  function hent(id) {
    for (var i = 0; i < LISTE.length; i++) if (LISTE[i].id === id) return LISTE[i];
    return LISTE[0];
  }

  return { LISTE: LISTE, hent: hent, IDER: LISTE.map(function (t) { return t.id; }) };
})();
