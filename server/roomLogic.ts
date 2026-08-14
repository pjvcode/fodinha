/**
 * A sala, como máquina de estados pura.
 *
 * É o `LocalTransport` do servidor, e a semelhança é proposital: mesmo
 * `reduce()`, mesmo `playerView()`, mesmos bots. O que muda é quem é o host —
 * lá é a aba, aqui é um Durable Object.
 *
 * Nada aqui conhece WebSocket, Durable Object ou tipo do Cloudflare: as funções
 * recebem um estado e devolvem outro. `room.ts` é a casca fina que liga isso à
 * rede, e `tests/roomLogic.test.ts` exercita tudo sem subir `workerd`.
 */

import { createBot } from '../src/bots';
import { nextAutoAction } from '../src/bots/runner';
import type { BotMap } from '../src/bots/types';
import { createMatch, defaultConfig, reduce } from '../src/engine/reducer';
import { playerView } from '../src/engine/selectors';
import type { PlayerView } from '../src/engine/selectors';
import type { Action, BotLevel, GameEvent, MatchState, PlayerConfig } from '../src/engine/types';
import { NOMES_BOTS } from '../src/state/leagues';
import {
  ALFABETO_CODIGO,
  MAX_JOGADORES_SALA,
  MIN_JOGADORES_SALA,
  TAMANHO_CODIGO,
} from '../src/transport/protocol';
import type { Assento, SalaPublica } from '../src/transport/protocol';
import type { ClientAction, LoggedEvent } from '../src/transport/types';

// Os limites vivem no protocolo: a tela de criar sala precisa deles para montar
// o seletor, e uma divergência entre os dois lados viraria um erro só na hora
// de criar.
export { MAX_JOGADORES_SALA, MIN_JOGADORES_SALA };

/** O nível dos bots que preenchem assento vazio. */
const NIVEL_BOT: BotLevel = 'hard';

/** Quantos eventos a sala guarda para quem reconecta. Uma mão inteira cabe. */
const LIMITE_LOG = 120;

/**
 * Um evento no log da sala.
 *
 * Sem `view`, ao contrário do `LoggedEvent` que o cliente consome — e essa
 * ausência é a defesa. Se o log guardasse a view de um assento, mandá-lo para a
 * mesa entregaria a mão daquele jogador a todo mundo. A view é montada na
 * saída, por destinatário, em `eventosDesde()`.
 */
export interface EventoNumerado {
  seq: number;
  event: GameEvent;
}

export interface SalaState {
  codigo: string;
  anfitriaoId: string;
  assentos: Assento[];
  fase: 'lobby' | 'jogando';
  match: MatchState | null;
  seed: number;
  bots: BotMap;
  log: EventoNumerado[];
  seq: number;
}

