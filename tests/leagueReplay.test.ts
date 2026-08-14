import { describe, expect, it } from 'vitest';

import { createBot } from '../src/bots';
import type { BotMap } from '../src/bots/types';
import { runMatch } from '../src/bots/runner';
import { defaultConfig } from '../src/engine/reducer';
import { standings } from '../src/engine/scoring';
import type { Action, GameConfig } from '../src/engine/types';
import { conferirResultado } from '../src/state/leagueReplay';
import { configLiga } from '../src/state/leagues';

/**
 * Uma partida de liga de verdade, tocada pelo runner headless, com o log de
 * ações que o cliente mandaria.
 *
 * Todos os assentos recebem bot — inclusive o 0, que na config é o humano. Para
 * o replay não faz diferença quem escolheu a jogada: o que ele confere é que a
 * sequência é legal e leva ao placar afirmado.
 */
function partidaDeLiga(seed: number): { config: GameConfig; actions: Action[]; state: ReturnType<typeof runMatch> } {
  const config = configLiga('Pedro', seed);
  const bots: BotMap = {};
  config.players.forEach((_, i) => {
    bots[`p${i}`] = createBot('hard', seed + i * 7919);
  });

  const actions: Action[] = [];
  const state = runMatch(config, bots, { onStep: (_s, action) => actions.push(action) });
  return { config, actions, state };
}

describe('conferirResultado', () => {
  it('reproduz a partida e chega ao mesmo placar', () => {
    const { config, actions, state } = partidaDeLiga(42);

    const r = conferirResultado({ config, actions });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const esperado = standings(state);
    expect(r.valor.placar.map((l) => l.playerId)).toEqual(esperado.map((s) => s.playerId));
    expect(r.valor.placar.map((l) => l.penalidade)).toEqual(esperado.map((s) => s.penalty));
    expect(r.valor.placar.map((l) => l.posicao)).toEqual(esperado.map((s) => s.rank));
    expect(r.valor.vencedores).toEqual(state.winnerIds);
    expect(r.valor.assentoHumano).toBe(0);
  });

  it('vale para qualquer semente, não só uma de sorte', () => {
    for (const seed of [1, 7, 99, 12345]) {
      const { config, actions, state } = partidaDeLiga(seed);
      const r = conferirResultado({ config, actions });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.valor.vencedores).toEqual(state.winnerIds);
    }
  });

  it('recusa log truncado — a partida não chegou ao fim', () => {
    const { config, actions } = partidaDeLiga(42);
    const r = conferirResultado({ config, actions: actions.slice(0, actions.length - 5) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/não chegou ao fim/);
  });

  it('recusa log vazio', () => {
    const { config } = partidaDeLiga(42);
    expect(conferirResultado({ config, actions: [] }).ok).toBe(false);
  });

  it('recusa jogada adulterada', () => {
    const { config, actions } = partidaDeLiga(42);

    // Troca a carta da primeira jogada por uma que aquele jogador não tem.
    const i = actions.findIndex((a) => a.t === 'PLAY');
    const adulterado = [...actions];
    const original = adulterado[i];
    if (original?.t !== 'PLAY') throw new Error('esperava uma jogada');
    adulterado[i] = { ...original, card: original.card === '3c' ? '4d' : '3c' };

    const r = conferirResultado({ config, actions: adulterado });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/inválida/);
  });

  it('recusa ordem embaralhada', () => {
    const { config, actions } = partidaDeLiga(42);
    const trocado = [...actions];
    // Duas jogadas fora de ordem quebram a vez.
    const a = trocado.findIndex((x) => x.t === 'PLAY');
    [trocado[a], trocado[a + 1]] = [trocado[a + 1]!, trocado[a]!];
    expect(conferirResultado({ config, actions: trocado }).ok).toBe(false);
  });

  it('recusa a semente trocada — o baralho seria outro', () => {
    const { config, actions } = partidaDeLiga(42);
    const r = conferirResultado({ config: { ...config, seed: 43 }, actions });
    expect(r.ok).toBe(false);
  });

  it('recusa penalidade inventada: o placar sai do replay, não do envio', () => {
    // O envio não tem campo de placar — é essa a defesa. O servidor só sabe o
    // que ele mesmo apurou, então não há número do cliente em que acreditar.
    const { config, actions, state } = partidaDeLiga(42);
    const r = conferirResultado({ config, actions });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const total = r.valor.placar.reduce((s, l) => s + l.penalidade, 0);
    expect(total).toBe(state.players.reduce((s, p) => s + p.penalty, 0));
  });
});

describe('conferirResultado — formato da liga', () => {
  const { config, actions } = partidaDeLiga(42);

  it('recusa mesa fora do tamanho da liga', () => {
    const menor = defaultConfig({
      players: config.players.slice(0, 4),
      progression: 'up-down',
      maxCardsCap: null,
      scoringMode: 'penalty',
      seed: config.seed,
    });
    const r = conferirResultado({ config: menor, actions });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/mesa de 5/);
  });

  it('recusa modo de pontuação trocado', () => {
    const r = conferirResultado({ config: { ...config, scoringMode: 'elimination' }, actions });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/scoringMode/);
  });

  it('recusa progressão trocada', () => {
    const r = conferirResultado({ config: { ...config, progression: 'down-up' }, actions });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/progression/);
  });

  it('recusa teto de cartas — encurtaria a partida', () => {
    const r = conferirResultado({ config: { ...config, maxCardsCap: 3 }, actions });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/maxCardsCap/);
  });

  it('recusa mesa só de bots', () => {
    const soBots = {
      ...config,
      players: config.players.map((p) => ({ ...p, isBot: true })),
    };
    const r = conferirResultado({ config: soBots, actions });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/assento 0/);
  });

  it('recusa mais de um humano na mesa', () => {
    const doisHumanos = {
      ...config,
      players: config.players.map((p, i) => (i <= 1 ? { ...p, isBot: false } : p)),
    };
    const r = conferirResultado({ config: doisHumanos, actions });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/humano só/);
  });
});
