/**
 * A liga: registrar uma partida terminada e ler a classificação.
 *
 * O registro não acredita no cliente. Ele recebe a config e o log de ações,
 * reproduz a partida com o mesmo `reduce()` que a aba usou e grava o placar que
 * ele mesmo apurou — veja `src/state/leagueReplay.ts`.
 */

import { usuarioAtual } from './auth';
import type { Env } from './env';
import { erro, json, lerJson } from './http';
import { conferirResultado } from '../src/state/leagueReplay';
import type { EnvioResultado } from '../src/state/leagueReplay';
import { classificar } from '../src/state/leagueTable';
import type { AgregadoJogador } from '../src/state/leagueTable';
import { ligaPorId } from '../src/state/leagues';

/** Quantas partidas o histórico pessoal devolve. */
const LIMITE_HISTORICO = 50;

/** Quantos jogadores a classificação devolve. */
const LIMITE_TABELA = 100;

export async function rotaRegistrarResultado(
  req: Request,
  env: Env,
  ligaId: string,
): Promise<Response> {
  const usuario = await usuarioAtual(req, env);
  if (!usuario) return erro(401, 'Entre na sua conta para registrar o resultado.');

  if (!ligaPorId(ligaId)) return erro(404, 'Liga inexistente.');

  const corpo = await lerJson(req);
  if (!corpo) return erro(400, 'Corpo inválido.');

  const envio = corpo as unknown as EnvioResultado;
  if (!envio.config || !Array.isArray(envio.actions)) {
    return erro(400, 'Envio incompleto.');
  }

  const conferencia = conferirResultado(envio);
  if (!conferencia.ok) return erro(422, conferencia.erro);

  const { placar, vencedores, assentoHumano } = conferencia.valor;
  const meuId = `p${assentoHumano}`;
  const minhaLinha = placar.find((l) => l.playerId === meuId);
  if (!minhaLinha) return erro(422, 'O jogador não está no placar.');

  await env.DB.prepare(
    `INSERT INTO league_results
       (id, league_id, user_id, played_at, won, penalty, placement, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      ligaId,
      usuario.id,
      new Date().toISOString(),
      vencedores.includes(meuId) ? 1 : 0,
      minhaLinha.penalidade,
      minhaLinha.posicao,
      JSON.stringify(envio),
    )
    .run();

  // Devolve o placar apurado — é ele que a tela de fim de partida deve mostrar,
  // e não o que o cliente calculou por conta própria.
  return json({ placar, vencedores, minha: minhaLinha });
}

export async function rotaClassificacao(env: Env, ligaId: string): Promise<Response> {
  if (!ligaPorId(ligaId)) return erro(404, 'Liga inexistente.');

  const { results } = await env.DB.prepare(
    `SELECT r.user_id      AS userId,
            u.display      AS display,
            COUNT(*)       AS partidas,
            SUM(r.won)     AS vitorias,
            SUM(r.penalty) AS penalidadeTotal,
            MIN(r.penalty) AS melhor
       FROM league_results r
       JOIN users u ON u.id = r.user_id
      WHERE r.league_id = ?
      GROUP BY r.user_id, u.display
      LIMIT ?`,
  )
    .bind(ligaId, LIMITE_TABELA)
    .all<AgregadoJogador>();

  // A ordem e as posições saem de `classificar()`, não do SQL: é a mesma regra
  // que a tela usaria e a única que está sob teste.
  return json({ classificacao: classificar(results ?? []) });
}

export async function rotaHistoricoPessoal(
  req: Request,
  env: Env,
  ligaId: string,
): Promise<Response> {
  const usuario = await usuarioAtual(req, env);
  if (!usuario) return erro(401, 'Não autenticado.');

  const { results } = await env.DB.prepare(
    `SELECT id, played_at AS data, won, penalty AS penalidade, placement AS posicao
       FROM league_results
      WHERE league_id = ? AND user_id = ?
      ORDER BY played_at DESC
      LIMIT ?`,
  )
    .bind(ligaId, usuario.id, LIMITE_HISTORICO)
    .all();

  return json({ partidas: results ?? [] });
}
