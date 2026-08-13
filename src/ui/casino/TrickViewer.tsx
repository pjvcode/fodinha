import { useEffect } from 'react';

import { isManilha } from '../../engine/ranking';
import type { PlayerView } from '../../engine/selectors';
import { CardView } from '../CardView';
import { useTela } from '../useTela';

export interface TrickViewerProps {
  view: PlayerView;
  /** Índice da vaza dentro da mão corrente. */
  indice: number;
  onIndice: (i: number) => void;
  onFechar: () => void;
}

/**
 * Revisão de uma vaza já jogada.
 *
 * Com a mesa correndo rápido, a vaza some antes de dar tempo de ler. Aqui ela
 * volta parada, com quem jogou o quê e quem levou — e dá para andar por todas
 * as vazas da mão.
 */
export function TrickViewer({ view, indice, onIndice, onFechar }: TrickViewerProps) {
  const vazas = view.completedTricks;
  const vaza = vazas[indice];
  const { estreita, baixa } = useTela();
  const compact = estreita || baixa;

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowLeft' && indice > 0) onIndice(indice - 1);
      if (e.key === 'ArrowRight' && indice < vazas.length - 1) onIndice(indice + 1);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [indice, vazas.length, onIndice, onFechar]);

  if (!vaza) return null;

  const nome = (id: string) =>
    id === view.me.id ? view.me.name : (view.opponents.find((o) => o.id === id)?.name ?? id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Vaza ${indice + 1} de ${vazas.length}`}
    >
      <div
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-gold-400/25 bg-felt-800 p-4 shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-bold">
            Vaza {indice + 1} <span className="text-white/40">de {vazas.length}</span>
          </h2>
          <span className="text-xs text-white/50">
            mão de {view.handSize} carta{view.handSize > 1 ? 's' : ''} ·{' '}
            {view.manilhaRank === null ? 'sem manilha' : `manilha ${view.manilhaRank}`}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-center gap-3 sm:gap-4">
          {vaza.plays.map((play, ordem) => {
            const venceu = vaza.winnerId === play.playerId;
            return (
              <div key={play.playerId} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] tracking-wide text-white/35 uppercase">
                  {ordem === 0 ? 'puxou' : `${ordem + 1}º`}
                </span>
                <CardView
                  card={play.card}
                  size={compact ? 'sm' : 'md'}
                  isManilha={isManilha(play.card, view.manilhaRank)}
                  dimmed={vaza.winnerId !== null && !venceu}
                  className={venceu ? 'ring-2 ring-gold-300 rounded-md' : ''}
                />
                <span
                  className={`max-w-16 truncate text-xs sm:max-w-20 ${venceu ? 'font-bold text-gold-300' : 'text-white/55'}`}
                >
                  {nome(play.playerId)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-sm">
          {vaza.winnerId === null ? (
            <span className="font-semibold text-sky-300">Vaza melada — as cartas se anularam</span>
          ) : (
            <span className="text-white/70">
              <span className="font-bold text-gold-300">{nome(vaza.winnerId)}</span> levou
            </span>
          )}
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={indice === 0}
            onClick={() => onIndice(indice - 1)}
            aria-label="Vaza anterior"
            className="min-h-11 cursor-pointer rounded-lg border border-white/20 px-3 text-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← anterior
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="min-h-11 cursor-pointer rounded-lg bg-gold-300 px-5 text-sm font-bold text-felt-900 transition-colors hover:bg-gold-200"
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={indice >= vazas.length - 1}
            onClick={() => onIndice(indice + 1)}
            aria-label="Próxima vaza"
            className="min-h-11 cursor-pointer rounded-lg border border-white/20 px-3 text-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
