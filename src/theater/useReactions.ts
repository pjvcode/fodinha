import { useCallback, useEffect, useRef, useState } from 'react';

import { randomSeed } from '../engine/rng';
import type { Transport } from '../transport/types';
import { estadoInicial, reactionsFor, registrar } from './reactions';
import type { TheaterState } from './reactions';
import type { Registro } from './triggers';

export interface Balao {
  id: number;
  playerId: string;
  texto: string;
  /** Marcado pouco antes de sumir, para tocar a animação de saída. */
  saindo: boolean;
}

export interface Teatro {
  baloes: Balao[];
}

/** Tempo de leitura do balão: frase maior fica mais tempo. */
function duracao(texto: string): number {
  return Math.min(4200, 2200 + texto.length * 45);
}

const FADE_MS = 260;

/**
 * Liga os eventos do jogo às reações dos bots.
 *
 * Lê o log numerado do transporte a partir do último `seq` processado, então
 * não perde evento quando duas transições caem entre dois renders nem duplica
 * reação sob `StrictMode`.
 */
export function useReactions(transport: Transport, registro: Registro): Teatro {
  const [baloes, setBaloes] = useState<Balao[]>([]);

  // Espelho síncrono da lista: o updater do `setState` só roda no render, e o
  // cálculo da reação precisa saber agora quantos balões estão na tela.
  const baloesRef = useRef<Balao[]>([]);
  const seqRef = useRef(0);
  const rngRef = useRef(randomSeed());
  const teatroRef = useRef<TheaterState>(estadoInicial());
  const proximoIdRef = useRef(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const registroRef = useRef(registro);
  registroRef.current = registro;

  const mexerNosBaloes = useCallback((fn: (atuais: Balao[]) => Balao[]) => {
    baloesRef.current = fn(baloesRef.current);
    setBaloes(baloesRef.current);
  }, []);

  const agendar = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const processar = () => {
      for (const logged of transport.getEventLog()) {
        if (logged.seq <= seqRef.current) continue;
        seqRef.current = logged.seq;

        const agora = Date.now();
        const resultado = reactionsFor({
          logged,
          registro: registroRef.current,
          estado: teatroRef.current,
          baloesAtivos: baloesRef.current.length,
          agora,
          rng: rngRef.current,
        });
        rngRef.current = resultado.rng;
        if (resultado.reactions.length === 0) continue;

        teatroRef.current = registrar(teatroRef.current, resultado.reactions, agora);

        for (const r of resultado.reactions) {
          const id = proximoIdRef.current++;
          mexerNosBaloes((atuais) => [
            ...atuais,
            { id, playerId: r.playerId, texto: r.texto, saindo: false },
          ]);

          const vida = duracao(r.texto);
          agendar(
            () => mexerNosBaloes((a) => a.map((b) => (b.id === id ? { ...b, saindo: true } : b))),
            vida - FADE_MS,
          );
          agendar(() => mexerNosBaloes((a) => a.filter((b) => b.id !== id)), vida);
        }
      }
    };

    processar();
    const unsubscribe = transport.subscribe(processar);

    return () => {
      unsubscribe();
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
  }, [transport, agendar, mexerNosBaloes]);

  return { baloes };
}
