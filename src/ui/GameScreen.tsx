import { useEffect, useRef, useState } from 'react';

import { useGame } from '../state/useGame';
import type { PlayerView } from '../engine/selectors';
import type { UiSettings } from '../state/settings';
import { useReactions } from '../theater/useReactions';
import type { Transport } from '../transport/types';
import { BidPanel } from './BidPanel';
import { CasinoTable } from './casino/CasinoTable';
import { HandFan } from './HandFan';
import { BotaoNeutro, BotaoPrimario, Overlay } from './Overlay';
import { ProfileScreen } from './ProfileScreen';
import { MatchOver, RoundSummary } from './RoundSummary';
import type { RegistroLiga } from './RoundSummary';
import { Scoreboard } from './Scoreboard';
import { SuitLegend } from './SuitLegend';

export function GameScreen({
  transport,
  settings,
  onSettings,
  apelidoTravado,
  registroLiga,
  onRestart,
  onMatchOver,
}: {
  transport: Transport;
  settings: UiSettings;
  onSettings: (s: UiSettings) => void;
  /** Logado, o apelido da mesa vem da conta e o perfil não o edita. */
  apelidoTravado?: boolean;
  /** Andamento do registro do resultado na liga, mostrado na tela final. */
  registroLiga?: RegistroLiga;
  /** Abandona a partida e volta ao menu. */
  onRestart: () => void;
  /** Disparado uma única vez quando a partida termina. */
  onMatchOver?: (view: PlayerView) => void;
}) {
  const game = useGame(transport);
  const teatro = useReactions(transport, settings.registro);
  const { view } = game;
  const [placarAberto, setPlacarAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);

  // A partida termina uma vez só; a trava evita regravar o resultado a cada
  // re-render enquanto a tela de fim fica aberta.
  const gravou = useRef(false);
  useEffect(() => {
    if (view.phase === 'matchOver' && !gravou.current) {
      gravou.current = true;
      onMatchOver?.(view);
    }
  }, [view, onMatchOver]);

  const elimination = view.config.scoringMode === 'elimination';
  const minhaVez = game.myBidTurn || game.myPlayTurn;

  return (
    <div className="aperta-paisagem mx-auto flex min-h-full max-w-6xl flex-col gap-2 p-2 sm:p-3">
      {/* Cabeçalho -------------------------------------------------------- */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-xl border border-gold-400/15 bg-black/35 px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-baseline gap-2 sm:gap-3">
          <span className="text-base font-black tracking-tight text-gold-300 sm:text-lg">
            Desafio Esquadrilha
          </span>
          <span className="text-xs text-white/55 sm:text-sm">
            mão {view.handIndex + 1}/{view.totalHands} · {view.handSize} carta
            {view.handSize > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
          <SuitLegend view={view} />
          <span className="text-xs whitespace-nowrap text-white/70 sm:text-sm">
            {elimination ? (
              <>
                vidas: <strong className="text-gold-300">{view.me.lives}</strong>
              </>
            ) : (
              <>
                pen.: <strong className="text-gold-300">{view.me.penalty}</strong>
              </>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <BotaoCabecalho onClick={() => setPerfilAberto(true)} title="Perfil e marcadores">
              Perfil
            </BotaoCabecalho>
            <BotaoCabecalho onClick={() => setPlacarAberto((v) => !v)}>
              {placarAberto ? 'Fechar' : 'Placar'}
            </BotaoCabecalho>
            <BotaoCabecalho onClick={() => setSaindo(true)} title="Voltar ao menu principal">
              Menu
            </BotaoCabecalho>
          </div>
        </div>
      </header>

      {placarAberto && <Scoreboard view={view} />}

      {/* A mesa ----------------------------------------------------------- */}
      {/* O invólucro existe para o celular deitado: lá a coluna vira duas, e
          `paisagem-mesa` é o que reserva a metade da esquerda. */}
      <div className="paisagem-mesa">
        <CasinoTable view={view} baloes={teatro.baloes} marcador={settings.marcador} />
      </div>

      {/* Mão e ações do jogador ------------------------------------------- */}
      <section
        className={[
          'paisagem-mao flex flex-col items-center gap-2 rounded-2xl border px-2 pb-2 transition-colors sm:px-4 sm:pb-3',
          minhaVez ? 'border-gold-300/50 bg-gold-400/5' : 'border-white/10 bg-black/25',
        ].join(' ')}
      >
        <HandFan view={view} playable={game.myPlayTurn} onPlay={game.play} />

        {game.myBidTurn && <BidPanel view={view} onBid={game.bid} />}

        {!minhaVez && view.phase !== 'handScored' && view.phase !== 'matchOver' && (
          <p className="text-sm text-white/40">{statusTexto(view.phase)}</p>
        )}
      </section>

      {view.phase === 'handScored' && <RoundSummary view={view} onContinue={game.continueHand} />}
      {view.phase === 'matchOver' && (
        <MatchOver view={view} registro={registroLiga} onRestart={onRestart} />
      )}

      {perfilAberto && (
        <ProfileScreen
          settings={settings}
          onSettings={onSettings}
          apelidoTravado={apelidoTravado}
          onFechar={() => setPerfilAberto(false)}
        />
      )}

      {saindo && <ConfirmarSaida onCancelar={() => setSaindo(false)} onSair={onRestart} />}
    </div>
  );
}

/** Botão pequeno do cabeçalho, no alvo de toque mínimo mesmo parecendo miúdo. */
function BotaoCabecalho({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="min-h-9 cursor-pointer rounded-lg border border-white/20 px-2.5 text-xs whitespace-nowrap transition-colors hover:bg-white/10 sm:min-h-11 sm:px-3 sm:text-sm"
    >
      {children}
    </button>
  );
}

/**
 * Sair pede confirmação porque o clique descarta uma partida inteira, e não há
 * como desfazer: a mesa é recriada do zero com uma semente nova.
 */
function ConfirmarSaida({ onCancelar, onSair }: { onCancelar: () => void; onSair: () => void }) {
  return (
    <Overlay onFechar={onCancelar} label="Sair da partida">
      <h2 className="text-lg font-bold">Voltar ao menu?</h2>
      <p className="mt-1.5 text-sm text-white/65">
        A partida em andamento se perde — o placar, as mãos já jogadas, tudo. Do menu dá para
        começar uma nova com outra configuração.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <BotaoPrimario onClick={onSair} className="sm:flex-1">
          Sair para o menu
        </BotaoPrimario>
        <BotaoNeutro onClick={onCancelar} className="sm:flex-1">
          Continuar jogando
        </BotaoNeutro>
      </div>
    </Overlay>
  );
}

function statusTexto(phase: string): string {
  switch (phase) {
    case 'dealing':
      return 'Distribuindo…';
    case 'bidding':
      return 'Aguardando os palpites…';
    case 'playing':
      return 'Vez de outro jogador…';
    case 'trickResolved':
      return 'Resolvendo a vaza…';
    default:
      return '';
  }
}
