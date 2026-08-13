/**
 * Tipos do engine de Fodinha.
 *
 * Nada aqui depende de React ou de qualquer API de browser. Todo o estado é
 * serializável em JSON (inclusive o estado do PRNG), o que é o que permite
 * testes reprodutíveis, replay de partidas e, depois, sincronização em rede.
 */

/** Naipes na ordem fraca → forte. O índice no array é a força do naipe. */
export const SUITS = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Suit = (typeof SUITS)[number];

/** Valores na ordem fraca → forte. O índice no array é a força do valor. */
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export type Rank = (typeof RANKS)[number];

export const SUIT_CODE = { ouros: 'd', espadas: 's', copas: 'h', paus: 'c' } as const;
export type SuitCode = (typeof SUIT_CODE)[Suit];

/** Identificador compacto e estável de uma carta, ex.: `'3c'` = 3 de paus. */
export type CardId = `${Rank}${SuitCode}`;

export interface Card {
  rank: Rank;
  suit: Suit;
  id: CardId;
}

/** Total de cartas do baralho de Fodinha (40: sem 8, 9 e 10). */
export const DECK_SIZE = 40;

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export type BotLevel = 'easy' | 'medium' | 'hard';

/**
 * `'suit'`  — o naipe desempata TODAS as cartas de mesmo valor. Ordem total
 *             estrita sobre as 40 cartas; toda vaza tem exatamente um dono.
 * `'melar'` — cartas comuns de mesmo valor se anulam; leva a vaza a maior
 *             carta cuja força aparece uma única vez. Manilhas nunca melam.
 */
export type TieBreak = 'suit' | 'melar';

/**
 * `'penalty'`     — soma de |palpite − vazas| ao longo de toda a progressão;
 *                   menor total vence.
 * `'elimination'` — cada jogador começa com `startingLives` vidas e perde
 *                   vidas iguais ao erro; sai quem zera, vence o último.
 */
export type ScoringMode = 'penalty' | 'elimination';

export type ProgressionMode = 'up-down' | 'down-up';

export interface PlayerConfig {
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
}

export interface GameConfig {
  players: PlayerConfig[];
  /** Naipes na ordem fraca → forte. */
  suitOrder: readonly Suit[];
  tieBreak: TieBreak;
  /** Teto artificial de cartas por mão. `null` = C_max natural = piso(40/N). */
  maxCardsCap: number | null;
  progression: ProgressionMode;
  /** Repete a mão do ponto de virada da progressão (o máximo, ou o 1). */
  repeatMaxHand: boolean;
  scoringMode: ScoringMode;
  startingLives: number;
  /** Semente do PRNG. Sempre concreta no estado — quem sorteia é a UI. */
  seed: number;
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export type Phase =
  | 'setup'
  | 'dealing'
  | 'bidding'
  | 'playing'
  | 'trickResolved'
  | 'handScored'
  | 'matchOver';

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
  hand: CardId[];
  bid: number | null;
  tricksWon: number;
  /** Penalidade acumulada na partida inteira. */
  penalty: number;
  /** Só tem significado em `scoringMode: 'elimination'`. */
  lives: number;
  eliminated: boolean;
}

export interface TrickPlay {
  playerId: string;
  card: CardId;
}

export interface TrickState {
  leaderId: string;
  plays: TrickPlay[];
}

export interface ResolvedTrick extends TrickState {
  /** `null` quando a vaza foi anulada (só possível em `tieBreak: 'melar'`). */
  winnerId: string | null;
}

export interface HandResultRow {
  playerId: string;
  bid: number;
  tricksWon: number;
  penalty: number;
  totalPenalty: number;
  lives: number;
  eliminated: boolean;
}

export interface HandResult {
  handIndex: number;
  handSize: number;
  vira: CardId | null;
  manilhaRank: Rank | null;
  rows: HandResultRow[];
}

export interface MatchState {
  phase: Phase;
  config: GameConfig;
  /** Estado do PRNG (um uint32). Serializável, avança a cada embaralhada. */
  rng: number;
  players: PlayerState[];
  /** Sequência sobe-e-desce de tamanhos de mão, pré-calculada. */
  handSizes: number[];
  /** Índice na `handSizes`. `-1` antes da partida começar. */
  handIndex: number;
  handSize: number;
  dealerIndex: number;
  /** Cartas ainda no monte após a distribuição e o vira. */
  stock: CardId[];
  /** `null` quando `handSize × jogadores ativos === 40` (não sobra carta). */
  vira: CardId | null;
  /** `null` quando não há vira: a mão é jogada sem manilha. */
  manilhaRank: Rank | null;
  bidTurnIndex: number | null;
  turnIndex: number | null;
  trick: TrickState | null;
  completedTricks: ResolvedTrick[];
  /** Vaza recém-resolvida, mantida durante a fase `trickResolved`. */
  lastTrick: ResolvedTrick | null;
  history: HandResult[];
  /** Preenchido ao entrar em `matchOver`. Mais de um id = vitória dividida. */
  winnerIds: string[];
}

// ---------------------------------------------------------------------------
// Ações e eventos
// ---------------------------------------------------------------------------

export type Action =
  | { t: 'START_MATCH' }
  | { t: 'DEAL' }
  | { t: 'BID'; playerId: string; bid: number }
  | { t: 'PLAY'; playerId: string; card: CardId }
  /**
   * Avança para além da pausa de revelação da vaza. A resolução em si já
   * aconteceu no último `PLAY`; quando a mão acaba, esta ação também aplica a
   * pontuação e leva a `handScored`.
   */
  | { t: 'RESOLVE_TRICK' }
  | { t: 'NEXT_HAND' };

export type GameEvent =
  | {
      t: 'HAND_DEALT';
      handIndex: number;
      handSize: number;
      vira: CardId | null;
      manilhaRank: Rank | null;
    }
  | { t: 'BID_MADE'; playerId: string; bid: number }
  | { t: 'BIDDING_COMPLETE'; total: number; handSize: number }
  | { t: 'CARD_PLAYED'; playerId: string; card: CardId }
  | { t: 'TRICK_WON'; playerId: string; card: CardId }
  | { t: 'TRICK_ANNULLED'; leaderId: string }
  | { t: 'HAND_SCORED'; result: HandResult }
  | { t: 'PLAYER_ELIMINATED'; playerId: string }
  | { t: 'MATCH_OVER'; winnerIds: string[] }
  | { t: 'INVALID_ACTION'; action: Action; reason: string };

export interface ReduceResult {
  state: MatchState;
  events: GameEvent[];
}
