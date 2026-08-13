import { useEffect, useState } from 'react';

import { createBot } from '../bots';
import type { BotMap } from '../bots/types';
import { randomSeed } from '../engine/rng';
import type { PlayerView } from '../engine/selectors';
import type { GameConfig } from '../engine/types';
import { configLiga, RITMO_LIGA, resultadoDeView, salvarResultado } from '../state/leagues';
import { carregarSettings, salvarSettings } from '../state/settings';
import type { UiSettings } from '../state/settings';
import { createLocalTransport } from '../transport/local';
import { DEFAULT_TIMINGS, scaleTimings } from '../transport/types';
import type { Transport } from '../transport/types';
import { GameScreen } from './GameScreen';
import { HomeScreen } from './HomeScreen';
import { LeagueScreen } from './LeagueScreen';
import { SetupScreen } from './SetupScreen';

type Rota = 'home' | 'setup' | 'liga';

function botsFrom(config: GameConfig): BotMap {
  const map: BotMap = {};
  config.players.forEach((p, i) => {
    if (p.isBot) map[`p${i}`] = createBot(p.botLevel ?? 'medium', config.seed + i * 7919);
  });
  return map;
}

export function App() {
  const [settings, setSettings] = useState<UiSettings>(carregarSettings);
  const [rota, setRota] = useState<Rota>('home');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  /** Liga da partida em andamento, ou `null` num jogo personalizado. */
  const [ligaAtiva, setLigaAtiva] = useState<string | null>(null);

  useEffect(() => {
    salvarSettings(settings);
  }, [settings]);

  // O transporte é o host da partida: nasce com a config, morre ao sair.
  useEffect(() => {
    if (config === null) {
      setTransport(null);
      return;
    }
    // Nas ligas o ritmo é sempre Cinema; no jogo personalizado, o do perfil.
    // `settings`/`ligaAtiva` ficam fora das dependências de propósito: o ritmo é
    // congelado no início da partida para não recriar a mesa no meio de uma mão.
    const ritmo = ligaAtiva ? RITMO_LIGA : settings.ritmo;
    const t = createLocalTransport({
      config,
      bots: botsFrom(config),
      timings: scaleTimings(DEFAULT_TIMINGS, ritmo),
    });
    setTransport(t);
    return () => t.dispose();
  }, [config]);

  function iniciarPersonalizado(c: GameConfig) {
    setLigaAtiva(null);
    setConfig(c);
  }

  function iniciarLiga(ligaId: string) {
    setLigaAtiva(ligaId);
    setConfig(configLiga(settings.apelido, randomSeed()));
  }

  function aoTerminar(view: PlayerView) {
    if (ligaAtiva) salvarResultado(ligaAtiva, resultadoDeView(view));
  }

  function sairDaPartida() {
    const voltarPara: Rota = ligaAtiva ? 'liga' : 'setup';
    setConfig(null);
    setLigaAtiva(null);
    setRota(voltarPara);
  }

  if (config !== null && transport !== null) {
    return (
      <GameScreen
        transport={transport}
        settings={settings}
        onSettings={setSettings}
        onRestart={sairDaPartida}
        onMatchOver={aoTerminar}
      />
    );
  }

  if (rota === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        onSettings={setSettings}
        onStart={iniciarPersonalizado}
        onVoltar={() => setRota('home')}
      />
    );
  }

  if (rota === 'liga') {
    return <LeagueScreen onJogar={iniciarLiga} onVoltar={() => setRota('home')} />;
  }

  return (
    <HomeScreen
      settings={settings}
      onSettings={setSettings}
      onCustom={() => setRota('setup')}
      onLiga={() => setRota('liga')}
    />
  );
}
