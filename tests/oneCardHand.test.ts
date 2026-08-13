import { describe, expect, it } from 'vitest';

import { legalBids } from '../src/engine/bidding';
import { createMatch, defaultConfig, defaultPlayers, reduce } from '../src/engine/reducer';
import { playerView } from '../src/engine/selectors';
import type { GameConfig, MatchState } from '../src/engine/types';

function dealt(overrides: Partial<GameConfig> = {}): MatchState {
  const config = defaultConfig({ players: defaultPlayers(4), seed: 5, ...overrides });
  let state = createMatch(config);
  state = reduce(state, { t: 'START_MATCH' }).state;
  state = reduce(state, { t: 'DEAL' }).state;
  return state;
}

/**
 * Todas as cartas que estão na mão de alguém que não é `playerId`. É o conjunto
 * que jamais pode aparecer na view dele.
 */
function cartasAlheias(state: MatchState, playerId: string): string[] {
  return state.players.filter((p) => p.id !== playerId).flatMap((p) => p.hand);
}

describe('mão de 1 carta', () => {
  const state = dealt();

  it('a primeira mão da progressão tem 1 carta', () => {
    expect(state.handSize).toBe(1);
  });

  it('o jogador vê a própria carta', () => {
    const view = playerView(state, 'p0');
    expect(view.me.hand).toHaveLength(1);
    expect(view.me.handCount).toBe(1);
    expect(view.me.hand[0]).toBe(state.players[0]!.hand[0]);
  });

  it('e não vê a de mais ninguém', () => {
    const view = playerView(state, 'p0');
    expect(view.opponents).toHaveLength(3);
    for (const o of view.opponents) {
      expect(o.handCount).toBe(1);
    }

    // A garantia forte: nenhuma carta alheia aparece em lugar nenhum da view,
    // nem num campo que alguém venha a acrescentar depois sem pensar.
    const serializada = JSON.stringify(view);
    for (const carta of cartasAlheias(state, 'p0')) {
      expect(serializada).not.toContain(carta);
    }
  });

  it('vê o vira normalmente', () => {
    const view = playerView(state, 'p0');
    expect(view.vira).not.toBeNull();
    expect(view.manilhaRank).not.toBeNull();
  });

  it('a carta jogável é a única que ele tem', () => {
    let s = state;
    while (s.phase === 'bidding') {
      const id = s.players[s.bidTurnIndex!]!.id;
      s = reduce(s, { t: 'BID', playerId: id, bid: legalBids(s)[0]! }).state;
    }
    const jogador = s.players[s.turnIndex!]!;
    const view = playerView(s, jogador.id);
    expect(view.legalCards).toEqual(jogador.hand);
    expect(view.legalCards).toHaveLength(1);
  });

  it('a restrição da soma vale como em qualquer outra mão', () => {
    let s = state;
    // Os três primeiros palpitam 0; o distribuidor fica sem poder palpitar 1.
    for (let i = 0; i < 3; i++) {
      const id = s.players[s.bidTurnIndex!]!.id;
      s = reduce(s, { t: 'BID', playerId: id, bid: 0 }).state;
    }
    expect(s.players[s.bidTurnIndex!]!.id).toBe(s.players[s.dealerIndex]!.id);
    expect(legalBids(s)).toEqual([0]);
  });
});

describe('a redação é a mesma em qualquer tamanho de mão', () => {
  // progression down-up com teto 3 → a primeira mão já tem 3 cartas.
  const state = dealt({ maxCardsCap: 3, progression: 'down-up' });

  it('vejo a minha mão inteira e nenhuma carta alheia', () => {
    expect(state.handSize).toBe(3);
    const view = playerView(state, 'p0');
    expect(view.me.hand).toHaveLength(3);

    const serializada = JSON.stringify(view);
    for (const carta of cartasAlheias(state, 'p0')) {
      expect(serializada).not.toContain(carta);
    }
    for (const o of view.opponents) {
      expect(o.handCount).toBe(3);
    }
  });
});
