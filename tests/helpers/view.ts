/**
 * Construtor de `PlayerView` para os testes.
 *
 * Não é um arquivo de teste (o Vitest só coleta `tests/**\/*.test.ts`), é a
 * ferramenta que deixa cada teste montar exatamente a situação de mesa que
 * quer exercitar, sem precisar dirigir uma partida inteira até lá.
 */

import { defaultConfig, defaultPlayers } from '../../src/engine/reducer';
import type { OpponentView, PlayerView, SelfView } from '../../src/engine/selectors';
import type { CardId, GameConfig } from '../../src/engine/types';

export function makeOpponents(count: number, over: Partial<OpponentView> = {}): OpponentView[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Bot ${i + 1}`,
    isBot: true,
    seat: i + 1,
    bid: 1,
    tricksWon: 0,
    penalty: 0,
    lives: 5,
    eliminated: false,
    handCount: 3,
    ...over,
  }));
}

export interface MakeViewOptions extends Partial<Omit<PlayerView, 'me' | 'config'>> {
  me?: Partial<SelfView>;
  config?: Partial<GameConfig>;
  opponentCount?: number;
}

export function makeView(over: MakeViewOptions = {}): PlayerView {
  const { me: meOver, config: configOver, opponentCount = 3, ...resto } = over;
  const config = defaultConfig({ players: defaultPlayers(opponentCount + 1), ...configOver });

  const me: SelfView = {
    id: 'p0',
    name: 'Você',
    seat: 0,
    bid: 1,
    tricksWon: 0,
    penalty: 0,
    lives: 5,
    eliminated: false,
    handCount: 3,
    hand: ['4d', 'Kd', '3c'] as CardId[],
    ...meOver,
  };

  return {
    config,
    phase: 'playing',
    handIndex: 2,
    totalHands: 19,
    handSize: 3,
    vira: '7d',
    manilhaRank: 'Q',
    me,
    opponents: makeOpponents(opponentCount),
    dealerId: `p${opponentCount}`,
    currentBidderId: null,
    currentTurnId: 'p0',
    trick: { leaderId: 'p1', plays: [] },
    lastTrick: null,
    completedTricks: [],
    playedCards: [],
    legalBids: [],
    forbiddenBid: null,
    legalCards: [],
    history: [],
    winnerIds: [],
    ...resto,
  };
}
