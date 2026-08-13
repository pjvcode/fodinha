/**
 * Redação de informação oculta.
 *
 * Bots e telas consomem exclusivamente a `PlayerView` — nunca o `MatchState`.
 * É isso que faz o multiplayer online ser seguro depois sem reescrever regra
 * nenhuma: o host manda a view redigida, e ninguém pode ver o que não deve.
 *
 * A regra é uma só e vale para toda mão, inclusive a de 1 carta: cada jogador
 * vê a própria mão e nunca a de ninguém.
 */

import { forbiddenBid, legalBids } from './bidding';
import { legalCards } from './trick';
import type {
  CardId,
  GameConfig,
  HandResult,
  MatchState,
  Phase,
  Rank,
  ResolvedTrick,
  TrickState,
} from './types';

export interface SelfView {
  id: string;
  name: string;
  seat: number;
  bid: number | null;
  tricksWon: number;
  penalty: number;
  lives: number;
  eliminated: boolean;
  handCount: number;
  hand: CardId[];
}

export interface OpponentView {
  id: string;
  name: string;
  isBot: boolean;
  seat: number;
  bid: number | null;
  tricksWon: number;
  penalty: number;
  lives: number;
  eliminated: boolean;
  /** Quantas cartas ele tem. As cartas em si nunca saem daqui. */
  handCount: number;
}

export interface PlayerView {
  config: GameConfig;
  phase: Phase;
  handIndex: number;
  totalHands: number;
  handSize: number;
  vira: CardId | null;
  manilhaRank: Rank | null;
  me: SelfView;
  /** Adversários em ordem de assento a partir de mim. */
  opponents: OpponentView[];
  dealerId: string;
  currentBidderId: string | null;
  currentTurnId: string | null;
  trick: TrickState | null;
  lastTrick: ResolvedTrick | null;
  completedTricks: ResolvedTrick[];
  /** Todas as cartas já jogadas nesta mão, incluindo a vaza em andamento. */
  playedCards: CardId[];
  legalBids: number[];
  forbiddenBid: number | null;
  legalCards: CardId[];
  history: HandResult[];
  winnerIds: string[];
}

export function playedCardsThisHand(state: MatchState): CardId[] {
  const out: CardId[] = [];
  for (const t of state.completedTricks) for (const p of t.plays) out.push(p.card);
  if (state.trick) for (const p of state.trick.plays) out.push(p.card);
  return out;
}

export function playerView(state: MatchState, playerId: string): PlayerView {
  const seat = state.players.findIndex((p) => p.id === playerId);
  if (seat < 0) throw new Error(`Jogador inexistente: ${playerId}`);

  const me = state.players[seat]!;
  const n = state.players.length;

  const opponents: OpponentView[] = [];
  for (let step = 1; step < n; step++) {
    const p = state.players[(seat + step) % n]!;
    opponents.push({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      seat: (seat + step) % n,
      bid: p.bid,
      tricksWon: p.tricksWon,
      penalty: p.penalty,
      lives: p.lives,
      eliminated: p.eliminated,
      handCount: p.hand.length,
    });
  }

  const myTurnToBid = state.phase === 'bidding' && state.bidTurnIndex === seat;
  const myTurnToPlay = state.phase === 'playing' && state.turnIndex === seat;

  return {
    config: state.config,
    phase: state.phase,
    handIndex: state.handIndex,
    totalHands: state.handSizes.length,
    handSize: state.handSize,
    vira: state.vira,
    manilhaRank: state.manilhaRank,
    me: {
      id: me.id,
      name: me.name,
      seat,
      bid: me.bid,
      tricksWon: me.tricksWon,
      penalty: me.penalty,
      lives: me.lives,
      eliminated: me.eliminated,
      handCount: me.hand.length,
      hand: [...me.hand],
    },
    opponents,
    dealerId: state.players[state.dealerIndex]!.id,
    currentBidderId:
      state.bidTurnIndex === null ? null : state.players[state.bidTurnIndex]!.id,
    currentTurnId: state.turnIndex === null ? null : state.players[state.turnIndex]!.id,
    trick: state.trick ? { ...state.trick, plays: [...state.trick.plays] } : null,
    lastTrick: state.lastTrick,
    completedTricks: state.completedTricks,
    playedCards: playedCardsThisHand(state),
    legalBids: myTurnToBid ? legalBids(state) : [],
    forbiddenBid: myTurnToBid ? forbiddenBid(state) : null,
    legalCards: myTurnToPlay ? legalCards(me.hand) : [],
    history: state.history,
    winnerIds: state.winnerIds,
  };
}
