import { describe, expect, it } from 'vitest';

import {
  clampSequenceTail,
  handSizeSequence,
  hasVira,
  maxHandSize,
  naturalMaxHandSize,
} from '../src/engine/progression';
import { defaultConfig, defaultPlayers } from '../src/engine/reducer';

const cfg = (n: number, overrides = {}) =>
  defaultConfig({ players: defaultPlayers(n), ...overrides });

describe('naturalMaxHandSize — C_max = piso(40 / N)', () => {
  const table: [number, number][] = [
    [2, 20],
    [3, 13],
    [4, 10],
    [5, 8],
    [6, 6],
    [7, 5],
    [8, 5],
  ];

  it.each(table)('%i jogadores → %i cartas', (n, expected) => {
    expect(naturalMaxHandSize(n)).toBe(expected);
  });

  it('recusa mesas fora de 2..8', () => {
    expect(() => naturalMaxHandSize(1)).toThrow();
    expect(() => naturalMaxHandSize(9)).toThrow();
  });
});

describe('hasVira — sobra carta para virar?', () => {
  it('não sobra exatamente quando h × N === 40', () => {
    const semVira: [number, number][] = [
      [20, 2],
      [10, 4],
      [8, 5],
      [5, 8],
    ];
    for (const [h, n] of semVira) {
      expect(hasVira(h, n)).toBe(false);
    }
  });

  it('sobra carta no C_max de 3, 6 e 7 jogadores', () => {
    expect(hasVira(13, 3)).toBe(true); // 39 cartas
    expect(hasVira(6, 6)).toBe(true); // 36 cartas
    expect(hasVira(5, 7)).toBe(true); // 35 cartas
  });

  it('sobra carta em qualquer mão abaixo do máximo', () => {
    expect(hasVira(9, 4)).toBe(true);
    expect(hasVira(1, 8)).toBe(true);
  });
});

describe('maxHandSize com teto configurado', () => {
  it('sem teto usa o C_max natural', () => {
    expect(maxHandSize(4, cfg(4))).toBe(10);
  });

  it('o teto limita, mas nunca ultrapassa o natural', () => {
    expect(maxHandSize(4, cfg(4, { maxCardsCap: 5 }))).toBe(5);
    expect(maxHandSize(8, cfg(8, { maxCardsCap: 99 }))).toBe(5);
  });
});

describe('handSizeSequence', () => {
  const table: [number, number, number][] = [
    // [jogadores, máximo, total de mãos]
    [2, 20, 39],
    [3, 13, 25],
    [4, 10, 19],
    [5, 8, 15],
    [6, 6, 11],
    [7, 5, 9],
    [8, 5, 9],
  ];

  it.each(table)('%i jogadores → sobe até %i em %i mãos', (n, max, total) => {
    const seq = handSizeSequence(n, cfg(n));
    expect(seq).toHaveLength(total);
    expect(seq[0]).toBe(1);
    expect(seq[seq.length - 1]).toBe(1);
    expect(Math.max(...seq)).toBe(max);
    expect(seq.filter((h) => h === max)).toHaveLength(1);
  });

  it('sobe de 1 em 1 e desce de 1 em 1', () => {
    const seq = handSizeSequence(8, cfg(8));
    expect(seq).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
  });

  it('respeita o teto configurado', () => {
    expect(handSizeSequence(4, cfg(4, { maxCardsCap: 5 }))).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
  });

  it('repeatMaxHand duplica o ponto de virada', () => {
    expect(handSizeSequence(4, cfg(4, { maxCardsCap: 3, repeatMaxHand: true }))).toEqual([
      1, 2, 3, 3, 2, 1,
    ]);
  });

  it('progression down-up começa no máximo e vira no 1', () => {
    expect(handSizeSequence(4, cfg(4, { maxCardsCap: 3, progression: 'down-up' }))).toEqual([
      3, 2, 1, 2, 3,
    ]);
  });

  it('teto de 1 carta degenera para uma única mão', () => {
    expect(handSizeSequence(4, cfg(4, { maxCardsCap: 1 }))).toEqual([1]);
  });
});

describe('clampSequenceTail', () => {
  it('limita só o que vem depois do índice atual', () => {
    const seq = [1, 2, 3, 4, 5, 4, 3, 2, 1];
    expect(clampSequenceTail(seq, 3, 4)).toEqual([1, 2, 3, 4, 4, 4, 3, 2, 1]);
  });

  it('preserva o comprimento da sequência', () => {
    const seq = handSizeSequence(8, cfg(8));
    expect(clampSequenceTail(seq, 0, 2)).toHaveLength(seq.length);
  });
});
