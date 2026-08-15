/**
 * A fronteira entre a interface e o jogo.
 *
 * A UI nunca toca no `MatchState` — ela fala com um `Transport`, que devolve
 * apenas a `PlayerView` redigida do jogador local e aceita as ações dele.
 *
 * São dois hosts hoje, e a UI não distingue um do outro: `LocalTransport`, em
 * que a própria aba hospeda a partida, e `RemoteTransport`, em que o host é um
 * Durable Object do outro lado do fio. `GameScreen` e tudo abaixo dela não
 * mudaram uma linha quando o segundo apareceu.
 */

import type { PlayerView } from '../engine/selectors';
import type { Action, CardId, GameEvent } from '../engine/types';

/**
 * Ações que um jogador pode originar. Não inclui as transições do host, nem a
 * jogada de uma carta só: quando não há escolha — última carta da mão, ou a
 * rodada "na testa" — quem joga é o próprio host.
 */
export type ClientAction =
  | { t: 'BID'; bid: number }
  | { t: 'PLAY'; card: CardId }
  /** Avança da tela de resumo da mão para a próxima. */
  | { t: 'CONTINUE' };

export interface LoggedEvent {
  /** Cresce monotonicamente. Quem consome guarda o último que processou. */
  seq: number;
  event: GameEvent;
  /** A view logo depois da transição que gerou o evento. */
  view: PlayerView;
}

export interface Transport {
  readonly localPlayerId: string;
  getView(): PlayerView;
  /** Eventos gerados pela última transição, para animações e avisos. */
  getEvents(): GameEvent[];
  /**
   * Histórico numerado dos eventos recentes.
   *
   * `getEvents()` só guarda a última transição, então quem reage a eventos
   * perderia os de uma transição que caísse entre dois renders — e, em
   * `StrictMode`, processaria o mesmo evento duas vezes. Com o `seq` o
   * consumidor sabe exatamente de onde continuar.
   */
  getEventLog(): readonly LoggedEvent[];
  /**
   * Toda ação aceita da partida, na ordem — a receita para reproduzi-la do
   * zero a partir da `config`.
   *
   * É o que o servidor confere ao registrar um resultado de liga: ele roda o
   * mesmo `reduce()` sobre esta lista e chega ao placar por conta própria, em
   * vez de acreditar no que o cliente afirma.
   *
   * Opcional porque só quem é o host da partida tem como saber: num transporte
   * de rede o estado autoritativo está do outro lado, e quem grava o resultado
   * é o próprio servidor.
   */
  getActionLog?(): readonly Action[];
  subscribe(listener: () => void): () => void;
  dispatch(action: ClientAction): void;
  dispose(): void;
}

/** Ritmo da mesa, em milissegundos. */
export interface Timings {
  deal: number;
  botBid: number;
  botPlay: number;
  trickReveal: number;
}

/**
 * Ritmo padrão. Mais lento que o mínimo necessário de propósito: as cartas
 * levam ~400ms para pousar, a varrida da vaza começa em 900ms e dura 420ms, e
 * os balões de fala precisam de tempo para serem lidos. Correndo mais que isso
 * a mesa vira um borrão.
 */
export const DEFAULT_TIMINGS: Timings = {
  deal: 650,
  botBid: 700,
  botPlay: 900,
  trickReveal: 2100,
};

/** Multiplicador de ritmo escolhido pelo jogador. */
export function scaleTimings(timings: Timings, factor: number): Timings {
  return {
    deal: Math.round(timings.deal * factor),
    botBid: Math.round(timings.botBid * factor),
    botPlay: Math.round(timings.botPlay * factor),
    trickReveal: Math.round(timings.trickReveal * factor),
  };
}
