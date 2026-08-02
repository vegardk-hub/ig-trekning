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
    autoBlyant: true,
    blyantModus: false,
    fyllModus: false,                // tall først: velg tallet, trykk så rutene
    aktivtTall: 0,                   // tallet som fylles inn (0 = ingen valgt)
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

  const tallEl = $('#tall');
  const tallKnapper = [];
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement('button');
    b.className = 'tallknapp';
    b.textContent = d;
    b.dataset.d = d;
    tallEl.appendChild(b);
    tallKnapper.push(b);
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
    const naboer = sel >= 0 ? C.PEER_SETS[sel] : null;

    // I fyllmodus er det det aktive tallet som er interessant å se hvor står,
    // ikke tallet i ruta du sist rørte.
    const likTall = (state.fyllModus && state.aktivtTall) ? state.aktivtTall : selVerdi;

    const antallTall = new Array(10).fill(0);

    for (let i = 0; i < 81; i++) {
      const c = celler[i];
      const v = state.verdier[i];
      if (v) antallTall[v]++;

      let cls = 'celle';
      if (v) cls += state.gitt[i] ? ' gitt' : ' skrevet';
      if (naboer && naboer.has(i)) cls += ' naboer';
      if (likTall && v === likTall && i !== sel) cls += ' likt';
      if (i === sel) cls += ' valgt';
      if (hEnhet.has(i)) cls += ' hint-enhet';
      if (hMal.has(i)) cls += ' hint-mal';
      if (hHoved.has(i)) cls += ' hint-hoved';
      c.el.className = cls;

      c.stor.textContent = v ? v : '';

      const maske = v ? 0
        : state.autoBlyant ? (kandidater[i] & ~state.elim[i])
        : state.blyant[i];

      for (let d = 1; d <= 9; d++) {
        const m = c.marks[d - 1];
        if (!(maske & (1 << d))) { m.className = ''; continue; }
        if (vis && (vekk[i] & (1 << d))) m.className = 'paa hint-vekk';
        else if (vis && hHoved.has(i) && hTall.has(d)) m.className = 'paa hint-tall';
        else m.className = 'paa';
      }
    }

    for (let d = 1; d <= 9; d++) {
      tallKnapper[d - 1].classList.toggle('ferdig', antallTall[d] >= 9);
      tallKnapper[d - 1].classList.toggle('aktiv', state.fyllModus && state.aktivtTall === d);
    }

    let igjen = 0;
    for (let i = 0; i < 81; i++) if (!state.verdier[i]) igjen++;
    const nivaa = S.NIVAAER.find(n => n.id === state.nivaa);
    $('#meta-nivaa').textContent = nivaa ? nivaa.navn : '';
    $('#meta-igjen').textContent = igjen === 0 ? 'Fullt' : igjen + ' igjen';
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
      autoBlyant: state.autoBlyant,
      valgt: state.valgt
    };
  }

  function gjenopprett(t) {
    state.verdier.set(t.verdier);
    state.elim.set(t.elim);
    state.blyant.set(t.blyant);
    state.autoBlyant = t.autoBlyant;
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
   * Skriver tallet d i rute i. Returnerer false hvis ruta står urørt — enten
   * fordi den ikke kan endres, eller fordi blyanten er sperret av «Auto».
   */
  function skrivTallI(i, d) {
    if (i < 0 || state.gitt[i]) return false;

    if (state.blyantModus) {
      if (state.autoBlyant) {
        melding('Blyantmerkene fylles ut automatisk. Slå av «Auto» hvis du vil skrive dem selv.');
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
  function skrivTall(d) {
    if (state.valgt < 0) { melding('Velg en rute på brettet først.'); return; }
    skjulMelding();
    skrivTallI(state.valgt, d);
  }

  /** Tall først: peker ut tallet som skal fylles inn. Samme tall igjen slår det av. */
  function velgAktivtTall(d) {
    state.aktivtTall = state.aktivtTall === d ? 0 : d;
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
        autoBlyant: state.autoBlyant,
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
      state.autoBlyant = d.autoBlyant !== false;
      state.fyllModus = d.fyllModus === true;
      state.nivaa = d.nivaa || 'middels';
      state.maksNavn = d.maksNavn || '';
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Verktøyknapper ---------- */

  function oppdaterVerktoy() {
    $('#btn-blyant').setAttribute('aria-pressed', String(state.blyantModus));
    $('#btn-auto').setAttribute('aria-pressed', String(state.autoBlyant));
    $('#btn-fyll').setAttribute('aria-pressed', String(state.fyllModus));
    $('#btn-angre').disabled = fortid.length === 0;
    $('#btn-gjorom').disabled = fremtid.length === 0;
  }

  function vekslAuto() {
    husk();               // skriver om alle blyantmerkene — må kunne angres
    if (state.autoBlyant) {
      // Blankt ark: den som slår av Auto vil føre merkene selv, og da er de
      // beregnede i veien. Angre henter dem tilbake om det var et feiltrykk.
      state.blyant.fill(0);
      state.autoBlyant = false;
      melding('Auto er av. Blyantmerkene er tømt — nå fører du dem selv med «Blyant».');
    } else {
      state.autoBlyant = true;
      skjulMelding();
    }
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
      // Ruta markeres uansett, så naboer og like tall lyser opp selv om det
      // ikke ble skrevet noe (gitt rute, eller blyanten sperret av «Auto»).
      state.valgt = i;
      skjulMelding();
      if (!skrivTallI(i, state.aktivtTall)) tegn();
      return;
    }
    velg(i);
  });

  tallEl.addEventListener('click', e => {
    const b = e.target.closest('.tallknapp');
    if (!b) return;
    const d = Number(b.dataset.d);
    if (state.fyllModus) velgAktivtTall(d);
    else skrivTall(d);
  });

  $('#btn-slett').addEventListener('click', slett);
  $('#btn-angre').addEventListener('click', angre);
  $('#btn-gjorom').addEventListener('click', gjorOm);
  $('#btn-hint').addEventListener('click', hintTrykk);
  $('#btn-auto').addEventListener('click', vekslAuto);

  $('#btn-blyant').addEventListener('click', () => {
    state.blyantModus = !state.blyantModus;
    oppdaterVerktoy();
    if (state.blyantModus && state.autoBlyant) {
      melding('Blyantmerkene fylles ut automatisk. Slå av «Auto» hvis du vil skrive dem selv.');
    } else {
      skjulMelding();
    }
  });

  $('#btn-fyll').addEventListener('click', () => {
    state.fyllModus = !state.fyllModus;
    state.aktivtTall = 0;
    oppdaterVerktoy();
    lagre();
    if (state.fyllModus) melding('Fyll: velg et tall, og trykk så på rutene der det skal stå.');
    else skjulMelding();
    tegn();
  });

  $('#btn-nytt').addEventListener('click', () => { $('#nytt-panel').hidden = false; });
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
      if (state.fyllModus) velgAktivtTall(Number(k));
      else skrivTall(Number(k));
      e.preventDefault();
      return;
    }
    if (k === 'Enter' || k === ' ') {
      // Har en knapp fokus, skal den få svare selv — ellers slutter Enter og
      // mellomrom å virke på verktøylinja.
      if (e.target instanceof Element && e.target.closest('button')) return;
      if (state.fyllModus && state.aktivtTall && state.valgt >= 0) {
        skjulMelding();
        skrivTallI(state.valgt, state.aktivtTall);
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
    if (k === 'p' || k === 'P') { $('#btn-blyant').click(); e.preventDefault(); return; }
    if (k === 'Escape') {
      if (!$('#nytt-panel').hidden) $('#nytt-panel').hidden = true;
      else if (hint) { lukkHint(); tegn(); }
    }
  });

  /* ---------- Oppstart ---------- */

  // Knappene må stilles etter at det lagrede er lest, ikke før: lagringen kan ha
  // «Auto» av eller «Fyll» på, og da sto knappene og løy om tilstanden.
  const varLagret = hentLagret();
  oppdaterVerktoy();
  if (varLagret) tegn();
  else nyttSpill('middels');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

})();
