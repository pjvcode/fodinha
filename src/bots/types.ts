import type { PlayerView } from '../engine/selectors';
import type { CardId } from '../engine/types';

/**
 * Um bot recebe apenas a `PlayerView` — a mesma informação redigida que um
 * jogador humano teria. Nenhuma implementação pode espiar o `MatchState`.
 */
export interface Bot {
  readonly name: string;
  chooseBid(view: PlayerView, legal: number[]): number;
  chooseCard(view: PlayerView, legal: CardId[]): CardId;
}

/** Bots indexados por id de jogador. */
export type BotMap = Record<string, Bot>;
