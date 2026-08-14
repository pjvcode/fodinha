/**
 * A sala, ligada à rede.
 *
 * Um Durable Object por código. Ele é o host autoritativo da partida: mantém o
 * `MatchState`, roda os bots e manda para cada conexão apenas a `PlayerView` do
 * assento dela. É o papel que `LocalTransport` faz numa aba — e por ser um
 * objeto único e serializado por natureza, não há duas jogadas chegando ao mesmo
 * estado ao mesmo tempo.
 *
 * Casca fina de propósito: a regra está toda em `roomLogic.ts`, que é puro e
 * testado sem `workerd`. Aqui só há rede, relógio e armazenamento.
 *
 * Duas escolhas de plataforma que não são de estilo:
 *
 * 1. **Alarme, e não `setTimeout`, para o ritmo dos bots.** Um `setTimeout`
 *    funciona por algumas jogadas e depois estoura com "Network connection
 *    lost": o callback dispara fora do contexto de I/O da requisição que o
 *    criou, e a cadeia morre no meio da partida. O alarme roda num contexto
 *    próprio e é o mecanismo que a plataforma oferece para trabalho adiado.
 *
 * 2. **Hibernação nos WebSockets.** Com `acceptWebSocket` as conexões
 *    sobrevivem à evicção do objeto, e o estado vem do armazenamento a cada
 *    despertar. Uma sala parada não consome nada, e uma partida não morre
 *    porque ninguém jogou por um minuto.
 */

import { DEFAULT_TIMINGS, scaleTimings } from '../src/transport/types';
import type { Timings } from '../src/transport/types';
import type { MensagemCliente, MensagemServidor } from '../src/transport/protocol';
import {
  acaoDoCliente,
  aplicar,
  assentoDe,
  comecar,
  criarSala,
  entrar,
  eventosDesde,
  proximoPasso,
  reidratar,
  sair,
  salaPublica,
  serializar,
  viewDoAssento,
} from './roomLogic';
import type { SalaSerializada, SalaState, Usuario } from './roomLogic';
import type { Env } from './env';

/**
 * Ritmo Cinema, o mesmo das ligas: numa mesa com gente, correr atropela.
 *
 * `RITMO_SALA` no ambiente sobrepõe. Serve para afinar o ritmo em produção sem
 * mexer no código, e para os testes de ponta a ponta não levarem os nove
 * minutos que uma partida leva no ritmo de verdade.
 */
const RITMO_PADRAO = 1.5;

const CHAVE_SALA = 'sala';

/** O que cada socket carrega consigo, e que sobrevive à hibernação. */
interface Cracha {
  userId: string;
  display: string;
  assento: number;
  /** Último evento já mandado para esta conexão. */
  ultimoSeq: number;
}

export class RoomDO {
  private sala: SalaState | null = null;
  private carregado = false;
  private readonly timings: Timings;

  constructor(
    private readonly ctx: DurableObjectState,
    env: Env,
  ) {
    const ritmo = Number(env.RITMO_SALA);
    this.timings = scaleTimings(
      DEFAULT_TIMINGS,
      Number.isFinite(ritmo) && ritmo > 0 ? ritmo : RITMO_PADRAO,
    );
  }

  // -------------------------------------------------------------------------
  // Estado
  // -------------------------------------------------------------------------

  private async carregar(): Promise<void> {
    if (this.carregado) return;
    const dados = await this.ctx.storage.get<SalaSerializada>(CHAVE_SALA);
    this.sala = dados ? reidratar(dados) : null;
    this.carregado = true;
  }

  private async salvar(): Promise<void> {
    if (this.sala !== null) await this.ctx.storage.put(CHAVE_SALA, serializar(this.sala));
  }

  // -------------------------------------------------------------------------
  // HTTP
  // -------------------------------------------------------------------------

