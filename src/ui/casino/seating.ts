/**
 * Geometria dos assentos ao redor da mesa.
 *
 * Função pura, sem React e sem DOM — é ela que decide onde cada jogador senta,
 * onde as fichas dele pousam no feltro e de que direção as cartas dele entram
 * na vaza. As animações direcionais são só um `translate` ao longo de
 * `dirX`/`dirY`, então nada aqui precisa medir elemento nenhum.
 *
 * Convenção de ângulo: graus, com `y` crescendo para baixo (coordenada de
 * tela). 0° = direita, 90° = base, 180° = esquerda, 270° = topo.
 */

/** O jogador local senta sempre na base da mesa. */
export const LOCAL_SEAT_ANGLE = 90;

/** Arco em que os adversários se distribuem, passando pelo topo. */
const ARC_START = 150;
const ARC_SWEEP = 240;

/** Raio da elipse, em porcentagem do contêiner. */
const RADIUS_X = 42;
const RADIUS_Y = 40;

/** Fração do raio onde ficam as fichas e as cartas da vaza. */
export const BET_RADIUS_RATIO = 0.62;
/** Longe o bastante para a roseta não encostar no monte que fica no centro. */
export const TRICK_RADIUS_RATIO = 0.42;

export interface Seat {
  /** Ângulo do assento, em graus. */
  angle: number;
  /** Posição do assento, em porcentagem do contêiner. */
  x: number;
  y: number;
  /** Onde as fichas de aposta desse jogador pousam. */
  betX: number;
  betY: number;
  /** Onde a carta jogada por ele pousa na roseta da vaza. */
  trickX: number;
  trickY: number;
  /** Vetor unitário centro → assento. Direção de entrada das animações. */
  dirX: number;
  dirY: number;
}

function seatAt(angle: number): Seat {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    angle,
    x: 50 + RADIUS_X * cos,
    y: 50 + RADIUS_Y * sin,
    betX: 50 + RADIUS_X * BET_RADIUS_RATIO * cos,
    betY: 50 + RADIUS_Y * BET_RADIUS_RATIO * sin,
    trickX: 50 + RADIUS_X * TRICK_RADIUS_RATIO * cos,
    trickY: 50 + RADIUS_Y * TRICK_RADIUS_RATIO * sin,
    dirX: cos,
    dirY: sin,
  };
}

/**
 * Assentos dos adversários, na ordem de mesa a partir da esquerda do jogador
 * local — a mesma ordem em que `PlayerView.opponents` vem.
 */
export function opponentSeats(count: number): Seat[] {
  if (count <= 0) return [];
  const step = ARC_SWEEP / (count + 1);
  return Array.from({ length: count }, (_, i) => seatAt(ARC_START + (i + 1) * step));
}

/** O assento do jogador local, na base da mesa. */
export function localSeat(): Seat {
  return seatAt(LOCAL_SEAT_ANGLE);
}

/**
 * Todos os assentos indexados por id de jogador, para que balões, fichas e
 * animações achem a posição de qualquer um sem recalcular.
 */
export function seatMap(localId: string, opponentIds: readonly string[]): Map<string, Seat> {
  const map = new Map<string, Seat>();
  map.set(localId, localSeat());
  opponentSeats(opponentIds.length).forEach((seat, i) => map.set(opponentIds[i]!, seat));
  return map;
}

/**
 * As variáveis CSS que um elemento posicionado precisa. `--dir-*` alimenta as
 * animações direcionais; `--ang` orienta o que precisa apontar para o centro.
 */
export function seatStyle(seat: Seat, x: number, y: number): Record<string, string> {
  return {
    left: `${x}%`,
    top: `${y}%`,
    '--dir-x': seat.dirX.toFixed(4),
    '--dir-y': seat.dirY.toFixed(4),
    '--ang': `${seat.angle}deg`,
  };
}

/** Escala dos assentos: mesa de 8 precisa de assento menor para caber. */
export function seatScale(playerCount: number): number {
  if (playerCount <= 4) return 1;
  if (playerCount <= 6) return 0.88;
  return 0.76;
}
