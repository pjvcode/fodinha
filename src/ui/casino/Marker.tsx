import type { CSSProperties } from 'react';

import { markerBox, marcadorSpec } from './markers';
import type { CorSpec, MarcadorId } from './markers';

/**
 * O desenho de um marcador de aposta.
 *
 * Os quatro compartilham exatamente uma linguagem: o corpo é `--chip-body`, o
 * contraste é `--chip-edge`, e os três estados (cumprida, pendente, excedente)
 * são pintados de fora, pelas classes do CSS, trocando essas duas variáveis.
 * Um marcador novo não precisa saber o que é "vaza cumprida" — ele só lê as
 * variáveis, e a ficha de pôquer já funcionava assim antes de existirem os
 * outros três.
 *
 * Nada de arquivo de imagem: SVG inline com preenchimento chapado e camadas de
 * branco e preto por cima, que é como o feltro, o trilho e a ficha já são
 * feitos. Sem `<linearGradient>` também por um motivo prático — ids de gradiente
 * são globais no documento e colidiriam entre as dezenas de marcadores da mesa.
 */

/**
 * `base` é o marcador na cor escolhida, sem estado nenhum — serve às amostras
 * do perfil, onde o que importa é ver a cor limpa. Na mesa toda peça tem um dos
 * outros três.
 */
export type EstadoMarcador = 'base' | 'cumprida' | 'pendente' | 'excedente';

export interface MarkerProps {
  tipo: MarcadorId;
  cor: CorSpec | { body: string; edge: string };
  estado: EstadoMarcador;
  /** Diâmetro de referência da fileira, em pixels. */
  size: number;
  /** Escalona o atraso da animação de lançamento. */
  index?: number;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

export function Marker({
  tipo,
  cor,
  estado,
  size,
  index = 0,
  title,
  ariaLabel,
  onClick,
}: MarkerProps) {
  const spec = marcadorSpec(tipo);
  const { w, h } = markerBox(size, spec);

  const style = {
    width: w,
    height: h,
    '--marcador-base': cor.body,
    '--marcador-borda': cor.edge,
    '--i': String(index),
  } as CSSProperties;

  // A ficha continua sendo o `.chip` de CSS puro que sempre foi: listras em
  // `repeating-conic-gradient` e miolo com brilho. Não há por que redesenhar em
  // SVG o que já está certo.
  const familia = tipo === 'ficha' ? 'chip' : 'marker';
  const classe = [
    familia,
    estado === 'base' ? '' : `${familia}--${estado}`,
    'anim-chip',
  ]
    .filter(Boolean)
    .join(' ');

  const conteudo = tipo === 'ficha' ? null : <Desenho tipo={tipo} />;

  if (onClick === undefined) {
    return (
      <span
        className={classe}
        style={style}
        title={title}
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
      >
        {conteudo}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`${classe} marcador-clicavel ${estado === 'cumprida' ? 'anim-chip-claim' : ''}`}
      style={style}
    >
      {conteudo}
    </button>
  );
}

function Desenho({ tipo }: { tipo: MarcadorId }) {
  switch (tipo) {
    case 'tampinha':
      return <Tampinha />;
    case 'bala':
      return <Bala />;
    case 'ampola':
      return <Ampola />;
    default:
      return null;
  }
}

const svgProps = {
  className: 'block h-full w-full',
  xmlns: 'http://www.w3.org/2000/svg',
  focusable: false as const,
  'aria-hidden': true,
};

// ---------------------------------------------------------------------------
// Tampinha de cerveja
// ---------------------------------------------------------------------------

/**
 * As 21 ondas da crimpagem — o número é o de uma tampa de garrafa de verdade, e
 * é a silhueta serrilhada que faz a peça ser lida como tampinha e não como
 * ficha. Calculado uma vez, no carregamento do módulo.
 */
const CRIMPS = Array.from({ length: 21 }, (_, i) => {
  const a = (i / 21) * Math.PI * 2;
  return { cx: 20 + Math.cos(a) * 16.4, cy: 20 + Math.sin(a) * 16.4 };
});

function Tampinha() {
  return (
    <svg {...svgProps} viewBox="0 0 40 40">
      {CRIMPS.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={2.7} fill="var(--chip-body)" />
      ))}
      <circle cx="20" cy="20" r="16.6" fill="var(--chip-body)" />
      {/* Sombra da saia crimpada, para a borda não ficar chapada. */}
      <circle
        cx="20"
        cy="20"
        r="15.4"
        fill="none"
        stroke="#000"
        strokeOpacity="0.3"
        strokeWidth="2.4"
      />
      {/* A face impressa. */}
      <circle cx="20" cy="20" r="13" fill="var(--chip-edge)" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="#000" strokeOpacity="0.22" />
      <circle cx="20" cy="20" r="4.6" fill="var(--chip-body)" />
      {/* Reflexo do metal, sempre do mesmo canto que o das cartas. */}
      <ellipse cx="14.5" cy="13" rx="8.5" ry="5" fill="#fff" fillOpacity="0.2" />
      <path
        d="M6 20a14 14 0 0 1 8-12.6"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bala de revólver
// ---------------------------------------------------------------------------

/**
 * O culote do estojo, visto de cima — que é o ângulo em que a mesa vê tudo o
 * mais. Aro, ranhura do extrator, espoleta e o anel de headstamp.
 */
const HEADSTAMP = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  return { cx: 20 + Math.cos(a) * 10, cy: 20 + Math.sin(a) * 10 };
});

