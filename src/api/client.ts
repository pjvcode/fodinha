/**
 * A conversa com o Worker.
 *
 * Erro de rede, 4xx e corpo ilegível saem todos como `{ ok: false, erro }` — a
 * UI nunca precisa de try/catch, e o `erro` já vem numa frase que dá para
 * mostrar na tela. É o mesmo espírito do `reduce()`, que devolve
 * `INVALID_ACTION` em vez de lançar.
 */

export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };

export interface Usuario {
  id: string;
  handle: string;
  display: string;
}

/**
 * `credentials: 'same-origin'` porque a sessão é um cookie `HttpOnly` — não há
 * token para anexar à mão, e não há token exposto a script nenhum.
 */
async function api<T>(caminho: string, init?: RequestInit): Promise<Resposta<T>> {
  let res: Response;
  try {
    res = await fetch(caminho, {
      ...init,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor.' };
  }

  let corpo: unknown = null;
  try {
    corpo = await res.json();
  } catch {
    // Corpo vazio ou não-JSON. O status ainda decide.
  }

  const mensagem =
    corpo !== null && typeof corpo === 'object' && typeof (corpo as { erro?: unknown }).erro === 'string'
      ? (corpo as { erro: string }).erro
      : `Falha na requisição (${res.status}).`;

  if (!res.ok) return { ok: false, erro: mensagem };
  return { ok: true, dados: corpo as T };
}

function post<T>(caminho: string, corpo: unknown): Promise<Resposta<T>> {
  return api<T>(caminho, { method: 'POST', body: JSON.stringify(corpo) });
}

export function apiCadastro(apelido: string, senha: string) {
  return post<{ usuario: Usuario }>('/api/auth/signup', { apelido, senha });
}

export function apiLogin(apelido: string, senha: string) {
  return post<{ usuario: Usuario }>('/api/auth/login', { apelido, senha });
}

export function apiLogout() {
  return post<{ ok: true }>('/api/auth/logout', {});
}

export function apiEu() {
  return api<{ usuario: Usuario }>('/api/auth/me');
}
