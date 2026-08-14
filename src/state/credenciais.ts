/**
 * As regras de um apelido e de uma senha aceitáveis.
 *
 * Fica em `src/` e não em `server/` porque as duas pontas precisam dela: o
 * servidor para validar de verdade, a tela de login para não prometer o que o
 * servidor vai recusar. A direção de dependência do projeto é `server/` →
 * `src/`, nunca o contrário.
 *
 * Módulo puro, sem tipos do Cloudflare — é o que permite testá-lo direto.
 *
 * O apelido reusa `normalizarApelido()`, que já é a fonte da verdade do limite
 * de 14 caracteres: a plaqueta do assento trunca acima disso, e uma conta com
 * nome que não cabe na mesa não serve.
 */

import { APELIDO_MAX, normalizarApelido } from './apelido';

export const SENHA_MIN = 8;

/**
 * Curto o bastante para nenhuma senha razoável esbarrar, e curto o bastante
 * para ninguém mandar um megabyte e fazer o PBKDF2 mastigar o CPU do Worker.
 */
export const SENHA_MAX = 200;

export interface Credenciais {
  /** Chave única, sempre em minúsculas. É por ela que o login procura. */
  handle: string;
  /** Como o apelido foi digitado. É o que aparece na mesa. */
  display: string;
  senha: string;
}

export type Validacao = { ok: true; valor: Credenciais } | { ok: false; erro: string };

/**
 * O apelido é único sem diferenciar maiúsculas — "GIka" e "gika" são a mesma
 * pessoa para o banco — mas o jogador continua sentando à mesa com a grafia que
 * escolheu. Daí os dois campos.
 */
export function validarCredenciais(apelido: unknown, senha: unknown): Validacao {
  if (typeof apelido !== 'string' || typeof senha !== 'string') {
    return { ok: false, erro: 'Apelido e senha são obrigatórios.' };
  }

  const display = normalizarApelido(apelido);

  // `normalizarApelido` devolve o padrão "Você" para entrada vazia. Serve para a
  // mesa nunca ficar com assento mudo, mas como nome de conta é uma armadilha:
  // o primeiro a se cadastrar sem digitar nada tomaria o apelido para si.
  if (apelido.trim() === '') {
    return { ok: false, erro: 'Escolha um apelido.' };
  }

  if (!/^[\p{L}\p{N} ._-]+$/u.test(display)) {
    return { ok: false, erro: 'O apelido aceita letras, números, espaço, ponto, hífen e _.' };
  }

  if (senha.length < SENHA_MIN) {
    return { ok: false, erro: `A senha precisa de pelo menos ${SENHA_MIN} caracteres.` };
  }

  if (senha.length > SENHA_MAX) {
    return { ok: false, erro: 'Senha longa demais.' };
  }

  return { ok: true, valor: { handle: display.toLowerCase(), display, senha } };
}

export { APELIDO_MAX };
