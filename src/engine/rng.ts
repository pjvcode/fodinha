/**
 * PRNG mulberry32 em estilo funcional puro.
 *
 * O estado é um único uint32, então cabe dentro do `MatchState` e sobrevive a
 * `JSON.stringify`. Toda função devolve o novo estado em vez de mutar — é o que
 * torna a partida inteira reproduzível a partir da seed.
 */

export interface RngDraw<T> {
  value: T;
  state: number;
}

export function seedFrom(input: number): number {
  return input >>> 0;
}

/** Semente não determinística, para quando o jogador não informa uma. */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 0x100000000) ^ Date.now()) >>> 0;
}

export function nextUint32(state: number): RngDraw<number> {
  const s = (state + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: s >>> 0 };
}

/** Float uniforme em [0, 1). */
export function nextFloat(state: number): RngDraw<number> {
  const draw = nextUint32(state);
  return { value: draw.value / 0x100000000, state: draw.state };
}

/** Inteiro uniforme em [0, maxExclusive). */
export function nextInt(state: number, maxExclusive: number): RngDraw<number> {
  if (maxExclusive <= 1) return { value: 0, state };
  const draw = nextFloat(state);
  return { value: Math.floor(draw.value * maxExclusive), state: draw.state };
}

/** Elemento uniforme de um array não vazio. */
export function pick<T>(state: number, items: readonly T[]): RngDraw<T> {
  if (items.length === 0) throw new Error('pick: array vazio');
  const draw = nextInt(state, items.length);
  return { value: items[draw.value]!, state: draw.state };
}
