import { chipSize, chipsFor, chipsPerRow, totalChips, vazaDaFicha } from './chips';
import { Marker } from './Marker';
import type { EstadoMarcador } from './Marker';
import { marcadorSpec, markerBox } from './markers';
import type { MarcadorId } from './markers';

export interface BetChipsProps {
  bid: number | null;
  tricksWon: number;
  playerName: string;
  /** Com o que este jogador marca as apostas dele. */
  tipo: MarcadorId;
  cor: { body: string; edge: string };
  /**
   * Abre a revisão da vaza. Recebe a ordem da vaza entre as ganhas por este
   * jogador — quem traduz para o índice na mão é quem monta a mesa.
   */
  onVerVaza?: (ordem: number) => void;
}

/**
 * A aposta de um jogador materializada no feltro: um marcador por vaza
 * apostada, lado a lado, sem empilhar. Aceso em ouro = vaza já feita.
 *
 * Cada marcador de vaza ganha é clicável e reabre aquela vaza — é como rever o
 * que passou quando a mesa está correndo rápido demais.
 */
export function BetChips({ bid, tricksWon, playerName, tipo, cor, onVerVaza }: BetChipsProps) {
  // Antes de palpitar não há marcador: o círculo tracejado vazio já diz que ali
  // é o lugar da aposta.
  if (bid === null && tricksWon === 0) return null;

  // Apostar zero é uma declaração, não uma ausência — e é o palpite mais comum
  // do jogo. Sem uma ficha própria ele sumiria da mesa.
  //
  // Esta é a ficha de pôquer em qualquer marcador escolhido, de propósito: o
  // zero é o único que carrega um número, e o desenho único é justamente o que
  // faz ele saltar da mesa.
  if (bid === 0 && tricksWon === 0) {
    return (
      <span
        className="chip chip--zero anim-chip grid place-items-center"
        style={{ width: 22, height: 22 }}
        role="img"
        aria-label={`${playerName}: apostou zero`}
        title={`${playerName}: apostou zero — não quer nenhuma vaza`}
      >
        <span className="relative z-10 text-[10px] font-black text-white/80">0</span>
      </span>
    );
  }

  const row = chipsFor(bid, tricksWon);
  const total = totalChips(row);
  const porFileira = chipsPerRow(total);
  const size = chipSize(total);
  const largura = markerBox(size, marcadorSpec(tipo)).w;
  const marcas = vazaDaFicha(row);

  const fichas: EstadoMarcador[] = [
    ...Array.from<EstadoMarcador>({ length: row.cumpridas }).fill('cumprida'),
    ...Array.from<EstadoMarcador>({ length: row.pendentes }).fill('pendente'),
    ...Array.from<EstadoMarcador>({ length: row.excedentes }).fill('excedente'),
  ];

  const descricao =
    `${playerName}: apostou ${bid ?? 0}, fez ${tricksWon}` +
    (row.pendentes > 0 ? `, faltam ${row.pendentes}` : '') +
    (row.excedentes > 0 ? `, passou ${row.excedentes}` : '');

  return (
    <span
      className="flex flex-wrap justify-center gap-1"
      style={{ maxWidth: porFileira * (largura + 4) }}
      aria-label={descricao}
      title={descricao}
    >
      {fichas.map((estado, i) => {
        const vaza = marcas[i] ?? null;
        const clicavel = vaza !== null && onVerVaza !== undefined;

        return (
          <Marker
            key={i}
            tipo={tipo}
            cor={cor}
            estado={estado}
            size={size}
            index={i}
            {...(clicavel
              ? {
                  onClick: () => onVerVaza(vaza),
                  title: `Ver a ${vaza + 1}ª vaza de ${playerName}`,
                  ariaLabel: `Ver a ${vaza + 1}ª vaza ganha por ${playerName}`,
                }
              : {})}
          />
        );
      })}
    </span>
  );
}
