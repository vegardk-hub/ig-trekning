/*
 * Merket skal svare på «kjører jeg den nye koden?». Da må det oppdatere seg i
 * samme besøk som den nye service worker-en tar over — ikke først neste gang.
 * Testen leser versjonen ut av sw.js og bumper den selv, så den ikke råtner
 * hver gang cachenavnet endres.
 */
const { chromium } = require('playwright');
const fs = require('fs');
let feil = 0;
const sjekk = (n, ok, d) => { console.log((ok ? '  OK   ' : '  FEIL ') + n + (d ? '  → ' + d : '')); if (!ok) feil++; };

const MAPPE = process.argv[2];
const PORT = process.argv[3];

(async () => {
  const sti = `${MAPPE}/sw.js`;
  const naa = fs.readFileSync(sti, 'utf8').match(/const CACHE = 'sudoku-v(\d+)'/)[1];
  const neste = Number(naa) + 1;

  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  const merket = () => p.$eval('#versjon', e => e.textContent);

  await p.goto(`http://127.0.0.1:${PORT}/index.html`);
  await p.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(600);

  console.log('\n— Merket viser versjonen som er installert —');
  sjekk(`første besøk viser v${naa}`, (await merket()) === 'v' + naa, await merket());

  // «Ny utrulling» midt i besøket, akkurat som når jeg pusher.
  fs.writeFileSync(sti, fs.readFileSync(sti, 'utf8')
    .replace(`sudoku-v${naa}`, `sudoku-v${neste}`));

  await p.reload();
  await p.waitForFunction(() => document.querySelector('#meta-igjen').textContent !== '–', { timeout: 60000 });

  const rakk = await p.waitForFunction(
    v => document.querySelector('#versjon').textContent === v, 'v' + neste, { timeout: 10000 }
  ).then(() => true).catch(() => false);
  sjekk(`merket henger med samme besøk (v${naa} → v${neste})`, rakk, 'viser ' + await merket());

  /*
   * Ikke «bare én cache»: den gamle service worker-en lever et øyeblikk til, og
   * dens fetch-håndterer gjør caches.open() på sitt eget navn — som gjenskaper
   * cachen den nettopp fikk slettet. Ufarlig, siden oppslag går nett først og
   * neste aktivering rydder den bort. Det som betyr noe er at merket peker på
   * den nyeste, for det er den som serverer.
   */
  const cacher = await p.evaluate(() => caches.keys());
  const nyeste = cacher
    .map(n => Number(n.replace('sudoku-v', '')))
    .sort((a, b) => a - b).pop();
  sjekk('den nye cachen er på plass', nyeste === neste, cacher.join(', '));
  sjekk('merket peker på den nyeste', (await merket()) === 'v' + nyeste,
        `merket ${await merket()}, nyeste cache v${nyeste}`);

  await b.close();
  console.log('\n' + (feil ? feil + ' FEIL' : 'Alt grønt'));
  process.exit(feil ? 1 : 0);
})();
