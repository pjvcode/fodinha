import { isManilha } from '../../engine/ranking';
import type { PlayerView } from '../../engine/selectors';
import type { CardId } from '../../engine/types';
import { CardView } from '../CardView';
import type { Seat } from './seating';

/** Inclinação estável por carta: parece jogada na mesa, sem tremer a cada render. */
function tiltFor(card: CardId): number {
  let h = 0;
  for (let i = 0; i < card.length; i++) h = (h * 31 + card.charCodeAt(i)) | 0;
  return ((h % 13) - 6) * 1.4;
}

export interface TrickRosetteProps {
  view: PlayerView;
  seats: Map<string, Seat>;
}

/**
 * As cartas da vaza pousam na direção de quem as jogou, formando uma roseta.
 * Dá para ver quem jogou o quê sem precisar de rótulo embaixo de cada carta.
 */
export function TrickRosette({ view, seats }: TrickRosetteProps) {
  const trick = view.trick ?? view.lastTrick;
  if (!trick || trick.plays.length === 0) return null;

  const resolvida = view.phase === 'trickResolved';
  const winnerId = view.lastTrick?.winnerId ?? null;
  const winnerSeat = winnerId ? seats.get(winnerId) : null;

  return (
    <>
      {trick.plays.map((play) => {
        const seat = seats.get(play.playerId);
        if (!seat) return null;

        const venceu = winnerId === play.playerId;
        const manilha = isManilha(play.card, view.manilhaRank);

        return (
          <div
            key={play.playerId}
            className="table-slot escala-mesa z-10"
            style={{
              left: `${seat.trickX}%`,
              top: `${seat.trickY}%`,
              rotate: `${tiltFor(play.card)}deg`,
            }}
          >
            <CardView
              card={play.card}
              size="md"
              isManilha={manilha}
              shine={manilha}
              dimmed={resolvida && winnerId !== null && !venceu}
              motion={{ kind: 'play', dirX: seat.dirX, dirY: seat.dirY }}
              {...(resolvida && winnerSeat
                ? { leaveTo: { dirX: winnerSeat.dirX, dirY: winnerSeat.dirY } }
                : {})}
              className={venceu ? 'ring-2 ring-gold-300 rounded-lg' : ''}
            />
          </div>
        );
      })}
    </>
  );
}
