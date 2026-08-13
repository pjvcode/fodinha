import { describe, expect, it } from 'vitest';

import { buildDeck } from '../src/engine/deck';
import {
  cardId,
  manilhaRankFor,
  isManilha,
  rankIndex,
  sortByStrength,
  strength,
  suitIndex,
} from '../src/engine/ranking';
import type { RankingRules } from '../src/engine/ranking';
import { RANKS, SUITS } from '../src/engine/types';
import type { CardId, Rank } from '../src/engine/types';

const SUIT_RULES: RankingRules = { suitOrder: SUITS, tieBreak: 'suit' };
const MELAR_RULES: RankingRules = { suitOrder: SUITS, tieBreak: 'melar' };

describe('baralho', () => {
  const deck = buildDeck();

  it('tem 40 cartas distintas', () => {
    expect(deck).toHaveLength(40);
    expect(new Set(deck).size).toBe(40);
  });

  it('não contém 8, 9 nem 10', () => {
    expect(deck.filter((c) => ['8', '9', '1'].includes(c[0]!))).toEqual([]);
  });

  it('tem 10 cartas de cada naipe e 4 de cada valor', () => {
    for (const suit of SUITS) {
      expect(deck.filter((c) => c === cardId(c[0] as Rank, suit)).length).toBe(10);
    }
    for (const rank of RANKS) {
      expect(deck.filter((c) => c[0] === rank).length).toBe(4);
    }
  });
});

describe('hierarquia de valores', () => {
  it('segue 4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3', () => {
    expect([...RANKS]).toEqual(['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']);
    for (let i = 1; i < RANKS.length; i++) {
      expect(rankIndex(RANKS[i]!)).toBeGreaterThan(rankIndex(RANKS[i - 1]!));
    }
  });
});

describe('hierarquia de naipes', () => {
  it('é ouros < espadas < copas < paus', () => {
    expect(suitIndex('ouros', SUITS)).toBe(0);
    expect(suitIndex('espadas', SUITS)).toBe(1);
    expect(suitIndex('copas', SUITS)).toBe(2);
    expect(suitIndex('paus', SUITS)).toBe(3);
  });
});

describe('manilhaRankFor', () => {
  const table: [Rank, Rank][] = [
    ['4', '5'],
    ['5', '6'],
    ['6', '7'],
    ['7', 'Q'],
    ['Q', 'J'],
    ['J', 'K'],
    ['K', 'A'],
    ['A', '2'],
    ['2', '3'],
    ['3', '4'], // wrap
  ];

  it.each(table)('vira %s → manilha %s', (vira, expected) => {
    expect(manilhaRankFor(cardId(vira, 'ouros'))).toBe(expected);
  });

  it('sem vira não há manilha', () => {
    expect(manilhaRankFor(null)).toBeNull();
  });
});

describe('força das cartas (tieBreak: suit)', () => {
  const deck = buildDeck();

  it('é uma ordem total estrita: nenhuma colisão nas 40 cartas', () => {
    for (const vira of [null, ...deck] as (CardId | null)[]) {
      const manilha = manilhaRankFor(vira);
      const scores = deck.map((c) => strength(c, manilha, SUIT_RULES));
      expect(new Set(scores).size).toBe(40);
    }
  });

  it('qualquer manilha supera qualquer carta comum', () => {
    const manilha: Rank = 'Q'; // vira 7
    const manilhas = deck.filter((c) => isManilha(c, manilha));
    const comuns = deck.filter((c) => !isManilha(c, manilha));
    const menorManilha = Math.min(...manilhas.map((c) => strength(c, manilha, SUIT_RULES)));
    const maiorComum = Math.max(...comuns.map((c) => strength(c, manilha, SUIT_RULES)));
    expect(manilhas).toHaveLength(4);
    expect(menorManilha).toBeGreaterThan(maiorComum);
  });

  it('entre manilhas desempata por naipe: paus > copas > espadas > ouros', () => {
    const manilha: Rank = '5'; // vira 4
    const ordered = sortByStrength(
      [cardId('5', 'copas'), cardId('5', 'ouros'), cardId('5', 'paus'), cardId('5', 'espadas')],
      manilha,
      SUIT_RULES,
    );
    expect(ordered).toEqual([
      cardId('5', 'ouros'),
      cardId('5', 'espadas'),
      cardId('5', 'copas'),
      cardId('5', 'paus'),
    ]);
  });

  it('sem manilha, 3 de paus é a carta mais forte do baralho', () => {
    const ordered = sortByStrength(deck, null, SUIT_RULES);
    expect(ordered[ordered.length - 1]).toBe(cardId('3', 'paus'));
    expect(ordered[0]).toBe(cardId('4', 'ouros'));
  });

  it('cartas de mesmo valor e naipes diferentes nunca empatam', () => {
    expect(strength(cardId('K', 'paus'), null, SUIT_RULES)).toBeGreaterThan(
      strength(cardId('K', 'copas'), null, SUIT_RULES),
    );
  });
});

describe('força das cartas (tieBreak: melar)', () => {
  it('cartas comuns de mesmo valor empatam, independentemente do naipe', () => {
    expect(strength(cardId('K', 'paus'), null, MELAR_RULES)).toBe(
      strength(cardId('K', 'ouros'), null, MELAR_RULES),
    );
  });

  it('manilhas continuam desempatando por naipe', () => {
    const manilha: Rank = '3';
    expect(strength(cardId('3', 'paus'), manilha, MELAR_RULES)).toBeGreaterThan(
      strength(cardId('3', 'copas'), manilha, MELAR_RULES),
    );
  });
});
