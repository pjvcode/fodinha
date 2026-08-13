import { useEffect, useState } from 'react';

import { isManilha, rulesFrom, sortByStrength } from '../engine/ranking';
import type { PlayerView } from '../engine/selectors';
import type { CardId } from '../engine/types';
import { CARD_WIDTH, CardView } from './CardView';
import type { CardSize } from './CardView';
import { useTela } from './useTela';
import type { Tela } from './useTela';

export interface HandFanProps {
  view: PlayerView;
  playable: boolean;
  onPlay: (card: CardId) => void;
}

export interface FanGeometry {
  spread: number;
  arc: number;
  overlap: number;
  size: CardSize;
}

/** Um degrau abaixo na escala de tamanhos. `sm` é o piso: menor não se lê. */
const MENOR: Record<CardSize, CardSize> = { lg: 'md', md: 'sm', sm: 'sm', xs: 'xs' };

/**
 * Abertura do leque e sobreposição, conforme o tamanho da mão e a tela.
 *
 * **Largura.** A conta que importa é `n × (largura − sobreposição) +
 * sobreposição`. Dez cartas grandes com sobreposição 34 dão uns 460px — mais do
 * que um celular inteiro tem. Numa tela estreita a carta cai um degrau e a
 * sobreposição sobe, e as mesmas dez cartas passam a ocupar ~300px.
 *
 * **Altura.** Independente disso: numa tela baixa — celular deitado — a carta
 * desce mais um degrau mesmo com a mão pequena, porque ali quem não cabe é a
 * mesa mais o leque mais os botões de palpite, empilhados. A sobreposição desce
 * na mesma proporção, então o leque encolhe inteiro em vez de virar um baralho
 * de cartas pequenas espalhadas.
 */
export function fanGeometry(count: number, tela: Tela): FanGeometry {
  // Tela baixa entra no mesmo balde da estreita porque no paisagem a mão divide
  // a largura com a mesa, lado a lado — sobra para ela metade da janela, não a
  // janela inteira.
  const base = tela.estreita || tela.baixa ? estreita(count) : larga(count);
  if (!tela.baixa) return base;

  const size = MENOR[base.size];
  const razao = CARD_WIDTH[size] / CARD_WIDTH[base.size];
  return {
    ...base,
    size,
    overlap: Math.round(base.overlap * razao),
    arc: Math.round(base.arc * razao),
  };
}

function larga(count: number): FanGeometry {
  if (count <= 3) return { spread: 10, arc: 4, overlap: 4, size: 'lg' };
  if (count <= 6) return { spread: 22, arc: 12, overlap: 20, size: 'lg' };
  if (count <= 10) return { spread: 34, arc: 20, overlap: 34, size: 'lg' };
  return { spread: 42, arc: 26, overlap: 46, size: 'lg' };
}

function estreita(count: number): FanGeometry {
  // Até três cartas há espaço de sobra até no celular em pé: sobrepor seria só
  // dificultar a leitura de graça.
  if (count <= 3) return { spread: 10, arc: 4, overlap: 4, size: 'lg' };
  if (count <= 6) return { spread: 20, arc: 10, overlap: 22, size: 'md' };
  if (count <= 10) return { spread: 30, arc: 16, overlap: 38, size: 'md' };
  return { spread: 38, arc: 20, overlap: 34, size: 'sm' };
}

/**
 * A mão do jogador, aberta em leque como se estivesse na mão mesmo: ordenada da
 * mais fraca para a mais forte, carta do meio mais alta, cartas sobrepostas.
 *
 * Jogar é em dois tempos: o primeiro clique pré-seleciona a carta, que sobe e
 * ganha contorno dourado, e o segundo confirma. Evita jogar a carta errada num
 * leque sobreposto, onde as cartas ficam a poucos pixels umas das outras.
 *
 * A mão nunca é escurecida — o jogador precisa enxergá-la justamente enquanto
 * decide o palpite.
 */
export function HandFan({ view, playable, onPlay }: HandFanProps) {
  const [selecionada, setSelecionada] = useState<CardId | null>(null);
  const tela = useTela();
  const mao = view.me.hand;

  // A seleção não sobrevive a perder a vez, nem a uma carta sair da mão.
  useEffect(() => {
    if (!playable) setSelecionada(null);
  }, [playable]);

  useEffect(() => {
    if (selecionada !== null && !mao.includes(selecionada)) setSelecionada(null);
  }, [mao, selecionada]);

  // Esc desfaz a pré-seleção.
  useEffect(() => {
    if (selecionada === null) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelecionada(null);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [selecionada]);

  const ordered = sortByStrength(mao, view.manilhaRank, rulesFrom(view.config));
  const n = ordered.length;
  const { spread, arc, overlap, size } = fanGeometry(n, tela);

  function clicar(card: CardId) {
    if (selecionada === card) {
      setSelecionada(null);
      onPlay(card);
    } else {
      setSelecionada(card);
    }
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex max-w-full justify-center pt-3" style={{ paddingBottom: arc }}>
        {ordered.map((card, i) => {
          const t = n === 1 ? 0 : i / (n - 1) - 0.5;
          const rot = t * spread;
          const dy = Math.pow(t * 2, 2) * arc;

          return (
            <div
              key={card}
              className="fan-card"
              style={{
                transform: `rotate(${rot.toFixed(2)}deg) translateY(${dy.toFixed(1)}px)`,
                transformOrigin: 'bottom center',
                marginInline: -overlap / 2,
                zIndex: i,
              }}
            >
              <CardView
                card={card}
                size={size}
                isManilha={isManilha(card, view.manilhaRank)}
                playable={playable}
                selected={playable && selecionada === card}
                // As cartas vêm do monte, que fica acima da mão, e viram no caminho.
                motion={{ kind: 'deal', dirX: 0, dirY: 1, index: i, flip: true }}
                onClick={() => clicar(card)}
              />
            </div>
          );
        })}
      </div>

      {playable && (
        <p className="so-com-folga h-4 text-xs text-white/45">
          {selecionada === null
            ? 'Escolha uma carta'
            : 'Clique de novo para jogar · Esc cancela'}
        </p>
      )}
    </div>
  );
}
