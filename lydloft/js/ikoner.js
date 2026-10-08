/*
 * Ikonene i verkstedet — tegnet, ikke emoji.
 *
 * Emoji ser forskjellige ut på iPhone og på Windows, og de kan ikke farges:
 * en robot-emoji er grå uansett hvilken neonfarge flisen har. Disse er
 * strektegninger i `currentColor`, så hver flis gir ikonet sin farge og
 * gløden følger med.
 *
 * Alle står i et 64 × 64-rom med samme strektykkelse, så de ser ut som et
 * sett. Fylte ikoner (spill, pause, 8-bit) setter `fill` selv.
 */
'use strict';

var LydIkoner = (function () {

  var STREK = 'fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"';

  // Romvesenet fra gamle spillkonsoller, piksel for piksel.
  function pikselfigur() {
    var rader = [
      '..X.....X..',
      '...X...X...',
      '..XXXXXXX..',
      '.XX.XXX.XX.',
      'XXXXXXXXXXX',
      'X.XXXXXXX.X',
      'X.X.....X.X',
      '...XX.XX...'
    ];
    var ut = '';
    rader.forEach(function (rad, y) {
      for (var x = 0; x < rad.length; x++) {
        if (rad[x] === 'X') ut += '<rect x="' + (4.5 + x * 5) + '" y="' + (12 + y * 5) + '" width="5.2" height="5.2"/>';
      }
    });
    return '<g fill="currentColor" stroke="none">' + ut + '</g>';
  }

  var TEGNINGER = {
    ingen: '<path d="M26 46V14l22-5v31"/><circle cx="20" cy="46" r="6"/><circle cx="42" cy="40" r="6"/>',
    bassboost: '<path d="M10 26h8l12-10v32L18 38h-8z"/><path d="M38 25c3 4 3 10 0 14"/><path d="M45 19c6 7 6 19 0 26"/><path d="M52 13c9 10 9 28 0 38"/>',
    radio: '<rect x="8" y="22" width="48" height="32" rx="6"/><path d="M18 22L44 8"/><circle cx="23" cy="38" r="8"/><path d="M38 32h11M38 38h11M38 44h11"/>',
    telefon: '<path d="M19 9c-5 2-9 6-8 12 2 15 17 31 32 33 6 1 10-2 12-7l-9-8-6 4c-6-3-11-8-14-14l4-6z"/>',
    kassett: '<rect x="6" y="14" width="52" height="36" rx="5"/><circle cx="22" cy="29" r="5"/><circle cx="42" cy="29" r="5"/><path d="M27 29h10"/><path d="M16 50l4-8h24l4 8"/>',
    vinyl: '<circle cx="28" cy="35" r="21"/><circle cx="28" cy="35" r="13"/><circle cx="28" cy="35" r="3.5"/><path d="M53 8v17L41 37"/>',
    kirke: '<path d="M32 4v10M27 9h10"/><path d="M20 28l12-13 12 13"/><path d="M20 28v28h24V28"/><path d="M8 56V40l12-7M56 56V40l-12-7"/><path d="M28 56V47a4 4 0 0 1 8 0v9"/><path d="M6 56h52"/>',
    sal: '<path d="M8 22L32 8l24 14z"/><path d="M6 56h52M10 51h44"/><path d="M15 27v19M25 27v19M39 27v19M49 27v19"/>',
    undervann: '<path d="M8 36c8-12 26-14 36 0-10 14-28 12-36 0z"/><path d="M44 36l11-8v16z"/><circle cx="18" cy="33" r="1.8" fill="currentColor"/><circle cx="42" cy="15" r="3.5"/><circle cx="51" cy="8" r="2.2"/><circle cx="33" cy="11" r="2"/>',
    robot: '<rect x="14" y="20" width="36" height="28" rx="6"/><path d="M32 20v-8"/><circle cx="32" cy="9" r="3"/><circle cx="24" cy="32" r="4"/><circle cx="40" cy="32" r="4"/><path d="M24 41h4M30 41h4M36 41h4"/><path d="M14 29H9v10h5M50 29h5v10h-5"/>',
    romskip: '<path d="M32 5c9 8 12 20 10 34H22C20 25 23 13 32 5z"/><circle cx="32" cy="23" r="4.5"/><path d="M22 32l-8 11h9M42 32l8 11h-9"/><path d="M27 45c0 6 2 10 5 13 3-3 5-7 5-13"/>',
    gitar: '<path d="M37 27L52 12"/><path d="M50 7l7 7-4 4-7-7z"/><path d="M37 27c-5-4-11-3-14 2-5 0-10 3-12 8-3 9 5 18 14 15 6-2 8-7 8-11 5-2 8-8 4-14z"/><circle cx="25" cy="39" r="3"/><path d="M18 46l7-7"/>',
    naborom: '<rect x="9" y="9" width="25" height="47" rx="2"/><circle cx="28" cy="34" r="2" fill="currentColor"/><path d="M42 26c3 3 3 9 0 12M48 20c6 6 6 18 0 24M54 14c9 9 9 27 0 36"/>',

    normal: '<path d="M21 56h22L37 9h-10z"/><path d="M32 45l10-25"/><circle cx="42" cy="19" r="3.5"/>',
    ekorn: '<path d="M27 56C11 54 6 40 12 28c4-8 2-15-5-18 11-3 22 5 21 17-1 7-4 11-1 16"/><path d="M27 56h17c4 0 6-3 6-6 0-6-5-9-7-14"/><path d="M43 36c5-1 9-5 9-11 0-5-4-9-9-9s-8 4-8 9c0 4 2 7 5 9"/><path d="M38 17l1-7 5 6"/><circle cx="46" cy="24" r="1.7" fill="currentColor"/><path d="M38 44l-4 4"/>',
    troll: '<path d="M17 24L8 11l14 7M47 24l9-13-14 7"/><path d="M14 33c0-11 8-17 18-17s18 6 18 17v5c0 11-8 18-18 18S14 49 14 38z"/><circle cx="24" cy="30" r="2.6" fill="currentColor"/><circle cx="40" cy="30" r="2.6" fill="currentColor"/><path d="M29 31c-5 5-6 12 3 12s8-7 3-12"/><path d="M23 48h18"/><path d="M26 48v-4M38 48v-4"/>',
    sakte: '<path d="M7 50h39c7 0 10-4 10-11"/><circle cx="28" cy="35" r="14"/><path d="M28 35a3.5 3.5 0 1 1 3.5 3.5 8 8 0 1 1-8-8"/><path d="M52 34l-3-10M57 35l4-9"/><circle cx="49" cy="23" r="1.6" fill="currentColor"/><circle cx="61" cy="25" r="1.6" fill="currentColor"/>',
    kjapp: '<path d="M37 5L14 36h16l-4 23 24-33H34z"/>',
    baklengs: '<path d="M44 54V27a12 12 0 0 0-24 0v8"/><path d="M11 28l9 9 9-9"/>',

    ballade: '<path d="M32 54C14 42 8 32 8 23a12 12 0 0 1 24-5 12 12 0 0 1 24 5c0 9-6 19-24 31z"/>',
    reggae: '<path d="M31 58c2-12 2-24 5-34"/><path d="M36 24c-6-8-16-9-24-5 8 0 14 3 18 8"/><path d="M36 24c4-9 13-13 22-11-8 2-13 6-16 12"/><path d="M36 24c-2-8-8-14-15-15 5 4 8 9 9 15"/><path d="M36 24c8-2 16 1 20 8-6-3-12-4-18-2"/><path d="M18 58h28"/>',
    hiphop: '<rect x="6" y="22" width="52" height="30" rx="5"/><path d="M18 22v-6h28v6"/><circle cx="19" cy="38" r="7.5"/><circle cx="45" cy="38" r="7.5"/><circle cx="19" cy="38" r="2.2" fill="currentColor"/><circle cx="45" cy="38" r="2.2" fill="currentColor"/><path d="M28 29h8"/>',
    samba: '<ellipse cx="21" cy="19" rx="10" ry="12" transform="rotate(-22 21 19)"/><path d="M25 30l9 25"/><ellipse cx="44" cy="19" rx="10" ry="12" transform="rotate(22 44 19)"/><path d="M40 30l-9 25"/><circle cx="19" cy="17" r="1.6" fill="currentColor"/><circle cx="24" cy="21" r="1.6" fill="currentColor"/><circle cx="45" cy="16" r="1.6" fill="currentColor"/><circle cx="41" cy="21" r="1.6" fill="currentColor"/>',
    rock: '<rect x="12" y="7" width="40" height="50" rx="3"/><path d="M12 19h40"/><circle cx="19" cy="13" r="1.8" fill="currentColor"/><circle cx="26" cy="13" r="1.8" fill="currentColor"/><circle cx="33" cy="13" r="1.8" fill="currentColor"/><circle cx="32" cy="38" r="11"/><circle cx="32" cy="38" r="4"/>',
    disco: '<path d="M32 18V5"/><circle cx="32" cy="36" r="18"/><path d="M14 36h36M17 27h30M17 45h30"/><path d="M32 18c-7 6-7 30 0 36M32 18c7 6 7 30 0 36"/><path d="M52 7l1.6 4.4L58 13l-4.4 1.6L52 19l-1.6-4.4L46 13l4.4-1.6z"/>',
    techno: '<path d="M12 40v-8a20 20 0 0 1 40 0v8"/><rect x="7" y="37" width="11" height="17" rx="4"/><rect x="46" y="37" width="11" height="17" rx="4"/>',
    dnb: '<path d="M7 16l20 16-20 16z"/><path d="M30 16l20 16-20 16z"/><path d="M56 16v32"/>',
    trommer: '<ellipse cx="32" cy="31" rx="20" ry="7"/><path d="M12 31v15c0 4 9 8 20 8s20-4 20-8V31"/><path d="M20 37l4 14M32 38v16M44 37l-4 14"/><path d="M13 9l14 17M51 9L37 26"/>',
    ingenstil: '<ellipse cx="32" cy="31" rx="20" ry="7"/><path d="M12 31v15c0 4 9 8 20 8s20-4 20-8V31"/><path d="M20 37l4 14M32 38v16M44 37l-4 14"/><path d="M8 8l48 48"/>',

    mikrofon: '<rect x="23" y="7" width="18" height="31" rx="9"/><path d="M15 30a17 17 0 0 0 34 0M32 47v9M23 56h18"/>',
    stopp: '<rect x="18" y="18" width="28" height="28" rx="5" fill="currentColor"/>',
    spill: '<path d="M22 13l29 19-29 19z" fill="currentColor"/>',
    pause: '<rect x="17" y="13" width="10" height="38" rx="3" fill="currentColor" stroke="none"/><rect x="37" y="13" width="10" height="38" rx="3" fill="currentColor" stroke="none"/>',
    lastOpp: '<path d="M32 43V13M21 24l11-11 11 11"/><path d="M11 40v14h42V40"/>',
    lastNed: '<path d="M32 9v30M21 28l11 11 11-11"/><path d="M11 40v14h42V40"/>',
    stjerne: '<path d="M32 7l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 25l17-2z"/>',
    glidere: '<path d="M10 16h44M10 32h44M10 48h44"/><circle cx="22" cy="16" r="5.5" fill="var(--bakgrunn)"/><circle cx="42" cy="32" r="5.5" fill="var(--bakgrunn)"/><circle cx="28" cy="48" r="5.5" fill="var(--bakgrunn)"/>',
    nullstill: '<path d="M14 30a18 18 0 1 0 6-13"/><path d="M12 8v12h12"/>',
    note: '<path d="M26 46V14l22-5v31"/><circle cx="20" cy="46" r="6"/><circle cx="42" cy="40" r="6"/>'
  };

  function svg(navn, klasse) {
    var innhold = navn === '8bit' ? pikselfigur() : TEGNINGER[navn];
    if (innhold === undefined) innhold = TEGNINGER.note;
    return '<svg class="' + (klasse || 'ikon') + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false" ' + STREK + '>' + innhold + '</svg>';
  }

  return { svg: svg, navn: Object.keys(TEGNINGER).concat(['8bit']) };
})();
