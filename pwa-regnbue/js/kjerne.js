'use strict';
/*
 * kjerne.js — regler, brettgenerator og enerløser.
 *
 * Rutenettet er av vilkårlig boksform, så 4×4, 6×6 og 9×9 kjører på samme
 * kode. Løseren kan bare enere — nakne og skjulte — og generatoren graver bare
 * så lenge brettet fortsatt lar seg løse med dem.
 *
 * «Bare enere» er ikke en forenkling av latskap. Det er hele kravet: et brett
 * som krever låste kandidater eller par, kan ikke løses av noen som ikke kan
 * lese enda. Et barn skal kunne peke på en rute og si «her må det være hjerte,
 * for hjertet er brukt opp i de andre».
 *
 * Eksponeres som window.RegnbueKjerne.
 */
(function (global) {

  /**
   * Geometrien til et brett med bokser på `boksH` × `boksB`.
   * 4×4 får bokser på 2×2, 6×6 på 2×3, 9×9 på 3×3.
   */
  function lagRutenett(boksH, boksB) {
    const N = boksH * boksB;            // sidelengde og antall symboler
    const ANT = N * N;
    const ALL = ((1 << (N + 1)) - 1) & ~1;   // bit 1..N, bit 0 ubrukt

    const rad = i => (i / N) | 0;
    const kol = i => i % N;
    const boks = i => ((rad(i) / boksH) | 0) * boksH + ((kol(i) / boksB) | 0);

    const ENHETER = [];
    for (let n = 0; n < N; n++) {
      const r = [], k = [], b = [];
      for (let i = 0; i < ANT; i++) {
        if (rad(i) === n) r.push(i);
        if (kol(i) === n) k.push(i);
        if (boks(i) === n) b.push(i);
      }
      ENHETER.push({ slag: 'rad', n, celler: r });
      ENHETER.push({ slag: 'kolonne', n, celler: k });
      ENHETER.push({ slag: 'boks', n, celler: b });
    }

    const NABOER = [];
    for (let i = 0; i < ANT; i++) {
      const s = new Set();
      for (const u of ENHETER) {
        if (u.celler.indexOf(i) === -1) continue;
        for (const j of u.celler) if (j !== i) s.add(j);
      }
      NABOER.push(Array.from(s));
    }

    return { N, ANT, ALL, boksH, boksB, rad, kol, boks, ENHETER, NABOER };
  }

  const ANTALL_BIT = m => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
  const FORSTE_BIT = m => { for (let d = 1; d <= 16; d++) if (m & (1 << d)) return d; return 0; };

  /** Kandidatmaskene brettet gir av seg selv. */
  function kandidater(g, verdier) {
    const c = new Int32Array(g.ANT);
    for (let i = 0; i < g.ANT; i++) {
      if (verdier[i]) continue;
      let m = g.ALL;
      for (const p of g.NABOER[i]) if (verdier[p]) m &= ~(1 << verdier[p]);
      c[i] = m;
    }
    return c;
  }

  /**
   * Neste trekk, og bare enere — det er hele teknikkrepertoaret her.
   *
   * Naken ener først: «bare ett symbol passer i denne ruta» er lettere å se
   * for et barn enn «dette symbolet passer bare i denne ruta i raden».
   */
  function nesteTrekk(g, verdier) {
    const c = kandidater(g, verdier);

    for (let i = 0; i < g.ANT; i++) {
      if (verdier[i] || ANTALL_BIT(c[i]) !== 1) continue;
      return { rute: i, verdi: FORSTE_BIT(c[i]), slag: 'naken' };
    }

    for (const u of g.ENHETER) {
      for (let d = 1; d <= g.N; d++) {
        const b = 1 << d;
        let antall = 0, hvor = -1, satt = false;
        for (const i of u.celler) {
          if (verdier[i] === d) { satt = true; break; }
          if (!verdier[i] && (c[i] & b)) { antall++; hvor = i; }
        }
        if (!satt && antall === 1) {
          return { rute: hvor, verdi: d, slag: 'skjult', enhet: u };
        }
      }
    }
    return null;
  }

  /** Løser brettet med enere alene. Returnerer false om det ikke rekker. */
  function losMedEnere(g, verdier) {
    const v = Uint8Array.from(verdier);
    for (let n = 0; n < g.ANT + 1; n++) {
      let tomme = 0;
      for (let i = 0; i < g.ANT; i++) if (!v[i]) tomme++;
      if (!tomme) return v;
      const t = nesteTrekk(g, v);
      if (!t) return null;
      v[t.rute] = t.verdi;
    }
    return null;
  }

  /* ---------- Fullt brett og entydighet ---------- */

  function stokk(a, rng) {
    const ut = a.slice();
    for (let i = ut.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const t = ut[i]; ut[i] = ut[j]; ut[j] = t;
    }
    return ut;
  }

  /** Teller løsninger opp til `tak`. Rent dybdesøk — brettene er små. */
  function tellLosninger(g, verdier, tak, rng) {
    const v = Uint8Array.from(verdier);
    let funnet = 0, forste = null;

    (function sok() {
      if (funnet >= tak) return;
      const c = kandidater(g, v);
      let best = -1, minst = g.N + 1;
      for (let i = 0; i < g.ANT; i++) {
        if (v[i]) continue;
        const n = ANTALL_BIT(c[i]);
        if (n === 0) return;                  // motsigelse
        if (n < minst) { minst = n; best = i; }
      }
      if (best === -1) { funnet++; if (!forste) forste = v.slice(); return; }

      let tall = [];
      for (let d = 1; d <= g.N; d++) if (c[best] & (1 << d)) tall.push(d);
      if (rng) tall = stokk(tall, rng);
      for (const d of tall) {
        v[best] = d;
        sok();
        v[best] = 0;
        if (funnet >= tak) return;
      }
    })();

    return { antall: funnet, losning: forste };
  }

  function fulltBrett(g, rng) {
    return tellLosninger(g, new Uint8Array(g.ANT), 1, rng).losning;
  }

  /* ---------- Generator ---------- */

  /**
   * Graver hull så lenge brettet både er entydig *og* lar seg løse med enere.
   *
   * Det andre kravet er det som skiller dette fra generatoren til de voksne:
   * der graves det så dypt som entydigheten tillater, og nivået leses av
   * etterpå. Her er det motsatt — vanskegraden er gitt, og gravingen stopper
   * når barnet ikke lenger kommer videre med å peke.
   */
  function lagBrett(oppsett, rng) {
    const g = lagRutenett(oppsett.boksH, oppsett.boksB);
    rng = rng || Math.random;

    const losning = fulltBrett(g, rng);
    if (!losning) return null;

    const brett = Uint8Array.from(losning);
    // Færrest mulig gitte er ikke målet: `minGitte` holder igjen, så selv det
    // vanskeligste barnenivået har nok å begynne med.
    const minGitte = Math.round(g.ANT * oppsett.andelGitte);
    let gitte = g.ANT;

    for (const i of stokk(Array.from({ length: g.ANT }, (_, k) => k), rng)) {
      if (gitte <= minGitte) break;
      const hadde = brett[i];
      brett[i] = 0;
      const entydig = tellLosninger(g, brett, 2, null).antall === 1;
      if (!entydig || !losMedEnere(g, brett)) brett[i] = hadde;
      else gitte--;
    }

    return { g, brett, losning, gitte };
  }

  /*
   * Nivåene er størrelse først, så hvor mye som er fylt ut. Et barn ser
   * forskjell på et lite og et stort brett lenge før det ser forskjell på to
   * løseteknikker, så det er størrelsen som bærer følelsen av å gå videre.
   */
  const NIVAAER = [
    { id: 'minst',  navn: 'Fire ruter',  om: 'Fire symboler',  boksH: 2, boksB: 2, andelGitte: 0.50 },
    { id: 'liten',  navn: 'Seks ruter',  om: 'Seks symboler',  boksH: 2, boksB: 3, andelGitte: 0.45 },
    { id: 'stor',   navn: 'Ni ruter',    om: 'Som mammas',     boksH: 3, boksB: 3, andelGitte: 0.42 }
  ];

  global.RegnbueKjerne = {
    lagRutenett, lagBrett, nesteTrekk, kandidater, losMedEnere,
    tellLosninger, NIVAAER
  };

})(window);
