/**
 * Invariantes verificáveis do estado.
 *
 * Não fazem parte das regras — são a rede de segurança usada pelos testes e
 * pela simulação em massa. Devolvem a lista de violações em vez de lançar, para
 * que o chamador decida o que fazer.
 */

import { MIN_PLAYERS, maxHandSize } from './progression';
import { playedCardsThisHand } from './selectors';
import { DECK_SIZE } from './types';
import type { CardId, MatchState, PlayerState } from './types';

const HAND_DEALT_PHASES = new Set(['bidding', 'playing', 'trickResolved', 'handScored']);

/**
 * Quem recebeu cartas nesta mão. Não é a mesma coisa que "quem está ativo":
 * um jogador eliminado durante a pontuação desta mão jogou ela inteira e ainda
 * conta para a aritmética do baralho até o próximo `DEAL`.
 */
function dealtThisHand(state: MatchState): PlayerState[] {
  return state.players.filter((p) => p.bid !== null || p.hand.length > 0);
}

export function checkStateInvariants(state: MatchState): string[] {
  const problems: string[] = [];
  if (!HAND_DEALT_PHASES.has(state.phase)) return problems;

  const dealtTo = dealtThisHand(state);

  // --- integridade do baralho -----------------------------------------------
  const seen: CardId[] = [
    ...state.players.flatMap((p) => p.hand),
    ...playedCardsThisHand(state),
    ...state.stock,
  ];
  if (state.vira !== null) seen.push(state.vira);

  if (seen.length !== DECK_SIZE) {
    problems.push(`Baralho com ${seen.length} cartas em vez de ${DECK_SIZE}`);
  }
  if (new Set(seen).size !== seen.length) {
    problems.push('Carta duplicada entre mãos, vira, monte e mesa');
  }

  // --- tamanho da mão e presença do vira ------------------------------------
  const dealt = state.handSize * dealtTo.length;
  if (dealt > DECK_SIZE) {
    problems.push(`Distribuição impossível: ${state.handSize} × ${dealtTo.length} > ${DECK_SIZE}`);
  }
  if (dealtTo.length >= MIN_PLAYERS && state.handSize > maxHandSize(dealtTo.length, state.config)) {
    problems.push(`Mão de ${state.handSize} acima do teto para ${dealtTo.length} jogadores`);
  }
  const shouldHaveVira = dealt < DECK_SIZE;
  if (shouldHaveVira !== (state.vira !== null)) {
    problems.push(
      `Vira ${state.vira === null ? 'ausente' : 'presente'} com ${dealt} cartas distribuídas`,
    );
  }
  if ((state.vira === null) !== (state.manilhaRank === null)) {
    problems.push('Vira e manilha em desacordo');
  }

  // --- eliminados de mãos anteriores não participam -------------------------
  // Em `handScored` a checagem não vale: quem foi eliminado nessa mão jogou ela
  // inteira, e o palpite/vazas só são limpos no `DEAL` seguinte.
  if (state.phase !== 'handScored') {
    for (const p of state.players) {
      if (p.eliminated && (p.hand.length > 0 || p.bid !== null)) {
        problems.push(`Jogador eliminado ${p.id} ainda está na mão`);
      }
    }
  }

  // --- contagem de cartas na mão de cada um ---------------------------------
  const tricksPlayed = state.completedTricks.length;
  for (const p of dealtTo) {
    const naMesa = state.trick?.plays.some((x) => x.playerId === p.id) ? 1 : 0;
    const expected = state.handSize - tricksPlayed - naMesa;
    if (p.hand.length !== expected) {
      problems.push(`${p.id} tem ${p.hand.length} cartas, esperado ${expected}`);
    }
  }

  // --- fechamento da mão ----------------------------------------------------
  if (state.phase === 'handScored') {
    const annulled = state.completedTricks.filter((t) => t.winnerId === null).length;
    const total = state.players.reduce((sum, p) => sum + p.tricksWon, 0);
    if (total !== state.handSize - annulled) {
      problems.push(`Soma das vazas ${total} ≠ ${state.handSize - annulled}`);
    }
    if (state.completedTricks.length !== state.handSize) {
      problems.push(
        `${state.completedTricks.length} vazas jogadas em uma mão de ${state.handSize}`,
      );
    }
    if (dealtTo.length === 0) problems.push('Mão pontuada sem nenhum participante');
    for (const p of dealtTo) {
      if (p.hand.length !== 0) problems.push(`${p.id} terminou a mão com cartas`);
      if (p.bid === null) problems.push(`${p.id} terminou a mão sem palpite`);
    }
  }

  return problems;
}

export function assertInvariants(state: MatchState, context = ''): void {
  const problems = checkStateInvariants(state);
  if (problems.length > 0) {
    const where = context ? ` (${context})` : '';
    throw new Error(`Invariantes violados${where}:\n  - ${problems.join('\n  - ')}`);
  }
}
