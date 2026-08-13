/**
 * Host local: a própria aba mantém o `MatchState` autoritativo, roda os bots e
 * publica para a UI apenas a `PlayerView` do jogador local.
 *
 * A separação não é decorativa — é ela que faz o multiplayer online da Fase 4
 * ser um plugue: um `PeerJSTransport` mantém o mesmo estado no host e manda a
 * view redigida de cada peer pela rede, sem que a UI perceba a diferença.
 */

import { nextAutoAction } from '../bots/runner';
import type { BotMap } from '../bots/types';
import { createMatch, reduce } from '../engine/reducer';
import { playerView } from '../engine/selectors';
import type { PlayerView } from '../engine/selectors';
import type { Action, CardId, GameConfig, GameEvent, MatchState } from '../engine/types';
import { DEFAULT_TIMINGS } from './types';
import type { ClientAction, LoggedEvent, Timings, Transport } from './types';

export interface LocalTransportOptions {
  config: GameConfig;
  bots: BotMap;
  localPlayerId?: string;
  timings?: Partial<Timings>;
}

export function createLocalTransport(options: LocalTransportOptions): Transport {
  const localPlayerId = options.localPlayerId ?? 'p0';
  const timings: Timings = { ...DEFAULT_TIMINGS, ...options.timings };
  const listeners = new Set<() => void>();

  let state: MatchState = createMatch(options.config);
  let view: PlayerView = playerView(state, localPlayerId);
  let lastEvents: GameEvent[] = [];
  let eventLog: LoggedEvent[] = [];
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  /** Quantos eventos o log guarda. O suficiente para a mão inteira caber. */
  const LOG_LIMIT = 120;

  /**
   * A carta que o jogador local é obrigado a jogar, quando não há escolha.
   *
   * Cobre os dois casos: a última carta de qualquer mão e a rodada "na testa",
   * em que ele tem uma carta só e nem a enxerga. Pedir um clique para uma
   * jogada que só tem um resultado possível é atrito à toa.
   */
  function jogadaForcada(): CardId | null {
    if (state.phase !== 'playing' || state.turnIndex === null) return null;
    const jogador = state.players[state.turnIndex]!;
    if (jogador.id !== localPlayerId) return null;
    return jogador.hand.length === 1 ? jogador.hand[0]! : null;
  }

  /** O host está esperando o jogador local decidir alguma coisa? */
  function waitingForLocal(): boolean {
    switch (state.phase) {
      case 'bidding':
        return state.bidTurnIndex !== null && state.players[state.bidTurnIndex]!.id === localPlayerId;
      case 'playing':
        if (state.turnIndex === null) return false;
        if (state.players[state.turnIndex]!.id !== localPlayerId) return false;
        return jogadaForcada() === null;
      case 'handScored':
      case 'matchOver':
        return true;
      default:
        return false;
    }
  }

  /** O próximo passo do host: a jogada forçada do jogador local, ou um bot. */
  function proximoPasso(): Action | null {
    const forcada = jogadaForcada();
    if (forcada !== null) return { t: 'PLAY', playerId: localPlayerId, card: forcada };
    return nextAutoAction(state, options.bots);
  }

  function delayFor(phase: MatchState['phase']): number {
    switch (phase) {
      case 'dealing':
        return timings.deal;
      case 'bidding':
        return timings.botBid;
      case 'playing':
        return timings.botPlay;
      case 'trickResolved':
        return timings.trickReveal;
      default:
        return 0;
    }
  }

  function apply(action: Action): void {
    const result = reduce(state, action);
    state = result.state;
    lastEvents = result.events;
    view = playerView(state, localPlayerId);

    // O log numerado é o que permite reagir a eventos sem perder nenhum quando
    // duas transições caem entre dois renders, e sem processar em dobro sob
    // StrictMode.
    for (const event of result.events) {
      eventLog.push({ seq: ++seq, event, view });
    }
    if (eventLog.length > LOG_LIMIT) eventLog = eventLog.slice(-LOG_LIMIT);

    for (const listener of listeners) listener();
    schedule();
  }

  /** Agenda o próximo passo do host, se houver algum que não dependa do jogador. */
  function schedule(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (disposed || waitingForLocal()) return;

    const action = proximoPasso();
    if (action === null) return;

    const phase = state.phase;
    timer = setTimeout(() => {
      timer = null;
      if (!disposed) apply(action);
    }, delayFor(phase));
  }

  // A partida começa sozinha: quem escolheu jogar foi a tela de setup.
  apply({ t: 'START_MATCH' });

  return {
    localPlayerId,

    getView: () => view,
    getEvents: () => lastEvents,
    getEventLog: () => eventLog,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispatch(action: ClientAction) {
      if (disposed) return;
      switch (action.t) {
        case 'BID':
          apply({ t: 'BID', playerId: localPlayerId, bid: action.bid });
          break;
        case 'PLAY':
          apply({ t: 'PLAY', playerId: localPlayerId, card: action.card });
          break;
        case 'CONTINUE':
          if (state.phase === 'handScored') apply({ t: 'NEXT_HAND' });
          break;
      }
    },

    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      listeners.clear();
    },
  };
}