export interface Usuario {
  id: string;
  display: string;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

// ---------------------------------------------------------------------------
// Criação e entrada
// ---------------------------------------------------------------------------

export function gerarCodigo(aleatorio: () => number = Math.random): string {
  let saida = '';
  for (let i = 0; i < TAMANHO_CODIGO; i++) {
    saida += ALFABETO_CODIGO[Math.floor(aleatorio() * ALFABETO_CODIGO.length)];
  }
  return saida;
}

export function criarSala(
  codigo: string,
  anfitriao: Usuario,
  jogadores: number,
  seed: number,
): Resultado<SalaState> {
  if (!Number.isInteger(jogadores) || jogadores < MIN_JOGADORES_SALA || jogadores > MAX_JOGADORES_SALA) {
    return { ok: false, erro: `A mesa vai de ${MIN_JOGADORES_SALA} a ${MAX_JOGADORES_SALA} jogadores.` };
  }

  const assentos: Assento[] = Array.from({ length: jogadores }, () => ({ tipo: 'vazio' }));
  assentos[0] = { tipo: 'humano', userId: anfitriao.id, display: anfitriao.display, conectado: true };

  return {
    ok: true,
    valor: {
      codigo,
      anfitriaoId: anfitriao.id,
      assentos,
      fase: 'lobby',
      match: null,
      seed,
      bots: {},
      log: [],
      seq: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

/**
 * A sala sem os bots.
 *
 * `BotMap` é um mapa de objetos com método — não sobrevive a um `JSON`. E nem
 * precisa: um bot é função determinística do nível e da semente, então
 * `reidratar()` reconstrói exatamente os mesmos a partir do que foi gravado.
 */
export type SalaSerializada = Omit<SalaState, 'bots'>;

export function serializar(sala: SalaState): SalaSerializada {
  const { bots: _bots, ...resto } = sala;
  return resto;
}

export function reidratar(dados: SalaSerializada): SalaState {
  const bots: BotMap = {};
  if (dados.match !== null) {
    dados.assentos.forEach((a, i) => {
      if (a.tipo === 'bot') bots[`p${i}`] = createBot(a.nivel, dados.match!.config.seed + i * 7919);
    });
  }
  return { ...dados, bots };
}

export function assentoDe(sala: SalaState, userId: string): number {
  return sala.assentos.findIndex((a) => a.tipo === 'humano' && a.userId === userId);
}

/**
 * Senta o usuário, ou o reconecta se ele já tinha assento.
 *
 * Reconectar tem de vir antes de procurar lugar vazio: quem caiu no meio da
 * partida precisa voltar para a *sua* cadeira, com a sua mão, e não para outra.
 */
export function entrar(sala: SalaState, usuario: Usuario): Resultado<number> {
  const jaSentado = assentoDe(sala, usuario.id);
  if (jaSentado >= 0) {
    const assento = sala.assentos[jaSentado]!;
    if (assento.tipo === 'humano') assento.conectado = true;
    return { ok: true, valor: jaSentado };
  }

  if (sala.fase === 'jogando') {
    return { ok: false, erro: 'A partida já começou.' };
  }

  const vazio = sala.assentos.findIndex((a) => a.tipo === 'vazio');
  if (vazio < 0) return { ok: false, erro: 'A sala está cheia.' };

  sala.assentos[vazio] = {
    tipo: 'humano',
    userId: usuario.id,
    display: usuario.display,
    conectado: true,
  };
  return { ok: true, valor: vazio };
}

/**
 * A conexão caiu.
 *
 * No lobby o assento é liberado — quem fechou a aba antes de começar não deve
 * segurar lugar. Em partida o assento fica, só marcado como desconectado: as
 * cartas dele continuam na mesa e ele pode voltar.
 */
export function sair(sala: SalaState, userId: string): void {
  const i = assentoDe(sala, userId);
  if (i < 0) return;

  if (sala.fase === 'lobby') {
    sala.assentos[i] = { tipo: 'vazio' };
    return;
  }

  const assento = sala.assentos[i]!;
  if (assento.tipo === 'humano') assento.conectado = false;
}

// ---------------------------------------------------------------------------
// Começar
// ---------------------------------------------------------------------------

/** Nomes de bot que ninguém à mesa já esteja usando. */
function nomesDeBotLivres(sala: SalaState, quantos: number): string[] {
  const tomados = new Set(
    sala.assentos.flatMap((a) => (a.tipo === 'humano' ? [a.display.toLowerCase()] : [])),
  );
  const livres = NOMES_BOTS.filter((n) => !tomados.has(n.toLowerCase()));
  return Array.from({ length: quantos }, (_, i) => livres[i % livres.length] ?? `Bot ${i + 1}`);
}

/**
 * Começa a partida. Assento vazio vira bot.
 *
 * É isso que faz uma sala de 4 funcionar com dois amigos: quem não veio é
 * substituído, em vez de a partida ficar esperando para sempre.
 */
export function comecar(sala: SalaState, userId: string): Resultado<SalaState> {
  if (userId !== sala.anfitriaoId) return { ok: false, erro: 'Só o anfitrião começa a partida.' };
  if (sala.fase !== 'lobby') return { ok: false, erro: 'A partida já começou.' };

  const humanos = sala.assentos.filter((a) => a.tipo === 'humano').length;
  if (humanos === 0) return { ok: false, erro: 'A mesa está vazia.' };

  const vazios = sala.assentos.filter((a) => a.tipo === 'vazio').length;
  const nomes = nomesDeBotLivres(sala, vazios);
  let proximoNome = 0;

  const assentos: Assento[] = sala.assentos.map((a) =>
    a.tipo === 'vazio'
      ? { tipo: 'bot', display: nomes[proximoNome++]!, nivel: NIVEL_BOT }
      : a,
  );

  const players: PlayerConfig[] = assentos.map((a) =>
    a.tipo === 'bot'
      ? { name: a.display, isBot: true, botLevel: a.nivel }
      : { name: a.tipo === 'humano' ? a.display : 'Vazio', isBot: false },
  );

  const config = defaultConfig({ players, seed: sala.seed });

  const bots: BotMap = {};
  assentos.forEach((a, i) => {
    if (a.tipo === 'bot') bots[`p${i}`] = createBot(a.nivel, config.seed + i * 7919);
  });

  sala.assentos = assentos;
  sala.bots = bots;
  sala.fase = 'jogando';
  sala.match = createMatch(config);

  aplicar(sala, { t: 'START_MATCH' });
  return { ok: true, valor: sala };
}

// ---------------------------------------------------------------------------
// Jogo
// ---------------------------------------------------------------------------

/** Aplica uma ação do engine e registra os eventos no log numerado. */
export function aplicar(sala: SalaState, action: Action): void {
  if (sala.match === null) return;

  const resultado = reduce(sala.match, action);
  sala.match = resultado.state;

  for (const event of resultado.events) {
    // Ação inválida é assunto de quem a mandou, não da mesa inteira: entrar no
    // log faria todo mundo receber o erro de um jogador só.
    if (event.t === 'INVALID_ACTION') continue;
    sala.log.push({ seq: ++sala.seq, event });
  }
  if (sala.log.length > LIMITE_LOG) sala.log = sala.log.slice(-LIMITE_LOG);
}

/**
 * Traduz a ação do cliente para a do engine, amarrada ao assento de quem mandou.
 *
 * O `playerId` vem do assento e nunca da mensagem — é isso que impede alguém de
 * jogar a carta de outro simplesmente escrevendo outro id no WebSocket.
 */
export function acaoDoCliente(
  sala: SalaState,
  userId: string,
  acao: ClientAction,
): Resultado<Action | null> {
  if (sala.match === null) return { ok: false, erro: 'A partida não começou.' };

  const assento = assentoDe(sala, userId);
  if (assento < 0) return { ok: false, erro: 'Você não está sentado nesta mesa.' };

  const playerId = `p${assento}`;

  switch (acao.t) {
    case 'BID':
      return { ok: true, valor: { t: 'BID', playerId, bid: acao.bid } };
    case 'PLAY':
      return { ok: true, valor: { t: 'PLAY', playerId, card: acao.card } };
    case 'CONTINUE':
      // Qualquer um pode pedir para seguir; o primeiro a clicar avança a mesa.
      // Numa sala com gente de verdade, esperar todo mundo clicar trava a
      // partida no primeiro que saiu para atender o telefone.
      return {
        ok: true,
        valor: sala.match.phase === 'handScored' ? { t: 'NEXT_HAND' } : null,
      };
  }
}

/**
 * A carta que um humano é obrigado a jogar, quando não há escolha: a última da
 * mão, ou a rodada "na testa". Mesma regra do host local — pedir um clique para
 * uma jogada de resultado único é atrito à toa.
 */
function jogadaForcada(sala: SalaState): Action | null {
  const match = sala.match;
  if (!match || match.phase !== 'playing' || match.turnIndex === null) return null;

  const jogador = match.players[match.turnIndex]!;
  const assento = sala.assentos[match.turnIndex];
  if (assento?.tipo !== 'humano') return null;
  if (jogador.hand.length !== 1) return null;

  return { t: 'PLAY', playerId: jogador.id, card: jogador.hand[0]! };
}

/**
 * O próximo passo que não depende de humano nenhum: a jogada forçada de alguém,
 * ou a vez de um bot. `null` quando a mesa está esperando uma decisão.
 */
export function proximoPasso(sala: SalaState): Action | null {
  if (sala.match === null) return null;
  return jogadaForcada(sala) ?? nextAutoAction(sala.match, sala.bots);
}

// ---------------------------------------------------------------------------
// O que sai para os clientes
// ---------------------------------------------------------------------------

export function salaPublica(sala: SalaState): SalaPublica {
  return {
    codigo: sala.codigo,
    anfitriaoId: sala.anfitriaoId,
    fase: sala.fase,
    assentos: sala.assentos,
  };
}

/** A view redigida de um assento. É o que impede uma mão de vazar para outro. */
export function viewDoAssento(sala: SalaState, assento: number): PlayerView | null {
  if (sala.match === null) return null;
  return playerView(sala.match, `p${assento}`);
}

/**
 * Os eventos depois de `desdeSeq`, para quem reconectou não perder as animações
 * do que aconteceu enquanto esteve fora.
 *
 * A view anexada é a atual do assento que pediu, não a de cada instante — o log
 * do servidor não guarda view nenhuma, justamente para não ter a mão de ninguém
 * dentro. Quem lê o log é `useReactions`, que só usa `view.opponents` para saber
 * qual bot pode falar; para isso a view atual serve.
 */
export function eventosDesde(sala: SalaState, desdeSeq: number, assento: number): LoggedEvent[] {
  const view = viewDoAssento(sala, assento);
  if (view === null) return [];
  return sala.log.filter((e) => e.seq > desdeSeq).map((e) => ({ ...e, view }));
}
