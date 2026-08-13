import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BOTS_POR_MESA,
  NOMES_BOTS,
  carregarResultados,
  configLiga,
  montarJogadoresLiga,
  salvarResultado,
} from '../src/state/leagues';
import type { ResultadoLiga } from '../src/state/leagues';

/** localStorage de mentira, porque os testes rodam fora do browser. */
function fakeStorage(): Storage {
  const dados = new Map<string, string>();
  return {
    get length() {
      return dados.size;
    },
    clear: () => dados.clear(),
    getItem: (k: string) => dados.get(k) ?? null,
    key: (i: number) => [...dados.keys()][i] ?? null,
    removeItem: (k: string) => void dados.delete(k),
    setItem: (k: string, v: string) => void dados.set(k, v),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});

describe('montarJogadoresLiga', () => {
  it('monta mesa de 5: o jogador mais quatro bots difíceis', () => {
    const jogadores = montarJogadoresLiga('Eu');
    expect(jogadores).toHaveLength(BOTS_POR_MESA + 1);

    const humano = jogadores[0]!;
    const bots = jogadores.slice(1);
    expect(humano.isBot).toBe(false);
    expect(humano.name).toBe('Eu');

    expect(bots).toHaveLength(BOTS_POR_MESA);
    for (const b of bots) {
      expect(b.isBot).toBe(true);
      expect(b.botLevel).toBe('hard');
      expect(NOMES_BOTS).toContain(b.name);
    }
  });

  it('sorteia nomes de bots sem repetição', () => {
    for (let i = 0; i < 50; i++) {
      const nomes = montarJogadoresLiga('Eu')
        .filter((p) => p.isBot)
        .map((p) => p.name);
      expect(new Set(nomes).size).toBe(nomes.length);
    }
  });
});

describe('configLiga', () => {
  it('é ida-e-volta completa, penalidade, sem teto de cartas', () => {
    const config = configLiga('Eu', 123);
    expect(config.progression).toBe('up-down');
    expect(config.maxCardsCap).toBeNull();
    expect(config.scoringMode).toBe('penalty');
    expect(config.players).toHaveLength(5);
    expect(config.seed).toBe(123);
  });
});

describe('persistência de resultados', () => {
  const resultado = (nome: string): ResultadoLiga => ({
    id: nome,
    data: new Date().toISOString(),
    jogador: 'Eu',
    vencedores: [nome],
    placar: [{ nome, penalidade: 0 }],
    maos: [],
  });

  it('faz round-trip com o mais recente no topo', () => {
    expect(carregarResultados('esquadrilha')).toEqual([]);

    salvarResultado('esquadrilha', resultado('primeira'));
    salvarResultado('esquadrilha', resultado('segunda'));

    const lista = carregarResultados('esquadrilha');
    expect(lista.map((r) => r.id)).toEqual(['segunda', 'primeira']);
  });

  it('não vaza resultados entre ligas', () => {
    salvarResultado('esquadrilha', resultado('e1'));
    salvarResultado('doubled', resultado('d1'));

    expect(carregarResultados('esquadrilha').map((r) => r.id)).toEqual(['e1']);
    expect(carregarResultados('doubled').map((r) => r.id)).toEqual(['d1']);
  });
});
