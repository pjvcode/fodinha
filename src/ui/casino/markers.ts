/**
 * O que marca uma aposta no feltro.
 *
 * A ficha de pôquer é o padrão, mas o jogador escolhe com o que aposta — e a
 * escolha é dele e só dele: os bots seguem com fichas coloridas por assento.
 * Achar a própria fileira de relance numa mesa de oito é o que a customização
 * compra de verdade.
 *
 * Módulo puro: nada aqui sabe o que é React. O desenho de cada marcador está em
 * `Marker.tsx`, e a matemática da fileira (quantas fichas, quais douradas, qual
 * vaza cada uma abre) continua inteira em `chips.ts` — trocar o desenho não
 * mexe em uma linha dela.
 */

export type MarcadorId = 'ficha' | 'tampinha' | 'bala' | 'ampola';

export interface MarcadorSpec {
  id: MarcadorId;
  label: string;
  hint: string;
  /** Largura em múltiplos do diâmetro da ficha. */
  larguraRel: number;
  /** Altura em múltiplos do diâmetro da ficha. */
  alturaRel: number;
}

/**
 * Três dos quatro são redondos de propósito: a fileira só continua contável de
 * relance se as peças tiverem a mesma pegada. A ampola é a exceção deliberada —
 * é alta e fina, e é por causa dela que `markerBox` existe.
 */
export const MARCADORES: readonly MarcadorSpec[] = [
  {
    id: 'ficha',
    label: 'Ficha de pôquer',
    hint: 'o clássico da mesa de feltro',
    larguraRel: 1,
    alturaRel: 1,
  },
  {
    id: 'tampinha',
    label: 'Tampinha de cerveja',
    hint: 'mesa de bar, sem frescura',
    larguraRel: 1,
    alturaRel: 1,
  },
  {
    id: 'bala',
    label: 'Bala de revólver',
    hint: 'culote na mesa, aposta com peso',
    larguraRel: 1,
    alturaRel: 1,
  },
  {
    id: 'ampola',
    label: 'Ampola de anabolizante',
    hint: 'o ciclo é de vazas',
    larguraRel: 0.62,
    alturaRel: 1.62,
  },
];

export const MARCADOR_PADRAO: MarcadorId = 'ficha';

export function marcadorSpec(id: string): MarcadorSpec {
  return MARCADORES.find((m) => m.id === id) ?? MARCADORES[0]!;
}

/** O marcador de um id qualquer é válido? Guarda para o que vem do storage. */
export function isMarcadorId(id: unknown): id is MarcadorId {
  return typeof id === 'string' && MARCADORES.some((m) => m.id === id);
}

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

export type CorId =
  | 'azul'
  | 'vermelho'
  | 'verde'
  | 'roxo'
  | 'laranja'
  | 'turquesa'
  | 'rosa'
  | 'grafite';

export interface CorSpec {
  id: CorId;
  label: string;
  /** Cor do corpo do marcador. */
  body: string;
  /** Cor do contraste: listras da ficha, rótulo da ampola, espoleta da bala. */
  edge: string;
}

/**
 * A mesma paleta serve para a escolha do jogador e para as cores por assento
 * dos bots — oito cores, uma por assento numa mesa cheia, nenhuma repetida.
 */
export const CORES: readonly CorSpec[] = [
  { id: 'azul', label: 'Azul', body: '#1f6fb8', edge: '#eaf3fb' },
  { id: 'vermelho', label: 'Vermelho', body: '#b3243a', edge: '#ffe6ea' },
  { id: 'verde', label: 'Verde', body: '#2c8a4b', edge: '#e8f7ec' },
  { id: 'roxo', label: 'Roxo', body: '#7a3fb0', edge: '#f2e9fa' },
  { id: 'laranja', label: 'Laranja', body: '#c96a12', edge: '#fdeedc' },
  { id: 'turquesa', label: 'Turquesa', body: '#0f8f97', edge: '#e3f7f8' },
  { id: 'rosa', label: 'Rosa', body: '#9c2f6d', edge: '#fbe7f2' },
  { id: 'grafite', label: 'Grafite', body: '#4a5568', edge: '#eceef2' },
];

export const COR_PADRAO: CorId = 'azul';

export function corMarcador(id: string): CorSpec {
  return CORES.find((c) => c.id === id) ?? CORES[0]!;
}

export function isCorId(id: unknown): id is CorId {
  return typeof id === 'string' && CORES.some((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

/**
 * A caixa de um marcador, a partir do diâmetro que `chipSize()` já decidiu para
 * a fileira. Marcador redondo devolve a caixa quadrada de sempre; a ampola sai
 * mais estreita e mais alta, e é a fileira que se acomoda.
 */
export function markerBox(size: number, spec: MarcadorSpec): { w: number; h: number } {
  return {
    w: Math.round(size * spec.larguraRel),
    h: Math.round(size * spec.alturaRel),
  };
}
