/**
 * Bot aleatório. Serve de linha de base para medir os outros e de motor para a
 * simulação headless. Tem PRNG próprio com seed, então uma partida inteira
 * continua reproduzível.
 */

import { nextInt } from '../engine/rng';
import type { PlayerView } from '../engine/selectors';
import type { CardId } from '../engine/types';
import type { Bot } from './types';

export function createRandomBot(seed: number, name = 'random'): Bot {
  let rng = seed >>> 0;

  const draw = (max: number): number => {
    const d = nextInt(rng, max);
    rng = d.state;
    return d.value;
  };

  return {
    name,
    chooseBid(_view: PlayerView, legal: number[]): number {
      return legal[draw(legal.length)]!;
    },
    chooseCard(_view: PlayerView, legal: CardId[]): CardId {
      return legal[draw(legal.length)]!;
    },
  };
}
