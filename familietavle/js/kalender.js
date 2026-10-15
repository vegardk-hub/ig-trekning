/*
 * Kalenderfilene – leser ICS, folder ut gjentakelser og beskjærer.
 *
 * Tavla får kalendrene som publiserte iCloud-lenker, altså rå ICS. Det finnes
 * ingen tjeneste i midten som gjør tolkningen for oss, så den gjøres her. Fila
 * brukes to steder: i nettleseren, som viser hendelsene, og i synk-jobben i
 * GitHub Actions, som beskjærer filene før de krypteres (se `beskjaer`).
 *
 * Tre ting ser ut som detaljer og er det ikke:
 *
 * - **Gjentakelser foldes ut i veggtid, ikke i millisekunder.** En avtale
 *   hver tirsdag kl. 17 skal stå kl. 17 også etter overgangen til vintertid.
 *   Legger man til 7 × 24 timer, havner den kl. 16 fra slutten av oktober.
 *   Derfor flyttes dato-feltene i et lokalt `Date`, og klokkeslettet står.
 * - **Bursdager 29. februar havner på 28. februar** i år uten skuddår. Etter
 *   RFC 5545 skal de hoppes over, men en tavle som glemmer en bursdag tre år av
 *   fire, er en tavle som ikke blir trodd.
 * - **Flyttede forekomster** (`RECURRENCE-ID`) erstatter den opprinnelige.
 *   Uten det står en flyttet trening både på gammel og ny tid.
 */
'use strict';

