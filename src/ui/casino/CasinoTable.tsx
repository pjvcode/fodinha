import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type { PlayerView } from '../../engine/selectors';
import type { Balao } from '../../theater/useReactions';
import { PlayerSeat } from '../PlayerSeat';
import { BetChips } from './BetChips';
import { vazaAbsoluta } from './chips';
import { corMarcador } from './markers';
import type { MarcadorId } from './markers';
import { DeckAndVira } from './DeckAndVira';
import { SpeechBubble } from './SpeechBubble';
import { TrickRosette } from './TrickRosette';
import { TrickViewer } from './TrickViewer';
import { seatMap, seatScale } from './seating';
import type { Seat } from './seating';

function slot(seat: Seat, x: number, y: number): CSSProperties {
  return {
    left: `${x}%`,
    top: `${y}%`,
    '--dir-x': seat.dirX.toFixed(4),
    '--dir-y': seat.dirY.toFixed(4),
  } as CSSProperties;
}

export interface CasinoTableProps {
  view: PlayerView;
  baloes?: Balao[];
  /** Com o que o jogador local marca as apostas. Os bots seguem com fichas. */
  marcador: MarcadorId;
}

/**
 * A mesa: trilho de mogno, feltro verde, filete dourado e todo mundo sentado em
 * elipse. Tudo é posicionado em porcentagem, então a mesa inteira escala com o
 * contêiner sem recalcular nada.
 */
