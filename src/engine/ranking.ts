/**
 * Hierarquia das cartas.
 *
 * Existe uma ordem total estrita sobre as 40 cartas quando
 * `tieBreak: 'suit'` (o default), calculada por:
 *
 *     força = (é_manilha ? 10 : índice_valor) * 4 + índice_naipe
 *
 * → intervalo 0..43 sem colisões. Manilha de paus = 43; a carta comum mais
 * forte é 3♣ = 39, que é exatamente o topo nas mãos jogadas sem vira.
 *
 * Em `tieBreak: 'melar'` as cartas comuns ignoram o naipe (força = tier * 4),
 * de forma que cartas de mesmo valor colidem e se anulam na vaza. Manilhas
 * continuam desempatando por naipe — entre manilhas nunca há empate.
 */

import { RANKS, SUITS, SUIT_CODE } from './types';
import type { Card, CardId, GameConfig, Rank, Suit, SuitCode, TieBreak } from './types';

const RANK_INDEX: Record<Rank, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i]),
) as Record<Rank, number>;

const CODE_TO_SUIT: Record<SuitCode, Suit> = Object.fromEntries(
  SUITS.map((s) => [SUIT_CODE[s], s]),
) as Record<SuitCode, Suit>;

export function cardId(rank: Rank, suit: Suit): CardId {
  return `${rank}${SUIT_CODE[suit]}`;
}

export function parseCard(id: CardId): Card {
  const rank = id[0] as Rank;
  const suit = CODE_TO_SUIT[id[1] as SuitCode];
  if (RANK_INDEX[rank] === undefined || suit === undefined) {
    throw new Error(`Carta inválida: ${id}`);
  }
  return { rank, suit, id };
}

export function rankOf(id: CardId): Rank {
  return id[0] as Rank;
}

export function suitOf(id: CardId): Suit {
  return CODE_TO_SUIT[id[1] as SuitCode]!;
}

export function rankIndex(rank: Rank): number {
  const i = RANK_INDEX[rank];
  if (i === undefined) throw new Error(`Valor inválido: ${rank}`);
  return i;
}

/** Força do naipe segundo a ordem configurada (fraca → forte). */
export function suitIndex(suit: Suit, suitOrder: readonly Suit[]): number {
  const i = suitOrder.indexOf(suit);
  if (i < 0) throw new Error(`Naipe fora da ordem configurada: ${suit}`);
  return i;
}

/**
 * Valor da manilha para um dado vira: o imediatamente superior na sequência,
 * com wrap (3 → 4). `null` quando a mão é jogada sem vira.
 */
export function manilhaRankFor(vira: CardId | null): Rank | null {
  if (vira === null) return null;
  return RANKS[(rankIndex(rankOf(vira)) + 1) % RANKS.length]!;
}

export function isManilha(id: CardId, manilhaRank: Rank | null): boolean {
  return manilhaRank !== null && rankOf(id) === manilhaRank;
}

export interface RankingRules {
  suitOrder: readonly Suit[];
  tieBreak: TieBreak;
}

export function rulesFrom(config: GameConfig): RankingRules {
  return { suitOrder: config.suitOrder, tieBreak: config.tieBreak };
}

/** Força comparável de uma carta na mão corrente. Ver o comentário do módulo. */
export function strength(id: CardId, manilhaRank: Rank | null, rules: RankingRules): number {
  const manilha = isManilha(id, manilhaRank);
  const tier = manilha ? RANKS.length : rankIndex(rankOf(id));
  const useSuit = manilha || rules.tieBreak === 'suit';
  return tier * SUITS.length + (useSuit ? suitIndex(suitOf(id), rules.suitOrder) : 0);
}

/** Negativo se `a` é mais fraca, positivo se mais forte, zero se empatam. */
export function compareCards(
  a: CardId,
  b: CardId,
  manilhaRank: Rank | null,
  rules: RankingRules,
): number {
  return strength(a, manilhaRank, rules) - strength(b, manilhaRank, rules);
}

/** Ordena uma cópia da mão da mais fraca para a mais forte. */
export function sortByStrength(
  cards: readonly CardId[],
  manilhaRank: Rank | null,
  rules: RankingRules,
): CardId[] {
  return [...cards].sort((a, b) => compareCards(a, b, manilhaRank, rules));
}
