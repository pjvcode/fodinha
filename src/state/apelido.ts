/**
 * O apelido do jogador, sozinho.
 *
 * Estava em `settings.ts`, mas aquele módulo toca `localStorage` e o servidor
 * não tem um. Como a regra do apelido passou a valer nos dois lados — a mesa
 * mostra, a conta guarda —, ela vem para cá, sem depender de nada.
 *
 * `settings.ts` reexporta o que está aqui, então quem já importava de lá
 * continua funcionando.
 */

export const APELIDO_PADRAO = 'Você';

/** Cabe na plaqueta do assento sem truncar em mesa cheia. */
export const APELIDO_MAX = 14;

/** Sem nome, o jogador vira "Você" de novo — a mesa nunca fica com assento mudo. */
export function normalizarApelido(bruto: string): string {
  const limpo = bruto.trim().slice(0, APELIDO_MAX);
  return limpo === '' ? APELIDO_PADRAO : limpo;
}
