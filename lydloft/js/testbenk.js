/*
 * Testbenken — knappene, lista, analysen og sammenligningen.
 *
 * Gangen er alltid den samme: et opptak (eller en fil) blir til kanaler og en
 * samplingsrate, analysen regnes ut i en egen tråd, og begge deler lagres før
 * noe vises. Da er det lagrede og det viste aldri to forskjellige ting.
 *
 * Rapporten finnes som ren tekst fordi den skal limes inn i en samtale: den
 * som skal bygge nivå 1, har ikke telefonen din, men kan lese tallene.
 */
'use strict';

(function () {

  var $ = function (id) { return document.getElementById(id); };
  var A = LydAnalyse;

  var KILDER = {
    'raa': 'Rå PCM (AudioWorklet)',
    'media-beste': 'MediaRecorder, tapsfritt',
    'media-standard': 'MediaRecorder, standard',
    'fil': 'Fil',
    'versjon': 'Ny versjon fra verkstedet'
  };
  var MAKS_OPPTAK = 240;        // sekunder — det lengste en sang skal være
  var MAAL_LUFS = -23;          // lik lydstyrke ved sammenligning

  var liste = [];
  var valgtId = null;
  var sammenlign = {};
  var lydLager = {};            // id → { kanaler, fs }, for avspilling
  var aktivt = null;

  /* ----------------------------------------------------------- små ting */

  function tall(v, des, enhet) {
    if (v === null || v === undefined || !isFinite(v)) return '–';
    return v.toFixed(des).replace('.', ',').replace('-', '−') + (enhet ? ' ' + enhet : '');
  }
  function sek(s) {
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function dato(ms) {
    var d = new Date(ms);
    function to(n) { return (n < 10 ? '0' : '') + n; }
    return d.getDate() + '.' + (d.getMonth() + 1) + ' ' + to(d.getHours()) + ':' + to(d.getMinutes());
  }
  function h(tag, attr, barn) {
    var e = document.createElement(tag);
    Object.keys(attr || {}).forEach(function (k) {
      if (k === 'tekst') e.textContent = attr[k];
      else if (k === 'klasse') e.className = attr[k];
      else if (k.slice(0, 2) === 'pa') e.addEventListener(k.slice(2), attr[k]);
      else if (attr[k] !== false && attr[k] !== null && attr[k] !== undefined) e.setAttribute(k, attr[k]);
    });
    (barn || []).forEach(function (b) { if (b) e.appendChild(typeof b === 'string' ? document.createTextNode(b) : b); });
    return e;
  }
  function status(tekst, erFeil) {
    $('status').textContent = tekst || '';
    $('status').classList.toggle('feil', !!erFeil);
  }
  function lastNed(blob, navn) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: navn });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function filnavn(meta, ending) {
    var d = new Date(meta.dato);
    var stamme = (meta.navn || 'opptak').toLowerCase()
      .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return 'lydloft-' + d.toISOString().slice(0, 10) + '-' + stamme + '.' + ending;
  }
  function kopier(tekst) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(tekst).then(function () { return true; }, function () { return reserveKopi(tekst); });
    }
    return Promise.resolve(reserveKopi(tekst));
  }
  function reserveKopi(tekst) {
    var t = h('textarea', {});
    t.value = tekst;
    document.body.appendChild(t);
    t.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove();
    return ok;
  }

  /* ------------------------------------------------------------ analyse */

  var arbeider = null, ventende = {}, neste = 1;
  try {
    arbeider = new Worker('js/analyse-arbeider.js?v=3');
    arbeider.onmessage = function (e) {
      var v = ventende[e.data.id];
      delete ventende[e.data.id];
      if (!v) return;
      if (e.data.feil) v.nei(new Error(e.data.feil)); else v.ok(e.data.analyse);
    };
    arbeider.onerror = function () { arbeider = null; };
  } catch (e) { arbeider = null; }

  function analyser(kanaler, fs) {
    if (!arbeider) return Promise.resolve(A.analyser(kanaler, fs));
    return new Promise(function (ok, nei) {
      var id = neste++;
      ventende[id] = { ok: ok, nei: nei };
      arbeider.postMessage({ id: id, kanaler: kanaler, fs: fs });
    });
  }

  /* -------------------------------------------------------------- opptak */

  function settMaaler(topp) {
    var d = 20 * Math.log10(Math.max(topp, 1e-6));
    var andel = Math.max(0, Math.min(1, (d + 60) / 60));
    var fyll = $('maalerfyll');
    fyll.style.width = (andel * 100).toFixed(1) + '%';
    fyll.classList.toggle('hoy', d > -6 && d <= -1);
    fyll.classList.toggle('rod', d > -1);
  }

  function startOpptak(grense) {
    if (aktivt) return Promise.resolve(aktivt);
    LydOpptak.stoppAvspilling();
    var kilde = $('kilde').value;
    status('Ber om mikrofonen …');
    $('opptak').disabled = true;
    return LydOpptak.start({
      kilde: kilde,
      behandling: $('behandling').checked,
      enhet: $('enhet').value || null,
      paaNivaa: settMaaler
    }).then(function (handle) {
      var start = Date.now();
      aktivt = { handle: handle, kilde: kilde, start: start };
      aktivt.tikk = setInterval(function () {
        var s = (Date.now() - start) / 1000;
        $('tid').textContent = sek(s);
        if (s >= (grense || MAKS_OPPTAK)) stoppOpptak();
      }, 200);
      $('opptak').disabled = false;
      $('opptak').classList.add('aktiv');
      $('opptakstekst').textContent = 'Stopp';
      status('Tar opp – ' + KILDER[kilde] + '.');
      fyllEnheter();
      return aktivt;
    }).catch(function (e) {
      $('opptak').disabled = false;
      status(feilmelding(e), true);
      throw e;
    });
  }

  function feilmelding(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError') return 'Mikrofonen ble nektet. Tillat den i nettleserens innstillinger for siden.';
    if (n === 'NotFoundError') return 'Fant ingen mikrofon.';
    if (n === 'OverconstrainedError') return 'Den valgte mikrofonen finnes ikke lenger. Velg «Standard».';
    return 'Noe gikk galt: ' + (e && e.message || e);
  }

  function stoppOpptak() {
    if (!aktivt) return Promise.resolve();
    var a = aktivt;
    aktivt = null;
    clearInterval(a.tikk);
    $('opptak').classList.remove('aktiv');
    $('opptakstekst').textContent = 'Ta opp';
    $('opptak').disabled = true;
    settMaaler(0);
    status('Avslutter opptaket …');
    return a.handle.stopp().then(function (res) {
      $('opptak').disabled = false;
      return behandle(res);
    }).catch(function (e) {
      $('opptak').disabled = false;
      status(feilmelding(e), true);
    });
  }

  function behandle(res) {
    if (!res.kanaler || !res.kanaler.length || !res.kanaler[0].length) {
      status('Opptaket ble tomt.', true);
      return Promise.resolve();
    }
    var merknad = $('merknad').value.trim();
    var kilde = res.info.kilde;
    var meta = {
      id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      dato: Date.now(),
      navn: merknad || (kilde === 'fil' ? res.info.filnavn : KILDER[kilde]),
      kilde: kilde,
      behandling: kilde === 'fil' ? null : $('behandling').checked,
      fs: res.fs,
      kanaler: res.kanaler.length,
      varighet: res.kanaler[0].length / res.fs,
      info: res.info,
      analyse: null
    };
    status('Analyserer ' + tall(meta.varighet, 1, 's') + ' …');
    return analyser(res.kanaler, res.fs).then(function (a) {
      meta.analyse = a;
      return LydLager.lagre(meta, { id: meta.id, kanaler: res.kanaler, original: res.original || null });
    }).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      lydLager = {};
      lydLager[meta.id] = { kanaler: res.kanaler, fs: res.fs };
      status(meta.analyse.test ? 'Lagret – testsignalet ble funnet og målt.' : 'Lagret.');
      return lastListe().then(function () { visDetalj(meta.id); });
    }).catch(function (e) {
      status('Kunne ikke analysere eller lagre: ' + (e && e.message || e), true);
    });
  }

  function fyllEnheter() {
    LydOpptak.enheter().then(function (enh) {
      var sel = $('enhet'), valgt = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      enh.forEach(function (d, i) {
        if (!d.deviceId || d.deviceId === 'default') return;
        sel.appendChild(h('option', { value: d.deviceId, tekst: d.label || ('Mikrofon ' + (i + 1)) }));
      });
      sel.value = valgt;
    });
  }

  /* --------------------------------------------------------------- lista */

  function brikker(a) {
    var ut = [];
    if (!a || !a.grunn) return ut;
    var g = a.grunn;
    ut.push(h('span', { klasse: 'brikke', tekst: tall(g.lufs, 1, 'LUFS') }));
    if (g.klipping.hendelser) ut.push(h('span', { klasse: 'brikke feil', tekst: 'klipping' }));
    if (a.test) {
      ut.push(h('span', { klasse: 'brikke ok', tekst: 'testsignal' }));
      if (a.test.nedreGrense) ut.push(h('span', { klasse: 'brikke', tekst: '↓ ' + A.hz(a.test.nedreGrense) }));
      if (a.test.ovreGrense) ut.push(h('span', { klasse: 'brikke', tekst: '↑ ' + A.hz(a.test.ovreGrense) }));
      if (a.test.kompresjon && a.test.kompresjon.finnes) ut.push(h('span', { klasse: 'brikke feil', tekst: 'AGC' }));
      if (a.test.rosa && a.test.rosa.dempes) ut.push(h('span', { klasse: 'brikke feil', tekst: 'støydemping' }));
    }
    return ut;
  }

  function tegnListe() {
    var ul = $('liste');
    ul.innerHTML = '';
    $('tomt').hidden = liste.length > 0;
    liste.forEach(function (m) {
      var boks = h('input', { type: 'checkbox', 'aria-label': 'Ta med i sammenligningen' });
      boks.checked = !!sammenlign[m.id];
      boks.addEventListener('change', function () {
        if (boks.checked) sammenlign[m.id] = true; else delete sammenlign[m.id];
        oppdaterSammenlignKnapp();
      });
      var li = h('li', { klasse: m.id === valgtId ? 'valgt' : '' }, [
        boks,
        h('span', { klasse: 'navn', tekst: m.navn }),
        h('button', { type: 'button', klasse: 'knapp apne', tekst: 'Vis', paclick: function () { visDetalj(m.id); } }),
        h('span', { klasse: 'under', tekst: dato(m.dato) + ' · ' + KILDER[m.kilde] + ' · ' + m.fs + ' Hz · ' +
          (m.kanaler === 1 ? 'mono' : m.kanaler + ' kanaler') + ' · ' + sek(m.varighet) +
          (m.behandling ? ' · med behandling' : '') }),
        h('span', { klasse: 'brikker' }, brikker(m.analyse))
      ]);
      ul.appendChild(li);
    });
    oppdaterSammenlignKnapp();
  }

  function oppdaterSammenlignKnapp() {
    var n = Object.keys(sammenlign).length;
    $('sammenlign').disabled = n < 2;
    $('sammenlign').textContent = n >= 2 ? 'Sammenlign ' + n + ' valgte' : 'Sammenlign valgte (velg minst to)';
  }

  function lastListe() {
    return LydLager.alle().then(function (l) {
      liste = l;
      Object.keys(sammenlign).forEach(function (id) {
        if (!liste.some(function (m) { return m.id === id; })) delete sammenlign[id];
      });
      tegnListe();
    }).catch(function (e) {
      status('Lagringen i nettleseren virker ikke: ' + (e && e.message || e), true);
    });
  }

  function finn(id) {
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return null;
  }

  function hentLyd(id) {
    if (lydLager[id]) return Promise.resolve(lydLager[id]);
    var m = finn(id);
    return LydLager.hentLyd(id).then(function (l) {
      if (!l) throw new Error('lyden mangler');
      // Hold bare noen få i minnet; et opptak på fire minutter er stort.
      var nokler = Object.keys(lydLager);
      if (nokler.length > 3) delete lydLager[nokler[0]];
      lydLager[id] = { kanaler: l.kanaler, fs: m.fs, original: l.original };
      return lydLager[id];
    });
  }

  /* ------------------------------------------------------------- rapport */

  function respons(t) {
    var punkter = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 15000, 18000];
    return punkter.map(function (f) {
      var beste = 0;
      t.respons.f.forEach(function (ff, k) {
        if (Math.abs(Math.log(ff / f)) < Math.abs(Math.log(t.respons.f[beste] / f))) beste = k;
      });
      return A.hz(f).replace(' ', '') + ':' + tall(t.respons.db[beste], 0);
    }).join(' ');
  }

  function rapport(m) {
    var a = m.analyse, g = a.grunn, t = a.test, i = m.info || {};
    var linjer = [];
    linjer.push('Lydløft – ' + m.navn + ' (' + new Date(m.dato).toLocaleString('nb-NO') + ')');
    linjer.push('Vei inn: ' + KILDER[m.kilde] + (m.behandling ? ' MED nettleserbehandling' : '') +
      ' · ' + m.fs + ' Hz · ' + m.kanaler + ' kanal(er) · ' + tall(m.varighet, 1, 's'));
    if (i.format) linjer.push('Format: ' + i.format + (i.bytes ? ' · ' + Math.round(i.bytes / 1024) + ' kB' : '') + (i.dekodet ? ' · dekodet med ' + i.dekodet : ''));
    if (i.mikrofon !== undefined) linjer.push('Mikrofon: ' + (i.mikrofon || '(uten navn)') + ' · kontekst ' + i.kontekstRate + ' Hz');
    if (i.innstillinger) {
      linjer.push('Nettleseren oppga: ' + Object.keys(i.innstillinger).map(function (k) { return k + '=' + i.innstillinger[k]; }).join(' '));
    }
    if (i.nettleser) linjer.push('Nettleser: ' + i.nettleser);
    linjer.push('Nivå: ' + tall(g.lufs, 1, 'LUFS') + ' · topp ' + tall(g.toppDb, 1, 'dBFS') + ' (sann ' +
      tall(g.sannToppDb, 1, 'dBTP') + ') · støygulv ' + tall(g.stoygulvDb, 0, 'dBFS') + ' · klipp ' + g.klipping.hendelser +
      ' · DC ' + tall(g.dc, 4));
    linjer.push('Innhold opp til ' + A.hz(g.ovreInnhold) + (g.kodekkant ? ' · bratt kant ved ' + A.hz(g.kodekkant) : '') +
      (g.kanalforhold ? ' · kanaler: korrelasjon ' + tall(g.kanalforhold.korrelasjon, 4) + (g.kanalforhold.identiske ? ' (identiske)' : '') +
        ', ubalanse ' + tall(g.kanalforhold.ubalanseDb, 1, 'dB') : ''));
    if (g.ltas) linjer.push('Spektrum (dBFS): ' + [63, 125, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000].map(function (f) {
      var beste = 0;
      g.ltas.f.forEach(function (ff, k) { if (Math.abs(Math.log(ff / f)) < Math.abs(Math.log(g.ltas.f[beste] / f))) beste = k; });
      return A.hz(f).replace(' ', '') + ':' + tall(g.ltas.db[beste], 0);
    }).join(' '));
    if (t) {
      if (t.ekteRate) linjer.push('SAMPLINGSRATE: oppgitt ' + t.oppgittRate + ' Hz, testsignalet passer på ' + t.ekteRate + ' Hz');
      linjer.push('Dekket ' + tall(t.dekketS, 1, 's') + ' av ' + tall(LydTestsignal.LENGDE, 1, 's') + ' · trinn målt (dBFS): ' +
        t.trinn.map(function (x) { return tall(x.maalt, 0) + (x.gyldig ? '' : '?'); }).join(' '));
      linjer.push('Testsignal: nedre ' + (t.nedreGrense ? A.hz(t.nedreGrense) : '<20 Hz') +
        ' · øvre ' + (t.ovreGrense ? A.hz(t.ovreGrense) : '>' + A.hz(Math.min(20000, m.fs * 0.49))) +
        ' · RT60 ' + (t.etterklang ? tall(t.etterklang.rt60, 2, 's') + ' (' + t.etterklang.metode + ')' : '–') +
        ' · forvrengning ' + (t.forvrengning ? tall(t.forvrengning.prosent, 2, '%') : 'under støyen'));
      linjer.push('Nivåtrapp: sprang ' + (t.kompresjon ? t.kompresjon.sprangDb.map(function (s) { return tall(s, 1); }).join('/') : '–') +
        ' dB (ideelt 6) → ' + (t.kompresjon ? (t.kompresjon.finnes ? 'KOMPRESJON' : 'lineær') : '–') +
        ' · 1 kHz målt ' + tall(t.frekvens1k, 2, 'Hz'));
      if (t.rosa) linjer.push('Rosa støy: avvik ' + tall(t.rosa.avvikDb, 1, 'dB') + ' mot forventet, ' +
        tall(t.rosa.endringDb, 1, 'dB') + ' over tid → ' + (t.rosa.dempes ? 'STØYDEMPING' : 'uendret'));
      linjer.push('Støy før signalet ' + tall(t.stoygulvDb, 1, 'dBFS') + ' · signal/støy ' + tall(t.signalStoyDb, 0, 'dB') +
        ' · brum ' + (t.brum ? (t.brum.finnes ? 'JA ' : 'nei ') + tall(t.brum.overDb, 0, 'dB') : '–'));
      linjer.push('Respons (dB mot 500–2000 Hz): ' + respons(t));
    } else if (a.testFeil) {
      linjer.push('Testsignal: analysen feilet – ' + a.testFeil);
    } else {
      linjer.push('Testsignal: ikke funnet' + (m.varighet > 75 ? ' (opptak over 75 s letes ikke gjennom)' : ''));
    }
    if (a.funn.length) linjer.push('Funn: ' + a.funn.map(function (f) { return f.tekst; }).join(' | '));
    return linjer.join('\n');
  }

  /* -------------------------------------------------------------- detalj */

  function verdi(navn, v) { return h('div', {}, [h('dt', { tekst: navn }), h('dd', { tekst: v })]); }

  function visDetalj(id) {
    var m = finn(id);
    if (!m) return;
    valgtId = id;
    tegnListe();
    var boks = $('detalj');
    boks.innerHTML = '';
    boks.hidden = false;
    var a = m.analyse, g = a.grunn, t = a.test;

    var navn = h('input', { klasse: 'navnefelt', type: 'text', 'aria-label': 'Navn på opptaket' });
    navn.value = m.navn;
    navn.addEventListener('change', function () {
      m.navn = navn.value.trim() || m.navn;
      LydLager.oppdater(m).then(tegnListe);
    });
    boks.appendChild(h('div', { klasse: 'detaljhode' }, [
      navn,
      h('span', { klasse: 'under', tekst: dato(m.dato) + ' · ' + KILDER[m.kilde] + ' · ' + m.fs + ' Hz · ' +
        (m.kanaler === 1 ? 'mono' : m.kanaler + ' kanaler') + ' · ' + tall(m.varighet, 1, 's') })
    ]));

    var spillKnapp = h('button', { type: 'button', klasse: 'knapp primaer', tekst: '▶ Spill' });
    var likKnapp = h('button', { type: 'button', klasse: 'knapp', tekst: '▶ Spill på ' + MAAL_LUFS + ' LUFS' });
    function spill(knapp, lik) {
      hentLyd(id).then(function (l) {
        var fors = lik ? likForsterkning(g) : 0;
        var tekst = knapp.textContent;
        knapp.textContent = '■ Stopp';
        knapp.onclick = function () { LydOpptak.stoppAvspilling(); };
        LydOpptak.spill(l.kanaler, l.fs, fors, function () {
          knapp.textContent = tekst;
          knapp.onclick = function () { spill(knapp, lik); };
        });
      }).catch(function (e) { status('Kunne ikke spille: ' + e.message, true); });
    }
    spillKnapp.onclick = function () { spill(spillKnapp, false); };
    likKnapp.onclick = function () { spill(likKnapp, true); };

    var knapper = h('div', { klasse: 'knapper' }, [
      spillKnapp, likKnapp,
      h('button', { type: 'button', klasse: 'knapp', tekst: 'Last ned WAV', paclick: function () {
        hentLyd(id).then(function (l) { lastNed(new Blob([LydDsp.lagWav(l.kanaler, l.fs)], { type: 'audio/wav' }), filnavn(m, 'wav')); });
      } }),
      m.kilde !== 'raa' ? h('button', { type: 'button', klasse: 'knapp', tekst: 'Last ned original', paclick: function () {
        hentLyd(id).then(function (l) {
          if (!l.original) { status('Originalfila ble ikke tatt vare på.', true); return; }
          var type = l.original.type || '';
          var ending = /wav/.test(type) ? 'wav' : /webm/.test(type) ? 'webm' : /mp4|m4a|aac/.test(type) ? 'm4a' : /mpeg|mp3/.test(type) ? 'mp3' : 'lyd';
          lastNed(l.original, filnavn(m, ending));
        });
      } }) : null,
      h('button', { type: 'button', klasse: 'knapp', tekst: 'Kopier rapport', paclick: function () {
        kopier(rapport(m)).then(function (ok) { status(ok ? 'Rapporten er kopiert.' : 'Kopiering ble stoppet – rapporten står nederst.', !ok); });
      } }),
      h('button', { type: 'button', klasse: 'knapp fare', tekst: 'Slett', paclick: function () {
        if (!confirm('Slette «' + m.navn + '»?')) return;
        LydLager.slett(id).then(function () {
          delete lydLager[id]; delete sammenlign[id];
          boks.hidden = true; valgtId = null;
          return lastListe();
        });
      } })
    ]);
    boks.appendChild(knapper);

    var bolge = h('canvas', { 'aria-label': 'Lydbølgen' });
    boks.appendChild(bolge);

    var funnListe = h('ul', { klasse: 'funn' }, a.funn.map(function (f) { return h('li', { klasse: f.niva, tekst: f.tekst }); }));
    if (!a.funn.length) funnListe.appendChild(h('li', { klasse: 'ok', tekst: 'Ingen åpenbare feil i opptaket.' }));
    if (!t) funnListe.appendChild(h('li', { klasse: 'merk', tekst: a.testFeil ? 'Analysen av testsignalet feilet: ' + a.testFeil :
      'Testsignalet ble ikke funnet' + (m.varighet > 75 ? ' – opptak over 75 sekunder letes ikke gjennom.' : '. Bare grunnmålingene vises.') }));
    boks.appendChild(funnListe);

    var celler = [
      verdi('Lydstyrke', tall(g.lufs, 1, 'LUFS')),
      verdi('Topp', tall(g.toppDb, 1, 'dBFS')),
      verdi('Sann topp', tall(g.sannToppDb, 1, 'dBTP')),
      verdi('Støygulv (10 % stilleste)', tall(g.stoygulvDb, 0, 'dBFS')),
      verdi('Klipping', g.klipping.hendelser ? g.klipping.hendelser + ' steder' : 'ingen'),
      verdi('Innhold opp til', A.hz(g.ovreInnhold))
    ];
    if (t) {
      celler = celler.concat([
        verdi('Nedre grense (−10 dB)', t.nedreGrense ? A.hz(t.nedreGrense) : 'under 20 Hz'),
        verdi('Øvre grense (−10 dB)', t.ovreGrense ? A.hz(t.ovreGrense) : 'over ' + A.hz(Math.min(20000, m.fs * 0.49))),
        verdi('Etterklang RT60', t.etterklang ? tall(t.etterklang.rt60, 2, 's') : 'for kort til å måles'),
        verdi('Forvrengning', t.forvrengning ? tall(t.forvrengning.prosent, 2, '%') : 'under støyen'),
        verdi('Signal over støy', tall(t.signalStoyDb, 0, 'dB')),
        verdi('1 kHz målt som', tall(t.frekvens1k, 2, 'Hz'))
      ]);
    }
    boks.appendChild(h('dl', { klasse: 'tall' }, celler));

    var frLerret = null, trappLerret = null;
    if (t) {
      boks.appendChild(h('h3', { tekst: 'Frekvensrespons – hele kjeden' }));
      boks.appendChild(h('p', { klasse: 'forklaring', tekst: 'Høyttaler, rom og mikrofon sammen, 0 dB = snittet mellom 500 og 2000 Hz. Stiplet: 0 og −10 dB.' }));
      frLerret = h('canvas', { 'aria-label': 'Frekvensrespons' });
      boks.appendChild(frLerret);
      boks.appendChild(h('h3', { tekst: 'Nivåtrapp' }));
      boks.appendChild(h('p', { klasse: 'forklaring', tekst: '1 kHz i sju trinn på 6 dB. Ligger punktene på den stiplede linja, er nivået lineært. Bøyer de av oppover, trykker noe nivået sammen.' }));
      trappLerret = h('canvas', { 'aria-label': 'Nivåtrapp' });
      boks.appendChild(trappLerret);
    }
    boks.appendChild(h('h3', { tekst: 'Spektrum – gjennomsnitt over hele opptaket' }));
    var ltasLerret = h('canvas', { 'aria-label': 'Spektrum' });
    boks.appendChild(ltasLerret);

    if (m.info) {
      boks.appendChild(h('details', {}, [h('summary', { tekst: 'Hva nettleseren oppga' }),
        h('pre', { tekst: JSON.stringify(m.info, null, 2) })]));
    }
    var tekstfelt = h('textarea', { klasse: 'rapport', readonly: 'readonly' });
    tekstfelt.value = rapport(m);
    boks.appendChild(h('details', {}, [h('summary', { tekst: 'Rapport som tekst' }), tekstfelt]));

    function tegn() {
      if (t) {
        LydTegning.kurver(frLerret, [{ f: t.respons.f, db: t.respons.db }], {
          min: -40, maks: 15, nullLinje: true,
          merk: [{ f: t.nedreGrense, tekst: A.hz(t.nedreGrense) }, { f: t.ovreGrense, tekst: A.hz(t.ovreGrense) }]
        });
        LydTegning.trapp(trappLerret, t.trinn);
      }
      if (g.ltas) LydTegning.kurver(ltasLerret, [{ f: g.ltas.f, db: g.ltas.db }], {
        merk: g.kodekkant ? [{ f: g.kodekkant, tekst: 'kant ' + A.hz(g.kodekkant) }] : []
      });
      hentLyd(id).then(function (l) {
        LydTegning.bolge(bolge, l.kanaler, l.fs, t ? [{ t: t.sveipStart, tekst: 'sveip' }] : []);
      }).catch(function () { /* lyden kan være slettet i mellomtiden */ });
    }
    tegn();
    boks.tegn = tegn;
    boks.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function likForsterkning(g) {
    if (!isFinite(g.lufs)) return 0;
    // Lik lydstyrke, men aldri så høyt at toppene klipper.
    return Math.min(MAAL_LUFS - g.lufs, -0.5 - g.sannToppDb);
  }

  /* ------------------------------------------------------ sammenligning */

  function normaliser(kurve) {
    var s = 0, n = 0;
    kurve.f.forEach(function (f, k) {
      if (f >= 500 && f <= 2000 && isFinite(kurve.db[k])) { s += Math.pow(10, kurve.db[k] / 10); n++; }
    });
    var ref = n ? 10 * Math.log10(s / n) : 0;
    return { f: kurve.f, db: kurve.db.map(function (v) { return v - ref; }) };
  }

  function visSammenligning() {
    var valgte = liste.filter(function (m) { return sammenlign[m.id]; }).slice(0, 4);
    if (valgte.length < 2) return;
    var boks = $('sammenligning');
    boks.innerHTML = '';
    boks.hidden = false;
    boks.appendChild(h('h2', { tekst: 'Sammenligning' }));
    if (Object.keys(sammenlign).length > 4) boks.appendChild(h('p', { klasse: 'forklaring', tekst: 'Viser de fire nyeste av de valgte.' }));

    var forklaring = h('div', { klasse: 'tegnforklaring' }, valgte.map(function (m, i) {
      var s = h('span', { tekst: m.navn });
      s.style.setProperty('--prikk', LydTegning.serieFarge(i));
      return s;
    }));
    boks.appendChild(forklaring);

    var medTest = valgte.filter(function (m) { return m.analyse.test; });
    var fr = null;
    if (medTest.length) {
      boks.appendChild(h('h3', { tekst: 'Frekvensrespons' }));
      boks.appendChild(h('p', { klasse: 'forklaring', tekst: medTest.length < valgte.length ?
        'Bare opptak med testsignal har en respons å vise.' : 'Hvert opptak er satt til 0 dB mellom 500 og 2000 Hz.' }));
      fr = h('canvas', {});
      boks.appendChild(fr);
    }
    boks.appendChild(h('h3', { tekst: 'Spektrum' }));
    boks.appendChild(h('p', { klasse: 'forklaring', tekst: 'Satt til 0 dB mellom 500 og 2000 Hz, så formen kan sammenlignes uansett nivå.' }));
    var ltas = h('canvas', {});
    boks.appendChild(ltas);

    var rader = [
      ['Vei inn', function (m) { return KILDER[m.kilde] + (m.behandling ? ' + behandling' : ''); }],
      ['Rate / kanaler', function (m) { return m.fs + ' Hz / ' + m.kanaler; }],
      ['Lydstyrke', function (m) { return tall(m.analyse.grunn.lufs, 1, 'LUFS'); }],
      ['Støygulv', function (m) { return tall(m.analyse.grunn.stoygulvDb, 0, 'dBFS'); }],
      ['Klipping', function (m) { return String(m.analyse.grunn.klipping.hendelser); }],
      ['Innhold opp til', function (m) { return A.hz(m.analyse.grunn.ovreInnhold); }],
      ['Nedre grense', function (m) { var t = m.analyse.test; return t ? (t.nedreGrense ? A.hz(t.nedreGrense) : '<20 Hz') : '–'; }],
      ['Øvre grense', function (m) { var t = m.analyse.test; return t ? (t.ovreGrense ? A.hz(t.ovreGrense) : 'helt opp') : '–'; }],
      ['RT60', function (m) { var t = m.analyse.test; return t && t.etterklang ? tall(t.etterklang.rt60, 2, 's') : '–'; }],
      ['Nivåtrapp', function (m) { var t = m.analyse.test; return t && t.kompresjon ? (t.kompresjon.finnes ? 'komprimert' : 'lineær') + ' (' + tall(t.kompresjon.snittOvreDb, 1) + ' dB)' : '–'; }],
      ['Rosa støy', function (m) { var t = m.analyse.test; return t && t.rosa ? (t.rosa.dempes ? 'dempes' : 'uendret') + ' (' + tall(t.rosa.avvikDb, 1, 'dB') + ')' : '–'; }],
      ['Signal/støy', function (m) { var t = m.analyse.test; return t ? tall(t.signalStoyDb, 0, 'dB') : '–'; }],
      ['Forvrengning', function (m) { var t = m.analyse.test; return t ? (t.forvrengning ? tall(t.forvrengning.prosent, 2, '%') : 'under støyen') : '–'; }]
    ];
    var tabell = h('table', { klasse: 'tabell' }, [
      h('thead', {}, [h('tr', {}, [h('th', { tekst: '' })].concat(valgte.map(function (m, i) {
        var th = h('th', { tekst: m.navn });
        th.style.color = LydTegning.serieFarge(i);
        return th;
      })))]),
      h('tbody', {}, rader.map(function (r) {
        return h('tr', {}, [h('td', { tekst: r[0] })].concat(valgte.map(function (m) { return h('td', { tekst: r[1](m) }); })));
      }))
    ]);
    boks.appendChild(h('h3', { tekst: 'Tallene' }));
    boks.appendChild(h('div', { klasse: 'tabellramme' }, [tabell]));

    boks.appendChild(h('h3', { tekst: 'Lytt på lik lydstyrke' }));
    boks.appendChild(h('p', { klasse: 'forklaring', tekst: 'Det som er høyest, låter best – derfor spilles alle på ' + MAAL_LUFS + ' LUFS her. Ellers vinner det høyeste opptaket hver gang.' }));
    boks.appendChild(h('div', { klasse: 'knapper' }, valgte.map(function (m, i) {
      var b = h('button', { type: 'button', klasse: 'knapp', tekst: '▶ ' + String.fromCharCode(65 + i) + ': ' + m.navn });
      b.style.borderColor = LydTegning.serieFarge(i);
      b.onclick = function () {
        hentLyd(m.id).then(function (l) { LydOpptak.spill(l.kanaler, l.fs, likForsterkning(m.analyse.grunn)); });
      };
      return b;
    }).concat([h('button', { type: 'button', klasse: 'knapp', tekst: '■ Stopp', paclick: function () { LydOpptak.stoppAvspilling(); } })])));

    function tegn() {
      if (fr) LydTegning.kurver(fr, valgte.map(function (m, i) {
        if (!m.analyse.test) return { f: [], db: [], farge: LydTegning.serieFarge(i) };
        return { f: m.analyse.test.respons.f, db: m.analyse.test.respons.db, farge: LydTegning.serieFarge(i) };
      }), { min: -40, maks: 15, nullLinje: true });
      LydTegning.kurver(ltas, valgte.map(function (m, i) {
        var k = m.analyse.grunn.ltas ? normaliser(m.analyse.grunn.ltas) : { f: [], db: [] };
        return { f: k.f, db: k.db, farge: LydTegning.serieFarge(i) };
      }), { min: -70, maks: 20, nullLinje: true });
    }
    tegn();
    boks.tegn = tegn;
    boks.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------------------------------------------------- oppstart */

  function koble() {
    if (!LydOpptak.stottes()) {
      $('ikkeStotte').hidden = false;
      $('opptak').disabled = true;
      $('testHer').disabled = true;
    }
    $('opptak').addEventListener('click', function () {
      LydOpptak.lydkontekst();
      if (aktivt) stoppOpptak(); else startOpptak().catch(function () {});
    });

    $('testHer').addEventListener('click', function () {
      LydOpptak.lydkontekst();
      if (aktivt) return;
      var grense = LydTestsignal.LENGDE + 3;
      startOpptak(grense).then(function () {
        status('Tar opp – testsignalet starter straks. La telefonen ligge i ro.');
        setTimeout(function () {
          if (!aktivt) return;
          LydOpptak.spillTestsignal(function () { setTimeout(stoppOpptak, 1200); });
        }, 700);
      }).catch(function () {});
    });

    var testTikk = null;
    $('spillTest').addEventListener('click', function () {
      var knapp = $('spillTest');
      if (testTikk) { LydOpptak.stoppAvspilling(); return; }
      var ctx = LydOpptak.lydkontekst();
      if (ctx.sampleRate < 44100) status('Lydkortet går på ' + ctx.sampleRate + ' Hz – sveipet når ikke opp til 20 kHz.', true);
      var start = Date.now();
      knapp.textContent = '■ Stopp testsignalet';
      testTikk = setInterval(function () {
        $('testtid').textContent = sek((Date.now() - start) / 1000) + ' / ' + sek(LydTestsignal.LENGDE);
      }, 250);
      LydOpptak.spillTestsignal(function () {
        clearInterval(testTikk); testTikk = null;
        knapp.textContent = '▶ Spill testsignal';
        $('testtid').textContent = '';
      });
    });

    $('fil').addEventListener('change', function () {
      var fil = this.files && this.files[0];
      this.value = '';
      if (!fil) return;
      status('Leser ' + fil.name + ' …');
      LydOpptak.lesFil(fil).then(behandle).catch(function (e) {
        status('Kunne ikke lese fila: ' + (e && e.message || e) + '. Prøv WAV eller M4A.', true);
      });
    });

    $('sammenlign').addEventListener('click', visSammenligning);
    $('kopierAlle').addEventListener('click', function () {
      if (!liste.length) { status('Ingen opptak å rapportere.'); return; }
      var tekst = liste.slice().reverse().map(rapport).join('\n\n');
      kopier(tekst).then(function (ok) { status(ok ? 'Rapporten for ' + liste.length + ' opptak er kopiert.' : 'Kopiering ble stoppet av nettleseren.', !ok); });
    });

    var venter = null;
    window.addEventListener('resize', function () {
      clearTimeout(venter);
      venter = setTimeout(function () {
        ['detalj', 'sammenligning'].forEach(function (id) { var b = $(id); if (!b.hidden && b.tegn) b.tegn(); });
      }, 150);
    });

    var fmt = LydOpptak.tapsfrittFormat();
    if (fmt !== null) {
      var opt = $('kilde').querySelector('option[value="media-beste"]');
      opt.textContent = 'MediaRecorder – ' + (fmt && /pcm|alac|wav/.test(fmt) ? 'tapsfritt (' + fmt + ')' : 'beste tilgjengelige (' + (fmt || 'standard') + ')');
    } else {
      $('kilde').querySelectorAll('option[value^="media"]').forEach(function (o) { o.disabled = true; });
    }

    lastListe();
  }

  window.LydApp = { rapport: rapport, stoppOpptak: stoppOpptak };
  koble();
})();
