import type { PlayerView } from '../../engine/selectors';
import { CardView, suitGlyph } from '../CardView';

/**
 * O centro da mesa: o monte e o vira que define a manilha da mão.
 *
 * Quando `handSize × jogadores === 40` o baralho acaba na distribuição e não
 * sobra carta para virar. Aí o centro anuncia a mão sem manilha — é a
 * informação mais importante da rodada e não pode ficar escondida.
 */
export function DeckAndVira({ view }: { view: PlayerView }) {
  if (view.vira === null) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-gold-400/35 bg-black/35 px-4 py-2.5 text-center shadow-lg backdrop-blur-[1px]">
        <span className="text-[10px] font-bold tracking-[0.18em] text-gold-300 uppercase">
          Sem manilha
        </span>
        <span className="text-xs text-white/60">baralho inteiro distribuído</span>
        <span className="text-sm font-semibold text-white/90">
          3<span className="text-white">{suitGlyph('paus')}</span> é a mais forte
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Monte: alguns versos com deslocamento, para dar espessura. */}
      <div className="relative h-16 w-11" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="card-back absolute h-16 w-11 rounded-md"
            style={{ left: i * 1.5, top: -i * 1.5 }}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-bold tracking-[0.18em] text-gold-300/80 uppercase">
          Vira
        </span>
        <CardView
          key={view.vira}
          card={view.vira}
          size="sm"
          motion={{ kind: 'deal', dirX: 0, dirY: 0, flip: true, index: 0 }}
        />
        {/* A ordem de força entre as manilhas é a mesma dos naipes, que já está
            na legenda do cabeçalho — aqui basta dizer qual é o valor. */}
        <span className="rounded bg-black/45 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white/75">
          manilha <span className="font-bold text-gold-300">{view.manilhaRank}</span>
        </span>
      </div>
    </div>
  );
}
