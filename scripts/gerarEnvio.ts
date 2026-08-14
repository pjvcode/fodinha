/**
 * Gera o JSON que o cliente manda ao terminar uma partida de liga.
 *
 * Serve para exercitar a rota de registro sem abrir o navegador e jogar quinze
 * mãos à mão. A partida é de verdade: mesmo `configLiga`, mesmos bots, mesmo
 * `reduce()`.
 *
 *   npx tsx scripts/gerarEnvio.ts [semente] [apelido]
 */

import { createBot } from '../src/bots';
import { runMatch } from '../src/bots/runner';
import type { BotMap } from '../src/bots/types';
import type { Action } from '../src/engine/types';
import { configLiga } from '../src/state/leagues';

const seed = Number(process.argv[2] ?? 42);
const apelido = process.argv[3] ?? 'Pedro';

const config = configLiga(apelido, seed);

// Todos os assentos recebem bot, inclusive o 0 — que na config é o humano.
// Para o log de ações tanto faz quem escolheu: o que vale é a sequência.
const bots: BotMap = {};
config.players.forEach((_, i) => {
  bots[`p${i}`] = createBot('hard', seed + i * 7919);
});

const actions: Action[] = [];
runMatch(config, bots, { onStep: (_s, action) => actions.push(action) });

process.stdout.write(JSON.stringify({ config, actions }));
