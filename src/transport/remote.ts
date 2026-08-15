/**
 * O host da partida está do outro lado do fio.
 *
 * Implementa a mesma interface `Transport` que `LocalTransport`, então
 * `GameScreen` e tudo abaixo dela não mudam uma linha. Era exatamente isso que
 * a fronteira do transporte existia para permitir.
 *
 * A diferença de responsabilidade é toda invisível para a UI: aqui não há
 * `MatchState`, não há bots e não há regra de jogo. Este módulo recebe views
 * prontas e manda cliques.
 */

import type { PlayerView } from '../engine/selectors';
import type { MensagemCliente, MensagemServidor, SalaPublica } from './protocol';
import type { ClientAction, LoggedEvent, Transport } from './types';

export interface RemoteTransportOptions {
  codigo: string;
  /** Id do usuário logado, para saber qual assento é o dele. */
  localPlayerId: string;
  /** Chamado a cada mudança do lobby (quem entrou, quem saiu, começou). */
  onSala?: (sala: SalaPublica) => void;
  onErro?: (erro: string) => void;
  /** Some quando a conexão cai e volta quando ela se restabelece. */
  onConexao?: (conectado: boolean) => void;
}

export interface RemoteTransport extends Transport {
  /** Só o anfitrião. Assentos vazios viram bots. */
  comecar(): void;
  /** `null` até a primeira mensagem do servidor. */
  getSala(): SalaPublica | null;
  /**
   * Já chegou uma view do servidor?
   *
   * A tela de jogo depende disto e não da fase da sala: `SALA` e `ESTADO` são
   * duas mensagens, e entre uma e outra cabe um render. Montar `GameScreen` só
   * porque a sala disse "jogando" pegaria a partida sem view nenhuma.
   */
  temPartida(): boolean;
}

/** Espera antes de tentar de novo, dobrando até o teto. */
const RECONEXAO_MIN_MS = 500;
const RECONEXAO_MAX_MS = 8000;

const LIMITE_LOG = 120;

export function createRemoteTransport(options: RemoteTransportOptions): RemoteTransport {
  const listeners = new Set<() => void>();

  let socket: WebSocket | null = null;
  let sala: SalaPublica | null = null;
  let view: PlayerView | null = null;
  let lastEvents: LoggedEvent[] = [];
  let eventLog: LoggedEvent[] = [];
  /**
   * O último evento processado. É o que a reconexão manda ao servidor para
   * receber só o que perdeu — o mesmo `seq` que o log numerado já carregava.
   */
  let ultimoSeq = 0;
  let esperaReconexao = RECONEXAO_MIN_MS;
  let reconexao: ReturnType<typeof setTimeout> | null = null;
  let descartado = false;

  function avisar(): void {
    for (const listener of listeners) listener();
  }

  function enviar(msg: MensagemCliente): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }

  function receber(dados: string): void {
    let msg: MensagemServidor;
    try {
      msg = JSON.parse(dados) as MensagemServidor;
    } catch {
      return;
    }

    switch (msg.t) {
      case 'SALA':
        sala = msg.sala;
        options.onSala?.(msg.sala);
        avisar();
        return;

      case 'ESTADO':
        view = msg.view;
        lastEvents = msg.eventos;
        if (msg.eventos.length > 0) {
          eventLog = [...eventLog, ...msg.eventos].slice(-LIMITE_LOG);
        }
        ultimoSeq = msg.seq;
        avisar();
        return;

      case 'ERRO':
        options.onErro?.(msg.erro);
        return;
    }
  }

  function conectar(): void {
    if (descartado) return;

    const protocolo = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocolo}//${location.host}/api/rooms/${encodeURIComponent(options.codigo)}/ws`;
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      esperaReconexao = RECONEXAO_MIN_MS;
      options.onConexao?.(true);
      // Pede o que passou enquanto esta conexão não existia. Numa conexão nova
      // `ultimoSeq` é 0 e o servidor manda tudo que ainda está no log dele.
      enviar({ t: 'RESUMIR', desdeSeq: ultimoSeq });
    });

    socket.addEventListener('message', (evento) => {
      if (typeof evento.data === 'string') receber(evento.data);
    });

    const cair = () => {
      options.onConexao?.(false);
      if (descartado) return;
      // Backoff: uma queda costuma vir acompanhada, e martelar o servidor a
      // cada 500ms não reconecta mais rápido.
      reconexao = setTimeout(conectar, esperaReconexao);
      esperaReconexao = Math.min(esperaReconexao * 2, RECONEXAO_MAX_MS);
    };

    socket.addEventListener('close', cair);
    socket.addEventListener('error', () => socket?.close());
  }

  conectar();

  return {
    localPlayerId: options.localPlayerId,

    getView(): PlayerView {
      if (view === null) {
        // A UI só monta `GameScreen` depois da primeira view chegar; se isto
        // dispara, é bug de ordem de montagem e vale gritar.
        throw new Error('A partida ainda não começou nesta sala.');
      }
      return view;
    },

    getEvents: () => lastEvents.map((e) => e.event),
    getEventLog: () => eventLog,

    // `getActionLog` fica de fora de propósito: aqui o estado autoritativo está
    // no servidor, e é ele quem sabe o que foi aplicado.

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispatch(acao: ClientAction) {
      enviar({ t: 'ACAO', acao });
    },

    comecar() {
      enviar({ t: 'COMECAR' });
    },

    getSala: () => sala,
    temPartida: () => view !== null,

    dispose() {
      descartado = true;
      if (reconexao !== null) clearTimeout(reconexao);
      reconexao = null;
      listeners.clear();
      socket?.close();
      socket = null;
    },
  };
}
