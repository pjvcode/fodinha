/**
 * Conferência de um resultado de liga.
 *
 * O cliente é o host da partida solo: ele embaralha, roda os bots e apura o
 * placar. Aceitar o número que ele manda seria aceitar qualquer número. Como o
 * engine é puro e determinístico, existe uma saída melhor — o servidor recebe a
 * `config` e o log de ações e **joga a partida de novo**, chegando ao placar por
 * conta própria.
 *
 * Nada aqui é específico do Cloudflare: é o mesmo `createMatch`/`reduce` que a
 * aba usa, rodando do outro lado. Módulo puro, testável direto.
 *
 * O que isto garante: o placar enviado corresponde a uma partida que realmente
 * pode ter acontecido, com todas as jogadas legais e a config da liga.
 *
 * O que isto **não** garante: que os bots tenham jogado bem. Um cliente
 * adulterado pode fazê-los jogar mal e ganhar de verdade. Fechar essa porta
 * exigiria rodar a partida inteira no servidor; para uma liga entre amigos, a
 * barreira certa é esta.
 */

import { createMatch, reduce } from '../engine/reducer';
import { standings } from '../engine/scoring';
import type { Action, GameConfig, MatchState } from '../engine/types';
import { configLiga } from './leagues';

/** O que o cliente manda ao terminar uma partida de liga. */
export interface EnvioResultado {
  config: GameConfig;
  actions: Action[];
}

export interface LinhaApurada {
  playerId: string;
  nome: string;
  penalidade: number;
  /** 1 = melhor. Empate divide a mesma posição. */
  posicao: number;
}

export interface ResultadoApurado {
  placar: LinhaApurada[];
  vencedores: string[];
  /** Assento do humano. Sempre 0 nas ligas. */
  assentoHumano: number;
}

export type Conferencia =
  | { ok: true; valor: ResultadoApurado }
  | { ok: false; erro: string };

/**
 * Teto de ações de uma partida. A liga mais longa (5 jogadores, ida e volta)
 * tem 15 mãos e nem 400 ações; o limite existe só para um envio absurdo não
 * fazer o Worker mastigar um log infinito.
 */
const MAX_ACOES = 5_000;

/**
 * A config precisa ser a da liga, não uma inventada. Compara contra
 * `configLiga()` — a mesma função que monta a partida — em vez de repetir os
 * valores aqui, para as duas nunca divergirem.
 *
 * Nome dos jogadores e semente ficam de fora da comparação: o apelido é de quem
 * jogou e a semente é sorteada a cada partida.
 */
function configDeLiga(config: GameConfig): string | null {
  const referencia = configLiga('x', config.seed);

  if (config.players.length !== referencia.players.length) {
    return `A liga é uma mesa de ${referencia.players.length}.`;
  }
  if (config.players[0]?.isBot !== false) {
    return 'O assento 0 é o do jogador.';
  }
  if (config.players.slice(1).some((p) => !p.isBot)) {
    return 'A liga tem um humano só.';
  }

  const camposIguais = [
    'progression',
    'scoringMode',
    'tieBreak',
    'maxCardsCap',
    'repeatMaxHand',
    'startingLives',
  ] as const;

  for (const campo of camposIguais) {
    if (config[campo] !== referencia[campo]) return `Formato fora do padrão da liga (${campo}).`;
  }

  if (config.suitOrder.join() !== referencia.suitOrder.join()) {
    return 'Formato fora do padrão da liga (suitOrder).';
  }

  if (!Number.isInteger(config.seed)) return 'Semente inválida.';

  return null;
}

/**
 * Roda a partida do zero e devolve o placar apurado pelo servidor.
 *
 * Qualquer ação recusada pelo `reduce()` derruba o envio: num log honesto elas
 * não existem, já que o host só aplica o que é legal. Uma que apareça aqui é
 * sinal de log forjado ou corrompido — nos dois casos o resultado não vale.
 */
export function conferirResultado(envio: EnvioResultado): Conferencia {
  const problema = configDeLiga(envio.config);
  if (problema !== null) return { ok: false, erro: problema };

  if (!Array.isArray(envio.actions) || envio.actions.length === 0) {
    return { ok: false, erro: 'Partida sem jogadas.' };
  }
  if (envio.actions.length > MAX_ACOES) {
    return { ok: false, erro: 'Log de partida longo demais.' };
  }

  let state: MatchState = createMatch(envio.config);

  for (const [i, action] of envio.actions.entries()) {
    const resultado = reduce(state, action);
    const recusada = resultado.events.find((e) => e.t === 'INVALID_ACTION');
    if (recusada) {
      return { ok: false, erro: `Jogada ${i} inválida: ${recusada.reason}` };
    }
    state = resultado.state;
  }

  if (state.phase !== 'matchOver') {
    return { ok: false, erro: 'A partida não chegou ao fim.' };
  }

  const placar: LinhaApurada[] = standings(state).map((linha) => ({
    playerId: linha.playerId,
    nome: linha.name,
    penalidade: linha.penalty,
    posicao: linha.rank,
  }));

  return {
    ok: true,
    valor: {
      placar,
      vencedores: state.winnerIds,
      assentoHumano: state.players.findIndex((p) => !p.isBot),
    },
  };
}
