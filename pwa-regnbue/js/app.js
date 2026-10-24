'use strict';
/*
 * app.js — grensesnittet.
 *
 * Premisset, og det styrer alt annet: brukeren er fem år og kan ikke lese.
 * Derfor finnes det ingen klokke, ingen poengsum, ingen blyantmerker og ingen
 * teknikknavn. Det finnes heller ingen måte å kjøre seg fast på — et symbol
 * som ikke hører hjemme, går ikke inn. Ruta rister, og barnet prøver et annet.
 *
 * Det siste er den viktigste avgjørelsen her. Lar man feil symboler bli
 * stående, ender brettet før eller siden i en knute som bare kan løses ved å
 * se at noe langt tilbake var galt — og det er nøyaktig det en femåring ikke
 * kan. Spillet kan bekrefte, aldri avvise barnet; det avviser trekket.
 */
(function () {

  const B = window.RegnbueKjerne;
  const Sym = window.RegnbueSymboler;
  const $ = s => document.querySelector(s);

  const LAGER = 'regnbuespillet-v1';

  let g = null;              // rutenettet (geometri)
  let nivaa = null;
  let verdier = null;
  let gitt = null;
  let losning = null;
  let valgt = -1;

  const brettEl = $('#brett');
  const tastEl = $('#tastatur');

  /* ---------- Nivåvalg ---------- */

  B.NIVAAER.forEach(n => {
    const b = document.createElement('button');
    b.className = 'nivaaknapp';
    b.dataset.nivaa = n.id;

    // En liten rutevisning ved siden av navnet: den som ikke leser, ser
    // likevel med en gang hvor stort brettet er.
    const vis = document.createElement('span');
    vis.className = 'rutevis';
    const N = n.boksH * n.boksB;
    vis.style.gridTemplateColumns = 'repeat(' + N + ', 1fr)';
    for (let k = 0; k < N * N; k++) vis.appendChild(document.createElement('i'));

    const tekst = document.createElement('span');
    const navn = document.createElement('strong');
    navn.textContent = n.navn;
    const om = document.createElement('span');
    om.textContent = n.om;
    tekst.append(navn, om);

    b.append(vis, tekst);
    b.addEventListener('click', () => { $('#velg').hidden = true; nyttBrett(n.id); });
    $('#nivaaliste').appendChild(b);
  });

  /* ---------- Bygg brett og tastatur ---------- */

  function bygg() {
    const N = g.N;
    brettEl.style.setProperty('--n', N);
    document.documentElement.style.setProperty('--n', N);
    brettEl.textContent = '';

    for (let i = 0; i < g.ANT; i++) {
      const el = document.createElement('div');
      el.className = 'rute';
      el.dataset.i = i;
      el.setAttribute('role', 'gridcell');
      // Tykke streker der boksene møtes, som i et vanlig sudokubrett.
      if ((g.kol(i) + 1) % g.boksB === 0) el.classList.add('kant-h');
      if ((g.rad(i) + 1) % g.boksH === 0) el.classList.add('kant-n');
      if (g.kol(i) === N - 1) el.classList.add('siste-h');
      if (g.rad(i) === N - 1) el.classList.add('siste-n');
      brettEl.appendChild(el);
    }

    tastEl.textContent = '';
    /*
     * Tastene er kvadratiske, så spalteantallet bestemmer hvor høyt tastaturet
     * blir. Ni taster i tre spalter ble 355 px stående, og da havnet «Hjelp
     * meg» under skjermkanten. Liggende er spalta smal, og da er det motsatt:
     * fem spalter ville gitt 33 px taster. Derfor to tall, ett for hver vei.
     */
    tastEl.style.setProperty('--tastkol', N <= 6 ? N : 5);
    tastEl.style.setProperty('--tastkol-l', N <= 4 ? 2 : 3);
    for (let d = 1; d <= N; d++) {
      const b = document.createElement('button');
      b.className = 'tast';
      b.dataset.d = d;
      b.setAttribute('aria-label', Sym.navn(d));
      b.innerHTML = Sym.svg(d);
      tastEl.appendChild(b);
    }
  }

  /* ---------- Tegning ---------- */

  function tegn() {
    const brukt = new Array(g.N + 1).fill(0);
    for (let i = 0; i < g.ANT; i++) {
      const el = brettEl.children[i];
      const d = verdier[i];
      if (d) brukt[d]++;
      const vil = d ? Sym.svg(d, g.N > 6) : '';
      if (el.dataset.vist !== String(d)) {
        el.innerHTML = vil;
        el.dataset.vist = String(d);
      }
      el.classList.toggle('gitt', !!gitt[i]);
      el.classList.toggle('valgt', i === valgt);
    }
    for (const t of tastEl.children) {
      t.classList.toggle('ferdig', brukt[Number(t.dataset.d)] >= g.N);
    }
  }

  /* ---------- Trekk ---------- */

  function velg(i) {
    if (gitt[i]) { valgt = -1; tegn(); return; }   // de faste står i fred
    valgt = (valgt === i) ? -1 : i;
    tegn();
  }

  function settInn(d) {
    if (valgt < 0 || gitt[valgt]) return;
    const el = brettEl.children[valgt];

    // Står symbolet der alt, tar trykket det bort igjen.
    if (verdier[valgt] === d) { verdier[valgt] = 0; lagre(); tegn(); return; }

    if (losning[valgt] !== d) {
      el.classList.remove('nei');
      void el.offsetWidth;
      el.classList.add('nei');
      return;
    }

    verdier[valgt] = d;
    tegn();
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    valgt = -1;
    lagre();
    tegn();
    sjekkFerdig();
  }

  function slett() {
    if (valgt < 0 || gitt[valgt]) return;
    verdier[valgt] = 0;
    lagre();
    tegn();
  }

  /*
   * «Hjelp meg» fyller inn én rute — den enkleste som finnes nå — og lyser
   * kort opp i grønt så barnet ser hvor det skjedde. Ingen forklaring: en
   * femåring har ikke bruk for å høre at dette var en skjult ener.
   */
  function hjelp() {
    const t = B.nesteTrekk(g, verdier);
    if (!t) return;
    verdier[t.rute] = t.verdi;
    valgt = -1;
    lagre();
    tegn();
    const el = brettEl.children[t.rute];
    el.classList.remove('hjelp', 'pop');
    void el.offsetWidth;
    el.classList.add('hjelp', 'pop');
    sjekkFerdig();
  }

  function sjekkFerdig() {
    for (let i = 0; i < g.ANT; i++) if (!verdier[i]) return;
    setTimeout(() => { $('#ferdig').hidden = false; }, 420);
  }

  /* ---------- Lagring ---------- */

  function lagre() {
    try {
      localStorage.setItem(LAGER, JSON.stringify({
        nivaa: nivaa.id,
        gitt: Array.from(gitt),
        verdier: Array.from(verdier),
        losning: Array.from(losning)
      }));
    } catch (e) { /* full eller avslått lagring skal ikke stoppe spillet */ }
  }

  function hent() {
    try {
      const d = JSON.parse(localStorage.getItem(LAGER) || 'null');
      if (!d || !d.nivaa) return false;
      const n = B.NIVAAER.find(x => x.id === d.nivaa);
      if (!n || !d.verdier || !d.losning) return false;
      nivaa = n;
      g = B.lagRutenett(n.boksH, n.boksB);
      if (d.verdier.length !== g.ANT) return false;
      verdier = Uint8Array.from(d.verdier);
      gitt = Uint8Array.from(d.gitt);
      losning = Uint8Array.from(d.losning);
      bygg();
      tegn();
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Nytt brett ---------- */

  function nyttBrett(id) {
    nivaa = B.NIVAAER.find(n => n.id === id) || B.NIVAAER[0];
    $('#ferdig').hidden = true;
    $('#jobber').hidden = false;

    // Ett bilde fram før regningen starter, ellers vises aldri spinneren.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = B.lagBrett(nivaa);
      $('#jobber').hidden = true;
      if (!r) return;
      g = r.g;
      verdier = Uint8Array.from(r.brett);
      gitt = Uint8Array.from(r.brett).map(v => (v ? 1 : 0));
      losning = r.losning;
      valgt = -1;
      bygg();
      tegn();
      lagre();
    }));
  }

  /* ---------- Hendelser ---------- */

  brettEl.addEventListener('click', e => {
    const r = e.target.closest('.rute');
    if (r) velg(Number(r.dataset.i));
  });

  tastEl.addEventListener('click', e => {
    const t = e.target.closest('.tast');
    if (t) settInn(Number(t.dataset.d));
  });

  $('#btn-slett').addEventListener('click', slett);
  $('#btn-hjelp').addEventListener('click', hjelp);
  $('#btn-nytt').addEventListener('click', () => { $('#velg').hidden = false; });
  $('#ferdig-igjen').addEventListener('click', () => nyttBrett(nivaa.id));
  $('#ferdig-annet').addEventListener('click', () => {
    $('#ferdig').hidden = true;
    $('#velg').hidden = false;
  });

  // Trykk på det mørke feltet rundt lukker nivåvalget — men bare når det
  // finnes et brett å gå tilbake til.
  $('#velg').addEventListener('click', e => {
    if (e.target === $('#velg') && g) $('#velg').hidden = true;
  });

  if (!hent()) $('#velg').hidden = false;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }

})();
