/**
 * Hash de senha e comparação, sobre `crypto.subtle` e nada mais.
 *
 * Módulo puro no mesmo espírito de `src/engine/`: não conhece D1, não conhece
 * `Request`, não importa um único tipo do Cloudflare. É isso que o deixa
 * testável no Vitest em ambiente `node`, sem subir `workerd`.
 *
 * PBKDF2 porque é o que o WebCrypto dos Workers oferece — scrypt e Argon2 não
 * existem lá, e trazer uma implementação em JS custaria mais tempo de CPU por
 * requisição do que o orçamento de um Worker admite.
 */

/**
 * Alto o suficiente para doer num ataque de dicionário, baixo o suficiente para
 * caber no limite de CPU de uma requisição. Vai gravado em cada registro: se um
 * dia subir, as senhas antigas continuam conferindo com o número delas.
 */
const ITERACOES = 100_000;

const TAMANHO_SALT = 16;
/** 32 bytes = o tamanho natural da saída do SHA-256. */
const TAMANHO_CHAVE = 32;

function paraBase64(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function derivar(senha: string, salt: Uint8Array, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(senha),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iteracoes, hash: 'SHA-256' },
    chave,
    TAMANHO_CHAVE * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Comparação em tempo constante.
 *
 * Um `===` sobre a base64 vazaria, pelo tempo de resposta, quantos bytes
 * iniciais o atacante acertou — o bastante para descobrir o hash byte a byte.
 * Aqui todo byte é sempre visitado.
 */
function iguaisEmTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i]! ^ b[i]!;
  return diferenca === 0;
}

/** `pbkdf2$<iterações>$<salt em base64>$<chave em base64>` */
export async function hashPassword(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(TAMANHO_SALT));
  const chave = await derivar(senha, salt, ITERACOES);
  return `pbkdf2$${ITERACOES}$${paraBase64(salt)}$${paraBase64(chave)}`;
}

/**
 * Confere a senha contra um registro gravado. Registro malformado é `false`, não
 * exceção: um usuário com hash corrompido não deve derrubar a rota de login.
 */
export async function verifyPassword(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false;

  const iteracoes = Number(partes[1]);
  if (!Number.isInteger(iteracoes) || iteracoes <= 0) return false;

  try {
    const salt = deBase64(partes[2]!);
    const esperada = deBase64(partes[3]!);
    const obtida = await derivar(senha, salt, iteracoes);
    return iguaisEmTempoConstante(obtida, esperada);
  } catch {
    return false;
  }
}

/** Token opaco de sessão: 32 bytes aleatórios em base64url, sem padding. */
export function novoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return paraBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * O que vai para a tabela `sessions`. O token cru só existe no cookie do dono:
 * um vazamento do banco não entrega sessão de ninguém.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return paraBase64(new Uint8Array(digest));
}
