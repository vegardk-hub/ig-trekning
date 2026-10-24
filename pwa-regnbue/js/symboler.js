'use strict';
/*
 * symboler.js — tegnene i Regnbuespillet.
 *
 * Rekkefølgen og fargene er tegnet av eieren av appen, og står her slik de
 * står på arket: hjerte rødt, stjerne gult, måne grå, fotball, firkant blå,
 * trekant oransje, rektangel svart, kors grønt, regnbue.
 *
 * Et brett på 4×4 bruker de fire første, 6×6 de seks første. Derfor ligger de
 * enkleste formene først: hjerte og stjerne kjenner et barn igjen før det
 * skiller en firkant fra et rektangel.
 *
 * Hvert symbol har både form og farge å kjennes igjen på. Det er med vilje
 * dobbelt: former alene er krevende i små ruter, og farge alene stenger ute den
 * som ser farger annerledes. Alle tegnes med mørk kontur, så de står fram også
 * der fargen er lys.
 *
 * Eksponeres som window.RegnbueSymboler.
 */
(function (global) {

  const KONTUR = '#23262c';

  /*
   * Tegningene står i et kvadrat på 100×100 med litt luft rundt, så alle ni
   * ser like store ut uansett form. En trekant som fyller boksen helt, virker
   * større enn en sirkel som gjør det samme.
   */
  const SYMBOLER = [
    {
      id: 'hjerte', navn: 'hjerte', farge: '#e03b3b',
      tegning: '<path d="M50 84 C20 62 12 44 20 32 C28 20 44 22 50 34 ' +
               'C56 22 72 20 80 32 C88 44 80 62 50 84 Z"/>'
    },
    {
      id: 'stjerne', navn: 'stjerne', farge: '#f2c01e',
      tegning: '<path d="M50 14 L61 40 L89 42 L68 60 L74 87 L50 72 ' +
               'L26 87 L32 60 L11 42 L39 40 Z"/>'
    },
    {
      id: 'maane', navn: 'måne', farge: '#9aa4b0',
      // Halvmåne som ett utsnitt: en stor sirkel der en forskjøvet sirkel er
      // klippet bort. Tegnet som én bane, så konturen følger hele formen.
      tegning: '<path d="M64 16 A36 36 0 1 0 64 84 A30 30 0 1 1 64 16 Z"/>'
    },
    {
      id: 'fotball', navn: 'fotball', farge: '#ffffff',
      // Stor svart femkant i midten og korte stubber ut mot kanten. Lange
      // eiker gjorde den til et ratt i stedet for en ball.
      tegning: '<circle cx="50" cy="50" r="34"/>' +
               '<path d="M50 26 L69 40 L62 62 L38 62 L31 40 Z" fill="' + KONTUR + '" stroke="none"/>' +
               '<path d="M50 26 L50 16 M69 40 L78 33 M62 62 L69 74 ' +
               'M38 62 L31 74 M31 40 L22 33" stroke="' + KONTUR + '" stroke-width="5" fill="none"/>'
    },
    {
      id: 'firkant', navn: 'firkant', farge: '#2f6fd0',
      tegning: '<rect x="18" y="18" width="64" height="64" rx="6"/>'
    },
    {
      id: 'trekant', navn: 'trekant', farge: '#ef8324',
      tegning: '<path d="M50 16 L86 80 L14 80 Z"/>'
    },
    {
      id: 'rektangel', navn: 'rektangel', farge: '#2b2f36',
      tegning: '<rect x="12" y="32" width="76" height="36" rx="5"/>'
    },
    {
      id: 'kors', navn: 'kors', farge: '#36a054',
      tegning: '<path d="M38 14 H62 V38 H86 V62 H62 V86 H38 V62 H14 V38 H38 Z"/>'
    },
    {
      id: 'regnbue', navn: 'regnbue', farge: '#c060c0',
      // Buene tegnes som tykke streker utenfra og inn, så fargene ligger i
      // samme rekkefølge som på en ekte regnbue.
      tegning: ['#e03b3b', '#ef8324', '#f2c01e', '#36a054', '#2f6fd0']
        .map((f, k) => '<path d="M' + (16 + k * 7) + ' 78 A' + (34 - k * 7) + ' ' +
             (34 - k * 7) + ' 0 0 1 ' + (84 - k * 7) + ' 78" fill="none" stroke="' + f +
             '" stroke-width="6" stroke-linecap="round"/>').join('')
    }
  ];

  /**
   * SVG-en for symbol `d` (1-indeksert, som tallene det erstatter).
   * `tynn` brukes der symbolet er lite — en kontur på 4 px sluker en rute på
   * 28 px, og formen forsvinner i sin egen ramme.
   */
  function svg(d, tynn) {
    const s = SYMBOLER[d - 1];
    if (!s) return '';
    const bredde = tynn ? 3 : 4;
    const egen = s.id === 'fotball' || s.id === 'regnbue';
    return '<svg viewBox="0 0 100 100" class="symbol symbol-' + s.id +
           '" role="img" aria-label="' + s.navn + '">' +
           (egen
             ? '<g stroke="' + KONTUR + '" stroke-width="' + bredde + '" fill="' + s.farge + '">' +
               s.tegning + '</g>'
             : '<g fill="' + s.farge + '" stroke="' + KONTUR + '" stroke-width="' + bredde +
               '" stroke-linejoin="round">' + s.tegning + '</g>') +
           '</svg>';
  }

  const navn = d => (SYMBOLER[d - 1] || {}).navn || '';

  global.RegnbueSymboler = { SYMBOLER, svg, navn };

})(window);
