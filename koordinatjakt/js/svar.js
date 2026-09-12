/*
 * Om et skrevet svar er riktig.
 *
 * Dette er den vanskeligste delen av skrivemodus, og grunnen står i
 * premisset: **arket øver koordinater, ikke rettskriving.** Et barn som
 * finner sjiraffen i C4 og skriver «sjiraf», har løst oppgaven. En app som
 * svarer nei på det, måler feil ferdighet og gjør en seier om til et
 * nederlag.
 *
 * Derfor godtas fire ting utover det eksakte ordet:
 *
 *   1. **Artikkel og bestemt form.** «en løve», «løven», «løva», «løvene».
 *      Barnet ser dyret, ikke oppslagsformen.
 *   2. **Æ, ø og å skrevet som ae, o og a.** På et tastatur som står på
 *      engelsk, er det ikke en feil, det er et tastaturvalg.
 *   3. **Én skrivefeil**, inkludert to ombyttede bokstaver – «elefnat» er
 *      den vanligste feilen som finnes hos en som akkurat har lært å skrive.
 *   4. **Kjente alternative ord.** «gatelys» for en lyktestolpe, «fjøs» for
 *      en låve. Barnet har funnet riktig ting og kalt den noe annet riktig.
 *
 * Og tre ting som *ikke* godtas, fordi de gjør fasiten utydelig:
 *
 *   - **Korte ord må treffe eksakt.** Samme lærdom som ordmatchingen i
 *     Monstergiret: med én bokstavs slingring på «ku» og «katt» blir halve
 *     banken riktig svar på alt. Grensa går ved fem bokstaver.
 *   - **Et svar som ligger like nær et annet ord på brettet, teller ikke.**
 *     «kart» og «katt» er én bokstav fra hverandre. Ligger begge på brettet,
 *     må barnet skrive nøyaktig.
 *   - **Delvis skrevne ord.** Toleransen gjelder når barnet sier seg ferdig,
 *     ikke mens det skriver. Ellers låser feltet seg på «elefan».
 *
 * Merk at regelen fra Monstergiret om at appen aldri skal avvise, *ikke*
 * gjelder her. Den kommer av at talegjenkjenning bommer på barnestemmer, så
 * et «feil» ville rammet barn som leste riktig. Et skrevet svar er ikke
 * usikkert på den måten: det står nøyaktig det barnet skrev. Her er det
 * ærlig å si at det ikke stemte – appen sier det bare uten å farge noe rødt.
 */
'use strict';

var Svar = (function () {

  /* Endelser barnet legger på av seg selv. Bestemt form, flertall, og
     flertall i bestemt form – «løve», «løven», «løva», «løver», «løvene». */
  var ENDELSER = ['', 'n', 'en', 'a', 'et', 't', 'r', 'er', 'ne', 'ene', 'ane', 'ar', 'ene'];

  // Toleranse for skrivefeil krever et ord langt nok til å tåle det.
  var MINSTELENGDE = 5;

  function normaliser(tekst) {
    var s = String(tekst == null ? '' : tekst).toLowerCase().trim();
    // Artikkelen strykes før mellomrommene, ellers finnes den ikke lenger.
    s = s.replace(/^(en|ei|et|den|det)\s+/, '');
    s = s.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');
    // Alt som ikke er bokstav eller tall bort: mellomrom, bindestrek, punktum.
    return s.replace(/[^a-z0-9]/g, '');
  }

  /* Damerau-Levenshtein, ikke vanlig Levenshtein. Forskjellen er ombytte:
     «elefnat» ligger to vanlige redigeringer fra «elefant», men én ombytting.
     Det er den feilen en sjuåring gjør oftest, og den må koste én. */
  function avstand(a, b) {
    if (a === b) return 0;
    var n = a.length, m = b.length;
    if (!n) return m;
    if (!m) return n;
    var d = [];
    for (var i = 0; i <= n; i++) { d[i] = [i]; }
    for (var j = 0; j <= m; j++) { d[0][j] = j; }
    for (i = 1; i <= n; i++)
      for (j = 1; j <= m; j++) {
        var pris = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + pris);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1))
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    return d[n][m];
  }

  /* Alle formene ett ord kan skrives i, normalisert.

     Et ord på -e mister den i hunkjønn bestemt form: «løve» blir «løva», ikke
     «løvea». Derfor legges endelsene også på stammen uten e-en. Den nakne
     stammen tas ikke med – «lov» skal ikke være et gyldig svar på løve. */
  function former(ord, alternativer) {
    var ut = [];
    function legg(form) { if (form && ut.indexOf(form) === -1) ut.push(form); }

    [ord].concat(alternativer || []).forEach(function (r) {
      var n = normaliser(r);
      if (!n) return;
      ENDELSER.forEach(function (e) { legg(n + e); });
      if (n.charAt(n.length - 1) === 'e') {
        var stamme = n.slice(0, -1);
        ENDELSER.forEach(function (e) { if (e) legg(stamme + e); });
      }
    });
    return ut;
  }

  // Korteste avstand fra et normalisert svar til noen av ordets former.
  function naerhet(normalisertSvar, ord, alternativer) {
    var beste = 99;
    former(ord, alternativer).forEach(function (f) {
      var d = avstand(normalisertSvar, f);
      if (d < beste) beste = d;
    });
    return beste;
  }

  function toleranse(ord) {
    return normaliser(ord).length >= MINSTELENGDE ? 1 : 0;
  }

  /*
   * `oppgave`  – { ord, alternativer }
   * `andre`    – de øvrige funnene på brettet, samme form. Brukes bare til å
   *              avvise en skrivefeil som peker like godt på noe annet.
   * `streng`   – true mens barnet skriver: bare eksakt treff godtas, ellers
   *              låser feltet seg på et halvskrevet ord.
   */
  function godtar(svar, oppgave, andre, streng) {
    var n = normaliser(svar);
    if (!n) return false;
    var d = naerhet(n, oppgave.ord, oppgave.alternativer);
    if (d === 0) return true;
    if (streng) return false;
    if (d > toleranse(oppgave.ord)) return false;
    // En skrivefeil som passer like godt på et annet ord på brettet, duger ikke.
    for (var i = 0; i < (andre || []).length; i++)
      if (naerhet(n, andre[i].ord, andre[i].alternativer) <= d) return false;
    return true;
  }

  return {
    normaliser: normaliser,
    avstand: avstand,
    former: former,
    naerhet: naerhet,
    toleranse: toleranse,
    godtar: godtar,
    ENDELSER: ENDELSER,
    MINSTELENGDE: MINSTELENGDE
  };
})();
