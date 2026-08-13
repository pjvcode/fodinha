import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APELIDO_MAX,
  APELIDO_PADRAO,
  SETTINGS_PADRAO,
  carregarSettings,
  normalizarApelido,
  salvarSettings,
} from '../src/state/settings';

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

describe('normalizarApelido', () => {
  it('corta o excesso e apara os espaços', () => {
    expect(normalizarApelido('  Pedro  ')).toBe('Pedro');
    expect(normalizarApelido('x'.repeat(50))).toHaveLength(APELIDO_MAX);
  });

  it('nome vazio vira o padrão — a mesa nunca fica com assento mudo', () => {
    expect(normalizarApelido('')).toBe(APELIDO_PADRAO);
    expect(normalizarApelido('   ')).toBe(APELIDO_PADRAO);
  });
});

describe('carregarSettings', () => {
  it('sem nada gravado, devolve o padrão', () => {
    expect(carregarSettings()).toEqual(SETTINGS_PADRAO);
  });

  it('ida e volta preserva a escolha do jogador', () => {
    const meu = {
      ...SETTINGS_PADRAO,
      apelido: 'Pedrão',
      marcador: 'ampola' as const,
      corMarcador: 'verde' as const,
      ritmo: 0.6,
    };
    salvarSettings(meu);
    expect(carregarSettings()).toEqual(meu);
  });

  // É este o caminho de quem já jogava antes de existir perfil: o payload
  // gravado não tem apelido nem marcador, e precisa carregar assim mesmo.
  it('payload de uma versão anterior ganha os padrões dos campos novos', () => {
    localStorage.setItem('fodinha.ui', JSON.stringify({ registro: 'bar', ritmo: 1.5 }));
    expect(carregarSettings()).toEqual({
      ...SETTINGS_PADRAO,
      registro: 'bar',
      ritmo: 1.5,
    });
  });

  it('campo inválido cai no padrão sem contaminar os outros', () => {
    localStorage.setItem(
      'fodinha.ui',
      JSON.stringify({ registro: 'grosseirão', ritmo: -3, marcador: 'moeda', corMarcador: 42 }),
    );
    expect(carregarSettings()).toEqual(SETTINGS_PADRAO);
  });

  it('JSON quebrado não derruba a tela', () => {
    localStorage.setItem('fodinha.ui', '{isso não é json');
    expect(carregarSettings()).toEqual(SETTINGS_PADRAO);
  });
});
