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
    }

    return erro(404, 'Rota inexistente.');
  },
};
