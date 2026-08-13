import { describe, expect, it } from 'vitest';

import { createRandomBot } from '../src/bots/random';
import { runMatch } from '../src/bots/runner';
import type { BotMap } from '../src/bots/types';
import { assertInvariants } from '../src/engine/invariants';
import { defaultConfig, defaultPlayers } from '../src/engine/reducer';
import type { GameConfig, MatchState } from '../src/engine/types';

function bots(config: GameConfig, seed: number): BotMap {
  const map: BotMap = {};
  config.players.forEach((_, i) => {
    map[`p${i}`] = createRandomBot(seed + i * 7919, `random-${i}`);
  });
  return map;
}

function play(overrides: Partial<GameConfig>, botSeed = 99): MatchState {
  const config = defaultConfig({ players: defaultPlayers(4), seed: 42, ...overrides });
  return runMatch(config, bots(config, botSeed), {
    onStep: (state, action) => assertInvariants(state, `depois de ${action.t}`),
  });
}

describe('golden test — partida completa com seed fixa', () => {
  it('4 jogadores, seed 42: placar final travado', () => {
    const final = play({});

    expect(final.phase).toBe('matchOver');
    expect(final.handSizes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(final.history).toHaveLength(19);

    // Se este snapshot mudar, alguma regra mudou junto.
    expect(final.players.map((p) => p.penalty)).toMatchInlineSnapshot(`
      [
        30,
        47,
        43,
        39,
      ]
    `);
    expect(final.winnerIds).toMatchInlineSnapshot(`
      [
        "p0",
      ]
    `);
  });

  it('rodar duas vezes com a mesma seed dá exatamente o mesmo resultado', () => {
    const a = play({});
    const b = play({});
    expect(a.players.map((p) => p.penalty)).toEqual(b.players.map((p) => p.penalty));
    expect(a.history).toEqual(b.history);
    expect(a.winnerIds).toEqual(b.winnerIds);
  });

  it('seeds diferentes produzem partidas diferentes', () => {
    const a = play({ seed: 42 });
    const b = play({ seed: 43 });
    expect(a.history).not.toEqual(b.history);
  });
});

describe('partidas completas em todas as mesas', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('%i jogadores termina respeitando os invariantes', (n) => {
    const final = play({ players: defaultPlayers(n), maxCardsCap: 4 });

    expect(final.phase).toBe('matchOver');
    expect(final.history).toHaveLength(final.handSizes.length);
    expect(final.winnerIds.length).toBeGreaterThan(0);
    assertInvariants(final, `${n} jogadores`);
  });

  it.each([2, 4, 5, 8])(
    '%i jogadores atravessa a mão sem vira sem quebrar nada',
    (n) => {
      let semVira = 0;
      const config = defaultConfig({ players: defaultPlayers(n), seed: 7 });
      const final = runMatch(config, bots(config, 7), {
        onEvent: (event) => {
          if (event.t === 'HAND_DEALT' && event.vira === null) semVira++;
        },
        onStep: (state, action) => assertInvariants(state, `${n} jogadores / ${action.t}`),
      });

      expect(semVira).toBe(1);
      expect(final.phase).toBe('matchOver');
    },
  );

  it.each([3, 6, 7])('%i jogadores sempre tem vira em todas as mãos', (n) => {
    const config = defaultConfig({ players: defaultPlayers(n), seed: 7 });
    let semVira = 0;
    runMatch(config, bots(config, 7), {
      onEvent: (event) => {
        if (event.t === 'HAND_DEALT' && event.vira === null) semVira++;
      },
    });
    expect(semVira).toBe(0);
  });
});

describe('modo eliminação em partida completa', () => {
  // Regressão: com poucas vidas, jogadores são eliminados no meio da mão que
  // acabou de ser pontuada. O estado de `handScored` é o retrato dessa mão —
  // o palpite e as vazas de quem saiu continuam contando até o próximo DEAL.
  it.each([2, 4, 5, 8])('%i jogadores com 3 vidas mantém os invariantes', (n) => {
    for (let seed = 0; seed < 25; seed++) {
      const config = defaultConfig({
        players: defaultPlayers(n),
        scoringMode: 'elimination',
        startingLives: 3,
        seed,
      });
      const final = runMatch(config, bots(config, seed), {
        onStep: (state, action) =>
          assertInvariants(state, `elim ${n}p seed ${seed} / ${action.t}`),
      });
      expect(final.phase).toBe('matchOver');
      expect(final.winnerIds.length).toBeGreaterThan(0);
    }
  });

  it('a partida acaba assim que sobra um jogador de pé', () => {
    const config = defaultConfig({
      players: defaultPlayers(4),
      scoringMode: 'elimination',
      startingLives: 1,
      seed: 8,
    });
    const final = runMatch(config, bots(config, 8));
    const vivos = final.players.filter((p) => !p.eliminated);
    expect(vivos.length).toBeLessThanOrEqual(1);
  });
});

describe('modo melar em partida completa', () => {
  it('vazas anuladas são contabilizadas corretamente', () => {
    const config = defaultConfig({
      players: defaultPlayers(4),
      tieBreak: 'melar',
      maxCardsCap: 6,
      seed: 31337,
    });

    let anuladas = 0;
    const final = runMatch(config, bots(config, 13), {
      onEvent: (event) => {
        if (event.t === 'TRICK_ANNULLED') anuladas++;
      },
      onStep: (state, action) => assertInvariants(state, `melar / ${action.t}`),
    });

    expect(final.phase).toBe('matchOver');
    // Com 40 cartas e 4 jogadores, empates de valor acontecem com frequência.
    expect(anuladas).toBeGreaterThan(0);
  });
});
