/*
 * hint: svarer hintet på ruta du står i, eller på noe annet?
 *
 * Før pekte Hint alltid på det enkleste trekket på hele brettet. Står du fast
 * på én rute og trykker, fikk du en naken ener i motsatt hjørne — hjelp til noe
 * du ikke ba om. Målt traff det ruta du sto i i 1,8 % av tilfellene, altså
 * omtrent så ofte som en tilfeldig rute ville gjort.
 *
 * Prøven går gjennom grensesnittet, ikke gjennom en luke inn i app.js: den
 * trykker på ruta, ber om hint, trykker «Bruk» og ser at det var *den* ruta som
 * endret seg. Da måles oppførselen brukeren har, ikke en variabel.
 */
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
const { chromium } = require('playwright');
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

// Brettet slik det står på skjermen: tall og blyantmerker per rute.
const lesBrett = page => page.$$eval('.celle', els => els.map(e => ({
  verdi: e.querySelector('.tall-stor').textContent,
  merker: Array.from(e.querySelectorAll('.merker i'))
               .filter(m => m.classList.contains('paa')).map(m => m.textContent).join('')
})));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const konsollfeil = [];
  page.on('pageerror', e => konsollfeil.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–',
                             { timeout: 60000 });

  console.log('\n— Løseren kan spørre om én rute —');
  sjekk('findStepAt finnes', await page.evaluate(() => typeof window.SudokuSolver.findStepAt === 'function'));
  sjekk('stepsUntil finnes', await page.evaluate(() => typeof window.SudokuSolver.stepsUntil === 'function'));

  // Kjernen: alt findStepAt leverer, må faktisk gjelde ruta det ble spurt om.
  const treff = await page.evaluate(async () => {
    const S = window.SudokuSolver, G = window.SudokuGenerator;
    let sjekket = 0, bom = 0, medTrekk = 0, tomme = 0;
    for (let k = 0; k < 6; k++) {
      const r = await G.generate(['vanskelig', 'beinhard', 'ekspert', 'mester'][k % 4]);
      const verdier = Uint8Array.from(r.puzzle), elim = new Int16Array(81);
      const st = S.makeState(verdier, elim);
      for (let m = 0; m < 10; m++) {
        const s = S.findStep(st); if (!s) break;
        S.applyStep(st, s);
        if (s.placement) verdier[s.placement.cell] = s.placement.digit;
        for (const e of s.eliminations) elim[e.cell] |= (1 << e.digit);
      }
      for (let i = 0; i < 81; i++) {
        if (verdier[i]) continue;
        tomme++;
        const s = S.findStepAt(S.makeState(verdier, elim), i);
        if (!s) continue;
        sjekket++;
        medTrekk++;
        const rorer = (s.placement && s.placement.cell === i) ||
                      s.eliminations.some(e => e.cell === i);
        if (!rorer) bom++;
      }
    }
    return { sjekket, bom, medTrekk, tomme };
  });
  sjekk(`${treff.sjekket} svar fra findStepAt gjelder ruta det ble spurt om`,
        treff.bom === 0, treff.bom + ' bommet');
  // Andelen er ikke tilfeldig: det er hvor ofte noe faktisk lar seg gjøre i en
  // gitt rute. Faller den mot null, har filteret sluttet å finne noe.
  sjekk('en vesentlig del av rutene har et trekk å vise',
        treff.medTrekk > treff.tomme * 0.2,
        `${treff.medTrekk} av ${treff.tomme} tomme ruter`);

  console.log('\n— Trykk på ruta, be om hint, bruk det: det er ruta som endrer seg —');
  const finn = async medHjelp => page.evaluate(hjelp => {
    const S = window.SudokuSolver;
    const verdier = new Uint8Array(81);
    document.querySelectorAll('.celle .tall-stor').forEach((e, i) => {
      verdier[i] = e.textContent ? Number(e.textContent) : 0;
    });
    for (let i = 0; i < 81; i++) {
      if (verdier[i]) continue;
      const s = S.findStepAt(S.makeState(verdier, new Int16Array(81)), i);
      if (hjelp ? s : !s) return i;
    }
    return -1;
  }, medHjelp);

  const rute = await finn(true);
  sjekk('fant en rute det finnes hjelp til', rute >= 0, 'rute ' + rute);

  const for1 = (await lesBrett(page))[rute];
  await page.click(`.celle[data-i="${rute}"]`);
  await page.click('.venstre .verktoyknapp[data-verktoy="hint"]');
  const vist = await page.evaluate(() => ({
    vises: !document.querySelector('#hint').hidden,
    omSkjult: document.querySelector('#hint-om').hidden,
    navn: document.querySelector('#hint-navn').textContent,
    tekst: document.querySelector('#hint-tekst').textContent
  }));
  sjekk('hintet vises', vist.vises, vist.navn + ': ' + vist.tekst);
  sjekk('ingen forbeholdslinje når hintet gjelder ruta', vist.omSkjult, vist.tekst);

  // «Bruk» to ganger: første trykk er «Vis hvor», andre utfører.
  await page.click('#hint-bruk');
  const etter1 = (await lesBrett(page))[rute];
  sjekk('det var den valgte ruta som endret seg',
        etter1.verdi !== for1.verdi || etter1.merker !== for1.merker,
        `«${for1.verdi}»/${for1.merker} → «${etter1.verdi}»/${etter1.merker}`);

  console.log('\n— … og hintet sier fra når det ikke kan svare på ruta —');
  const fjern = await finn(false);
  sjekk('fant en rute uten hjelp å hente', fjern >= 0, 'rute ' + fjern);

  if (fjern >= 0) {
    await page.click(`.celle[data-i="${fjern}"]`);
    await page.click('.venstre .verktoyknapp[data-verktoy="hint"]');
    const f = await page.evaluate(() => ({
      vises: !document.querySelector('#hint').hidden,
      omSkjult: document.querySelector('#hint-om').hidden,
      om: document.querySelector('#hint-om').textContent
    }));
    const navn = 'R' + (Math.floor(fjern / 9) + 1) + 'K' + (fjern % 9 + 1);
    sjekk('hintet vises fortsatt', f.vises);
    sjekk('forbeholdet står der', !f.omSkjult, f.om);
    // Uten rutenavnet er linja en generisk unnskyldning; med det er den et svar.
    sjekk('forbeholdet navngir ruta', f.om.includes(navn), f.om);
    sjekk('forbeholdet sier hva som gjelder ruta',
          /oversett|ikke klar/.test(f.om), f.om);
    await page.click('#hint-lukk');
  }

  console.log('\n— Forbeholdet skyver ikke knappene ut av syne —');
  /*
   * Forbeholdet er lengst nettopp når det trengs, og spalta liggende er smal.
   * Sto det utenfor skrollefeltet, dyttet det «Bruk» ut under kanten — og et
   * hint man ikke kan bruke, er ikke et hint.
   */
  for (const [w, h] of [[844, 390], [568, 320], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    const utenHjelp = await finn(false);
    if (utenHjelp < 0) continue;
    await page.click(`.celle[data-i="${utenHjelp}"]`);
    await page.click((w > h ? '.hoyre' : '.venstre') + ' .verktoyknapp[data-verktoy="hint"]');
    /*
     * Liggende er sida frosset, så der må knappene stå innenfor skjermen av seg
     * selv. Stående slipper låsen opp nettopp fordi hint kan bli høyere enn
     * plassen under brettet — der er kravet at de lar seg skrolle fram. På
     * 320×568 ligger «Bruk» 35 px under kanten med forbeholdet framme.
     */
    const liggende = w > h;
    const k = await page.evaluate(laasT => {
      const om = document.querySelector('#hint-om');
      const knapper = ['#hint-mer', '#hint-bruk', '#hint-lukk']
        .map(s => document.querySelector(s))
        .filter(e => !e.hidden)
        .map(e => {
          if (!laasT) e.scrollIntoView({ block: 'nearest' });
          const r = e.getBoundingClientRect();
          const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { id: e.id, inne: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5,
                   treff: t === e || e.contains(t) };
        });
      return { forbehold: !om.hidden, knapper };
    }, liggende);
    const merk = `${w}×${h}`;
    sjekk(`${merk}: forbeholdet står framme`, k.forbehold);
    sjekk(`${merk}: knappene er ${liggende ? 'innenfor skjermen' : 'til å skrolle fram'}`,
          k.knapper.every(x => x.inne),
          k.knapper.filter(x => !x.inne).map(x => x.id).join(', ') || 'alle');
    sjekk(`${merk}: og lar seg trykke`, k.knapper.every(x => x.treff),
          k.knapper.filter(x => !x.treff).map(x => x.id).join(', ') || 'alle');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#hint-lukk');
  }
  await page.setViewportSize({ width: 390, height: 844 });

  console.log('\n— Uten valgt rute er det som før —');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–',
                             { timeout: 60000 });
  await page.click('.venstre .verktoyknapp[data-verktoy="hint"]');
  const uten = await page.evaluate(() => ({
    vises: !document.querySelector('#hint').hidden,
    omSkjult: document.querySelector('#hint-om').hidden
  }));
  sjekk('hintet vises uten valgt rute', uten.vises);
  sjekk('og uten forbehold', uten.omSkjult);
  await page.click('#hint-lukk');

  console.log('\n— Raskt nok til et trykk —');
  const tid = await page.evaluate(() => {
    const S = window.SudokuSolver;
    const verdier = new Uint8Array(81);
    document.querySelectorAll('.celle .tall-stor').forEach((e, i) => {
      verdier[i] = e.textContent ? Number(e.textContent) : 0;
    });
    const tider = [];
    for (let i = 0; i < 81; i++) {
      if (verdier[i]) continue;
      const t = performance.now();
      S.findStepAt(S.makeState(verdier, new Int16Array(81)), i);
      tider.push(performance.now() - t);
    }
    tider.sort((a, b) => a - b);
    return { median: tider[Math.floor(tider.length / 2)], verst: tider[tider.length - 1] };
  });
  sjekk('et hint tar under 150 ms', tid.verst < 150,
        `median ${tid.median.toFixed(1)} ms, verst ${tid.verst.toFixed(0)} ms`);

  console.log('\n— Konsoll —');
  sjekk('ingen feil i konsollen', konsollfeil.length === 0, konsollfeil.join(' | '));

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
