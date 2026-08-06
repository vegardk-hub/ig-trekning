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

  /* Vulkanen tegnes i et 320 x 190-rutenett – bred og lav. Den var høy og
     smal før, og da måtte den enten rage over flaskene eller krympe til en
     strek. Disse tallene må stemme med stiene i VULKAN lenger nede, ellers
     renner væsken utenfor glasset. */
  var VULKAN_BREDDE = 320, VULKAN_HOYDE = 215;
  var VULKAN_FORHOLD = VULKAN_BREDDE / VULKAN_HOYDE;
  var FYLL_TOPP = 32, FYLL_BUNN = 184;
  var KRATER_X = 160, KRATER_Y = 24;

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
  var elFlasker = [], elVaeske = [];
  var elVulkanboks = null, elVulkan = null, elLag = null, elGnister = null;

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

  // Bred, lav kjegle med konkave sider: bratt ved krateret, flatere mot foten.
  // Det er konkaviteten som gjør silhuetten til en vulkan i stedet for en
  // trakt. Venstre halvdel føres ned, bunnen krysses, høyre er speilet.
  // Bredt krater og tydelig konkave sider. Et smalt krater gjorde silhuetten
  // til en kjegle med flat topp – en trakthatt, ikke en vulkan.
  var KJEGLE = 'M118 24 C106 70 80 130 20 190 L300 190 C240 130 214 70 202 24 Z';

  // Lavaen renner ned utsiden når vulkanen går. Stiene følger kjeglen og
  // vifter utover; pathLength="1" gjør at samme dash-animasjon virker på alle
  // seks uansett hvor lange de faktisk er.
  // Stiene ender under kjeglefoten, så lavaen renner ut over sokkelen i
  // stedet for å stoppe brått på kanten.
  var LAVASTIER = [
    'M132 28 C120 70 92 128 38 194',
    'M138 28 C128 78 110 134 80 196',
    'M148 30 C144 82 139 138 126 196',
    'M172 30 C176 82 181 138 194 196',
    'M182 28 C192 78 210 134 240 196',
    'M188 28 C200 70 228 128 282 194'
  ];

  var VULKAN =
    '<svg class="vulkan" viewBox="0 0 320 215" aria-hidden="true">' +
      '<defs><clipPath id="vulkanInnside">' +
        '<path d="M124 32 C112 74 86 132 32 184 L288 184 C234 132 208 74 196 32 Z"/>' +
      '</clipPath></defs>' +
      '<ellipse class="vulkanskygge" cx="160" cy="204" rx="152" ry="9"/>' +
      '<rect class="vulkanfot" x="8" y="184" width="304" height="20" rx="9"/>' +
      '<path class="vulkanfyll" d="' + KJEGLE + '"/>' +
      '<g clip-path="url(#vulkanInnside)" class="vulkanlag"></g>' +
      '<path class="vulkankant" d="' + KJEGLE + '"/>' +
      '<path class="vulkanblank" d="M48 182 C100 128 116 74 124 32 L136 32 ' +
        'C128 76 112 130 62 184 Z"/>' +
      '<g class="lavastrommer">' +
        LAVASTIER.map(function (d) {
          return '<path class="lava" d="' + d + '" pathLength="1"/>';
        }).join('') +
      '</g>' +
      '<ellipse class="vulkanglod" cx="160" cy="24" rx="42" ry="9"/>' +
      '<ellipse class="vulkanmunn" cx="160" cy="24" rx="42" ry="9"/>' +
    '</svg>';

  // Flaskene står på hver side av vulkanen, og resten over den. Sidene tar
  // høyst fire hver – en femte gjør stablene høyere enn skjermen.
  //
  // Alt bunnstilles mot samme gulvlinje, så vulkanen står nede der den hører
  // hjemme i stedet for å sveve midt i brettet.
  function fordelFlasker(antall) {
    var side = Math.min(4, Math.floor(antall / 3));
    var midt = antall - side * 2;
    return { side: side, midt: midt };
  }

  // Setter flaskebredden og vulkanmålene så alt får plass uten rulling.
  // Bredden binder som regel, men på en lav skjerm tar høyden over, og da må
  // alt krympe i takt – derfor løkka i stedet for ett regnestykke.
  function beregnMaal(antall) {
    var W = brett.clientWidth, H = brett.clientHeight, g = 10;
    var f = fordelFlasker(antall);

    // Flaskene over vulkanen kan stå på én bred rad eller flere smale. Færre
    // per rad gir bredere flasker, for midtsøyla stjeler mindre av bredden –
    // og bredden er det knappe godet, ikke høyden. Vi prøver alle
    // inndelingene og beholder den som gir de største flaskene.
    var beste = null;
    for (var pr = Math.max(1, Math.min(f.midt, 4)); pr >= 1; pr--) {
      var rader = f.midt ? Math.ceil(f.midt / pr) : 0;
      // 72 px er taket på flaskebredden: over det blir midtsøyla – og dermed
      // vulkanen – for smal til å bære feiringen.
      var b = Math.min(72, (W - 2 * g - (pr - 1) * g) / (2 + pr));

      for (var i = 0; i < 12; i++) {
        var sideH = f.side * (2.35 * b) + Math.max(0, f.side - 1) * g;
        var midtH = rader * (2.35 * b) + Math.max(0, rader - 1) * g;

        // Vulkanen fyller midtsøylens bredde, men holdes lav med vilje: den
        // skal stå ved siden av flaskene, ikke rage over dem.
        var vulkanH = Math.min((W - 2 * b - 2 * g) / VULKAN_FORHOLD, H * 0.32);
        var total = Math.max(sideH, midtH + (rader ? g : 0) + vulkanH);

        if (total <= H || b <= 24) {
          if (!beste || b > beste.b) {
            beste = {
              b: b, side: f.side, midt: f.midt, perRad: pr,
              vulkanB: vulkanH * VULKAN_FORHOLD, vulkanH: vulkanH
            };
          }
          break;
        }
        b *= 0.94;
      }
    }

    // Bredde og høyde settes begge eksplisitt, i viewBoxens forhold: da faller
    // SVG-tegningen nøyaktig sammen med elementet, og kraterPunkt() treffer
    // krateret. Med bare max-width ville nettleseren midtstilt tegningen inni
    // en for bred boks, og strålen hadde landet ved siden av.
    return beste;
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

    // Midtsøyla er flaskene som ikke fikk plass på sidene, med vulkanen
    // nederst. Innholdet pakkes mot bunnen, så vulkanfoten står på samme
    // gulvlinje som den nederste flasken i sidestablene.
    var midtsoyle = document.createElement('div');
    midtsoyle.className = 'midtsoyle';
    var midtrad = document.createElement('div');
    midtrad.className = 'midtrad';
    // +2 px slark: uten den bryter fire flasker som akkurat går opp i
    // bredden, til 3 + 1 på grunn av avrunding.
    midtrad.style.maxWidth =
      (m.perRad * m.b + (m.perRad - 1) * 10 + 2).toFixed(1) + 'px';

    var vulkanboks = document.createElement('div');
    vulkanboks.className = 'vulkanboks';
    vulkanboks.innerHTML = VULKAN + '<div class="gnister"></div>';
    vulkanboks.setAttribute('role', 'button');
    vulkanboks.setAttribute('tabindex', '0');
    vulkanboks.setAttribute('aria-label',
      'Vulkanen, ' + tilstand.vulkan.length + ' av ' + tilstand.lag + ' fylt');
    vulkanboks.addEventListener('click', klikkVulkan);
    vulkanboks.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); klikkVulkan(); }
    });
    // Lys opp når en full flaske er valgt, så det er tydelig hvor den skal.
    if (tilstand.valgt !== null &&
        Spill.erKomplett(tilstand.flasker[tilstand.valgt], tilstand.kapasitet)) {
      vulkanboks.classList.add('klar');
    }

    var i = 0, k;
    for (k = 0; k < m.side; k++) { venstre.appendChild(lagFlaske(i)); i++; }
    for (k = 0; k < m.side; k++) { hoyre.appendChild(lagFlaske(i)); i++; }
    for (k = 0; k < m.midt; k++) { midtrad.appendChild(lagFlaske(i)); i++; }

    midtsoyle.appendChild(midtrad);
    midtsoyle.appendChild(vulkanboks);
    arena.appendChild(venstre);
    arena.appendChild(midtsoyle);
    arena.appendChild(hoyre);
    brett.appendChild(arena);

    elVulkanboks = vulkanboks;
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
    // Full og ensfarget: klar for vulkanen, og den skal se slik ut.
    if (Spill.erKomplett(innhold, tilstand.kapasitet)) el.classList.add('klar');

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

  // Setter væskestanden i vulkanen, målt i viewBox-enheter opp fra bunnen.
  // Lagene beholder rekkefølgen sin; det er bare det øverste som forsvinner
  // først, slik det ville gjort om noe rant ut av toppen.
  function settVulkanstand(stand) {
    if (!elLag) return;
    var h = lagHoyde(), rekt = elLag.children;
    for (var i = 0; i < rekt.length; i++) {
      var synlig = Math.max(0, Math.min(h, stand - h * i));
      rekt[i].setAttribute('height', String(synlig));
      rekt[i].setAttribute('y', String(FYLL_BUNN - h * i - synlig));
    }
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

  // Vulkanen lyser når den kan ta imot, altså når en full flaske er valgt.
  function oppdaterVulkanlys() {
    if (!elVulkanboks) return;
    var i = tilstand.valgt;
    elVulkanboks.classList.toggle('klar',
      i !== null && Spill.erKomplett(tilstand.flasker[i], tilstand.kapasitet));
  }

  function klikk(i) {
    if (tilstand.laast) return;
    var flasker = tilstand.flasker;

    if (tilstand.valgt === null) {
      if (!flasker[i].length) { rist(i); return; }
      tilstand.valgt = i;
      elFlasker[i].classList.add('valgt');
      Lyd.plukk();
      oppdaterVulkanlys();
      if (Spill.erKomplett(flasker[i], tilstand.kapasitet)) visTips('Og så på vulkanen 🌋');
      else skjulTips();
      return;
    }

    if (tilstand.valgt === i) {
      tilstand.valgt = null;
      elFlasker[i].classList.remove('valgt');
      Lyd.slipp();
      oppdaterVulkanlys();
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
    oppdaterVulkanlys();
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

  // En ferdig flaske tømmer seg ikke selv. Den blir stående og lyse, og barnet
  // må trykke på den og så på vulkanen. Å gjøre selve belønningen til hennes
  // handling er hele poenget – ellers skjer det bare, uten at hun gjorde det.
  function etterTrekk(fra, til, antall) {
    planEtterTrekk(fra, til, antall);
    tilstand.laast = false;
    oppdaterKnapper();
    if (finnKomplett() !== -1) visTips('Trykk på den fulle flasken, og så på vulkanen 🌋');
  }

  function finnKomplett() {
    for (var i = 0; i < tilstand.flasker.length; i++) {
      if (Spill.erKomplett(tilstand.flasker[i], tilstand.kapasitet)) return i;
    }
    return -1;
  }

  // Trykk på vulkanen: bare en full, ensfarget flaske kan helles nedi. Slapp
  // vi en halvfull flaske forbi, ville fargen forsvunnet fra brettet og
  // nivået blitt uløselig.
  function klikkVulkan() {
    if (tilstand.laast) return;
    var i = tilstand.valgt;
    if (i === null || !Spill.erKomplett(tilstand.flasker[i], tilstand.kapasitet)) {
      Lyd.nei();
      var boks = elVulkan.parentNode;
      boks.classList.remove('rist');
      void boks.offsetWidth;
      boks.classList.add('rist');
      vent(340, function () { boks.classList.remove('rist'); });
      visTips('Bare en flaske med én farge kan i vulkanen 🙂');
      return;
    }
    tappFlaske(i);
  }

  function tappFlaske(indeks) {
    tilstand.laast = true;
    tilstand.historikk.push({
      flasker: Spill.kopi(tilstand.flasker), vulkan: tilstand.vulkan.slice()
    });
    tilstand.valgt = null;
    skjulTips();

    var farge = tilstand.flasker[indeks][0];
    var el = elFlasker[indeks];
    var krater = kraterPunkt();
    var r = el.getBoundingClientRect();
    var tilVenstre = r.left + r.width / 2 <= krater.x;

    el.classList.remove('valgt', 'klar');
    el.classList.add('tapper');
    // Nesten opp ned, så hele innholdet renner ut i krateret.
    flyTil(el, krater.x, krater.y - r.height * 0.10, tilVenstre ? 148 : -148, 380);
    Lyd.tapp();

    vent(400, function () {
      var straale = lagStraale(krater.x, krater.y - 4, 34, farge, 12);

      var deler = el.querySelectorAll('.del');
      for (var i = 0; i < deler.length; i++) deler[i].style.height = '0%';

      var plass = tilstand.vulkan.length;
      var rekt = lagRekt(farge, plass, 0);
      elLag.appendChild(rekt);
      var h = lagHoyde(), bunnY = FYLL_BUNN - h * plass;
      tween(460, function (p) {
        rekt.setAttribute('height', String(h * p));
        rekt.setAttribute('y', String(bunnY - h * p));
      });

      vent(480, function () {
        fjernStraale(straale);
        tilstand.vulkan.push(farge);
        tilstand.flasker[indeks] = [];
        tilbake(el, 300, function () {
          el.classList.remove('tapper');
          tegn();
          if (Spill.erFerdig(tilstand.flasker)) vent(240, utbrudd);
          else {
            tilstand.laast = false;
            oppdaterKnapper();
            if (finnKomplett() !== -1) visTips('Én til! Trykk på den og så på vulkanen 🌋');
          }
        });
      });
    });
  }

  /* ---------- utbrudd og seier ---------- */

  function utbrudd() {
    if (!elVulkan || !tilstand.vulkan.length) { vent(400, visSeier); return; }
    var farger = tilstand.vulkan;

    Lyd.utbrudd();
    elVulkan.classList.add('gaar');

    // Lavaen får fargene fra vulkanen, i den rekkefølgen de ble tappet, og
    // renner ned utsiden etter tur i stedet for alle på én gang.
    var strommer = elVulkan.querySelectorAll('.lava');
    for (var s = 0; s < strommer.length; s++) {
      strommer[s].style.stroke = Spill.FARGER[farger[s % farger.length]].kode;
      strommer[s].style.animationDelay = (0.25 + s * 0.13).toFixed(2) + 's';
    }

    // Og vulkanen tømmer seg mens det står på. Uten dette blir de vannrette
    // lagene liggende under de loddrette lavastripene, og det leser som et
    // rutemønster i stedet for noe som renner ut.
    var full = lagHoyde() * farger.length;
    vent(380, function () {
      tween(1500, function (p) { settVulkanstand(full * (1 - p)); });
    });

    // Sprut opp av krateret. Vinkelen er smal og farten høy, så det leser som
    // et utbrudd og ikke som konfetti.
    elGnister.textContent = '';
    for (var i = 0; i < 110; i++) {
      var p = document.createElement('i');
      var vinkel = (-90 + (Math.random() * 74 - 37)) * Math.PI / 180;
      var fart = 90 + Math.random() * 210;
      var stor = 5 + Math.random() * 8;
      p.style.setProperty('--dx', (Math.cos(vinkel) * fart).toFixed(0) + 'px');
      p.style.setProperty('--dy', (Math.sin(vinkel) * fart).toFixed(0) + 'px');
      p.style.width = p.style.height = stor.toFixed(0) + 'px';
      p.style.background = Spill.FARGER[farger[i % farger.length]].kode;
      p.style.animationDelay = (Math.random() * 0.8).toFixed(2) + 's';
      p.style.animationDuration = (1.2 + Math.random() * 1.1).toFixed(2) + 's';
      elGnister.appendChild(p);
    }

    vent(2600, visSeier);
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
  // Løseren tapper ferdige flasker automatisk, mens barnet gjør det for hånd.
  // Planen sammenlignes derfor mot brettet slik det ville sett ut om alt
  // ferdig var tømt – ellers ville planen blitt forkastet hver gang en flaske
  // ble full, og da er vi tilbake til hintet som går i ring.
  function tappetNokkel() {
    var kopi = Spill.kopi(tilstand.flasker);
    Spill.tapp(kopi, tilstand.kapasitet);
    return stillingsNokkel(kopi);
  }

  function hentPlan() {
    var naa = tappetNokkel();
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
      p.nokkel = tappetNokkel();
    } else {
      tilstand.plan = null;
    }
  }

  function hint() {
    if (tilstand.laast) return;

    // Står det en full flaske og venter, er det alltid rett trekk – den
    // frigjør plassen alt annet henger på.
    var full = finnKomplett();
    if (full !== -1) {
      tilstand.valgt = null;
      tegn();
      peker(full);
      if (elVulkanboks) {
        elVulkanboks.classList.add('peker');
        vent(4600, function () { elVulkanboks.classList.remove('peker'); });
      }
      visTips('Tøm den fulle flasken i vulkanen 🌋');
      return;
    }

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
