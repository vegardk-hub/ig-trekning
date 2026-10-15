/*
 * Ukeplanen fra skolen – leser teksten foreldrene limer inn i notatfeltet på
 * en hendelse i kalenderen «Ukeplan <barn>».
 *
 * Skolens ukeplan er en PDF med en tabell der det ikke går an å se sikkert
 * hvilken dag en lekse hører til; selv en språkmodell merker fordelingen som
 * «sannsynlig». Regler i JavaScript ville gjettet verre. Derfor er PDF-en
 * språkmodellens jobb (README har instruksen foreldrene gir Claude), og denne
 * fila leser bare det faste formatet som kommer ut:
 *
 *   ## Hendelser
 *   | Dato | Hendelse | Detaljer |
 *   | Ons 7.10 | Foreldremøte | 17.00–19.00. Felles oppstart i Kuben |
 *
 *   ## Lekser
 *   - Man: Skrivelekse …
 *
 *   ## Ukelekse
 *   - Ta med innesko
 *
 * Alt annet i teksten (SFO-mat, læringsmål, info fra skolen) hoppes over. Det
 * er ikke tavlas sak, og det er det som gjør at formatet tåler at modellen
 * legger til en seksjon den ene uka.
 *
 * Datoene regnes fra hendelsen planen ligger i, ikke fra overskriften: «Man»
 * er mandagen i den uka hendelsen står. En dato i tabellen («7.10») brukes
 * når den finnes, ellers ukedagen.
 */
'use strict';

var Ukeplan = (function () {

  var DAGER = { man: 0, tir: 1, ons: 2, tor: 3, fre: 4, lor: 5, lør: 5, son: 6, søn: 6 };

  // «Skole» alene er bare åpningstida, hver dag. Den står ikke på tavla –
  // «Skole, Nadderud Arena» gjør, for den sier noe.
  var BARE_SKOLE = /^skole\.?$/i;

  function rens(t) {
    return String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  }

  function mandagI(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7);
  }

  function seksjoner(tekst) {
    var ut = {}, navn = null;
    String(tekst || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (l) {
      var m = /^\s*#{2,3}\s*(.+?)\s*$/.exec(l);
      if (m) { navn = m[1].toLowerCase(); ut[navn] = []; return; }
      if (navn) ut[navn].push(l);
    });
    return ut;
  }

  function finn(s, ord) {
    var k = Object.keys(s).filter(function (n) { return n.indexOf(ord) === 0; })[0];
    return k ? s[k] : [];
  }

  // «Man 5.10», «Mandag», «5.10» → dato i uka som begynner `mandag`.
  function dato(celle, mandag) {
    var t = rens(celle).toLowerCase();
    var m = /(\d{1,2})\.(\d{1,2})/.exec(t);
    if (m) {
      var d = +m[1], mnd = +m[2] - 1;
      // Årsskiftet: en plan for uke 1 kan ha 30.12 i seg.
      var aar = mandag.getFullYear();
      if (mnd === 0 && mandag.getMonth() === 11) aar++;
      if (mnd === 11 && mandag.getMonth() === 0) aar--;
      return new Date(aar, mnd, d);
    }
    var dag = DAGER[t.slice(0, 3)];
    return dag === undefined ? null : new Date(mandag.getFullYear(), mandag.getMonth(), mandag.getDate() + dag);
  }

  function klokke(tekst, d) {
    var m = /(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})/.exec(tekst);
    if (!m) return null;
    return {
      start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), +m[1], +m[2]),
      slutt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), +m[3], +m[4])
    };
  }

  function punkter(linjer) {
    return linjer.map(function (l) { return /^\s*[-*•]\s+(.+)$/.exec(l); })
      .filter(Boolean).map(function (m) { return m[1]; });
  }

  // Gir { hendelser, lekser, ukelekser } for uka `start` ligger i.
  function les(tekst, start) {
    var mandag = mandagI(start);
    var s = seksjoner(tekst);
    var ut = { mandag: mandag, hendelser: [], lekser: [], ukelekser: [] };

    finn(s, 'hendelse').forEach(function (l) {
      if (!/^\s*\|/.test(l)) return;
      var c = l.split('|').slice(1, -1).map(function (x) { return x.trim(); });
      if (c.length < 2 || /^-+$/.test(c[0].replace(/[:\s]/g, '')) || /^dato$/i.test(c[0])) return;
      var d = dato(c[0], mandag);
      var tittel = rens(c[1]);
      if (!d || !tittel || BARE_SKOLE.test(tittel)) return;
      var detaljer = rens(c[2]);
      var tid = klokke(detaljer, d);
      // Klokkeslettet står i tittelen på tavla, så det trengs ikke i detaljene.
      detaljer = detaljer.replace(/^\s*\d{1,2}[.:]\d{2}\s*[–-]\s*\d{1,2}[.:]\d{2}\.?\s*/, '');
      ut.hendelser.push({
        start: tid ? tid.start : d,
        slutt: tid ? tid.slutt : new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
        heldag: !tid, tittel: tittel, detaljer: detaljer
      });
    });

    punkter(finn(s, 'lekse')).forEach(function (p) {
      var m = /^([A-Za-zæøåÆØÅ]{3})[a-zæøå]*\s*:\s*(.+)$/.exec(p);
      if (!m || DAGER[m[1].toLowerCase()] === undefined) return;
      var d = new Date(mandag.getFullYear(), mandag.getMonth(), mandag.getDate() + DAGER[m[1].toLowerCase()]);
      var t = rens(m[2]);
      if (t) ut.lekser.push({ dag: d, tekst: t });
    });

    punkter(finn(s, 'ukelekse')).forEach(function (p) {
      var t = rens(p);
      if (t) ut.ukelekser.push(t);
    });
    return ut;
  }

  return { les: les, mandagI: mandagI };
})();

if (typeof module !== 'undefined') module.exports = Ukeplan;
