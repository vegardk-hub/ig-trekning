/*
 * Verkstedet — velg en lyd, skru på den, hør det mens du skrur, lagre.
 *
 * To ting styrer oppbygningen:
 *
 * - **Det du hører, er det som lagres.** Forhåndslyttingen og lagringen
 *   bygger samme kjede fra `effekter.js`, den ene i sanntid og den andre i en
 *   `OfflineAudioContext`. Det finnes ingen egen «eksportkode» som kan gli fra.
 * - **Glidebryterne svarer med en gang.** Filtre og effekter endres mens lyden
 *   spiller. Tempo, tonehøyde og baklengs endrer selve lyden og må regnes ut
 *   på nytt; det skjer i en egen tråd, og den nye versjonen byttes inn på
 *   samme sted i stykket når den er klar.
 *
 * Posisjonen i stykket er en andel (0–1), ikke sekunder. Da står den stille
 * når tempoet endres og lengden med det.
 */
'use strict';

(function () {

  var $ = function (id) { return document.getElementById(id); };
  var E = LydEffekter;

  var GLIDERE = [
    { gruppe: 'tone', navn: 'bass', etikett: 'Bass', min: -15, max: 15, steg: 0.5, vis: db },
    { gruppe: 'tone', navn: 'mellom', etikett: 'Mellomtone', min: -12, max: 12, steg: 0.5, vis: db },
    { gruppe: 'tone', navn: 'diskant', etikett: 'Diskant', min: -15, max: 15, steg: 0.5, vis: db },
    { gruppe: 'tone', navn: 'lavkutt', etikett: 'Kutt bassen under', min: 20, max: 1000, log: true, vis: hz },
    { gruppe: 'tone', navn: 'toppkutt', etikett: 'Kutt diskanten over', min: 500, max: 20000, log: true, vis: hz },
    { gruppe: 'tone', navn: 'volum', etikett: 'Volum', min: -20, max: 6, steg: 0.5, vis: db },
    { gruppe: 'tempo', navn: 'tempo', etikett: 'Tempo', min: 0.5, max: 2, log: true, vis: prosent },
    { gruppe: 'tempo', navn: 'halvtoner', etikett: 'Tonehøyde', min: -12, max: 12, steg: 1, vis: halvtoner },
    { gruppe: 'tempo', navn: 'trommer', etikett: 'Trommer', min: 0, max: 1, steg: 0.01, vis: andel },
    { gruppe: 'effekter', navn: 'romklang', etikett: 'Romklang', min: 0, max: 1, steg: 0.01, vis: andel },
    { gruppe: 'effekter', navn: 'romstorrelse', etikett: 'Romstørrelse', min: 0.3, max: 6, steg: 0.1, vis: sek },
    { gruppe: 'effekter', navn: 'ekko', etikett: 'Ekko', min: 0, max: 1, steg: 0.01, vis: andel },
    { gruppe: 'effekter', navn: 'ekkotid', etikett: 'Tid mellom ekkoene', min: 0.05, max: 1, steg: 0.01, vis: sek },
    { gruppe: 'effekter', navn: 'forvrengning', etikett: 'Forvrengning', min: 0, max: 1, steg: 0.01, vis: andel },
    { gruppe: 'effekter', navn: 'chorus', etikett: 'Chorus / vibrato', min: 0, max: 1, steg: 0.01, vis: andel },
    { gruppe: 'effekter', navn: 'chorusfart', etikett: 'Vibratofart', min: 0.1, max: 6, steg: 0.1, vis: hzDes },
    { gruppe: 'effekter', navn: 'lofi', etikett: 'Lo-fi (grove trinn)', min: 0, max: 1, steg: 0.01, vis: andel },
    { gruppe: 'effekter', navn: 'knitring', etikett: 'Knitring og sus', min: 0, max: 1, steg: 0.01, vis: andel },
    { gruppe: 'effekter', navn: 'robot', etikett: 'Robot', min: 0, max: 1, steg: 0.01, vis: andel }
  ];
  var LYDENDRENDE = { tempo: 1, halvtoner: 1, baklengs: 1 };
  // Det en karakter (Robot, Kirke …) ikke rører: farten og stilen.
  var IKKE_KARAKTER = { tempo: 1, halvtoner: 1, baklengs: 1, stil: 1, slagBpm: 1, trommer: 1 };

  function db(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',') + ' dB'; }
  function hz(v) { return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + ' kHz' : Math.round(v) + ' Hz'; }
  function hzDes(v) { return v.toFixed(1).replace('.', ',') + ' Hz'; }
  function prosent(v) { return Math.round(v * 100) + ' %'; }
  function halvtoner(v) { return v === 0 ? '0' : (v > 0 ? '+' : '−') + Math.abs(v) + ' halvtoner'; }
  function andel(v) { return Math.round(v * 100) + ' %'; }
  function sek(v) { return v.toFixed(2).replace('.', ',') + ' s'; }
  function tid(s) { var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }

  var verdier = kopi(E.STANDARD);
  var kilde = null;          // { id, navn, kanaler, fs }
  var lyd = null;            // { kanaler, fs, p, buffer } – strukket, klar til å spilles
  var fx = null;
  var spiller = null;        // { node, start, offset, original }
  var andelNaa = 0;
  var horOriginal = false;
  var aktivtOpptak = null;
  var biblioteket = [];
  var inputs = {};

  function kopi(o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; }
  function status(id, tekst, feil) { $(id).textContent = tekst || ''; $(id).classList.toggle('feil', !!feil); }

  /* -------------------------------------------------------- lydkonteksten */

  function ctx() { return LydOpptak.lydkontekst(); }
  // Kjeden hører til én lydkontekst. Byttes konteksten (se friskKontekst),
  // bygges kjeden på nytt med verdiene slik de står.
  function sorgForKjede() {
    var c = ctx();
    if (!fx || fx.ctx !== c) {
      if (fx) fx.riv();
      fx = E.bygg(c, c.destination, verdier);
      fx.ctx = c;
    }
    return fx;
  }
  function p() { return Math.pow(2, verdier.halvtoner / 12); }

  /* ------------------------------------------------------------ strekking */

  var strekker = null, strekkVent = {}, strekkNr = 0, sisteStrekk = 0;
  try {
    strekker = new Worker('js/strekk-arbeider.js?v=6');
    strekker.onmessage = function (e) {
      var v = strekkVent[e.data.id];
      delete strekkVent[e.data.id];
      if (!v) return;
      if (e.data.feil) v.nei(new Error(e.data.feil)); else v.ok(e.data);
    };
  } catch (e) { strekker = null; }

  function strekk(kanaler, fs, faktor, baklengs) {
    if (!strekker) {
      var k = baklengs ? kanaler.map(function (x) { return Float32Array.from(x).reverse(); }) : kanaler;
      return Promise.resolve(LydStrekkReserve(k, fs, faktor));
    }
    return new Promise(function (ok, nei) {
      var id = ++strekkNr;
      strekkVent[id] = { ok: ok, nei: nei };
      strekker.postMessage({ id: id, kanaler: kanaler, fs: fs, faktor: faktor, baklengs: baklengs });
    }).then(function (svar) { return svar.kanaler; });
  }

  function finnTakt(kanaler, fs) {
    if (!strekker) return Promise.resolve(window.LydTakt ? LydTakt.finnTempo(kanaler, fs) : null);
    return new Promise(function (ok, nei) {
      var id = ++strekkNr;
      strekkVent[id] = { ok: ok, nei: nei };
      strekker.postMessage({ id: id, type: 'tempo', kanaler: kanaler, fs: fs });
    }).then(function (svar) { return svar.takt; });
  }

  /* -------------------------------------------------------------- trommer */

  /*
   * Trommene spilles som én takt i sløyfe ved siden av lyden, inn i samme
   * effektkjede — under vann blir trommene også våte. De følger tempoet:
   * `slagBpm` er takten i opptaket slik den ble funnet (i oktaven nærmest
   * stilen), og trommene går i slagBpm · tempo. Skrur noen på tempoet eller
   * trykker Ekorn, følger trommene med.
   */
  function harTrommer() { return verdier.stil !== 'ingen' && verdier.trommer > 0 && verdier.slagBpm > 0; }
  function trommeBpm() { return verdier.slagBpm * verdier.tempo; }

  // Sekunder inn i den nye lyden der et slag ligger — taktens ener.
  function trommeFase() {
    var t = kilde && kilde.takt;
    if (!t || !t.tydelig) return 0;
    var lengde = kilde.kanaler[0].length / kilde.fs;
    var inn = verdier.baklengs ? lengde - t.forsteSlag : t.forsteSlag;
    return inn / verdier.tempo;
  }

  var trommeNivaa = {};
  // Trommene legges et par dB under opptaket, uansett hvor høyt det er tatt opp.
  function trommeForsterkning() {
    var id = verdier.stil;
    if (trommeNivaa[id] === undefined) {
      var takt = LydTrommer.lagTakt(id, LydTrommer.finnStil(id).bpm, 48000);
      var fire = new Float32Array(takt.length * 4);
      for (var i = 0; i < 4; i++) fire.set(takt, i * takt.length);
      trommeNivaa[id] = LydDsp.lufs([fire], 48000);
    }
    var musikk = kilde && isFinite(kilde.lufs) ? kilde.lufs : -20;
    var db = musikk - trommeNivaa[id] - 3 + 20 * Math.log10(verdier.trommer / 0.6);
    return Math.pow(10, Math.min(24, db) / 20);
  }

  var trommeBuffer = null;
  function lagTrommeKilde(c, utTid) {
    var bpm = trommeBpm(), nokkel = verdier.stil + '|' + bpm.toFixed(4);
    if (!trommeBuffer || trommeBuffer.nokkel !== nokkel || trommeBuffer.ctx !== c) {
      var x = LydTrommer.lagTakt(verdier.stil, bpm, c.sampleRate);
      var b = c.createBuffer(1, x.length, c.sampleRate);
      b.getChannelData(0).set(x);
      trommeBuffer = { nokkel: nokkel, ctx: c, buffer: b };
    }
    var node = c.createBufferSource();
    node.buffer = trommeBuffer.buffer;
    node.loop = true;
    var takt = node.buffer.duration;
    var g = c.createGain();
    g.gain.value = trommeForsterkning();
    node.connect(g);
    return { node: node, g: g, offset: (((utTid - trommeFase()) % takt) + takt) % takt };
  }
  function LydStrekkReserve(k, fs, faktor) {
    return window.LydStrekk ? window.LydStrekk.strekk(k, fs, faktor) : k;
  }

  var strekkTimer = null;
  function lagLyd(umiddelbart) {
    clearTimeout(strekkTimer);
    return new Promise(function (ok) {
      strekkTimer = setTimeout(function () {
        if (!kilde) { ok(); return; }
        var faktor = p() / verdier.tempo;
        var nokkel = kilde.id + '|' + faktor.toFixed(6) + '|' + !!verdier.baklengs;
        // Samme lyd som sist: ingenting å regne ut. Lagringen spør alltid, og
        // fire minutter strukket på nytt er ti sekunder på en telefon.
        if (lyd && lyd.nokkel === nokkel) { ok(); return; }
        var nr = ++sisteStrekk;
        var trenger = Math.abs(faktor - 1) > 1e-4 || verdier.baklengs;
        if (trenger) status('strekkstatus', 'Regner ut nytt tempo og ny tonehøyde …');
        var arbeid = trenger ? strekk(kilde.kanaler, kilde.fs, faktor, verdier.baklengs) : Promise.resolve(kilde.kanaler);
        arbeid.then(function (kanaler) {
          if (nr !== sisteStrekk) return ok();
          var her = spiller && !spiller.original ? naaAndel() : null;
          lyd = { kanaler: kanaler, fs: kilde.fs, p: p(), buffer: null, nokkel: nokkel };
          status('strekkstatus', '');
          oppdaterLengde();
          if (her !== null) start(her);
          ok();
        }).catch(function (e) { status('strekkstatus', 'Kunne ikke endre tempoet: ' + e.message, true); ok(); });
      }, umiddelbart ? 0 : 250);
    });
  }

  function lagBuffer(c, l) {
    var b = c.createBuffer(l.kanaler.length, l.kanaler[0].length, l.fs);
    l.kanaler.forEach(function (k, i) { b.getChannelData(i).set(k); });
    return b;
  }

  /* ----------------------------------------------------------- avspilling */

  function varighetUt() { return lyd ? lyd.kanaler[0].length / lyd.fs / lyd.p : 0; }
  function visSpiller(pa) {
    $('spillikon').innerHTML = LydIkoner.svg(pa ? 'pause' : 'spill');
    $('spilltekst').textContent = pa ? 'Pause' : 'Spill';
    $('spill').setAttribute('aria-label', pa ? 'Pause' : 'Spill');
    document.body.classList.toggle('spiller-pa', pa);
  }

  function oppdaterLengde() { $('lengde').textContent = tid(horOriginal && kilde ? kilde.kanaler[0].length / kilde.fs : varighetUt()); }

  function stopp() {
    if (!spiller) return;
    andelNaa = naaAndel();
    var s = spiller;
    spiller = null;
    stoppNoder(s);
    visSpiller(false);
  }

  function stoppNoder(s) {
    s.node.onended = null;
    try { s.node.stop(); } catch (e) { /* allerede stoppet */ }
    s.node.disconnect();
    if (s.trommer) {
      try { s.trommer.node.stop(); } catch (e) { /* allerede stoppet */ }
      s.trommer.node.disconnect(); s.trommer.g.disconnect();
    }
  }

  function naaAndel() {
    if (!spiller) return andelNaa;
    var c = ctx();
    var forlop = (c.currentTime - spiller.start) * spiller.fart / spiller.bufferSek;
    var a = spiller.offset + forlop;
    return Math.min(1, a);
  }

  function start(fra) {
    if (!lyd) return;
    var c = ctx();
    if (spiller) stoppNoder(spiller);
    var original = horOriginal;
    var kildeLyd = original ? { kanaler: kilde.kanaler, fs: kilde.fs, p: 1 } : lyd;
    // Bufferne hører også til konteksten de ble laget i.
    if (!original && (!lyd.buffer || lyd.buffer.ctx !== c)) { lyd.buffer = lagBuffer(c, lyd); lyd.buffer.ctx = c; }
    if (original && (!kilde.buffer || kilde.buffer.ctx !== c)) { kilde.buffer = lagBuffer(c, kildeLyd); kilde.buffer.ctx = c; }
    var buffer = original ? kilde.buffer : lyd.buffer;
    var node = c.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = kildeLyd.p;
    // Ingen `loop` på lyden: gjentakelsen skjer i `onended`, så trommene
    // startes på nytt i takt med den. En sløyfe på lyden alene ville latt
    // trommene gli ut av takt ved hver runde.
    node.loop = false;
    // Baklengs: originalen spilles fra speilvendt posisjon, så A/B treffer
    // samme sted i stykket.
    var a = fra >= 1 ? 0 : fra;
    var bufAndel = original && verdier.baklengs ? 1 - a : a;
    if (original) {
      node.connect(c.destination);
    } else {
      node.connect(sorgForKjede().inngang);
    }
    node.start(0, bufAndel * buffer.duration);
    spiller = { node: node, start: c.currentTime, offset: a, fart: kildeLyd.p, bufferSek: buffer.duration, original: original };
    if (!original && harTrommer()) {
      var t = lagTrommeKilde(c, a * varighetUt());
      t.g.connect(sorgForKjede().inngang);
      t.node.start(0, t.offset);
      spiller.trommer = t;
    }
    node.onended = function () {
      if (!spiller || spiller.node !== node) return;
      if ($('sloyfe').checked) { start(0); return; }
      stoppNoder(spiller); spiller = null; andelNaa = 0; visSpiller(false);
    };
    visSpiller(true);
  }

  var IOS_HOLDER = 'iOS slipper ikke til lyden. Stopp musikk eller video som spiller i andre apper, og trykk spill igjen.';
  setInterval(function () {
    var holdt = spiller && ctx().state !== 'running';
    if (holdt && $('strekkstatus').textContent !== IOS_HOLDER) status('strekkstatus', IOS_HOLDER, true);
    if (!holdt && $('strekkstatus').textContent === IOS_HOLDER) status('strekkstatus', '');
    if (!spiller) return;
    var a = naaAndel();
    $('posisjon').value = Math.round(a * 1000);
    $('naa').textContent = tid(a * (horOriginal && kilde ? kilde.kanaler[0].length / kilde.fs : varighetUt()));
  }, 150);

  /* --------------------------------------------------------- glidebryterne */

  function tilGlider(g, v) {
    if (g.log) return Math.round(1000 * Math.log(v / g.min) / Math.log(g.max / g.min));
    return v;
  }
  function fraGlider(g, r) {
    if (g.log) return g.min * Math.pow(g.max / g.min, r / 1000);
    return parseFloat(r);
  }

  function lagGlidere() {
    GLIDERE.forEach(function (g) {
      var inp = document.createElement('input');
      inp.type = 'range';
      inp.id = 'g-' + g.navn;
      if (g.log) { inp.min = 0; inp.max = 1000; inp.step = 1; }
      else { inp.min = g.min; inp.max = g.max; inp.step = g.steg; }
      var verdi = document.createElement('span');
      verdi.className = 'gliderverdi';
      var etikett = document.createElement('label');
      etikett.className = 'glider';
      etikett.htmlFor = inp.id;
      var topp = document.createElement('span');
      topp.className = 'glidertopp';
      var navn = document.createElement('span');
      navn.textContent = g.etikett;
      topp.appendChild(navn); topp.appendChild(verdi);
      etikett.appendChild(topp);
      var boks = document.createElement('div');
      boks.className = 'gliderboks';
      boks.appendChild(etikett);
      boks.appendChild(inp);
      // Dobbelttrykk på navnet setter glidebryteren tilbake.
      topp.addEventListener('dblclick', function (e) { e.preventDefault(); settVerdi(g.navn, E.STANDARD[g.navn]); });
      inp.addEventListener('input', function () { settVerdi(g.navn, fraGlider(g, inp.value), true); });
      $('g-' + g.gruppe).appendChild(boks);
      inputs[g.navn] = { inp: inp, vis: verdi, g: g };
    });
  }

  function visVerdi(navn) {
    var x = inputs[navn];
    if (!x) {
      if (navn === 'baklengs' && $('baklengs')) $('baklengs').setAttribute('aria-pressed', verdier.baklengs ? 'true' : 'false');
      return;
    }
    x.vis.textContent = x.g.vis(verdier[navn]);
  }

  function settVerdi(navn, v, fraGliderSelv) {
    verdier[navn] = v;
    var x = inputs[navn];
    if (x && !fraGliderSelv) x.inp.value = tilGlider(x.g, v);
    visVerdi(navn);
    if (LYDENDRENDE[navn]) lagLyd();
    else if (navn === 'trommer') oppdaterTrommer();
    else if (fx) fx.sett(navn, v);
    markerValg();
    foreslaNavn();
  }

  // Volumet kan glide mens det spiller; skrus trommene på fra null, eller
  // byttes stilen, må de startes på nytt fra riktig sted.
  function oppdaterTrommer() {
    if (!spiller || spiller.original) return;
    if (spiller.trommer && harTrommer()) {
      spiller.trommer.g.gain.setTargetAtTime(trommeForsterkning(), ctx().currentTime, 0.03);
    } else if (!!spiller.trommer !== harTrommer()) start(naaAndel());
  }

  function settAlle(nye) {
    var lydEndres = false, stilEndres = false;
    Object.keys(nye).forEach(function (k) {
      if (LYDENDRENDE[k] && verdier[k] !== nye[k]) lydEndres = true;
      if ((k === 'stil' || k === 'slagBpm' || k === 'trommer') && verdier[k] !== nye[k]) stilEndres = true;
      verdier[k] = nye[k];
      var x = inputs[k];
      if (x) x.inp.value = tilGlider(x.g, nye[k]);
      visVerdi(k);
      if (!IKKE_KARAKTER[k] && fx) fx.sett(k, nye[k]);
    });
    if (lydEndres) lagLyd();
    else if (stilEndres && spiller && !spiller.original) start(naaAndel());
    markerValg();
    foreslaNavn();
  }

  /* ------------------------------------------------------------- brikkene */

  function lik(a, b) { return Math.abs(a - b) < 1e-6; }
  function passer(forhand, utenom) {
    return Object.keys(E.STANDARD).every(function (k) {
      if (utenom[k]) return true;
      var mal = forhand.verdier[k] !== undefined ? forhand.verdier[k] : E.STANDARD[k];
      return typeof mal === 'number' ? lik(verdier[k], mal) : verdier[k] === mal;
    });
  }

  // Hver flis får sin neonfarge. Rekkefølgen er valgt så naboer aldri har
  // samme farge i et rutenett på tre eller fire kolonner.
  var NEON = ['--rosa', '--cyan', '--lime', '--gul', '--oransje', '--lilla', '--blaa', '--rod'];
  function neon(i) { return 'var(' + NEON[i % NEON.length] + ')'; }

  function flis(id, navn, ikon, farge, vedTrykk) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'flis valgbrikke';
    b.dataset.id = id;
    b.style.setProperty('--farge', farge);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = LydIkoner.svg(ikon) + '<span></span>';
    b.lastChild.textContent = navn;
    b.addEventListener('click', vedTrykk);
    return b;
  }

  function lagBrikker() {
    E.KARAKTERER.forEach(function (k, i) {
      $('karakterer').appendChild(flis(k.id, k.navn, k.id, neon(i), function () {
        // En karakter starter fra null, men rører ikke tempo og tonehøyde.
        var nye = {};
        Object.keys(E.STANDARD).forEach(function (n) { if (!IKKE_KARAKTER[n]) nye[n] = E.STANDARD[n]; });
        Object.keys(k.verdier).forEach(function (n) { nye[n] = k.verdier[n]; });
        settAlle(nye);
      }));
    });
    E.FART.forEach(function (f, i) {
      $('fart').appendChild(flis(f.id, f.navn, f.id, neon(i + 3), function () { settAlle(kopi(f.verdier)); }));
    });
    var ingen = flis('ingenstil', 'Ingen stil', 'ingenstil', neon(5), function () { velgStil('ingenstil'); });
    ingen.classList.add('stilflis');
    $('stiler').appendChild(ingen);
    LydTrommer.STILER.forEach(function (st, i) {
      var b = flis(st.id, st.navn, st.id, neon(i + 6), function () { velgStil(st.id); });
      b.classList.add('stilflis');
      var tall = document.createElement('span');
      tall.className = 'bpm';
      tall.textContent = st.bpm + ' BPM';
      b.appendChild(tall);
      $('stiler').appendChild(b);
    });
    var bak = flis('baklengs', 'Baklengs', 'baklengs', neon(2), function () { settVerdi('baklengs', !verdier.baklengs); });
    bak.id = 'baklengs';
    bak.classList.remove('valgbrikke');
    $('fart').appendChild(bak);
  }

  /*
   * En stil setter tempoet så opptaket går i stilens BPM, og legger på
   * trommene. Opptakets takt tolkes i den oktaven som ligger nærmest, så rock
   * på et stykke målt til 62 BPM blir 124 → 120 og ikke en dobling av farten.
   * Uten tydelig takt står tempoet, og trommene går i stilens eget.
   */
  function velgStil(id) {
    if (id === 'ingenstil') { settAlle({ stil: 'ingen', slagBpm: 0, tempo: 1 }); return; }
    var st = LydTrommer.finnStil(id), t = kilde && kilde.takt;
    if (t && t.tydelig) {
      var grunn = LydTakt.naermesteOktav(t.bpm, st.bpm);
      settAlle({ stil: id, slagBpm: grunn, tempo: Math.max(0.5, Math.min(2, st.bpm / grunn)) });
    } else {
      settAlle({ stil: id, slagBpm: st.bpm, tempo: 1 });
    }
  }

  function visTakt() {
    var t = kilde && kilde.takt, el = $('taktinfo');
    if (!kilde) { el.textContent = ''; return; }
    if (t === undefined) el.textContent = 'Lytter etter takten …';
    else if (t && t.tydelig) el.textContent = 'Opptaket går i ca. ' + Math.round(t.bpm) + ' slag i minuttet. Velg en stil, så går det i stilens tempo.';
    else el.textContent = 'Fant ingen tydelig takt i opptaket. Stilene legger på trommer i sitt eget tempo.';
  }

  function markerValg() {
    var utenomFart = kopi(IKKE_KARAKTER);
    $('karakterer').querySelectorAll('.valgbrikke').forEach(function (b) {
      var k = E.KARAKTERER.filter(function (x) { return x.id === b.dataset.id; })[0];
      b.setAttribute('aria-pressed', passer(k, utenomFart) ? 'true' : 'false');
    });
    $('stiler').querySelectorAll('.stilflis').forEach(function (b) {
      var valgt = b.dataset.id === 'ingenstil' ? verdier.stil === 'ingen' : verdier.stil === b.dataset.id;
      b.setAttribute('aria-pressed', valgt ? 'true' : 'false');
    });
    $('fart').querySelectorAll('.valgbrikke').forEach(function (b) {
      var f = E.FART.filter(function (x) { return x.id === b.dataset.id; })[0];
      b.setAttribute('aria-pressed', lik(verdier.tempo, f.verdier.tempo) && lik(verdier.halvtoner, f.verdier.halvtoner) ? 'true' : 'false');
    });
  }

  var navnEndretSelv = false;
  function foreslaNavn() {
    if (navnEndretSelv || !kilde) return;
    var deler = [];
    var k = E.KARAKTERER.filter(function (x) { return x.id !== 'ingen' && passer(x, IKKE_KARAKTER); })[0];
    if (k) deler.push(k.navn);
    else if (!passer(E.KARAKTERER[0], IKKE_KARAKTER)) deler.push('egen miks');
    var stil = LydTrommer.finnStil(verdier.stil);
    if (stil) {
      deler.push(stil.navn);
      if (verdier.halvtoner) deler.push(halvtoner(verdier.halvtoner));
      if (verdier.baklengs) deler.push('baklengs');
      $('versjonsnavn').value = kilde.navn + ' – ' + deler.join(', ');
      return;
    }
    var f = E.FART.filter(function (x) { return x.id !== 'normal' && lik(verdier.tempo, x.verdier.tempo) && lik(verdier.halvtoner, x.verdier.halvtoner); })[0];
    if (f) deler.push(f.navn);
    else {
      if (!lik(verdier.tempo, 1)) deler.push(Math.round(verdier.tempo * 100) + ' %');
      if (verdier.halvtoner) deler.push(halvtoner(verdier.halvtoner));
    }
    if (verdier.baklengs) deler.push('baklengs');
    $('versjonsnavn').value = kilde.navn + (deler.length ? ' – ' + deler.join(', ') : ' – kopi');
  }

  /* ------------------------------------------------------------ biblioteket */

  var KILDEUTSEENDE = {
    raa: { ikon: 'mikrofon', farge: 'var(--rosa)' },
    fil: { ikon: 'lastOpp', farge: 'var(--lilla)' },
    versjon: { ikon: 'stjerne', farge: 'var(--lime)' }
  };

  function lastBibliotek() {
    return LydLager.alle().then(function (l) {
      biblioteket = l;
      var rad = $('lyder');
      rad.innerHTML = '';
      $('tomtBibliotek').hidden = l.length > 0;
      l.forEach(function (m) {
        var u = KILDEUTSEENDE[m.kilde] || { ikon: 'note', farge: 'var(--cyan)' };
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lydflis';
        b.setAttribute('role', 'listitem');
        b.dataset.id = m.id;
        b.style.setProperty('--farge', u.farge);
        b.setAttribute('aria-pressed', kilde && kilde.id === m.id ? 'true' : 'false');
        b.innerHTML = LydIkoner.svg(u.ikon) + '<span class="navn"></span><span class="lengde"></span>';
        b.querySelector('.navn').textContent = m.navn;
        b.querySelector('.lengde').textContent = tid(m.varighet) + (m.kilde === 'versjon' ? ' · ny versjon' : '');
        b.addEventListener('click', function () { velg(m.id); });
        rad.appendChild(b);
      });
    }).catch(function (e) { status('status', 'Lagringen i nettleseren virker ikke: ' + e.message, true); });
  }

  function markerLyd() {
    $('lyder').querySelectorAll('.lydflis').forEach(function (b) {
      b.setAttribute('aria-pressed', kilde && kilde.id === b.dataset.id ? 'true' : 'false');
    });
  }

  // Spilleren står fast nederst; siden får like mye luft under seg.
  function visSpillerlinje() {
    $('spiller').hidden = false;
    document.documentElement.style.setProperty('--spillerhoyde', $('spiller').offsetHeight + 'px');
  }

  function velg(id) {
    var m = biblioteket.filter(function (x) { return x.id === id; })[0];
    if (!m) return Promise.resolve();
    stopp();
    status('status', 'Henter ' + m.navn + ' …');
    return LydLager.hentLyd(id).then(function (l) {
      if (!l) throw new Error('lyden mangler');
      var lufs = m.analyse && m.analyse.grunn ? m.analyse.grunn.lufs : null;
      if (typeof lufs !== 'number') lufs = LydDsp.lufs(l.kanaler, m.fs);
      kilde = { id: id, navn: m.navn, kanaler: l.kanaler, fs: m.fs, buffer: null, lufs: lufs, takt: undefined };
      visTakt();
      finnTakt(l.kanaler, m.fs).then(function (t) {
        if (!kilde || kilde.id !== id) return;
        kilde.takt = t || null;
        visTakt();
        // Var en stil valgt før takten var kjent, regnes tempoet ut på nytt.
        if (verdier.stil !== 'ingen') velgStil(verdier.stil);
      }).catch(function () { if (kilde && kilde.id === id) { kilde.takt = null; visTakt(); } });
      andelNaa = 0;
      $('posisjon').value = 0;
      $('kildenavn').textContent = m.navn;
      $('verksted').hidden = false;
      visSpillerlinje();
      markerLyd();
      navnEndretSelv = false;
      foreslaNavn();
      status('status', '');
      return lagLyd(true);
    }).catch(function (e) { status('status', 'Kunne ikke hente lyden: ' + e.message, true); });
  }

  /* ----------------------------------------------------------- lagre lyd */

  var analysator = null;
  function grunnAnalyse(kanaler, fs) {
    if (!analysator) {
      try { analysator = new Worker('js/analyse-arbeider.js?v=6'); } catch (e) { analysator = null; }
    }
    if (!analysator) return Promise.resolve(null);
    return new Promise(function (ok) {
      var id = Date.now() + Math.random();
      function svar(e) {
        if (e.data.id !== id) return;
        analysator.removeEventListener('message', svar);
        ok(e.data.analyse || null);
      }
      analysator.addEventListener('message', svar);
      analysator.postMessage({ id: id, kanaler: kanaler, fs: fs, bareGrunn: true });
    });
  }

  function lagreIBiblioteket(res, navn, kildetype, ekstra) {
    var meta = {
      id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      dato: Date.now(), navn: navn, kilde: kildetype, behandling: false,
      fs: res.fs, kanaler: res.kanaler.length, varighet: res.kanaler[0].length / res.fs,
      info: Object.assign({}, res.info || {}, ekstra || {}), analyse: null
    };
    return grunnAnalyse(res.kanaler, res.fs).then(function (a) {
      meta.analyse = a || { grunn: null, test: null, funn: [] };
      return LydLager.lagre(meta, { id: meta.id, kanaler: res.kanaler, original: res.original || null });
    }).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      return meta;
    });
  }

  /* --------------------------------------------------------------- opptak */

  function maaler(topp) {
    var d = 20 * Math.log10(Math.max(topp, 1e-6));
    var f = $('maalerfyll');
    f.style.width = (Math.max(0, Math.min(1, (d + 60) / 60)) * 100).toFixed(1) + '%';
    f.classList.toggle('hoy', d > -6 && d <= -1);
    f.classList.toggle('rod', d > -1);
  }

  function opptakKnapp() {
    ctx();
    if (aktivtOpptak) { stoppOpptak(); return; }
    stopp();
    status('status', 'Ber om mikrofonen …');
    LydOpptak.start({ kilde: 'raa', behandling: false, paaNivaa: maaler }).then(function (h) {
      var t0 = Date.now();
      aktivtOpptak = { h: h, tikk: setInterval(function () {
        var s = (Date.now() - t0) / 1000;
        $('tid').textContent = tid(s);
        if (s >= 240) stoppOpptak();
      }, 200) };
      $('opptak').classList.add('aktiv');
      $('opptaksikon').innerHTML = LydIkoner.svg('stopp');
      $('opptak').setAttribute('aria-label', 'Stopp opptaket');
      $('opptakstekst').textContent = 'Stopp';
      status('status', 'Tar opp …');
    }).catch(function (e) {
      status('status', e && e.name === 'NotAllowedError' ? 'Mikrofonen ble nektet.' : 'Kunne ikke ta opp: ' + (e && e.message || e), true);
    });
  }

  function stoppOpptak() {
    var a = aktivtOpptak;
    if (!a) return;
    aktivtOpptak = null;
    clearInterval(a.tikk);
    $('opptak').classList.remove('aktiv');
    $('opptaksikon').innerHTML = LydIkoner.svg('mikrofon');
    $('opptak').setAttribute('aria-label', 'Ta opp');
    $('opptakstekst').textContent = 'Ta opp';
    maaler(0);
    status('status', 'Lagrer opptaket …');
    a.h.stopp().then(function (res) {
      var d = new Date();
      var navn = 'Opptak ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
      return lagreIBiblioteket(res, navn, 'raa');
    }).then(function (meta) {
      return lastBibliotek(meta.id).then(function () { return velg(meta.id); });
    }).catch(function (e) { status('status', 'Kunne ikke lagre opptaket: ' + e.message, true); });
  }

  /* ------------------------------------------------------------ eksport */

  function render() {
    if (!lyd) return Promise.reject(new Error('ingen lyd valgt'));
    var v = kopi(verdier);
    var l = lyd;
    var lengde = Math.ceil(l.kanaler[0].length / l.p + E.hale(v) * l.fs);
    var K = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var off = new K(2, lengde, l.fs);
    var kjede = E.bygg(off, off.destination, v);
    var node = off.createBufferSource();
    node.buffer = lagBuffer(off, l);
    node.playbackRate.value = l.p;
    node.connect(kjede.inngang);
    node.start(0);
    if (harTrommer()) {
      var t = lagTrommeKilde(off, 0);
      t.g.connect(kjede.inngang);
      t.node.start(0, t.offset);
      t.node.stop(l.kanaler[0].length / l.fs / l.p);
    }
    return off.startRendering().then(function (buf) {
      var kanaler = [new Float32Array(buf.getChannelData(0)), new Float32Array(buf.getChannelData(1))];
      // Samme lydstyrke som strømmetjenestene, men aldri over −1 dBTP.
      var lufs = LydDsp.lufs(kanaler, l.fs);
      var topp = LydDsp.dbAmp(LydDsp.sannTopp(kanaler));
      var g = isFinite(lufs) ? Math.min(-14 - lufs, -1 - topp) : 0;
      var faktor = Math.pow(10, g / 20);
      kanaler.forEach(function (k) { for (var i = 0; i < k.length; i++) k[i] *= faktor; });
      return { kanaler: kanaler, fs: l.fs, verdier: v };
    });
  }

  function lastNedFil(kanaler, fs, navn) {
    var blob = new Blob([LydDsp.lagWav(kanaler, fs)], { type: 'audio/wav' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = navn.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '.wav';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function nar(knapp, tekst, arbeid) {
    var etikett = knapp.querySelector('span:last-child') || knapp;
    var gammel = etikett.textContent;
    knapp.disabled = true; etikett.textContent = tekst;
    return arbeid().finally(function () { knapp.disabled = false; etikett.textContent = gammel; });
  }

  var toastTimer = null;
  function toast(tekst) {
    var t = $('toast');
    t.textContent = tekst;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* -------------------------------------------------------------- oppstart */

  function koble() {
    lagGlidere();
    lagBrikker();
    settAlle(kopi(E.STANDARD));
    [['opptaksikon', 'mikrofon'], ['lastOppIkon', 'lastOpp'], ['egneIkon', 'glidere'], ['nullstillIkon', 'nullstill'],
     ['lagreIkon', 'stjerne'], ['lastNedIkon', 'lastNed']].forEach(function (p) { $(p[0]).innerHTML = LydIkoner.svg(p[1]); });
    visSpiller(false);

    // Egne innstillinger huskes per nettleser, men det er en bekvemmelighet:
    // virker ikke lagringen, starter panelet bare lukket.
    function visEgne(apen) {
      $('egne').hidden = !apen;
      $('egneKnapp').setAttribute('aria-expanded', apen ? 'true' : 'false');
      try { localStorage.setItem('lydloft-egne', apen ? '1' : '0'); } catch (e) { /* privat modus */ }
    }
    var husket = false;
    try { husket = localStorage.getItem('lydloft-egne') === '1'; } catch (e) { husket = false; }
    visEgne(husket);
    $('egneKnapp').addEventListener('click', function () { visEgne($('egne').hidden); });

    if (!LydOpptak.stottes()) {
      $('opptak').disabled = true;
      status('status', 'Mikrofonen er ikke tilgjengelig her (krever https). Opplasting og biblioteket virker.');
    }
    $('opptak').addEventListener('click', opptakKnapp);
    $('fil').addEventListener('change', function () {
      var fil = this.files && this.files[0];
      this.value = '';
      if (!fil) return;
      ctx();
      status('status', 'Leser ' + fil.name + ' …');
      LydOpptak.lesFil(fil).then(function (res) {
        return lagreIBiblioteket(res, fil.name.replace(/\.[^.]+$/, ''), 'fil');
      }).then(function (meta) {
        return lastBibliotek().then(function () { return velg(meta.id); });
      }).catch(function (e) { status('status', 'Kunne ikke lese fila: ' + (e && e.message || e), true); });
    });

    $('spill').addEventListener('click', function () {
      // Står det spill, men lyden er holdt igjen av iOS, er det ikke en
      // pause brukeren ber om — da skal lyden startes i en frisk kontekst.
      var holdt = spiller && ctx().state !== 'running';
      if (spiller && !holdt) { stopp(); return; }
      var fra = spiller ? naaAndel() : andelNaa;
      if (spiller) stopp();
      LydOpptak.friskKontekst();
      start(fra);
    });
    function forEtter(original) {
      if (horOriginal === original) return;
      horOriginal = original;
      $('for').setAttribute('aria-pressed', original ? 'true' : 'false');
      $('etter').setAttribute('aria-pressed', original ? 'false' : 'true');
      oppdaterLengde();
      if (spiller) start(naaAndel());
    }
    $('for').addEventListener('click', function () { forEtter(true); });
    $('etter').addEventListener('click', function () { forEtter(false); });
    $('posisjon').addEventListener('input', function () {
      andelNaa = this.value / 1000;
      if (spiller) start(andelNaa);
      $('naa').textContent = tid(andelNaa * varighetUt());
    });
    // Gjentakelsen leses i `onended`, så avkrysningen trenger ingen lytter.

    $('versjonsnavn').addEventListener('input', function () { navnEndretSelv = true; });
    $('nullstill').addEventListener('click', function () { navnEndretSelv = false; settAlle(kopi(E.STANDARD)); });

    $('lagre').addEventListener('click', function () {
      var navn = $('versjonsnavn').value.trim() || (kilde && kilde.navn + ' – ny versjon');
      nar(this, 'Lager versjonen …', function () {
        status('lagrestatus', '');
        return lagLyd(true).then(render).then(function (r) {
          return lagreIBiblioteket({ kanaler: r.kanaler, fs: r.fs }, navn, 'versjon',
            { fra: kilde.navn, fraId: kilde.id, oppskrift: r.verdier });
        }).then(function (meta) {
          status('lagrestatus', '«' + meta.navn + '» ligger nå i Mine lyder.');
          toast('Lagret! ✦ ' + meta.navn);
          return lastBibliotek();
        }).catch(function (e) { status('lagrestatus', 'Kunne ikke lagre: ' + e.message, true); });
      });
    });
    $('lastNed').addEventListener('click', function () {
      var navn = $('versjonsnavn').value.trim() || 'lydloft';
      nar(this, 'Lager fila …', function () {
        return lagLyd(true).then(render).then(function (r) { lastNedFil(r.kanaler, r.fs, navn); })
          .catch(function (e) { status('lagrestatus', 'Kunne ikke lage fila: ' + e.message, true); });
      });
    });

    lastBibliotek();
  }

  window.LydVerksted = { verdier: function () { return kopi(verdier); }, render: render, velg: velg,
    takt: function () { return kilde && kilde.takt; } };
  koble();
})();
