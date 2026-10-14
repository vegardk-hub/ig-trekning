/*
 * Eksempeldata – en oppdiktet familie, regnet ut fra dagens dato.
 *
 * Brukes av `?demo` og av prøvene. Datafila har samme form som den synk-jobben
 * lager, og kalendrene er ekte ICS-tekst, så eksempelet går gjennom nøyaktig
 * samme kode som de virkelige kalendrene: gjentakelser, heldagshendelser over
 * flere dager, en flyttet forekomst og bursdager med alder.
 */
'use strict';

var Demo = (function () {

  function to(n) { return (n < 10 ? '0' : '') + n; }

  function dato(d) { return d.getFullYear() + to(d.getMonth() + 1) + to(d.getDate()); }

  function tid(d, t, m) { return dato(d) + 'T' + to(t) + to(m) + '00'; }

  function pluss(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  function kalender(navn, hendelser) {
    var l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//familietavle//demo//NO', 'X-WR-CALNAME:' + navn];
    hendelser.forEach(function (h, i) {
      l.push('BEGIN:VEVENT');
      if (!h.UID) l.push('UID:' + navn + '-' + i);
      Object.keys(h).forEach(function (k) { l.push(k + ':' + h[k]); });
      l.push('END:VEVENT');
    });
    l.push('END:VCALENDAR');
    return l.join('\r\n');
  }

  function heldag(d, dager, tittel) {
    return { 'DTSTART;VALUE=DATE': dato(d), 'DTEND;VALUE=DATE': dato(pluss(d, dager || 1)), SUMMARY: tittel };
  }

  function avtale(d, t1, m1, t2, m2, tittel, sted) {
    var h = { DTSTART: tid(d, t1, m1), DTEND: tid(d, t2, m2), SUMMARY: tittel };
    if (sted) h.LOCATION = sted;
    return h;
  }

  function vaer(naa) {
    var serie = [];
    var start = new Date(naa.getFullYear(), naa.getMonth(), naa.getDate(), naa.getHours());
    var symboler = ['partlycloudy_day', 'cloudy', 'lightrain', 'rain', 'fair_day', 'clearsky_day', 'lightrainshowers_day'];
    for (var i = 0; i < 120; i += (i < 48 ? 1 : 6)) {
      var t = new Date(start.getTime() + i * 3600000);
      var natt = t.getHours() < 7 || t.getHours() > 19;
      var sym = symboler[Math.floor(i / 9) % symboler.length];
      if (natt) sym = sym.replace('_day', '_night');
      var temp = 9 + 4 * Math.sin((t.getHours() - 9) / 24 * 2 * Math.PI) - i / 40;
      var p = {
        time: t.toISOString(),
        data: {
          instant: { details: { air_temperature: Math.round(temp * 10) / 10, wind_speed: 3.4 } },
          next_6_hours: { summary: { symbol_code: sym }, details: { precipitation_amount: /rain/.test(sym) ? 1.6 : 0 } }
        }
      };
      if (i < 48) p.data.next_1_hours = { summary: { symbol_code: sym }, details: { precipitation_amount: /rain/.test(sym) ? 0.4 : 0 } };
      serie.push(p);
    }
    return { properties: { timeseries: serie } };
  }

  function pakke(naa) {
    var d0 = new Date(naa.getFullYear(), naa.getMonth(), naa.getDate());
    var d = function (n) { return pluss(d0, n); };
    var aar = d0.getFullYear();
    function bursdag(n, fodt, navn) {
      var b = d(n);
      return {
        'DTSTART;VALUE=DATE': fodt + to(b.getMonth() + 1) + to(b.getDate()),
        'DTEND;VALUE=DATE': dato(new Date(fodt, b.getMonth(), b.getDate() + 1)),
        RRULE: 'FREQ=YEARLY', SUMMARY: navn
      };
    }

    var fotball = avtale(d(-14), 17, 0, 18, 30, 'Fotballtrening', 'Nadderud');
    fotball.RRULE = 'FREQ=WEEKLY;BYDAY=' + ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d0.getDay()] + ',' +
      ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d(2).getDay()];

    var korps = avtale(d(-30), 18, 0, 19, 30, 'Korpsøvelse', 'Bekkestua skole');
    korps.RRULE = 'FREQ=WEEKLY';
    korps.UID = 'korps';
    var korpsFlyttet = avtale(d(5), 17, 0, 18, 30, 'Korpsøvelse (flyttet)', 'Bekkestua skole');
    korpsFlyttet.UID = 'korps';
    korpsFlyttet['RECURRENCE-ID'] = tid(d(5 + ((d(-30).getDay() - d(5).getDay() + 7) % 7)), 18, 0);

    return {
      v: 1,
      hentet: naa.toISOString(),
      kalendere: [
        { navn: 'Mamma', rolle: 'person', ics: kalender('Mamma', [
          avtale(d(0), 18, 0, 19, 30, 'Foreldremøte 3B', 'Bekkestua skole'),
          avtale(d(1), 9, 30, 10, 0, 'Tannlege', 'Bekkestua tannklinikk'),
          avtale(d(3), 19, 0, 21, 0, 'Bokklubb'),
          heldag(d(4), 1, 'Fri fra jobb')
        ]) },
        { navn: 'Pappa', rolle: 'person', ics: kalender('Pappa', [
          heldag(d(0), 1, 'Hjemmekontor'),
          avtale(d(0), 20, 0, 21, 30, 'Innebandy'),
          avtale(d(2), 7, 15, 8, 0, 'Levere bil på service'),
          heldag(d(6), 2, 'Jobbreise Bergen')
        ]) },
        { navn: 'Ella', rolle: 'person', ics: kalender('Ella', [
          avtale(d(0), 14, 30, 15, 30, 'Svømming'),
          korps, korpsFlyttet,
          avtale(d(4), 12, 0, 15, 0, 'Bursdagsselskap hos Nora')
        ]) },
        { navn: 'Theo', rolle: 'person', ics: kalender('Theo', [
          fotball,
          heldag(d(3), 5, 'Høstferie'),
          avtale(d(1), 8, 0, 8, 30, 'Leseprøve')
        ]) },
        { navn: 'Middag', rolle: 'middag', ics: kalender('Middag', [
          'Taco', 'Fiskegrateng', 'Pasta bolognese', 'Pizzakveld', 'Kyllingsuppe', 'Lapskaus', 'Pannekaker'
        ].map(function (m, i) { return heldag(d(i), 1, m); })) },
        { navn: 'Bursdager', rolle: 'bursdager', ics: kalender('Bursdager', [
          bursdag(0, 1948, 'Bestefar'),
          bursdag(3, 1953, 'Mormor'),
          bursdag(12, aar - 9, 'Ella'),
          bursdag(26, 1981, 'Onkel Lars'),
          bursdag(45, aar - 6, 'Theo')
        ]) }
      ],
      vaer: vaer(naa)
    };
  }

  return { pakke: pakke, vaer: vaer };
})();

if (typeof module !== 'undefined') module.exports = Demo;
