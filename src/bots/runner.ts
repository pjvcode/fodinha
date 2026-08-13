/**
 * Driver headless: toca uma partida inteira sem UI.
 *
 * Usado pelo golden test e pela simulação em massa. A UI terá o seu próprio
 * agendador (com pausas para animação), mas dispara exatamente as mesmas ações.
 */

import { legalBids } from '../engine/bidding';
import { createMatch, reduce } from '../engine/reducer';
import { playerView } from '../engine/selectors';
import { legalCards } from '../engine/trick';
import type { Action, GameConfig, GameEvent, MatchState } from '../engine/types';
import type { BotMap } from './types';

/**
 * A próxima ação a despachar, ou `null` quando o jogo espera por um humano
 * (ou já acabou). As fases de transição são avançadas automaticamente.
 */
export function nextAutoAction(state: MatchState, bots: BotMap): Action | null {
  switch (state.phase) {
    case 'setup':
      return { t: 'START_MATCH' };
    case 'dealing':
      return { t: 'DEAL' };
    case 'trickResolved':
      return { t: 'RESOLVE_TRICK' };
    case 'handScored':
      return { t: 'NEXT_HAND' };
    case 'matchOver':
      return null;

    case 'bidding': {
      if (state.bidTurnIndex === null) return null;
      const player = state.players[state.bidTurnIndex]!;
      const bot = bots[player.id];
      if (!bot) return null;
      const view = playerView(state, player.id);
      const legal = legalBids(state);
      return { t: 'BID', playerId: player.id, bid: bot.chooseBid(view, legal) };
    }

    case 'playing': {
      if (state.turnIndex === null) return null;
      const player = state.players[state.turnIndex]!;
      const bot = bots[player.id];
      if (!bot) return null;

      const view = playerView(state, player.id);
      const card = bot.chooseCard(view, legalCards(player.hand));
      return { t: 'PLAY', playerId: player.id, card };
    }

    default:
      return null;
  }
}

export interface RunOptions {
  onEvent?: (event: GameEvent, state: MatchState) => void;
  onStep?: (state: MatchState, action: Action) => void;
  /** Trava de segurança contra loop infinito por bug de transição. */
  maxSteps?: number;
}

export function runMatch(config: GameConfig, bots: BotMap, opts: RunOptions = {}): MatchState {
  let state = createMatch(config);
  const maxSteps = opts.maxSteps ?? 200_000;

  for (let step = 0; step < maxSteps; step++) {
    const action = nextAutoAction(state, bots);
    if (action === null) break;

    const result = reduce(state, action);
    for (const event of result.events) {
      if (event.t === 'INVALID_ACTION') {
        throw new Error(`Ação inválida despachada pelo runner: ${event.reason}`);
      }
      opts.onEvent?.(event, result.state);
    }
    state = result.state;
    opts.onStep?.(state, action);

    if (state.phase === 'matchOver') break;
  }

  if (state.phase !== 'matchOver') {
    throw new Error(`Partida não terminou (fase ${state.phase}) — possível transição travada`);
  }
  return state;
}
