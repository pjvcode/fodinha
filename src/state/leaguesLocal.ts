/**
 * O histórico de liga guardado no navegador.
 *
 * Continua existindo depois do login por um motivo: quem joga sem conta também
 * merece ver as próprias partidas. Logado, a fonte passa a ser o servidor, que
 * é o único lugar onde a classificação entre pessoas pode existir.
 *
 * Separado de `leagues.ts` porque aquele módulo é compartilhado com o servidor,
 * e no Worker não existe `localStorage`.
 */

import type { ResultadoLiga } from './leagues';

const KEY = 'desafio.ligas';

type Guardado = Record<string, ResultadoLiga[]>;

function carregarTudo(): Guardado {
  try {
    const bruto = localStorage.getItem(KEY);
    if (!bruto) return {};
    const lido = JSON.parse(bruto) as unknown;
    return lido && typeof lido === 'object' ? (lido as Guardado) : {};
  } catch {
    return {};
  }
}

/** Resultados de uma liga, do mais recente para o mais antigo. */
export function carregarResultados(ligaId: string): ResultadoLiga[] {
  const guardado = carregarTudo();
  const lista = guardado[ligaId];
  return Array.isArray(lista) ? lista : [];
}

/** Grava um resultado no topo do histórico da liga. */
export function salvarResultado(ligaId: string, resultado: ResultadoLiga): void {
  try {
    const guardado = carregarTudo();
    const lista = Array.isArray(guardado[ligaId]) ? guardado[ligaId]! : [];
    guardado[ligaId] = [resultado, ...lista];
    localStorage.setItem(KEY, JSON.stringify(guardado));
  } catch {
    // Sem storage o resultado só não sobrevive ao reload.
  }
}
