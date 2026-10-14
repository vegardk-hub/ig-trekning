/*
 * Prøver for kalenderlesingen, krypteringen og synk-jobben. Trenger verken
 * nettleser eller nett:
 *
 *     node familietavle/tester/data.js
 *
 * Kalenderreglene er der tavla kan ta feil uten at noen ser det: en trening
 * som står en time feil etter vintertid, en bursdag som forsvinner i år uten
 * skuddår, en flyttet øvelse som står to ganger. Hver av dem har et krav her.
 *
 * Siste del kjører hele synk-jobben mot en lokal server med ICS-filer og
 * sjekker at det tavla dekrypterer, er det som ble hentet.
 */
'use strict';

process.env.TZ = 'Europe/Oslo';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const Kalender = require('../js/kalender.js');
const Krypto = require('../js/krypto.js');
const Vaer = require('../js/vaer.js');
const Demo = require('../js/demo.js');
const { lesListe, limSammen } = require('../synk/synk.js');
const Sim = require('./simulert-icloud.js');

let feil = 0, gjort = 0;
function krev(pastand, tekst, verdi) {
  gjort++;
  if (pastand) return;
  feil++;
  console.log('  FEIL: ' + tekst + (verdi !== undefined ? '  (' + JSON.stringify(verdi) + ')' : ''));
}

function ics(...hendelser) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Prøve']
    .concat(...hendelser.map(h => ['BEGIN:VEVENT'].concat(h, ['END:VEVENT'])), ['END:VCALENDAR']).join('\r\n');
}

function forek(tekst, fra, til) {
  return Kalender.forekomster(Kalender.les(tekst).hendelser, fra, til);
}

function kl(d) { return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
function dato(d) { return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); }

