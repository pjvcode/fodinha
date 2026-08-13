import { describe, expect, it } from 'vitest';

import { forbiddenBidFor, legalBidsFor } from '../src/engine/bidding';

describe('legalBidsFor', () => {
  it('quem não é o último palpita qualquer valor de 0 a h', () => {
    const legal = legalBidsFor({ handSize: 3, bidsSoFar: 0, isLastBidder: false });
    expect(legal).toEqual([0, 1, 2, 3]);
  });

  it('o último palpitante não pode fechar a soma no número de cartas', () => {
    // h = 3, já palpitaram 2 → proibido palpitar 1.
    const ctx = { handSize: 3, bidsSoFar: 2, isLastBidder: true };
    expect(forbiddenBidFor(ctx)).toBe(1);
    expect(legalBidsFor(ctx)).toEqual([0, 2, 3]);
  });

  it('quando o valor proibido cai fora de [0, h], o último palpita livre', () => {
    // h = 3, já palpitaram 5 → proibido seria -2, fora da faixa.
    const ctx = { handSize: 3, bidsSoFar: 5, isLastBidder: true };
    expect(forbiddenBidFor(ctx)).toBeNull();
    expect(legalBidsFor(ctx)).toEqual([0, 1, 2, 3]);
  });

  it('o distribuidor pode ficar com uma única opção legal', () => {
    // h = 1, ninguém palpitou 1 ainda → proibido 1, sobra só o 0.
    expect(legalBidsFor({ handSize: 1, bidsSoFar: 0, isLastBidder: true })).toEqual([0]);
    // h = 1, alguém já palpitou 1 → proibido 0, sobra só o 1.
    expect(legalBidsFor({ handSize: 1, bidsSoFar: 1, isLastBidder: true })).toEqual([1]);
  });

  it('a restrição vale em toda mão, inclusive na de 1 carta', () => {
    // Não há mais exceção: a mão de 1 carta é jogada como qualquer outra.
    expect(forbiddenBidFor({ handSize: 1, bidsSoFar: 0, isLastBidder: true })).toBe(1);
    expect(forbiddenBidFor({ handSize: 3, bidsSoFar: 1, isLastBidder: true })).toBe(2);
  });

  it.each([1, 2, 3, 4, 5])('cobre a faixa completa em h = %i', (h) => {
    const legal = legalBidsFor({ handSize: h, bidsSoFar: 0, isLastBidder: false });
    expect(legal).toHaveLength(h + 1);
    expect(legal[0]).toBe(0);
    expect(legal[legal.length - 1]).toBe(h);
  });
});
