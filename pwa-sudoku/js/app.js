'use strict';
/*
 * app.js — brukergrensesnitt: rutenett, tastatur, blyantmerker og hint.
 */
(function () {

  const C = window.SudokuCore;
  const S = window.SudokuSolver;
  const G = window.SudokuGenerator;
  const $ = sel => document.querySelector(sel);

  const LAGER = 'sudoku-v1';

  const state = {
    gitt: new Uint8Array(81),        // oppgavens faste tall (0 = tom)
    verdier: new Uint8Array(81),
    losning: new Uint8Array(81),
    elim: new Int16Array(81),        // kandidater strøket via hint
    blyant: new Int16Array(81),      // manuelle blyantmerker
    /* Blyantmerkene har tre trinn, ikke to: 'auto' regner dem ut selv,
       'manuell' overlater de beregnede til deg, 'tom' fjerner dem. */
    merkeModus: 'auto',
    blyantModus: false,
    fyllModus: false,                // tall først: velg tallet, trykk så rutene
    aktivtTall: 0,                   // tallet som fylles inn (0 = ingen valgt)
    aktivtBlyant: false,             // om det aktive tallet skal bli merke eller tall
    nivaa: 'middels',
    maksNavn: '',
    valgt: -1
  };

  let kandidater = new Int16Array(81);
  let hint = null, hintSteg = 0;

  /* ---------- Bygg rutenett og tastatur ---------- */

  const brettEl = $('#brett');
  const celler = [];

  for (let i = 0; i < 81; i++) {
    const el = document.createElement('div');
    el.className = 'celle';
    el.dataset.i = i;
    el.setAttribute('role', 'gridcell');

    const stor = document.createElement('span');
    stor.className = 'tall-stor';

    const merker = document.createElement('span');
    merker.className = 'merker';
    const marks = [];
    for (let d = 1; d <= 9; d++) {
      const s = document.createElement('i');
      s.textContent = d;
      merker.appendChild(s);
      marks.push(s);
    }

    el.append(stor, merker);
    brettEl.appendChild(el);
    celler.push({ el, stor, marks });
  }

  /*
   * Tastaturet finnes i to like sett, ett på hver side av brettet, så alt kan
   * nås med begge tomler når telefonen ligger. Derfor bygges knappene herfra i
   * stedet for å stå i markupen: to sett i HTML ville betydd doble id-er.
   * Trykk fanges med delegering, så det er likegyldig hvilket sett du bruker.
   */
  const VERKTOY = [
    { id: 'slett',  symbol: '⌫', tekst: 'Slett' },
    { id: 'angre',  symbol: '↶', tekst: 'Angre' },
    { id: 'gjorom', symbol: '↷', tekst: 'Gjør om' },
    { id: 'fyll',   symbol: '⊞', tekst: 'Fyll' },
    { id: 'blyant', symbol: '✎', tekst: 'Blyant' },
    { id: 'auto',   symbol: '◈', tekst: 'Auto' },
    { id: 'hint',   symbol: '?', tekst: 'Hint' },
    { id: 'nytt',   symbol: '✦', tekst: 'Nytt spill' }
  ];

  const $$ = sel => document.querySelectorAll(sel);
  const tallKnapper = d => $$('.tallknapp[data-d="' + d + '"]');
  const verktoyKnapper = id => $$('.verktoyknapp[data-verktoy="' + id + '"]');

  /*
   * Liggende er tastaturet delt etter side: venstre fører blyant, høyre skriver
   * tall. Da er «Blyant» overflødig, og den er skjult der.
   *
   * Om vi er delt, spør vi DOM-en om — CSS eier den avgjørelsen, og en kopi av
   * mediaspørningen her ville bare vært noe å holde i takt.
   */
  const hoyreSide = $('.side.hoyre');
  const erDelt = () => hoyreSide.offsetWidth > 0;
  const erBlyantside = knapp => knapp.closest('.side').classList.contains('venstre');

  $$('.side').forEach(side => {
    const tall = side.querySelector('.tall');
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement('button');
      b.className = 'tallknapp';
      b.dataset.d = d;
      const siffer = document.createElement('span');
      siffer.className = 'siffer';
      siffer.textContent = d;
      const igjen = document.createElement('span');   // hvor mange av tallet som mangler
      igjen.className = 'igjen';
      b.append(siffer, igjen);
      tall.appendChild(b);
    }

    const verktoy = side.querySelector('.verktoy');
    VERKTOY.forEach(v => {
      const b = document.createElement('button');
      b.className = 'knapp verktoyknapp';
      b.dataset.verktoy = v.id;
      const symbol = document.createElement('span');
      symbol.className = 'vsymbol';
      symbol.textContent = v.symbol;
      const tekst = document.createElement('span');
      tekst.className = 'vtekst';
      tekst.textContent = v.tekst;
      b.append(symbol, tekst);
      verktoy.appendChild(b);
    });
  });

  /* ---------- Fargeoppsett ---------- */

  const temaKnapper = [];
  const temaListe = $('#temaliste');

  window.SudokuTema.TEMAER.forEach(t => {
    const b = document.createElement('button');
    b.className = 'temavalg';
    b.dataset.tema = t.id;
    b.setAttribute('role', 'radio');

    const prove = document.createElement('span');
    prove.className = 'prove';
    prove.style.background = 'linear-gradient(135deg, ' +
      t.prove[0] + ' 34%, ' + t.prove[1] + ' 34%, ' +
      t.prove[1] + ' 67%, ' + t.prove[2] + ' 67%)';

    const tekst = document.createElement('span');
    tekst.className = 'tematekst';
    const navn = document.createElement('strong');
    navn.textContent = t.navn;
    const om = document.createElement('span');
    om.textContent = t.om;
    tekst.append(navn, om);

    b.append(prove, tekst);
    temaListe.appendChild(b);
    temaKnapper.push(b);
  });

  function merkValgtTema() {
    const valgt = window.SudokuTema.lagret();
    temaKnapper.forEach(b => b.setAttribute('aria-checked', String(b.dataset.tema === valgt)));
  }

  /* ---------- Tegning ---------- */

  function tegn() {
    kandidater = C.candidatesFrom(state.verdier);

    const vis = (hint && hintSteg >= 2) ? hint : null;
    const hHoved = new Set(vis ? vis.cells : []);
    const hEnhet = new Set(vis ? vis.unitCells : []);
    const hMal = new Set(vis ? vis.targets : []);
    const hTall = new Set(vis ? vis.digits : []);
    const vekk = {};
    if (vis) for (const e of vis.eliminations) vekk[e.cell] = (vekk[e.cell] || 0) | (1 << e.digit);

    const sel = state.valgt;
    const selVerdi = sel >= 0 ? state.verdier[sel] : 0;

    // I fyllmodus er det det aktive tallet som er interessant å se hvor står,
    // ikke tallet i ruta du sist rørte.
    const likTall = (state.fyllModus && state.aktivtTall) ? state.aktivtTall : selVerdi;

    // Regelbrudd: et tall du har skrevet som står i samme rad, kolonne eller
    // boks som et likt tall. Merk at dette ikke er en sammenlikning mot
    // løsningen — det røper ingenting, det sier bare at disse to ikke kan stå
    // sammen. Bare dine egne tall merkes; de gitte kan du likevel ikke endre,
    // og et rødt tall skal alltid være noe du kan rette.
    const konflikt = new Uint8Array(81);
    for (let i = 0; i < 81; i++) {
      const v = state.verdier[i];
      if (!v || state.gitt[i]) continue;
      for (const j of C.PEERS[i]) {
        if (state.verdier[j] === v) { konflikt[i] = 1; break; }
      }
    }

    const antallTall = new Array(10).fill(0);

    for (let i = 0; i < 81; i++) {
      const c = celler[i];
      const v = state.verdier[i];
      if (v) antallTall[v]++;

      const maske = v ? 0
        : autoMerker() ? (kandidater[i] & ~state.elim[i])
        : state.blyant[i];

      // Tallet finnes to steder: satt inn i ruta, eller ført som blyantmerke.
      // Begge får samme flate — det er tallet som skal være lett å finne, og to
      // styrker gjorde bare den svakeste av dem vanskelig å se. Hvilket av
      // slagene det er, leser du av innholdet: stort tall eller uthevet merke.
      const merketHer = likTall && (maske & (1 << likTall));

      let cls = 'celle';
      if (v) cls += state.gitt[i] ? ' gitt' : ' skrevet';
      if (konflikt[i]) cls += ' konflikt';
      if (likTall && (v === likTall && i !== sel || merketHer)) cls += ' likt';
      if (i === sel) cls += ' valgt';
      if (hEnhet.has(i)) cls += ' hint-enhet';
      if (hMal.has(i)) cls += ' hint-mal';
      if (hHoved.has(i)) cls += ' hint-hoved';
      c.el.className = cls;

      c.stor.textContent = v ? v : '';

      for (let d = 1; d <= 9; d++) {
        const m = c.marks[d - 1];
        if (!(maske & (1 << d))) { m.className = ''; continue; }
        if (vis && (vekk[i] & (1 << d))) m.className = 'paa hint-vekk';
        else if (vis && hHoved.has(i) && hTall.has(d)) m.className = 'paa hint-tall';
        else if (d === likTall) m.className = 'paa uthevet';   // selve merket, ikke bare ruta
        else m.className = 'paa';
      }
    }

    const delt = erDelt();
    for (let d = 1; d <= 9; d++) {
      const ferdig = antallTall[d] >= 9;
      const valgtTall = state.fyllModus && state.aktivtTall === d;
      tallKnapper(d).forEach(b => {
        // Er tastaturet delt, skal bare den siden det ble valgt fra, lyse.
        const aktiv = valgtTall && (!delt || erBlyantside(b) === state.aktivtBlyant);
        b.classList.toggle('ferdig', ferdig);
        b.classList.toggle('aktiv', aktiv);
        b.querySelector('.igjen').textContent = ferdig ? '' : String(9 - antallTall[d]);
      });
    }

    let igjen = 0;
    for (let i = 0; i < 81; i++) if (!state.verdier[i]) igjen++;
    const nivaa = S.NIVAAER.find(n => n.id === state.nivaa);
    const navn = nivaa ? nivaa.navn : '';
    const rest = igjen === 0 ? 'Fullt' : igjen + ' igjen';
    $('#meta-nivaa').textContent = navn;
    $('#meta-igjen').textContent = rest;
    $('#side-meta').textContent = navn + ' · ' + rest;   // toppen av venstre side, liggende
  }

  function puls(i) {
    const el = celler[i].el;
    el.classList.remove('puls');
    void el.offsetWidth;
    el.classList.add('puls');
  }

  /* ---------- Meldinger ---------- */

  function melding(tekst) {
    const el = $('#melding');
    el.textContent = tekst;
    el.hidden = false;
  }
  function skjulMelding() { $('#melding').hidden = true; }

  /* ---------- Handlinger ---------- */

  function velg(i) {
    state.valgt = i;
    skjulMelding();
    tegn();
  }

  function nullstillElim() { state.elim.fill(0); }

  /* ---------- Angre og gjør om ---------- */

  // Hele historikken ligger i minnet og lagres ikke — den gjelder denne økta med
  // dette brettet. `gitt` og `losning` endrer seg aldri, så de er ikke med.
  const fortid = [];    // tilstander før hver endring
  const fremtid = [];   // tilstander som er angret

  function taVarePaa() {
    return {
      verdier: state.verdier.slice(),
      elim: state.elim.slice(),
      blyant: state.blyant.slice(),
      merkeModus: state.merkeModus,
      valgt: state.valgt
    };
  }

  function gjenopprett(t) {
    state.verdier.set(t.verdier);
    state.elim.set(t.elim);
    state.blyant.set(t.blyant);
    state.merkeModus = t.merkeModus;
    state.valgt = t.valgt;
  }

  /** Kalles rett før en endring av brettet. */
  function husk() {
    fortid.push(taVarePaa());
    fremtid.length = 0;
  }

  function nullstillHistorikk() {
    fortid.length = 0;
    fremtid.length = 0;
  }

  function angre() {
    if (!fortid.length) return;
    fremtid.push(taVarePaa());
    gjenopprett(fortid.pop());
    etterHopp();
  }

  function gjorOm() {
    if (!fremtid.length) return;
    fortid.push(taVarePaa());
    gjenopprett(fremtid.pop());
    etterHopp();
  }

  function etterHopp() {
    lukkHint();            // hintet gjaldt brettet slik det var
    skjulMelding();
    $('#ferdig').hidden = true;
    oppdaterVerktoy();
    lagre();
    tegn();
    sjekkFerdig();
  }

  /**
   * Stryker blyantmerket d fra alle rutene som deler rad, kolonne eller boks
   * med rute i. Står tallet først der, er merket motbevist overalt det kunne
   * kollidert, og da er det bare i veien.
   *
   * Bare de manuelle merkene: er «Auto» på, regnes kandidatene ut fra brettet
   * og har allerede sluppet tallet.
   */
  function ryddNaboer(i, d) {
    const uten = ~(1 << d);
    for (const j of C.PEERS[i]) state.blyant[j] &= uten;   // PEERS er uten ruta selv
  }

  /**
   * Skriver tallet d i rute i. Returnerer false hvis ruta står urørt — enten
   * fordi den ikke kan endres, eller fordi blyanten er sperret av «Auto».
   */
  function skrivTallI(i, d, blyant) {
    if (i < 0 || state.gitt[i]) return false;

    if (blyant) {
      if (autoMerker()) {
        melding('Merkene fylles ut automatisk. Trykk «Auto» for å overta dem selv.');
        return false;
      }
      if (state.verdier[i]) return false;
      husk();
      state.blyant[i] ^= (1 << d);
    } else {
      husk();
      if (state.verdier[i] === d) {
        state.verdier[i] = 0;               // trykk på samme tall igjen = viske ut
        nullstillElim();
        lukkHint();
      } else {
        if (state.verdier[i]) nullstillElim();
        state.verdier[i] = d;
        state.blyant[i] = 0;
        ryddNaboer(i, d);
        lukkHint();
        puls(i);
      }
    }
    oppdaterVerktoy();
    lagre();
    tegn();
    sjekkFerdig();
    return true;
  }

  /** Rute først: tallet havner i ruta som allerede er valgt. */
  function skrivTall(d, blyant) {
    if (state.valgt < 0) { melding('Velg en rute på brettet først.'); return; }
    skjulMelding();
    skrivTallI(state.valgt, d, blyant);
  }

  /**
   * Tall først: peker ut tallet som skal fylles inn, og om det skal bli et tall
   * eller et merke. Samme tall fra samme side igjen legger det fra seg; fra den
   * andre siden bytter det bare hva trykket skal gi.
   */
  function velgAktivtTall(d, blyant) {
    if (state.aktivtTall === d && state.aktivtBlyant === blyant) {
      state.aktivtTall = 0;
    } else {
      state.aktivtTall = d;
      state.aktivtBlyant = blyant;
    }
    skjulMelding();
    tegn();
  }

  function slett() {
    const i = state.valgt;
    if (i < 0 || state.gitt[i]) return;
    skjulMelding();
    if (!state.verdier[i] && !state.blyant[i]) return;   // ingenting å slette

    husk();
    if (state.verdier[i]) {
      state.verdier[i] = 0;
      nullstillElim();
      lukkHint();
    } else {
      state.blyant[i] = 0;
    }
    oppdaterVerktoy();
    lagre();
    tegn();
  }

  function flyttValg(dr, dk) {
    const i = state.valgt < 0 ? 0 : state.valgt;
    const r = Math.min(8, Math.max(0, C.rowOf(i) + dr));
    const k = Math.min(8, Math.max(0, C.colOf(i) + dk));
    velg(r * 9 + k);
  }

  /* ---------- Hint ---------- */

  function lukkHint() {
    hint = null;
    hintSteg = 0;
    $('#hint').hidden = true;
  }

  function visHint() {
    $('#hint-navn').textContent = hint.name;
    $('#hint-tekst').textContent = hintSteg === 1 ? hint.short : hint.text;
    $('#hint-mer').hidden = hintSteg >= 2;
    $('#hint-bruk').textContent = hint.placement ? 'Sett inn tallet' : 'Stryk kandidatene';
    $('#hint').hidden = false;
  }

  function hintTrykk() {
    if (hint) {
      if (hintSteg === 1) { hintSteg = 2; visHint(); tegn(); }
      else brukHint();
      return;
    }
    skjulMelding();

    const st = S.makeState(state.verdier, state.elim);
    const s = S.findStep(st);
    if (!s) { forklarStopp(); return; }

    hint = s;
    hintSteg = 1;
    visHint();
    tegn();
  }

  function brukHint() {
    const s = hint;
    if (!s) return;

    husk();
    for (const e of s.eliminations) {
      state.elim[e.cell] |= (1 << e.digit);
      state.blyant[e.cell] &= ~(1 << e.digit);
    }
    if (s.placement) {
      state.verdier[s.placement.cell] = s.placement.digit;
      state.blyant[s.placement.cell] = 0;
      ryddNaboer(s.placement.cell, s.placement.digit);   // samme regel som når du skriver selv
      state.valgt = s.placement.cell;
    }

    const plassert = s.placement ? s.placement.cell : -1;
    lukkHint();
    oppdaterVerktoy();
    lagre();
    tegn();
    if (plassert >= 0) puls(plassert);
    sjekkFerdig();
  }

  /** Forklarer hvorfor løseren ikke finner noe trekk. */
  function forklarStopp() {
    const feil = [];
    for (let i = 0; i < 81; i++) {
      if (state.verdier[i] && state.verdier[i] !== state.losning[i]) feil.push(i);
    }
    if (feil.length) {
      melding(feil.length === 1
        ? 'Tallet i ' + C.cellName(feil[0]) + ' stemmer ikke med løsningen. Rett det, så finner jeg neste trekk.'
        : feil.length + ' tall på brettet stemmer ikke med løsningen. Rett dem, så finner jeg neste trekk.');
      return;
    }
    let igjen = 0;
    for (let i = 0; i < 81; i++) if (!state.verdier[i]) igjen++;
    if (igjen === 0) { melding('Brettet er ferdig utfylt.'); return; }

    melding('Her stopper teknikkene jeg kan: nakne og skjulte enere, låste kandidater, ' +
            'nakne og skjulte delmengder, X-Wing, XY-Wing og sverdfisk. ' +
            'Har du strøket kandidater manuelt, kan et par tomme ruter være blitt utelukket for tidlig.');
  }

  /* ---------- Ferdig ---------- */

  function sjekkFerdig() {
    for (let i = 0; i < 81; i++) {
      if (state.verdier[i] !== state.losning[i]) return;
    }
    const nivaa = S.NIVAAER.find(n => n.id === state.nivaa);
    $('#ferdig-tekst').textContent = state.maksNavn
      ? 'Nivå ' + (nivaa ? nivaa.navn.toLowerCase() : '') + '. Vanskeligste teknikk som trengtes: ' +
        state.maksNavn.toLowerCase() + '.'
      : 'Godt jobbet!';
    $('#ferdig').hidden = false;
  }

  /* ---------- Nytt spill ---------- */

  async function nyttSpill(nivaaId) {
    $('#nytt-panel').hidden = true;
    $('#ferdig').hidden = true;
    $('#jobber-tekst').textContent = 'Lager puslespill …';
    $('#jobber').hidden = false;
    lukkHint();
    skjulMelding();

    try {
      const r = await G.generate(nivaaId, (n) => {
        if (n >= 6) $('#jobber-tekst').textContent = 'Leter etter et som passer nivået … (' + (n + 1) + ')';
      });

      state.gitt = Uint8Array.from(r.puzzle);
      state.verdier = Uint8Array.from(r.puzzle);
      state.losning = Uint8Array.from(r.solution);
      state.elim.fill(0);
      state.blyant.fill(0);
      state.nivaa = r.grade.nivaa ? r.grade.nivaa.id : nivaaId;
      state.maksNavn = r.grade.maksNavn || '';
      state.valgt = -1;
      state.blyantModus = false;
      state.aktivtTall = 0;          // fyllmodus er en preferanse og består, tallet ikke
      state.aktivtBlyant = false;
      if (state.merkeModus === 'manuell') state.merkeModus = 'tom';   // brettet er tømt
      nullstillHistorikk();
      oppdaterVerktoy();
      lagre();
      tegn();
    } catch (e) {
      melding('Klarte ikke å lage et puslespill på dette nivået. Prøv igjen.');
      console.error(e);
    } finally {
      $('#jobber').hidden = true;
    }
  }

  /* ---------- Lagring ---------- */

  function lagre() {
    try {
      localStorage.setItem(LAGER, JSON.stringify({
        gitt: Array.from(state.gitt),
        verdier: Array.from(state.verdier),
        losning: Array.from(state.losning),
        elim: Array.from(state.elim),
        blyant: Array.from(state.blyant),
        merkeModus: state.merkeModus,
        fyllModus: state.fyllModus,
        nivaa: state.nivaa,
        maksNavn: state.maksNavn
      }));
    } catch (e) { /* privat modus e.l. — spill videre uten lagring */ }
  }

  function hentLagret() {
    try {
      const rå = localStorage.getItem(LAGER);
      if (!rå) return false;
      const d = JSON.parse(rå);
      if (!d || !Array.isArray(d.gitt) || d.gitt.length !== 81) return false;

      state.gitt = Uint8Array.from(d.gitt);
      state.verdier = Uint8Array.from(d.verdier);
      state.losning = Uint8Array.from(d.losning);
      state.elim = Int16Array.from(d.elim || new Array(81).fill(0));
      state.blyant = Int16Array.from(d.blyant || new Array(81).fill(0));
      // Eldre lagringer kjente bare av og på. Har de merker liggende, var de
      // i ferd med å redigeres; ellers var de tømt.
      state.merkeModus = d.merkeModus ||
        (d.autoBlyant === false ? (state.blyant.some(m => m) ? 'manuell' : 'tom') : 'auto');
      state.fyllModus = d.fyllModus === true;
      state.nivaa = d.nivaa || 'middels';
      state.maksNavn = d.maksNavn || '';
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Verktøyknapper ---------- */

  /*
   * «Auto» går i ring gjennom tre trinn i stedet for å slå av og på:
   *
   *   auto     merkene regnes ut og oppdateres selv
   *   manuell  de beregnede merkene er kopiert over — nå er de dine å redigere
   *   tom      merkene er fjernet, du fører dem fra bunnen
   *
   * Knappen viser trinnet du står i, ikke det neste. Symbolene går fra fylt til
   * tomt, så rekkefølgen er til å lese uten å ha trykket seg gjennom den.
   */
  const AUTO_STEG = {
    auto:    { symbol: '◈', tekst: 'Auto',    neste: 'manuell' },
    manuell: { symbol: '◇', tekst: 'Manuell', neste: 'tom' },
    tom:     { symbol: '○', tekst: 'Tomt',    neste: 'auto' }
  };

  const autoMerker = () => state.merkeModus === 'auto';

  function oppdaterVerktoy() {
    const trykt = (id, paa) => verktoyKnapper(id).forEach(b => b.setAttribute('aria-pressed', String(paa)));
    const sperret = (id, av) => verktoyKnapper(id).forEach(b => { b.disabled = av; });
    trykt('blyant', state.blyantModus);
    trykt('fyll', state.fyllModus);
    sperret('angre', fortid.length === 0);
    sperret('gjorom', fremtid.length === 0);

    const steg = AUTO_STEG[state.merkeModus];
    verktoyKnapper('auto').forEach(b => {
      b.querySelector('.vsymbol').textContent = steg.symbol;
      b.querySelector('.vtekst').textContent = steg.tekst;
      b.setAttribute('aria-pressed', String(autoMerker()));
    });
  }

  function vekslFyll() {
    state.fyllModus = !state.fyllModus;
    state.aktivtTall = 0;
    state.aktivtBlyant = false;
    oppdaterVerktoy();
    lagre();
    if (state.fyllModus) melding('Fyll: velg et tall, og trykk så på rutene der det skal stå.');
    else skjulMelding();
    tegn();
  }

  function vekslBlyant() {
    state.blyantModus = !state.blyantModus;
    oppdaterVerktoy();
    if (state.blyantModus && autoMerker()) {
      melding('Merkene fylles ut automatisk. Trykk «Auto» for å overta dem selv.');
    } else {
      skjulMelding();
    }
  }

  function vekslAuto() {
    husk();               // skriver om alle blyantmerkene — må kunne angres
    const neste = AUTO_STEG[state.merkeModus].neste;

    if (neste === 'manuell') {
      // Ta de beregnede med over, så du har noe å redigere i stedet for å
      // begynne på bar bakke.
      for (let i = 0; i < 81; i++) {
        state.blyant[i] = state.verdier[i] ? 0 : (kandidater[i] & ~state.elim[i]);
      }
      melding('Merkene er dine nå. Rediger dem med «Blyant» + tall.');
    } else if (neste === 'tom') {
      state.blyant.fill(0);
      melding('Merkene er tømt. Før dine egne med «Blyant» + tall.');
    } else {
      skjulMelding();     // tilbake til auto: de regnes ut på nytt av seg selv
    }

    state.merkeModus = neste;
    oppdaterVerktoy();
    lagre();
    tegn();
  }

  /* ---------- Hendelser ---------- */

  brettEl.addEventListener('click', e => {
    const c = e.target.closest('.celle');
    if (!c) return;
    const i = Number(c.dataset.i);

    if (state.fyllModus && state.aktivtTall) {
      // Ruta markeres uansett, så like tall lyser opp selv om det ikke ble
      // skrevet noe (gitt rute, eller blyanten sperret av «Auto»).
      state.valgt = i;
      skjulMelding();
      if (!skrivTallI(i, state.aktivtTall, state.aktivtBlyant)) tegn();
      return;
    }
    velg(i);
  });

  const HANDLING = {
    slett: slett,
    angre: angre,
    gjorom: gjorOm,
    fyll: vekslFyll,
    blyant: vekslBlyant,
    auto: vekslAuto,
    hint: hintTrykk,
    nytt: () => { $('#nytt-panel').hidden = false; }
  };

  // Ett oppslag for begge settene: hvilken side knappen sto på, spiller ingen rolle.
  $('.spilleflate').addEventListener('click', e => {
    const tall = e.target.closest('.tallknapp');
    if (tall) {
      const d = Number(tall.dataset.d);
      // Delt tastatur: siden knappen står på avgjør. Ellers gjelder «Blyant».
      const blyant = erDelt() ? erBlyantside(tall) : state.blyantModus;
      if (state.fyllModus) velgAktivtTall(d, blyant);
      else skrivTall(d, blyant);
      return;
    }
    const v = e.target.closest('.verktoyknapp');
    if (v) HANDLING[v.dataset.verktoy]();
  });

  // Trykk på det mørke feltet rundt lukker — den vanlige gesten på telefon,
  // der det ikke finnes noen Esc-tast. #jobber står med vilje utenfor: der
  // pågår det en generering, og et bomtrykk skal ikke etterlate den halvveis.
  ['#nytt-panel', '#ferdig', '#tema-panel'].forEach(sel => {
    const el = $(sel);
    el.addEventListener('click', e => { if (e.target === el) el.hidden = true; });
  });

  $('#btn-tema').addEventListener('click', () => {
    merkValgtTema();
    $('#tema-panel').hidden = false;
  });
  $('#tema-lukk').addEventListener('click', () => { $('#tema-panel').hidden = true; });
  temaListe.addEventListener('click', e => {
    const b = e.target.closest('.temavalg');
    if (!b) return;
    window.SudokuTema.velg(b.dataset.tema);   // slår inn med en gang, så du ser det
    merkValgtTema();
  });

  $('#nytt-avbryt').addEventListener('click', () => { $('#nytt-panel').hidden = true; });
  $('#ferdig-lukk').addEventListener('click', () => { $('#ferdig').hidden = true; });
  $('#ferdig-nytt').addEventListener('click', () => {
    $('#ferdig').hidden = true;
    $('#nytt-panel').hidden = false;
  });

  document.querySelectorAll('.nivaaknapp').forEach(b => {
    b.addEventListener('click', () => nyttSpill(b.dataset.nivaa));
  });

  $('#hint-lukk').addEventListener('click', () => { lukkHint(); tegn(); });
  $('#hint-mer').addEventListener('click', () => { hintSteg = 2; visHint(); tegn(); });
  $('#hint-bruk').addEventListener('click', brukHint);

  document.addEventListener('keydown', e => {
    const k = e.key;

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (k === 'z' || k === 'Z') { e.shiftKey ? gjorOm() : angre(); e.preventDefault(); return; }
      if (k === 'y' || k === 'Y') { gjorOm(); e.preventDefault(); return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (k >= '1' && k <= '9') {
      // Tastaturet har ingen side å stå på, så «Blyant» gjelder som før.
      if (state.fyllModus) velgAktivtTall(Number(k), state.blyantModus);
      else skrivTall(Number(k), state.blyantModus);
      e.preventDefault();
      return;
    }
    if (k === 'Enter' || k === ' ') {
      // Har en knapp fokus, skal den få svare selv — ellers slutter Enter og
      // mellomrom å virke på verktøylinja.
      if (e.target instanceof Element && e.target.closest('button')) return;
      if (state.fyllModus && state.aktivtTall && state.valgt >= 0) {
        skjulMelding();
        skrivTallI(state.valgt, state.aktivtTall, state.aktivtBlyant);
        e.preventDefault();
      }
      return;
    }
    if (k === '0' || k === 'Backspace' || k === 'Delete') { slett(); e.preventDefault(); return; }
    if (k === 'ArrowUp') { flyttValg(-1, 0); e.preventDefault(); return; }
    if (k === 'ArrowDown') { flyttValg(1, 0); e.preventDefault(); return; }
    if (k === 'ArrowLeft') { flyttValg(0, -1); e.preventDefault(); return; }
    if (k === 'ArrowRight') { flyttValg(0, 1); e.preventDefault(); return; }
    if (k === 'h' || k === 'H') { hintTrykk(); e.preventDefault(); return; }
    if (k === 'p' || k === 'P') { vekslBlyant(); e.preventDefault(); return; }
    if (k === 'Escape') {
      if (!$('#tema-panel').hidden) $('#tema-panel').hidden = true;
      else if (!$('#nytt-panel').hidden) $('#nytt-panel').hidden = true;
      else if (hint) { lukkHint(); tegn(); }
    }
  });

  /* ---------- Versjon ---------- */

  /**
   * Viser hvilken utgave av koden som faktisk kjører her.
   *
   * Navnet hentes fra cachen service worker-en har lagt opp, ikke fra en
   * konstant i denne fila: da finnes versjonen ett sted (`CACHE` i sw.js), og
   * det som vises er den koden enheten virkelig har — ikke den vi håper den har.
   */
  function visVersjon() {
    if (!('caches' in window)) return;
    caches.keys().then(navn => {
      const vår = navn.filter(n => /^sudoku-v\d+$/.test(n))
                      .sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)));
      if (!vår.length) return;
      const el = $('#versjon');
      el.textContent = vår[vår.length - 1].replace('sudoku-', '');
      el.hidden = false;
    }).catch(() => {});
  }

  /* ---------- Oppstart ---------- */

  // Knappene må stilles etter at det lagrede er lest, ikke før: lagringen kan ha
  // «Auto» av eller «Fyll» på, og da sto knappene og løy om tilstanden.
  const varLagret = hentLagret();
  oppdaterVerktoy();
  if (varLagret) tegn();
  else nyttSpill('middels');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // updateViaCache: 'none' — selve sw.js skal aldri hentes fra HTTP-cachen,
    // ellers kan en ny versjon bli stående og vente på at den gamle utløper.
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    navigator.serviceWorker.ready.then(visVersjon).catch(() => {});
  }
  visVersjon();

})();
