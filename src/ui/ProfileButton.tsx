import { useState } from 'react';

import type { UiSettings } from '../state/settings';
import { Marker } from './casino/Marker';
import { corMarcador } from './casino/markers';
import { ProfileScreen } from './ProfileScreen';

/**
 * O botão que abre o perfil já mostra o marcador escolhido: é a resposta à
 * pergunta "com o que eu aposto?" sem precisar abrir nada. Compartilhado pela
 * home e pela tela de jogo personalizado.
 */
export function ProfileButton({
  settings,
  onSettings,
  apelidoTravado = false,
}: {
  settings: UiSettings;
  onSettings: (s: UiSettings) => void;
  apelidoTravado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const cor = corMarcador(settings.corMarcador);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 py-2 transition-colors hover:bg-white/5"
      >
        <Marker
          tipo={settings.marcador}
          cor={{ body: cor.body, edge: cor.edge }}
          estado="base"
          size={20}
        />
        <span className="flex flex-col items-start leading-tight">
          <span className="max-w-24 truncate text-sm font-semibold">{settings.apelido}</span>
          <span className="text-[10px] text-white/45">perfil</span>
        </span>
      </button>

      {aberto && (
        <ProfileScreen
          settings={settings}
          onSettings={onSettings}
          apelidoTravado={apelidoTravado}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
