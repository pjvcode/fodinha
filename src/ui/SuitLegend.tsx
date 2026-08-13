import type { PlayerView } from '../engine/selectors';
import { suitGlyph } from './CardView';

/**
 * Legenda permanente da ordem dos naipes. No Fodinha o naipe desempata todas as
 * cartas de mesmo valor, então essa informação não pode viver só na cabeça do
 * jogador.
 */
export function SuitLegend({ view }: { view: PlayerView }) {
  const forteParaFraco = [...view.config.suitOrder].reverse();

  return (
    <div className="flex items-center gap-1 text-xs text-white/55">
      <span className="hidden text-white/35 sm:inline">naipes:</span>
      {forteParaFraco.map((suit, i) => (
        <span key={suit} className="flex items-center gap-1">
          <span
            className={suit === 'ouros' || suit === 'copas' ? 'text-rose-400' : 'text-white/85'}
            title={suit}
          >
            {suitGlyph(suit)}
          </span>
          {i < forteParaFraco.length - 1 && <span className="text-white/20">&gt;</span>}
        </span>
      ))}
    </div>
  );
}
