import { describe, expect, it } from 'vitest';

import { cardId } from '../src/engine/ranking';
import type { RankingRules } from '../src/engine/ranking';
import { resolveTrick, wouldWinTrick } from '../src/engine/trick';
import { SUITS } from '../src/engine/types';
import type { Rank, TrickPlay } from '../src/engine/types';

const SUIT_RULES: RankingRules = { suitOrder: SUITS, tieBreak: 'suit' };
const MELAR_RULES: RankingRules = { suitOrder: SUITS, tieBreak: 'melar' };

const play = (playerId: string, rank: Rank, suit: (typeof SUITS)[number]): TrickPlay => ({
  playerId,
  card: cardId(rank, suit),
});

describe('resolveTrick — tieBreak: suit', () => {
  it('leva a maior carta por valor', () => {
    const out = resolveTrick(
      [play('a', '7', 'paus'), play('b', 'K', 'ouros'), play('c', '4', 'copas')],
      null,
      SUIT_RULES,
    );
    expect(out.winnerId).toBe('b');
  });

  it('com valores iguais, o naipe decide', () => {
    const out = resolveTrick(
      [play('a', 'K', 'espadas'), play('b', 'K', 'paus'), play('c', 'K', 'copas')],
      null,
      SUIT_RULES,
    );
    expect(out.winnerId).toBe('b');
    expect(out.winningCard).toBe(cardId('K', 'paus'));
  });

  it('a manilha mais fraca bate o 3 de paus', () => {
    // vira 4 → manilha 5
    const out = resolveTrick(
      [play('a', '3', 'paus'), play('b', '5', 'ouros')],
      '5',
      SUIT_RULES,
    );
    expect(out.winnerId).toBe('b');
  });

  it('entre manilhas, o naipe decide', () => {
    const out = resolveTrick(
      [play('a', '5', 'copas'), play('b', '5', 'paus'), play('c', '5', 'espadas')],
      '5',
      SUIT_RULES,
    );
    expect(out.winnerId).toBe('b');
  });

  it('em mão sem manilha, 3 de paus leva', () => {
    const out = resolveTrick(
      [play('a', '3', 'copas'), play('b', '3', 'paus'), play('c', '2', 'paus')],
      null,
      SUIT_RULES,
    );
    expect(out.winnerId).toBe('b');
  });

  it('nunca anula: toda vaza tem exatamente um dono', () => {
    const out = resolveTrick(
      [play('a', 'Q', 'ouros'), play('b', 'Q', 'espadas')],
      null,
      SUIT_RULES,
    );
    expect(out.winnerId).not.toBeNull();
  });

  it('sem jogadas, não há vencedor', () => {
    expect(resolveTrick([], null, SUIT_RULES).winnerId).toBeNull();
  });
});

describe('resolveTrick — tieBreak: melar', () => {
  it('as duas mais altas empatadas se anulam e a menor leva', () => {
    const out = resolveTrick(
      [play('a', 'K', 'ouros'), play('b', 'K', 'paus'), play('c', '7', 'copas')],
      null,
      MELAR_RULES,
    );
    expect(out.winnerId).toBe('c');
  });

  it('empates encadeados descem até a maior força não-anulada', () => {
    const out = resolveTrick(
      [
        play('a', 'K', 'ouros'),
        play('b', 'K', 'paus'),
        play('c', 'Q', 'copas'),
        play('d', 'Q', 'espadas'),
        play('e', '7', 'copas'),
      ],
      null,
      MELAR_RULES,
    );
    expect(out.winnerId).toBe('e');
  });

  it('se tudo anula, a vaza fica sem dono', () => {
    const out = resolveTrick(
      [play('a', 'K', 'ouros'), play('b', 'K', 'paus')],
      null,
      MELAR_RULES,
    );
    expect(out.winnerId).toBeNull();
  });

  it('manilhas nunca melam entre si', () => {
    const out = resolveTrick(
      [play('a', '5', 'ouros'), play('b', '5', 'paus')],
      '5',
      MELAR_RULES,
    );
    expect(out.winnerId).toBe('b');
  });
});

describe('wouldWinTrick', () => {
  it('reconhece a carta que passa a liderar', () => {
    const plays = [play('a', 'K', 'ouros')];
    expect(wouldWinTrick(cardId('A', 'ouros'), 'b', plays, null, SUIT_RULES)).toBe(true);
    expect(wouldWinTrick(cardId('7', 'paus'), 'b', plays, null, SUIT_RULES)).toBe(false);
  });
});
