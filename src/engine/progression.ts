/**
 * Progressão "sobe e desce" e o limite de cartas imposto pelo baralho.
 *
 * `C_max = piso(40 / N)`: todas as 40 cartas podem ser distribuídas. Na mão em
 * que `handSize × N === 40` não sobra carta para virar, então essa mão é jogada
 * sem manilha e 3♣ passa a ser a carta mais forte. Isso acontece com 2, 4, 5 e
 * 8 jogadores; com 3, 6 e 7 sempre sobra carta.
 */

import { DECK_SIZE } from './types';
import type { GameConfig } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/** C_max natural: piso(40 / N). */
export function naturalMaxHandSize(numPlayers: number): number {
  if (numPlayers < MIN_PLAYERS || numPlayers > MAX_PLAYERS) {
    throw new Error(`Número de jogadores fora da faixa ${MIN_PLAYERS}..${MAX_PLAYERS}: ${numPlayers}`);
  }
  return Math.floor(DECK_SIZE / numPlayers);
}

/** C_max natural, limitado pelo teto opcional da config. */
export function maxHandSize(numPlayers: number, config: GameConfig): number {
  const natural = naturalMaxHandSize(numPlayers);
  if (config.maxCardsCap === null) return natural;
  return Math.max(1, Math.min(natural, config.maxCardsCap));
}

/** Se sobra carta para virar depois de distribuir. */
export function hasVira(handSize: number, numPlayers: number): boolean {
  return handSize * numPlayers < DECK_SIZE;
}

/**
 * Sequência de tamanhos de mão da partida inteira.
 * `up-down`: 1 → max → 1. `down-up`: max → 1 → max.
 * `repeatMaxHand` duplica a mão do ponto de virada.
 */
export function handSizeSequence(numPlayers: number, config: GameConfig): number[] {
  const max = maxHandSize(numPlayers, config);
  if (max <= 1) return [1];

  const up: number[] = [];
  for (let h = 1; h <= max; h++) up.push(h);
  const down = [...up].reverse();

  if (config.progression === 'down-up') {
    // max..1 seguido de 2..max (o 1 é o ponto de virada).
    const tail = up.slice(1);
    return config.repeatMaxHand ? [...down, 1, ...tail] : [...down, ...tail];
  }
  // 1..max seguido de max-1..1 (o max é o ponto de virada).
  const tail = down.slice(1);
  return config.repeatMaxHand ? [...up, max, ...tail] : [...up, ...tail];
}

/**
 * Aplica um novo teto ao que resta da sequência, preservando o comprimento e o
 * formato. Usado no modo eliminação: quando um jogador sai, N diminui, C_max
 * aumenta — mas o que importa é nunca pedir mais cartas do que o baralho tem.
 */
export function clampSequenceTail(
  handSizes: readonly number[],
  fromIndex: number,
  newMax: number,
): number[] {
  return handSizes.map((h, i) => (i > fromIndex ? Math.min(h, newMax) : h));
}
