import { useMemo, useState } from 'react';

import { handSizeSequence, maxHandSize, MAX_PLAYERS, MIN_PLAYERS } from '../engine/progression';
import { defaultConfig } from '../engine/reducer';
import { randomSeed } from '../engine/rng';
import type { BotLevel, GameConfig, ScoringMode } from '../engine/types';
import { normalizarApelido, RITMOS } from '../state/settings';
import type { UiSettings } from '../state/settings';
import { REGISTROS } from '../theater/triggers';
import type { Registro } from '../theater/triggers';
import { ProfileButton } from './ProfileButton';

const NIVEIS: { value: BotLevel; label: string; hint: string }[] = [
  { value: 'easy', label: 'Fácil', hint: 'estima por categoria de carta' },
  { value: 'medium', label: 'Médio', hint: 'calcula probabilidade por carta' },
  { value: 'hard', label: 'Difícil', hint: 'igual ao médio por enquanto' },
];

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-white/85">{label}</span>
      {children}
      {hint && <span className="text-xs text-white/45">{hint}</span>}
    </label>
  );
}

const selectClass =
  'rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/70';

export interface SetupScreenProps {
  settings: UiSettings;
  onSettings: (s: UiSettings) => void;
  /** Logado, o apelido da mesa vem da conta e o perfil não o edita. */
  apelidoTravado?: boolean;
  onStart: (config: GameConfig) => void;
  /** Volta para a home. */
  onVoltar: () => void;
}

export function SetupScreen({
  settings,
  onSettings,
  apelidoTravado,
  onStart,
  onVoltar,
}: SetupScreenProps) {
  const [numPlayers, setNumPlayers] = useState(4);
  const [nivel, setNivel] = useState<BotLevel>('medium');
  const [modo, setModo] = useState<ScoringMode>('penalty');
  const [vidas, setVidas] = useState(5);
  const [cap, setCap] = useState<number | null>(null);
  const [seedFixa, setSeedFixa] = useState('');

  const preview = useMemo(() => {
    const base = defaultConfig({
      players: montarJogadores(numPlayers, nivel, settings.apelido),
      maxCardsCap: cap,
    });
    const seq = handSizeSequence(numPlayers, base);
    const max = maxHandSize(numPlayers, base);
    const semManilha = max * numPlayers === 40;
    return { maos: seq.length, max, semManilha, minutos: Math.round((seq.length * 75) / 60) };
  }, [numPlayers, nivel, cap, settings.apelido]);

  function comecar() {
    const parsed = Number(seedFixa);
    onStart(
      defaultConfig({
        players: montarJogadores(numPlayers, nivel, settings.apelido),
        scoringMode: modo,
        startingLives: vidas,
        maxCardsCap: cap,
        seed: seedFixa.trim() !== '' && Number.isFinite(parsed) ? parsed >>> 0 : randomSeed(),
      }),
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-5 p-4 sm:gap-6 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onVoltar}
            className="mb-1 cursor-pointer text-xs text-white/50 transition-colors hover:text-white/80"
          >
            ← Voltar
          </button>
          <h1 className="text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">
            Jogo Personalizado
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Baralho de 40 cartas, manilha do truco, e quem erra o palpite paga. Menos pontos vence.
          </p>
        </div>

        <ProfileButton
          settings={settings}
          onSettings={onSettings}
          apelidoTravado={apelidoTravado}
        />
      </header>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 sm:grid-cols-2 sm:p-5">
        <Campo label="Jogadores" hint="você mais os bots">
          <select
            className={selectClass}
            value={numPlayers}
            onChange={(e) => setNumPlayers(Number(e.target.value))}
          >
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map(
              (n) => (
                <option key={n} value={n}>
                  {n} jogadores
                </option>
              ),
            )}
          </select>
        </Campo>

        <Campo label="Nível dos bots" hint={NIVEIS.find((n) => n.value === nivel)?.hint}>
          <select
            className={selectClass}
            value={nivel}
            onChange={(e) => setNivel(e.target.value as BotLevel)}
          >
            {NIVEIS.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Fim da partida">
          <select
            className={selectClass}
            value={modo}
            onChange={(e) => setModo(e.target.value as ScoringMode)}
          >
            <option value="penalty">Penalidade acumulada — menor total vence</option>
            <option value="elimination">Vidas — sai quem zera</option>
          </select>
        </Campo>

        {modo === 'elimination' ? (
          <Campo label="Vidas iniciais">
            <select
              className={selectClass}
              value={vidas}
              onChange={(e) => setVidas(Number(e.target.value))}
            >
              {[3, 5, 7, 10].map((v) => (
                <option key={v} value={v}>
                  {v} vidas
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          <Campo label="Teto de cartas por mão" hint="deixe no natural para a progressão completa">
            <select
              className={selectClass}
              value={cap ?? 'none'}
              onChange={(e) => setCap(e.target.value === 'none' ? null : Number(e.target.value))}
            >
              <option value="none">Natural ({preview.max} cartas)</option>
              {[3, 4, 5, 6, 7]
                .filter((c) => c < preview.max)
                .map((c) => (
                  <option key={c} value={c}>
                    Até {c} cartas
                  </option>
                ))}
            </select>
          </Campo>
        )}

        <Campo label="Semente (opcional)" hint="mesma semente, mesmas cartas">
          <input
            className={selectClass}
            inputMode="numeric"
            placeholder="aleatória"
            value={seedFixa}
            onChange={(e) => setSeedFixa(e.target.value)}
          />
        </Campo>

        <Campo
          label="Boca dos bots"
          hint={REGISTROS.find((r) => r.value === settings.registro)?.hint}
        >
          <select
            className={selectClass}
            value={settings.registro}
            onChange={(e) => onSettings({ ...settings, registro: e.target.value as Registro })}
          >
            {REGISTROS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Ritmo da mesa" hint={RITMOS.find((r) => r.value === settings.ritmo)?.hint}>
          <select
            className={selectClass}
            value={settings.ritmo}
            onChange={(e) => onSettings({ ...settings, ritmo: Number(e.target.value) })}
          >
            {RITMOS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
        Progressão 1 → {preview.max} → 1: <strong className="text-white">{preview.maos} mãos</strong>
        , cerca de {preview.minutos} min.
        {preview.semManilha && (
          <>
            {' '}
            A mão de {preview.max} cartas usa o baralho inteiro e é jogada{' '}
            <span className="text-sky-300">sem manilha</span>.
          </>
        )}
      </div>

      <button
        type="button"
        onClick={comecar}
        className="cursor-pointer rounded-xl bg-amber-300 py-3 text-lg font-bold text-felt-900 transition-colors hover:bg-amber-200"
      >
        Começar partida
      </button>
    </div>
  );
}

function montarJogadores(
  numPlayers: number,
  nivel: BotLevel,
  apelido: string,
): GameConfig['players'] {
  return Array.from({ length: numPlayers }, (_, i) => ({
    name: i === 0 ? normalizarApelido(apelido) : `Bot ${i}`,
    isBot: i !== 0,
    botLevel: i === 0 ? undefined : nivel,
  }));
}
