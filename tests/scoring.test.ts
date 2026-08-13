import { describe, expect, it } from 'vitest';

import { createRandomBot } from '../src/bots/random';
import { runMatch } from '../src/bots/runner';
import type { BotMap } from '../src/bots/types';
import { createMatch, defaultConfig, defaultPlayers } from '../src/engine/reducer';
import { determineWinners, handPenalty, isMatchOver, standings } from '../src/engine/scoring';
import type { GameConfig, MatchState } from '../src/engine/types';

function stateWith(
  penalties: number[],
  overrides: Partial<GameConfig> = {},
  mutate: (s: MatchState) => void = () => {},
): MatchState {
  const config = defaultConfig({ players: defaultPlayers(penalties.length), ...overrides });
  const state = createMatch(config);
  const next: MatchState = {
    ...state,
    players: state.players.map((p, i) => ({ ...p, penalty: penalties[i]! })),
  };
  mutate(next);
  return next;
}

function botsFor(config: GameConfig, seed: number): BotMap {
  const map: BotMap = {};
  config.players.forEach((_, i) => {
    map[`p${i}`] = createRandomBot(seed + i * 7919, `random-${i}`);
  });
  return map;
}

describe('handPenalty', () => {
  it('é o módulo da diferença entre palpite e vazas', () => {
    expect(handPenalty(2, 2)).toBe(0);
    expect(handPenalty(0, 2)).toBe(2);
    expect(handPenalty(3, 1)).toBe(2);
    expect(handPenalty(1, 0)).toBe(1);
  });
});

describe('classificação no modo penalidade', () => {
  it('menor penalidade fica em primeiro', () => {
    const table = standings(stateWith([7, 3, 12, 5]));
    expect(table.map((r) => r.playerId)).toEqual(['p1', 'p3', 'p0', 'p2']);
    expect(table[0]!.rank).toBe(1);
  });

  it('empate no total gera vitória dividida', () => {
    expect(determineWinners(stateWith([4, 4, 9]))).toEqual(['p0', 'p1']);
  });

  it('vencedor único quando não há empate', () => {
    expect(determineWinners(stateWith([4, 5, 9]))).toEqual(['p0']);
  });
});

describe('classificação no modo eliminação', () => {
  const elim = { scoringMode: 'elimination' as const, startingLives: 5 };

  it('quem sobrou vem antes de quem saiu', () => {
    const state = stateWith([10, 2], elim, (s) => {
      s.players[0]!.lives = 3;
      s.players[1]!.lives = 0;
      s.players[1]!.eliminated = true;
    });
    expect(determineWinners(state)).toEqual(['p0']);
  });

  it('entre sobreviventes, mais vidas ganha', () => {
    const state = stateWith([1, 1, 1], elim, (s) => {
      s.players[0]!.lives = 2;
      s.players[1]!.lives = 4;
      s.players[2]!.lives = 4;
    });
    expect(determineWinners(state)).toEqual(['p1', 'p2']);
  });
});

describe('isMatchOver', () => {
  it('no modo penalidade, acaba na última mão da progressão', () => {
    const state = stateWith([0, 0, 0, 0]);
    expect(isMatchOver({ ...state, handIndex: 0 })).toBe(false);
    expect(isMatchOver({ ...state, handIndex: state.handSizes.length - 1 })).toBe(true);
  });

  it('no modo eliminação, acaba quando sobra um jogador', () => {
    const state = stateWith([0, 0, 0, 0], { scoringMode: 'elimination' }, (s) => {
      s.players[1]!.eliminated = true;
      s.players[2]!.eliminated = true;
      s.players[3]!.eliminated = true;
    });
    expect(isMatchOver({ ...state, handIndex: 0 })).toBe(true);
  });
});

describe('pontuação de ponta a ponta', () => {
  it('a penalidade de cada jogador é a soma dos erros de cada mão', () => {
    const config = defaultConfig({
      players: defaultPlayers(4),
      maxCardsCap: 4,
      seed: 2024,
    });
    const final = runMatch(config, botsFor(config, 11));

    for (const player of final.players) {
      const soma = final.history
        .flatMap((h) => h.rows)
        .filter((r) => r.playerId === player.id)
        .reduce((acc, r) => acc + r.penalty, 0);
      expect(player.penalty).toBe(soma);
    }
  });

  it('o vencedor é quem tem a menor penalidade total', () => {
    const config = defaultConfig({ players: defaultPlayers(4), maxCardsCap: 4, seed: 77 });
    const final = runMatch(config, botsFor(config, 3));

    const menor = Math.min(...final.players.map((p) => p.penalty));
    expect(final.winnerIds.length).toBeGreaterThan(0);
    for (const id of final.winnerIds) {
      expect(final.players.find((p) => p.id === id)!.penalty).toBe(menor);
    }
  });

  it('no modo eliminação a partida acaba com no máximo um sobrevivente', () => {
    const config = defaultConfig({
      players: defaultPlayers(4),
      scoringMode: 'elimination',
      startingLives: 3,
      maxCardsCap: 5,
      seed: 909,
    });
    const final = runMatch(config, botsFor(config, 5));
    const vivos = final.players.filter((p) => !p.eliminated);

    expect(final.phase).toBe('matchOver');
    // Ou sobrou no máximo um jogador, ou a progressão simplesmente terminou.
    expect(vivos.length <= 1 || final.handIndex === final.handSizes.length - 1).toBe(true);
    expect(final.winnerIds.length).toBeGreaterThan(0);
  });
});
