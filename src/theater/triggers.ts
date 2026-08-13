/**
 * O que, na mesa, merece um comentário.
 *
 * Cada gatilho é derivado de um `GameEvent` mais a `PlayerView` do momento —
 * nenhum deles precisa de informação que um jogador humano não teria.
 */

export type Trigger =
  /** Manilha de paus: a carta mais forte do baralho naquela mão. */
  | 'zap'
  | 'manilha'
  /** Levou a vaza com carta comum e baixa. */
  | 'roubada'
  /** Ganhou vaza que já não precisava — está estourando o palpite. */
  | 'passou'
  /** Vaza anulada (só no modo melar). */
  | 'melou'
  | 'bid_zero'
  /** Palpitou todas as vazas da mão. */
  | 'bid_all'
  /** O distribuidor ficou com uma opção legal só e teve que engolir. */
  | 'bid_forcado'
  /** Mão em que o baralho acabou na distribuição: sem manilha. */
  | 'sem_manilha'
  | 'na_mosca'
  | 'errou'
  | 'eliminado'
  | 'venceu';

export interface TriggerSpec {
  /** Teto de bots que comentam este gatilho. */
  falantes: number;
  /** Chance de o gatilho render comentário, antes da tagarelice da persona. */
  chance: number;
  /** Se o próprio autor da jogada pode se manifestar. */
  autorFala: boolean;
}

export const TRIGGERS: Record<Trigger, TriggerSpec> = {
  zap: { falantes: 2, chance: 1, autorFala: true },
  manilha: { falantes: 1, chance: 0.7, autorFala: false },
  roubada: { falantes: 1, chance: 0.55, autorFala: false },
  passou: { falantes: 1, chance: 0.5, autorFala: false },
  melou: { falantes: 1, chance: 0.8, autorFala: false },
  bid_zero: { falantes: 1, chance: 0.3, autorFala: false },
  bid_all: { falantes: 1, chance: 0.7, autorFala: false },
  bid_forcado: { falantes: 1, chance: 0.8, autorFala: true },
  sem_manilha: { falantes: 1, chance: 0.9, autorFala: false },
  na_mosca: { falantes: 1, chance: 0.45, autorFala: true },
  errou: { falantes: 1, chance: 0.45, autorFala: true },
  eliminado: { falantes: 2, chance: 1, autorFala: true },
  venceu: { falantes: 2, chance: 1, autorFala: true },
};

/** Quão solta é a boca da mesa. */
export type Registro = 'leve' | 'bar' | 'solto';

export const REGISTROS: { value: Registro; label: string; hint: string }[] = [
  { value: 'leve', label: 'Familiar', hint: 'só espanto limpo' },
  { value: 'bar', label: 'Mesa de bar', hint: 'gíria pesada, sem palavrão' },
  { value: 'solto', label: 'Sem freio', hint: 'palavrão de verdade' },
];
