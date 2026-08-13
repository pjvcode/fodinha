import type { PlayerView } from '../engine/selectors';

export interface BidPanelProps {
  view: PlayerView;
  onBid: (value: number) => void;
}

/**
 * Painel de palpite. O valor proibido pela regra da soma aparece desabilitado
 * e explicado — a regra é o coração do jogo, esconder ela seria pior.
 */
export function BidPanel({ view, onBid }: BidPanelProps) {
  const legal = new Set(view.legalBids);
  const proibido = view.forbiddenBid;
  const total = view.opponents.reduce((sum, o) => sum + (o.bid ?? 0), 0);
  const faltam = view.opponents.filter((o) => !o.eliminated && o.bid === null).length;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-center text-sm text-white/80">
        Quantas vazas você faz com {view.handSize} carta{view.handSize > 1 ? 's' : ''}?
      </p>

      {/* Numa mão de 20 cartas são 21 botões: sem teto de altura eles empurram
          a mesa para fora da tela do celular. */}
      <div className="flex max-h-36 flex-wrap justify-center gap-1.5 overflow-y-auto sm:max-h-none sm:gap-2">
        {Array.from({ length: view.handSize + 1 }, (_, value) => {
          const permitido = legal.has(value);
          return (
            <button
              key={value}
              type="button"
              disabled={!permitido}
              onClick={() => onBid(value)}
              title={permitido ? undefined : 'A soma dos palpites não pode fechar em ' + view.handSize}
              className={[
                'bid-botao h-10 w-10 rounded-lg border text-base font-bold transition-colors sm:h-11 sm:w-11 sm:text-lg',
                permitido
                  ? 'cursor-pointer border-amber-300/60 bg-amber-300/15 text-amber-100 hover:bg-amber-300/30'
                  : 'cursor-not-allowed border-white/10 bg-black/30 text-white/20 line-through',
              ].join(' ')}
            >
              {value}
            </button>
          );
        })}
      </div>

      <p className="so-com-folga max-w-md text-center text-xs text-white/50">
        Já palpitaram {total} vaza{total === 1 ? '' : 's'}
        {faltam > 0 && ` · faltam ${faltam} jogador${faltam === 1 ? '' : 'es'}`}
        {proibido !== null && (
          <>
            {' '}
            · você é o último, então <span className="text-white/80">{proibido}</span> está
            proibido (a soma não pode dar {view.handSize})
          </>
        )}
      </p>
    </div>
  );
}
