/** Construção, embaralhamento e distribuição do baralho de 40 cartas. */

import { nextInt } from './rng';
import { cardId } from './ranking';
import { DECK_SIZE, RANKS, SUITS } from './types';
import type { CardId } from './types';

/** As 40 cartas em ordem canônica (determinística, independente do PRNG). */
export function buildDeck(): CardId[] {
  const deck: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(cardId(rank, suit));
    }
  }
  return deck;
}

/** Fisher-Yates puro: devolve um baralho novo e o estado avançado do PRNG. */
export function shuffle(deck: readonly CardId[], rng: number): { deck: CardId[]; rng: number } {
  const out = [...deck];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const draw = nextInt(state, i + 1);
    state = draw.state;
    const j = draw.value;
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return { deck: out, rng: state };
}

export interface DealResult {
  hands: CardId[][];
  /** `null` quando não sobrou carta para virar — a mão é jogada sem manilha. */
  vira: CardId | null;
  /** Cartas que sobraram no monte depois do vira. */
  stock: CardId[];
}

/**
 * Distribui `handSize` cartas para cada um dos `numPlayers` jogadores e vira a
 * carta seguinte, se ainda houver alguma. Quando `handSize * numPlayers === 40`
 * o baralho acaba exatamente na distribuição: não há vira nem manilha.
 */
export function deal(deck: readonly CardId[], numPlayers: number, handSize: number): DealResult {
  const needed = numPlayers * handSize;
  if (needed > DECK_SIZE) {
    throw new Error(`Distribuição impossível: ${numPlayers} × ${handSize} > ${DECK_SIZE}`);
  }

  const hands: CardId[][] = Array.from({ length: numPlayers }, () => []);
  let cursor = 0;
  // Uma carta por vez, dando a volta na mesa — como se distribui de verdade.
  for (let round = 0; round < handSize; round++) {
    for (let p = 0; p < numPlayers; p++) {
      hands[p]!.push(deck[cursor++]!);
    }
  }

  const vira = cursor < deck.length ? deck[cursor++]! : null;
  return { hands, vira, stock: deck.slice(cursor) };
}
