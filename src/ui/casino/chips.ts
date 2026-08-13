/**
 * Fichas de aposta.
 *
 * Uma ficha por vaza apostada, lado a lado no feltro — nunca empilhadas. A
 * ficha acende em ouro quando a vaza correspondente é ganha; vaza a mais entra
 * como ficha vermelha no fim da fileira.
 *
 * O resultado disso é que a penalidade do jogador fica contável na mesa:
 * `pendentes + excedentes` é exatamente `|palpite − vazas|`, o mesmo número que
 * `handPenalty()` calcula no engine. O teste amarra as duas coisas.
 *
 * Tudo aqui é contagem e layout — o desenho de cada peça mora em `markers.ts` e
 * `Marker.tsx`. Trocar ficha por tampinha não mexe em nada deste arquivo.
 */

import { CORES } from './markers';

export interface ChipRow {
  /** Vazas apostadas que já foram ganhas — fichas de ouro. */
  cumpridas: number;
  /** Vazas apostadas que ainda faltam — fichas apagadas. */
  pendentes: number;
  /** Vazas ganhas além do palpite — fichas vermelhas. */
  excedentes: number;
}

export function chipsFor(bid: number | null, tricksWon: number): ChipRow {
  const palpite = bid ?? 0;
  return {
    cumpridas: Math.min(palpite, tricksWon),
    pendentes: Math.max(0, palpite - tricksWon),
    excedentes: Math.max(0, tricksWon - palpite),
  };
}

export function totalChips(row: ChipRow): number {
  return row.cumpridas + row.pendentes + row.excedentes;
}

/** O erro que a fileira representa — bate com `handPenalty` do engine. */
export function penaltyFromChips(row: ChipRow): number {
  return row.pendentes + row.excedentes;
}

/**
 * Fichas por fileira. Em mesa de 2 ou 3 jogadores a mão chega a 20 cartas, e
 * vinte fichas numa linha só viram um borrão — acima de 8 quebramos em grupos
 * de 5, como marcação de contagem, que continua contável de relance.
 */
export function chipsPerRow(total: number): number {
  return total > 8 ? 5 : total;
}

/** Diâmetro da ficha em pixels: encolhe conforme a fileira cresce. */
export function chipSize(total: number): number {
  if (total <= 5) return 20;
  if (total <= 10) return 16;
  return 13;
}

/**
 * A que vaga da fileira cada vaza ganha corresponde.
 *
 * A fileira é desenhada como `[cumpridas..., pendentes..., excedentes...]`, mas
 * as fichas que representam vazas de verdade são as douradas e as vermelhas —
 * as apagadas são promessa, não resultado. Esta função devolve, para cada
 * posição da fileira, a ordem da vaza que ela representa, ou `null` quando a
 * ficha não corresponde a vaza nenhuma.
 */
export function vazaDaFicha(row: ChipRow): (number | null)[] {
  const marcas: (number | null)[] = [];
  for (let i = 0; i < row.cumpridas; i++) marcas.push(i);
  for (let i = 0; i < row.pendentes; i++) marcas.push(null);
  for (let i = 0; i < row.excedentes; i++) marcas.push(row.cumpridas + i);
  return marcas;
}

/**
 * O índice, entre todas as vazas da mão, da `ordem`-ésima vaza ganha por um
 * jogador. `-1` quando não existe.
 */
export function vazaAbsoluta(
  vencedores: readonly (string | null)[],
  playerId: string,
  ordem: number,
): number {
  let contador = 0;
  for (let i = 0; i < vencedores.length; i++) {
    if (vencedores[i] !== playerId) continue;
    if (contador === ordem) return i;
    contador++;
  }
  return -1;
}

/**
 * Cor da ficha de cada assento. É a mesma paleta que o jogador escolhe no
 * perfil (`CORES`), na ordem: oito cores para oito assentos, nenhuma repetida.
 */
export function chipColors(seat: number): { body: string; edge: string } {
  const cor = CORES[seat % CORES.length]!;
  return { body: cor.body, edge: cor.edge };
}
