import { useSyncExternalStore } from 'react';

/**
 * Duas perguntas sobre a tela, respondidas separadamente porque medem coisas
 * diferentes.
 *
 * `estreita` decide quanto o leque pode se abrir: a conta é `n × (largura −
 * sobreposição) + sobreposição`, e é a largura da janela que diz se cabe.
 *
 * `baixa` decide o tamanho da carta. O caso é o celular deitado, onde sobra
 * largura e falta altura — ali uma mão de duas cartas cabe folgada na
 * horizontal e mesmo assim empurra os botões de palpite para fora da tela.
 *
 * `useSyncExternalStore` em cima do próprio `MediaQueryList`: ele já é uma fonte
 * externa com `subscribe` e leitura síncrona, então não há estado para
 * sincronizar nem efeito para rodar.
 */
export interface Tela {
  estreita: boolean;
  baixa: boolean;
}

const ESTREITA = '(max-width: 640px)';
const BAIXA = '(max-height: 560px)';

function mql(consulta: string): MediaQueryList | null {
  return typeof window === 'undefined' ? null : window.matchMedia(consulta);
}

function assinar(consulta: string) {
  return (aoMudar: () => void): (() => void) => {
    const m = mql(consulta);
    if (!m) return () => {};
    m.addEventListener('change', aoMudar);
    return () => m.removeEventListener('change', aoMudar);
  };
}

function useConsulta(consulta: string): boolean {
  return useSyncExternalStore(
    assinar(consulta),
    () => mql(consulta)?.matches ?? false,
    () => false,
  );
}

export function useTela(): Tela {
  return { estreita: useConsulta(ESTREITA), baixa: useConsulta(BAIXA) };
}
