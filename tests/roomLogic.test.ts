import { describe, expect, it } from 'vitest';

import {
  acaoDoCliente,
  aplicar,
  assentoDe,
  comecar,
  criarSala,
  entrar,
  eventosDesde,
  gerarCodigo,
  proximoPasso,
  reidratar,
  sair,
  salaPublica,
  serializar,
  viewDoAssento,
} from '../server/roomLogic';
import type { SalaSerializada, SalaState } from '../server/roomLogic';
import { ALFABETO_CODIGO, TAMANHO_CODIGO } from '../src/transport/protocol';

const ANFITRIAO = { id: 'u1', display: 'Pedro' };
const CONVIDADO = { id: 'u2', display: 'Ana' };

function sala(jogadores = 4): SalaState {
  const r = criarSala('ABCD', ANFITRIAO, jogadores, 42);
  if (!r.ok) throw new Error(r.erro);
  return r.valor;
}

/** Toca a partida até ela precisar de um humano, ou acabar. */
function rodarAteHumano(s: SalaState, limite = 5000): void {
  for (let i = 0; i < limite; i++) {
    const acao = proximoPasso(s);
    if (acao === null) return;
    aplicar(s, acao);
  }
  throw new Error('a mesa não parou — possível laço');
}

describe('gerarCodigo', () => {
  it('tem o tamanho combinado e só usa o alfabeto sem ambiguidade', () => {
    for (let i = 0; i < 200; i++) {
      const c = gerarCodigo();
      expect(c).toHaveLength(TAMANHO_CODIGO);
      for (const letra of c) expect(ALFABETO_CODIGO).toContain(letra);
    }
  });

  it('não usa letra que se confunde falada ao telefone', () => {
    for (const proibida of ['I', 'O', 'S', 'A', 'E', 'U']) {
      expect(ALFABETO_CODIGO).not.toContain(proibida);
    }
  });
});

describe('criarSala', () => {
  it('senta o anfitrião no assento 0 e deixa o resto vazio', () => {
    const s = sala(4);
    expect(s.assentos[0]).toMatchObject({ tipo: 'humano', userId: 'u1', display: 'Pedro' });
    expect(s.assentos.slice(1).every((a) => a.tipo === 'vazio')).toBe(true);
    expect(s.fase).toBe('lobby');
  });

  it('recusa mesa fora dos limites', () => {
    expect(criarSala('ABCD', ANFITRIAO, 1, 1).ok).toBe(false);
    expect(criarSala('ABCD', ANFITRIAO, 9, 1).ok).toBe(false);
    expect(criarSala('ABCD', ANFITRIAO, 2, 1).ok).toBe(true);
    expect(criarSala('ABCD', ANFITRIAO, 8, 1).ok).toBe(true);
  });
});

describe('entrar e sair', () => {
  it('senta o convidado no primeiro lugar livre', () => {
    const s = sala();
    const r = entrar(s, CONVIDADO);
    expect(r.ok && r.valor).toBe(1);
    expect(assentoDe(s, 'u2')).toBe(1);
  });

  it('entrar de novo devolve o mesmo assento, não um segundo', () => {
    const s = sala();
    entrar(s, CONVIDADO);
    const r = entrar(s, CONVIDADO);
    expect(r.ok && r.valor).toBe(1);
    expect(s.assentos.filter((a) => a.tipo === 'humano')).toHaveLength(2);
  });

  it('recusa quando a sala está cheia', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    const r = entrar(s, { id: 'u3', display: 'Zeca' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/cheia/);
  });

  it('no lobby, sair libera o assento', () => {
    const s = sala();
    entrar(s, CONVIDADO);
    sair(s, 'u2');
    expect(s.assentos[1]).toEqual({ tipo: 'vazio' });
  });

  it('em partida, sair só marca desconectado — a cadeira e a mão continuam', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');

    sair(s, 'u2');
    expect(s.assentos[1]).toMatchObject({ tipo: 'humano', userId: 'u2', conectado: false });
    expect(assentoDe(s, 'u2')).toBe(1);
  });

  it('quem caiu volta para a própria cadeira', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');
    sair(s, 'u2');

    const r = entrar(s, CONVIDADO);
    expect(r.ok && r.valor).toBe(1);
    expect(s.assentos[1]).toMatchObject({ conectado: true });
  });

  it('estranho não entra em partida já começada', () => {
    const s = sala(4);
    comecar(s, 'u1');
    const r = entrar(s, { id: 'u9', display: 'Intruso' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/já começou/);
  });
});

