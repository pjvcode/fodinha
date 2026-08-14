/**
 * O Worker.
 *
 * Até aqui o `wrangler.jsonc` não tinha `main`: o jogo era 100% client-side e
 * não havia código de servidor a executar. Agora há, mas só para o que precisa
 * de um lugar comum a todo mundo — contas e liga. A mesa continua rodando
 * inteira no cliente.
 *
 * Roteador escrito à mão de propósito: são poucas rotas, e um framework de
 * roteamento seria mais dependência do que código economizado.
 *
 * Tudo que não é `/api/*` nem chega aqui — o `run_worker_first` do
 * `wrangler.jsonc` manda o resto direto para os assets estáticos.
 */

import { rotaCadastro, rotaEu, rotaLogin, rotaLogout } from './auth';
import type { Env } from './env';
import { erro } from './http';
import { rotaClassificacao, rotaHistoricoPessoal, rotaRegistrarResultado } from './league';
import { rotaCriarSala, rotaEntrarSala, rotaSocketSala } from './rooms';

export { RoomDO } from './room';

/** `/api/<recurso>/:id/algo` → `['id', 'algo']`. `null` quando não é essa forma. */
function segmentos(pathname: string, recurso: string): [string, string] | null {
  const partes = pathname.split('/');
  // ['', 'api', recurso, ':id', 'algo']
  if (partes.length !== 5 || partes[1] !== 'api' || partes[2] !== recurso) return null;
  const id = decodeURIComponent(partes[3]!);
  return id === '' ? null : [id, partes[4]!];
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const rota = `${req.method} ${url.pathname}`;

    switch (rota) {
      case 'POST /api/auth/signup':
        return rotaCadastro(req, env, url);
      case 'POST /api/auth/login':
        return rotaLogin(req, env, url);
      case 'POST /api/auth/logout':
        return rotaLogout(req, env, url);
      case 'GET /api/auth/me':
        return rotaEu(req, env);
      case 'POST /api/rooms':
        return rotaCriarSala(req, env);
    }

    const liga = segmentos(url.pathname, 'league');
    if (liga) {
      const [ligaId, recurso] = liga;
      if (req.method === 'POST' && recurso === 'result') {
        return rotaRegistrarResultado(req, env, ligaId);
      }
      if (req.method === 'GET' && recurso === 'standings') {
        return rotaClassificacao(env, ligaId);
      }
      if (req.method === 'GET' && recurso === 'me') {
        return rotaHistoricoPessoal(req, env, ligaId);
      }
    }

    const sala = segmentos(url.pathname, 'rooms');
    if (sala) {
      // O código vira o nome do Durable Object: normalizado para maiúsculas,
      // quem digita em minúsculas cai na mesma sala.
      const [codigo, recurso] = [sala[0].toUpperCase(), sala[1]];
      if (req.method === 'GET' && recurso === 'ws') {
        return rotaSocketSala(req, env, codigo);
      }
      if (req.method === 'POST' && recurso === 'join') {
        return rotaEntrarSala(req, env, codigo);
      }
    }

    return erro(404, 'Rota inexistente.');
  },
};
