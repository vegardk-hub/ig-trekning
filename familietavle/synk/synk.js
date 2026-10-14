/*
 * Synk-jobben: henter kalendrene og været, krypterer og skriver datafila.
 *
 * Kjøres av `.github/workflows/familietavle.yml` hvert kvarter, og skriver
 * fila til stien den får som argument. Arbeidsflyten legger den deretter på
 * grenen `familietavle-data`, som tavla leser fra raw.githubusercontent.com.
 *
 * Hvorfor dette steget finnes i det hele tatt: iCloud sender ikke CORS-
 * headere, så nettleseren på veggen får ikke lest kalendrene selv. Og de
 * publiserte lenkene er hemmelige – den som har lenken, leser kalenderen – så
 * de kan ikke stå i et offentlig repo. Her bor de som GitHub-hemmeligheter.
 *
 * Miljøvariabler:
 *
 *   FAMILIETAVLE_KALENDERE  én kalender per linje, «Navn: lenke». Navnene
 *                           «Middag» og «Bursdager» er spesielle; alle andre
 *                           er en person, og får sin egen farge på tavla i
 *                           den rekkefølgen de står.
 *   FAMILIETAVLE_PASSFRASE  passfrasen tavla bruker for å lese fila.
 *
 * Mangler en av dem, avslutter jobben uten feil og uten fil: ellers sender GitHub en
 * feilmelding på e-post hvert kvarter fra første stund, før eieren i det hele
 * tatt har rukket å legge dem inn.
 */
'use strict';

const fs = require('fs');
const Kalender = require('../js/kalender.js');
const Krypto = require('../js/krypto.js');
const Vaer = require('../js/vaer.js');

const AGENT = 'familietavle/1.0 github.com/vegardk-hub/ig-trekning';

function lesListe(tekst) {
  return String(tekst || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
    const m = /^([^:]+?)\s*:\s*((?:webcal|https?):\/\/\S+)$/i.exec(l);
    if (!m) throw new Error('Skjønner ikke linja «' + l.split(':')[0] + ': …» – skal være «Navn: webcal://…»');
    const navn = m[1].trim();
    const rolle = /^middag(er)?$/i.test(navn) ? 'middag' : /^bursdag(er)?$/i.test(navn) ? 'bursdager' : 'person';
    return { navn, rolle, url: m[2].replace(/^webcal:/i, 'https:') };
  });
}

// RFC 5545 bretter linjer etter 75 *byte*, ikke tegn. Bretter en server midt
// i en «ø» (to byte i UTF-8), blir den til to «�» hvis vi dekoder først og
// limer sammen etterpå. Derfor limes linjene sammen før teksten dekodes.
function limSammen(bytes) {
  const b = new Uint8Array(bytes), ut = new Uint8Array(b.length);
  let n = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 13 && b[i + 1] === 10 && (b[i + 2] === 32 || b[i + 2] === 9)) { i += 2; continue; }
    if (b[i] === 10 && (b[i + 1] === 32 || b[i + 1] === 9)) { i += 1; continue; }
    ut[n++] = b[i];
  }
  return new TextDecoder('utf-8').decode(ut.subarray(0, n));
}

async function hent(url, valg, forsok) {
  let siste;
  for (let i = 0; i < (forsok || 3); i++) {
    try {
      const svar = await fetch(url, Object.assign({ signal: AbortSignal.timeout(20000) }, valg));
      if (!svar.ok) throw new Error('HTTP ' + svar.status);
      return await svar.arrayBuffer();
    } catch (e) {
      siste = e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw siste;
}

async function main() {
  const ut = process.argv[2];
  if (!ut) throw new Error('Bruk: node synk.js <utfil>');
  // Trimmes som på nettbrettet: en hemmelighet limt inn med linjeskift skal
  // ikke gi en fil ingen kan åpne.
  const passfrase = (process.env.FAMILIETAVLE_PASSFRASE || '').trim();
  const liste = process.env.FAMILIETAVLE_KALENDERE;
  if (!passfrase || !liste) {
    console.log('::notice::FAMILIETAVLE_KALENDERE og FAMILIETAVLE_PASSFRASE er ikke satt ennå – hopper over.');
    return;
  }
  if (passfrase.length < 16) throw new Error('Passfrasen er for kort – bruk minst fire tilfeldige ord.');

  // FAMILIETAVLE_NAA er for prøvene: den simulerte uka må ikke beskjæres
  // bort bare fordi prøven kjøres et år senere.
  const naa = process.env.FAMILIETAVLE_NAA ? new Date(process.env.FAMILIETAVLE_NAA) : new Date();
  // Én dag bakover holder: tavla viser i dag og framover, og en hendelse som
  // startet i går kveld og varer over midnatt, skal fortsatt med.
  const fra = new Date(naa.getTime() - 86400000);

  const kalendere = [];
  for (const k of lesListe(liste)) {
    let ics;
    try {
      ics = limSammen(await hent(k.url));
    } catch (e) {
      // Lenka er en hemmelighet og maskeres i loggen, men navnet sier nok.
      throw new Error('Fikk ikke hentet «' + k.navn + '»: ' + e.message);
    }
    if (!/BEGIN:VCALENDAR/.test(ics)) throw new Error('«' + k.navn + '» er ikke en kalenderfil');
    const kort = Kalender.beskjaer(ics, fra);
    console.log(k.navn + ': ' + Kalender.les(kort).hendelser.length + ' hendelser, ' +
      Math.round(kort.length / 1024) + ' kB (av ' + Math.round(ics.length / 1024) + ' kB)');
    kalendere.push({ navn: k.navn, rolle: k.rolle, ics: kort });
  }

  let vaer = null;
  try {
    const raa = await hent(Vaer.URL, { headers: { 'User-Agent': AGENT } });
    vaer = Vaer.beskjaer(JSON.parse(new TextDecoder().decode(raa)), naa);
  } catch (e) {
    console.log('::warning::Været feilet (' + e.message + ') – tavla henter det selv.');
  }

  const innhold = JSON.stringify({ v: 1, hentet: naa.toISOString(), kalendere, vaer });
  const pakke = await Krypto.krypter(innhold, passfrase);
  fs.writeFileSync(ut, JSON.stringify(pakke));
  console.log('Skrev ' + ut + ': ' + Math.round(fs.statSync(ut).size / 1024) + ' kB');
}

if (require.main === module) {
  main().catch(e => { console.log('::error::' + e.message); process.exit(1); });
}

module.exports = { lesListe, limSammen };