export function CasinoTable({ view, baloes = [], marcador }: CasinoTableProps) {
  const opponentIds = view.opponents.map((o) => o.id);
  const seats = useMemo(
    () => seatMap(view.me.id, opponentIds),
    // A geometria só muda quando muda quem está na mesa.
    [view.me.id, opponentIds.join(',')],
  );

  const escala = seatScale(view.opponents.length + 1);
  const meuAssento = seats.get(view.me.id)!;
  const [vazaAberta, setVazaAberta] = useState<number | null>(null);

  /** Traduz "a n-ésima vaza ganha por fulano" para o índice dela na mão. */
  function abrirVaza(playerId: string, ordem: number): void {
    const vencedores = view.completedTricks.map((t) => t.winnerId);
    const indice = vazaAbsoluta(vencedores, playerId, ordem);
    if (indice >= 0) setVazaAberta(indice);
  }

  // Toda ficha de aposta é verde — jogador e bots. O estado (pendente, cumprida,
  // excedente) pinta por cima: verde na base, dourado ao cumprir a vaza
  // planejada, vermelho na vaza a mais. A cor do perfil não pinta mais o feltro;
  // o jogador ainda se distingue pela forma do marcador que escolheu.
  const verde = corMarcador('verde');
  const cor = { body: verde.body, edge: verde.edge };
  const apostas = [
    {
      id: view.me.id,
      nome: view.me.name,
      bid: view.me.bid,
      vazas: view.me.tricksWon,
      fora: view.me.eliminated,
      tipo: marcador,
      cor,
    },
    ...view.opponents.map((o) => ({
      id: o.id,
      nome: o.name,
      bid: o.bid,
      vazas: o.tricksWon,
      fora: o.eliminated,
      tipo: 'ficha' as MarcadorId,
      cor,
    })),
  ];

  return (
    // `overflow-x: clip` apara um estouro que é só de layout: a plaqueta de
    // assento é encolhida por `scale`, que muda o desenho mas não a caixa, e a
    // caixa dos assentos das pontas passa da borda da mesa e faz a página
    // inteira rolar de lado no celular. `clip` e não `hidden` de propósito —
    // `hidden` num eixo transformaria o outro em área de rolagem, e os balões
    // de fala, que sobem acima da mesa, seriam cortados.
    <div className="grid place-items-center overflow-x-clip [overflow-clip-margin:8px]">
      {/* A mesa cresce até ocupar a largura disponível, mas nunca a ponto de o
          cabeçalho e a mão saírem da tela — daí o teto derivado da altura. O
          `min()` com 100% é o que segura o caso do celular deitado, em que a
          conta pela altura daria mais largura do que existe na tela. */}
      <div
        className="table-shell relative aspect-[16/10] w-full"
        style={{ maxWidth: 'min(100%, calc((100dvh - var(--mesa-chrome)) * 1.6))' }}
      >
        <div className="table-rail absolute inset-0" />
        <div className="table-felt absolute inset-[3.5%]" />
        <div className="table-inlay pointer-events-none absolute inset-[8%]" />

        {/* Círculos de aposta, com os marcadores de cada jogador dentro. */}
        {apostas.map((a) => {
          const seat = seats.get(a.id);
          if (!seat || a.fora) return null;
          return (
            <div
              key={a.id}
              className="table-slot escala-mesa bet-circle z-10 grid min-h-7 min-w-14 place-items-center px-2 py-1"
              style={slot(seat, seat.betX, seat.betY)}
            >
              {/* Trocar de mão remonta os marcadores, então a animação de
                  lançar roda de novo; dentro da mão eles mantêm identidade para
                  que acender em ouro seja uma transição, não um remonte. */}
              <BetChips
                key={view.handIndex}
                bid={a.bid}
                tricksWon={a.vazas}
                playerName={a.nome}
                tipo={a.tipo}
                cor={a.cor}
                onVerVaza={(ordem) => abrirVaza(a.id, ordem)}
              />
            </div>
          );
        })}

        {/* Monte e vira, no centro. */}
        <div className="table-slot escala-mesa z-10" style={{ left: '50%', top: '50%' }}>
          <DeckAndVira view={view} />
        </div>

        {/* A vaza em roseta, apontando para quem jogou cada carta. */}
        <TrickRosette view={view} seats={seats} />

        {/* Adversários na borda. */}
        {view.opponents.map((o) => {
          const seat = seats.get(o.id)!;
          return (
            <div key={o.id} className="table-slot z-20" style={slot(seat, seat.x, seat.y)}>
              <PlayerSeat player={o} view={view} scale={escala} />
            </div>
          );
        })}

        {/* Plaqueta do jogador local, na base da mesa. */}
        <div
          className="table-slot escala-mesa z-20"
          style={slot(meuAssento, meuAssento.x, Math.min(meuAssento.y, 93))}
        >
          <LocalPlaque view={view} />
        </div>

        {/* Balões de fala, por cima de tudo. */}
        {baloes.map((balao) => {
          const seat = seats.get(balao.playerId);
          return seat ? <SpeechBubble key={balao.id} balao={balao} seat={seat} /> : null;
        })}
      </div>

      {vazaAberta !== null && (
        <TrickViewer
          view={view}
          indice={Math.min(vazaAberta, view.completedTricks.length - 1)}
          onIndice={setVazaAberta}
          onFechar={() => setVazaAberta(null)}
        />
      )}
    </div>
  );
}

function LocalPlaque({ view }: { view: PlayerView }) {
  const vez = view.currentTurnId === view.me.id || view.currentBidderId === view.me.id;
  const elimination = view.config.scoringMode === 'elimination';

  return (
    <div
      className={[
        'flex items-center gap-2.5 rounded-full border px-3.5 py-1 text-xs backdrop-blur-[2px] transition-colors',
        vez ? 'turn-glow border-gold-300/80 bg-black/60' : 'border-white/10 bg-black/50',
      ].join(' ')}
    >
      <span className="max-w-28 truncate font-semibold">{view.me.name}</span>
      {view.dealerId === view.me.id && (
        <span
          className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold-300 text-[9px] font-black text-felt-900"
          title="Você distribui esta mão"
        >
          D
        </span>
      )}
      <span className="whitespace-nowrap text-white/55">
        <span className="font-bold text-gold-300">{view.me.tricksWon}</span>
        <span className="text-white/30"> / </span>
        {view.me.bid ?? '—'}
      </span>
      <span className="whitespace-nowrap text-white/40">
        {elimination ? `${view.me.lives} ♥` : `${view.me.penalty} pt`}
      </span>
    </div>
  );
}
