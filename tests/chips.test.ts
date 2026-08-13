import { describe, expect, it } from 'vitest';

import { handPenalty } from '../src/engine/scoring';
import {
  chipColors,
  chipSize,
  chipsFor,
  chipsPerRow,
  penaltyFromChips,
  totalChips,
  vazaAbsoluta,
  vazaDaFicha,
} from '../src/ui/casino/chips';

describe('chipsFor', () => {
  it('palpite batido na mosca: tudo em ouro', () => {
    expect(chipsFor(3, 3)).toEqual({ cumpridas: 3, pendentes: 0, excedentes: 0 });
  });

  it('faltando vaza: as que faltam ficam apagadas', () => {
    expect(chipsFor(3, 2)).toEqual({ cumpridas: 2, pendentes: 1, excedentes: 0 });
  });

  it('vaza a mais: entra ficha vermelha', () => {
    expect(chipsFor(1, 3)).toEqual({ cumpridas: 1, pendentes: 0, excedentes: 2 });
  });

  it('apostou zero e não fez nada: fileira vazia', () => {
    expect(chipsFor(0, 0)).toEqual({ cumpridas: 0, pendentes: 0, excedentes: 0 });
  });

  it('apostou zero e levou vaza: só fichas vermelhas', () => {
    expect(chipsFor(0, 2)).toEqual({ cumpridas: 0, pendentes: 0, excedentes: 2 });
  });

  it('antes de palpitar, trata como zero', () => {
    expect(chipsFor(null, 0)).toEqual({ cumpridas: 0, pendentes: 0, excedentes: 0 });
    expect(chipsFor(null, 2).excedentes).toBe(2);
  });
});

describe('as fichas contam a penalidade', () => {
  // É esta a razão de ser do desenho: a fileira na mesa mostra, sem número,
  // exatamente o que o engine vai cobrar no fim da mão.
  it('pendentes + excedentes é sempre |palpite − vazas|', () => {
    for (let bid = 0; bid <= 10; bid++) {
      for (let vazas = 0; vazas <= 10; vazas++) {
        expect(penaltyFromChips(chipsFor(bid, vazas))).toBe(handPenalty(bid, vazas));
      }
    }
  });

  it('o total de fichas é o maior entre palpite e vazas', () => {
    for (let bid = 0; bid <= 8; bid++) {
      for (let vazas = 0; vazas <= 8; vazas++) {
        expect(totalChips(chipsFor(bid, vazas))).toBe(Math.max(bid, vazas));
      }
    }
  });

  it('mão perfeita não deixa nenhuma ficha fora do ouro', () => {
    const row = chipsFor(4, 4);
    expect(penaltyFromChips(row)).toBe(0);
    expect(row.cumpridas).toBe(totalChips(row));
  });
});

describe('layout da fileira', () => {
  it('até oito fichas cabem numa linha só', () => {
    expect(chipsPerRow(1)).toBe(1);
    expect(chipsPerRow(8)).toBe(8);
  });

  it('acima de oito quebra em grupos de cinco, como marcação de contagem', () => {
    expect(chipsPerRow(9)).toBe(5);
    expect(chipsPerRow(20)).toBe(5);
  });

  it('a ficha encolhe conforme a fileira cresce, mas nunca some', () => {
    expect(chipSize(3)).toBeGreaterThan(chipSize(9));
    expect(chipSize(9)).toBeGreaterThan(chipSize(20));
    expect(chipSize(20)).toBeGreaterThan(10);
  });
});

describe('ficha → vaza', () => {
  it('as douradas apontam para as vazas na ordem em que foram ganhas', () => {
    expect(vazaDaFicha(chipsFor(3, 3))).toEqual([0, 1, 2]);
  });

  it('a apagada não aponta para vaza nenhuma: é promessa, não resultado', () => {
    expect(vazaDaFicha(chipsFor(3, 1))).toEqual([0, null, null]);
  });

  it('as vermelhas continuam a contagem depois das apagadas', () => {
    // Apostou 2, fez 4: duas douradas (vazas 0 e 1) e duas vermelhas (2 e 3).
    expect(vazaDaFicha(chipsFor(2, 4))).toEqual([0, 1, 2, 3]);
  });

  it('apostou zero e levou vazas: só vermelhas, começando do zero', () => {
    expect(vazaDaFicha(chipsFor(0, 2))).toEqual([0, 1]);
  });

  it('há exatamente uma ficha clicável por vaza ganha', () => {
    for (let bid = 0; bid <= 6; bid++) {
      for (let vazas = 0; vazas <= 6; vazas++) {
        const marcas = vazaDaFicha(chipsFor(bid, vazas)).filter((m) => m !== null);
        expect(marcas).toHaveLength(vazas);
        expect(new Set(marcas).size).toBe(vazas);
      }
    }
  });
});

describe('vazaAbsoluta', () => {
  const vencedores = ['p1', 'p0', 'p1', 'p2', 'p1'];

  it('acha a n-ésima vaza ganha por um jogador', () => {
    expect(vazaAbsoluta(vencedores, 'p1', 0)).toBe(0);
    expect(vazaAbsoluta(vencedores, 'p1', 1)).toBe(2);
    expect(vazaAbsoluta(vencedores, 'p1', 2)).toBe(4);
    expect(vazaAbsoluta(vencedores, 'p0', 0)).toBe(1);
  });

  it('devolve -1 quando a vaza pedida não existe', () => {
    expect(vazaAbsoluta(vencedores, 'p1', 3)).toBe(-1);
    expect(vazaAbsoluta(vencedores, 'p3', 0)).toBe(-1);
    expect(vazaAbsoluta([], 'p0', 0)).toBe(-1);
  });

  it('vaza melada não tem dono e não conta para ninguém', () => {
    expect(vazaAbsoluta(['p0', null, 'p0'], 'p0', 1)).toBe(2);
    expect(vazaAbsoluta([null, null], 'p0', 0)).toBe(-1);
  });

  it('a ficha e a vaza casam de ponta a ponta', () => {
    // Um jogador que apostou 1 e fez 3 tem três fichas clicáveis; cada uma
    // precisa abrir uma vaza diferente e existente.
    const marcas = vazaDaFicha(chipsFor(1, 3)).filter((m): m is number => m !== null);
    const abertas = marcas.map((ordem) => vazaAbsoluta(vencedores, 'p1', ordem));
    expect(abertas).toEqual([0, 2, 4]);
  });
});

describe('cores das fichas', () => {
  it('cada assento tem a sua cor', () => {
    expect(chipColors(0)).not.toEqual(chipColors(1));
  });

  it('mesa de 8 não repete cor', () => {
    const cores = new Set(Array.from({ length: 8 }, (_, i) => chipColors(i).body));
    expect(cores.size).toBe(8);
  });

  it('índice fora da faixa dá a volta em vez de quebrar', () => {
    expect(chipColors(8)).toEqual(chipColors(0));
  });
});
