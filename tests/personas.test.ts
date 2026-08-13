import { describe, expect, it } from 'vitest';

import { FALAS_COMUNS, PERSONAS, falasDe, personaPara } from '../src/theater/personas';
import { REGISTROS, TRIGGERS } from '../src/theater/triggers';
import type { Registro, Trigger } from '../src/theater/triggers';

const GATILHOS = Object.keys(TRIGGERS) as Trigger[];
const REGISTROS_IDS = REGISTROS.map((r) => r.value);

describe('cobertura das falas', () => {
  it('o pool comum cobre todos os gatilhos em todos os registros', () => {
    for (const gatilho of GATILHOS) {
      for (const registro of REGISTROS_IDS) {
        const falas = FALAS_COMUNS[gatilho]?.[registro];
        expect(falas, `${gatilho} / ${registro}`).toBeDefined();
        expect(falas!.length, `${gatilho} / ${registro}`).toBeGreaterThan(0);
      }
    }
  });

  it('toda persona tem o que dizer em todo gatilho e registro', () => {
    for (const persona of PERSONAS) {
      for (const gatilho of GATILHOS) {
        for (const registro of REGISTROS_IDS) {
          const falas = falasDe(persona, gatilho, registro);
          expect(falas.length, `${persona.id} / ${gatilho} / ${registro}`).toBeGreaterThan(0);
          for (const f of falas) expect(f.trim()).not.toBe('');
        }
      }
    }
  });

  it('nenhum pool repete a mesma frase', () => {
    const checar = (falas: string[] | undefined, onde: string) => {
      if (!falas) return;
      expect(new Set(falas).size, onde).toBe(falas.length);
    };
    for (const gatilho of GATILHOS) {
      for (const registro of REGISTROS_IDS) {
        checar(FALAS_COMUNS[gatilho]?.[registro], `comum/${gatilho}/${registro}`);
        for (const p of PERSONAS) {
          checar(p.falas[gatilho]?.[registro], `${p.id}/${gatilho}/${registro}`);
        }
      }
    }
  });
});

describe('registros', () => {
  it('a persona sobrescreve o pool comum quando tem fala própria', () => {
    const zoeiro = PERSONAS.find((p) => p.id === 'zoeiro')!;
    expect(falasDe(zoeiro, 'manilha', 'bar')).toEqual(zoeiro.falas.manilha!.bar);
    expect(falasDe(zoeiro, 'manilha', 'bar')).not.toEqual(FALAS_COMUNS.manilha!.bar);
  });

  it('sem fala própria, cai no pool comum', () => {
    const zoeiro = PERSONAS.find((p) => p.id === 'zoeiro')!;
    expect(zoeiro.falas.melou).toBeUndefined();
    expect(falasDe(zoeiro, 'melou', 'solto')).toEqual(FALAS_COMUNS.melou!.solto);
  });

  it('o registro leve não usa palavrão', () => {
    const proibido = /\b(porra|caralho|foda|fodeu|puta|viado|otário|desgraçad|merda|cagad|safado)/i;
    for (const gatilho of GATILHOS) {
      for (const fala of FALAS_COMUNS[gatilho]?.leve ?? []) {
        expect(fala, `comum/${gatilho}`).not.toMatch(proibido);
      }
      for (const p of PERSONAS) {
        for (const fala of p.falas[gatilho]?.leve ?? []) {
          expect(fala, `${p.id}/${gatilho}`).not.toMatch(proibido);
        }
      }
    }
  });

  it('o registro solto é de fato mais pesado que o leve', () => {
    // Não precisa ser em todo gatilho, mas na maioria tem que haver diferença.
    let diferentes = 0;
    for (const gatilho of GATILHOS) {
      const leve = FALAS_COMUNS[gatilho]?.leve?.join('|');
      const solto = FALAS_COMUNS[gatilho]?.solto?.join('|');
      if (leve !== solto) diferentes++;
    }
    expect(diferentes).toBe(GATILHOS.length);
  });
});

describe('atribuição de persona', () => {
  it('cada assento tem a sua, estável', () => {
    expect(personaPara(1).id).toBe(personaPara(1).id);
    expect(personaPara(1).id).not.toBe(personaPara(2).id);
  });

  it('mesa de 8 dá a volta sem quebrar', () => {
    for (let seat = 0; seat < 8; seat++) {
      expect(personaPara(seat)).toBeDefined();
    }
    expect(personaPara(PERSONAS.length)).toEqual(personaPara(0));
  });

  it('cada persona tem voz própria no texto, não só no pool comum', () => {
    // Sem áudio, a personalidade vive inteira nas frases: uma persona que não
    // sobrescreve nada soaria igual a todas as outras.
    for (const p of PERSONAS) {
      expect(Object.keys(p.falas).length, p.id).toBeGreaterThan(0);
    }
  });

  it('duas personas não dizem a mesma coisa no mesmo gatilho', () => {
    for (const gatilho of GATILHOS) {
      const vistas = new Map<string, string>();
      for (const p of PERSONAS) {
        for (const fala of p.falas[gatilho]?.solto ?? []) {
          expect(vistas.has(fala), `"${fala}" em ${vistas.get(fala)} e ${p.id}`).toBe(false);
          vistas.set(fala, p.id);
        }
      }
    }
  });

  it('a tagarelice fica numa faixa sensata', () => {
    for (const p of PERSONAS) {
      expect(p.tagarelice).toBeGreaterThan(0);
      expect(p.tagarelice).toBeLessThanOrEqual(1);
    }
  });
});