describe('comecar', () => {
  it('assento vazio vira bot', () => {
    const s = sala(4);
    entrar(s, CONVIDADO);
    const r = comecar(s, 'u1');

    expect(r.ok).toBe(true);
    expect(s.fase).toBe('jogando');
    expect(s.assentos.filter((a) => a.tipo === 'bot')).toHaveLength(2);
    expect(s.assentos.filter((a) => a.tipo === 'humano')).toHaveLength(2);
    expect(Object.keys(s.bots).sort()).toEqual(['p2', 'p3']);
  });

  it('sozinho, o anfitrião joga contra bots', () => {
    const s = sala(5);
    expect(comecar(s, 'u1').ok).toBe(true);
    expect(s.assentos.filter((a) => a.tipo === 'bot')).toHaveLength(4);
  });

  it('bot não rouba o nome de quem está na mesa', () => {
    const r = criarSala('ABCD', { id: 'u1', display: 'GIka' }, 4, 42);
    if (!r.ok) throw new Error(r.erro);
    comecar(r.valor, 'u1');

    const nomes = r.valor.assentos.map((a) => (a.tipo === 'vazio' ? '' : a.display.toLowerCase()));
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('só o anfitrião começa', () => {
    const s = sala();
    entrar(s, CONVIDADO);
    const r = comecar(s, 'u2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/anfitrião/);
  });

  it('não começa duas vezes', () => {
    const s = sala();
    comecar(s, 'u1');
    expect(comecar(s, 'u1').ok).toBe(false);
  });
});

describe('acaoDoCliente', () => {
  it('amarra a jogada ao assento de quem mandou', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');

    const r = acaoDoCliente(s, 'u2', { t: 'BID', bid: 0 });
    expect(r.ok).toBe(true);
    // O `playerId` sai do assento, não da mensagem: é o que impede alguém de
    // jogar no lugar de outro escrevendo outro id no socket.
    if (r.ok) expect(r.valor).toMatchObject({ t: 'BID', playerId: 'p1' });
  });

  it('recusa quem não está sentado', () => {
    const s = sala(2);
    comecar(s, 'u1');
    const r = acaoDoCliente(s, 'u9', { t: 'BID', bid: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/não está sentado/);
  });

  it('recusa ação antes de a partida começar', () => {
    const s = sala();
    expect(acaoDoCliente(s, 'u1', { t: 'BID', bid: 0 }).ok).toBe(false);
  });

  it('CONTINUE só vira NEXT_HAND na fase certa', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');

    const cedo = acaoDoCliente(s, 'u1', { t: 'CONTINUE' });
    expect(cedo.ok && cedo.valor).toBe(null);
  });
});

describe('a mesa anda sozinha', () => {
  it('bot joga sem ninguém pedir, e a mesa para na vez do humano', () => {
    const s = sala(4);
    comecar(s, 'u1');
    rodarAteHumano(s);

    // Sobrou só o humano para decidir: ou é a vez dele de palpitar/jogar, ou a
    // mão acabou e alguém precisa clicar em continuar.
    expect(s.match).not.toBeNull();
    expect(['bidding', 'playing', 'handScored', 'matchOver']).toContain(s.match!.phase);
    expect(proximoPasso(s)).toBeNull();
  });

  it('uma partida inteira de 2 humanos termina', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');

    for (let i = 0; i < 3000 && s.match!.phase !== 'matchOver'; i++) {
      const auto = proximoPasso(s);
      if (auto !== null) {
        aplicar(s, auto);
        continue;
      }
      // Vez de um humano: joga a primeira opção legal de quem está na vez.
      const m = s.match!;
      if (m.phase === 'bidding' && m.bidTurnIndex !== null) {
        const view = viewDoAssento(s, m.bidTurnIndex)!;
        aplicar(s, { t: 'BID', playerId: `p${m.bidTurnIndex}`, bid: view.legalBids[0]! });
      } else if (m.phase === 'playing' && m.turnIndex !== null) {
        const view = viewDoAssento(s, m.turnIndex)!;
        aplicar(s, { t: 'PLAY', playerId: `p${m.turnIndex}`, card: view.legalCards[0]! });
      } else if (m.phase === 'handScored') {
        aplicar(s, { t: 'NEXT_HAND' });
      } else {
        break;
      }
    }

    expect(s.match!.phase).toBe('matchOver');
    expect(s.match!.winnerIds.length).toBeGreaterThan(0);
  });
});

describe('informação oculta', () => {
  it('cada assento vê a própria mão e nunca a do outro', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');
    rodarAteHumano(s);

    const v0 = viewDoAssento(s, 0)!;
    const v1 = viewDoAssento(s, 1)!;

    expect(v0.me.id).toBe('p0');
    expect(v1.me.id).toBe('p1');
    // A mão de um não aparece em canto nenhum da view do outro.
    const serializada = JSON.stringify(v1);
    for (const carta of v0.me.hand) {
      // Uma carta pode estar na mesa (já jogada) e aparecer legitimamente.
      if (v0.playedCards.includes(carta)) continue;
      expect(serializada).not.toContain(carta);
    }
  });

  it('o log da sala não guarda view nenhuma — não há mão para vazar', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');
    rodarAteHumano(s);

    expect(s.log.length).toBeGreaterThan(0);
    for (const evento of s.log) {
      expect(evento).not.toHaveProperty('view');
    }
  });

  it('eventosDesde entrega a view de quem pediu, e só os eventos que faltavam', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');
    rodarAteHumano(s);

    const todos = eventosDesde(s, 0, 1);
    expect(todos.length).toBe(s.log.length);
    expect(todos.every((e) => e.view.me.id === 'p1')).toBe(true);

    const metade = s.log[Math.floor(s.log.length / 2)]!.seq;
    expect(eventosDesde(s, metade, 1).every((e) => e.seq > metade)).toBe(true);
  });

  it('ação recusada não entra no log — é assunto de quem mandou', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');
    const antes = s.log.length;

    aplicar(s, { t: 'PLAY', playerId: 'p0', card: '3c' });
    expect(s.log.length).toBe(antes);
  });
});

