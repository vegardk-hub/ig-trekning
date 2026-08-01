'use strict';
/*
 * generator.js — lager entydige puslespill med ønsket vanskelighetsgrad.
 *
 * Framgangsmåte: fyll et tilfeldig komplett rutenett og grav ut så mange
 * celler som mulig uten å miste entydigheten. Et dypt utgravd brett havner som
 * regel enten svært lett eller helt utenfor rekkevidden til de menneskelige
 * teknikkene. Derfor legges ledetråder tilbake én om gangen til brettet er
 * logisk løsbart og lander i riktig bånd — det første punktet der det blir
 * løsbart er nettopp det vanskeligste. Blir resultatet for lett, prøver vi på
 * nytt. Eksponeres som window.SudokuGenerator.
 */
(function (global) {

  const C = global.SudokuCore;
  const S = global.SudokuSolver;

  // Intervaller over høyeste teknikknivå som kreves for å løse puslespillet.
  const OMRAADER = {
    lett:      { min: 0, maks: 2 },
    middels:   { min: 3, maks: 3 },
    vanskelig: { min: 4, maks: 5 },
    ekspert:   { min: 6, maks: 11 }
  };

  const MAKS_FORSOK = 200;
  const PROVER_PER_RUNDE = 8;
  const PAUSE_ETTER_MS = 30;      // gi etter til nettleseren så ofte, så spinneren går rundt

  // Budsjettene teller regnetid, ikke klokketid: pausene mellom forsøkene kan
  // strupes kraftig av nettleseren hvis fanen ligger i bakgrunnen.
  const TIDSBUDSJETT_MS = 2500;   // etter dette tar vi det nærmeste vi har
  const JUSTER_BUDSJETT_MS = 400; // per nedstigning

  const pause = () => new Promise(r => setTimeout(r, 0));

  // Hvor hardt er brettet? Krever det gjetting, er det hardere enn alt vi kan.
  const rang = g => g.solved ? g.maks : 99;

  /**
   * Graver hull i en ferdig løsning så lenge puslespillet forblir entydig.
   * Ved symmetri fjernes celler parvis (180 graders rotasjon) — penere brett,
   * men de blir grunnere, så de hardeste nivåene graves asymmetrisk.
   */
  function grav(solution, rng, symmetric) {
    const puzzle = solution.slice();
    for (const i of C.shuffled(Array.from({ length: 81 }, (_, k) => k), rng)) {
      if (!puzzle[i]) continue;
      const j = symmetric ? 80 - i : i;
      const a = puzzle[i], b = puzzle[j];
      puzzle[i] = 0; puzzle[j] = 0;
      if (C.countSolutions(puzzle, 2) !== 1) { puzzle[i] = a; puzzle[j] = b; }
    }
    return puzzle;
  }

  /**
   * Legger tilbake ledetråder til puslespillet er logisk løsbart og lander
   * innenfor området. Ledetråder som skyter forbi (under `min`) forkastes —
   * vi tar heller et skritt som fortsatt ligger over og går videre derfra.
   * Returnerer null hvis ingen enkelt ledetråd fører nærmere.
   */
  function justerNed(puzzle, solution, omraade, rng) {
    const frist = performance.now() + JUSTER_BUDSJETT_MS;
    let g = S.grade(puzzle);

    for (let runde = 0; runde < 30 && rang(g) > omraade.maks; runde++) {
      if (performance.now() > frist) return null;
      const tomme = [];
      for (let i = 0; i < 81; i++) if (!puzzle[i]) tomme.push(i);
      if (!tomme.length) return null;

      let neste = null;
      for (const i of C.shuffled(tomme, rng).slice(0, PROVER_PER_RUNDE)) {
        const prove = puzzle.slice();
        prove[i] = solution[i];
        const pg = S.grade(prove);

        if (pg.solved && pg.maks >= omraade.min && pg.maks <= omraade.maks) {
          return { puzzle: prove, grade: pg };
        }
        if (pg.solved && pg.maks < omraade.min) continue;      // skjøt forbi — forkast
        // Fortsatt for hardt: ta det minste skrittet nedover som finnes, altså
        // den ledetråden som gjør brettet minst lettere. Går vi for fort ned,
        // hopper vi rett forbi båndet.
        if (rang(pg) < rang(g) && (!neste || rang(pg) > rang(neste.grade))) {
          neste = { puzzle: prove, grade: pg };
        }
      }
      if (!neste) return null;
      puzzle = neste.puzzle;
      g = neste.grade;
    }
    return g.solved && g.maks >= omraade.min && g.maks <= omraade.maks
      ? { puzzle, grade: g } : null;
  }

  /**
   * Lager et puslespill på ønsket nivå.
   * @param {string} nivaaId  lett | middels | vanskelig | ekspert
   * @param {function} [onProgress] kalles med (forsøk, MAKS_FORSOK)
   */
  async function generate(nivaaId, onProgress) {
    const omraade = OMRAADER[nivaaId] || OMRAADER.middels;
    const symmetric = nivaaId !== 'ekspert';
    const rng = Math.random;
    let brukt = 0, sidenPause = 0, naermest = null;

    for (let forsok = 0; forsok < MAKS_FORSOK; forsok++) {
      if (naermest && brukt > TIDSBUDSJETT_MS) break;
      if (sidenPause > PAUSE_ETTER_MS) {
        if (onProgress) onProgress(forsok, MAKS_FORSOK);
        sidenPause = 0;
        await pause();
      }

      const start = performance.now();
      const solution = C.randomSolution(rng);
      let puzzle = solution && grav(solution, rng, symmetric);
      let g = puzzle && S.grade(puzzle);

      if (g && rang(g) > omraade.maks) {
        const mildere = justerNed(puzzle, solution, omraade, rng);
        if (mildere) { puzzle = mildere.puzzle; g = mildere.grade; }
        else g = null;
      }
      const gikk = performance.now() - start;
      brukt += gikk;
      sidenPause += gikk;
      if (!g) continue;

      const resultat = { puzzle, solution, grade: g, nivaa: nivaaId };
      if (g.maks >= omraade.min) return resultat;

      // Ble for lett — ta vare på det nærmeste i tilfelle vi går tom for forsøk.
      const avstand = omraade.min - g.maks;
      if (!naermest || avstand < naermest.avstand) naermest = { avstand, resultat };
    }

    if (naermest) return naermest.resultat;
    throw new Error('Klarte ikke å lage puslespill på nivået ' + nivaaId);
  }

  global.SudokuGenerator = { generate };

})(window);
