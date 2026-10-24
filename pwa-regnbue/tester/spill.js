/*
 * spill: motoren, symbolene og at en femåring ikke kan kjøre seg fast.
 *
 * Det siste er kravet som bærer hele modusen. Lar man feil symboler bli
 * stående, ender brettet i en knute som bare kan løses ved å se at noe langt
 * tilbake var galt — og det er nøyaktig det målgruppen ikke kan. Derfor må et
 * galt trekk avvises, og et brett må alltid kunne løses med enere alene.
 */
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
const { chromium } = require('playwright');
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') konsollfeil.push('konsoll: ' + m.text()); });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.RegnbueKjerne && window.RegnbueSymboler, { timeout: 30000 });

  console.log('\n— Brettene holder reglene, og lar seg løse med enere —');
  const motor = await page.evaluate(() => {
    const B = window.RegnbueKjerne;
    const ut = [];
    for (const niv of B.NIVAAER) {
      let brudd = 0, ikkeEntydig = 0, ikkeLosbar = 0, feilFasit = 0;
      const gitte = [], tider = [];
      for (let k = 0; k < 8; k++) {
        const t0 = performance.now();
        const r = B.lagBrett(niv);
        tider.push(performance.now() - t0);
        if (!r) { ikkeLosbar++; continue; }
        gitte.push(r.gitte);
        // Ingen gitt rute må bryte sudokureglene
        for (let i = 0; i < r.g.ANT; i++) {
          if (!r.brett[i]) continue;
          if (r.g.NABOER[i].some(p => r.brett[p] === r.brett[i])) { brudd++; break; }
        }
        if (B.tellLosninger(r.g, r.brett, 2, null).antall !== 1) ikkeEntydig++;
        const lost = B.losMedEnere(r.g, r.brett);
        if (!lost) ikkeLosbar++;
        else if (Array.from(lost).join() !== Array.from(r.losning).join()) feilFasit++;
      }
      tider.sort((a, b) => a - b);
      ut.push({ id: niv.id, navn: niv.navn, N: niv.boksH * niv.boksB,
                brudd, ikkeEntydig, ikkeLosbar, feilFasit,
                gitte: gitte.reduce((a, b) => a + b, 0) / gitte.length,
                verst: tider[tider.length - 1] });
    }
    return ut;
  });

  for (const m of motor) {
    sjekk(`${m.navn}: ingen gitt rute bryter reglene`, m.brudd === 0, m.brudd + ' brett');
    sjekk(`${m.navn}: nøyaktig én løsning`, m.ikkeEntydig === 0, m.ikkeEntydig + ' brett');
    // Det er dette kravet som gjør modusen brukbar for målgruppen.
    sjekk(`${m.navn}: lar seg løse med enere alene`, m.ikkeLosbar === 0, m.ikkeLosbar + ' brett');
    sjekk(`${m.navn}: enerne gir samme svar som fasiten`, m.feilFasit === 0, m.feilFasit + ' brett');
    sjekk(`${m.navn}: nok er fylt ut på forhånd`, m.gitte >= m.N * m.N * 0.4,
          `${m.gitte.toFixed(0)} av ${m.N * m.N}`);
    sjekk(`${m.navn}: raskt nok`, m.verst < 3000, `verst ${m.verst.toFixed(0)} ms`);
  }

  console.log('\n— Rutenettet er et ekte sudokunett —');
  /*
   * Brettene over kan være selvmotsigelsesfrie og entydige og likevel ikke
   * være sudoku: er boksinndelingen gal, er det et annet puslespill med samme
   * utseende. Derfor måles geometrien for seg.
   */
  const geo = await page.evaluate(() => {
    const B = window.RegnbueKjerne;
    return B.NIVAAER.map(niv => {
      const g = B.lagRutenett(niv.boksH, niv.boksB);
      const feil = [];
      if (g.ENHETER.length !== g.N * 3) feil.push('antall enheter ' + g.ENHETER.length);
      for (const u of g.ENHETER) {
        if (new Set(u.celler).size !== g.N) feil.push(u.slag + ' ' + u.n + ' har ' + u.celler.length);
      }
      // Hver rute skal ligge i nøyaktig én rad, én kolonne og én boks
      for (let i = 0; i < g.ANT; i++) {
        const n = g.ENHETER.filter(u => u.celler.includes(i)).length;
        if (n !== 3) { feil.push('rute ' + i + ' i ' + n + ' enheter'); break; }
      }
      // Og hver boks skal være et sammenhengende rektangel på boksH × boksB
      for (let b = 0; b < g.N; b++) {
        const celler = g.ENHETER.filter(u => u.slag === 'boks' && u.n === b)[0].celler;
        const rader = new Set(celler.map(g.rad)), kol = new Set(celler.map(g.kol));
        if (rader.size !== niv.boksH || kol.size !== niv.boksB) {
          feil.push('boks ' + b + ' er ' + rader.size + '×' + kol.size);
          break;
        }
      }
      return { navn: niv.navn, N: g.N, naboer: g.NABOER[0].length, feil };
    });
  });
  for (const x of geo) {
    sjekk(`${x.navn}: ${x.N} rader, ${x.N} kolonner og ${x.N} bokser henger sammen`,
          x.feil.length === 0, x.feil.slice(0, 2).join('; '));
  }

  console.log('\n— De ni symbolene —');
  const sym = await page.evaluate(() => {
    const S = window.RegnbueSymboler;
    const svg = [];
    for (let d = 1; d <= 9; d++) svg.push(S.svg(d));
    return { antall: S.SYMBOLER.length, navn: S.SYMBOLER.map(s => s.navn),
             ulike: new Set(svg).size, tomme: svg.filter(x => !x).length };
  });
  sjekk('ni symboler finnes', sym.antall === 9, sym.navn.join(', '));
  sjekk('alle ni tegner noe', sym.tomme === 0);
  // To symboler som tegner likt, er ett symbol for barnet.
  sjekk('alle ni er ulike tegninger', sym.ulike === 9, sym.ulike + ' ulike');

  console.log('\n— Et galt symbol går ikke inn —');
  await page.click('.nivaaknapp[data-nivaa="minst"]');
  await page.waitForFunction(() => document.querySelectorAll('.rute').length === 16, { timeout: 20000 });

  const tom = await page.evaluate(() => {
    const ruter = Array.from(document.querySelectorAll('.rute'));
    const i = ruter.findIndex(r => !r.classList.contains('gitt'));
    return i;
  });
  sjekk('fant en tom rute', tom >= 0, 'rute ' + tom);

  await page.click(`.rute[data-i="${tom}"]`);
  sjekk('ruta blir valgt', await page.$eval(`.rute[data-i="${tom}"]`,
        e => e.classList.contains('valgt')));

  // Finn et symbol som IKKE hører hjemme der, og et som gjør det.
  const fasit = await page.evaluate(i => {
    const B = window.RegnbueKjerne;
    // Løsningen ligger i lagringen — prøven skal ikke gjette seg til den.
    const d = JSON.parse(localStorage.getItem('regnbuespillet-v1'));
    return { rett: d.losning[i], N: Math.sqrt(d.losning.length) };
  }, tom);
  const galt = (fasit.rett % fasit.N) + 1;

  await page.click(`.tast[data-d="${galt}"]`);
  await page.waitForTimeout(120);
  const etterGalt = await page.$eval(`.rute[data-i="${tom}"]`, e => e.querySelectorAll('svg').length);
  sjekk('galt symbol blir ikke stående', etterGalt === 0, etterGalt + ' symboler i ruta');

  await page.click(`.tast[data-d="${fasit.rett}"]`);
  await page.waitForTimeout(120);
  const etterRett = await page.$eval(`.rute[data-i="${tom}"]`, e => e.querySelectorAll('svg').length);
  sjekk('riktig symbol lander', etterRett === 1);

  console.log('\n— «Hjelp meg» fyller én rute, og den er riktig —');
  const forHjelp = await page.$$eval('.rute', els => els.filter(e => e.querySelector('svg')).length);
  await page.click('#btn-hjelp');
  await page.waitForTimeout(150);
  const etterHjelp = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('regnbuespillet-v1'));
    const satt = d.verdier.filter(Boolean).length;
    const galt = d.verdier.filter((v, i) => v && v !== d.losning[i]).length;
    return { satt, galt };
  });
  sjekk('én rute mer er fylt', etterHjelp.satt === forHjelp + 1,
        `${forHjelp} → ${etterHjelp.satt}`);
  sjekk('og ingenting på brettet er galt', etterHjelp.galt === 0);

  console.log('\n— Brettet kan spilles helt ut —');
  for (let n = 0; n < 40; n++) {
    const ferdig = await page.$eval('#ferdig', e => !e.hidden);
    if (ferdig) break;
    const igjen = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('regnbuespillet-v1'));
      return d.verdier.filter(v => !v).length;
    });
    if (!igjen) break;
    await page.click('#btn-hjelp');
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(600);
  sjekk('«Ferdig!» kommer opp', await page.$eval('#ferdig', e => !e.hidden));
  const alt = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('regnbuespillet-v1'));
    return d.verdier.every((v, i) => v === d.losning[i]);
  });
  sjekk('og brettet er riktig løst', alt);

  console.log('\n— Plass på skjermen —');
  await page.click('#ferdig-annet');
  await page.click('.nivaaknapp[data-nivaa="stor"]');
  await page.waitForFunction(() => document.querySelectorAll('.rute').length === 81, { timeout: 25000 });

  for (const [w, h, navn] of [[320, 568, 'liten telefon'], [390, 844, 'iPhone 14'],
                              [844, 390, 'liggende'], [568, 320, 'liggende liten']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const brett = document.querySelector('.brett').getBoundingClientRect();
      const tast = document.querySelector('.tast').getBoundingClientRect();
      const hjelp = document.querySelector('#btn-hjelp');
      const hr = hjelp.getBoundingClientRect();
      const traff = document.elementFromPoint(hr.x + hr.width / 2, hr.y + hr.height / 2);
      return {
        brett: { w: brett.width, h: brett.height, h2: brett.bottom, v: brett.left },
        tast: { w: tast.width, h: tast.height },
        hjelpInne: hr.top >= -0.5 && hr.bottom <= window.innerHeight + 0.5,
        hjelpTreff: !!traff && (traff === hjelp || hjelp.contains(traff)),
        vannrett: document.documentElement.scrollWidth > window.innerWidth,
        vh: window.innerHeight, vw: window.innerWidth
      };
    });
    const merk = `${navn} ${w}×${h}`;
    sjekk(`${merk}: brettet er innenfor skjermen`,
          m.brett.v >= -0.5 && m.brett.h2 <= m.vh + 0.5 && m.brett.w <= m.vw + 0.5,
          `${m.brett.w.toFixed(0)}×${m.brett.h.toFixed(0)} px`);
    sjekk(`${merk}: ingen vannrett skroll`, !m.vannrett);
    // Fem år gamle fingre bommer mer enn voksne. 36 px er under det Apple
    // anbefaler for voksne, og her er tastene det barnet sikter på hele tiden.
    sjekk(`${merk}: tastene er store nok for en femåring`,
          m.tast.w >= 36 && m.tast.h >= 36,
          `${m.tast.w.toFixed(0)}×${m.tast.h.toFixed(0)} px`);
    sjekk(`${merk}: «Hjelp meg» er synlig og lar seg trykke`,
          m.hjelpInne && m.hjelpTreff);
  }

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
