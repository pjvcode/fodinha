/**
 * Cadastro, login, logout e "quem sou eu".
 *
 * Este módulo fala com D1 e por isso carrega tipos do Cloudflare — `tests/` não
 * o importa. O que dá para testar sem um banco vive em `password.ts` e
 * `credenciais.ts`, que são puros de propósito.
 */

import { validarCredenciais } from '../src/state/credenciais';
import { paraPublico } from './env';
import type { Env, UsuarioPublico, UsuarioRow } from './env';
import {
  COOKIE_SESSAO,
  VALIDADE_SESSAO_MS,
  cookieDeSessao,
  cookieExpirado,
  erro,
  json,
  lerCookie,
  lerJson,
} from './http';
import { hashPassword, hashToken, novoToken, verifyPassword } from './password';

/**
 * Abre uma sessão e devolve o token cru, que só o cookie do dono verá — a
 * tabela guarda apenas o SHA-256 dele.
 */
async function abrirSessao(env: Env, userId: string): Promise<string> {
  const token = novoToken();
  const expira = new Date(Date.now() + VALIDADE_SESSAO_MS).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await hashToken(token), userId, expira)
    .run();
  return token;
}

/**
 * O usuário da requisição, ou `null`. É o guarda de toda rota autenticada —
 * inclusive do handshake do WebSocket da sala, que chega com o mesmo cookie.
 */
export async function usuarioAtual(req: Request, env: Env): Promise<UsuarioRow | null> {
  const token = lerCookie(req, COOKIE_SESSAO);
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT u.*, s.expires_at AS expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
  )
    .bind(await hashToken(token))
    .first<UsuarioRow & { expires_at: string }>();

  if (!row) return null;

  // Sessão vencida some na hora em que é usada. Sem cron, sem varredura: o
  // custo de limpar recai sobre quem tentou usar, que é quem já está pagando a
  // ida ao banco.
  if (Date.parse(row.expires_at) <= Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await hashToken(token))
      .run();
    return null;
  }

  return row;
}

export async function rotaCadastro(req: Request, env: Env, url: URL): Promise<Response> {
  const corpo = await lerJson(req);
  if (!corpo) return erro(400, 'Corpo inválido.');

  const validacao = validarCredenciais(corpo.apelido, corpo.senha);
  if (!validacao.ok) return erro(400, validacao.erro);
  const { handle, display, senha } = validacao.valor;

  const existente = await env.DB.prepare('SELECT id FROM users WHERE handle = ?')
    .bind(handle)
    .first<{ id: string }>();
  if (existente) return erro(409, 'Esse apelido já está em uso.');

  const usuario: UsuarioRow = {
    id: crypto.randomUUID(),
    handle,
    display,
    hash: await hashPassword(senha),
    created_at: new Date().toISOString(),
  };

  try {
    await env.DB.prepare(
      'INSERT INTO users (id, handle, display, hash, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(usuario.id, usuario.handle, usuario.display, usuario.hash, usuario.created_at)
      .run();
  } catch {
    // A checagem acima não é atômica: dois cadastros simultâneos com o mesmo
    // apelido passam por ela juntos, e quem chega depois bate no UNIQUE. Quem
    // decide é o banco.
    return erro(409, 'Esse apelido já está em uso.');
  }

  const token = await abrirSessao(env, usuario.id);
  return json(
    { usuario: paraPublico(usuario) },
    { headers: { 'set-cookie': cookieDeSessao(token, url, VALIDADE_SESSAO_MS / 1000) } },
  );
}

export async function rotaLogin(req: Request, env: Env, url: URL): Promise<Response> {
  const corpo = await lerJson(req);
  if (!corpo) return erro(400, 'Corpo inválido.');

  const apelido = typeof corpo.apelido === 'string' ? corpo.apelido : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha : '';

  const row = await env.DB.prepare('SELECT * FROM users WHERE handle = ?')
    .bind(apelido.trim().toLowerCase())
    .first<UsuarioRow>();

  // Uma mensagem só para apelido inexistente e senha errada: dizer qual dos dois
  // falhou entregaria de graça a lista de quem tem conta.
  //
  // O `verifyPassword` contra um hash inventado quando o usuário não existe é
  // pelo relógio: sem ele, a resposta instantânea denunciaria a ausência da
  // conta tão bem quanto uma mensagem diferente.
  const confere = row
    ? await verifyPassword(senha, row.hash)
    : await verifyPassword(senha, await hashPassword('senha-que-nao-existe'));

  if (!row || !confere) return erro(401, 'Apelido ou senha incorretos.');

  const token = await abrirSessao(env, row.id);
  return json(
    { usuario: paraPublico(row) },
    { headers: { 'set-cookie': cookieDeSessao(token, url, VALIDADE_SESSAO_MS / 1000) } },
  );
}

export async function rotaLogout(req: Request, env: Env, url: URL): Promise<Response> {
  const token = lerCookie(req, COOKIE_SESSAO);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await hashToken(token))
      .run();
  }
  return json({ ok: true }, { headers: { 'set-cookie': cookieExpirado(url) } });
}

export async function rotaEu(req: Request, env: Env): Promise<Response> {
  const row = await usuarioAtual(req, env);
  if (!row) return erro(401, 'Não autenticado.');
  const usuario: UsuarioPublico = paraPublico(row);
  return json({ usuario });
}
