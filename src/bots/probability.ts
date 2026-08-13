/**
 * Estimativas probabilísticas para os bots.
 *
 * Tudo aqui é calculado só a partir da `PlayerView` — nenhum bot enxerga carta
 * que um humano no mesmo lugar não enxergaria.
 */

import { buildDeck } from '../engine/deck';
import { rulesFrom, strength } from '../engine/ranking';
import type { PlayerView } from '../engine/selectors';
import type { CardId } from '../engine/types';

/**
 * Peso da correção aplicada às cartas que não são imbatíveis.
 *
 * Calibrado por varredura em `npm run sim -- --bots medium --players 4`,
 * minimizando o erro médio por mão: 0.92 em SLACK 0.2, mínimo de 0.44 em 0.84,
 * subindo de novo a partir de 0.9. O ótimo deixa um viés residual de −0.16
 * vazas por mão, ou seja, levemente conservador — errar para baixo custa menos
 * neste jogo do que errar para cima, porque só uma vaza a mais já vira ponto.
 */
export const SLACK = 0.84;

/** Cartas que o jogador ainda não viu: nem na mão, nem no vira, nem na mesa. */
export function unseenCards(view: PlayerView): CardId[] {
  const seen = new Set<CardId>();
  for (const c of view.me.hand) seen.add(c);
  if (view.vira !== null) seen.add(view.vira);
  for (const c of view.playedCards) seen.add(c);
  return buildDeck().filter((c) => !seen.has(c));
}

export function activeOpponentCount(view: PlayerView): number {
  return view.opponents.filter((o) => !o.eliminated).length;
}

/**
 * P(nenhuma das `stronger` cartas superiores esteja em mão adversária), quando
 * `slots` cartas são sorteadas sem reposição de um universo de `universe`.
 *
 *   C(U-S, O) / C(U, O) = produto de (U-O-i) / (U-i), para i = 0..S-1
 *
 * A forma de produto evita fatoriais gigantes e satura em 0 naturalmente
 * quando há mais cartas superiores do que espaço fora das mãos adversárias.
 */
export function pNoneInOpponentHands(universe: number, stronger: number, slots: number): number {
  if (stronger <= 0) return 1;
  if (slots <= 0) return 1;
  if (slots >= universe) return 0;

  let p = 1;
  for (let i = 0; i < stronger; i++) {
    const numerator = universe - slots - i;
    if (numerator <= 0) return 0;
    p *= numerator / (universe - i);
  }
  return p;
}

/**
 * Probabilidade estimada de uma carta levar pelo menos uma vaza na mão.
 *
 * Base: a carta é imbatível (ninguém tem carta superior). Em cima disso, uma
 * correção modesta para o caso em que existe carta superior mas ela não é
 * jogada contra esta — sem ela, todas as cartas médias valeriam zero e os bots
 * palpitariam sistematicamente para baixo.
 */
export function pCardWinsTrick(card: CardId, view: PlayerView): number {
  const rules = rulesFrom(view.config);
  const unseen = unseenCards(view);
  const universe = unseen.length;
  if (universe === 0) return 1;

  const mine = strength(card, view.manilhaRank, rules);
  const stronger = unseen.filter((c) => strength(c, view.manilhaRank, rules) > mine).length;
  const weaker = universe - stronger;

  const opponents = activeOpponentCount(view);
  const slots = view.handSize * opponents;

  const certain = pNoneInOpponentHands(universe, stronger, slots);
  // Chance de a vaza cair na mão mesmo com carta superior viva: aproxima por
  // "todos os adversários jogaram carta mais fraca nesta vaza".
  const lucky = opponents > 0 ? Math.pow(weaker / universe, opponents) : 1;

  return Math.min(1, certain + (1 - certain) * SLACK * lucky);
}

/** Soma das probabilidades por carta — o palpite bruto, antes de arredondar. */
export function expectedTricks(view: PlayerView): number {
  return view.me.hand.reduce((sum, card) => sum + pCardWinsTrick(card, view), 0);
}
