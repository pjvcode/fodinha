import { createEasyBot, createHardBot, createMediumBot } from './heuristic';
import { createRandomBot } from './random';
import type { Bot } from './types';
import type { BotLevel } from '../engine/types';

export * from './types';
export * from './random';
export * from './probability';
export * from './heuristic';
export * from './runner';

/** Nível extra, só para simulação e calibração — não aparece na UI. */
export type SimLevel = BotLevel | 'random';

export function createBot(level: SimLevel, seed = 0): Bot {
  switch (level) {
    case 'random':
      return createRandomBot(seed, 'random');
    case 'easy':
      return createEasyBot();
    case 'hard':
      return createHardBot();
    case 'medium':
    default:
      return createMediumBot();
  }
}
