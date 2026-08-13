import { useCallback, useSyncExternalStore } from 'react';

import type { PlayerView } from '../engine/selectors';
import type { CardId } from '../engine/types';
import type { ClientAction, Transport } from '../transport/types';

export interface Game {
  view: PlayerView;
  /** É a vez do jogador local palpitar? */
  myBidTurn: boolean;
  /** É a vez do jogador local jogar uma carta? */
  myPlayTurn: boolean;
  bid: (value: number) => void;
  play: (card: CardId) => void;
  continueHand: () => void;
}

/**
 * Liga a UI ao transporte. A UI não conhece o `MatchState` — só a view
 * redigida e quatro ações.
 */
export function useGame(transport: Transport): Game {
  const view = useSyncExternalStore(transport.subscribe, transport.getView, transport.getView);

  const dispatch = useCallback(
    (action: ClientAction) => transport.dispatch(action),
    [transport],
  );

  const me = transport.localPlayerId;

  return {
    view,
    myBidTurn: view.phase === 'bidding' && view.currentBidderId === me,
    myPlayTurn: view.phase === 'playing' && view.currentTurnId === me,
    bid: useCallback((value: number) => dispatch({ t: 'BID', bid: value }), [dispatch]),
    play: useCallback((card: CardId) => dispatch({ t: 'PLAY', card }), [dispatch]),
    continueHand: useCallback(() => dispatch({ t: 'CONTINUE' }), [dispatch]),
  };
}