  async fetch(req: Request): Promise<Response> {
    await this.carregar();
    const url = new URL(req.url);

    // O Worker já autenticou o cookie e resolveu quem é. O DO não fica exposto
    // à internet — só o Worker fala com ele —, então recebe a identidade pronta.
    const usuario: Usuario = {
      id: req.headers.get('x-user-id') ?? '',
      display: req.headers.get('x-user-display') ?? '',
    };
    if (usuario.id === '') return new Response('sem usuário', { status: 401 });

    switch (url.pathname) {
      case '/criar':
        return this.criar(req, usuario);
      case '/entrar':
        return this.podeEntrar(usuario);
      case '/ws':
        return this.abrirSocket(req, usuario);
      default:
        return new Response('rota inexistente', { status: 404 });
    }
  }

  private async criar(req: Request, usuario: Usuario): Promise<Response> {
    if (this.sala !== null) return Response.json({ erro: 'Código em uso.' }, { status: 409 });

    const corpo = (await req.json()) as { codigo?: string; jogadores?: number };
    const resultado = criarSala(
      corpo.codigo ?? '',
      usuario,
      corpo.jogadores ?? 4,
      Math.floor(Math.random() * 0xffffffff),
    );
    if (!resultado.ok) return Response.json({ erro: resultado.erro }, { status: 400 });

    this.sala = resultado.valor;
    await this.salvar();
    return Response.json({ codigo: this.sala.codigo });
  }

  /** Checagem antes do upgrade, para a recusa chegar como frase e não como socket que fecha sozinho. */
  private podeEntrar(usuario: Usuario): Response {
    if (this.sala === null) return Response.json({ erro: 'Sala inexistente.' }, { status: 404 });

    if (assentoDe(this.sala, usuario.id) >= 0) return Response.json({ ok: true });
    if (this.sala.fase === 'jogando') {
      return Response.json({ erro: 'A partida já começou.' }, { status: 409 });
    }
    if (!this.sala.assentos.some((a) => a.tipo === 'vazio')) {
      return Response.json({ erro: 'A sala está cheia.' }, { status: 409 });
    }
    return Response.json({ ok: true });
  }

  private async abrirSocket(req: Request, usuario: Usuario): Promise<Response> {
    if (this.sala === null) return new Response('sala inexistente', { status: 404 });
    if (req.headers.get('upgrade') !== 'websocket') {
      return new Response('esperava upgrade', { status: 426 });
    }

    const sentado = entrar(this.sala, usuario);
    if (!sentado.ok) return new Response(sentado.erro, { status: 409 });
    await this.salvar();

    const par = new WebSocketPair();
    const [cliente, servidor] = [par[0], par[1]];

    this.ctx.acceptWebSocket(servidor);
    const cracha: Cracha = {
      userId: usuario.id,
      display: usuario.display,
      assento: sentado.valor,
      ultimoSeq: 0,
    };
    servidor.serializeAttachment(cracha);

    this.publicarSala();
    this.enviarEstado(servidor, cracha, 0);

    return new Response(null, { status: 101, webSocket: cliente });
  }

  // -------------------------------------------------------------------------
  // WebSocket (API de hibernação)
  // -------------------------------------------------------------------------

