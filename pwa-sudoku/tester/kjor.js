/*
 * Kjører prøvene. Starter en statisk server selv, så det er én kommando å huske.
 *
 * Serveren er skrevet her i stedet for å hente inn en pakke: repoet har ingen
 * avhengigheter, og playwright — som prøvene faktisk trenger — er alt vi ber om.
 *
 * no-store på hvert svar er ikke pynt. Service worker-en henter med samme flagg
 * fordi GitHub Pages sender max-age=600, og en test som lar HTTP-cachen svare
 * ville målt gammel kode uten å si fra.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const APP = path.join(__dirname, '..');
const PORT = 8123;
const PORT_KOPI = 8124;

/*
 * Rekkefølgen er billigst først: de korte prøvene på spillogikken sier fra med
 * en gang, og de tunge på layout og farger kommer etterpå.
 */
const PROVER = [
  ['fyllmodus', 'fyllmodus: tall i flere ruter, angre, etikettbredder'],
  ['auto', 'auto: fyller / manuell / tomt'],
  ['boks', 'boks: innsatt tall rydder merker i boksen'],
  ['naboer', 'naboer: og i raden og kolonnen'],
  ['alle', 'alle: rydding gjelder hele nabolaget'],
  ['konflikt', 'konflikt: tall som ikke kan stå sammen'],
  ['uthev', 'uthev: samme tall, både store og blyant'],
  ['tastatur', 'tastatur: venstre fører blyant, høyre skriver'],
  ['liggende', 'liggende: to sider, topptekst, plass på fem skjermer'],
  ['hintplass', 'hintplass: hintet dekker ikke brettet'],
  ['frys', 'frys: sida lar seg ikke dra'],
  ['modal', 'modal: dialoger får plass og lukker seg'],
  ['tema', 'tema: fire oppsett, kontrast, valgt rute'],
  ['servicearbeider', 'servicearbeider: offline og nett først']
];

// Denne står for seg: den bumper CACHE i sw.js midt i besøket for å etterligne
// en utrulling, og må derfor jobbe på en kopi den kan skrive i.
const PROVE_KOPI = ['versjonsmerke', 'versjonsmerke: viser koden som faktisk kjører'];

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function server(rot, port) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const fil = path.join(rot, path.normalize(p));
    if (!fil.startsWith(rot)) { res.writeHead(403).end(); return; }
    fs.readFile(fil, (feil, data) => {
      if (feil) { res.writeHead(404).end('finnes ikke'); return; }
      res.writeHead(200, {
        'Content-Type': TYPER[path.extname(fil)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  });
  return new Promise(ok => s.listen(port, '127.0.0.1', () => ok(s)));
}

function kjor(navn, port) {
  return new Promise(ok => {
    const b = spawn(process.execPath, [path.join(__dirname, navn + '.js')], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let ut = '';
    b.stdout.on('data', d => { ut += d; });
    b.stderr.on('data', d => { ut += d; });
    b.on('close', kode => ok({ kode, ut }));
  });
}

(async () => {
  const valgte = process.argv.slice(2);
  const liste = [...PROVER, PROVE_KOPI]
    .filter(([n]) => !valgte.length || valgte.includes(n));
  if (!liste.length) {
    console.error('Ingen prøve heter det. Tilgjengelige:\n  ' +
      [...PROVER, PROVE_KOPI].map(([n]) => n).join('\n  '));
    process.exit(2);
  }

  const s1 = await server(APP, PORT);
  // Egen kopi til versjonsmerke, som skriver i sw.js underveis.
  const kopi = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-'));
  fs.cpSync(APP, kopi, { recursive: true, filter: s => !s.includes('tester') });
  const s2 = await server(kopi, PORT_KOPI);

  const feilet = [];
  for (const [navn, hva] of liste) {
    const kopiprove = navn === PROVE_KOPI[0];
    process.stdout.write(`${navn.padEnd(16)} `);
    const t = Date.now();
    const r = kopiprove
      ? await new Promise(ok => {
          const b = spawn(process.execPath,
            [path.join(__dirname, 'versjonsmerke.js'), kopi, String(PORT_KOPI)],
            { stdio: ['ignore', 'pipe', 'pipe'] });
          let ut = ''; b.stdout.on('data', d => { ut += d; });
          b.stderr.on('data', d => { ut += d; });
          b.on('close', kode => ok({ kode, ut }));
        })
      : await kjor(navn, PORT);
    const sek = ((Date.now() - t) / 1000).toFixed(0);
    if (r.kode === 0) {
      console.log(`grønt   ${sek}s   ${hva}`);
    } else {
      console.log(`FEILET  ${sek}s   ${hva}`);
      feilet.push([navn, r.ut]);
    }
  }

  s1.close(); s2.close();
  fs.rmSync(kopi, { recursive: true, force: true });

  if (feilet.length) {
    for (const [navn, ut] of feilet) {
      console.log(`\n${'='.repeat(60)}\n${navn}\n${'='.repeat(60)}`);
      console.log(ut.split('\n').filter(l => /FEIL|^—/.test(l)).join('\n'));
    }
    console.log(`\n${feilet.length} av ${liste.length} prøver feilet.`);
    process.exit(1);
  }
  console.log(`\nAlle ${liste.length} prøvene er grønne.`);
})();
