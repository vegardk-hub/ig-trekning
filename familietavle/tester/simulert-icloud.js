/*
 * En simulert iCloud-familie – fem publiserte kalendre, skrevet slik Apple
 * skriver dem, for uka rundt onsdag 14. oktober 2026.
 *
 * Skyøkta når ikke iCloud, så dette er det nærmeste tavla kommer ekte data
 * før eieren har publisert sine egne. Filene er ikke laget for å være pene,
 * men for å ha alle særtrekkene en ekte iCloud-kalender har, og som de enkle
 * eksempelfilene i `demo.js` mangler:
 *
 * - VTIMEZONE-blokker, `X-APPLE-*`-felt, `X-APPLE-CALENDAR-COLOR`, VALARM.
 * - Linjer brettet etter 75 **byte**, også midt i en «ø» – verste tilfelle.
 * - Deltakere med kolon inni et sitert parameter (`CN="Kari: trener"`).
 * - En invitasjon som står i både Mammas og Pappas kalender, med samme UID.
 * - En flyttet og en avlyst forekomst av en ukentlig serie, med `TZID`.
 * - «Siste hverdag i måneden» (`BYSETPOS=-1`), og en serie med `WKST=SU`.
 * - En avtale i UTC (`Z`), som invitasjoner fra Outlook og Google gjerne er.
 * - En avtale over midnatt, en flerdagers heldagshendelse og en avlyst avtale.
 *
 * `forventet` lister det tavla skal vise. Prøvene i `data.js` og `icloud.js`
 * sjekker mot den, og en ny særhet hører hjemme både her og der.
 */
'use strict';

const NAA = new Date(2026, 9, 14, 13, 5);   // onsdag 14. oktober 2026, 13:05

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Oslo', 'X-LIC-LOCATION:Europe/Oslo',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19810329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19961027T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'
];

let teller = 0;
function hendelse(felt) {
  teller++;
  const l = ['BEGIN:VEVENT', 'CREATED:20260901T101010Z', 'DTSTAMP:20261013T080000Z',
    'LAST-MODIFIED:20261013T080000Z', 'SEQUENCE:1', 'TRANSP:OPAQUE'];
  if (!felt.some(f => f.startsWith('UID:'))) l.push('UID:' + (1000 + teller) + '-SIM-4E1C-A0B2-' + teller + '@icloud.com');
  l.push(...felt, 'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Påminnelse', 'TRIGGER:-PT15M',
    'UID:ALARM-' + teller, 'X-WR-ALARMUID:ALARM-' + teller, 'END:VALARM', 'END:VEVENT');
  return l;
}

const T = (d, t) => 'DTSTART;TZID=Europe/Oslo:' + d + 'T' + t;
const E = (d, t) => 'DTEND;TZID=Europe/Oslo:' + d + 'T' + t;
const HS = d => 'DTSTART;VALUE=DATE:' + d;
const HE = d => 'DTEND;VALUE=DATE:' + d;

// Felles invitasjon: samme UID i to kalendre, slik iCloud lagrer en avtale
// begge er invitert til.
const MIDDAGSBESOK = [
  'UID:5C1F2A9E-INVITASJON-KARI-ORJAN', T('20261016', '190000'), E('20261016', '230000'),
  'SUMMARY:Middag hos Kari og Ørjan', 'LOCATION:Gamle Ringeriksvei 12\\nBekkestua',
  'ORGANIZER;CN="Kari Nordmann":mailto:kari@example.com',
  'ATTENDEE;CN="Kari: vertinne";PARTSTAT=ACCEPTED;ROLE=CHAIR:mailto:kari@example.com',
  'ATTENDEE;CN=Pappa;PARTSTAT=ACCEPTED:mailto:pappa@example.com',
  'ATTENDEE;CN=Mamma;PARTSTAT=ACCEPTED:mailto:mamma@example.com'
];

function kalender(navn, farge, hendelser) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Apple Inc.//iCloud Web Calendar 2511B76//EN',
    'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + navn, 'X-APPLE-CALENDAR-COLOR:' + farge,
    'X-WR-TIMEZONE:Europe/Oslo', ...VTIMEZONE, ...[].concat(...hendelser.map(hendelse)), 'END:VCALENDAR'];
}

