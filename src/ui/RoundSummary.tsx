import type { PlayerView } from '../engine/selectors';
import { BotaoPrimario, Overlay } from './Overlay';

interface Row {
  id: string;
  name: string;
  penalty: number;
  lives: number;
  eliminated: boolean;
}

function everyone(view: PlayerView): Row[] {
  return [
    {
      id: view.me.id,
      name: view.me.name,
      penalty: view.me.penalty,
      lives: view.me.lives,
      eliminated: view.me.eliminated,
    },
    ...view.opponents.map((o) => ({
      id: o.id,
      name: o.name,
      penalty: o.penalty,
      lives: o.lives,
      eliminated: o.eliminated,
    })),
  ];
}

/** Resumo da mão que acabou, com o erro de cada um. */
export function RoundSummary({ view, onContinue }: { view: PlayerView; onContinue: () => void }) {
  const hand = view.history[view.history.length - 1];
  if (!hand) return null;

  const nome = (id: string) => everyone(view).find((p) => p.id === id)?.name ?? id;
  const ultima = view.handIndex >= view.totalHands - 1;
  const elimination = view.config.scoringMode === 'elimination';

  return (
    <Overlay label="Resumo da mão">
      <h2 className="text-lg font-bold sm:text-xl">
        Mão {hand.handIndex + 1} de {view.totalHands} · {hand.handSize} carta
        {hand.handSize > 1 ? 's' : ''}
      </h2>
      <p className="mt-1 text-sm text-white/55">
        {hand.vira === null
          ? 'Jogada sem manilha — baralho inteiro distribuído'
          : `Manilha: ${hand.manilhaRank}`}
      </p>

      <table className="mt-4 w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/50">
            <th className="py-1.5 text-left font-medium">Jogador</th>
            <th className="px-1 py-1.5 text-center font-medium">Palpite</th>
            <th className="px-1 py-1.5 text-center font-medium">Vazas</th>
            <th className="px-1 py-1.5 text-center font-medium">Erro</th>
            <th className="py-1.5 text-right font-medium">{elimination ? 'Vidas' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          {hand.rows.map((row) => (
            <tr key={row.playerId} className="border-b border-white/5 last:border-0">
              <td className="max-w-24 truncate py-1.5">{nome(row.playerId)}</td>
              <td className="px-1 py-1.5 text-center">{row.bid}</td>
              <td className="px-1 py-1.5 text-center">{row.tricksWon}</td>
              <td
                className={[
                  'px-1 py-1.5 text-center font-semibold whitespace-nowrap',
                  row.penalty === 0 ? 'text-emerald-400' : 'text-rose-300',
                ].join(' ')}
              >
                {row.penalty === 0 ? 'na mosca' : `+${row.penalty}`}
              </td>
              <td className="py-1.5 text-right whitespace-nowrap">
                {elimination ? `${row.lives} ♥` : row.totalPenalty}
                {row.eliminated && <span className="ml-1 text-[10px] text-rose-400">saiu</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <BotaoPrimario onClick={onContinue} className="mt-5 w-full">
        {ultima ? 'Ver resultado final' : 'Próxima mão'}
      </BotaoPrimario>
    </Overlay>
  );
}

/**
 * Estado do registro do resultado na liga.
 *
 * Existe porque uma partida de liga que termina sem ser registrada, e sem
 * ninguém avisar, é a maneira mais rápida de o jogador deixar de confiar na
 * classificação.
 */
export type RegistroLiga =
  | { estado: 'inativo' }
  | { estado: 'enviando' }
  | { estado: 'registrado' }
  | { estado: 'falhou'; erro: string };

/** Tela final: quem venceu e o placar fechado. */
export function MatchOver({
  view,
  registro = { estado: 'inativo' },
  onRestart,
}: {
  view: PlayerView;
  registro?: RegistroLiga;
  onRestart: () => void;
}) {
  const elimination = view.config.scoringMode === 'elimination';
  const rows = everyone(view).sort((a, b) =>
    elimination
      ? Number(a.eliminated) - Number(b.eliminated) || b.lives - a.lives || a.penalty - b.penalty
      : a.penalty - b.penalty,
  );
  const vencedores = view.winnerIds;
  const euGanhei = vencedores.includes(view.me.id);

  return (
    <Overlay label="Fim de partida">
      <h2 className="text-xl font-bold text-amber-300 sm:text-2xl">
        {euGanhei ? 'Você venceu!' : 'Fim de partida'}
      </h2>
      <p className="mt-1 text-sm text-white/70">
        {vencedores.length > 1 ? 'Vitória dividida entre ' : 'Vencedor: '}
        {vencedores.map((id) => rows.find((r) => r.id === id)?.name).join(', ')}
        {!elimination && ' — menor penalidade'}
      </p>

      <ol className="mt-4 space-y-1.5">
        {rows.map((row, i) => (
          <li
            key={row.id}
            className={[
              'flex items-center justify-between rounded-lg px-3 py-2',
              vencedores.includes(row.id) ? 'bg-amber-300/15 font-semibold' : 'bg-black/20',
            ].join(' ')}
          >
            <span className="min-w-0 truncate">
              <span className="mr-2 text-white/40">{i + 1}º</span>
              {row.name}
            </span>
            <span className="shrink-0 text-white/80">
              {elimination ? `${row.lives} ♥` : `${row.penalty} pt`}
            </span>
          </li>
        ))}
      </ol>

      {registro.estado !== 'inativo' && (
        <p
          className={[
            'mt-3 rounded-lg px-3 py-2 text-xs',
            registro.estado === 'falhou'
              ? 'bg-red-500/15 text-red-200'
              : 'bg-black/25 text-white/55',
          ].join(' ')}
        >
          {registro.estado === 'enviando' && 'Registrando na liga…'}
          {registro.estado === 'registrado' && 'Resultado registrado na liga.'}
          {registro.estado === 'falhou' && `Não foi para a liga: ${registro.erro}`}
        </p>
      )}

      <BotaoPrimario onClick={onRestart} className="mt-5 w-full">
        Nova partida
      </BotaoPrimario>
    </Overlay>
  );
}
