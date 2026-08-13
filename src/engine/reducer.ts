/**
 * O reducer: `(state, action) => { state, events }`.
 *
 * Função pura. Sem React, sem `Math.random`, sem `Date.now`. Ações inválidas
 * nunca lançam exceção — devolvem o estado inalterado mais um evento
 * `INVALID_ACTION`, para que um transporte de rede seja resiliente a mensagens
 * fora de ordem ou duplicadas.
 */

import { legalBids } from './bidding';
import { deal, buildDeck, shuffle } from './deck';
import { clampSequenceTail, handSizeSequence, maxHandSize } from './progression';
import { manilhaRankFor, rulesFrom } from './ranking';
import { activePlayers, determineWinners, handPenalty, isMatchOver } from './scoring';
import { resolveTrick } from './trick';
import { SUITS } from './types';
import type {
  Action,
  CardId,
  GameConfig,
  GameEvent,
  HandResult,
  HandResultRow,
  MatchState,
  PlayerState,
  ReduceResult,
} from './types';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export function defaultPlayers(numPlayers = 4): GameConfig['players'] {
  return Array.from({ length: numPlayers }, (_, i) => ({
    name: i === 0 ? 'Você' : `Bot ${i}`,
    isBot: i !== 0,
    botLevel: i === 0 ? undefined : ('medium' as const),
  }));
}

export function defaultConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    players: defaultPlayers(),
    suitOrder: SUITS, // ouros < espadas < copas < paus
    tieBreak: 'suit',
    maxCardsCap: null,
    progression: 'up-down',
    repeatMaxHand: false,
    scoringMode: 'penalty',
    startingLives: 5,
    seed: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    handSizes: [...state.handSizes],
    stock: [...state.stock],
    trick: state.trick ? { ...state.trick, plays: [...state.trick.plays] } : null,
    completedTricks: [...state.completedTricks],
    history: [...state.history],
    winnerIds: [...state.winnerIds],
  };
}

function reject(state: MatchState, action: Action, reason: string): ReduceResult {
  return { state, events: [{ t: 'INVALID_ACTION', action, reason }] };
}

function indexOfPlayer(state: MatchState, playerId: string): number {
  return state.players.findIndex((p) => p.id === playerId);
}

