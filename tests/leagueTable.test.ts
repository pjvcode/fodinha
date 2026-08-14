import { describe, expect, it } from 'vitest';

import { classificar } from '../src/state/leagueTable';
import type { AgregadoJogador } from '../src/state/leagueTable';

function jogador(
  display: string,
  partidas: number,
  vitorias: number,
  penalidadeTotal: number,
): AgregadoJogador {
  return { userId: display.toLowerCase(), display, partidas, vitorias, penalidadeTotal, melhor: 0 };
}

describe('classificar', () => {
  it('ordena por vitórias e devolve a posição', () => {
    const t = classificar([
      jogador('Nabas', 10, 2, 100),
      jogador('GIka', 10, 5, 120),
      jogador('Dizão', 10, 3, 90),
    ]);
    expect(t.map((l) => l.display)).toEqual(['GIka', 'Dizão', 'Nabas']);
    expect(t.map((l) => l.posicao)).toEqual([1, 2, 3]);
  });

  it('empatou em vitórias, decide a menor média', () => {
    const t = classificar([
      jogador('Perna', 10, 4, 150),
      jogador('Alê', 10, 4, 80),
    ]);
    expect(t.map((l) => l.display)).toEqual(['Alê', 'Perna']);
  });

  it('a média, não o total — quem joga mais não é punido por isso', () => {
    // Mesma média de erro (10/partida) e mesmas vitórias: quem jogou 30
    // partidas não pode ficar atrás de quem jogou 3 só por ter somado mais.
    const t = classificar([
      jogador('Maratonista', 30, 5, 300),
      jogador('Ocasional', 3, 5, 30),
    ]);
    expect(t[0]!.posicao).toBe(1);
    expect(t[1]!.posicao).toBe(1);
    expect(t[0]!.media).toBe(10);
    expect(t[1]!.media).toBe(10);
  });

  it('empate real divide a posição, e a seguinte pula', () => {
    const t = classificar([
      jogador('A', 10, 5, 100),
      jogador('B', 10, 5, 100),
      jogador('C', 10, 1, 100),
    ]);
    expect(t.map((l) => l.posicao)).toEqual([1, 1, 3]);
  });

  it('empate completo tem ordem estável, e não a do banco', () => {
    const a = classificar([jogador('Zeca', 5, 2, 50), jogador('Ana', 5, 2, 50)]);
    const b = classificar([jogador('Ana', 5, 2, 50), jogador('Zeca', 5, 2, 50)]);
    expect(a.map((l) => l.display)).toEqual(b.map((l) => l.display));
    expect(a.map((l) => l.display)).toEqual(['Ana', 'Zeca']);
  });

  it('jogador sem partida não divide por zero', () => {
    const t = classificar([jogador('Fantasma', 0, 0, 0)]);
    expect(t[0]!.media).toBe(0);
    expect(Number.isFinite(t[0]!.media)).toBe(true);
  });

  it('liga vazia devolve tabela vazia', () => {
    expect(classificar([])).toEqual([]);
  });
});