  async webSocketMessage(ws: WebSocket, dados: string | ArrayBuffer): Promise<void> {
    await this.carregar();
    if (this.sala === null || typeof dados !== 'string') return;

    const cracha = ws.deserializeAttachment() as Cracha | null;
    if (!cracha) return;

    let msg: MensagemCliente;
    try {
      msg = JSON.parse(dados) as MensagemCliente;
    } catch {
      return this.enviar(ws, { t: 'ERRO', erro: 'Mensagem ilegível.' });
    }

    switch (msg.t) {
      case 'RESUMIR':
        this.enviarEstado(ws, cracha, Number(msg.desdeSeq) || 0);
        return;

      case 'COMECAR': {
        const r = comecar(this.sala, cracha.userId);
        if (!r.ok) return this.enviar(ws, { t: 'ERRO', erro: r.erro });
        await this.salvar();
        this.publicarSala();
        this.publicarEstado();
        await this.agendar();
        return;
      }

      case 'ACAO': {
        const r = acaoDoCliente(this.sala, cracha.userId, msg.acao);
        if (!r.ok) return this.enviar(ws, { t: 'ERRO', erro: r.erro });
        if (r.valor === null) return;

        aplicar(this.sala, r.valor);
        await this.salvar();
        this.publicarEstado();
        await this.agendar();
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.encerrar(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.encerrar(ws);
  }

  private async encerrar(ws: WebSocket): Promise<void> {
    await this.carregar();
    const cracha = ws.deserializeAttachment() as Cracha | null;
    if (this.sala === null || !cracha) return;

    // Só solta o assento quando não sobrou outra aba do mesmo usuário.
    const outras = this.ctx
      .getWebSockets()
      .filter((s) => s !== ws)
      .some((s) => (s.deserializeAttachment() as Cracha | null)?.userId === cracha.userId);

    if (!outras) {
      sair(this.sala, cracha.userId);
      await this.salvar();
    }
    this.publicarSala();
  }

  // -------------------------------------------------------------------------
  // O relógio da mesa
  // -------------------------------------------------------------------------

  private esperaPara(fase: string | undefined): number {
    switch (fase) {
      case 'dealing':
        return this.timings.deal;
      case 'bidding':
        return this.timings.botBid;
      case 'playing':
        return this.timings.botPlay;
      case 'trickResolved':
        return this.timings.trickReveal;
      default:
        return 0;
    }
  }

  /**
   * Marca o próximo passo do host — a vez de um bot, ou a jogada de quem só tem
   * uma carta. Sem passo pendente, desarma: um alarme à toa acordaria o objeto
   * para não fazer nada.
   */
  private async agendar(): Promise<void> {
    if (this.sala === null) return;

    if (proximoPasso(this.sala) === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Date.now() + this.esperaPara(this.sala.match?.phase));
  }

  async alarm(): Promise<void> {
    await this.carregar();
    if (this.sala === null) return;

    // Recalcula em vez de guardar a ação: entre marcar e disparar, um humano
    // pode ter jogado e mudado de quem é a vez.
    const acao = proximoPasso(this.sala);
    if (acao === null) return;

    aplicar(this.sala, acao);
    await this.salvar();
    this.publicarEstado();
    await this.agendar();
  }

  // -------------------------------------------------------------------------
  // Envio
  // -------------------------------------------------------------------------

  private enviar(ws: WebSocket, msg: MensagemServidor): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket já fechado. `webSocketClose` cuida da limpeza.
    }
  }

  private publicarSala(): void {
    if (this.sala === null) return;
    const msg: MensagemServidor = { t: 'SALA', sala: salaPublica(this.sala) };
    for (const ws of this.ctx.getWebSockets()) this.enviar(ws, msg);
  }

  /** Cada conexão recebe a view do seu próprio assento, e só ela. */
  private enviarEstado(ws: WebSocket, cracha: Cracha, desdeSeq: number): void {
    if (this.sala === null) return;

    this.enviar(ws, { t: 'SALA', sala: salaPublica(this.sala) });

    const view = viewDoAssento(this.sala, cracha.assento);
    if (view === null) return;

    this.enviar(ws, {
      t: 'ESTADO',
      view,
      eventos: eventosDesde(this.sala, desdeSeq, cracha.assento),
      seq: this.sala.seq,
    });

    ws.serializeAttachment({ ...cracha, ultimoSeq: this.sala.seq } satisfies Cracha);
  }

  private publicarEstado(): void {
    if (this.sala === null) return;
    for (const ws of this.ctx.getWebSockets()) {
      const cracha = ws.deserializeAttachment() as Cracha | null;
      if (cracha) this.enviarEstado(ws, cracha, cracha.ultimoSeq);
    }
  }
}
