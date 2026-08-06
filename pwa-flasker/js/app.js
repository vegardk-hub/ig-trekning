/*
 * Fargeflasker – grensesnittet.
 *
 * Målgruppen er en femåring, så tre ting styrer valgene her: ingen tidtaking,
 * ingen måte å tape på, og alt kan angres. Trykker man på feil flaske, blir
 * den bare den nye valgte i stedet for å gi et avslag.
 *
 * Vulkanen i midten er både belønningen og vinnervilkåret: hver flaske som
 * blir ferdigsortert, flyr bort og renner ned i den, og står igjen tom. Er
 * vulkanen full, går den i utbrudd, og nivået er løst.
 */
'use strict';

(function () {

  var LAGER = 'fargeflasker';

  /* Vulkanen tegnes i et 200 x 320-rutenett. Disse tallene må stemme med
     stien i VULKAN lenger nede, ellers renner væsken utenfor glasset. */
  var VULKAN_BREDDE = 200, VULKAN_HOYDE = 320;
  var FYLL_TOPP = 34, FYLL_BUNN = 256;
  var KRATER_X = 100, KRATER_Y = 26;

  /* ---------- lyd ---------- */

  // Små toner laget på stedet. Ingen lydfiler å laste ned, og appen virker
  // like godt fra en usb-pinne som fra nett.
  var Lyd = (function () {
    var ctx = null;

    function kontekst() {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { ctx = false; }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx || null;
    }

    function tone(frekvens, forsinkelse, lengde, volum, type, sluttfrekvens) {
      var c = kontekst();
      if (!c || !data.lyd) return;
      var t = c.currentTime + forsinkelse;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(frekvens, t);
      if (sluttfrekvens) osc.frequency.exponentialRampToValueAtTime(sluttfrekvens, t + lengde);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volum, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t); osc.stop(t + lengde + 0.05);
    }

    return {
      plukk: function () { tone(660, 0, 0.09, 0.16, 'triangle'); },
      slipp: function () { tone(420, 0, 0.09, 0.12, 'triangle'); },
      hell:  function () { tone(300, 0, 0.34, 0.14, 'sine', 620); },
      nei:   function () { tone(200, 0, 0.14, 0.12, 'square', 150); },
      // Tappingen glir nedover og lander: fargen forlater flasken for godt.
      tapp: function () {
        tone(720, 0, 0.42, 0.15, 'sine', 240);
        tone(330, 0.36, 0.24, 0.13, 'triangle');
      },
      utbrudd: function () {
        tone(170, 0, 0.9, 0.16, 'sawtooth', 85);
        [523, 659, 784, 1047, 1319].forEach(function (f, i) {
          tone(f, 0.14 + i * 0.11, 0.3, 0.15, 'triangle');
        });
      }
    };
  })();

  /* ---------- lagring ---------- */

  var data = { opplaast: 1, sisteNivaa: 1, lyd: true };

  function lastData() {
    try {
      var raa = localStorage.getItem(LAGER);
      if (raa) {
        var d = JSON.parse(raa);
        if (d && typeof d === 'object') {
          data.opplaast = Math.max(1, d.opplaast | 0);
          data.sisteNivaa = Math.max(1, d.sisteNivaa | 0);
          data.lyd = d.lyd !== false;
        }
      }
    } catch (e) { /* privat modus eller file:// – vi klarer oss uten */ }
  }

  function lagreData() {
    try { localStorage.setItem(LAGER, JSON.stringify(data)); } catch (e) { }
  }

  /* ---------- tilstand ---------- */

  var tilstand = {
    nivaa: 1,
    kapasitet: 4,
    lag: 8,             // hvor mange lag vulkanen rommer = antall fylte flasker
    flasker: [],
    vulkan: [],         // fargene som er tappet ned, i rekkefølge
    start: [],
    historikk: [],
    valgt: null,
    laast: false,
    plan: null          // løsningen Hjelp følger, se hint()
  };

  var brett = document.getElementById('brett');
  var elFlasker = [], elVaeske = [], elVulkan = null, elLag = null, elGnister = null;

  /* ---------- små hjelpere ---------- */

  // Egen tween i stedet for CSS-overgang: høyden på et SVG-rektangel er ikke
  // animerbar med transition i alle nettlesere vi bryr oss om, og vulkanen
  // som stiger er hele belønningen – den kan ikke få lov til å bare hoppe.
  function tween(ms, steg, ferdig) {
    var t0 = performance.now();
    function ramme(naa) {
      var p = Math.min(1, (naa - t0) / ms);
      steg(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(ramme);
      else if (ferdig) ferdig();
    }
    requestAnimationFrame(ramme);
  }

  function vent(ms, sa) { setTimeout(sa, ms); }

  /* ---------- oppsett av nivå ---------- */

  function startNivaa(n) {
    var nivaa = Spill.lagNivaa(n);
    tilstand.nivaa = n;
    tilstand.kapasitet = nivaa.kapasitet;
    tilstand.lag = nivaa.lag;
    tilstand.flasker = Spill.kopi(nivaa.flasker);
    tilstand.start = Spill.kopi(nivaa.flasker);
    tilstand.vulkan = [];
    tilstand.historikk = [];
    tilstand.valgt = null;
    tilstand.laast = false;
    tilstand.plan = null;
    data.sisteNivaa = n;
    lagreData();
    document.getElementById('nivaaTall').textContent = n;
    visTips(n === 1 ? 'Fyll vulkanen! Trykk på en flaske, så på en annen 👆' : '');
    tegn();
  }

  function startPaaNytt() {
    if (tilstand.laast) return;
    tilstand.flasker = Spill.kopi(tilstand.start);
    tilstand.vulkan = [];
    tilstand.historikk = [];
    tilstand.valgt = null;
    tilstand.plan = null;
    Lyd.slipp();
    tegn();
    oppdaterKnapper();
  }

  /* ---------- tegning: flasker ---------- */

  var OMRISS =
    '<svg class="omriss" viewBox="0 0 68 160" aria-hidden="true">' +
      '<path class="kant" d="M27 5 h14 v17 c0 8 19 8 19 24 v88 c0 10 -6 15 -16 15 ' +
      'h-20 c-10 0 -16 -5 -16 -15 v-88 c0 -16 19 -16 19 -24 z"/>' +
      '<path class="blank" d="M16 64 c0 -9 4 -13 7 -15 v72 c-4 -2 -7 -7 -7 -13 z"/>' +
    '</svg>';

  // To etasjer i stedet for én glatt kjegle. En ren kjegle leste som en
  // trakt eller en lampeskjerm; det er avsatsene som gjør at silhuetten blir
  // et byggverk av glass. Venstre halvdel føres ned, bunnen krysses, og
  // høyre halvdel er speilet (x -> 200 - x).
  var KJEGLE =
    'M62 26 L78 50 C78 74 48 84 48 104 L62 116 C62 160 14 200 14 262 ' +
    'L186 262 C186 200 138 160 138 116 L152 104 C152 84 122 74 122 50 ' +
    'L138 26 Z';

  var VULKAN =
    '<svg class="vulkan" viewBox="0 0 200 320" aria-hidden="true">' +
      '<defs><clipPath id="vulkanInnside">' +
        '<path d="M68 34 L84 54 C84 76 54 86 54 106 L68 120 C68 162 22 202 22 256 ' +
        'L178 256 C178 202 132 162 132 120 L146 106 C146 86 116 76 116 54 ' +
        'L132 34 Z"/>' +
      '</clipPath></defs>' +
      '<ellipse class="vulkanskygge" cx="100" cy="292" rx="94" ry="13"/>' +
      '<rect class="vulkanfot" x="6" y="256" width="188" height="30" rx="13"/>' +
      '<path class="vulkanfyll" d="' + KJEGLE + '"/>' +
      '<g clip-path="url(#vulkanInnside)" class="vulkanlag"></g>' +
      '<path class="vulkankant" d="' + KJEGLE + '"/>' +
      '<path class="vulkanblank" d="M30 248 C30 198 68 158 68 118 L78 118 ' +
        'C78 158 42 198 42 248 Z"/>' +
      '<ellipse class="vulkanmunn" cx="100" cy="26" rx="38" ry="9"/>' +
    '</svg>';

  // Flaskene står rundt vulkanen: en stabel på hver side og en rad under.
  // Sidene tar høyst fire hver – en femte gjør stablene høyere enn skjermen –
  // så fra fjorten flasker og opp vokser bunnraden i stedet.
  function fordelFlasker(antall) {
    var side = Math.min(4, Math.floor(antall / 3));
    var bunn = antall - side * 2;
    while (bunn > 5 && side < 4) { side++; bunn -= 2; }
    return { side: side, bunn: bunn };
  }

  // Flaskebredden og vulkanhøyden settes så alt får plass uten rulling.
  // Bredden binder som regel, men på en lav skjerm tar høyden over, og da må
  // begge krympe i takt – derfor løkka i stedet for ett regnestykke.
  function beregnMaal(antall) {
    var W = brett.clientWidth, H = brett.clientHeight, g = 10;
    var f = fordelFlasker(antall);

    var b = Math.min((W * 0.62 - 2 * g) / 2, 78);   // vulkanen får minst 38 %
    if (f.bunn) b = Math.min(b, (W - (f.bunn - 1) * g - 4) / f.bunn);

    // Krymp flaskene til sidestablene får plass over bunnraden.
    var stabel, ledigH;
    for (var i = 0; i < 8; i++) {
      stabel = f.side * (2.35 * b) + Math.max(0, f.side - 1) * g;
      ledigH = H - 2.35 * b - g;
      if (stabel <= ledigH) break;
      b *= 0.92;
    }
    b = Math.max(24, b);

    // Vulkanen tar all plassen som blir igjen. Bredde og høyde settes begge
    // eksplisitt, i samme forhold som viewBoxen: da faller SVG-tegningen
    // nøyaktig sammen med elementet, og kraterPunkt() treffer krateret.
    // Med bare max-width ville nettleseren midtstilt tegningen inni en for
    // bred boks, og strålen hadde landet ved siden av.
    var vulkanH = Math.min(ledigH, Math.max(stabel, 3.4 * b));
    var vulkanB = vulkanH * (VULKAN_BREDDE / VULKAN_HOYDE);
    var ledigB = W - 2 * b - 2 * g;
    if (vulkanB > ledigB) {
      vulkanB = ledigB;
      vulkanH = vulkanB * (VULKAN_HOYDE / VULKAN_BREDDE);
    }

    return { b: b, side: f.side, bunn: f.bunn, vulkanB: vulkanB, vulkanH: vulkanH };
  }

  function tegn() {
    brett.innerHTML = '';
    var m = beregnMaal(tilstand.flasker.length);
    var rot = document.documentElement.style;
    rot.setProperty('--flaskebredde', m.b.toFixed(1) + 'px');
    rot.setProperty('--vulkanbredde', m.vulkanB.toFixed(1) + 'px');
    rot.setProperty('--vulkanhoyde', m.vulkanH.toFixed(1) + 'px');

    elFlasker = [];
    elVaeske = [];

    var arena = document.createElement('div');
    arena.className = 'arena';

    var venstre = document.createElement('div');
    venstre.className = 'sidestabel venstre';
    var hoyre = document.createElement('div');
    hoyre.className = 'sidestabel hoyre';
    var bunn = document.createElement('div');
    bunn.className = 'bunnrad';

    var vulkanboks = document.createElement('div');
    vulkanboks.className = 'vulkanboks';
    vulkanboks.innerHTML = VULKAN + '<div class="gnister"></div>';

    var i = 0, k;
    for (k = 0; k < m.side; k++) { venstre.appendChild(lagFlaske(i)); i++; }
    for (k = 0; k < m.side; k++) { hoyre.appendChild(lagFlaske(i)); i++; }
    for (k = 0; k < m.bunn; k++) { bunn.appendChild(lagFlaske(i)); i++; }

    arena.appendChild(venstre);
    arena.appendChild(vulkanboks);
    arena.appendChild(hoyre);
    arena.appendChild(bunn);
    brett.appendChild(arena);

    elVulkan = vulkanboks.querySelector('.vulkan');
    elLag = vulkanboks.querySelector('.vulkanlag');
    elGnister = vulkanboks.querySelector('.gnister');
    tegnVulkanlag();
  }

  function lagFlaske(indeks) {
    var innhold = tilstand.flasker[indeks];
    var enhet = 100 / tilstand.kapasitet;
    var el = document.createElement('div');
    el.className = 'flaske';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', beskriv(innhold));
    el.dataset.i = indeks;
    el.innerHTML = OMRISS;

    var vaeske = document.createElement('div');
    vaeske.className = 'vaeske';
    innhold.forEach(function (farge) { vaeske.appendChild(lagDel(farge, enhet)); });
    el.insertBefore(vaeske, el.firstChild);

    if (tilstand.valgt === indeks) el.classList.add('valgt');

    el.addEventListener('click', function () { klikk(indeks); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); klikk(indeks); }
    });

    elFlasker[indeks] = el;
    elVaeske[indeks] = vaeske;
    return el;
  }

  function lagDel(farge, hoyde) {
    var d = document.createElement('div');
    d.className = 'del';
    d.style.height = hoyde + '%';
    d.style.background = 'linear-gradient(90deg,' + Spill.FARGER[farge].kode + ' 0%,' +
      Spill.FARGER[farge].lys + ' 42%,' + Spill.FARGER[farge].kode + ' 100%)';
    d.dataset.farge = farge;
    return d;
  }

  function beskriv(innhold) {
    if (!innhold.length) return 'Tom flaske';
    var navn = innhold.map(function (f) { return Spill.FARGER[f].navn; });
    return 'Flaske med ' + navn.join(', ') + ' nedenfra';
  }

  /* ---------- tegning: vulkanen ---------- */

  function lagHoyde() {
    return (FYLL_BUNN - FYLL_TOPP) / tilstand.lag;
  }

  function lagRekt(farge, nr, andel) {
    var full = lagHoyde();
    var h = full * (andel === undefined ? 1 : andel);
    var bunnY = FYLL_BUNN - full * nr;
    var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', '0');
    r.setAttribute('width', String(VULKAN_BREDDE));
    r.setAttribute('y', String(bunnY - h));
    r.setAttribute('height', String(Math.max(0, h)));
    r.setAttribute('fill', Spill.FARGER[farge].kode);
    r.setAttribute('class', 'vulkanvaeske');
    return r;
  }

  function tegnVulkanlag() {
    if (!elLag) return;
    elLag.textContent = '';
    tilstand.vulkan.forEach(function (farge, nr) {
      elLag.appendChild(lagRekt(farge, nr));
    });
  }

  // Punktet midt i krateret, i skjermkoordinater.
  function kraterPunkt() {
    var r = elVulkan.getBoundingClientRect();
    return {
      x: r.left + r.width * (KRATER_X / VULKAN_BREDDE),
      y: r.top + r.height * (KRATER_Y / VULKAN_HOYDE)
    };
  }

  /* ---------- trykk ---------- */

  function klikk(i) {
    if (tilstand.laast) return;
    var flasker = tilstand.flasker;

    if (tilstand.valgt === null) {
      if (!flasker[i].length) { rist(i); return; }
      tilstand.valgt = i;
      elFlasker[i].classList.add('valgt');
      Lyd.plukk();
      skjulTips();
      return;
    }

    if (tilstand.valgt === i) {
      tilstand.valgt = null;
      elFlasker[i].classList.remove('valgt');
      Lyd.slipp();
      return;
    }

    var fra = tilstand.valgt;
    var antall = Spill.kanHelle(flasker, fra, i, tilstand.kapasitet);
    if (antall > 0) { hell(fra, i, antall); return; }

    // Går ikke: si fra med en liten risting, og la trykket velge den nye
    // flasken i stedet. Da slipper barnet å trykke to ganger.
    rist(i);
    elFlasker[fra].classList.remove('valgt');
    if (flasker[i].length) {
      tilstand.valgt = i;
      elFlasker[i].classList.add('valgt');
    } else {
      tilstand.valgt = null;
    }
  }

  function rist(i) {
    var el = elFlasker[i];
    if (!el) return;
    Lyd.nei();
    el.classList.remove('rist');
    void el.offsetWidth;
    el.classList.add('rist');
    vent(340, function () { el.classList.remove('rist'); });
  }

  /* ---------- felles animasjonsbiter ---------- */

  // Flasken svinger om munningen sin (transform-origin i css), så vi kan
  // sikte rett på et punkt uten å regne om vinkelen.
  function flyTil(el, maalX, maalY, vinkel, ms) {
    var r = el.getBoundingClientRect();
    var munnX = r.left + r.width / 2;
    var munnY = r.top + r.height * 0.08;
    el.style.zIndex = '40';
    el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.4,.1,.3,1)';
    el.style.transform = 'translate(' + (maalX - munnX).toFixed(1) + 'px,' +
      (maalY - munnY).toFixed(1) + 'px) rotate(' + vinkel + 'deg)';
  }

  function tilbake(el, ms, sa) {
    el.style.transform = '';
    vent(ms, function () {
      el.style.zIndex = '';
      el.style.transition = '';
      sa();
    });
  }

  function lagStraale(x, y, hoyde, farge, bredde) {
    var s = document.createElement('div');
    s.className = 'straale';
    s.style.left = (x - bredde / 2) + 'px';
    s.style.top = y + 'px';
    s.style.width = bredde + 'px';
    s.style.height = '0px';
    s.style.background = Spill.FARGER[farge].kode;
    document.body.appendChild(s);
    void s.offsetWidth;
    s.style.height = Math.max(6, hoyde) + 'px';
    return s;
  }

  function fjernStraale(s) {
    s.style.height = '0px';
    s.style.opacity = '0';
    vent(220, function () { s.remove(); });
  }

  /* ---------- hellingen ---------- */

  function hell(fra, til, antall) {
    tilstand.laast = true;
    tilstand.historikk.push({
      flasker: Spill.kopi(tilstand.flasker), vulkan: tilstand.vulkan.slice()
    });
    tilstand.valgt = null;
    skjulTips();

    var farge = Spill.toppFarge(tilstand.flasker[fra]);
    var nivaaTil = tilstand.flasker[til].length;
    var eFra = elFlasker[fra], eTil = elFlasker[til];
    var rFra = eFra.getBoundingClientRect(), rTil = eTil.getBoundingClientRect();

    var maalX = rTil.left + rTil.width / 2;
    var maalY = rTil.top - rTil.height * 0.14;
    // Overflaten på væsken i målflasken: prosentene er de samme som i css.
    var overflate = rTil.top + rTil.height * (0.919 - 0.619 * nivaaTil / tilstand.kapasitet);

    eFra.classList.remove('valgt');
    flyTil(eFra, maalX, maalY, rFra.left <= rTil.left ? 54 : -54, 240);

    vent(250, function () {
      var straale = lagStraale(maalX, maalY, overflate - maalY + 4, farge, 8);
      Lyd.hell();

      var enhet = 100 / tilstand.kapasitet;
      var deler = elVaeske[fra].children;
      for (var k = 0; k < antall; k++) deler[deler.length - 1 - k].style.height = '0%';

      var nye = [];
      for (var m = 0; m < antall; m++) {
        var d = lagDel(farge, enhet);
        d.style.height = '0%';
        elVaeske[til].appendChild(d);
        nye.push(d);
      }
      void elVaeske[til].offsetWidth;
      nye.forEach(function (d) { d.style.height = enhet + '%'; });

      vent(320, function () {
        fjernStraale(straale);
        tilbake(eFra, 240, function () {
          Spill.helle(tilstand.flasker, fra, til, antall);
          tegn();
          etterTrekk(fra, til, antall);
        });
      });
    });
  }

  /* ---------- tappingen ned i vulkanen ---------- */

  // Etter hvert trekk: ble noen flaske ferdig? Da flyr den bort til krateret,
  // tømmer seg, og kommer tilbake tom. Flere kan bli ferdige av samme trekk,
  // så de tappes etter tur i stedet for oppå hverandre.
  function etterTrekk(fra, til, antall) {
    var ferdige = [];
    for (var i = 0; i < tilstand.flasker.length; i++) {
      if (Spill.erKomplett(tilstand.flasker[i], tilstand.kapasitet)) {
        ferdige.push({ flaske: i, farge: tilstand.flasker[i][0] });
      }
    }
    if (!ferdige.length) {
      planEtterTrekk(fra, til, antall);
      tilstand.laast = false;
      oppdaterKnapper();
      return;
    }
    tappNeste(ferdige, 0, { fra: fra, til: til, antall: antall });
  }

  function tappNeste(ferdige, nr, trekk) {
    if (nr >= ferdige.length) {
      // Først når alt er tappet, stemmer brettet med det planen venter seg.
      planEtterTrekk(trekk.fra, trekk.til, trekk.antall);
      tegn();
      if (Spill.erFerdig(tilstand.flasker)) vent(240, utbrudd);
      else { tilstand.laast = false; oppdaterKnapper(); }
      return;
    }

    var f = ferdige[nr];
    var el = elFlasker[f.flaske];
    var krater = kraterPunkt();
    var r = el.getBoundingClientRect();
    var tilVenstre = r.left + r.width / 2 <= krater.x;

    el.classList.add('tapper');
    // Nesten opp ned, så hele innholdet renner ut i krateret.
    flyTil(el, krater.x, krater.y - r.height * 0.10, tilVenstre ? 148 : -148, 380);
    Lyd.tapp();

    vent(400, function () {
      var straale = lagStraale(krater.x, krater.y - 4, 34, f.farge, 12);

      var deler = el.querySelectorAll('.del');
      for (var i = 0; i < deler.length; i++) deler[i].style.height = '0%';

      var plass = tilstand.vulkan.length;
      var rekt = lagRekt(f.farge, plass, 0);
      elLag.appendChild(rekt);
      var h = lagHoyde(), bunnY = FYLL_BUNN - h * plass;
      tween(460, function (p) {
        rekt.setAttribute('height', String(h * p));
        rekt.setAttribute('y', String(bunnY - h * p));
      });

      vent(480, function () {
        fjernStraale(straale);
        tilstand.vulkan.push(f.farge);
        tilstand.flasker[f.flaske] = [];
        tilbake(el, 300, function () {
          el.classList.remove('tapper');
          tappNeste(ferdige, nr + 1, trekk);
        });
      });
    });
  }

  /* ---------- utbrudd og seier ---------- */

  function utbrudd() {
    Lyd.utbrudd();
    if (elVulkan) elVulkan.classList.add('gaar');
    if (elGnister && tilstand.vulkan.length) {
      elGnister.textContent = '';
      for (var i = 0; i < 80; i++) {
        var p = document.createElement('i');
        var vinkel = (-90 + (Math.random() * 116 - 58)) * Math.PI / 180;
        var fart = 70 + Math.random() * 190;
        p.style.setProperty('--dx', (Math.cos(vinkel) * fart).toFixed(0) + 'px');
        p.style.setProperty('--dy', (Math.sin(vinkel) * fart).toFixed(0) + 'px');
        p.style.background = Spill.FARGER[tilstand.vulkan[i % tilstand.vulkan.length]].kode;
        p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
        p.style.animationDuration = (1.1 + Math.random() * 0.9).toFixed(2) + 's';
        elGnister.appendChild(p);
      }
    }
    vent(1500, visSeier);
  }

  var seier = document.getElementById('seier');

  function visSeier() {
    if (tilstand.nivaa + 1 > data.opplaast) data.opplaast = tilstand.nivaa + 1;
    lagreData();
    document.getElementById('seierTekst').textContent =
      'Vulkanen er full! Nivå ' + tilstand.nivaa + ' er ferdig.';
    seier.classList.remove('skjult');
    konfetti();
  }

  function konfetti() {
    var boks = document.getElementById('konfetti');
    boks.innerHTML = '';
    for (var i = 0; i < 55; i++) {
      var b = document.createElement('i');
      b.style.left = (Math.random() * 100) + '%';
      b.style.background = Spill.FARGER[i % Spill.FARGER.length].kode;
      b.style.animationDelay = (Math.random() * 1.1).toFixed(2) + 's';
      b.style.animationDuration = (2 + Math.random() * 1.6).toFixed(2) + 's';
      b.style.transform = 'scale(' + (0.6 + Math.random() * 0.8).toFixed(2) + ')';
      boks.appendChild(b);
    }
  }

  /* ---------- angre og hint ---------- */

  function angre() {
    if (tilstand.laast || !tilstand.historikk.length) return;
    var forrige = tilstand.historikk.pop();
    tilstand.flasker = forrige.flasker;
    tilstand.vulkan = forrige.vulkan;
    tilstand.valgt = null;
    tilstand.plan = null;      // planen gjaldt stillingen vi nettopp forlot
    Lyd.slipp();
    tegn();
    oppdaterKnapper();
  }

  function oppdaterKnapper() {
    document.getElementById('knappAngre').disabled = tilstand.historikk.length === 0;
  }

  // Stillingen slik den står, flaske for flaske. Ikke sortert: planen under
  // peker på flasker med indeks, så to brett med samme innhold i bytto
  // rekkefølge er ikke det samme brettet for oss.
  function stillingsNokkel(flasker) {
    return flasker.map(function (f) { return f.join(','); }).join('|');
  }

  // Hjelp følger én plan i stedet for å regne ut en ny løsning hver gang.
  //
  // Løseren er et dybdesøk og gir *en* løsning, ikke den korteste. Regnet vi
  // på nytt ved hvert trykk, kunne den like gjerne foreslå å angre sitt eget
  // forrige råd: nivå 25 vippet mellom to stillinger, 0->3, 3->0, 0->3, i det
  // uendelige. Et barn som trykker Hjelp om igjen, kom aldri videre.
  //
  // Planen holdes så lenge brettet står der planen forventer. Gjør barnet noe
  // annet, kastes den og vi regner på nytt – det er jo da et nytt råd trengs.
  function hentPlan() {
    var naa = stillingsNokkel(tilstand.flasker);
    var p = tilstand.plan;
    if (p && p.nokkel === naa && p.trekk.length) return p;

    var fasit = Spill.loes(tilstand.flasker, tilstand.kapasitet);
    if (!fasit || !fasit.length) { tilstand.plan = null; return null; }
    tilstand.plan = { nokkel: naa, trekk: fasit };
    return tilstand.plan;
  }

  // Kalles etter at et trekk er utført. Fulgte det planen, går vi ett steg
  // videre i den; ellers er planen foreldet.
  function planEtterTrekk(fra, til, antall) {
    var p = tilstand.plan;
    if (!p || !p.trekk.length) return;
    var t = p.trekk[0];
    if (t.fra === fra && t.til === til && t.antall === antall) {
      p.trekk.shift();
      p.nokkel = stillingsNokkel(tilstand.flasker);
    } else {
      tilstand.plan = null;
    }
  }

  function hint() {
    if (tilstand.laast) return;
    var p = hentPlan();
    if (!p) {
      visTips('Det går ikke videre herfra – trykk Angre 🙂');
      return;
    }
    tilstand.valgt = null;
    tegn();
    peker(p.trekk[0].fra);
    peker(p.trekk[0].til);
    visTips('Hell fra den ene til den andre 👀');
  }

  function peker(i) {
    var el = elFlasker[i];
    if (!el) return;
    el.classList.add('peker');
    vent(4600, function () { el.classList.remove('peker'); });
  }

  /* ---------- tips ---------- */

  var tipsEl = document.getElementById('tips');

  function visTips(tekst) {
    tipsEl.textContent = tekst || '';
    tipsEl.classList.toggle('borte', !tekst);
  }

  function skjulTips() { tipsEl.classList.add('borte'); }

  /* ---------- nivåvelger ---------- */

  var velger = document.getElementById('nivaavelger');

  function visVelger() {
    var liste = document.getElementById('nivaaliste');
    liste.innerHTML = '';
    var antall = Math.max(30, data.opplaast + 5);
    for (var n = 1; n <= antall; n++) {
      var b = document.createElement('button');
      b.className = 'nivaaknapp';
      b.textContent = n;
      if (n < data.opplaast) b.classList.add('klart');
      if (n === tilstand.nivaa) b.classList.add('naa');
      if (n > data.opplaast) {
        b.classList.add('laast');
        b.disabled = true;
        b.textContent = '🔒';
      } else {
        (function (m) {
          b.addEventListener('click', function () {
            velger.classList.add('skjult');
            startNivaa(m);
            oppdaterKnapper();
          });
        })(n);
      }
      liste.appendChild(b);
    }
    velger.classList.remove('skjult');

    // Rull fram til nivået som spilles nå – ellers må man lete etter det.
    var naa = liste.querySelector('.naa');
    if (naa) liste.scrollTop = Math.max(0, naa.offsetTop - liste.clientHeight / 2);
  }

  /* ---------- knapper ---------- */

  document.getElementById('knappAngre').addEventListener('click', angre);
  document.getElementById('knappHint').addEventListener('click', hint);
  document.getElementById('knappStartPaaNytt').addEventListener('click', startPaaNytt);
  document.getElementById('knappNivaaer').addEventListener('click', visVelger);
  document.getElementById('knappLukkVelger').addEventListener('click', function () {
    velger.classList.add('skjult');
  });

  document.getElementById('knappNeste').addEventListener('click', function () {
    seier.classList.add('skjult');
    startNivaa(tilstand.nivaa + 1);
    oppdaterKnapper();
  });
  document.getElementById('knappOmIgjen').addEventListener('click', function () {
    seier.classList.add('skjult');
    startNivaa(tilstand.nivaa);
    oppdaterKnapper();
  });

  var knappLyd = document.getElementById('knappLyd');
  function tegnLydknapp() {
    knappLyd.firstElementChild.textContent = data.lyd ? '🔊' : '🔇';
  }
  knappLyd.addEventListener('click', function () {
    data.lyd = !data.lyd;
    lagreData();
    tegnLydknapp();
    if (data.lyd) Lyd.plukk();
  });

  // Skjermen kan snus, og da må flaskene måles på nytt.
  var tidtaker = null;
  window.addEventListener('resize', function () {
    clearTimeout(tidtaker);
    tidtaker = setTimeout(function () { if (!tilstand.laast) tegn(); }, 150);
  });

  /* ---------- i gang ---------- */

  lastData();
  tegnLydknapp();
  startNivaa(data.sisteNivaa);
  oppdaterKnapper();

  /* enkeltfil: start – dette klippes bort i flaskespill.html, som ikke har sw.js */
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  /* enkeltfil: slutt */

})();
