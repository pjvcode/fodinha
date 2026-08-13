/**
 * Palpites e a restrição "screw the dealer".
 *
 * A soma dos palpites de uma mão não pode igualar o número de cartas em mão.
 * A restrição recai só sobre o último a palpitar — o distribuidor — e só quando
 * o valor proibido cai dentro de [0, handSize]; se cair fora, o distribuidor
 * escolhe livremente.
 */

import type { MatchState } from './types';

export interface BidContext {
  handSize: number;
  /** Soma dos palpites já feitos nesta mão. */
  bidsSoFar: number;
  /** Se quem está palpitando agora é o último da mão. */
  isLastBidder: boolean;
}

/** O valor que o último palpitante NÃO pode escolher, ou `null` se não há. */
export function forbiddenBidFor(ctx: BidContext): number | null {
  if (!ctx.isLastBidder) return null;
  const forbidden = ctx.handSize - ctx.bidsSoFar;
  return forbidden >= 0 && forbidden <= ctx.handSize ? forbidden : null;
}

export function legalBidsFor(ctx: BidContext): number[] {
  const forbidden = forbiddenBidFor(ctx);
  const bids: number[] = [];
  for (let b = 0; b <= ctx.handSize; b++) {
    if (b !== forbidden) bids.push(b);
  }
  return bids;
}

export function bidContext(state: MatchState): BidContext | null {
  if (state.phase !== 'bidding' || state.bidTurnIndex === null) return null;

  const active = state.players.filter((p) => !p.eliminated);
  const bidsSoFar = active.reduce((sum, p) => sum + (p.bid ?? 0), 0);
  const pending = active.filter((p) => p.bid === null).length;

  return {
    handSize: state.handSize,
    bidsSoFar,
    isLastBidder: pending === 1,
  };
}

/** Palpites legais para quem está na vez. Vazio se não é fase de palpite. */
export function legalBids(state: MatchState): number[] {
  const ctx = bidContext(state);
  return ctx === null ? [] : legalBidsFor(ctx);
}

export function forbiddenBid(state: MatchState): number | null {
  const ctx = bidContext(state);
  return ctx === null ? null : forbiddenBidFor(ctx);
}
