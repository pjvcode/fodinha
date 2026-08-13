import type { UiSettings } from '../state/settings';
import { ProfileButton } from './ProfileButton';

/**
 * A porta de entrada. Duas escolhas: montar uma mesa do zero (Jogo
 * Personalizado) ou entrar numa das ligas de fábrica, onde o formato é fixo e o
 * placar de cada partida fica gravado.
 */
export function HomeScreen({
  settings,
  onSettings,
  onCustom,
  onLiga,
}: {
  settings: UiSettings;
  onSettings: (s: UiSettings) => void;
  onCustom: () => void;
  onLiga: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 p-4 sm:gap-8 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-amber-300 sm:text-5xl">
            Desafio Esquadrilha
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Baralho de 40 cartas, manilha do truco, e quem erra o palpite paga.
          </p>
        </div>
        <ProfileButton settings={settings} onSettings={onSettings} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <OpcaoCard
          titulo="Jogo Personalizado"
          descricao="Você escolhe jogadores, nível, ritmo e regras da mesa."
          onClick={onCustom}
        />
        <OpcaoCard
          titulo="Liga"
          descricao="Formato fixo, mesa de 5, ida e volta. O placar fica gravado."
          onClick={onLiga}
          destaque
        />
      </div>
    </div>
  );
}

function OpcaoCard({
  titulo,
  descricao,
  onClick,
  destaque = false,
}: {
  titulo: string;
  descricao: string;
  onClick: () => void;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex min-h-40 cursor-pointer flex-col items-start justify-between gap-3 rounded-2xl border p-5 text-left transition-colors',
        destaque
          ? 'border-amber-300/40 bg-amber-300/10 hover:bg-amber-300/15'
          : 'border-white/12 bg-black/25 hover:bg-white/5',
      ].join(' ')}
    >
      <span className="text-xl font-black tracking-tight text-white sm:text-2xl">{titulo}</span>
      <span className="text-sm text-white/60">{descricao}</span>
    </button>
  );
}