/** Próximo jogador ativo em sentido de mesa, estritamente depois de `from`. */
function nextActiveIndex(state: MatchState, from: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (!state.players[i]!.eliminated) return i;
  }
  throw new Error('Nenhum jogador ativo na mesa');
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export function createMatch(config: GameConfig): MatchState {
  const numPlayers = config.players.length;
  const players: PlayerState[] = config.players.map((p, i) => ({
    id: `p${i}`,
    name: p.name,
    isBot: p.isBot,
    botLevel: p.botLevel,
    hand: [],
    bid: null,
    tricksWon: 0,
    penalty: 0,
    lives: config.startingLives,
    eliminated: false,
  }));

  return {
    phase: 'setup',
    config,
    rng: config.seed >>> 0,
    players,
    handSizes: handSizeSequence(numPlayers, config),
    handIndex: -1,
    handSize: 0,
    // O último assento distribui a primeira mão, então o jogador 0 (o humano)
    // é o primeiro a palpitar e a puxar.
    dealerIndex: numPlayers - 1,
    stock: [],
    vira: null,
    manilhaRank: null,
    bidTurnIndex: null,
    turnIndex: null,
    trick: null,
    completedTricks: [],
    lastTrick: null,
    history: [],
    winnerIds: [],
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: MatchState, action: Action): ReduceResult {
  switch (action.t) {
    case 'START_MATCH':
      return startMatch(state, action);
    case 'DEAL':
      return dealHand(state, action);
    case 'BID':
      return makeBid(state, action);
    case 'PLAY':
      return playCard(state, action);
    case 'RESOLVE_TRICK':
      return advancePastTrick(state, action);
    case 'NEXT_HAND':
      return nextHand(state, action);
    default:
      return reject(state, action, 'Ação desconhecida');
  }
}

function startMatch(state: MatchState, action: Action): ReduceResult {
  if (state.phase !== 'setup') return reject(state, action, 'A partida já começou');

  const s = cloneState(state);
  s.handIndex = 0;
  s.handSize = s.handSizes[0]!;
  s.phase = 'dealing';
  return { state: s, events: [] };
}

function dealHand(state: MatchState, action: Action): ReduceResult {
  if (state.phase !== 'dealing') return reject(state, action, 'Não é hora de distribuir');

  const s = cloneState(state);
  const active = s.players.filter((p) => !p.eliminated);

  // Rede de segurança: o teto do baralho manda, mesmo que a sequência não tenha
  // sido reajustada depois de uma eliminação.
  s.handSize = Math.min(s.handSize, maxHandSize(active.length, s.config));
  s.handSizes[s.handIndex] = s.handSize;

  const shuffled = shuffle(buildDeck(), s.rng);
  s.rng = shuffled.rng;

  const result = deal(shuffled.deck, active.length, s.handSize);
  active.forEach((p, i) => {
    p.hand = result.hands[i]!;
    p.bid = null;
    p.tricksWon = 0;
  });
  for (const p of s.players) {
    if (p.eliminated) {
      p.hand = [];
      p.bid = null;
      p.tricksWon = 0;
    }
  }

  s.stock = result.stock;
  s.vira = result.vira;
  s.manilhaRank = manilhaRankFor(result.vira);
  s.completedTricks = [];
  s.lastTrick = null;
  s.trick = null;
  s.turnIndex = null;
  s.bidTurnIndex = nextActiveIndex(s, s.dealerIndex);
  s.phase = 'bidding';

  return {
    state: s,
    events: [
      {
        t: 'HAND_DEALT',
        handIndex: s.handIndex,
        handSize: s.handSize,
        vira: s.vira,
        manilhaRank: s.manilhaRank,
      },
    ],
  };
}

function makeBid(state: MatchState, action: Extract<Action, { t: 'BID' }>): ReduceResult {
  if (state.phase !== 'bidding') return reject(state, action, 'Não é fase de palpite');

  const idx = indexOfPlayer(state, action.playerId);
  if (idx < 0) return reject(state, action, 'Jogador inexistente');
  if (idx !== state.bidTurnIndex) return reject(state, action, 'Não é a vez desse jogador');

  const allowed = legalBids(state);
  if (!allowed.includes(action.bid)) {
    return reject(state, action, `Palpite ilegal: ${action.bid} (legais: ${allowed.join(', ')})`);
  }

  const s = cloneState(state);
  s.players[idx]!.bid = action.bid;
  const events: GameEvent[] = [{ t: 'BID_MADE', playerId: action.playerId, bid: action.bid }];

  const active = activePlayers(s);
  const pending = active.filter((p) => p.bid === null);

  if (pending.length > 0) {
    s.bidTurnIndex = nextActiveIndex(s, idx);
  } else {
    s.bidTurnIndex = null;
    const leaderIndex = nextActiveIndex(s, s.dealerIndex);
    s.turnIndex = leaderIndex;
    s.trick = { leaderId: s.players[leaderIndex]!.id, plays: [] };
    s.phase = 'playing';
    events.push({
      t: 'BIDDING_COMPLETE',
      total: active.reduce((sum, p) => sum + (p.bid ?? 0), 0),
      handSize: s.handSize,
    });
  }

  return { state: s, events };
}

function playCard(state: MatchState, action: Extract<Action, { t: 'PLAY' }>): ReduceResult {
  if (state.phase !== 'playing' || state.trick === null) {
    return reject(state, action, 'Não é fase de jogar carta');
  }

  const idx = indexOfPlayer(state, action.playerId);
  if (idx < 0) return reject(state, action, 'Jogador inexistente');
  if (idx !== state.turnIndex) return reject(state, action, 'Não é a vez desse jogador');
  if (!state.players[idx]!.hand.includes(action.card)) {
    return reject(state, action, `Carta ${action.card} não está na mão do jogador`);
  }

  const s = cloneState(state);
  const player = s.players[idx]!;
  player.hand = player.hand.filter((c: CardId) => c !== action.card);
  s.trick!.plays.push({ playerId: action.playerId, card: action.card });

  const events: GameEvent[] = [{ t: 'CARD_PLAYED', playerId: action.playerId, card: action.card }];
  const active = activePlayers(s);

  if (s.trick!.plays.length < active.length) {
    s.turnIndex = nextActiveIndex(s, idx);
    return { state: s, events };
  }

  // Última carta da vaza: resolve imediatamente e pausa em `trickResolved` para
  // a UI mostrar quem levou.
  const outcome = resolveTrick(s.trick!.plays, s.manilhaRank, rulesFrom(s.config));
  const resolved = { ...s.trick!, winnerId: outcome.winnerId };
  s.completedTricks.push(resolved);
  s.lastTrick = resolved;
  s.trick = null;
  s.turnIndex = null;
  s.phase = 'trickResolved';

  if (outcome.winnerId !== null) {
    s.players[indexOfPlayer(s, outcome.winnerId)]!.tricksWon += 1;
    events.push({ t: 'TRICK_WON', playerId: outcome.winnerId, card: outcome.winningCard! });
  } else {
    events.push({ t: 'TRICK_ANNULLED', leaderId: resolved.leaderId });
  }

  return { state: s, events };
}

function advancePastTrick(state: MatchState, action: Action): ReduceResult {
  if (state.phase !== 'trickResolved' || state.lastTrick === null) {
    return reject(state, action, 'Não há vaza resolvida para avançar');
  }

  const s = cloneState(state);

  if (s.completedTricks.length < s.handSize) {
    // Puxa quem levou; se a vaza foi anulada, quem já era o líder puxa de novo.
    const nextLeaderId = s.lastTrick!.winnerId ?? s.lastTrick!.leaderId;
    const leaderIndex = indexOfPlayer(s, nextLeaderId);
    s.turnIndex = leaderIndex;
    s.trick = { leaderId: nextLeaderId, plays: [] };
    s.lastTrick = null;
    s.phase = 'playing';
    return { state: s, events: [] };
  }

  return scoreHand(s);
}

function scoreHand(s: MatchState): ReduceResult {
  const events: GameEvent[] = [];
  const elimination = s.config.scoringMode === 'elimination';
  const rows: HandResultRow[] = [];
  const newlyEliminated: string[] = [];

  for (const p of s.players) {
    if (p.eliminated || p.bid === null) continue;

    const penalty = handPenalty(p.bid, p.tricksWon);
    p.penalty += penalty;
    if (elimination) {
      p.lives -= penalty;
      if (p.lives <= 0) {
        p.eliminated = true;
        newlyEliminated.push(p.id);
      }
    }

    // O palpite e as vazas continuam no estado até a próxima distribuição:
    // `handScored` é o retrato da mão que acabou, e quem foi eliminado nela
    // participou dela. Quem limpa é o `DEAL` da mão seguinte.
    rows.push({
      playerId: p.id,
      bid: p.bid,
      tricksWon: p.tricksWon,
      penalty,
      totalPenalty: p.penalty,
      lives: p.lives,
      eliminated: p.eliminated,
    });
  }

  const result: HandResult = {
    handIndex: s.handIndex,
    handSize: s.handSize,
    vira: s.vira,
    manilhaRank: s.manilhaRank,
    rows,
  };
  s.history.push(result);
  events.push({ t: 'HAND_SCORED', result });
  for (const id of newlyEliminated) events.push({ t: 'PLAYER_ELIMINATED', playerId: id });

  s.phase = 'handScored';
  return { state: s, events };
}

function nextHand(state: MatchState, action: Action): ReduceResult {
  if (state.phase !== 'handScored') return reject(state, action, 'A mão ainda não foi pontuada');

  const s = cloneState(state);

  if (isMatchOver(s)) {
    s.phase = 'matchOver';
    s.winnerIds = determineWinners(s);
    return { state: s, events: [{ t: 'MATCH_OVER', winnerIds: s.winnerIds }] };
  }

  s.handIndex += 1;
  s.dealerIndex = nextActiveIndex(s, s.dealerIndex);

  // Eliminações mudam N, e com N muda o teto do baralho.
  const newMax = maxHandSize(activePlayers(s).length, s.config);
  s.handSizes = clampSequenceTail(s.handSizes, s.handIndex - 1, newMax);
  s.handSize = s.handSizes[s.handIndex]!;

  s.vira = null;
  s.manilhaRank = null;
  s.lastTrick = null;
  s.completedTricks = [];
  s.phase = 'dealing';

  return { state: s, events: [] };
}
