/**
 * Bots heurísticos.
 *
 * Palpite: soma das probabilidades por carta, arredondada — a mesma ideia do
 * bot comercial de Spades da AI Factory. Jogada: política de "vitória barata"
 * guiada pela distância entre o palpite e as vazas já feitas.
 *
 * Nenhum dos dois olha o `MatchState`: só a `PlayerView` redigida.
 */

import { isManilha, rankOf, rulesFrom, sortByStrength, strength } from '../engine/ranking';
import type { PlayerView } from '../engine/selectors';
import { wouldWinTrick } from '../engine/trick';
import type { CardId } from '../engine/types';
import { expectedTricks } from './probability';
import type { Bot } from './types';

// ---------------------------------------------------------------------------
// Palpite
// ---------------------------------------------------------------------------

/** Escolhe o valor legal mais próximo do alvo; empate desce (mais seguro). */
function nearestLegal(target: number, legal: number[]): number {
  let best = legal[0]!;
  let bestDist = Infinity;
  for (const b of legal) {
    const dist = Math.abs(b - target);
    if (dist < bestDist || (dist === bestDist && b < best)) {
      best = b;
      bestDist = dist;
    }
  }
  return best;
}

/** Baseline por buckets, sem probabilidade nenhuma. */
function bucketEstimate(view: PlayerView): number {
  let total = 0;
  for (const card of view.me.hand) {
    if (isManilha(card, view.manilhaRank)) total += 1;
    else if (['A', '2', '3'].includes(rankOf(card))) total += 0.6;
    else if (['K', 'J', 'Q'].includes(rankOf(card))) total += 0.3;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Jogada
// ---------------------------------------------------------------------------

interface PlayContext {
  /** Vazas que ainda faltam para bater o palpite. Pode ser negativo. */
  need: number;
  /** Vazas restantes na mão, incluindo a que está em andamento. */
  remaining: number;
  /** Mão ordenada da mais fraca para a mais forte. */
  ordered: CardId[];
  leading: boolean;
}

function playContext(view: PlayerView, legal: CardId[]): PlayContext {
  const rules = rulesFrom(view.config);
  return {
    need: (view.me.bid ?? 0) - view.me.tricksWon,
    remaining: view.handSize - view.completedTricks.length,
    ordered: sortByStrength(legal, view.manilhaRank, rules),
    leading: (view.trick?.plays.length ?? 0) === 0,
  };
}

function winners(view: PlayerView, legal: CardId[]): Set<CardId> {
  const rules = rulesFrom(view.config);
  const plays = view.trick?.plays ?? [];
  const out = new Set<CardId>();
  for (const card of legal) {
    if (wouldWinTrick(card, view.me.id, plays, view.manilhaRank, rules)) out.add(card);
  }
  return out;
}

function chooseCardMedium(view: PlayerView, legal: CardId[]): CardId {
  const { need, remaining, ordered, leading } = playContext(view, legal);
  const weakest = ordered[0]!;
  const strongest = ordered[ordered.length - 1]!;

  // Já bateu (ou passou) o palpite: descartar sem levar mais nenhuma.
  if (need <= 0) {
    if (leading) return weakest;
    const vencedoras = winners(view, legal);
    const perdedoras = ordered.filter((c) => !vencedoras.has(c));
    // Queima a carta alta mais perigosa enquanto dá para perder de propósito.
    return perdedoras.length > 0 ? perdedoras[perdedoras.length - 1]! : weakest;
  }

  // Precisa de tudo o que sobrou: não dá para economizar carta.
  if (need >= remaining) return strongest;

  // Precisa de algumas: puxa forte quando lidera, ganha barato quando segue.
  if (leading) return strongest;

  const vencedoras = winners(view, legal);
  const maisBarata = ordered.find((c) => vencedoras.has(c));
  return maisBarata ?? weakest;
}

function chooseCardEasy(view: PlayerView, legal: CardId[]): CardId {
  const { need, ordered } = playContext(view, legal);
  return need > 0 ? ordered[ordered.length - 1]! : ordered[0]!;
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

export function createEasyBot(name = 'easy'): Bot {
  return {
    name,
    chooseBid(view, legal) {
      return nearestLegal(Math.round(bucketEstimate(view)), legal);
    },
    chooseCard: chooseCardEasy,
  };
}

export function createMediumBot(name = 'medium'): Bot {
  return {
    name,
    chooseBid(view, legal) {
      return nearestLegal(Math.round(expectedTricks(view)), legal);
    },
    chooseCard: chooseCardMedium,
  };
}

/**
 * Reservado para o ISMCTS (Fase 4): determinização das mãos ocultas a partir
 * das não-vistas e rollouts pelo próprio `reduce()`. Até lá, joga como o médio
 * — a interface `Bot` não muda quando ele chegar.
 */
export function createHardBot(name = 'hard'): Bot {
  return { ...createMediumBot(name), name };
}

/** Exposto para os testes e para a calibração pela simulação. */
export const heuristics = {
  bucketEstimate,
  nearestLegal,
  chooseCardMedium,
  chooseCardEasy,
};

export function strengthOf(card: CardId, view: PlayerView): number {
  return strength(card, view.manilhaRank, rulesFrom(view.config));
}
