/** Resolução de vazas. */

import { strength } from './ranking';
import type { RankingRules } from './ranking';
import type { CardId, Rank, TrickPlay } from './types';

export interface TrickOutcome {
  /** `null` só é possível em `tieBreak: 'melar'`, quando tudo se anula. */
  winnerId: string | null;
  winningCard: CardId | null;
}

/**
 * Leva a vaza a maior carta cuja força aparece uma única vez.
 *
 * Em `tieBreak: 'suit'` toda força é única, então isso é simplesmente o
 * `argmax` e nunca devolve `null`. Em `tieBreak: 'melar'`, cartas comuns de
 * mesmo valor colidem, se anulam, e a busca desce para a próxima força
 * não-anulada — se todas colidirem, a vaza fica sem dono.
 */
export function resolveTrick(
  plays: readonly TrickPlay[],
  manilhaRank: Rank | null,
  rules: RankingRules,
): TrickOutcome {
  if (plays.length === 0) return { winnerId: null, winningCard: null };

  const scored = plays.map((p) => ({ ...p, s: strength(p.card, manilhaRank, rules) }));
  const counts = new Map<number, number>();
  for (const p of scored) counts.set(p.s, (counts.get(p.s) ?? 0) + 1);

  let best: (typeof scored)[number] | null = null;
  for (const p of scored) {
    if (counts.get(p.s) !== 1) continue;
    if (best === null || p.s > best.s) best = p;
  }

  return best === null
    ? { winnerId: null, winningCard: null }
    : { winnerId: best.playerId, winningCard: best.card };
}

/** Quem está levando a vaza no meio do caminho (para heurística dos bots). */
export function currentWinner(
  plays: readonly TrickPlay[],
  manilhaRank: Rank | null,
  rules: RankingRules,
): TrickOutcome {
  return resolveTrick(plays, manilhaRank, rules);
}

/** Se jogar `card` agora passa a liderar a vaza. */
export function wouldWinTrick(
  card: CardId,
  playerId: string,
  plays: readonly TrickPlay[],
  manilhaRank: Rank | null,
  rules: RankingRules,
): boolean {
  const outcome = resolveTrick([...plays, { playerId, card }], manilhaRank, rules);
  return outcome.winnerId === playerId;
}

/**
 * Cartas jogáveis. Fodinha não tem obrigação de seguir naipe (como o Truco),
 * então é a mão inteira — mas o ponto único de decisão fica aqui.
 */
export function legalCards(hand: readonly CardId[]): CardId[] {
  return [...hand];
}
