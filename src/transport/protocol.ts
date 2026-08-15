/**
 * O que trafega no WebSocket da sala.
 *
 * Compartilhado pelas duas pontas: o Durable Object monta estas mensagens e o
 * `RemoteTransport` as consome. Ter os tipos num arquivo só é o que faz o
 * `tsc` acusar uma divergência de protocolo em tempo de build, em vez de ela
 * virar um bug silencioso em produção.
 *
 * Módulo puro de tipos — nada aqui executa.
 */

import type { PlayerView } from '../engine/selectors';
import type { BotLevel } from '../engine/types';
import type { ClientAction, LoggedEvent } from './types';

/** Quatro letras maiúsculas, fáceis de ditar no telefone. */
export const TAMANHO_CODIGO = 4;

/** Limites da mesa, os mesmos do jogo personalizado. */
export const MIN_JOGADORES_SALA = 2;
export const MAX_JOGADORES_SALA = 8;

/**
 * Sem vogais e sem os pares que se confundem lidos em voz alta (I/1, O/0,
 * S/5). Quem entra na sala normalmente ouve o código de alguém.
 */
export const ALFABETO_CODIGO = 'BCDFGHJKLMNPQRTVWXYZ';

export type Assento =
  | { tipo: 'vazio' }
  | { tipo: 'humano'; userId: string; display: string; conectado: boolean }
  | { tipo: 'bot'; display: string; nivel: BotLevel };

export type FaseSala = 'lobby' | 'jogando';

/** O que todo mundo na sala pode ver. Não contém carta nenhuma. */
export interface SalaPublica {
  codigo: string;
  anfitriaoId: string;
  fase: FaseSala;
  assentos: Assento[];
}

// ---------------------------------------------------------------------------
// Cliente → servidor
// ---------------------------------------------------------------------------

export type MensagemCliente =
  /** Primeira mensagem da conexão. `desdeSeq` pede os eventos perdidos. */
  | { t: 'RESUMIR'; desdeSeq: number }
  /** Só o anfitrião. Assentos vazios viram bots. */
  | { t: 'COMECAR' }
  /** As ações de jogo, iguais às do transporte local. */
  | { t: 'ACAO'; acao: ClientAction };

// ---------------------------------------------------------------------------
// Servidor → cliente
// ---------------------------------------------------------------------------

export type MensagemServidor =
  /** O lobby mudou: alguém entrou, saiu ou a partida começou. */
  | { t: 'SALA'; sala: SalaPublica }
  /**
   * O estado do jogo para *esta* conexão.
   *
   * A `view` já vem redigida pelo `playerView()` do assento dono da conexão —
   * a mão dos outros nunca sai do servidor. `eventos` traz o que aconteceu
   * desde o `seq` que o cliente informou, para as animações não pularem.
   */
  | { t: 'ESTADO'; view: PlayerView; eventos: LoggedEvent[]; seq: number }
  | { t: 'ERRO'; erro: string };
