const { chromium } = require('playwright');
const BILDER = require('path').join(__dirname, 'bilder');
require('fs').mkdirSync(BILDER, { recursive: true });
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

/* WCAG-kontrast mellom to «rgb(r, g, b)»-strenger. */
const lum = s => {
  const [r, g, b] = s.match(/\d+/g).slice(0, 3).map(Number).map(v => {
    const k = v / 255;
    return k <= 0.03928 ? k / 12.92 : Math.pow((k + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const tema = () => page.evaluate(() => document.documentElement.dataset.tema);
  const metaFarge = () => page.$eval('meta[name="theme-color"]', e => e.content);

  console.log('\n— Velgeren —');
  sjekk('tema.js ligger i <head>, ikke i <body>',
        await page.evaluate(() => !!document.head.querySelector('script[src="js/tema.js"]')),
        'ellers rekker standardfargene å blinke til');

  await page.click('#btn-tema');
  sjekk('panelet åpner', await page.$eval('#tema-panel', e => !e.hidden));
  const valg = await page.$$eval('.temavalg', els => els.map(e => e.dataset.tema));
  sjekk('fem oppsett listes', valg.length === 5, valg.join(', '));
  sjekk('rekkefølgen er Papir, Dag, Kveld, Natt, Følg systemet',
        valg.join(',') === 'papir,dag,kveld,natt,system', valg.join(', '));
  const navnene = await page.$$eval('.temavalg strong', els => els.map(e => e.textContent));
  sjekk('«Dag» har erstattet «Sollys»', navnene[1] === 'Dag', navnene.join(', '));
  const under = await page.$$eval('.temavalg .tematekst span', els => els.map(e => e.textContent));
  sjekk('underteksten er beholdt', under[1] === 'Maks kontrast, for sterkt dagslys', under[1]);
  sjekk('«Følg systemet» står valgt fra start',
        await page.$eval('.temavalg[data-tema="system"]', e => e.getAttribute('aria-checked')) === 'true');

  console.log('\n— ✕ lukker panelet —');
  /* Valget slår inn i det du trykker på det, så veien ut skal være kort.
     elementFromPoint, ikke bare koordinater: en knapp som ligger under noe
     annet er like ubrukelig som en knapp utenfor skjermen. */
  for (const [w, h, m] of [[390, 844, 'stående'], [844, 390, 'liggende'],
                           [320, 568, 'stående liten'], [568, 320, 'liggende liten']]) {
    await page.setViewportSize({ width: w, height: h });
    if (await page.$eval('#tema-panel', e => e.hidden)) await page.click('#btn-tema');
    const x = await page.evaluate(() => {
      const k = document.querySelector('#tema-x').getBoundingClientRect();
      const kort = document.querySelector('#tema-panel .modal-kort').getBoundingClientRect();
      const h2 = document.querySelector('#tema-panel h2').getBoundingClientRect();
      const traff = document.elementFromPoint(k.x + k.width / 2, k.y + k.height / 2);
      return {
        eier: !!traff && !!traff.closest('#tema-x'),
        hvem: traff ? traff.tagName.toLowerCase() + '.' + String(traff.className).split(' ')[0] : 'ingenting',
        hoyre: kort.right - k.right, oppe: k.top - kort.top,
        w: k.width, hh: k.height,
        overOverskrift: k.left >= h2.right - 0.5,
        innenfor: k.top >= 0 && k.bottom <= window.innerHeight
      };
    });
    sjekk(`${m} ${w}×${h}: ✕ står i høyre hjørne`,
          x.hoyre >= 0 && x.hoyre < 26 && x.oppe >= 0 && x.oppe < 26 && x.overOverskrift,
          `${x.hoyre.toFixed(0)} px fra høyre, ${x.oppe.toFixed(0)} px fra toppen`);
    sjekk(`${m} ${w}×${h}: ✕ er innenfor skjermen`, x.innenfor);
    sjekk(`${m} ${w}×${h}: trykket treffer ✕`, x.eier && x.w >= 28 && x.hh >= 28,
          `${x.w.toFixed(0)}×${x.hh.toFixed(0)} px, traff ${x.hvem}`);
    await page.click('#tema-x');
    sjekk(`${m} ${w}×${h}: panelet lukker seg`, await page.$eval('#tema-panel', e => e.hidden));
  }

  console.log('\n— Kortet får plass, og skrollen henger ikke igjen —');
  for (const [w, h] of [[568, 320], [667, 375], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    if (await page.$eval('#tema-panel', e => e.hidden)) await page.click('#btn-tema');
    const k = await page.evaluate(() => {
      const e = document.querySelector('#tema-panel .modal-kort').getBoundingClientRect();
      const sp = getComputedStyle(document.querySelector('.temaliste')).gridTemplateColumns;
      return { h: e.height, topp: e.top, bunn: e.bottom, vh: window.innerHeight,
               spalter: sp.split(' ').length };
    });
    sjekk(`liggende ${w}×${h}: hele kortet er synlig`,
          k.topp >= -0.5 && k.bunn <= k.vh + 0.5,
          `${k.h.toFixed(0)} px, ${k.topp.toFixed(0)}–${k.bunn.toFixed(0)} av ${k.vh}`);
    sjekk(`liggende ${w}×${h}: lista står i to spalter`, k.spalter === 2, k.spalter + ' spalter');
    await page.click('#tema-x');
  }

  /* Skrollestillingen bor i elementet og overlever at panelet skjules. Uten en
     nullstilling ved åpning står panelet der du forlot det — og ✕ utenfor. */
  await page.setViewportSize({ width: 320, height: 568 });
  await page.click('#btn-tema');
  await page.evaluate(() => { document.querySelector('#tema-panel').scrollTop = 400; });
  await page.click('#tema-lukk');
  await page.click('#btn-tema');
  const etter = await page.evaluate(() => ({
    skroll: document.querySelector('#tema-panel').scrollTop,
    xtopp: document.querySelector('#tema-x').getBoundingClientRect().top
  }));
  sjekk('panelet åpner på toppen igjen', etter.skroll === 0 && etter.xtopp >= 0,
        `skroll ${etter.skroll}, ✕ på ${etter.xtopp.toFixed(0)}`);
  await page.click('#tema-x');

  // Og den skal ikke røre valget: ✕ er en vei ut, ikke en angring.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#btn-tema');
  await page.click('.temavalg[data-tema="kveld"]');
  await page.click('#tema-x');
  sjekk('✕ beholder oppsettet du valgte', await tema() === 'kveld', await tema());
  // Panelet står åpent videre — resten av prøven regner med det.
  await page.click('#btn-tema');
  await page.click('.temavalg[data-tema="system"]');

  console.log('\n— Valget slår inn og blir husket —');
  await page.click('.temavalg[data-tema="dag"]');
  sjekk('temaet byttes med en gang', await tema() === 'dag');
  sjekk('statuslinjefargen følger med', await metaFarge() === '#ffffff', await metaFarge());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });
  sjekk('valget overlever omlasting', await tema() === 'dag');

  console.log('\n— «Følg systemet» følger faktisk systemet —');
  await page.click('#btn-tema');
  await page.click('.temavalg[data-tema="system"]');
  // Systembyttet går via en change-hendelse, så vi venter på virkningen
  // i stedet for å lese av med en gang.
  const ventPåTema = t => page.waitForFunction(
    ø => document.documentElement.dataset.tema === ø, t, { timeout: 3000 }
  ).then(() => true).catch(() => false);

  await page.emulateMedia({ colorScheme: 'dark' });
  sjekk('mørkt system gir Natt', await ventPåTema('natt'), 'ble ' + await tema());
  await page.emulateMedia({ colorScheme: 'light' });
  sjekk('lyst system gir Papir', await ventPåTema('papir'), 'ble ' + await tema());
  await page.click('#tema-lukk');

  console.log('\n— Kontrast mot flaten (WCAG) —');
  const navn = { papir: 'Papir', dag: 'Dag', natt: 'Natt', kveld: 'Kveld' };
  const tall = {};
  for (const id of ['papir', 'dag', 'natt', 'kveld']) {
    await page.evaluate(t => window.SudokuTema.velg(t), id);
    const f = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        flate: s.getPropertyValue('--flate').trim(),
        gitt: s.getPropertyValue('--gitt').trim(),
        skrevet: s.getPropertyValue('--skrevet').trim(),
        merke: s.getPropertyValue('--merke').trim()
      };
    });
    // Hex → rgb via nettleseren, så kontrastregningen får samme format.
    const rgb = await page.evaluate(o => {
      const ut = {};
      for (const k in o) { const d = document.createElement('div'); d.style.color = o[k];
        document.body.appendChild(d); ut[k] = getComputedStyle(d).color; d.remove(); }
      return ut;
    }, f);
    tall[id] = {
      gitt: kontrast(rgb.gitt, rgb.flate),
      skrevet: kontrast(rgb.skrevet, rgb.flate),
      merke: kontrast(rgb.merke, rgb.flate)
    };
    const t = tall[id];
    console.log('  ' + navn[id].padEnd(8) +
      'gitt ' + t.gitt.toFixed(1).padStart(5) + ':1   ' +
      'skrevet ' + t.skrevet.toFixed(1).padStart(5) + ':1   ' +
      'blyant ' + t.merke.toFixed(1).padStart(5) + ':1');
  }

  console.log('');
  sjekk('Dag: blyantmerkene når AA (4,5:1)', tall.dag.merke >= 4.5, tall.dag.merke.toFixed(1) + ':1');
  sjekk('Dag: skrevne tall når AA', tall.dag.skrevet >= 4.5, tall.dag.skrevet.toFixed(1) + ':1');
  sjekk('Dag: gitte tall når AA', tall.dag.gitt >= 4.5, tall.dag.gitt.toFixed(1) + ':1');
  sjekk('Papir: blyantmerkene når nå også AA', tall.papir.merke >= 4.5,
        tall.papir.merke.toFixed(1) + ':1 (var 3,1:1 med den blågrå)');
  sjekk('Dag har den sterkeste blyantkontrasten',
        ['papir', 'natt', 'kveld'].every(id => tall.dag.merke >= tall[id].merke),
        `Dag ${tall.dag.merke.toFixed(1)}:1`);
  for (const id of ['natt', 'kveld']) {
    sjekk(navn[id] + ': blyantmerkene er lesbare (3:1)', tall[id].merke >= 3, tall[id].merke.toFixed(1) + ':1');
  }

  console.log('\n— Markeringsflata er synlig, og tallene oppå den er lesbare —');
  for (const id of ['papir', 'dag', 'natt', 'kveld']) {
    await page.evaluate(t => window.SudokuTema.velg(t), id);
    const f = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const les = n => { const d = document.createElement('div');
        d.style.color = s.getPropertyValue(n).trim(); document.body.appendChild(d);
        const u = getComputedStyle(d).color; d.remove(); return u; };
      return { flate: les('--flate'), likt: les('--likt'), valgt: les('--valgt'),
               gitt: les('--gitt'), skrevet: les('--skrevet'), merke: les('--merke') };
    });
    const synlighet = kontrast(f.likt, f.flate);
    console.log('  ' + navn[id].padEnd(8) +
      'flate ' + synlighet.toFixed(2) + ':1   ' +
      'gitt ' + kontrast(f.gitt, f.likt).toFixed(1) + '   ' +
      'skrevet ' + kontrast(f.skrevet, f.likt).toFixed(1) + '   ' +
      'merke ' + kontrast(f.merke, f.likt).toFixed(1));
    sjekk(navn[id] + ': flata skiller seg fra brettet', synlighet >= 1.35,
          synlighet.toFixed(2) + ':1');
    sjekk(navn[id] + ': gitte tall lesbare på flata', kontrast(f.gitt, f.likt) >= 4.5);
    sjekk(navn[id] + ': skrevne tall lesbare på flata', kontrast(f.skrevet, f.likt) >= 4.5,
          kontrast(f.skrevet, f.likt).toFixed(1) + ':1');
    sjekk(navn[id] + ': blyantmerker lesbare på flata', kontrast(f.merke, f.likt) >= 4.0,
          kontrast(f.merke, f.likt).toFixed(1) + ':1');
  }

  console.log('\n— Tre ulike farger, ikke blå på blå —');
  /* Fargetone i grader. Grå/nøytrale får lav metning, og da er tonen uvesentlig. */
  const tone = s => {
    const [r, g, b] = s.match(/\d+/g).slice(0, 3).map(Number).map(v => v / 255);
    const maks = Math.max(r, g, b), min = Math.min(r, g, b), d = maks - min;
    if (d < 0.02) return { h: 0, metning: 0 };
    let h;
    if (maks === r) h = ((g - b) / d) % 6;
    else if (maks === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, metning: d / maks };
  };
  const avstand = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  for (const id of ['papir', 'dag', 'natt', 'kveld']) {
    await page.evaluate(t => window.SudokuTema.velg(t), id);
    const f = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const les = n => { const d = document.createElement('div');
        d.style.color = s.getPropertyValue(n).trim(); document.body.appendChild(d);
        const ut = getComputedStyle(d).color; d.remove(); return ut; };
      return { skrevet: les('--skrevet'), merke: les('--merke'), valgt: les('--valgt') };
    });
    const ts = tone(f.skrevet), tm = tone(f.merke), tv = tone(f.valgt);
    const skille = avstand(ts.h, tm.h);
    sjekk(`${navn[id]}: skrift og blyant er ulike farger`, skille >= 60,
          `${skille.toFixed(0)}° mellom dem`);
  }

  console.log('\n— Valgt rute skiller seg fra markeringsflata —');
  /*
   * Kravet er ikke lenger «et hakk mørkere». To dempede flater i samme nyanse
   * lignet på hverandre uansett hvor stort hakket var, og en flate mørk nok til
   * å skille seg tok med seg lesbarheten på tallet i ruta — skrevne tall lå på
   * 3,3–4,3:1 der, under WCAG-grensa, som det eneste stedet i oppsettet.
   *
   * Så: enten en tydelig annen nyanse eller et stort sprang i lyshet, en ring
   * som gjør ruta umulig å ta feil av, og skrift som holder 4,5:1 oppå den.
   */
  for (const id of ['papir', 'dag', 'natt', 'kveld']) {
    await page.evaluate(t => window.SudokuTema.velg(t), id);
    const f = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const les = n => { const d = document.createElement('div');
        d.style.color = s.getPropertyValue(n).trim(); document.body.appendChild(d);
        const ut = getComputedStyle(d).color; d.remove(); return ut; };
      return { flate: les('--flate'), likt: les('--likt'), valgt: les('--valgt'),
               kant: les('--valgt-kant'), gitt: les('--gitt'),
               skrevet: les('--skrevet'), merke: les('--merke') };
    });
    const tv = tone(f.valgt), tl = tone(f.likt);
    const dNyanse = avstand(tv.h, tl.h);
    const dLys = kontrast(f.valgt, f.likt);
    const svakest = Math.min(kontrast(f.gitt, f.valgt), kontrast(f.skrevet, f.valgt),
                             kontrast(f.merke, f.valgt));
    sjekk(`${navn[id]}: valgt er en annen farge enn markeringa`,
          dNyanse >= 45 || dLys >= 1.5,
          `${dNyanse.toFixed(0)}° og ${dLys.toFixed(2)}:1 mellom dem`);
    sjekk(`${navn[id]}: ringen er synlig mot begge flatene`,
          kontrast(f.kant, f.valgt) >= 3 && kontrast(f.kant, f.flate) >= 3,
          `${kontrast(f.kant, f.valgt).toFixed(1)}:1 mot ruta, ` +
          `${kontrast(f.kant, f.flate).toFixed(1)}:1 mot brettet`);
    sjekk(`${navn[id]}: tallet i valgt rute er lesbart`, svakest >= 4.5,
          `svakeste ${svakest.toFixed(1)}:1`);
    // Samme grunn som at flatene ellers er nøytrale: skriften skal ikke stå på
    // sin egen farge. Her løses det med avstand i stedet for med grå.
    for (const [rolle, farge] of [['skrift', f.skrevet], ['blyant', f.merke]]) {
      const d = avstand(tv.h, tone(farge).h);
      sjekk(`${navn[id]}: valgt låner ikke nyansen fra ${rolle}`,
            tv.metning < 0.02 || d >= 25, `${d.toFixed(0)}°`);
    }
  }

  console.log('\n— Ringen står faktisk på ruta —');
  await page.evaluate(() => window.SudokuTema.velg('papir'));
  const ring = await page.evaluate(() => {
    const c = document.querySelector('.celle');
    c.click();
    const s = getComputedStyle(document.querySelector('.celle.valgt'));
    return { skygge: s.boxShadow, bakgrunn: s.backgroundColor };
  });
  sjekk('valgt rute har en innoverring', /inset/.test(ring.skygge), ring.skygge);

  console.log('\n— Knappen lar seg faktisk trykke —');
  /* Ikke bare «er den innenfor skjermen»: elementFromPoint svarer på hvem som
     får trykket. .spilleflate lå oppå den i liggende, og da hjalp ingen
     plassering. */
  const traff = async () => page.evaluate(() => {
    const k = document.querySelector('#btn-tema');
    const r = k.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { eier: e === k || k.contains(e),
             hvem: e ? e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] : 'ingenting',
             innenfor: r.x >= 0 && r.right <= window.innerWidth && r.y >= 0 && r.bottom <= window.innerHeight,
             fraKant: Math.round(window.innerWidth - r.right) };
  });

  for (const [w, h, m] of [[844, 390, 'liggende'], [932, 430, 'liggende stor'],
                           [568, 320, 'liggende liten'], [390, 844, 'stående'],
                           [320, 568, 'stående liten']]) {
    await page.setViewportSize({ width: w, height: h });
    const t = await traff();
    sjekk(`${m} ${w}×${h}: trykket treffer knappen`, t.eier, 'traff ' + t.hvem);
    sjekk(`${m} ${w}×${h}: den er innenfor skjermen`, t.innenfor,
          t.fraKant + ' px fra høyre kant');
  }

  // Og den skal ikke stikke gjennom en åpen dialog.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.click('#btn-tema');
  const overModal = await page.evaluate(() => {
    const k = document.querySelector('#btn-tema').getBoundingClientRect();
    const e = document.elementFromPoint(k.x + k.width / 2, k.y + k.height / 2);
    return e && e.closest('.modal') !== null;
  });
  sjekk('en åpen dialog ligger over knappen', overModal);
  await page.click('#tema-lukk');

  console.log('\n— Layout —');
  for (const [w, h] of [[320, 568], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    const s = await page.evaluate(() => ({
      v: document.documentElement.scrollWidth > window.innerWidth,
      l: document.documentElement.scrollHeight > window.innerHeight + 1
    }));
    sjekk(`${w}×${h}: ingen skroll`, !s.v && !s.l);
  }
  // Temaknappen skal ikke ligge oppå tittelen.
  const kryss = await page.evaluate(() => {
    const a = document.querySelector('#btn-tema').getBoundingClientRect();
    const b = document.querySelector('.topp h1').getBoundingClientRect();
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  });
  sjekk('temaknappen overlapper ikke tittelen', !kryss);

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  const R = BILDER;
  for (const id of ['papir', 'dag', 'natt', 'kveld']) {
    await page.evaluate(t => window.SudokuTema.velg(t), id);
    await page.waitForTimeout(400);        // knappene toner over på .12s
    await page.screenshot({ path: `${R}/tema-${id}.png` });
  }

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