(async () => {

  console.log('lesing');
  {
    const k = Kalender.les(ics([
      'UID:1', 'DTSTART;TZID=Europe/Oslo:20261014T170000', 'DTEND;TZID=Europe/Oslo:20261014T183000',
      'SUMMARY:Fotball\\, G9', 'LOCATION:Nadderud\\nbane 2',
      'DESCRIPTION:En lang tekst som er brettet over',
      ' to linjer',
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'DESCRIPTION:Påminnelse', 'END:VALARM'
    ]));
    krev(k.navn === 'Prøve', 'kalendernavn', k.navn);
    const h = k.hendelser[0];
    krev(h.tittel === 'Fotball, G9', 'escaping i tittel', h.tittel);
    krev(h.sted === 'Nadderud\nbane 2', 'linjeskift i sted', h.sted);
    krev(kl(h.start.tid) === '17:00' && !h.start.heldag, 'starttid', kl(h.start.tid));
    krev(k.hendelser.length === 1, 'VALARM blir ikke en egen hendelse', k.hendelser.length);
  }

  console.log('tidssoner');
  {
    const z = Kalender.les(ics(['UID:z', 'DTSTART:20261014T150000Z', 'SUMMARY:Z'])).hendelser[0];
    krev(kl(z.start.tid) === '17:00', 'UTC blir norsk sommertid', kl(z.start.tid));
    const ny = Kalender.les(ics(['UID:ny', 'DTSTART;TZID=America/New_York:20261014T090000', 'SUMMARY:NY'])).hendelser[0];
    krev(kl(ny.start.tid) === '15:00', 'New York 09:00 er 15:00 her', kl(ny.start.tid));
    const ms = Kalender.les(ics(['UID:ms', 'DTSTART;TZID=W. Europe Standard Time:20261014T090000', 'SUMMARY:Outlook'])).hendelser[0];
    krev(kl(ms.start.tid) === '9:00', 'ukjent sonenavn faller tilbake på lokal tid', kl(ms.start.tid));
  }

  console.log('gjentakelser');
  {
    // Hver tirsdag kl. 17 – over overgangen til vintertid 25. oktober 2026.
    const t = forek(ics(['UID:t', 'DTSTART;TZID=Europe/Oslo:20261006T170000', 'DTEND;TZID=Europe/Oslo:20261006T180000',
      'RRULE:FREQ=WEEKLY;BYDAY=TU', 'SUMMARY:Trening']), new Date(2026, 9, 1), new Date(2026, 10, 15));
    krev(t.length === 6, 'seks tirsdager', t.map(f => dato(f.start)));
    krev(t.every(f => kl(f.start) === '17:00'), 'kl. 17 også etter vintertid', t.map(f => kl(f.start)));

    // Mandag og onsdag, annenhver uke, fem ganger.
    const a = forek(ics(['UID:a', 'DTSTART:20261005T080000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5', 'SUMMARY:A']),
      new Date(2026, 9, 1), new Date(2027, 0, 1));
    krev(a.map(f => dato(f.start)).join(' ') === '5.10.2026 7.10.2026 19.10.2026 21.10.2026 2.11.2026',
      'annenhver uke, COUNT=5', a.map(f => dato(f.start)));
    // COUNT telles fra starten, også når vinduet begynner senere.
    const a2 = forek(ics(['UID:a', 'DTSTART:20261005T080000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5', 'SUMMARY:A']),
      new Date(2026, 9, 20), new Date(2027, 0, 1));
    krev(a2.length === 2, 'COUNT telles fra starten', a2.map(f => dato(f.start)));

    // Andre torsdag i måneden, til og med desember.
    const m = forek(ics(['UID:m', 'DTSTART:20260910T190000', 'RRULE:FREQ=MONTHLY;BYDAY=2TH;UNTIL=20261231T235959Z', 'SUMMARY:Styremøte']),
      new Date(2026, 8, 1), new Date(2027, 3, 1));
    krev(m.map(f => dato(f.start)).join(' ') === '10.9.2026 8.10.2026 12.11.2026 10.12.2026', 'andre torsdag, UNTIL', m.map(f => dato(f.start)));

    // Siste fredag i måneden.
    const s = forek(ics(['UID:s', 'DTSTART:20261030T160000', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR', 'SUMMARY:Fredagstaco']),
      new Date(2026, 9, 1), new Date(2027, 0, 1));
    krev(s.map(f => dato(f.start)).join(' ') === '30.10.2026 27.11.2026 25.12.2026', 'siste fredag', s.map(f => dato(f.start)));

    // Den 31. hver måned hoppes over i måneder med 30 dager.
    const m31 = forek(ics(['UID:31', 'DTSTART:20261031T120000', 'RRULE:FREQ=MONTHLY', 'SUMMARY:Ultimo']),
      new Date(2026, 9, 1), new Date(2027, 1, 1));
    krev(m31.map(f => dato(f.start)).join(' ') === '31.10.2026 31.12.2026 31.1.2027', '31. hoppes over i november', m31.map(f => dato(f.start)));

    // Daglig, med unntak.
    const d = forek(ics(['UID:d', 'DTSTART;VALUE=DATE:20261012', 'RRULE:FREQ=DAILY;COUNT=5',
      'EXDATE;VALUE=DATE:20261014', 'SUMMARY:Leirskole']), new Date(2026, 9, 1), new Date(2026, 10, 1));
    krev(d.map(f => f.start.getDate()).join(',') === '12,13,15,16', 'EXDATE fjerner én dag', d.map(f => f.start.getDate()));

    // En gammel daglig serie uten slutt: hoppet fram til vinduet må ikke bomme.
    const g = forek(ics(['UID:g', 'DTSTART:20100101T073000', 'RRULE:FREQ=DAILY;INTERVAL=3', 'SUMMARY:Gammel']),
      new Date(2026, 9, 14), new Date(2026, 9, 21));
    const forventet = [];
    for (let x = new Date(2010, 0, 1, 7, 30); x < new Date(2026, 9, 21); x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 3, 7, 30)) {
      if (x >= new Date(2026, 9, 14)) forventet.push(dato(x));
    }
    krev(g.map(f => dato(f.start)).join() === forventet.join(), 'lang serie, riktig fase', [g.map(f => dato(f.start)), forventet]);
  }

  console.log('ukestart: RFC 5545 sitt eget eksempel');
  {
    // Samme regel, to ukestarter, forskjellige datoer – rett fra RFC-en.
    const r = wkst => forek(ics(['UID:w', 'DTSTART:19970805T090000',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=' + wkst, 'SUMMARY:W']),
      new Date(1997, 7, 1), new Date(1997, 8, 30)).map(f => f.start.getDate()).join(',');
    krev(r('MO') === '5,10,19,24', 'WKST=MO', r('MO'));
    krev(r('SU') === '5,17,19,31', 'WKST=SU', r('SU'));
  }

  console.log('bursdager');
  {
    const s = forek(ics(['UID:s', 'DTSTART;VALUE=DATE:19840229', 'RRULE:FREQ=YEARLY', 'SUMMARY:Skuddårsbarn']),
      new Date(2026, 0, 1), new Date(2029, 0, 1));
    krev(s.map(f => dato(f.start)).join(' ') === '28.2.2026 28.2.2027 29.2.2028', '29. februar havner på 28. i vanlige år',
      s.map(f => dato(f.start)));
    krev(s[0].forste.getFullYear() === 1984, 'fødselsåret er med, så alderen kan regnes', s[0].forste.getFullYear());
  }

  console.log('flyttet og avlyst');
  {
    const k = ics(
      ['UID:korps', 'DTSTART:20261005T180000', 'DTEND:20261005T193000', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Korps'],
      ['UID:korps', 'RECURRENCE-ID:20261012T180000', 'DTSTART:20261013T170000', 'DTEND:20261013T183000', 'SUMMARY:Korps (flyttet)'],
      ['UID:korps', 'RECURRENCE-ID:20261019T180000', 'DTSTART:20261019T180000', 'STATUS:CANCELLED', 'SUMMARY:Korps'],
      ['UID:x', 'DTSTART:20261015T100000', 'STATUS:CANCELLED', 'SUMMARY:Avlyst']
    );
    const f = forek(k, new Date(2026, 9, 1), new Date(2026, 9, 31));
    krev(f.map(x => dato(x.start) + ' ' + kl(x.start)).join(', ') === '5.10.2026 18:00, 13.10.2026 17:00, 26.10.2026 18:00',
      'flyttet erstatter, avlyst forsvinner', f.map(x => dato(x.start) + ' ' + kl(x.start) + ' ' + x.tittel));
  }

  console.log('vinduer');
  {
    const k = ics(
      ['UID:f', 'DTSTART;VALUE=DATE:20261017', 'DTEND;VALUE=DATE:20261022', 'SUMMARY:Høstferie'],
      ['UID:n', 'DTSTART:20261013T220000', 'DTEND:20261014T020000', 'SUMMARY:Nattevakt'],
      ['UID:p', 'DTSTART:20261014T090000', 'SUMMARY:Påminnelse uten slutt']
    );
    const dag = (d) => forek(k, new Date(2026, 9, d), new Date(2026, 9, d + 1)).map(f => f.tittel);
    krev(dag(14).join() === 'Nattevakt,Påminnelse uten slutt', 'over midnatt og uten slutt hører til 14.', dag(14));
    krev(dag(16).length === 0, 'ferien har ikke begynt 16.', dag(16));
    krev(dag(17).join() === 'Høstferie' && dag(21).join() === 'Høstferie', 'ferien 17.–21.', [dag(17), dag(21)]);
    krev(dag(22).length === 0, 'DTEND er ikke med', dag(22));
  }

  console.log('simulert iCloud: filene slik Apple skriver dem');
  {
    const k = {};
    Sim.kalendere().forEach(c => { k[c.navn] = Kalender.les(limSammen(c.fil)); });
    const uke = (navn, fra, til) => Kalender.forekomster(k[navn].hendelser, fra, til);

    const raa = Sim.kalendere()[0].fil;
    krev(raa.toString('utf8').includes('\ufffd'), 'simuleringen bretter faktisk midt i et tegn');
    const mote = k.Mamma.hendelser.find(h => h.tittel === 'Foreldremøte 3B');
    krev(mote && !/\ufffd/.test(JSON.stringify(k.Mamma)), 'æøå er hele etter bretting på bytenivå');
    // Og det gamle vs. det nye: dekodet først, limt etterpå, gir «��».
    const feilVei = raa.toString('utf8').replace(/\r\n[ \t]/g, '');
    krev(/\ufffd/.test(feilVei) && limSammen(raa).includes('østre port'),
      'dekodet før liming blir «ø» til «��» – limt først er den hel');
    krev(k.Mamma.farge === '#ff2968' && k.Ella.farge === '#63da38', 'fargene fra iPhone', [k.Mamma.farge, k.Ella.farge]);
    krev(k.Mamma.navn === 'Mamma', 'kalendernavnet', k.Mamma.navn);
    krev(k.Mamma.hendelser.length === 4, 'VTIMEZONE og VALARM blir ikke hendelser', k.Mamma.hendelser.length);
    krev(mote.sted === 'Bekkestua barneskole\nGamle Ringeriksvei 30', 'sted med linjeskift', mote.sted);

    const svom = uke('Ella', new Date(2026, 9, 14), new Date(2026, 9, 15)).find(f => f.tittel === 'Svømming');
    krev(svom && kl(svom.start) === '14:30', 'UTC-invitasjon i norsk tid', svom && kl(svom.start));

    const inne = uke('Pappa', new Date(2026, 8, 1), new Date(2026, 9, 15)).filter(f => f.tittel === 'Innebandy');
    krev(inne.map(f => dato(f.start)).join() === Sim.forventet.innebandy.join(), 'WKST=SU annenhver uke',
      inne.map(f => dato(f.start)));
    krev(inne.every(f => kl(f.start) === '20:15'), 'samme klokkeslett hele høsten', inne.map(f => kl(f.start)));

    const lonn = uke('Mamma', new Date(2026, 9, 1), new Date(2027, 0, 1)).filter(f => f.tittel === 'Lønning');
    krev(lonn.map(f => dato(f.start)).join() === Sim.forventet.lonning.join(), 'siste hverdag i måneden',
      lonn.map(f => dato(f.start)));

    const yoga = uke('Mamma', new Date(2026, 9, 8), new Date(2026, 9, 23)).filter(f => f.tittel === 'Yoga');
    krev(yoga.map(f => f.start.getDate()).join() === '8,22', 'EXDATE med TZID stryker 15.', yoga.map(f => f.start.getDate()));

    const korps = uke('Ella', new Date(2026, 9, 5), new Date(2026, 9, 27)).filter(f => /^Korps/.test(f.tittel));
    krev(korps.map(f => f.start.getDate() + ' ' + kl(f.start)).join() === '5 18:00,20 17:30,26 18:00',
      'avlyst 12., flyttet 19. → 20.', korps.map(f => f.start.getDate() + ' ' + kl(f.start) + ' ' + f.tittel));

    const fotball = uke('Theo', new Date(2026, 9, 26), new Date(2026, 10, 30)).filter(f => f.tittel === 'Fotball');
    krev(fotball.map(f => f.start.getDate()).join() === '26,28', 'UNTIL i UTC stopper serien 31.10.', fotball.map(f => dato(f.start)));
    krev(uke('Theo', new Date(2026, 9, 15), new Date(2026, 9, 16)).length === 0, 'avlyst tannlege vises ikke');

    const b = uke('Bursdager', new Date(2027, 1, 1), new Date(2027, 2, 31));
    krev(b.length === 1 && dato(b[0].start) === '28.2.2027', 'skuddårsbarnet på 28.2.', b.map(f => dato(f.start)));

    // Beskjæringen tar ikke med seg noe tavla trenger.
    Sim.kalendere().forEach(c => {
      const hel = limSammen(c.fil);
      const kort = Kalender.beskjaer(hel, new Date(2026, 9, 13));
      const a = Kalender.forekomster(Kalender.les(hel).hendelser, new Date(2026, 9, 14), new Date(2026, 11, 31));
      const b2 = Kalender.forekomster(Kalender.les(kort).hendelser, new Date(2026, 9, 14), new Date(2026, 11, 31));
      krev(a.length === b2.length && a.length > 0, c.navn + ': beskjæring endrer ingenting framover', [a.length, b2.length]);
    });
  }

  console.log('beskjæring');
  {
    const k = ics(
      ['UID:gammel', 'DTSTART:20150101T100000', 'SUMMARY:Gammel'],
      ['UID:serie', 'DTSTART:20150101T100000', 'RRULE:FREQ=YEARLY', 'SUMMARY:Serie'],
      ['UID:ferdig', 'DTSTART:20150101T100000', 'RRULE:FREQ=WEEKLY;UNTIL=20160101T000000Z', 'SUMMARY:Ferdig serie'],
      ['UID:talt', 'DTSTART:20150101T100000', 'RRULE:FREQ=DAILY;COUNT=3', 'SUMMARY:Talt serie'],
      ['UID:ny', 'DTSTART:20261020T100000', 'SUMMARY:Ny'],
      ['UID:serie', 'RECURRENCE-ID:20270101T100000', 'DTSTART:20270102T100000', 'SUMMARY:Serie flyttet']
    );
    const kort = Kalender.beskjaer(k, new Date(2026, 9, 13));
    const titler = Kalender.les(kort).hendelser.map(h => h.tittel);
    krev(titler.join() === 'Serie,Ny,Serie flyttet', 'bare det som kan vises, blir med', titler);
    krev(/X-WR-CALNAME:Prøve/.test(kort), 'hodet blir med', kort.slice(0, 80));
  }

  console.log('demo');
  {
    const p = Demo.pakke(new Date(2026, 9, 14, 13, 5));
    const idag = new Date(2026, 9, 14);
    const middag = Kalender.forekomster(Kalender.les(p.kalendere.find(k => k.rolle === 'middag').ics).hendelser, idag, new Date(2026, 9, 21));
    krev(middag.length === 7 && middag[0].tittel === 'Taco', 'sju middager', middag.map(f => f.tittel));
  }

  console.log('vær');
  {
    const v = Demo.vaer(new Date(2026, 9, 14, 13, 5));
    const n = Vaer.naa(v, new Date(2026, 9, 14, 13, 5));
    krev(n && typeof n.temp === 'number' && /\w/.test(n.symbol), 'været nå', n);
    const t = Vaer.timer(v, new Date(2026, 9, 14, 13, 5), 3, 3);
    krev(t.map(x => x.tid.getHours()).join() === '16,19,22', 'tre klokkeslett', t.map(x => x.tid.getHours()));
    const d = Vaer.dager(v, new Date(2026, 9, 14, 13, 5), 3);
    krev(d.length === 3 && d[0].dato.getDate() === 15 && d[0].min <= d[0].maks, 'tre dager fra i morgen', d);
    krev(Vaer.tekst('lightssleetshowersandthunder_day') === 'Lette sluddbyger og torden', 'METs stavefeil gir navn');
    const ikoner = fs.readdirSync(path.join(__dirname, '..', 'vaer'));
    krev(ikoner.includes('lightssleetshowersandthunder_day.svg') && ikoner.length > 80, 'ikonene finnes', ikoner.length);
  }

  console.log('kryptering');
  {
    const p = await Krypto.krypter('hemmelig æøå 🙂', 'riktig hest batteri stift');
    krev(!JSON.stringify(p).includes('hemmelig'), 'teksten synes ikke');
    krev(await Krypto.dekrypter(p, 'riktig hest batteri stift') === 'hemmelig æøå 🙂', 'tur-retur');
    const q = await Krypto.krypter('hemmelig æøå 🙂', 'riktig hest batteri stift');
    krev(p.iv !== q.iv && p.salt !== q.salt, 'nytt salt og ny IV hver gang');
    let avvist = false;
    try { await Krypto.dekrypter(p, 'feil'); } catch (e) { avvist = true; }
    krev(avvist, 'feil passfrase avvises');
  }

  console.log('synk: lista over kalendere');
  {
    const l = lesListe('# kommentar\nMamma: webcal://p1-caldav.icloud.com/published/2/abc\n\nMiddag : https://x/y.ics\nBursdager: webcal://z\n');
    krev(l.map(k => k.navn + '/' + k.rolle).join() === 'Mamma/person,Middag/middag,Bursdager/bursdager', 'navn og roller', l);
    krev(l[0].url === 'https://p1-caldav.icloud.com/published/2/abc', 'webcal blir https', l[0].url);
    krev(lesListe('Søppel: webcal://a\nTømming: webcal://b')[0].rolle === 'tomming' &&
      lesListe('Tømming: webcal://b')[0].rolle === 'tomming', '«Søppel» og «Tømming» er søppelkalendre');
    let avvist = '';
    try { lesListe('webcal://uten-navn'); } catch (e) { avvist = e.message; }
    krev(/Navn: webcal/.test(avvist) && !/uten-navn/.test(avvist), 'linje uten navn avvises, uten å vise lenka', avvist);
  }

  console.log('synk: hele jobben mot en lokal server');
  {
    const filer = {
      '/mamma.ics': ics(['UID:1', 'DTSTART:20991014T170000', 'SUMMARY:Langt fram'], ['UID:2', 'DTSTART:20100101T100000', 'SUMMARY:Gammelt']),
      '/middag.ics': ics(['UID:m', 'DTSTART;VALUE=DATE:20991014', 'SUMMARY:Taco'])
    };
    const server = http.createServer((q, r) => {
      if (filer[q.url]) { r.writeHead(200, { 'Content-Type': 'text/calendar' }); r.end(filer[q.url]); }
      else { r.writeHead(404); r.end(); }
    });
    await new Promise(r => server.listen(8132, r));
    const ut = path.join(os.tmpdir(), 'familietavle-' + process.pid + '.json');
    const kjor = (env) => new Promise(r => execFile(process.execPath, [path.join(__dirname, '..', 'synk', 'synk.js'), ut],
      { env: Object.assign({}, process.env, env), timeout: 60000 }, (e, so) => r({ kode: e ? e.code : 0, ut: so })));

    const tom = await kjor({ FAMILIETAVLE_KALENDERE: '', FAMILIETAVLE_PASSFRASE: '' });
    krev(tom.kode === 0 && !fs.existsSync(ut), 'uten hemmeligheter: ingen feil, ingen fil', tom);

    const passfrase = 'fire tilfeldige ord her';
    const ok = await kjor({
      FAMILIETAVLE_KALENDERE: 'Mamma: http://localhost:8132/mamma.ics\nMiddag: http://localhost:8132/middag.ics',
      FAMILIETAVLE_PASSFRASE: passfrase
    });
    krev(ok.kode === 0 && fs.existsSync(ut), 'jobben skriver fila', ok);
    if (fs.existsSync(ut)) {
      const fil = fs.readFileSync(ut, 'utf8');
      krev(!/Taco|Mamma|localhost/.test(fil), 'ingenting lesbart i fila');
      const data = JSON.parse(await Krypto.dekrypter(JSON.parse(fil), passfrase));
      krev(data.kalendere.map(k => k.navn + '/' + k.rolle).join() === 'Mamma/person,Middag/middag', 'kalendrene er med', data.kalendere.map(k => k.navn));
      krev(/Langt fram/.test(data.kalendere[0].ics) && !/Gammelt/.test(data.kalendere[0].ics), 'gamle hendelser er beskåret');
      krev(Math.abs(new Date(data.hentet) - Date.now()) < 120000, 'tidspunktet er med', data.hentet);
      fs.unlinkSync(ut);
    }

    const brudd = await kjor({
      FAMILIETAVLE_KALENDERE: 'Mamma: http://localhost:8132/finnes-ikke.ics',
      FAMILIETAVLE_PASSFRASE: passfrase
    });
    krev(brudd.kode !== 0 && !fs.existsSync(ut), 'en kalender som feiler, stopper jobben – den gamle fila står', brudd.kode);
    krev(/Fikk ikke hentet «Mamma»/.test(brudd.ut) && !/finnes-ikke/.test(brudd.ut), 'feilmeldinga nevner navnet, ikke lenka', brudd.ut);

    const kort = await kjor({ FAMILIETAVLE_KALENDERE: 'Mamma: http://localhost:8132/mamma.ics', FAMILIETAVLE_PASSFRASE: 'kort' });
    krev(kort.kode !== 0 && /for kort/.test(kort.ut), 'for kort passfrase avvises', kort.ut);
    server.close();
  }

  console.log((feil ? feil + ' av ' : 'Alle ') + gjort + ' krav ' + (feil ? 'FEILET' : 'holdt'));
  process.exit(feil ? 1 : 0);
})();
