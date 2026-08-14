/**
 * As rotas de sala. Ponte fina entre o mundo HTTP e o Durable Object.
 *
 * Toda a autenticação acontece aqui: o DO não fica exposto à internet e recebe
 * a identidade já resolvida, em cabeçalhos. Isso vale inclusive para o
 * WebSocket — o cookie viaja no handshake, então o upgrade é autenticado como
 * qualquer outra requisição.
 */

import { usuarioAtual } from './auth';
import type { Env } from './env';
import { erro, json, lerJson } from './http';
import { gerarCodigo } from './roomLogic';
import { MAX_JOGADORES_SALA, MIN_JOGADORES_SALA } from '../src/transport/protocol';

/** Tentativas de achar um código livre antes de desistir. */
const TENTATIVAS_CODIGO = 5;

function salaPorCodigo(env: Env, codigo: string): DurableObjectStub {
  return env.ROOMS.get(env.ROOMS.idFromName(codigo));
}

/** Repassa a identidade ao DO. Só o Worker fala com ele. */
function comIdentidade(
  url: string,
  usuario: { id: string; display: string },
  init: RequestInit = {},
): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...init.headers,
      'x-user-id': usuario.id,
      'x-user-display': usuario.display,
    },
  });
}

export async function rotaCriarSala(req: Request, env: Env): Promise<Response> {
  const usuario = await usuarioAtual(req, env);
  if (!usuario) return erro(401, 'Entre na sua conta para criar uma sala.');

  const corpo = (await lerJson(req)) ?? {};
  const jogadores = Number(corpo.jogadores ?? 4);
  if (!Number.isInteger(jogadores) || jogadores < MIN_JOGADORES_SALA || jogadores > MAX_JOGADORES_SALA) {
    return erro(400, `A mesa vai de ${MIN_JOGADORES_SALA} a ${MAX_JOGADORES_SALA} jogadores.`);
  }

  const dono = { id: usuario.id, display: usuario.display };

  // O código vira o nome do Durable Object, então qualquer código já "existe"
  // como objeto. Quem decide se está livre é o próprio DO, que recusa criar
  // duas vezes — não há registro central a manter em dia.
  for (let tentativa = 0; tentativa < TENTATIVAS_CODIGO; tentativa++) {
    const codigo = gerarCodigo();
    const res = await salaPorCodigo(env, codigo).fetch(
      comIdentidade('https://sala/criar', dono, {
        method: 'POST',
        body: JSON.stringify({ codigo, jogadores }),
      }),
    );
    if (res.ok) return json({ codigo });
    if (res.status !== 409) return res;
  }

  return erro(503, 'Não consegui um código livre. Tente de novo.');
}

/** Checagem antes do upgrade, para a recusa chegar legível em vez de um socket que fecha sozinho. */
export async function rotaEntrarSala(req: Request, env: Env, codigo: string): Promise<Response> {
  const usuario = await usuarioAtual(req, env);
  if (!usuario) return erro(401, 'Entre na sua conta para entrar numa sala.');

  return salaPorCodigo(env, codigo).fetch(
    comIdentidade('https://sala/entrar', usuario, { method: 'POST' }),
  );
}

export async function rotaSocketSala(req: Request, env: Env, codigo: string): Promise<Response> {
  const usuario = await usuarioAtual(req, env);
  if (!usuario) return new Response('não autenticado', { status: 401 });

  // O `Upgrade` precisa sobreviver ao repasse, então os cabeçalhos originais vão
  // junto — é o que mantém o handshake válido do outro lado.
  const encaminhada = new Request('https://sala/ws', req);
  encaminhada.headers.set('x-user-id', usuario.id);
  encaminhada.headers.set('x-user-display', usuario.display);

  return salaPorCodigo(env, codigo).fetch(encaminhada);
}
