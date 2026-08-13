/**
 * Preferências de apresentação e perfil do jogador.
 *
 * Não entram no `GameConfig`: aquilo é a configuração do engine, e o engine não
 * tem opinião sobre ritmo de animação, palavrão nem com o que se aposta.
 */

import { COR_PADRAO, MARCADOR_PADRAO, isCorId, isMarcadorId } from '../ui/casino/markers';
import type { CorId, MarcadorId } from '../ui/casino/markers';
import type { Registro } from '../theater/triggers';

export interface UiSettings {
  registro: Registro;
  /** Multiplicador do ritmo da mesa. Menor = mais rápido. */
  ritmo: number;
  /** Como o jogador aparece na mesa. */
  apelido: string;
  /** Com o que ele marca as apostas dele no feltro. */
  marcador: MarcadorId;
  corMarcador: CorId;
}

export const RITMOS: { value: number; label: string; hint: string }[] = [
  { value: 0.6, label: 'Rápido', hint: 'mesa apressada' },
  { value: 1, label: 'Normal', hint: 'dá tempo de ler as falas' },
  { value: 1.5, label: 'Cinema', hint: 'cada carta com seu momento' },
];

export const APELIDO_PADRAO = 'Você';

/** Cabe na plaqueta do assento sem truncar em mesa cheia. */
export const APELIDO_MAX = 14;

export const SETTINGS_PADRAO: UiSettings = {
  registro: 'solto',
  ritmo: 1,
  apelido: APELIDO_PADRAO,
  marcador: MARCADOR_PADRAO,
  corMarcador: COR_PADRAO,
};

const KEY = 'fodinha.ui';

/** Sem nome, o jogador vira "Você" de novo — a mesa nunca fica com assento mudo. */
export function normalizarApelido(bruto: string): string {
  const limpo = bruto.trim().slice(0, APELIDO_MAX);
  return limpo === '' ? APELIDO_PADRAO : limpo;
}

/**
 * Cada campo é validado por conta própria e cai no padrão se vier estranho.
 * É isso que faz o payload gravado por uma versão anterior — sem apelido, sem
 * marcador — continuar carregando sem migração nenhuma.
 */
export function carregarSettings(): UiSettings {
  try {
    const bruto = localStorage.getItem(KEY);
    if (!bruto) return SETTINGS_PADRAO;
    const lido = JSON.parse(bruto) as Partial<UiSettings>;
    return {
      registro: ['leve', 'bar', 'solto'].includes(lido.registro as string)
        ? (lido.registro as Registro)
        : SETTINGS_PADRAO.registro,
      ritmo: typeof lido.ritmo === 'number' && lido.ritmo > 0 ? lido.ritmo : SETTINGS_PADRAO.ritmo,
      apelido:
        typeof lido.apelido === 'string' ? normalizarApelido(lido.apelido) : SETTINGS_PADRAO.apelido,
      marcador: isMarcadorId(lido.marcador) ? lido.marcador : SETTINGS_PADRAO.marcador,
      corMarcador: isCorId(lido.corMarcador) ? lido.corMarcador : SETTINGS_PADRAO.corMarcador,
    };
  } catch {
    return SETTINGS_PADRAO;
  }
}

export function salvarSettings(settings: UiSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Sem storage a preferência só não sobrevive ao reload.
  }
}
