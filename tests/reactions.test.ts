import { describe, expect, it } from 'vitest';

import type { GameEvent, HandResult } from '../src/engine/types';
import {
  COOLDOWN_MS,
  MAX_BALOES,
  estadoInicial,
  gatilhoDe,
  reactionsFor,
  registrar,
} from '../src/theater/reactions';
import type { TheaterState } from '../src/theater/reactions';
import { makeView } from './helpers/view';
import type { MakeViewOptions } from './helpers/view';
import type { LoggedEvent } from '../src/transport/types';

function logged(event: GameEvent, view: MakeViewOptions = {}): LoggedEvent {
  return { seq: 1, event, view: makeView(view) };
}

function resultado(rows: Partial<HandResult['rows'][number]>[]): HandResult {
  return {
    handIndex: 2,
    handSize: 3,
    vira: '7d',
    manilhaRank: 'Q',
    rows: rows.map((r) => ({
      playerId: 'p0',
      bid: 1,
      tricksWon: 1,
      penalty: 0,
      totalPenalty: 0,
      lives: 5,
      eliminated: false,
      ...r,
    })),
  };
}

// ---------------------------------------------------------------------------
// Do evento ao gatilho
// ---------------------------------------------------------------------------

describe('gatilhoDe', () => {
  it('manilha jogada vira "manilha"', () => {
    // Vira 7 → manilha Q. Q de copas não é o naipe mais forte.
    const g = gatilhoDe(logged({ t: 'CARD_PLAYED', playerId: 'p1', card: 'Qh' }));
    expect(g).toEqual({ trigger: 'manilha', autor: 'p1' });
  });

  it('manilha de paus vira "zap"', () => {
    const g = gatilhoDe(logged({ t: 'CARD_PLAYED', playerId: 'p2', card: 'Qc' }));
    expect(g).toEqual({ trigger: 'zap', autor: 'p2' });
  });

  it('carta comum não rende comentário', () => {
    expect(gatilhoDe(logged({ t: 'CARD_PLAYED', playerId: 'p1', card: '5d' }))).toBeNull();
  });

  it('mão sem manilha: nem carta de manilha existe para comentar', () => {
    const g = gatilhoDe(
      logged({ t: 'CARD_PLAYED', playerId: 'p1', card: 'Qc' }, { vira: null, manilhaRank: null }),
    );
    expect(g).toBeNull();
  });

  it('levar a vaza com carta baixa é roubada', () => {
    const g = gatilhoDe(logged({ t: 'TRICK_WON', playerId: 'p1', card: '5d' }));
    expect(g).toEqual({ trigger: 'roubada', autor: 'p1' });
  });

  it('levar vaza além do palpite é "passou", e tem prioridade sobre roubada', () => {
    const g = gatilhoDe(
      logged(
        { t: 'TRICK_WON', playerId: 'p1', card: '5d' },
        { opponentCount: 3 },
      ),
    );
    expect(g!.trigger).toBe('roubada');

    const estourando = makeView();
    estourando.opponents[0]!.bid = 0;
    estourando.opponents[0]!.tricksWon = 1;
    const g2 = gatilhoDe({
      seq: 1,
      event: { t: 'TRICK_WON', playerId: 'p1', card: '5d' },
      view: estourando,
    });
    expect(g2).toEqual({ trigger: 'passou', autor: 'p1' });
  });

  it('levar com carta alta comum não rende nada', () => {
    expect(gatilhoDe(logged({ t: 'TRICK_WON', playerId: 'p1', card: '3c' }))).toBeNull();
  });

  it('palpite zero e palpite cheio têm gatilhos próprios', () => {
    expect(gatilhoDe(logged({ t: 'BID_MADE', playerId: 'p1', bid: 0 }))!.trigger).toBe('bid_zero');
    expect(gatilhoDe(logged({ t: 'BID_MADE', playerId: 'p1', bid: 3 }))!.trigger).toBe('bid_all');
    expect(gatilhoDe(logged({ t: 'BID_MADE', playerId: 'p1', bid: 2 }))).toBeNull();
  });

  it('o distribuidor sem escolha na mão de 1 carta é "bid_forcado"', () => {
    const g = gatilhoDe(
      logged({ t: 'BID_MADE', playerId: 'p3', bid: 1 }, { handSize: 1, dealerId: 'p3' }),
    );
    expect(g).toEqual({ trigger: 'bid_forcado', autor: 'p3' });
  });

  it('com 2 cartas ou mais o distribuidor sempre tem escolha', () => {
    // Palpite do meio: não é zero nem é a mão inteira, então só sobraria o
    // gatilho de "foi obrigado" — que não pode disparar aqui.
    const g = gatilhoDe(
      logged({ t: 'BID_MADE', playerId: 'p3', bid: 1 }, { handSize: 3, dealerId: 'p3' }),
    );
    expect(g).toBeNull();
  });

  it('mão sem vira é anunciada; distribuição comum passa em silêncio', () => {
    const semManilha = gatilhoDe(
      logged({ t: 'HAND_DEALT', handIndex: 9, handSize: 10, vira: null, manilhaRank: null }),
    );
    expect(semManilha).toEqual({ trigger: 'sem_manilha', autor: null });

    const comum = gatilhoDe(
      logged(
        { t: 'HAND_DEALT', handIndex: 0, handSize: 1, vira: '7d', manilhaRank: 'Q' },
        { handSize: 1 },
      ),
    );
    expect(comum).toBeNull();
  });

  it('vaza anulada vira "melou", sem autor', () => {
    expect(gatilhoDe(logged({ t: 'TRICK_ANNULLED', leaderId: 'p1' }))).toEqual({
      trigger: 'melou',
      autor: null,
    });
  });

  it('na pontuação, o erro maior fala mais alto que o acerto', () => {
    const g = gatilhoDe(
      logged({
        t: 'HAND_SCORED',
        result: resultado([
          { playerId: 'p0', penalty: 0 },
          { playerId: 'p2', penalty: 3 },
          { playerId: 'p1', penalty: 1 },
        ]),
      }),
    );
    expect(g).toEqual({ trigger: 'errou', autor: 'p2' });
  });

  it('sem erro grande, comenta quem cravou', () => {
    const g = gatilhoDe(
      logged({
        t: 'HAND_SCORED',
        result: resultado([
          { playerId: 'p1', penalty: 0 },
          { playerId: 'p2', penalty: 1 },
        ]),
      }),
    );
    expect(g).toEqual({ trigger: 'na_mosca', autor: 'p1' });
  });

  it('eliminação e vitória têm gatilho', () => {
    expect(gatilhoDe(logged({ t: 'PLAYER_ELIMINATED', playerId: 'p2' }))!.trigger).toBe(
      'eliminado',
    );
    expect(gatilhoDe(logged({ t: 'MATCH_OVER', winnerIds: ['p1'] }))).toEqual({
      trigger: 'venceu',
      autor: 'p1',
    });
  });

  it('eventos sem graça não geram gatilho', () => {
    expect(gatilhoDe(logged({ t: 'BIDDING_COMPLETE', total: 2, handSize: 3 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Do gatilho às falas
// ---------------------------------------------------------------------------

/** `zap` tem chance 1, então o único acaso é quem fala e qual frase sai. */
const ZAP: GameEvent = { t: 'CARD_PLAYED', playerId: 'p1', card: 'Qc' };

function reagir(
  event: GameEvent,
  opts: { estado?: TheaterState; ativos?: number; rng?: number; agora?: number; view?: MakeViewOptions } = {},
) {
  return reactionsFor({
    logged: logged(event, opts.view ?? {}),
    registro: 'solto',
    estado: opts.estado ?? estadoInicial(),
    baloesAtivos: opts.ativos ?? 0,
    agora: opts.agora ?? 100_000,
    rng: opts.rng ?? 12345,
  });
}

describe('reactionsFor', () => {
  it('o jogador humano nunca fala', () => {
    for (let rng = 0; rng < 60; rng++) {
      const { reactions } = reagir(ZAP, { rng });
      for (const r of reactions) expect(r.playerId).not.toBe('p0');
    }
  });

  it('quem jogou a manilha não comenta a própria manilha', () => {
    for (let rng = 0; rng < 60; rng++) {
      const { reactions } = reagir({ t: 'CARD_PLAYED', playerId: 'p1', card: 'Qh' }, { rng });
      for (const r of reactions) expect(r.playerId).not.toBe('p1');
    }
  });

  it('mas no zap o autor pode se gabar', () => {
    let autorFalou = false;
    for (let rng = 0; rng < 80; rng++) {
      const { reactions } = reagir(ZAP, { rng });
      if (reactions.some((r) => r.playerId === 'p1')) autorFalou = true;
    }
    expect(autorFalou).toBe(true);
  });

  it('o zap pode render dois comentários', () => {
    const contagens = new Set<number>();
    for (let rng = 0; rng < 80; rng++) contagens.add(reagir(ZAP, { rng }).reactions.length);
    expect(Math.max(...contagens)).toBe(2);
  });

  it('nunca ultrapassa o teto de balões na tela', () => {
    for (let rng = 0; rng < 40; rng++) {
      expect(reagir(ZAP, { rng, ativos: MAX_BALOES }).reactions).toEqual([]);
      expect(reagir(ZAP, { rng, ativos: MAX_BALOES - 1 }).reactions.length).toBeLessThanOrEqual(1);
    }
  });

  it('ninguém fala duas vezes na mesma reação', () => {
    for (let rng = 0; rng < 60; rng++) {
      const ids = reagir(ZAP, { rng }).reactions.map((r) => r.playerId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('respeita o silêncio entre duas falas do mesmo bot', () => {
    const agora = 100_000;
    const calados: TheaterState = {
      ultimaFala: { p1: agora - 100, p2: agora - 100, p3: agora - 100 },
      ultimaFrase: {},
    };
    for (let rng = 0; rng < 40; rng++) {
      expect(reagir(ZAP, { rng, estado: calados, agora }).reactions).toEqual([]);
    }

    // Passado o cooldown, voltam a falar.
    const depois = agora + COOLDOWN_MS + 1;
    const alguemFalou = Array.from({ length: 20 }, (_, rng) =>
      reagir(ZAP, { rng, estado: calados, agora: depois }).reactions.length,
    ).some((n) => n > 0);
    expect(alguemFalou).toBe(true);
  });

  it('não repete a última frase que o bot disse', () => {
    const base = reagir(ZAP, { rng: 7 });
    expect(base.reactions.length).toBeGreaterThan(0);
    const primeiro = base.reactions[0]!;

    const estado: TheaterState = { ultimaFala: {}, ultimaFrase: { [primeiro.playerId]: primeiro.texto } };
    for (let rng = 0; rng < 40; rng++) {
      for (const r of reagir(ZAP, { rng, estado }).reactions) {
        if (r.playerId === primeiro.playerId) expect(r.texto).not.toBe(primeiro.texto);
      }
    }
  });

  it('é determinístico: mesma semente, mesma reação', () => {
    const a = reagir(ZAP, { rng: 999 });
    const b = reagir(ZAP, { rng: 999 });
    expect(a.reactions).toEqual(b.reactions);
    expect(a.rng).toBe(b.rng);
  });

  it('avança o PRNG mesmo quando ninguém fala', () => {
    const { rng } = reagir({ t: 'CARD_PLAYED', playerId: 'p1', card: '5d' }, { rng: 42 });
    // Gatilho nulo sai antes de sortear: o estado do PRNG segue intacto.
    expect(rng).toBe(42);
    const comGatilho = reagir(ZAP, { rng: 42 });
    expect(comGatilho.rng).not.toBe(42);
  });

  it('bot eliminado não comenta a jogada dos outros', () => {
    const view = makeView();
    view.opponents[0]!.eliminated = true;
    view.opponents[1]!.eliminated = true;
    view.opponents[2]!.eliminated = true;
    for (let rng = 0; rng < 30; rng++) {
      const r = reactionsFor({
        logged: { seq: 1, event: ZAP, view },
        registro: 'solto',
        estado: estadoInicial(),
        baloesAtivos: 0,
        agora: 0,
        rng,
      });
      expect(r.reactions).toEqual([]);
    }
  });

  it('mas tem direito à última palavra na própria eliminação', () => {
    const view = makeView();
    view.opponents[0]!.eliminated = true;
    let falou = false;
    for (let rng = 0; rng < 40; rng++) {
      const r = reactionsFor({
        logged: { seq: 1, event: { t: 'PLAYER_ELIMINATED', playerId: 'p1' }, view },
        registro: 'solto',
        estado: estadoInicial(),
        baloesAtivos: 0,
        agora: 0,
        rng,
      });
      if (r.reactions.some((x) => x.playerId === 'p1')) falou = true;
    }
    expect(falou).toBe(true);
  });

  it('a frase sai do registro pedido', () => {
    const leve = reactionsFor({
      logged: logged(ZAP),
      registro: 'leve',
      estado: estadoInicial(),
      baloesAtivos: 0,
      agora: 0,
      rng: 5,
    });
    for (const r of leve.reactions) {
      expect(r.texto).not.toMatch(/porra|caralho/i);
    }
  });

  it('mesa só de humanos não gera fala nenhuma', () => {
    const view = makeView();
    for (const o of view.opponents) o.isBot = false;
    const r = reactionsFor({
      logged: { seq: 1, event: ZAP, view },
      registro: 'solto',
      estado: estadoInicial(),
      baloesAtivos: 0,
      agora: 0,
      rng: 1,
    });
    expect(r.reactions).toEqual([]);
  });
});

describe('registrar', () => {
  it('anota quem falou e o quê, sem mutar o estado anterior', () => {
    const antes = estadoInicial();
    const { reactions } = reagir(ZAP, { rng: 3 });
    const depois = registrar(antes, reactions, 5000);

    expect(antes.ultimaFala).toEqual({});
    for (const r of reactions) {
      expect(depois.ultimaFala[r.playerId]).toBe(5000);
      expect(depois.ultimaFrase[r.playerId]).toBe(r.texto);
    }
  });

  it('sem reação, devolve o mesmo estado', () => {
    const antes = estadoInicial();
    expect(registrar(antes, [], 1)).toBe(antes);
  });
});
