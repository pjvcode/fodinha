import type { CSSProperties } from 'react';

import { parseCard } from '../engine/ranking';
import type { CardId, Rank, Suit } from '../engine/types';

const SUIT_GLYPH: Record<Suit, string> = {
  ouros: '♦',
  espadas: '♠',
  copas: '♥',
  paus: '♣',
};

const SUIT_RED: Record<Suit, boolean> = {
  ouros: true,
  copas: true,
  espadas: false,
  paus: false,
};

export function suitGlyph(suit: Suit): string {
  return SUIT_GLYPH[suit];
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * A largura de cada tamanho, em pixels — espelha as classes `w-*` de `SIZES`.
 *
 * Existe porque o leque precisa saber quanto ocupa antes de desenhar: a conta
 * de quantas cartas cabem na tela é `n × (largura − sobreposição) +
 * sobreposição`, e ela não tem como ler uma classe do Tailwind.
 */
export const CARD_WIDTH: Record<CardSize, number> = { xs: 32, sm: 44, md: 64, lg: 80 };

interface SizeSpec {
  box: string;
  radius: string;
  /** Índice do canto: valor. */
  rank: string;
  /** Índice do canto: naipe. */
  corner: string;
  /** Naipe grande do meio. */
  center: string;
  padding: string;
}

const SIZES: Record<CardSize, SizeSpec> = {
  xs: {
    box: 'w-8 h-11',
    radius: 'rounded-[3px]',
    rank: 'text-[10px]',
    corner: 'text-[8px]',
    center: 'text-base',
    padding: 'p-[2px]',
  },
  sm: {
    box: 'w-11 h-16',
    radius: 'rounded',
    rank: 'text-sm',
    corner: 'text-[10px]',
    center: 'text-2xl',
    padding: 'p-[3px]',
  },
  md: {
    box: 'w-16 h-23',
    radius: 'rounded-md',
    rank: 'text-xl',
    corner: 'text-sm',
    center: 'text-4xl',
    padding: 'p-1',
  },
  lg: {
    box: 'w-20 h-29',
    radius: 'rounded-lg',
    rank: 'text-2xl',
    corner: 'text-base',
    center: 'text-5xl',
    padding: 'p-1.5',
  },
};

/** Direção de onde a carta entra, para as animações direcionais. */
export interface CardMotion {
  kind: 'deal' | 'play';
  dirX: number;
  dirY: number;
  /** Escalona o atraso na distribuição. */
  index?: number;
  /** Vira de verso para face durante a entrada. */
  flip?: boolean;
}

export interface CardViewProps {
  /** `null` mostra o verso. */
  card: CardId | null;
  size?: CardSize;
  isManilha?: boolean;
  playable?: boolean;
  /** Pré-selecionada: levantada e contornada em ouro, esperando confirmação. */
  selected?: boolean;
  dimmed?: boolean;
  /** Brilho que atravessa a carta uma vez — usado nas manilhas jogadas. */
  shine?: boolean;
  motion?: CardMotion;
  /** Varre a carta para esta direção (coleta da vaza pelo vencedor). */
  leaveTo?: { dirX: number; dirY: number };
  label?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function CardView({
  card,
  size = 'md',
  isManilha = false,
  playable = false,
  selected = false,
  dimmed = false,
  shine = false,
  motion,
  leaveTo,
  label,
  className = '',
  style,
  onClick,
}: CardViewProps) {
  const s = SIZES[size];

  const motionStyle: CSSProperties = { ...style };
  const motionClasses: string[] = [];

  if (motion) {
    Object.assign(motionStyle, {
      '--dir-x': motion.dirX.toFixed(4),
      '--dir-y': motion.dirY.toFixed(4),
      '--i': String(motion.index ?? 0),
    } as CSSProperties);
    motionClasses.push(motion.kind === 'deal' ? 'anim-deal' : 'anim-play');
  }
  if (leaveTo) {
    Object.assign(motionStyle, {
      '--to-x': leaveTo.dirX.toFixed(4),
      '--to-y': leaveTo.dirY.toFixed(4),
    } as CSSProperties);
    motionClasses.push('anim-collect');
  }

  const outer = [
    s.box,
    s.radius,
    'relative block shrink-0 select-none',
    ...motionClasses,
    className,
  ].join(' ');

  // Verso puro.
  if (card === null) {
    return (
      <div
        className={`${outer} card-back`}
        style={motionStyle}
        role="img"
        aria-label={label ?? 'Carta virada para baixo'}
      />
    );
  }

  const { rank, suit } = parseCard(card);
  const descricao = `${rank} de ${suit}${isManilha ? ' (manilha)' : ''}`;

  const face = (
    <div
      className={[
        'absolute inset-0 block card-face',
        s.radius,
        isManilha ? 'card-manilha' : '',
        shine ? 'card-shine overflow-hidden' : '',
        dimmed ? 'card-idle' : '',
      ].join(' ')}
    >
      <CardFace rank={rank} suit={suit} size={size} />
    </div>
  );

  // Com flip a carta chega de costas e gira no caminho; sem flip, entra aberta.
  const conteudo = motion?.flip ? (
    <div className={`card-3d absolute inset-0 block ${s.radius}`}>
      <div
        className="card-3d-inner anim-deal-turn"
        style={{ '--i': String(motion.index ?? 0) } as CSSProperties}
      >
        {face}
        <div className={`card-back card-3d-rear ${s.radius}`} />
      </div>
    </div>
  ) : (
    face
  );

  if (!playable) {
    return (
      <div className={outer} style={motionStyle} role="img" aria-label={label ?? descricao}>
        {conteudo}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={motionStyle}
      className={[
        outer,
        'card-playable focus:outline-2 focus:outline-offset-2 focus:outline-amber-300',
        selected ? 'card-selected' : '',
      ].join(' ')}
      aria-label={
        selected ? `${descricao} selecionada. Clique de novo para jogar.` : `Escolher ${descricao}`
      }
    >
      {conteudo}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Miolo da carta
// ---------------------------------------------------------------------------

/**
 * Desenho padrão de baralho de cassino: índice nos dois cantos opostos, o de
 * baixo espelhado, e o naipe grande no meio.
 *
 * A grade de pips de um baralho impresso é bonita mas ilegível nos tamanhos que
 * a mesa usa — o que o jogador precisa ler de relance, num leque sobreposto, é
 * o índice do canto. Ele fica grande e com contraste alto; o naipe central é
 * decoração de apoio.
 */
function CardFace({ rank, suit, size }: { rank: Rank; suit: Suit; size: CardSize }) {
  const s = SIZES[size];
  const cor = SUIT_RED[suit] ? 'text-[#c8102e]' : 'text-[#141821]';
  const glyph = SUIT_GLYPH[suit];

  const indice = (
    <span className="flex flex-col items-center leading-[0.95]">
      <span className={`${s.rank} font-bold tracking-tight`}>{rank}</span>
      <span className={`${s.corner} -mt-px`}>{glyph}</span>
    </span>
  );

  return (
    <div className={`absolute inset-0 ${cor}`}>
      <div className={`absolute inset-0 flex flex-col justify-between ${s.padding}`}>
        <div className="self-start">{indice}</div>
        <div className="self-end rotate-180">{indice}</div>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className={`${s.center} leading-none opacity-25`}>{glyph}</span>
      </div>
    </div>
  );
}
