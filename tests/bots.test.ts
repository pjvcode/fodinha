import { describe, expect, it } from 'vitest';

import { createBot } from '../src/bots';
import { createEasyBot, createMediumBot } from '../src/bots/heuristic';
import { pNoneInOpponentHands, unseenCards } from '../src/bots/probability';
import { runMatch } from '../src/bots/runner';
import type { BotMap } from '../src/bots/types';
import { defaultConfig, defaultPlayers } from '../src/engine/reducer';
import type { PlayerView } from '../src/engine/selectors';
import { SUITS } from '../src/engine/types';
import type { CardId, GameConfig } from '../src/engine/types';

const config = defaultConfig({ players: defaultPlayers(4) });

/** PlayerView mínima para exercitar as políticas isoladamente. */
function makeView(over: Partial<PlayerView> = {}): PlayerView {
  const base: PlayerView = {
    config,
    phase: 'playing',
    handIndex: 0,
    totalHands: 19,
    handSize: 3,
    vira: null,
    manilhaRank: null,
    me: {
      id: 'p0',
      name: 'Você',
      seat: 0,
      bid: 1,
      tricksWon: 0,
      penalty: 0,
      lives: 5,
      eliminated: false,
      handCount: 3,
      hand: ['4d', 'Kd', '3c'],
    },
    opponents: [1, 2, 3].map((i) => ({
      id: `p${i}`,
      name: `Bot ${i}`,
      isBot: true,
      seat: i,
      bid: 1,
      tricksWon: 0,
      penalty: 0,
      lives: 5,
      eliminated: false,
      handCount: 3,
    })),
    dealerId: 'p3',
    currentBidderId: null,
    currentTurnId: 'p0',
    trick: { leaderId: 'p1', plays: [] },
    lastTrick: null,
    completedTricks: [],
    playedCards: [],
    legalBids: [],
    forbiddenBid: null,
    legalCards: [],
    history: [],
    winnerIds: [],
    ...over,
  };
  return base;
}

function botsFor(cfg: GameConfig, levels: string[], seed: number): BotMap {
  const map: BotMap = {};
  cfg.players.forEach((_, i) => {
    map[`p${i}`] = createBot((levels[i] ?? levels[levels.length - 1]) as never, seed + i * 7919);
  });
  return map;
}

describe('pNoneInOpponentHands', () => {
  it('é 1 quando não existe carta superior', () => {
    expect(pNoneInOpponentHands(30, 0, 27)).toBe(1);
  });

  it('é 0 quando o universo inteiro está nas mãos adversárias', () => {
    // Mão sem vira: todas as 30 não-vistas estão com os adversários.
    expect(pNoneInOpponentHands(30, 5, 30)).toBe(0);
  });

  it('é 0 quando há mais cartas superiores do que espaço fora das mãos', () => {
    expect(pNoneInOpponentHands(30, 10, 25)).toBe(0);
  });

  it('bate com a hipergeométrica em um caso conferível à mão', () => {
    // U=4, S=1, O=2 → P(a carta superior estar entre as 2 fora) = 2/4 = 0.5
    expect(pNoneInOpponentHands(4, 1, 2)).toBeCloseTo(0.5, 10);
  });

  it('decresce conforme aparecem mais cartas superiores', () => {
    const a = pNoneInOpponentHands(30, 1, 20);
    const b = pNoneInOpponentHands(30, 3, 20);
    expect(b).toBeLessThan(a);
  });
});

describe('unseenCards', () => {
  it('exclui a própria mão, o vira e as cartas já jogadas', () => {
    const view = makeView({ vira: '7h', playedCards: ['2s', 'Qc'] });
    const unseen = unseenCards(view);
    expect(unseen).toHaveLength(40 - 3 - 1 - 2);
    for (const c of ['4d', 'Kd', '3c', '7h', '2s', 'Qc'] as CardId[]) {
      expect(unseen).not.toContain(c);
    }
  });

  it('na mão de 1 carta o universo é o baralho menos a própria e o vira', () => {
    const view = makeView({
      handSize: 1,
      vira: '7h',
      me: { ...makeView().me, hand: ['4d'], handCount: 1 },
      opponents: makeView().opponents.map((o) => ({ ...o, handCount: 1 })),
    });
    const unseen = unseenCards(view);
    // As cartas dos outros não são vistas por ninguém: continuam no universo.
    expect(unseen).toHaveLength(38);
    expect(unseen).not.toContain('4d');
    expect(unseen).not.toContain('7h');
  });
});