// Bretter etter 75 byte – med vilje uten hensyn til tegngrenser.
function brett(linjer) {
  const ut = [];
  for (const l of linjer) {
    let b = Buffer.from(l, 'utf8');
    ut.push(b.subarray(0, 75));
    b = b.subarray(75);
    while (b.length) { ut.push(Buffer.concat([Buffer.from(' '), b.subarray(0, 74)])); b = b.subarray(74); }
  }
  return Buffer.concat(ut.flatMap(b => [b, Buffer.from('\r\n')]));
}

// «DESCRIPTION:» er 12 byte, så med 62 byte ASCII foran havner «ø» på byte
// 75 og 76 – og bretten deler den i to. Lengden er regnet, ikke tilfeldig.
const FORAN = 'Husk matpakke, gymtoy og lanekort. Vi samles ved skolens ';
const LANG = FORAN + '.'.repeat(62 - Buffer.byteLength(FORAN)) + 'østre port. Møtet handler om ' +
  'skoleturen til Sørmarka, og foreldrerådet ønsker frivillige til å kjøre. ' +
  'Kaffe og vafler på pauserommet før møtet.';

function kalendere() {
  teller = 0;
  return [
    { navn: 'Mamma', fil: brett(kalender('Mamma', '#FF2968FF', [
      ['SUMMARY:Yoga', T('20260108', '190000'), E('20260108', '200000'),
        'RRULE:FREQ=WEEKLY;BYDAY=TH;WKST=MO', 'EXDATE;TZID=Europe/Oslo:20261015T190000'],
      ['SUMMARY:Foreldremøte 3B', T('20261014', '180000'), E('20261014', '193000'),
        'LOCATION:Bekkestua barneskole\\nGamle Ringeriksvei 30', 'DESCRIPTION:' + LANG,
        'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="Gamle Ringeriksvei 30, 1356 Bekkestua";' +
        'X-APPLE-RADIUS=70.5;X-TITLE="Bekkestua barneskole":geo:59.918,10.588'],
      MIDDAGSBESOK,
      ['SUMMARY:Lønning', HS('20260130'), HE('20260131'),
        'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1']
    ])) },
    { navn: 'Pappa', fil: brett(kalender('Pappa', '#1BADF8FF', [
      MIDDAGSBESOK,
      ['SUMMARY:Nattevakt', T('20261014', '220000'), E('20261015', '060000')],
      ['SUMMARY:Innebandy', T('20260902', '201500'), E('20260902', '213000'),
        'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,WE;WKST=SU'],
      ['SUMMARY:Jobbreise Bergen', HS('20261019'), HE('20261022')]
    ])) },
    { navn: 'Ella', fil: brett(kalender('Ella', '#63DA38FF', [
      ['UID:KORPS-ELLA-2026', 'SUMMARY:Korps', T('20260817', '180000'), E('20260817', '193000'),
        'RRULE:FREQ=WEEKLY;BYDAY=MO'],
      ['UID:KORPS-ELLA-2026', 'RECURRENCE-ID;TZID=Europe/Oslo:20261019T180000',
        'SUMMARY:Korps – ekstraøvelse før konsert', T('20261020', '173000'), E('20261020', '200000')],
      ['UID:KORPS-ELLA-2026', 'RECURRENCE-ID;TZID=Europe/Oslo:20261012T180000',
        'SUMMARY:Korps', T('20261012', '180000'), 'STATUS:CANCELLED'],
      ['SUMMARY:Svømming', 'DTSTART:20261014T123000Z', 'DTEND:20261014T133000Z',
        'ORGANIZER;CN=Bærum Svømmeklubb:mailto:post@example.com']
    ])) },
    { navn: 'Theo', fil: brett(kalender('Theo', '#CC73E1FF', [
      ['SUMMARY:Fotball', T('20260824', '170000'), E('20260824', '181500'),
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261031T215959Z', 'LOCATION:Nadderud'],
      ['SUMMARY:Høstferie', HS('20261017'), HE('20261022')],
      ['SUMMARY:Tannlege', T('20261015', '083000'), E('20261015', '090000'), 'STATUS:CANCELLED']
    ])) },
    { navn: 'Middag', fil: brett(kalender('Middag', '#FFCC00FF', [
      ['SUMMARY:Taco', HS('20261014'), HE('20261015')],
      ['SUMMARY:Fiskegrateng', HS('20261015'), HE('20261016')],
      // Ingen middag fredag – de er bortbedt.
      ['SUMMARY:Pizza', HS('20261017'), HE('20261018')],
      ['SUMMARY:Grillkveld', T('20261018', '170000'), E('20261018', '190000')],
      ['SUMMARY:Lapskaus', HS('20261019'), HE('20261020')],
      ['SUMMARY:Pannekaker', HS('20261020'), HE('20261021')]
    ])) },
    { navn: 'Søppel', fil: brett(kalender('Søppel', '#8E8E93FF', [
      // Bærums faste intervaller. Restavfall og papir faller på samme fredag.
      ['SUMMARY:Restavfall og matavfall', HS('20260109'), HE('20260110'), 'RRULE:FREQ=WEEKLY;INTERVAL=2'],
      ['SUMMARY:Papir og plast', HS('20260918'), HE('20260919'), 'RRULE:FREQ=WEEKLY;INTERVAL=4'],
      ['SUMMARY:Glass og metall', HS('20260828'), HE('20260829'), 'RRULE:FREQ=WEEKLY;INTERVAL=8']
    ])) },
    { navn: 'Bursdager', fil: brett(kalender('Bursdager', '#A2845EFF', [
      ['SUMMARY:Bestefar', HS('19481014'), HE('19481015'), 'RRULE:FREQ=YEARLY'],
      ['SUMMARY:Mormor', HS('19511017'), HE('19511018'), 'RRULE:FREQ=YEARLY'],
      ['SUMMARY:Tante Ragnhild', HS('20261102'), HE('20261103'), 'RRULE:FREQ=YEARLY'],
      ['SUMMARY:Onkel Lars', HS('19880229'), HE('19880301'), 'RRULE:FREQ=YEARLY']
    ])) }
  ];
}

// Det tavla skal vise kl. 13:05 onsdag 14. oktober.
const forventet = {
  // Én kolonne per person, i den rekkefølgen kalendrene står i oppsettet.
  idag: {
    Mamma: ['18:00 Foreldremøte 3B'],
    Pappa: ['20:15 Innebandy', '22:00 Nattevakt'],
    Ella: ['14:30 Svømming'],
    Theo: ['17:00 Fotball']
  },
  // 9.1.2026 + 20 × 2 uker gir 16.10; 18.9 + 4 uker gir 16.10; glass er 23.10.
  tomming: 'Søppel fredag: Papir og plast, Restavfall og matavfall',
  imorgen: ['Nattevakt –06:00'],                 // Yoga er strøket, tannlegen avlyst
  fredag16: ['Middag hos Kari og Ørjan 19:00'],    // én gang, med to farger
  mandag19: ['Høstferie', 'Jobbreise Bergen', 'Fotball 17:00'],   // korpset er flyttet
  tirsdag20: ['Høstferie', 'Jobbreise Bergen', 'Korps – ekstraøvelse før konsert 17:30'],
  // Uker som starter på søndag, annenhver uke. Med mandag som ukestart
  // ville det blitt 2.9, 6.9, 16.9, 20.9 … – samme regel, andre datoer.
  innebandy: ['2.9.2026', '13.9.2026', '16.9.2026', '27.9.2026', '30.9.2026', '11.10.2026', '14.10.2026'],
  lonning: ['30.10.2026', '30.11.2026', '31.12.2026'],
  middag: ['Taco', 'Fiskegrateng', '–', 'Pizza', 'Grillkveld', 'Lapskaus', 'Pannekaker'],
  bursdager: ['Bestefar fyller 78', 'Mormor blir 75', 'Tante Ragnhild']
};

module.exports = { NAA, kalendere, forventet, LANG };
