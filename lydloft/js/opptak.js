/*
 * Opptak, opplasting og avspilling — alt som snakker med lydmaskinvaren.
 *
 * Tre veier inn, for det er nettopp forskjellen mellom dem testbenken skal
 * måle:
 *
 * - **Rå** (AudioWorklet): samplingene slik nettleseren leverer dem. Det
 *   beste en nettside kan få, og fortsatt etter det nettleseren har gjort.
 * - **MediaRecorder**: det nettleseren selv koder til. Vi ber om et tapsfritt
 *   format der det finnes (PCM i Chrome og Edge, ALAC i Safari), eller lar
 *   nettleseren velge, for å se hva en vanlig opptaksside ender med.
 * - **Fil**: et opptak gjort i en annen app, typisk Taleopptak på iPhone med
 *   «Tapsfri» slått på. Det går forbi Safari helt, og WebKit har en kjent
 *   feil der mikrofonen i nettleseren gir lavere rate og mono på musikk.
 *
 * Nettleserens lydbehandling (ekkodemping, støydemping, automatisk nivå) er
 * laget for samtaler og ødelegger musikk. Den slås av som standard, og det
 * nettleseren *faktisk* ga, leses tilbake med `getSettings()` — en
 * begrensning er et ønske, ikke en garanti.
 *
 * Én lydkontekst for hele appen, laget inne i et trykk. iOS starter den ellers
 * i stum tilstand og lar den bli der.
 */
'use strict';

