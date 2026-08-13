import type { OpponentView, PlayerView } from '../engine/selectors';

export interface PlayerSeatProps {
  player: OpponentView;
  view: PlayerView;
  /** Encolhe o assento em mesas cheias. */
  scale?: number;
}

/**
 * A plaqueta de um adversário na borda da mesa. As fichas de aposta dele não
 * ficam aqui — ficam no feltro, no círculo de aposta à frente do assento.
 *
 * A mão dele aparece só como versos: quantas cartas ele tem é informação
 * pública, quais são elas nunca.
 */
export function PlayerSeat({ player, view, scale = 1 }: PlayerSeatProps) {
  const vez = view.currentTurnId === player.id || view.currentBidderId === player.id;
  const distribui = view.dealerId === player.id;
  const elimination = view.config.scoringMode === 'elimination';

  return (
    <div
      // A escala do assento e a da mesa se multiplicam: a primeira aperta a
      // mesa de 8, a segunda aperta a mesa estreita.
      style={{ scale: `calc(var(--seat-scale, 1) * ${scale})` }}
      className={[
        'flex min-w-28 max-w-32 flex-col items-center gap-1 rounded-xl border px-2.5 py-1.5 backdrop-blur-[2px] transition-colors',
        player.eliminated
          ? 'border-white/5 bg-black/55 opacity-40'
          : vez
            ? 'turn-glow border-gold-300/80 bg-black/55'
            : 'border-white/10 bg-black/45',
      ].join(' ')}
    >
      <div className="flex max-w-full items-center gap-1.5">
        <span className="truncate text-xs font-semibold">{player.name}</span>
        {distribui && (
          <span
            className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold-300 text-[9px] font-black text-felt-900"
            title="Distribuidor desta mão"
          >
            D
          </span>
        )}
      </div>

      {player.eliminated ? (
        <span className="text-[10px] tracking-wide text-white/45 uppercase">eliminado</span>
      ) : (
        <>
          <div className="flex h-8 items-center gap-[2px]">
            {Array.from({ length: player.handCount }, (_, i) => (
              <div
                key={i}
                className="card-back anim-deal h-8 w-[1.4rem] rounded-sm"
                style={{ '--i': String(i) } as React.CSSProperties}
              />
            ))}
            {player.handCount === 0 && (
              <span className="text-[10px] text-white/25">sem cartas</span>
            )}
          </div>

          <span className="text-[10px] text-white/55">
            {elimination ? `${player.lives} ♥` : `${player.penalty} pt`}
          </span>
        </>
      )}
    </div>
  );
}