var Kalender = (function () {

  var DAG = 86400000;
  var UKEDAGER = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  function lokalSone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; }
  }

  // ---- Linjer og felt ---------------------------------------------------

  // ICS bretter lange linjer: en linje som starter med mellomrom eller tab,
  // hører til linja over.
  function linjer(tekst) {
    return String(tekst).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  }

  function felt(linje) {
    var iAnf = false, i;
    for (i = 0; i < linje.length; i++) {
      var c = linje.charAt(i);
      if (c === '"') iAnf = !iAnf;
      else if (c === ':' && !iAnf) break;
    }
    if (i >= linje.length) return null;
    var deler = linje.slice(0, i).split(';');
    var param = {};
    for (var j = 1; j < deler.length; j++) {
      var lik = deler[j].indexOf('=');
      if (lik > 0) param[deler[j].slice(0, lik).toUpperCase()] = deler[j].slice(lik + 1).replace(/^"|"$/g, '');
    }
    return { navn: deler[0].toUpperCase(), param: param, verdi: linje.slice(i + 1) };
  }

  function tekstverdi(v) {
    return v.replace(/\\([nN,;\\])/g, function (_, c) { return c === 'n' || c === 'N' ? '\n' : c; });
  }

  // ---- Tid --------------------------------------------------------------

  // Forskjellen mellom veggtida i en sone og UTC, i millisekunder.
  function soneforskyvning(ms, sone) {
    var f = new Intl.DateTimeFormat('en-US', {
      timeZone: sone, hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var d = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { d[p.type] = +p.value; });
    return Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute, d.second) - ms;
  }

  function veggtid(a, sone) {
    var gjett = Date.UTC(a[0], a[1], a[2], a[3], a[4], a[5]);
    try {
      var t = gjett - soneforskyvning(gjett, sone);
      return new Date(gjett - soneforskyvning(t, sone));
    } catch (e) {
      // Ukjent sonenavn (Outlook skriver gjerne «W. Europe Standard Time»):
      // lokal tid er en bedre gjetning enn ingenting.
      return new Date(a[0], a[1], a[2], a[3], a[4], a[5]);
    }
  }

  // Gir { tid: Date, heldag: bool }. Heldagshendelser får lokal midnatt.
  function tid(verdi, param) {
    var m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(Z)?)?$/.exec(String(verdi).trim());
    if (!m) return null;
    var a = [+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
    if (!m[4] || (param && param.VALUE === 'DATE')) {
      return { tid: new Date(a[0], a[1], a[2]), heldag: true };
    }
    if (m[7]) return { tid: new Date(Date.UTC(a[0], a[1], a[2], a[3], a[4], a[5])), heldag: false };
    var sone = param && param.TZID;
    if (sone && sone !== lokalSone()) return { tid: veggtid(a, sone), heldag: false };
    return { tid: new Date(a[0], a[1], a[2], a[3], a[4], a[5]), heldag: false };
  }

  function varighet(v) {
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v || '');
    if (!m) return null;
    var dager = (+(m[2] || 0)) * 7 + (+(m[3] || 0));
    var ms = ((+(m[4] || 0)) * 3600 + (+(m[5] || 0)) * 60 + (+(m[6] || 0))) * 1000;
    var fortegn = m[1] === '-' ? -1 : 1;
    return { dager: fortegn * dager, ms: fortegn * ms };
  }

  function plussDager(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n,
      d.getHours(), d.getMinutes(), d.getSeconds());
  }

  function dagerIMnd(aar, mnd) { return new Date(aar, mnd + 1, 0).getDate(); }

  // ---- Lesing -----------------------------------------------------------

  function regel(v) {
    var r = {};
    v.split(';').forEach(function (del) {
      var lik = del.indexOf('=');
      if (lik > 0) r[del.slice(0, lik).toUpperCase()] = del.slice(lik + 1);
    });
    var ut = {
      frekvens: r.FREQ,
      intervall: Math.max(1, +(r.INTERVAL || 1)),
      antall: r.COUNT ? +r.COUNT : null,
      til: r.UNTIL ? tid(r.UNTIL) : null,
      ukedager: null, mnddager: null, mnder: null, posisjoner: null,
      // Uka begynner på mandag i Norge, men en iPhone på engelsk skriver
      // WKST=SU. Med INTERVAL=2 gir de to forskjellige datoer.
      ukestart: r.WKST && UKEDAGER[r.WKST.toUpperCase()] !== undefined ? UKEDAGER[r.WKST.toUpperCase()] : 1
    };
    if (r.BYDAY) {
      ut.ukedager = r.BYDAY.split(',').map(function (s) {
        var m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(s.trim().toUpperCase());
        return m ? { nr: m[1] ? +m[1] : 0, dag: UKEDAGER[m[2]] } : null;
      }).filter(Boolean);
    }
    if (r.BYMONTHDAY) ut.mnddager = r.BYMONTHDAY.split(',').map(Number);
    if (r.BYMONTH) ut.mnder = r.BYMONTH.split(',').map(function (n) { return +n - 1; });
    // «Siste hverdag i måneden» er BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1.
    if (r.BYSETPOS) ut.posisjoner = r.BYSETPOS.split(',').map(Number);
    return ut;
  }

  // Leser en hel ICS-tekst. Gir { navn, farge, hendelser }.
  function les(tekst) {
    var hendelser = [], navn = '', farge = '', h = null, dybde = 0;
    linjer(tekst).forEach(function (l) {
      var f = felt(l);
      if (!f) return;
      if (f.navn === 'BEGIN') {
        if (f.verdi === 'VEVENT' && !h) { h = { exdato: [] }; dybde = 0; }
        else if (h) dybde++;          // VALARM o.l. inni hendelsen
        return;
      }
      if (f.navn === 'END') {
        if (h && f.verdi === 'VEVENT' && dybde === 0) { hendelser.push(h); h = null; }
        else if (h) dybde--;
        return;
      }
      if (!h) {
        if (f.navn === 'X-WR-CALNAME') navn = tekstverdi(f.verdi);
        // Fargen kalenderen har på iPhone. Tavla bruker den, så Ellas
        // avtaler er grønne både på veggen og i lomma.
        var m = f.navn === 'X-APPLE-CALENDAR-COLOR' && /^#([0-9a-f]{6})/i.exec(f.verdi);
        if (m) farge = '#' + m[1].toLowerCase();
        return;
      }
      if (dybde > 0) return;
      switch (f.navn) {
        case 'UID': h.uid = f.verdi; break;
        case 'SUMMARY': h.tittel = tekstverdi(f.verdi); break;
        case 'LOCATION': h.sted = tekstverdi(f.verdi); break;
        // Notatfeltet. Ukeplanen ligger her, se ukeplan.js.
        case 'DESCRIPTION': h.beskrivelse = tekstverdi(f.verdi); break;
        case 'STATUS': h.status = f.verdi.toUpperCase(); break;
        case 'DTSTART': h.start = tid(f.verdi, f.param); break;
        case 'DTEND': h.slutt = tid(f.verdi, f.param); break;
        case 'DURATION': h.varighet = varighet(f.verdi); break;
        case 'RRULE': h.regel = regel(f.verdi); break;
        case 'RECURRENCE-ID': h.gjelder = tid(f.verdi, f.param); break;
        case 'EXDATE':
          f.verdi.split(',').forEach(function (v) {
            var t = tid(v, f.param);
            if (t) h.exdato.push(t.tid.getTime());
          });
          break;
      }
    });
    return { navn: navn, farge: farge, hendelser: hendelser.filter(function (e) { return e.start; }) };
  }

  // ---- Gjentakelser -----------------------------------------------------

  // Kandidatene i én periode (dag, uke, måned, år), i stigende rekkefølge.
  function periode(start, r, k) {
    var t = [start.getHours(), start.getMinutes(), start.getSeconds()];
    var ut = [];
    function dato(a, m, d) { return new Date(a, m, d, t[0], t[1], t[2]); }

    function iMaaned(aar, mnd) {
      var antall = dagerIMnd(aar, mnd), d;
      if (r.mnddager) {
        r.mnddager.forEach(function (n) {
          d = n > 0 ? n : antall + n + 1;
          if (d >= 1 && d <= antall) ut.push(dato(aar, mnd, d));
        });
      } else if (r.ukedager) {
        r.ukedager.forEach(function (u) {
          var treff = [];
          for (d = 1; d <= antall; d++) if (new Date(aar, mnd, d).getDay() === u.dag) treff.push(d);
          if (u.nr === 0) treff.forEach(function (x) { ut.push(dato(aar, mnd, x)); });
          else {
            var x = u.nr > 0 ? treff[u.nr - 1] : treff[treff.length + u.nr];
            if (x) ut.push(dato(aar, mnd, x));
          }
        });
      } else {
        d = start.getDate();
        // 31. i en måned med 30 dager hoppes over, som RFC-en sier – bortsett
        // fra årlige hendelser, se fila over.
        if (d <= antall) ut.push(dato(aar, mnd, d));
        else if (r.frekvens === 'YEARLY') ut.push(dato(aar, mnd, antall));
      }
    }

    switch (r.frekvens) {
      case 'DAILY':
        ut.push(plussDager(start, k * r.intervall));
        break;
      case 'WEEKLY':
        var w = r.ukestart;
        var forste = plussDager(start, -((start.getDay() - w + 7) % 7) + k * 7 * r.intervall);
        var dager = r.ukedager ? r.ukedager.map(function (u) { return u.dag; }) : [start.getDay()];
        dager.map(function (d) { return (d - w + 7) % 7; }).sort().forEach(function (i) {
          ut.push(plussDager(forste, i));
        });
        break;
      case 'MONTHLY':
        var mnd = start.getMonth() + k * r.intervall;
        iMaaned(start.getFullYear() + Math.floor(mnd / 12), ((mnd % 12) + 12) % 12);
        break;
      case 'YEARLY':
        var aar = start.getFullYear() + k * r.intervall;
        (r.mnder || [start.getMonth()]).forEach(function (m) { iMaaned(aar, m); });
        break;
    }
    ut.sort(function (a, b) { return a - b; });
    if (r.posisjoner) {
      var valgt = [];
      r.posisjoner.forEach(function (p) {
        var d = p > 0 ? ut[p - 1] : ut[ut.length + p];
        if (d && valgt.indexOf(d) < 0) valgt.push(d);
      });
      ut = valgt.sort(function (a, b) { return a - b; });
    }
    return ut;
  }

  function filtrer(d, r) {
    if (r.mnder && r.mnder.indexOf(d.getMonth()) < 0) return false;
    if (r.frekvens === 'DAILY') {
      if (r.ukedager && !r.ukedager.some(function (u) { return u.dag === d.getDay(); })) return false;
      if (r.mnddager && r.mnddager.indexOf(d.getDate()) < 0) return false;
    }
    return true;
  }

  // Alle starttidspunkt for en hendelse som kan berøre [fra, til).
  function starter(h, fra, til, lengde) {
    var start = h.start.tid;
    var r = h.regel;
    if (!r || !r.frekvens) return [start];
    var ut = [];
    var grense = r.til ? r.til.tid.getTime() + (r.til.heldag ? DAG - 1 : 0) : Infinity;
    var talt = 0;
    var k = 0;
    // Uten COUNT kan vi hoppe rett fram til vinduet. Med COUNT må vi telle
    // fra begynnelsen, ellers stopper serien på feil sted.
    if (r.antall === null && (r.frekvens === 'DAILY' || r.frekvens === 'WEEKLY')) {
      var steg = (r.frekvens === 'DAILY' ? 1 : 7) * r.intervall * DAG;
      k = Math.max(0, Math.floor((fra - lengde - start) / steg) - 1);
    }
    for (var vern = 0; vern < 20000; vern++, k++) {
      var kand = periode(start, r, k);
      if (kand.length && kand[0] > til) break;
      for (var i = 0; i < kand.length; i++) {
        var d = kand[i];
        if (d < start || !filtrer(d, r)) continue;
        if (d.getTime() > grense) return ut;
        talt++;
        if (r.antall !== null && talt > r.antall) return ut;
        if (d < til && d.getTime() + lengde > fra.getTime() - (lengde ? 0 : 1)) ut.push(d);
      }
      if (r.frekvens === 'YEARLY' && k > 400) break;
    }
    return ut;
  }

  function lengdeAv(h) {
    if (h.slutt) return Math.max(0, h.slutt.tid - h.start.tid);
    if (h.varighet) return h.varighet.dager * DAG + h.varighet.ms;
    return h.start.heldag ? DAG : 0;
  }

  // Forekomstene som overlapper [fra, til), sortert etter start.
  // Hver forekomst: { start, slutt, heldag, tittel, sted, uid }.
  function forekomster(hendelser, fra, til) {
    var flyttet = {};
    hendelser.forEach(function (h) {
      if (h.gjelder && h.uid) flyttet[h.uid + '|' + h.gjelder.tid.getTime()] = true;
    });
    var ut = [];
    hendelser.forEach(function (h) {
      if (h.status === 'CANCELLED') return;
      var lengde = lengdeAv(h);
      var dager = h.start.heldag ? Math.max(1, Math.round(lengde / DAG)) : 0;
      starter(h, fra, til, lengde).forEach(function (s) {
        var ms = s.getTime();
        if (s >= til) return;
        if (!h.gjelder && (h.exdato.indexOf(ms) >= 0 || flyttet[h.uid + '|' + ms])) return;
        var slutt = h.start.heldag ? plussDager(s, dager) : new Date(ms + lengde);
        if (slutt <= fra && !(slutt.getTime() === ms && ms >= fra.getTime())) return;
        ut.push({
          start: s, slutt: slutt, heldag: h.start.heldag,
          tittel: h.tittel || '', sted: h.sted || '', uid: h.uid || '',
          beskrivelse: h.beskrivelse || '',
          forste: h.start.tid
        });
      });
    });
    ut.sort(function (a, b) {
      return (a.start - b.start) || ((b.heldag ? 1 : 0) - (a.heldag ? 1 : 0)) ||
        a.tittel.localeCompare(b.tittel, 'nb');
    });
    return ut;
  }

  // ---- Beskjæring -------------------------------------------------------

  // Fjerner hendelser som er helt ferdige før `fra`. En familiekalender i iCloud
  // har gjerne ti år med historikk, og tavla henter fila hvert femte minutt –
  // uten beskjæring er det fort et par hundre megabyte i døgnet over wifi.
  // Gjentakende hendelser beholdes så lenge serien kan ha forekomster igjen.
  function beskjaer(tekst, fra) {
    var ls = String(tekst).replace(/\r\n?/g, '\n').split('\n');
    var ut = [], blokk = null;
    for (var i = 0; i < ls.length; i++) {
      var l = ls[i];
      if (blokk === null && /^BEGIN:VEVENT\s*$/i.test(l)) { blokk = [l]; continue; }
      if (blokk !== null) {
        blokk.push(l);
        if (/^END:VEVENT\s*$/i.test(l)) {
          var h = les('BEGIN:VCALENDAR\n' + blokk.join('\n') + '\nEND:VCALENDAR').hendelser[0];
          if (!h || behold(h, fra)) Array.prototype.push.apply(ut, blokk);
          blokk = null;
        }
        continue;
      }
      ut.push(l);
    }
    if (blokk) Array.prototype.push.apply(ut, blokk);
    return ut.join('\r\n');
  }

  function behold(h, fra) {
    if (h.regel && h.regel.frekvens) {
      if (h.regel.til) return h.regel.til.tid.getTime() + DAG > fra.getTime();
      if (h.regel.antall !== null) {
        return starter(h, fra, new Date(8.64e15), lengdeAv(h)).length > 0;
      }
      return true;
    }
    var slutt = h.start.tid.getTime() + lengdeAv(h);
    var flyttetFra = h.gjelder ? h.gjelder.tid.getTime() : -Infinity;
    return Math.max(slutt, h.start.tid.getTime(), flyttetFra) >= fra.getTime();
  }

  return {
    les: les,
    forekomster: forekomster,
    beskjaer: beskjaer,
    _tid: tid
  };
})();

if (typeof module !== 'undefined') module.exports = Kalender;
