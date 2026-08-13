import { useState } from 'react';

import {
  BOTS_POR_MESA,
  LIGAS,
  carregarResultados,
  ligaPorId,
} from '../state/leagues';
import type { ResultadoLiga } from '../state/leagues';
import { BotaoPrimario } from './Overlay';

/**
 * As ligas e seus históricos. Escolhida uma liga, mostra as partidas já jogadas
 * (mais recente no topo) e o botão de começar mais uma. O formato é fixo: mesa de
 * 5, ida e volta, bots difíceis, ritmo Cinema — nada para configurar aqui.
 */
export function LeagueScreen({
  onJogar,
  onVoltar,
}: {
  onJogar: (ligaId: string) => void;
  onVoltar: () => void;
}) {
  const [ligaId, setLigaId] = useState<string>(LIGAS[0]!.id);
  // Recarregado a cada montagem — ao voltar de uma partida, a tela remonta e o
  // resultado recém-gravado aparece.
  const resultados = carregarResultados(ligaId);
  const liga = ligaPorId(ligaId);

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-5 p-4 sm:p-6">
      <header>
        <button
          type="button"
          onClick={onVoltar}
          className="mb-1 cursor-pointer text-xs text-white/50 transition-colors hover:text-white/80"
        >
          ← Voltar
        </button>
        <h1 className="text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">Ligas</h1>
        <p className="mt-1 text-sm text-white/60">
          Mesa de 5 (você + {BOTS_POR_MESA} bots difíceis), ida e volta completa, ritmo Cinema.
        </p>
      </header>

      <div className="flex gap-2">
        {LIGAS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLigaId(l.id)}
            className={[
              'min-h-11 flex-1 cursor-pointer rounded-xl border px-4 py-2 font-bold transition-colors',
              l.id === ligaId
                ? 'border-amber-300/50 bg-amber-300/15 text-amber-200'
                : 'border-white/12 bg-black/25 text-white/75 hover:bg-white/5',
            ].join(' ')}
          >
            {l.nome}
          </button>
        ))}
      </div>

      <BotaoPrimario onClick={() => onJogar(ligaId)} className="w-full">
        Jogar partida na {liga?.nome}
      </BotaoPrimario>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/70">
          Histórico {liga ? `da ${liga.nome}` : ''}
        </h2>
        {resultados.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/45">
            Nenhuma partida ainda. Jogue a primeira!
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {resultados.map((r) => (
              <ResultadoCard key={r.id} resultado={r} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ResultadoCard({ resultado }: { resultado: ResultadoLiga }) {
  const quando = new Date(resultado.data).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const venceu = resultado.vencedores.length > 0;

  return (
    <li className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-amber-200">
          {venceu
            ? `${resultado.vencedores.join(', ')} venceu`
            : 'Sem vencedor'}
        </span>
        <span className="text-[11px] text-white/40">{quando}</span>
      </div>
      <table className="mt-2 w-full text-xs">
        <tbody>
          {resultado.placar.map((linha, i) => (
            <tr key={`${linha.nome}-${i}`} className="border-b border-white/5 last:border-0">
              <td className="py-1 text-white/45">{i + 1}º</td>
              <td className="max-w-32 truncate py-1 text-white/85">{linha.nome}</td>
              <td className="py-1 text-right text-white/70">{linha.penalidade} pt</td>
            </tr>
          ))}
        </tbody>
      </table>
    </li>
  );
}
