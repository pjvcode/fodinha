import { describe, expect, it } from 'vitest';

import { legalBids } from '../src/engine/bidding';
import { assertInvariants } from '../src/engine/invariants';
import { createMatch, defaultConfig, defaultPlayers, reduce } from '../src/engine/reducer';
import type { GameConfig, MatchState } from '../src/engine/types';

function start(overrides: Partial<GameConfig> = {}): MatchState {
  const config = defaultConfig({ players: defaultPlayers(4), seed: 123, ...overrides });
  let s = createMatch(config);
  s = reduce(s, { t: 'START_MATCH' }).state;
  return reduce(s, { t: 'DEAL' }).state;
}

/** Palpita por todo mundo, escolhendo sempre o primeiro valor legal. */
function bidAll(state: MatchState): MatchState {
  let s = state;
  while (s.phase === 'bidding') {
    const id = s.players[s.bidTurnIndex!]!.id;
    s = reduce(s, { t: 'BID', playerId: id, bid: legalBids(s)[0]! }).state;
  }
  return s;
}

describe('fluxo de fases', () => {
  it('setup → dealing → bidding → playing', () => {
    const config = defaultConfig({ players: defaultPlayers(4), seed: 1 });
    const s0 = createMatch(config);
    expect(s0.phase).toBe('setup');

    const s1 = reduce(s0, { t: 'START_MATCH' }).state;
    expect(s1.phase).toBe('dealing');
    expect(s1.handIndex).toBe(0);

    const s2 = reduce(s1, { t: 'DEAL' }).state;
    expect(s2.phase).toBe('bidding');

    const s3 = bidAll(s2);
    expect(s3.phase).toBe('playing');
    expect(s3.trick).not.toBeNull();
  });

  it('o distribuidor palpita por último e o jogador à sua esquerda puxa', () => {
    const s = start({ maxCardsCap: 3, progression: 'down-up' });
    const dealer = s.players[s.dealerIndex]!;
    const esquerda = s.players[(s.dealerIndex + 1) % s.players.length]!;

    expect(s.players[s.bidTurnIndex!]!.id).toBe(esquerda.id);

    const afterBids = bidAll(s);
    expect(afterBids.trick!.leaderId).toBe(esquerda.id);
    // O distribuidor foi o último a ter o palpite registrado.
    expect(dealer.bid).toBeNull();
    expect(afterBids.players[s.dealerIndex]!.bid).not.toBeNull();
  });

  it('o distribuidor rotaciona a cada mão', () => {
    let s = start({ maxCardsCap: 2 });
    const primeiro = s.dealerIndex;
    s = bidAll(s);
    while (s.phase !== 'handScored') {
      if (s.phase === 'playing') {
        const p = s.players[s.turnIndex!]!;
        s = reduce(s, { t: 'PLAY', playerId: p.id, card: p.hand[0]! }).state;
      } else if (s.phase === 'trickResolved') {
        s = reduce(s, { t: 'RESOLVE_TRICK' }).state;
      }
    }
    s = reduce(s, { t: 'NEXT_HAND' }).state;
    expect(s.dealerIndex).toBe((primeiro + 1) % s.players.length);
  });
});

describe('ações inválidas', () => {
  it('não lançam exceção e não mudam o estado', () => {
    const s = start();
    const { state, events } = reduce(s, { t: 'PLAY', playerId: 'p0', card: '3c' });
    expect(state).toBe(s);
    expect(events).toEqual([
      { t: 'INVALID_ACTION', action: { t: 'PLAY', playerId: 'p0', card: '3c' }, reason: expect.any(String) },
    ]);
  });

  it('rejeitam palpite fora de turno', () => {
    const s = start();
    const foraDaVez = s.players[(s.bidTurnIndex! + 1) % s.players.length]!;
    const { events } = reduce(s, { t: 'BID', playerId: foraDaVez.id, bid: 0 });
    expect(events[0]!.t).toBe('INVALID_ACTION');
  });

  it('rejeitam o palpite proibido do distribuidor', () => {
    let s = start({ maxCardsCap: 3, progression: 'down-up' });
    for (let i = 0; i < 3; i++) {
      s = reduce(s, { t: 'BID', playerId: s.players[s.bidTurnIndex!]!.id, bid: 0 }).state;
    }
    const dealer = s.players[s.bidTurnIndex!]!;
    expect(legalBids(s)).toEqual([0, 1, 2]); // proibido: 3
    const { events } = reduce(s, { t: 'BID', playerId: dealer.id, bid: 3 });
    expect(events[0]!.t).toBe('INVALID_ACTION');
  });

  it('rejeitam carta que não está na mão', () => {
    const s = bidAll(start({ maxCardsCap: 3, progression: 'down-up' }));
    const atual = s.players[s.turnIndex!]!;
    const alheia = s.players.find((p) => p.id !== atual.id)!.hand[0]!;
    const { events } = reduce(s, { t: 'PLAY', playerId: atual.id, card: alheia });
    expect(events[0]!.t).toBe('INVALID_ACTION');
  });

  it('rejeitam NEXT_HAND antes da mão ser pontuada', () => {
    const { events } = reduce(start(), { t: 'NEXT_HAND' });
    expect(events[0]!.t).toBe('INVALID_ACTION');
  });
});

describe('mão sem vira', () => {
  it('4 jogadores × 10 cartas usa o baralho inteiro e joga sem manilha', () => {
    // down-up começa no máximo: 10 cartas para 4 jogadores.
    const s = start({ progression: 'down-up' });
    expect(s.handSize).toBe(10);
    expect(s.vira).toBeNull();
    expect(s.manilhaRank).toBeNull();
    expect(s.stock).toEqual([]);
    expect(s.players.every((p) => p.hand.length === 10)).toBe(true);
    assertInvariants(s, 'mão sem vira');
  });

  it('8 jogadores × 5 cartas também zera o baralho', () => {
    const s = start({ players: defaultPlayers(8), progression: 'down-up' });
    expect(s.handSize).toBe(5);
    expect(s.vira).toBeNull();
    assertInvariants(s, '8 jogadores sem vira');
  });

  it('6 jogadores × 6 cartas sempre sobra carta para virar', () => {
    const s = start({ players: defaultPlayers(6), progression: 'down-up' });
    expect(s.handSize).toBe(6);
    expect(s.vira).not.toBeNull();
    expect(s.manilhaRank).not.toBeNull();
    expect(s.stock).toHaveLength(3);
    assertInvariants(s, '6 jogadores com vira');
  });
});

describe('determinismo', () => {
  it('a mesma seed distribui exatamente as mesmas cartas', () => {
    const a = start({ seed: 4242 });
    const b = start({ seed: 4242 });
    expect(a.players.map((p) => p.hand)).toEqual(b.players.map((p) => p.hand));
    expect(a.vira).toBe(b.vira);
  });

  it('seeds diferentes distribuem cartas diferentes', () => {
    const a = start({ seed: 1, progression: 'down-up' });
    const b = start({ seed: 2, progression: 'down-up' });
    expect(a.players[0]!.hand).not.toEqual(b.players[0]!.hand);
  });
});
