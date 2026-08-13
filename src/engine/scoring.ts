/**
 * Pontuação.
 *
 * A penalidade de uma mão é sempre `|palpite − vazas ganhas|`. O que muda entre
 * os modos é só a leitura: em `'penalty'` ela acumula e o menor total vence; em
 * `'elimination'` ela é descontada das vidas e quem zera sai.
 */

import type { MatchState, PlayerState } from './types';

export function handPenalty(bid: number, tricksWon: number): number {
  return Math.abs(bid - tricksWon);
}

export function activePlayers(state: MatchState): PlayerState[] {
  return state.players.filter((p) => !p.eliminated);
}

export function isLastHand(state: MatchState): boolean {
  return state.handIndex >= state.handSizes.length - 1;
}

/** A partida acabou depois da mão que acabou de ser pontuada? */
export function isMatchOver(state: MatchState): boolean {
  if (state.config.scoringMode === 'elimination' && activePlayers(state).length <= 1) return true;
  return isLastHand(state);
}

export interface Standing {
  playerId: string;
  name: string;
  penalty: number;
  lives: number;
  eliminated: boolean;
  /** 1 = melhor. Colocações empatadas compartilham o número. */
  rank: number;
}

/**
 * Classificação. Em `'penalty'`, menor penalidade primeiro. Em `'elimination'`,
 * quem sobrou vem antes de quem saiu, depois mais vidas, depois menor
 * penalidade como critério de desempate.
 */
export function standings(state: MatchState): Standing[] {
  const elimination = state.config.scoringMode === 'elimination';

  const rows = state.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    penalty: p.penalty,
    lives: p.lives,
    eliminated: p.eliminated,
    rank: 0,
  }));

  const key = (r: Standing): [number, number, number] =>
    elimination ? [r.eliminated ? 1 : 0, -r.lives, r.penalty] : [0, 0, r.penalty];

  rows.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i]! !== kb[i]!) return ka[i]! - kb[i]!;
    }
    return 0;
  });

  let rank = 0;
  let prev: string | null = null;
  rows.forEach((r, i) => {
    const sig = key(r).join('|');
    if (sig !== prev) {
      rank = i + 1;
      prev = sig;
    }
    r.rank = rank;
  });

  return rows;
}

/** Vencedores da partida. Mais de um id significa vitória dividida. */
export function determineWinners(state: MatchState): string[] {
  const table = standings(state);
  return table.filter((r) => r.rank === 1).map((r) => r.playerId);
}
