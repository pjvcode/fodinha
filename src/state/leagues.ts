/**
 * Ligas do Desafio Esquadrilha.
 *
 * Uma liga é um formato de partida fixo (mesa de 5, ida-e-volta completa, bots
 * difíceis). Não entra no `GameConfig` nem no engine: aqui é só a config
 * pré-montada e a forma do resultado de uma partida terminada.
 *
 * Módulo puro de verdade: nada de React e nada de `localStorage`. Isso importa
 * porque o servidor também depende dele — é daqui que sai o formato oficial da
 * liga que `leagueReplay.ts` confere. Quem guarda no navegador é
 * `leaguesLocal.ts`.
 */

import { defaultConfig } from '../engine/reducer';
import type { GameConfig, HandResult, PlayerConfig } from '../engine/types';
import type { PlayerView } from '../engine/selectors';
import { normalizarApelido } from './apelido';

export interface Liga {
  id: string;
  nome: string;
}

/** As duas ligas de fábrica. Mesmo formato, históricos separados. */
export const LIGAS: readonly Liga[] = [
  { id: 'esquadrilha', nome: 'Esquadrilha' },
  { id: 'doubled', nome: 'DoubleD' },
];

export function ligaPorId(id: string): Liga | undefined {
  return LIGAS.find((l) => l.id === id);
}

/** O elenco de bots. Quatro deles sentam à mesa em cada partida. */
export const NOMES_BOTS: readonly string[] = [
  'GIka',
  'Dizão',
  'Nabas',
  'Alê',
  'Perna',
  'Stefani',
  'Chicken',
];

/** Quantos bots sentam à mesa de liga (jogador + 4 bots = 5). */
export const BOTS_POR_MESA = 4;

/** Ritmo Cinema — cada carta com seu momento. Fixo nas ligas. */
export const RITMO_LIGA = 1.5;

/** `n` nomes distintos sorteados do elenco, na ordem sorteada. */
function sortearNomes(n: number): string[] {
  const pool = [...NOMES_BOTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

/**
 * Mesa da liga: assento 0 é o jogador; os demais são 4 bots difíceis com nomes
 * sorteados sem repetição do elenco.
 */
export function montarJogadoresLiga(apelido: string): PlayerConfig[] {
  const nomes = sortearNomes(BOTS_POR_MESA);
  return [
    { name: normalizarApelido(apelido), isBot: false },
    ...nomes.map((name) => ({ name, isBot: true, botLevel: 'hard' as const })),
  ];
}

/**
 * Config da partida de liga: ida-e-volta completa (1 → máx → 1), sem teto de
 * cartas (5 jogadores dão máx 8), penalidade acumulada para a partida ir até o
 * fim. Bots difíceis vêm de `montarJogadoresLiga`.
 */
export function configLiga(apelido: string, seed: number): GameConfig {
  return defaultConfig({
    players: montarJogadoresLiga(apelido),
    progression: 'up-down',
    maxCardsCap: null,
    scoringMode: 'penalty',
    seed,
  });
}

// ---------------------------------------------------------------------------
// O resultado de uma partida
// ---------------------------------------------------------------------------

export interface PlacarLinha {
  nome: string;
  penalidade: number;
}

export interface ResultadoLiga {
  /** Identificador único do resultado (timestamp basta). */
  id: string;
  /** ISO 8601 do fim da partida. */
  data: string;
  /** Apelido do jogador humano na partida. */
  jogador: string;
  /** Nomes dos vencedores (mais de um = vitória dividida). */
  vencedores: string[];
  /** Placar final ordenado do menor para o maior erro. */
  placar: PlacarLinha[];
  /** Log completo, mão a mão. */
  maos: HandResult[];
}

/**
 * Monta o `ResultadoLiga` a partir da view no fim da partida. Reúne todo mundo
 * (eu + adversários), ordena pelo menor erro e resolve os ids vencedores para
 * nomes.
 */
export function resultadoDeView(view: PlayerView): ResultadoLiga {
  const todos = [
    { id: view.me.id, nome: view.me.name, penalidade: view.me.penalty },
    ...view.opponents.map((o) => ({ id: o.id, nome: o.name, penalidade: o.penalty })),
  ];
  const placar = [...todos]
    .sort((a, b) => a.penalidade - b.penalidade)
    .map(({ nome, penalidade }) => ({ nome, penalidade }));
  const vencedores = view.winnerIds
    .map((id) => todos.find((p) => p.id === id)?.nome)
    .filter((n): n is string => n !== undefined);

  return {
    id: String(Date.now()),
    data: new Date().toISOString(),
    jogador: view.me.name,
    vencedores,
    placar,
    maos: view.history,
  };
}
