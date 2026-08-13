import { describe, expect, it } from 'vitest';

import { chipColors, chipSize } from '../src/ui/casino/chips';
import {
  CORES,
  COR_PADRAO,
  MARCADORES,
  MARCADOR_PADRAO,
  corMarcador,
  isCorId,
  isMarcadorId,
  marcadorSpec,
  markerBox,
} from '../src/ui/casino/markers';

describe('registro de marcadores', () => {
  it('os quatro pedidos estão lá', () => {
    expect(MARCADORES.map((m) => m.id)).toEqual(['ficha', 'tampinha', 'bala', 'ampola']);
  });

  it('cada um tem rótulo e dica próprios', () => {
    const labels = new Set(MARCADORES.map((m) => m.label));
    const hints = new Set(MARCADORES.map((m) => m.hint));
    expect(labels.size).toBe(MARCADORES.length);
    expect(hints.size).toBe(MARCADORES.length);
  });

  it('o padrão é a ficha de pôquer', () => {
    expect(MARCADOR_PADRAO).toBe('ficha');
    expect(marcadorSpec(MARCADOR_PADRAO).id).toBe('ficha');
  });

  // O que chega do localStorage pode ser qualquer coisa: um id de uma versão
  // antiga, lixo, ou nada. Nenhum desses pode quebrar a mesa.
  it('id desconhecido cai no padrão em vez de quebrar', () => {
    expect(marcadorSpec('ficha-de-ouro').id).toBe(MARCADOR_PADRAO);
    expect(marcadorSpec('').id).toBe(MARCADOR_PADRAO);
    expect(isMarcadorId('tampinha')).toBe(true);
    expect(isMarcadorId('tampinha-de-refri')).toBe(false);
    expect(isMarcadorId(undefined)).toBe(false);
    expect(isMarcadorId(7)).toBe(false);
  });
});

describe('paleta', () => {
  it('oito cores, uma por assento numa mesa cheia, nenhuma repetida', () => {
    expect(CORES).toHaveLength(8);
    expect(new Set(CORES.map((c) => c.body)).size).toBe(8);
    expect(new Set(CORES.map((c) => c.id)).size).toBe(8);
  });

  it('é a mesma paleta que colore as fichas por assento', () => {
    for (let seat = 0; seat < 8; seat++) {
      expect(chipColors(seat)).toEqual({ body: CORES[seat]!.body, edge: CORES[seat]!.edge });
    }
    // Assento fora da faixa dá a volta em vez de quebrar.
    expect(chipColors(8)).toEqual(chipColors(0));
  });

  it('cor desconhecida cai no padrão', () => {
    expect(corMarcador('mostarda').id).toBe(COR_PADRAO);
    expect(isCorId('roxo')).toBe(true);
    expect(isCorId('roxa')).toBe(false);
  });
});

describe('markerBox', () => {
  it('marcador redondo ocupa a caixa quadrada da ficha', () => {
    for (const id of ['ficha', 'tampinha', 'bala'] as const) {
      const spec = marcadorSpec(id);
      for (const total of [1, 5, 9, 20]) {
        const size = chipSize(total);
        expect(markerBox(size, spec)).toEqual({ w: size, h: size });
      }
    }
  });

  it('a ampola sai mais estreita e mais alta que a ficha', () => {
    const ampola = marcadorSpec('ampola');
    for (const total of [1, 5, 9, 20]) {
      const size = chipSize(total);
      const caixa = markerBox(size, ampola);
      expect(caixa.w).toBeLessThan(size);
      expect(caixa.h).toBeGreaterThan(size);
    }
  });

  it('encolhe junto com a fileira, como a ficha, e nunca some', () => {
    for (const spec of MARCADORES) {
      const grande = markerBox(chipSize(3), spec);
      const media = markerBox(chipSize(9), spec);
      const pequena = markerBox(chipSize(20), spec);
      expect(grande.w).toBeGreaterThan(media.w);
      expect(media.w).toBeGreaterThan(pequena.w);
      expect(pequena.w).toBeGreaterThan(0);
      expect(pequena.h).toBeGreaterThan(0);
    }
  });
});