function Bala() {
  return (
    <svg {...svgProps} viewBox="0 0 40 40">
      {/* Aro. */}
      <circle cx="20" cy="20" r="18.6" fill="var(--chip-body)" />
      <circle cx="20" cy="20" r="18.6" fill="none" stroke="#000" strokeOpacity="0.35" />
      {/* Ranhura do extrator: o sulco fundo entre o aro e o corpo do estojo. */}
      <circle
        cx="20"
        cy="20"
        r="15.2"
        fill="none"
        stroke="#000"
        strokeOpacity="0.4"
        strokeWidth="2.6"
      />
      {/* Face do culote, um tom acima do aro. */}
      <circle cx="20" cy="20" r="13.6" fill="var(--chip-body)" />
      <circle cx="20" cy="20" r="13.6" fill="#fff" fillOpacity="0.16" />
      {/* Headstamp: os caracteres estampados viram pontos nesse tamanho. */}
      {HEADSTAMP.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={1.1} fill="#000" fillOpacity="0.32" />
      ))}
      {/* Espoleta. */}
      <circle cx="20" cy="20" r="6.6" fill="#000" fillOpacity="0.35" />
      <circle cx="20" cy="20" r="5.8" fill="var(--chip-edge)" />
      <circle cx="20" cy="20" r="5.8" fill="none" stroke="#000" strokeOpacity="0.3" />
      <circle cx="18.2" cy="18.2" r="2" fill="#fff" fillOpacity="0.5" />
      {/* Brilho de latão. */}
      <path
        d="M7 20a13 13 0 0 1 7.5-11.8"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.4"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Ampola
// ---------------------------------------------------------------------------

/** Silhueta do vidro: ponta, gargalo estrangulado, ombro e corpo. */
const VIDRO =
  'M10.6 2h2.8l1.4 5.4v3.2l1 1.6-1 1.6v3.6l4.6 5.6v35.4a3 3 0 0 1-3 3H8.6a3 3 0 0 1-3-3V23l4.6-5.6v-3.6l-1-1.6 1-1.6V7.4L10.6 2z';

function Ampola() {
  return (
    <svg {...svgProps} viewBox="0 0 24 62" preserveAspectRatio="xMidYMid meet">
      {/* O líquido, desenhado antes do vidro para ficar visivelmente por dentro. */}
      <rect x="6.4" y="26" width="11.2" height="32" rx="3" fill="var(--chip-body)" />
      <rect x="6.4" y="26" width="11.2" height="4" fill="#000" fillOpacity="0.18" />
      {/* Rótulo impresso. */}
      <rect x="5.4" y="37" width="13.2" height="10" rx="1" fill="var(--chip-edge)" />
      <rect x="7" y="39.4" width="10" height="1.2" fill="#000" fillOpacity="0.4" />
      <rect x="7" y="42" width="7" height="1.2" fill="#000" fillOpacity="0.28" />
      <rect x="7" y="44.6" width="9" height="1.2" fill="#000" fillOpacity="0.28" />
      {/* O vidro por cima de tudo. */}
      <path d={VIDRO} fill="#fff" fillOpacity="0.14" stroke="#fff" strokeOpacity="0.5" />
      {/* Anel de corte do gargalo — é por ele que a ampola se quebra. */}
      <rect x="8.4" y="12.4" width="7.2" height="2.4" rx="0.6" fill="var(--chip-edge)" />
      {/* Reflexo alongado, do mesmo canto que o das cartas. */}
      <rect x="7.8" y="25" width="2.2" height="28" rx="1.1" fill="#fff" fillOpacity="0.42" />
      <rect x="14.6" y="27" width="1.2" height="22" rx="0.6" fill="#fff" fillOpacity="0.2" />
    </svg>
  );
}
