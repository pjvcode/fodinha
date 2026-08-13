import { describe, expect, it } from 'vitest';

import { CARD_WIDTH } from '../src/ui/CardView';
import { fanGeometry } from '../src/ui/HandFan';
import type { Tela } from '../src/ui/useTela';

const JANELA: Tela = { estreita: false, baixa: false };
const CELULAR: Tela = { estreita: true, baixa: false };
const DEITADO: Tela = { estreita: false, baixa: true };

/**
 * Largura que o leque ocupa: as cartas se sobrepõem, então cada uma depois da
 * primeira só acrescenta `largura − sobreposição`.
 */
function larguraDoLeque(count: number, tela: Tela): number {
  const { overlap, size } = fanGeometry(count, tela);
  return count * (CARD_WIDTH[size] - overlap) + overlap;
}

/** Todo tamanho de mão que o jogo produz — 2 jogadores chegam a 20 cartas. */
const TAMANHOS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('o leque cabe na tela', () => {
  it.each(TAMANHOS)('%i cartas cabem num celular em pé de 360px', (n) => {
    // 360 menos o respiro lateral da seção que envolve o leque.
    expect(larguraDoLeque(n, CELULAR)).toBeLessThanOrEqual(360 - 16);
  });

  it.each(TAMANHOS)('%i cartas cabem numa janela de 768px', (n) => {
    expect(larguraDoLeque(n, JANELA)).toBeLessThanOrEqual(768 - 24);
  });

  it.each(TAMANHOS)('%i cartas cabem num celular deitado de 640px', (n) => {
    expect(larguraDoLeque(n, DEITADO)).toBeLessThanOrEqual(640 - 16);
  });
});

describe('geometria do leque', () => {
  it('a mão pequena não é comprimida numa tela que só é estreita', () => {
    // Com três cartas há espaço de sobra até no celular em pé: sobrepor seria
    // só dificultar a leitura de graça.
    expect(fanGeometry(3, CELULAR)).toEqual(fanGeometry(3, JANELA));
    expect(fanGeometry(3, CELULAR).size).toBe('lg');
  });

  it('mas encolhe numa tela baixa, onde quem falta é altura', () => {
    // O celular deitado é o caso: sobra largura e mesmo assim mesa, leque e
    // botões de palpite não cabem empilhados.
    expect(fanGeometry(3, DEITADO).size).toBe('md');
    expect(fanGeometry(1, DEITADO).size).toBe('md');
  });

  it('estreita e baixa ao mesmo tempo somam os dois degraus', () => {
    const ambas: Tela = { estreita: true, baixa: true };
    expect(fanGeometry(10, JANELA).size).toBe('lg');
    expect(fanGeometry(10, CELULAR).size).toBe('md');
    expect(fanGeometry(10, ambas).size).toBe('sm');
  });

  it('`sm` é o piso: menor que isso não se lê o índice do canto', () => {
    const ambas: Tela = { estreita: true, baixa: true };
    expect(fanGeometry(20, ambas).size).toBe('sm');
  });

  it('encolher a carta encolhe o leque junto, não espalha as cartas', () => {
    for (const n of TAMANHOS) {
      expect(larguraDoLeque(n, DEITADO)).toBeLessThanOrEqual(larguraDoLeque(n, JANELA));
    }
  });

  it('a carta nunca some inteira sob a vizinha', () => {
    for (const tela of [JANELA, CELULAR, DEITADO, { estreita: true, baixa: true }]) {
      for (const n of TAMANHOS) {
        const { overlap, size } = fanGeometry(n, tela);
        expect(overlap).toBeLessThan(CARD_WIDTH[size]);
      }
    }
  });

  it('mão maior abre mais o leque, nunca menos', () => {
    for (const tela of [JANELA, CELULAR, DEITADO]) {
      let anterior = 0;
      for (const n of TAMANHOS) {
        const { spread } = fanGeometry(n, tela);
        expect(spread).toBeGreaterThanOrEqual(anterior);
        anterior = spread;
      }
    }
  });
});
