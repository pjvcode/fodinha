/**
 * A conversa com o Worker.
 *
 * Erro de rede, 4xx e corpo ilegível saem todos como `{ ok: false, erro }` — a
 * UI nunca precisa de try/catch, e o `erro` já vem numa frase que dá para
 * mostrar na tela. É o mesmo espírito do `reduce()`, que devolve
 * `INVALID_ACTION` em vez de lançar.
 */

import type { EnvioResultado, LinhaApurada } from '../state/leagueReplay';
import type { LinhaClassificacao } from '../state/leagueTable';

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

// ---------------------------------------------------------------------------
// Liga
// ---------------------------------------------------------------------------

/**
 * Manda a partida terminada. O corpo é a config e o log de ações — não o
 * placar: quem apura é o servidor, reproduzindo a partida. Não há número aqui
 * em que ele precise acreditar.
 */
export function apiRegistrarResultado(ligaId: string, envio: EnvioResultado) {
  return post<ResultadoRegistrado>(`/api/league/${encodeURIComponent(ligaId)}/result`, envio);
}

export function apiClassificacao(ligaId: string) {
  return api<{ classificacao: LinhaClassificacao[] }>(
    `/api/league/${encodeURIComponent(ligaId)}/standings`,
  );
}

export function apiHistoricoLiga(ligaId: string) {
  return api<{ partidas: PartidaRegistrada[] }>(`/api/league/${encodeURIComponent(ligaId)}/me`);
}

export interface PartidaRegistrada {
  id: string;
  data: string;
  won: number;
  penalidade: number;
  posicao: number;
}

export interface ResultadoRegistrado {
  placar: LinhaApurada[];
  vencedores: string[];
  minha: LinhaApurada;
}
