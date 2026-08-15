/**
 * O lobby da sala, do ponto de vista do React.
 *
 * Mesma ideia de `useGame`: um `useSyncExternalStore` sobre o transporte, que já
 * avisa os assinantes a cada mensagem do servidor. Não há estado duplicado aqui
 * — a fonte é o transporte.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';

import type { RemoteTransport } from '../transport/remote';
import type { SalaPublica } from '../transport/protocol';

export interface EstadoSala {
  sala: SalaPublica | null;
  /** A partida já tem view — só então a tela de jogo pode montar. */
  jogando: boolean;
}

const VAZIO: EstadoSala = { sala: null, jogando: false };

export function useSala(transport: RemoteTransport | null): EstadoSala {
  // O snapshot precisa ser *a mesma referência* enquanto nada muda: devolver um
  // objeto novo a cada chamada faria o `useSyncExternalStore` ver mudança
  // sempre e entrar em laço de render. Daí o ref, que sobrevive ao render.
  const cache = useRef<EstadoSala>(VAZIO);

  const subscribe = useCallback(
    (listener: () => void) => transport?.subscribe(listener) ?? (() => {}),
    [transport],
  );

  const getSnapshot = useCallback(() => {
    if (!transport) return VAZIO;

    const sala = transport.getSala();
    const jogando = transport.temPartida();
    if (cache.current.sala !== sala || cache.current.jogando !== jogando) {
      cache.current = { sala, jogando };
    }
    return cache.current;
  }, [transport]);

  return useSyncExternalStore(subscribe, getSnapshot, () => VAZIO);
}
