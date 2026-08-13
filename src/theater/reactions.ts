/**
 * Do evento do jogo até a frase que sai da boca de um bot.
 *
 * Função pura, com PRNG explícito: dado o mesmo log, o mesmo estado e a mesma
 * semente, sai sempre a mesma reação. É isso que torna o teatro testável.
 */

import { rankIndex, rankOf, suitOf } from '../engine/ranking';
import type { PlayerView } from '../engine/selectors';
import { nextFloat, nextInt } from '../engine/rng';
import type { LoggedEvent } from '../transport/types';
import { falasDe, personaPara } from './personas';
import type { Persona } from './personas';
import { TRIGGERS } from './triggers';
import type { Registro, Trigger } from './triggers';

export interface Reaction {
  /** Quem fala — a âncora do balão é o assento dele. */
  playerId: string;
  persona: Persona;
  trigger: Trigger;
  texto: string;
}

export interface TheaterState {
  /** Instante da última fala de cada bot, em ms. */
  ultimaFala: Record<string, number>;
  /** Última frase de cada bot, para ele não se repetir. */
  ultimaFrase: Record<string, string>;
}

export function estadoInicial(): TheaterState {
  return { ultimaFala: {}, ultimaFrase: {} };
}

/** Silêncio mínimo entre duas falas do mesmo bot. */
export const COOLDOWN_MS = 3500;

/** Balões simultâneos na tela. */
export const MAX_BALOES = 2;

// ---------------------------------------------------------------------------
// Do evento ao gatilho
// ---------------------------------------------------------------------------

interface Gatilho {
  trigger: Trigger;
  /** De quem é a jogada. `null` quando o gatilho é da mesa, não de alguém. */
  autor: string | null;
}

/** Carta comum e baixa: levar a vaza com ela é roubo. */
function cartaFraca(card: string): boolean {
  return rankIndex(rankOf(card as never)) <= 3; // 4, 5, 6 ou 7
}

export function gatilhoDe(logged: LoggedEvent): Gatilho | null {
  const { event, view } = logged;

  switch (event.t) {
    case 'HAND_DEALT':
      return event.vira === null ? { trigger: 'sem_manilha', autor: null } : null;

    case 'BID_MADE': {
      // O distribuidor só fica sem escolha na mão de 1 carta: com 2 ou mais
      // sempre sobram pelo menos dois palpites legais.
      const semEscolha = view.handSize === 1 && view.dealerId === event.playerId;
      if (semEscolha) return { trigger: 'bid_forcado', autor: event.playerId };
      if (view.handSize > 1 && event.bid === view.handSize)
        return { trigger: 'bid_all', autor: event.playerId };
      if (event.bid === 0) return { trigger: 'bid_zero', autor: event.playerId };
      return null;
    }

    case 'CARD_PLAYED': {
      if (view.manilhaRank === null || rankOf(event.card) !== view.manilhaRank) return null;
      const naipeMaisForte = view.config.suitOrder[view.config.suitOrder.length - 1];
      const trigger: Trigger = suitOf(event.card) === naipeMaisForte ? 'zap' : 'manilha';
      return { trigger, autor: event.playerId };
    }

    case 'TRICK_WON': {
      const vencedor = quemE(view, event.playerId);
      if (vencedor && vencedor.bid !== null && vencedor.tricksWon > vencedor.bid) {
        return { trigger: 'passou', autor: event.playerId };
      }
      const manilha = view.manilhaRank !== null && rankOf(event.card) === view.manilhaRank;
      if (!manilha && cartaFraca(event.card)) return { trigger: 'roubada', autor: event.playerId };
      return null;
    }

    case 'TRICK_ANNULLED':
      return { trigger: 'melou', autor: null };

    case 'HAND_SCORED': {
      // Um comentário por mão, sobre o caso mais interessante: o erro maior, ou,
      // se ninguém errou feio, alguém que cravou.
      const pior = [...event.result.rows].sort((a, b) => b.penalty - a.penalty)[0];
      if (pior && pior.penalty >= 2) return { trigger: 'errou', autor: pior.playerId };
      const cravou = event.result.rows.filter((r) => r.penalty === 0);
      if (cravou.length > 0) return { trigger: 'na_mosca', autor: cravou[0]!.playerId };
      return null;
    }

    case 'PLAYER_ELIMINATED':
      return { trigger: 'eliminado', autor: event.playerId };

    case 'MATCH_OVER':
      return event.winnerIds.length > 0
        ? { trigger: 'venceu', autor: event.winnerIds[0]! }
        : null;

    default:
      return null;
  }
}

