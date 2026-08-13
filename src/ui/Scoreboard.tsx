import type { PlayerView } from '../engine/selectors';

function allPlayers(view: PlayerView) {
  return [
    { id: view.me.id, name: view.me.name, seat: view.me.seat },
    ...view.opponents.map((o) => ({ id: o.id, name: o.name, seat: o.seat })),
  ].sort((a, b) => a.seat - b.seat);
}

function totalFor(view: PlayerView, playerId: string): number {
  const me = view.me.id === playerId ? view.me : view.opponents.find((o) => o.id === playerId);
  return me?.penalty ?? 0;
}

/** Grade mãos × jogadores, com palpite/vazas e a penalidade acumulada. */
export function Scoreboard({ view }: { view: PlayerView }) {
  const players = allPlayers(view);
  const elimination = view.config.scoringMode === 'elimination';

  return (
    // A sangria negativa deixa a tabela rolar até a borda da tela no celular,
    // em vez de morrer no padding da coluna.
    <div className="placar-grade -mx-2 overflow-x-auto overscroll-x-contain rounded-xl border border-white/10 bg-black/25 sm:mx-0">
      <table className="w-full min-w-max text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/55">
            <th className="px-3 py-2 text-left font-medium">Mão</th>
            {players.map((p) => (
              <th key={p.id} className="px-3 py-2 text-center font-medium whitespace-nowrap">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.history.map((hand) => (
            <tr key={hand.handIndex} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-1.5 whitespace-nowrap text-white/55">
                {hand.handSize} carta{hand.handSize > 1 ? 's' : ''}
                {hand.vira === null && (
                  <span className="ml-1 text-[10px] text-sky-300" title="Mão sem manilha">
                    s/m
                  </span>
                )}
              </td>
              {players.map((p) => {
                const row = hand.rows.find((r) => r.playerId === p.id);
                if (!row) {
                  return (
                    <td key={p.id} className="px-3 py-1.5 text-center text-white/20">
                      —
                    </td>
                  );
                }
                return (
                  <td key={p.id} className="px-3 py-1.5 text-center whitespace-nowrap">
                    <span className="text-white/45">
                      {row.bid}/{row.tricksWon}
                    </span>{' '}
                    <span
                      className={row.penalty === 0 ? 'font-bold text-emerald-400' : 'text-rose-300'}
                    >
                      {row.penalty === 0 ? '✓' : `+${row.penalty}`}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}

          {view.history.length === 0 && (
            <tr>
              <td colSpan={players.length + 1} className="px-3 py-4 text-center text-white/35">
                Nenhuma mão terminada ainda.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/15 bg-black/25 font-semibold">
            <td className="px-3 py-2 text-white/70">{elimination ? 'Vidas' : 'Total'}</td>
            {players.map((p) => {
              const alvo =
                view.me.id === p.id ? view.me : view.opponents.find((o) => o.id === p.id)!;
              return (
                <td key={p.id} className="px-3 py-2 text-center">
                  {elimination ? (
                    <span className={alvo.eliminated ? 'text-white/30 line-through' : ''}>
                      {alvo.lives} ♥
                    </span>
                  ) : (
                    totalFor(view, p.id)
                  )}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
