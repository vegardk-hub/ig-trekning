const { chromium } = require('playwright');
const PORT = process.env.PORT || 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };
const boksAv = i => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);

(async () => {
  const browser = await chromium.launch();

  // Hver test starter med blankt lager, så tidligere runder ikke smitter.
  const nyØkt = async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });
    return page;
  };
  const merke = (p, j, d) => p.$eval(`.celle[data-i="${j}"] .merker i:nth-child(${d})`, e => e.classList.contains('paa'));
  const verdi = (p, j) => p.$eval(`.celle[data-i="${j}"] .tall-stor`, e => e.textContent);
  const tomme = p => p.$$eval('.celle', els => els.map((e, i) => [i, !e.querySelector('.tall-stor').textContent])
                                                  .filter(x => x[1]).map(x => x[0]));

  // Finner to tomme ruter i samme boks.
  const par = async p => {
    const t = await tomme(p);
    for (const a of t) { const b = t.find(x => x !== a && boksAv(x) === boksAv(a)); if (b !== undefined) return [a, b]; }
    return null;
  };

  const D = 6;

  console.log('\n— Vei 1: rute først, Auto av, egne merker —');
  {
    const p = await nyØkt();
    const [mål, nabo] = await par(p);
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Manuell
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Tomt, blankt ark
    await p.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
    await p.click(`.celle[data-i="${nabo}"]`); await p.click(`.venstre .tallknapp[data-d="${D}"]`);
    sjekk('merket er ført', await merke(p, nabo, D));
    await p.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
    await p.click(`.celle[data-i="${mål}"]`); await p.click(`.venstre .tallknapp[data-d="${D}"]`);
    sjekk('tallet er satt inn', (await verdi(p, mål)) === String(D));
    sjekk('merket i boksen er strøket', !(await merke(p, nabo, D)));
    await p.close();
  }

  console.log('\n— Vei 2: fyllmodus —');
  {
    const p = await nyØkt();
    const [mål, nabo] = await par(p);
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Manuell
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Tomt, blankt ark
    await p.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
    await p.click(`.celle[data-i="${nabo}"]`); await p.click(`.venstre .tallknapp[data-d="${D}"]`);
    await p.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
    await p.click('.venstre .verktoyknapp[data-verktoy="fyll"]'); await p.click(`.venstre .tallknapp[data-d="${D}"]`);
    await p.click(`.celle[data-i="${mål}"]`);
    sjekk('tallet er satt inn', (await verdi(p, mål)) === String(D));
    sjekk('merket i boksen er strøket', !(await merke(p, nabo, D)));
    await p.close();
  }

  console.log('\n— Vei 3: tastatur —');
  {
    const p = await nyØkt();
    const [mål, nabo] = await par(p);
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Manuell
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Tomt, blankt ark
    await p.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
    await p.click(`.celle[data-i="${nabo}"]`); await p.keyboard.press(String(D));
    await p.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
    await p.click(`.celle[data-i="${mål}"]`); await p.keyboard.press(String(D));
    sjekk('tallet er satt inn', (await verdi(p, mål)) === String(D));
    sjekk('merket i boksen er strøket', !(await merke(p, nabo, D)));
    await p.close();
  }

  console.log('\n— Vei 4: Auto på (merkene regnes ut) —');
  {
    const p = await nyØkt();
    const [mål, nabo] = await par(p);
    const hadde = await merke(p, nabo, D);
    await p.click(`.celle[data-i="${mål}"]`); await p.click(`.venstre .tallknapp[data-d="${D}"]`);
    sjekk('tallet er satt inn', (await verdi(p, mål)) === String(D));
    sjekk('merket i boksen er borte', !(await merke(p, nabo, D)),
          hadde ? 'sto der før innsetting' : 'sto ikke der før heller');
    await p.close();
  }

  console.log('\n— Felle: Blyant står på når du tror du setter inn tallet —');
  {
    const p = await nyØkt();
    const [mål, nabo] = await par(p);
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Manuell
    await p.click('.venstre .verktoyknapp[data-verktoy="auto"]');   // → Tomt, blankt ark
    await p.click('.venstre .verktoyknapp[data-verktoy="blyant"]');
    await p.click(`.celle[data-i="${nabo}"]`); await p.click(`.venstre .tallknapp[data-d="${D}"]`);
    // Blyant blir stående på — trykket setter et merke, ikke et tall.
    await p.click(`.celle[data-i="${mål}"]`); await p.click(`.venstre .tallknapp[data-d="${D}"]`);
    sjekk('ruta står uten tall', (await verdi(p, mål)) === '', 'det ble et blyantmerke i stedet');
    sjekk('merket i boksen står derfor igjen', await merke(p, nabo, D), 'dette ser ut som feilen');
    await p.close();
  }

  await browser.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
})();