describe('serializar e reidratar', () => {
  it('a sala sobrevive a uma ida ao armazenamento', () => {
    const s = sala(4);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');
    rodarAteHumano(s);

    const voltou = reidratar(JSON.parse(JSON.stringify(serializar(s))) as SalaSerializada);

    expect(voltou.codigo).toBe(s.codigo);
    expect(voltou.assentos).toEqual(s.assentos);
    expect(voltou.match).toEqual(s.match);
    expect(voltou.seq).toBe(s.seq);
    expect(voltou.log).toEqual(s.log);
  });

  it('os bots renascem idênticos — mesmo nível, mesma semente', () => {
    const s = sala(4);
    comecar(s, 'u1');

    const voltou = reidratar(JSON.parse(JSON.stringify(serializar(s))) as SalaSerializada);
    expect(Object.keys(voltou.bots).sort()).toEqual(Object.keys(s.bots).sort());

    // Prova de que são o mesmo bot: as duas salas, tocadas do mesmo ponto,
    // chegam ao mesmo estado. Se a semente se perdesse, divergiriam.
    rodarAteHumano(s);
    rodarAteHumano(voltou);
    expect(voltou.match).toEqual(s.match);
  });

  it('sala de lobby, sem partida, também volta inteira', () => {
    const s = sala(3);
    entrar(s, CONVIDADO);

    const voltou = reidratar(JSON.parse(JSON.stringify(serializar(s))) as SalaSerializada);
    expect(voltou.fase).toBe('lobby');
    expect(voltou.match).toBeNull();
    expect(voltou.bots).toEqual({});
    expect(voltou.assentos).toEqual(s.assentos);
  });
});

describe('salaPublica', () => {
  it('não leva carta nenhuma', () => {
    const s = sala(2);
    entrar(s, CONVIDADO);
    comecar(s, 'u1');
    rodarAteHumano(s);

    const publica = JSON.stringify(salaPublica(s));
    expect(publica).not.toContain('hand');
    expect(publica).not.toContain('stock');
    expect(publica).toContain('ABCD');
  });
});