var LydOpptak = (function () {

  var kontekst = null;
  var workletLastet = null;

  function lydkontekst() {
    if (!kontekst) {
      var K = window.AudioContext || window.webkitAudioContext;
      kontekst = new K();
    }
    if (kontekst.state === 'suspended') kontekst.resume();
    return kontekst;
  }

  function stottes() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
  }

  var BEHANDLING = ['echoCancellation', 'noiseSuppression', 'autoGainControl', 'voiceIsolation'];

  function begrensninger(behandling, enhet) {
    var stottet = navigator.mediaDevices.getSupportedConstraints ?
      navigator.mediaDevices.getSupportedConstraints() : {};
    var lyd = { channelCount: { ideal: 2 } };
    BEHANDLING.forEach(function (navn) {
      // voiceIsolation er nyere enn de tre andre; ukjente navn er ufarlige,
      // men vi tar den bare med der den finnes, så rapporten er ærlig.
      if (navn !== 'voiceIsolation' || stottet[navn]) lyd[navn] = !!behandling;
    });
    if (enhet) lyd.deviceId = { exact: enhet };
    return lyd;
  }

  function hentStrom(behandling, enhet) {
    var lyd = begrensninger(behandling, enhet);
    return navigator.mediaDevices.getUserMedia({ audio: lyd, video: false })
      .then(function (strom) { return { strom: strom, onsket: lyd }; });
  }

  function info(strom, onsket, ctx) {
    var spor = strom.getAudioTracks()[0];
    var s = spor && spor.getSettings ? spor.getSettings() : {};
    var innstillinger = {};
    Object.keys(s).forEach(function (k) { if (k !== 'deviceId' && k !== 'groupId') innstillinger[k] = s[k]; });
    return {
      mikrofon: spor ? spor.label : '',
      innstillinger: innstillinger,
      onsket: onsket,
      kontekstRate: ctx.sampleRate,
      nettleser: navigator.userAgent
    };
  }

  function enheter() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return Promise.resolve([]);
    return navigator.mediaDevices.enumerateDevices().then(function (liste) {
      return liste.filter(function (d) { return d.kind === 'audioinput'; });
    });
  }

  function slaaSammen(biter, antallKanaler) {
    var n = 0;
    biter.forEach(function (b) { n += b[0].length; });
    var ut = [];
    for (var c = 0; c < antallKanaler; c++) ut.push(new Float32Array(n));
    var o = 0;
    biter.forEach(function (b) {
      for (var k = 0; k < antallKanaler; k++) ut[k].set(b[Math.min(k, b.length - 1)], o);
      o += b[0].length;
    });
    return ut;
  }

  /* -------------------------------------------------------------- rå */

  function startRaa(valg) {
    var ctx = lydkontekst();
    if (!workletLastet) {
      workletLastet = ctx.audioWorklet.addModule('js/opptaker-worklet.js?v=1')
        .catch(function (e) { workletLastet = null; throw e; });
    }
    return Promise.all([workletLastet, hentStrom(valg.behandling, valg.enhet)]).then(function (svar) {
      var strom = svar[1].strom;
      var meta = info(strom, svar[1].onsket, ctx);
      var kilde = ctx.createMediaStreamSource(strom);
      var antall = Math.max(1, Math.min(2, meta.innstillinger.channelCount || 1));
      var node = new AudioWorkletNode(ctx, 'lydloft-opptaker', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: antall, channelCountMode: 'explicit', channelInterpretation: 'discrete'
      });
      // Noden må henge i grafen for å bli kjørt, men skal ikke høres.
      var stum = ctx.createGain();
      stum.gain.value = 0;
      kilde.connect(node);
      node.connect(stum);
      stum.connect(ctx.destination);

      var biter = [];
      var ferdig = null;
      node.port.onmessage = function (e) {
        if (e.data.ferdig) { if (ferdig) ferdig(); return; }
        biter.push(e.data.kanaler);
        if (valg.paaNivaa) valg.paaNivaa(e.data.topp);
      };

      return {
        stopp: function () {
          return new Promise(function (ok) {
            ferdig = ok;
            node.port.postMessage('stopp');
          }).then(function () {
            kilde.disconnect(); node.disconnect(); stum.disconnect();
            strom.getTracks().forEach(function (t) { t.stop(); });
            meta.kilde = 'raa';
            return { kanaler: slaaSammen(biter, antall), fs: ctx.sampleRate, info: meta };
          });
        }
      };
    });
  }

  /* --------------------------------------------------- MediaRecorder */

  var TAPSFRITT = ['audio/webm;codecs=pcm', 'audio/mp4;codecs=alac', 'audio/wav', 'audio/x-wav'];
  var VANLIG = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'];

  function velgFormat(tapsfritt) {
    if (!window.MediaRecorder) return null;
    var liste = tapsfritt ? TAPSFRITT.concat(VANLIG) : [];
    for (var i = 0; i < liste.length; i++) {
      if (MediaRecorder.isTypeSupported(liste[i])) return liste[i];
    }
    return '';
  }

  function dekod(buf) {
    var wav = LydDsp.lesWav(buf);
    if (wav) return Promise.resolve({ kanaler: wav.kanaler, fs: wav.fs, dekodet: 'wav ' + wav.bits + ' bit' });
    var ctx = lydkontekst();
    return new Promise(function (ok, nei) {
      // Den gamle tilbakekallsformen, fordi eldre Safari ikke gir et løfte.
      ctx.decodeAudioData(buf.slice(0), ok, nei);
    }).then(function (ab) {
      var kanaler = [];
      for (var c = 0; c < ab.numberOfChannels; c++) kanaler.push(new Float32Array(ab.getChannelData(c)));
      return { kanaler: kanaler, fs: ab.sampleRate, dekodet: 'nettleseren (omsamplet til ' + ab.sampleRate + ' Hz)' };
    });
  }

  function startMedia(valg) {
    if (!window.MediaRecorder) return Promise.reject(new Error('MediaRecorder finnes ikke i denne nettleseren'));
    var ctx = lydkontekst();
    return hentStrom(valg.behandling, valg.enhet).then(function (svar) {
      var strom = svar.strom;
      var meta = info(strom, svar.onsket, ctx);
      var format = velgFormat(valg.tapsfritt);
      var opptaker = format ?
        new MediaRecorder(strom, { mimeType: format, audioBitsPerSecond: 320000 }) :
        new MediaRecorder(strom);
      var biter = [];
      opptaker.ondataavailable = function (e) { if (e.data && e.data.size) biter.push(e.data); };

      // Nivåmåleren går ved siden av, gjennom lydkonteksten.
      var kilde = ctx.createMediaStreamSource(strom);
      var maaler = ctx.createAnalyser();
      maaler.fftSize = 2048;
      kilde.connect(maaler);
      var buf = new Float32Array(maaler.fftSize);
      var tikk = setInterval(function () {
        maaler.getFloatTimeDomainData(buf);
        var t = 0;
        for (var i = 0; i < buf.length; i++) t = Math.max(t, Math.abs(buf[i]));
        if (valg.paaNivaa) valg.paaNivaa(t);
      }, 80);

      opptaker.start(1000);
      return {
        stopp: function () {
          return new Promise(function (ok) {
            opptaker.onstop = ok;
            opptaker.stop();
          }).then(function () {
            clearInterval(tikk);
            kilde.disconnect();
            strom.getTracks().forEach(function (t) { t.stop(); });
            var blob = new Blob(biter, { type: opptaker.mimeType || format || '' });
            meta.kilde = valg.tapsfritt ? 'media-beste' : 'media-standard';
            meta.format = opptaker.mimeType || format || '(ukjent)';
            meta.bytes = blob.size;
            return blob.arrayBuffer().then(dekod).then(function (d) {
              meta.dekodet = d.dekodet;
              return { kanaler: d.kanaler, fs: d.fs, info: meta, original: blob };
            });
          });
        }
      };
    });
  }

  function start(valg) {
    return valg.kilde === 'raa' ? startRaa(valg) :
      startMedia({ behandling: valg.behandling, enhet: valg.enhet, paaNivaa: valg.paaNivaa,
                   tapsfritt: valg.kilde === 'media-beste' });
  }

  /* ------------------------------------------------------------- fil */

  function lesFil(fil) {
    return fil.arrayBuffer().then(function (buf) {
      return dekod(buf).then(function (d) {
        return {
          kanaler: d.kanaler, fs: d.fs, original: fil,
          info: { kilde: 'fil', filnavn: fil.name, format: fil.type || '(ukjent)', bytes: fil.size,
                  dekodet: d.dekodet, nettleser: navigator.userAgent }
        };
      });
    });
  }

  /* ------------------------------------------------------ avspilling */

  var spiller = null;

  function stoppAvspilling() {
    if (!spiller) return;
    var s = spiller;
    spiller = null;
    s.onended = null;
    try { s.stop(); } catch (e) { /* allerede stoppet */ }
    if (s.paaSlutt) s.paaSlutt();
  }

  // Spiller kanalene, eventuelt med en forsterkning i dB. Kalles fra et trykk.
  function spill(kanaler, fs, forsterkningDb, paaSlutt) {
    stoppAvspilling();
    var ctx = lydkontekst();
    var buf = ctx.createBuffer(kanaler.length, kanaler[0].length, fs);
    kanaler.forEach(function (k, c) { buf.copyToChannel ? buf.copyToChannel(k, c) : buf.getChannelData(c).set(k); });
    var kilde = ctx.createBufferSource();
    kilde.buffer = buf;
    var g = ctx.createGain();
    g.gain.value = Math.pow(10, (forsterkningDb || 0) / 20);
    kilde.connect(g);
    g.connect(ctx.destination);
    kilde.paaSlutt = paaSlutt;
    kilde.onended = function () { if (spiller === kilde) { spiller = null; if (paaSlutt) paaSlutt(); } };
    kilde.start();
    spiller = kilde;
    return kilde;
  }

  function spillTestsignal(paaSlutt) {
    var ctx = lydkontekst();
    var x = LydTestsignal.lagSekvens(ctx.sampleRate);
    return spill([x], ctx.sampleRate, 0, paaSlutt);
  }

  return {
    stottes: stottes,
    lydkontekst: lydkontekst,
    enheter: enheter,
    start: start,
    lesFil: lesFil,
    spill: spill,
    spillTestsignal: spillTestsignal,
    stoppAvspilling: stoppAvspilling,
    tapsfrittFormat: function () { return velgFormat(true); }
  };
})();
