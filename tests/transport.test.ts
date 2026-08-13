import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBot } from '../src/bots';
import type { BotMap } from '../src/bots/types';
import { defaultConfig, defaultPlayers } from '../src/engine/reducer';
import { createLocalTransport } from '../src/transport/local';
import type { Transport } from '../src/transport/types';
import type { GameConfig } from '../src/engine/types';

/** Bots em p1..pn; p0 é o jogador local (humano), sem bot. */
function botsExceptLocal(config: GameConfig): BotMap {
  const map: BotMap = {};
  config.players.forEach((p, i) => {
    if (i > 0) map[`p${i}`] = createBot('medium');
  });
  return map;
}

function build(overrides: Partial<GameConfig> = {}): Transport {
  const config = defaultConfig({ players: defaultPlayers(4), seed: 11, ...overrides });
  return createLocalTransport({ config, bots: botsExceptLocal(config) });
}

/** Deixa o host rodar todos os passos automáticos pendentes. */
function settle(): void {
  vi.advanceTimersByTime(20_000);
}

describe('LocalTransport', () => {
  let transport: Transport;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    transport?.dispose();
    vi.useRealTimers();
  });

  it('distribui sozinho e para na vez do jogador local', () => {
    transport = build({ maxCardsCap: 3, progression: 'down-up' });
    settle();

    const view = transport.getView();
    expect(view.phase).toBe('bidding');
    expect(view.currentBidderId).toBe('p0');
    expect(view.me.hand).toHaveLength(3);
  });

  it('não vaza as cartas dos adversários', () => {
    transport = build({ maxCardsCap: 3, progression: 'down-up' });
    settle();

    for (const o of transport.getView().opponents) {
      expect(o.handCount).toBe(3);
    }
  });

  it('a mão de 1 carta não é exceção: vejo a minha, não vejo a de ninguém', () => {
    transport = build();
    settle();

    const view = transport.getView();
    expect(view.handSize).toBe(1);
    expect(view.me.hand).toHaveLength(1);
    for (const o of view.opponents) expect(o.handCount).toBe(1);
    // Nenhuma carta alheia atravessa a fronteira do transporte.
    expect(JSON.stringify(view.opponents)).not.toMatch(/[2-7QJKA][dshc]/);
  });

  it('avisa os assinantes a cada transição', () => {
    transport = build({ maxCardsCap: 3, progression: 'down-up' });
    const listener = vi.fn();
    const unsubscribe = transport.subscribe(listener);
    settle();

    expect(listener).toHaveBeenCalled();
    unsubscribe();
    const antes = listener.mock.calls.length;
    transport.dispatch({ t: 'BID', bid: transport.getView().legalBids[0]! });
    settle();
    expect(listener.mock.calls.length).toBe(antes);
  });

  it('aceita o palpite do jogador local e deixa os bots seguirem', () => {
    transport = build({ maxCardsCap: 3, progression: 'down-up' });
    settle();

    transport.dispatch({ t: 'BID', bid: 1 });
    settle();

    const view = transport.getView();
    expect(view.me.bid).toBe(1);
    expect(view.phase).toBe('playing');
    expect(view.currentTurnId).toBe('p0'); // sou o primeiro à esquerda do dealer
  });

  it('ignora palpite ilegal sem quebrar a partida', () => {
    transport = build({ maxCardsCap: 3, progression: 'down-up' });
    settle();

    transport.dispatch({ t: 'BID', bid: 99 });
    settle();

    expect(transport.getView().me.bid).toBeNull();
    expect(transport.getView().phase).toBe('bidding');
  });

  it('joga a carta escolhida e devolve o turno aos bots', () => {
    transport = build({ maxCardsCap: 3, progression: 'down-up' });
    settle();
    transport.dispatch({ t: 'BID', bid: 1 });
    settle();

    const carta = transport.getView().me.hand![0]!;
    transport.dispatch({ t: 'PLAY', card: carta });
    settle();

    const view = transport.getView();
    expect(view.me.hand).not.toContain(carta);
    expect(view.me.handCount).toBe(2);
  });

  it('joga sozinho quando a mão tem uma carta só', () => {
    transport = build();
    settle();

    // Uma carta na mão: o jogador a vê para palpitar, mas jogar não tem escolha.
    expect(transport.getView().me.hand).toHaveLength(1);

    transport.dispatch({ t: 'BID', bid: transport.getView().legalBids[0]! });
    settle();

    // O host tocou a mão inteira sozinho e parou no resumo.
    expect(transport.getView().phase).toBe('handScored');
    expect(transport.getView().history).toHaveLength(1);
  });

  it('joga sozinho a última carta de uma mão comum', () => {
    transport = build({ maxCardsCap: 2, progression: 'down-up' });
    settle();
    transport.dispatch({ t: 'BID', bid: transport.getView().legalBids[0]! });
    settle();

    // Com duas cartas, a primeira é escolha do jogador.
    expect(transport.getView().phase).toBe('playing');
    expect(transport.getView().currentTurnId).toBe('p0');
    transport.dispatch({ t: 'PLAY', card: transport.getView().me.hand![0]! });
    settle();

    // Sobrou uma: o host joga sem pedir clique e a mão fecha.
    expect(transport.getView().me.handCount).toBe(0);
    expect(transport.getView().phase).toBe('handScored');
  });

  it('para no resumo da mão até o jogador mandar continuar', () => {
    transport = build();
    settle();
    transport.dispatch({ t: 'BID', bid: transport.getView().legalBids[0]! });
    settle();

    expect(transport.getView().phase).toBe('handScored');
    settle();
    expect(transport.getView().phase).toBe('handScored'); // não avança sozinho

    transport.dispatch({ t: 'CONTINUE' });
    settle();
    expect(transport.getView().handIndex).toBe(1);
  });

  it('dispose cancela os timers pendentes', () => {
    transport = build({ maxCardsCap: 3, progression: 'down-up' });
    settle();
    transport.dispatch({ t: 'BID', bid: 1 });

    transport.dispose();
    const antes = transport.getView().phase;
    settle();
    expect(transport.getView().phase).toBe(antes);
  });

  describe('log de eventos', () => {
    it('numera os eventos sem repetir nem pular', () => {
      transport = build({ maxCardsCap: 3, progression: 'down-up' });
      settle();

      const log = transport.getEventLog();
      expect(log.length).toBeGreaterThan(0);
      log.forEach((entrada, i) => expect(entrada.seq).toBe(i + 1));
    });

    it('só cresce: o que já entrou não muda de número nem some', () => {
      transport = build({ maxCardsCap: 3, progression: 'down-up' });
      settle();
      const antes = transport.getEventLog().map((e) => e.seq);

      transport.dispatch({ t: 'BID', bid: transport.getView().legalBids[0]! });
      settle();
      const depois = transport.getEventLog().map((e) => e.seq);

      expect(depois.slice(0, antes.length)).toEqual(antes);
      expect(depois.length).toBeGreaterThan(antes.length);
    });

    it('guarda todos os eventos de uma transição, não só o último', () => {
      // A última carta da vaza gera CARD_PLAYED e TRICK_WON de uma vez — é
      // exatamente o caso que `getEvents()` sozinho perderia entre renders.
      transport = build({ maxCardsCap: 1 });
      settle();
      transport.dispatch({ t: 'BID', bid: transport.getView().legalBids[0]! });
      settle();

      const tipos = transport.getEventLog().map((e) => e.event.t);
      expect(tipos).toContain('HAND_DEALT');
      expect(tipos).toContain('BID_MADE');
      expect(tipos).toContain('CARD_PLAYED');
      expect(tipos).toContain('TRICK_WON');
      expect(tipos).toContain('HAND_SCORED');
    });

    it('cada evento carrega a view de quando aconteceu', () => {
      transport = build({ maxCardsCap: 3, progression: 'down-up' });
      settle();

      const dealt = transport.getEventLog().find((e) => e.event.t === 'HAND_DEALT')!;
      expect(dealt.view.handSize).toBe(3);
      expect(dealt.view.me.hand).toHaveLength(3);
    });

    it('processar a partir do último seq nunca entrega evento duas vezes', () => {
      transport = build({ maxCardsCap: 3, progression: 'down-up' });
      settle();

      // Simula o que o hook de reações faz.
      let ultimo = 0;
      const vistos: number[] = [];
      const drenar = () => {
        for (const e of transport.getEventLog()) {
          if (e.seq <= ultimo) continue;
          ultimo = e.seq;
          vistos.push(e.seq);
        }
      };

      drenar();
      drenar(); // segunda passada, como no ciclo duplo do StrictMode
      transport.dispatch({ t: 'BID', bid: transport.getView().legalBids[0]! });
      settle();
      drenar();

      expect(new Set(vistos).size).toBe(vistos.length);
    });
  });

  it('toca uma partida inteira dirigida pelo jogador local', () => {
    // O host decide sozinho só o que não tem escolha; as escolhas de verdade
    // continuam sendo da UI, e aqui o teste faz o papel dela.
    transport = build({ maxCardsCap: 2, seed: 3 });

    for (let passo = 0; passo < 200; passo++) {
      settle();
      const view = transport.getView();
      if (view.phase === 'matchOver') break;

      if (view.phase === 'bidding' && view.currentBidderId === 'p0') {
        transport.dispatch({ t: 'BID', bid: view.legalBids[0]! });
      } else if (view.phase === 'playing' && view.currentTurnId === 'p0') {
        transport.dispatch({ t: 'PLAY', card: view.me.hand![0]! });
      } else if (view.phase === 'handScored') {
        transport.dispatch({ t: 'CONTINUE' });
      }
    }

    const final = transport.getView();
    expect(final.phase).toBe('matchOver');
    expect(final.history).toHaveLength(3); // 1 → 2 → 1
    expect(final.winnerIds.length).toBeGreaterThan(0);
  });
});