describe('política de jogada do bot médio', () => {
  const bot = createMediumBot();
  const hand: CardId[] = ['4d', 'Kd', '3c'];
  // Forças sem manilha: 4d=0, Kd=24, Ad=28, 3c=39.
  const contraAd = { leaderId: 'p1', plays: [{ playerId: 'p1', card: 'Ad' as CardId }] };

  it('já bateu o palpite: queima a maior carta que ainda perde', () => {
    const view = makeView({ me: { ...makeView().me, bid: 0 }, trick: contraAd });
    expect(bot.chooseCard(view, hand)).toBe('Kd');
  });

  it('já bateu o palpite e lidera: joga a mais fraca', () => {
    const view = makeView({ me: { ...makeView().me, bid: 0 } });
    expect(bot.chooseCard(view, hand)).toBe('4d');
  });

  it('precisa de uma vaza e pode ganhar: ganha com a mais barata que vence', () => {
    const view = makeView({ me: { ...makeView().me, bid: 1 }, trick: contraAd });
    expect(bot.chooseCard(view, hand)).toBe('3c');
  });

  it('precisa de vaza mas não consegue vencer: descarta a mais fraca', () => {
    const view = makeView({
      me: { ...makeView().me, bid: 1, hand: ['4d', 'Kd', 'Qd'] },
      trick: { leaderId: 'p1', plays: [{ playerId: 'p1', card: '2c' }] },
    });
    expect(bot.chooseCard(view, ['4d', 'Kd', 'Qd'])).toBe('4d');
  });

  it('precisa de todas as vazas restantes: joga a mais forte', () => {
    const view = makeView({ me: { ...makeView().me, bid: 3 }, trick: contraAd });
    expect(bot.chooseCard(view, hand)).toBe('3c');
  });

  it('precisa de vaza e lidera: puxa a mais forte', () => {
    const view = makeView({ me: { ...makeView().me, bid: 1 } });
    expect(bot.chooseCard(view, hand)).toBe('3c');
  });

  it('reconhece a manilha como a carta mais forte', () => {
    // vira 3 → manilha 4: o 4 de ouros passa a ser imbatível pelas outras duas.
    const view = makeView({ manilhaRank: '4', vira: '3s', me: { ...makeView().me, bid: 3 } });
    expect(bot.chooseCard(view, hand)).toBe('4d');
  });
});

describe('palpite', () => {
  it('o bot médio nunca escolhe um valor fora dos legais', () => {
    const view = makeView({ phase: 'bidding', handSize: 3 });
    const bot = createMediumBot();
    for (const legal of [[0, 1, 2, 3], [0, 2, 3], [0], [1], [2, 3]]) {
      expect(legal).toContain(bot.chooseBid(view, legal));
    }
  });

  it('o bot fácil também respeita os palpites legais', () => {
    const view = makeView({ phase: 'bidding', handSize: 3 });
    const bot = createEasyBot();
    expect([0, 2, 3]).toContain(bot.chooseBid(view, [0, 2, 3]));
  });

  it('com a mão cheia de manilhas, palpita alto', () => {
    const view = makeView({
      phase: 'bidding',
      handSize: 3,
      vira: '3s',
      manilhaRank: '4',
      me: { ...makeView().me, hand: ['4d', '4s', '4h'], bid: null },
    });
    expect(createMediumBot().chooseBid(view, [0, 1, 2, 3])).toBe(3);
  });

  it('com a mão cheia de cartas fracas, palpita zero', () => {
    const view = makeView({
      phase: 'bidding',
      handSize: 3,
      vira: 'Kd',
      manilhaRank: 'A',
      me: { ...makeView().me, hand: ['4d', '5d', '6d'], bid: null },
    });
    expect(createMediumBot().chooseBid(view, [0, 1, 2, 3])).toBe(0);
  });

  it('na mão de 1 carta palpita pela força da carta que ele tem', () => {
    const umaCarta = (card: CardId) =>
      makeView({
        phase: 'bidding',
        handSize: 1,
        vira: 'Kd',
        manilhaRank: 'A',
        me: { ...makeView().me, hand: [card], handCount: 1, bid: null },
        opponents: makeView().opponents.map((o) => ({ ...o, handCount: 1 })),
      });

    const bot = createMediumBot();
    // Manilha de paus: imbatível, ninguém tira dele → palpita 1.
    expect(bot.chooseBid(umaCarta('Ac'), [0, 1])).toBe(1);
    // A carta mais fraca do baralho → palpita 0.
    expect(bot.chooseBid(umaCarta('4d'), [0, 1])).toBe(0);
  });
});

describe('força relativa dos bots', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  function duelo(levels: string[]): number[] {
    const totals = [0, 0, 0, 0];
    for (const seed of seeds) {
      const cfg = defaultConfig({ players: defaultPlayers(4), seed, maxCardsCap: 5 });
      const final = runMatch(cfg, botsFor(cfg, levels, seed));
      final.players.forEach((p, i) => {
        totals[i]! += p.penalty;
      });
    }
    return totals;
  }

  it('o médio erra menos que o aleatório', () => {
    const [medio, , aleatorio] = duelo(['medium', 'medium', 'random', 'random']);
    expect(medio!).toBeLessThan(aleatorio! * 0.6);
  });

  it('o médio erra menos que o fácil', () => {
    const [medio, , facil] = duelo(['medium', 'medium', 'easy', 'easy']);
    expect(medio!).toBeLessThan(facil!);
  });

  it('o fácil erra menos que o aleatório', () => {
    const [facil, , aleatorio] = duelo(['easy', 'easy', 'random', 'random']);
    expect(facil!).toBeLessThan(aleatorio!);
  });
});

describe('legalidade em partida completa', () => {
  // `runMatch` lança se o reducer rejeitar qualquer ação, então terminar uma
  // partida já prova que todo palpite e toda carta foram legais.
  it.each([2, 4, 5, 6, 8])('%i jogadores médios jogam uma partida inteira sem ação ilegal', (n) => {
    const cfg = defaultConfig({ players: defaultPlayers(n), seed: 31, maxCardsCap: 4 });
    const final = runMatch(cfg, botsFor(cfg, ['medium'], 31));
    expect(final.phase).toBe('matchOver');
  });

  it('bots médios também respeitam a ordem de naipes invertida', () => {
    const cfg = defaultConfig({
      players: defaultPlayers(4),
      seed: 5,
      maxCardsCap: 4,
      suitOrder: [...SUITS].reverse(),
    });
    expect(runMatch(cfg, botsFor(cfg, ['medium'], 5)).phase).toBe('matchOver');
  });
});
