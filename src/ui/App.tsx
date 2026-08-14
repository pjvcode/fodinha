import { useEffect, useState } from 'react';

import { apiRegistrarResultado } from '../api/client';
import { createBot } from '../bots';
import type { BotMap } from '../bots/types';
import { randomSeed } from '../engine/rng';
import type { PlayerView } from '../engine/selectors';
import type { GameConfig } from '../engine/types';
import { configLiga, RITMO_LIGA, resultadoDeView } from '../state/leagues';
import { salvarResultado } from '../state/leaguesLocal';
import { carregarSettings, salvarSettings } from '../state/settings';
import type { UiSettings } from '../state/settings';
import { useAuth } from '../state/useAuth';
import { createLocalTransport } from '../transport/local';
import { DEFAULT_TIMINGS, scaleTimings } from '../transport/types';
import type { Transport } from '../transport/types';
import { AuthScreen } from './AuthScreen';
import { GameScreen } from './GameScreen';
import { HomeScreen } from './HomeScreen';
import { LeagueScreen } from './LeagueScreen';
import { SetupScreen } from './SetupScreen';
import type { RegistroLiga } from './RoundSummary';

type Rota = 'home' | 'setup' | 'liga' | 'auth';

function botsFrom(config: GameConfig): BotMap {
  const map: BotMap = {};
  config.players.forEach((p, i) => {
    if (p.isBot) map[`p${i}`] = createBot(p.botLevel ?? 'medium', config.seed + i * 7919);
  });
  return map;
}

export function App() {
  const auth = useAuth();
  const [settings, setSettings] = useState<UiSettings>(carregarSettings);
  const [rota, setRota] = useState<Rota>('home');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  /** Liga da partida em andamento, ou `null` num jogo personalizado. */
  const [ligaAtiva, setLigaAtiva] = useState<string | null>(null);
  const [registroLiga, setRegistroLiga] = useState<RegistroLiga>({ estado: 'inativo' });

  useEffect(() => {
    salvarSettings(settings);
  }, [settings]);

  // Logado, quem manda no nome da mesa é a conta — é o nome que vai para a
  // classificação da liga e para os outros assentos numa sala online. Trocar
  // aqui, num ponto só, alcança a mesa, o perfil e a tela de setup de uma vez.
  const settingsDaMesa: UiSettings = auth.usuario
    ? { ...settings, apelido: auth.usuario.display }
    : settings;

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
    setRegistroLiga({ estado: 'inativo' });
    setConfig(c);
  }

  function iniciarLiga(ligaId: string) {
    setLigaAtiva(ligaId);
    setRegistroLiga({ estado: 'inativo' });
    setConfig(configLiga(settingsDaMesa.apelido, randomSeed()));
  }

  function aoTerminar(view: PlayerView) {
    if (!ligaAtiva) return;

    // O histórico local vale para todo mundo — quem joga sem conta também quer
    // ver as próprias partidas.
    salvarResultado(ligaAtiva, resultadoDeView(view));

    // A liga no servidor só existe para quem entrou. O log de ações vem do
    // transporte: é ele que hospeda a partida e sabe o que foi aplicado.
    const actions = transport?.getActionLog?.();
    if (!auth.usuario || !config || !actions || actions.length === 0) return;

    setRegistroLiga({ estado: 'enviando' });
    void apiRegistrarResultado(ligaAtiva, { config, actions: [...actions] }).then((r) => {
      setRegistroLiga(r.ok ? { estado: 'registrado' } : { estado: 'falhou', erro: r.erro });
    });
  }

  function sairDaPartida() {
    const voltarPara: Rota = ligaAtiva ? 'liga' : 'setup';
    setConfig(null);
    setLigaAtiva(null);
    setRota(voltarPara);
  }

  const logado = auth.usuario !== null;

  if (config !== null && transport !== null) {
    return (
      <GameScreen
        transport={transport}
        settings={settingsDaMesa}
        onSettings={setSettings}
        apelidoTravado={logado}
        registroLiga={registroLiga}
        onRestart={sairDaPartida}
        onMatchOver={aoTerminar}
      />
    );
  }

  if (rota === 'auth') {
    return <AuthScreen auth={auth} onVoltar={() => setRota('home')} />;
  }

  if (rota === 'setup') {
    return (
      <SetupScreen
        settings={settingsDaMesa}
        onSettings={setSettings}
        apelidoTravado={logado}
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
      settings={settingsDaMesa}
      onSettings={setSettings}
      apelidoTravado={logado}
      auth={auth}
      onEntrar={() => setRota('auth')}
      onCustom={() => setRota('setup')}
      onLiga={() => setRota('liga')}
    />
  );
}