function quemE(view: PlayerView, playerId: string) {
  if (view.me.id === playerId) return view.me;
  return view.opponents.find((o) => o.id === playerId) ?? null;
}

// ---------------------------------------------------------------------------
// Do gatilho às falas
// ---------------------------------------------------------------------------

interface Candidato {
  playerId: string;
  seat: number;
  persona: Persona;
  peso: number;
}

function candidatos(
  view: PlayerView,
  gatilho: Gatilho,
  estado: TheaterState,
  agora: number,
): Candidato[] {
  const spec = TRIGGERS[gatilho.trigger];

  return view.opponents
    .filter((o) => {
      if (!o.isBot) return false;
      // Quem acabou de ser eliminado ainda tem direito à última palavra.
      if (o.eliminated && !(gatilho.trigger === 'eliminado' && o.id === gatilho.autor)) return false;
      if (o.id === gatilho.autor && !spec.autorFala) return false;
      const desde = agora - (estado.ultimaFala[o.id] ?? -Infinity);
      return desde >= COOLDOWN_MS;
    })
    .map((o) => {
      const persona = personaPara(o.seat);
      // Quando o próprio autor pode falar, ele tem preferência: é a piada.
      const bonus = o.id === gatilho.autor ? 2.2 : 1;
      return { playerId: o.id, seat: o.seat, persona, peso: persona.tagarelice * bonus };
    });
}

function sortearPonderado(lista: Candidato[], rng: number): { escolhido: Candidato; rng: number } {
  const total = lista.reduce((s, c) => s + c.peso, 0);
  const draw = nextFloat(rng);
  let alvo = draw.value * total;
  for (const c of lista) {
    alvo -= c.peso;
    if (alvo <= 0) return { escolhido: c, rng: draw.state };
  }
  return { escolhido: lista[lista.length - 1]!, rng: draw.state };
}

export interface ReactionInput {
  logged: LoggedEvent;
  registro: Registro;
  estado: TheaterState;
  /** Balões já na tela, para respeitar o teto. */
  baloesAtivos: number;
  agora: number;
  rng: number;
}

export function reactionsFor(input: ReactionInput): { reactions: Reaction[]; rng: number } {
  const { logged, registro, estado, baloesAtivos, agora } = input;
  let rng = input.rng;

  const gatilho = gatilhoDe(logged);
  if (gatilho === null) return { reactions: [], rng };

  const spec = TRIGGERS[gatilho.trigger];
  const sorte = nextFloat(rng);
  rng = sorte.state;
  if (sorte.value > spec.chance) return { reactions: [], rng };

  const espaco = Math.max(0, MAX_BALOES - baloesAtivos);
  if (espaco === 0) return { reactions: [], rng };

  let pool = candidatos(logged.view, gatilho, estado, agora);
  const quantos = Math.min(spec.falantes, espaco, pool.length);
  const reactions: Reaction[] = [];

  for (let i = 0; i < quantos; i++) {
    if (pool.length === 0) break;
    const escolha = sortearPonderado(pool, rng);
    rng = escolha.rng;
    const { playerId, persona } = escolha.escolhido;

    const falas = falasDe(persona, gatilho.trigger, registro);
    if (falas.length === 0) {
      pool = pool.filter((c) => c.playerId !== playerId);
      continue;
    }

    // Nunca repetir a última frase daquele bot, se houver alternativa.
    const anterior = estado.ultimaFrase[playerId];
    const opcoes = falas.length > 1 ? falas.filter((f) => f !== anterior) : falas;
    const idx = nextInt(rng, opcoes.length);
    rng = idx.state;

    reactions.push({ playerId, persona, trigger: gatilho.trigger, texto: opcoes[idx.value]! });
    pool = pool.filter((c) => c.playerId !== playerId);
  }

  return { reactions, rng };
}

/** Aplica as reações ao estado do teatro, para o próximo cálculo. */
export function registrar(estado: TheaterState, reactions: Reaction[], agora: number): TheaterState {
  if (reactions.length === 0) return estado;
  const ultimaFala = { ...estado.ultimaFala };
  const ultimaFrase = { ...estado.ultimaFrase };
  for (const r of reactions) {
    ultimaFala[r.playerId] = agora;
    ultimaFrase[r.playerId] = r.texto;
  }
  return { ultimaFala, ultimaFrase };
}
